import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { X, Upload, FileText, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { collection, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { logOperation } from '../lib/logger';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  importType: 'device' | 'consumable';
  onSuccess: () => void;
}

export default function CsvImportModal({ isOpen, onClose, importType, onSuccess }: CsvImportModalProps) {
  const { currentUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1 = Upload, 2 = Preview, 3 = Result
  
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<{
    successful: number;
    failed: number;
    errors: string[];
  } | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    
    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setHeaders(results.meta.fields || []);
        setParsedData(results.data);
        setStep(2);
      },
      error: (error) => {
        alert("Errore nell'analisi del file CSV: " + error.message);
      }
    });
  };

  const handleDownloadTemplate = () => {
    let csvContent = "";
    if (importType === 'device') {
      csvContent = "category,serialNumber,notes\nPortatile,LAP123456,Dell XPS\nFisso,PC001,Area uffici\nMonitor,MON999,\n";
    } else {
      csvContent = "name,category,totalQuantity,unit\nCavo di Rete 2m,Cavi,50,pz\nMouse Wireless,Accessori,20,pz\nAdattatore USB-C,Adattatori,100,pz\n";
    }
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `template_import_${importType}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const executeImport = async () => {
    if (!parsedData.length || !currentUser) return;
    
    setImporting(true);
    let successCount = 0;
    let failCount = 0;
    const errorLogs: string[] = [];

    // Firestore batch writes are limited to 500 operations.
    // We'll process in chunks of 400 to be safe.
    const chunkSize = 400;
    
    try {
      for (let i = 0; i < parsedData.length; i += chunkSize) {
        const chunk = parsedData.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        
        chunk.forEach((row, index) => {
          const rowNumber = i + index + 2; // +1 for header, +1 for 0-index
          
          if (importType === 'device') {
            const category = row.category?.trim();
            const serialNumber = row.serialNumber?.trim();
            
            if (!category || !serialNumber) {
              failCount++;
              errorLogs.push(`Riga ${rowNumber}: Campi 'category' e 'serialNumber' sono obbligatori.`);
              return; // skip to next
            }
            
            const docRef = doc(collection(db, 'devices'));
            
            // Collect any extra fields into dynamicFields
            const dynamicFields: Record<string, string> = {};
            Object.keys(row).forEach(key => {
              if (key !== 'category' && key !== 'serialNumber' && row[key]) {
                dynamicFields[key] = row[key];
              }
            });

            batch.set(docRef, {
              category,
              serialNumber,
              dynamicFields,
              addedBy: currentUser.uid,
              history: [{
                date: serverTimestamp(),
                action: 'Dispositivo importato tramite CSV',
                userId: currentUser.uid,
                userEmail: currentUser.email
              }],
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
            successCount++;
          } else if (importType === 'consumable') {
            const name = row.name?.trim();
            const category = row.category?.trim();
            const totalQuantity = parseInt(row.totalQuantity, 10);
            const unit = row.unit?.trim() || 'pz';
            
            if (!name || !category || isNaN(totalQuantity)) {
              failCount++;
              errorLogs.push(`Riga ${rowNumber}: Campi 'name', 'category', 'totalQuantity' (numero) sono obbligatori.`);
              return;
            }
            
            const docRef = doc(collection(db, 'consumables'));
            batch.set(docRef, {
              name,
              category,
              totalQuantity,
              consumedQuantity: 0,
              unit,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
            successCount++;
          }
        });
        
        await batch.commit();
      }
      
      await logOperation('create', importType === 'device' ? 'devices' : 'consumables', `Importazione massiva completata (${successCount} elementi)`, currentUser.uid, currentUser.email || '');
      
      setResults({ successful: successCount, failed: failCount, errors: errorLogs });
      setStep(3);
      onSuccess();
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, OperationType.WRITE, importType === 'device' ? 'devices' : 'consumables');
      setResults({ successful: successCount, failed: failCount, errors: [...errorLogs, 'Errore generico di scrittura su database.'] });
      setStep(3);
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setParsedData([]);
    setHeaders([]);
    setStep(1);
    setResults(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px] animate-in" onClick={importing ? undefined : onClose} />
      
      <div className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[92dvh]">
        <header className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4 shrink-0">
          <h3 className="text-base font-semibold text-slate-900 tracking-tight flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Importazione Massiva ({importType === 'device' ? 'Dispositivi' : 'Consumabili'})
          </h3>
          <button 
            onClick={onClose} 
            disabled={importing}
            className="icon-btn"
          >
            <X />
          </button>
        </header>

        <div className="p-6 overflow-y-auto grow">
          {step === 1 && (
            <div className="space-y-6">
              <div className="bg-blue-50 text-blue-800 p-4 rounded-lg flex items-start gap-3">
                <Info className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold mb-1">Come preparare il file CSV</p>
                  <p className="mb-2">Assicurati che la prima riga contenga i nomi delle colonne esattamente come specificato nel template.</p>
                  <button 
                    onClick={handleDownloadTemplate}
                    className="text-blue-600 font-bold hover:underline"
                  >
                    Scarica template CSV
                  </button>
                </div>
              </div>

              <div 
                className="border-2 border-dashed border-slate-300 rounded-xl p-10 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="bg-slate-100 p-4 rounded-full mb-4">
                  <FileText className="w-8 h-8 text-slate-400" />
                </div>
                <h4 className="font-bold text-slate-800 mb-2">Seleziona un file CSV</h4>
                <p className="text-sm text-slate-500 max-w-sm">
                  Trascina qui il tuo file (.csv) o clicca per sfogliarlo. 
                </p>
                <input 
                  type="file" 
                  accept=".csv" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-800 text-lg">Anteprima Dati</h4>
                  <p className="text-sm text-slate-500">Trovate {parsedData.length} righe da importare.</p>
                </div>
                <button 
                  onClick={handleReset}
                  disabled={importing}
                  className="text-sm font-semibold text-slate-500 hover:text-slate-800 disabled:opacity-50"
                >
                  Scegli un altro file
                </button>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden flex flex-col max-h-[300px]">
                <div className="overflow-x-auto overflow-y-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-100 sticky top-0 border-b border-slate-200 shadow-sm z-10">
                      <tr>
                        {headers.map((h, i) => (
                          <th key={i} className="px-4 py-3 font-semibold text-slate-600">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {parsedData.slice(0, 10).map((row, i) => (
                        <tr key={i} className="hover:bg-slate-100/50">
                          {headers.map((h, j) => (
                            <td key={j} className="px-4 py-2 text-slate-700">{row[h] || '-'}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsedData.length > 10 && (
                    <div className="text-center py-3 text-sm text-slate-500 font-medium bg-slate-50 border-t border-slate-200 sticky bottom-0">
                      ... e altre {parsedData.length - 10} righe
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 3 && results && (
            <div className="space-y-6 text-center py-6">
              <div className="flex justify-center mb-4">
                {results.failed === 0 ? (
                  <div className="bg-emerald-100 text-emerald-600 p-4 rounded-full">
                    <CheckCircle2 className="w-12 h-12" />
                  </div>
                ) : (
                  <div className="bg-amber-100 text-amber-600 p-4 rounded-full">
                    <AlertCircle className="w-12 h-12" />
                  </div>
                )}
              </div>
              
              <h4 className="font-bold text-slate-800 text-xl">Importazione Completata</h4>
              
              <div className="flex items-center justify-center gap-6 mt-6">
                <div className="text-center">
                  <div className="text-3xl font-black text-emerald-600">{results.successful}</div>
                  <div className="text-xs text-slate-500 mt-1">Importati</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-black text-rose-500">{results.failed}</div>
                  <div className="text-xs text-slate-500 mt-1">Saltati/Errori</div>
                </div>
              </div>

              {results.errors.length > 0 && (
                <div className="mt-8 text-left bg-rose-50 border border-rose-100 rounded-lg p-4">
                  <h5 className="font-bold text-rose-800 text-sm mb-2">Dettaglio Errori</h5>
                  <ul className="text-xs text-rose-600 space-y-1 list-disc pl-4 max-h-40 overflow-y-auto">
                    {results.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {step === 2 && (
          <footer className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
            <button
              onClick={executeImport}
              disabled={importing}
              className="btn btn-primary"
            >
              {importing ? (
                <>Risoluzione in corso...</>
              ) : (
                <>Conferma e Importa {parsedData.length} Elementi</>
              )}
            </button>
          </footer>
        )}
        
        {step === 3 && (
          <footer className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-slate-800 text-white font-semibold rounded-lg hover:bg-slate-900 transition-colors"
            >
              Chiudi
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}
