import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Device } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { PageHeader, PageBody, PageLoader, EmptyState, DropdownMenu, DeviceStatusBadge, Avatar } from '../components/ui';
import { 
  ArrowLeft, 
  Smartphone, 
  History, 
  Tag, 
  Box, 
  Hash, 
  Wrench, 
  UserCheck, 
  UserMinus, 
  QrCode, 
  Printer, 
  Download, 
  Copy, 
  Check, 
  FileText, 
  FileSpreadsheet 
} from 'lucide-react';
import Barcode from 'react-barcode';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import DeviceAssignmentModal from '../components/DeviceAssignmentModal';
import DeviceLabelModal from '../components/DeviceLabelModal';
import { logOperation } from '../lib/logger';
import { exportMaintenanceLogsToCsv, exportMaintenanceLogsToPdf, MaintenanceExportItem } from '../lib/exportUtils';

export default function DeviceDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userData, currentUser } = useAuth();
  
  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const isAdminOrTech = userData?.role === 'admin' || userData?.role === 'tecnico';

  useEffect(() => {
    if (!id) return;

    const unsub = onSnapshot(doc(db, 'devices', id), (docSnap) => {
      if (docSnap.exists()) {
        const d = { id: docSnap.id, ...docSnap.data() } as Device;
        
        // Security check: if not admin/tech, can only view if assigned to them
        if (!isAdminOrTech && d.assignedToUserId !== currentUser?.uid) {
          navigate('/devices');
          return;
        }
        
        setDevice(d);
      } else {
        navigate('/devices');
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `devices/${id}`);
      navigate('/devices');
    });

    return () => unsub();
  }, [id, isAdminOrTech, currentUser?.uid, navigate]);

  const handleMaintenance = async () => {
    if (!isAdminOrTech || !device) return;
    try {
      const newStatus = !device.isUnderMaintenance;
      const historyEntry = {
        date: new Date(),
        action: newStatus ? 'maintenance_start' : 'maintenance_end',
        userId: currentUser!.uid,
        userEmail: currentUser!.email,
        notes: newStatus ? 'Inviato in manutenzione' : 'Tornato dalla manutenzione'
      };
      
      await updateDoc(doc(db, 'devices', device.id), {
        isUnderMaintenance: newStatus,
        history: [...(device.history || []), historyEntry],
        updatedAt: serverTimestamp()
      });
      
      await logOperation('maintenance', 'devices', `Manutenzione ${newStatus ? 'iniziata' : 'terminata'} per: ${device.category} (${device.serialNumber})`, currentUser!.uid, currentUser!.email || '', device.id);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `devices/${device.id}`);
    }
  };

  const deviceUrl = id ? `${window.location.origin}${import.meta.env.BASE_URL}devices/${id}` : '';

  const handleCopyLink = () => {
    if (!deviceUrl) return;
    navigator.clipboard.writeText(deviceUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleDownloadQrPng = () => {
    if (!qrCanvasRef.current || !device) return;
    const url = qrCanvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `QR_${device.category.replace(/\s+/g, '_')}_${device.serialNumber}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleExportHistoryCsv = () => {
    if (!device) return;
    const items: MaintenanceExportItem[] = (device.history || []).map((h, idx) => ({
      id: `${device.id}-${idx}`,
      date: h.date,
      category: device.category,
      serialNumber: device.serialNumber,
      action: h.action === 'assigned' ? 'Assegnato' :
              h.action === 'returned' ? 'Restituito' :
              h.action === 'maintenance_start' ? 'Inizio Manutenzione' :
              h.action === 'maintenance_end' ? 'Fine Manutenzione' : h.action,
      operator: h.userEmail || 'Sistema',
      notes: h.notes || '',
      deviceId: device.id,
    }));
    exportMaintenanceLogsToCsv(items, `storico_${device.serialNumber}.csv`);
  };

  const handleExportHistoryPdf = () => {
    if (!device) return;
    const items: MaintenanceExportItem[] = (device.history || []).map((h, idx) => ({
      id: `${device.id}-${idx}`,
      date: h.date,
      category: device.category,
      serialNumber: device.serialNumber,
      action: h.action === 'assigned' ? 'Assegnato' :
              h.action === 'returned' ? 'Restituito' :
              h.action === 'maintenance_start' ? 'Inizio Manutenzione' :
              h.action === 'maintenance_end' ? 'Fine Manutenzione' : h.action,
      operator: h.userEmail || 'Sistema',
      notes: h.notes || '',
      deviceId: device.id,
    }));
    exportMaintenanceLogsToPdf(items, `Storico & Manutenzione: ${device.category} (${device.serialNumber})`);
  };

  if (loading) return <PageLoader />;
  if (!device) return (
    <PageBody className="pt-10">
      <div className="card">
        <EmptyState icon={<Box />} title="Dispositivo non trovato" description="Potrebbe essere stato eliminato." action={<button onClick={() => navigate('/devices')} className="btn btn-secondary btn-sm"><ArrowLeft /> Torna ai dispositivi</button>} />
      </div>
    </PageBody>
  );

  const history = device.history || [];
  const specs = Object.entries(device.dynamicFields || {}).filter(([_, val]) => (val as string) && String(val).trim() !== '');
  const ACTION: Record<string, [string, string, string]> = {
    assigned: ['Assegnato', 'badge-brand', 'bg-blue-500'],
    returned: ['Restituito', 'badge-success', 'bg-emerald-500'],
    maintenance_start: ['In manutenzione', 'badge-warning', 'bg-amber-500'],
    maintenance_end: ['Fine manutenzione', 'badge-success', 'bg-emerald-500'],
    created: ['Registrato', 'badge-neutral', 'bg-slate-400'],
  };
  const fmtDate = (d: any) => (d ? (typeof d.toDate === 'function' ? d.toDate() : new Date(d)).toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' }) : 'Data non disponibile');

  return (
    <div className="flex flex-col flex-1">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="icon-btn -ml-2" aria-label="Indietro"><ArrowLeft /></button>
            <span className="truncate">{device.category}</span>
            <DeviceStatusBadge maintenance={device.isUnderMaintenance} assigned={!!device.assignedToUserId} />
          </span>
        }
        description={<span className="font-mono">{device.serialNumber}</span>}
        actions={
          <>
            <button onClick={() => setShowLabelModal(true)} className="btn btn-secondary" title="Genera etichetta con QR code">
              <QrCode /> <span className="hidden sm:inline">Etichetta</span>
            </button>
            {isAdminOrTech && (
              <>
                <button onClick={handleMaintenance} className={`btn ${device.isUnderMaintenance ? 'btn-soft' : 'btn-secondary'}`}>
                  <Wrench /> <span className="hidden sm:inline">{device.isUnderMaintenance ? 'Termina manutenzione' : 'Manutenzione'}</span>
                </button>
                <button onClick={() => setShowAssignModal(true)} className="btn btn-primary">
                  {device.assignedToUserId ? <UserMinus /> : <UserCheck />}
                  {device.assignedToUserId ? 'Ritira' : 'Assegna'}
                </button>
              </>
            )}
          </>
        }
      />

      <PageBody className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* Colonna sinistra */}
        <div className="space-y-5">
          <div className="card overflow-hidden">
            {device.photoUrl && (
              <div className="bg-slate-50 border-b border-slate-100 flex justify-center p-6">
                <img src={device.photoUrl} alt={device.category} className="h-32 object-contain" />
              </div>
            )}
            <dl className="p-5 space-y-4 text-[13px]">
              <div>
                <dt className="text-xs text-slate-500 mb-1">Assegnato a</dt>
                <dd>
                  {device.assignedToUserId ? (
                    <span className="flex items-center gap-2"><Avatar email={device.assignedToUserEmail} size="sm" /><span className="font-medium text-slate-900 truncate">{device.assignedToUserEmail}</span></span>
                  ) : (
                    <span className="text-slate-500">In magazzino</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500 mb-1">Numero seriale</dt>
                <dd className="font-mono text-slate-900">{device.serialNumber}</dd>
                <div className="mt-2 opacity-80"><Barcode value={device.serialNumber} height={36} width={1.2} displayValue={false} background="transparent" lineColor="#26262d" margin={0} /></div>
              </div>
            </dl>
          </div>

          <div className="card p-5">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-white border border-slate-200 rounded-lg shrink-0">
                <QRCodeSVG value={deviceUrl} size={96} level="M" includeMargin={false} />
              </div>
              <div className="min-w-0">
                <h3 className="card-title">QR code scheda</h3>
                <p className="text-xs text-slate-500 mt-1">Inquadralo con la fotocamera per aprire subito questa pagina.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button onClick={handleDownloadQrPng} className="btn btn-secondary btn-sm" title="Scarica PNG ad alta risoluzione"><Download /> PNG</button>
              <button onClick={handleCopyLink} className="btn btn-secondary btn-sm">
                {copiedLink ? <Check className="!text-emerald-600" /> : <Copy />}
                {copiedLink ? 'Copiato' : 'Copia link'}
              </button>
            </div>
            <div className="hidden">
              <QRCodeCanvas ref={qrCanvasRef} value={deviceUrl} size={512} level="H" includeMargin={true} />
            </div>
          </div>
        </div>

        {/* Colonna destra */}
        <div className="lg:col-span-2 space-y-5">
          <section className="card overflow-hidden">
            <header className="card-header">
              <h3 className="card-title">Specifiche tecniche</h3>
            </header>
            {specs.length === 0 ? (
              <EmptyState icon={<Tag />} title="Nessuna specifica" description="Aggiungi i dettagli tecnici modificando il dispositivo." className="py-8" />
            ) : (
              <dl className="grid grid-cols-1 sm:grid-cols-2">
                {specs.map(([key, val]) => (
                  <div key={key} className="px-5 py-3 border-b border-slate-100 sm:odd:border-r">
                    <dt className="text-xs text-slate-500 capitalize">{key}</dt>
                    <dd className="text-[13px] font-medium text-slate-900 mt-0.5 break-words">{val}</dd>
                  </div>
                ))}
              </dl>
            )}
          </section>

          <section className="card overflow-hidden">
            <header className="card-header">
              <div>
                <h3 className="card-title">Cronologia</h3>
                <p className="card-subtitle">Passaggi di mano e manutenzioni · {history.length}</p>
              </div>
              {history.length > 0 && (
                <DropdownMenu
                  triggerClassName="btn btn-secondary btn-sm"
                  trigger={<><Download /> Esporta</>}
                  items={[
                    { label: 'CSV', icon: <FileSpreadsheet />, onClick: handleExportHistoryCsv },
                    { label: 'PDF', icon: <FileText />, onClick: handleExportHistoryPdf },
                  ]}
                />
              )}
            </header>
            {history.length === 0 ? (
              <EmptyState icon={<History />} title="Nessun evento" description="Assegnazioni e manutenzioni compariranno qui." className="py-10" />
            ) : (
              <ol className="p-5 space-y-0">
                {[...history].reverse().map((entry, idx, arr) => {
                  const [label, cls, dot] = ACTION[entry.action] || [entry.action, 'badge-neutral', 'bg-slate-400'];
                  return (
                    <li key={idx} className="relative pl-7 pb-5 last:pb-0">
                      {idx < arr.length - 1 && <span className="absolute left-[7px] top-4 bottom-0 w-px bg-slate-200" />}
                      <span className={`absolute left-[3px] top-1.5 w-2.5 h-2.5 rounded-full ring-4 ring-white ${dot}`} />
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`badge ${cls}`}>{label}</span>
                        <span className="text-xs text-slate-500 tabular-nums">{fmtDate(entry.date)}</span>
                      </div>
                      <p className="text-[13px] text-slate-700 mt-1">
                        {entry.action === 'assigned' && entry.userEmail ? <>A <span className="font-medium text-slate-900">{entry.userEmail}</span></>
                          : entry.action === 'returned' && entry.userEmail ? <>Da <span className="font-medium text-slate-900">{entry.userEmail}</span></>
                          : entry.userEmail ? <>Operatore: <span className="font-medium text-slate-900">{entry.userEmail}</span></> : 'Operazione di sistema'}
                      </p>
                      {entry.notes && <p className="text-[13px] text-slate-600 mt-1.5 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">{entry.notes}</p>}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        </div>
      </PageBody>

      {showAssignModal && (
        <DeviceAssignmentModal device={device} onClose={() => setShowAssignModal(false)} />
      )}

      {showLabelModal && (
        <DeviceLabelModal 
          devices={[device]} 
          isOpen={true} 
          onClose={() => setShowLabelModal(false)} 
        />
      )}
    </div>
  );
}

