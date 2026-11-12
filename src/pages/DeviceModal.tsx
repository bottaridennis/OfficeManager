import React, { useState, useRef, useEffect } from 'react';
import { doc, setDoc, updateDoc, serverTimestamp, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { X, Plus, Trash2, Camera, Link as LinkIcon, Image as ImageIcon, Sparkles } from 'lucide-react';
import { logOperation } from '../lib/logger';
import { Device } from '../types';

export default function DeviceModal({ onClose, editDevice }: { onClose: () => void, editDevice?: Device }) {
  const { currentUser } = useAuth();
  const [category, setCategory] = useState(editDevice?.category || '');
  const [serialNumber, setSerialNumber] = useState(editDevice?.serialNumber || '');
  const [photoUrl, setPhotoUrl] = useState(editDevice?.photoUrl || '');
  const [inputType, setInputType] = useState<'url' | 'camera'>(editDevice?.photoUrl ? 'url' : 'camera');
  const [dynamicFields, setDynamicFields] = useState<{ key: string; value: string }[]>(
    editDevice?.dynamicFields ? Object.entries(editDevice.dynamicFields).map(([key, value]) => ({ key, value })) : []
  );
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categorySuggestions, setCategorySuggestions] = useState<Record<string, string[]>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Fetch common fields per category to provide suggestions
    const fetchSuggestions = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'devices'), orderBy('category')));
        const fieldMap: Record<string, Set<string>> = {};
        
        snap.docs.forEach(doc => {
          const data = doc.data() as Device;
          if (data.category && data.dynamicFields) {
            if (!fieldMap[data.category]) fieldMap[data.category] = new Set();
            Object.keys(data.dynamicFields).forEach(k => fieldMap[data.category].add(k));
          }
        });

        const finalSuggestions: Record<string, string[]> = {};
        Object.entries(fieldMap).forEach(([cat, keys]) => {
          finalSuggestions[cat] = Array.from(keys);
        });
        setCategorySuggestions(finalSuggestions);
      } catch (err) {
        console.error("Error fetching suggestions:", err);
      }
    };
    fetchSuggestions();
  }, []);

  const addField = (key = '', value = '') => setDynamicFields([...dynamicFields, { key, value }]);
  
  const applySuggestedFields = () => {
    const suggested = categorySuggestions[category] || [];
    const currentKeys = new Set(dynamicFields.map(f => f.key));
    const newFields = [...dynamicFields];
    
    suggested.forEach(s => {
      if (!currentKeys.has(s)) {
        newFields.push({ key: s, value: '' });
      }
    });
    setDynamicFields(newFields);
  };

  const updateField = (index: number, field: 'key' | 'value', val: string) => {
    const newFields = [...dynamicFields];
    newFields[index][field] = val;
    setDynamicFields(newFields);
  };
  const removeField = (index: number) => {
    setDynamicFields(dynamicFields.filter((_, i) => i !== index));
  };

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Compress the image to JPEG with 0.7 quality to save space ~100-200kb which is safe for Firestore
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        setPhotoUrl(dataUrl);
      };
      if (event.target?.result) {
        img.src = event.target.result as string;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !serialNumber) {
      setError('Categoria e Seriale sono obbligatori');
      return;
    }

    setIsSubmitting(true);
    setError('');

    const fieldsObj = dynamicFields.reduce((acc, curr) => {
      if (curr.key && curr.value) acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);

    try {
      if (editDevice) {
        const deviceRef = doc(db, 'devices', editDevice.id);
        await updateDoc(deviceRef, {
          category,
          serialNumber,
          photoUrl,
          dynamicFields: fieldsObj,
          updatedAt: serverTimestamp(),
        });
        await logOperation('update', 'devices', `Aggiornato dispositivo: ${category} (${serialNumber})`, currentUser!.uid, currentUser!.email || '', editDevice.id);
      } else {
        const newDeviceRef = doc(collection(db, 'devices'));
        await setDoc(newDeviceRef, {
          category,
          serialNumber,
          photoUrl,
          dynamicFields: fieldsObj,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          addedBy: currentUser!.uid
        });
        await logOperation('create', 'devices', `Creato dispositivo: ${category} (${serialNumber})`, currentUser!.uid, currentUser!.email || '', newDeviceRef.id);
      }
      onClose();
    } catch (err: any) {
      setError(err.message);
      setIsSubmitting(false);
      handleFirestoreError(err, editDevice ? OperationType.UPDATE : OperationType.CREATE, 'devices');
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px] animate-in" onClick={onClose} />
      
      <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden animate-in flex flex-col max-h-[92dvh]">
        <header className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4 shrink-0">
          <div>
            <h3 className="text-base font-semibold text-slate-900 tracking-tight">{editDevice ? 'Modifica Dispositivo' : 'Nuovo Dispositivo'}</h3>
            <p className="text-xs text-slate-500">Censisci e configura l'hardware aziendale a inventario</p>
          </div>
          <button onClick={onClose} className="icon-btn">
            <X className="w-4 h-4" />
          </button>
        </header>

        {error && <div className="mx-6 mt-4 shrink-0 text-[13px] text-rose-700 bg-rose-50 border border-rose-200/80 px-3 py-2 rounded-lg text-center">{error}</div>}

        <div className="overflow-y-auto shrink p-6">
          <form id="deviceForm" onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5 ml-1">Categoria</label>
                <input
                  type="text"
                  required
                  placeholder="es. PC Portatile"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="input w-full h-11 md:h-9 md:text-xs"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5 ml-1">Codice Seriale</label>
                <input
                  type="text"
                  required
                  placeholder="SN-123456"
                  value={serialNumber}
                  onChange={e => setSerialNumber(e.target.value)}
                  className="input w-full h-11 md:h-9 md:text-xs font-mono uppercase"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5 ml-1">
                <label className="text-xs font-medium text-slate-500">Foto Dispositivo</label>
                <div className="flex gap-1">
                  <button type="button" onClick={() => setInputType('camera')} className={`p-1 rounded ${inputType === 'camera' ? 'bg-slate-200 text-slate-700' : 'text-slate-400'}`}><Camera className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={() => setInputType('url')} className={`p-1 rounded ${inputType === 'url' ? 'bg-slate-200 text-slate-700' : 'text-slate-400'}`}><LinkIcon className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              
              {inputType === 'url' ? (
                <input
                  type="url"
                  placeholder="https://..."
                  value={photoUrl}
                  onChange={e => setPhotoUrl(e.target.value)}
                  className="input w-full h-11 md:h-9 md:text-xs"
                />
              ) : (
                <div className="space-y-3">
                  <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleCapture} className="hidden" />
                  
                  {photoUrl ? (
                    <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-slate-50 aspect-video flex items-center justify-center">
                      <img src={photoUrl} alt="Preview" className="max-h-full max-w-full object-contain" />
                      <button 
                        type="button" 
                        onClick={() => setPhotoUrl('')}
                        className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70 backdrop-blur-sm touch-manipulation"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-24 md:h-20 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-colors touch-manipulation bg-slate-50"
                    >
                      <Camera className="w-6 h-6 md:w-5 md:h-5" />
                      <span className="text-[13px] font-medium">Scatta o carica una foto</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="pt-2">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-3">
                  <label className="text-xs font-medium text-slate-500 ml-1">Dettagli Tecnici</label>
                  {categorySuggestions[category] && (
                    <button
                      type="button"
                      onClick={applySuggestedFields}
                      className="flex items-center gap-1 text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded border border-amber-100 hover:bg-amber-100 transition-colors font-bold uppercase tracking-tight"
                    >
                      <Sparkles className="w-3 h-3" /> Suggerisci Campi
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => addField()}
                  className="text-[10px] font-bold flex items-center gap-1 text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded border border-blue-100 touch-manipulation uppercase"
                >
                  <Plus className="w-3.5 h-3.5" /> Aggiungi Campo
                </button>
              </div>
              
              <div className="space-y-3 max-h-[160px] overflow-y-auto pr-2 custom-scrollbar">
                {dynamicFields.map((field, idx) => (
                  <div key={idx} className="flex gap-2 items-center animate-in slide-in-from-left-2 duration-200">
                    <input
                      type="text"
                      placeholder="Etichetta (es. RAM)"
                      value={field.key}
                      onChange={e => updateField(idx, 'key', e.target.value)}
                      className="input flex-1 h-11 md:h-8 md:text-[11px]"
                    />
                    <input
                      type="text"
                      placeholder="Valore"
                      value={field.value}
                      onChange={e => updateField(idx, 'value', e.target.value)}
                      className="input flex-1 h-11 md:h-8 md:text-[11px]"
                    />
                    <button
                      type="button"
                      onClick={() => removeField(idx)}
                      className="p-3 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg touch-manipulation shrink-0"
                    >
                      <Trash2 className="w-5 h-5 md:w-4 md:h-4" />
                    </button>
                  </div>
                ))}
                {dynamicFields.length === 0 && (
                  <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl text-xs text-slate-400 font-medium bg-slate-50/50">
                    Nessun dettaglio aggiuntivo specificato.
                  </div>
                )}
              </div>
            </div>
          </form>
        </div>
        
        <footer className="p-4 bg-slate-50/80 border-t border-slate-200/80 flex flex-col md:flex-row-reverse gap-2.5 shrink-0">
          <button
            type="submit"
            form="deviceForm"
            disabled={isSubmitting}
            className="btn btn-primary w-full md:w-auto h-10"
          >
            {isSubmitting ? 'Salvataggio...' : (editDevice ? 'Salva Modifiche' : 'Crea Dispositivo')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary w-full md:w-auto h-10"
          >
            Annulla
          </button>
        </footer>
      </div>
    </div>
  );
}
