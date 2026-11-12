import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, doc, getDoc, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Device } from '../types';
import { X, Search, Wrench, UserCheck, UserMinus, Trash2, QrCode } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { logOperation } from '../lib/logger';
import DeviceAssignmentModal from './DeviceAssignmentModal';
import ConfirmDialog from './ConfirmDialog';

export default function ScannerActionModal() {
  const { userData, currentUser } = useAuth();
  const isAdminOrTech = userData?.role === 'admin' || userData?.role === 'tecnico';
  const navigate = useNavigate();

  const [barcode, setBarcode] = useState('');
  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    const handleScan = async (e: Event) => {
      const customEvent = e as CustomEvent;
      const rawCode = (customEvent.detail || '').trim();
      if (!rawCode) return;

      setBarcode(rawCode);
      setDevice(null);
      setError('');
      setLoading(true);
      setShowAssignModal(false);

      try {
        let foundDevice: Device | null = null;

        // 1. Check if scanned text is a direct device URL like https://domain/devices/ID or /devices/ID
        const urlMatch = rawCode.match(/\/devices\/([a-zA-Z0-9_\-]+)/);
        if (urlMatch && urlMatch[1]) {
          const docId = urlMatch[1];
          try {
            const docSnap = await getDoc(doc(db, 'devices', docId));
            if (docSnap.exists()) {
              foundDevice = { id: docSnap.id, ...docSnap.data() } as Device;
            }
          } catch (e) {
            // continue fallback
          }
        }

        // 2. Check if rawCode is directly a valid docId
        if (!foundDevice && rawCode.length > 10 && !rawCode.includes(' ')) {
          try {
            const docSnap = await getDoc(doc(db, 'devices', rawCode));
            if (docSnap.exists()) {
              foundDevice = { id: docSnap.id, ...docSnap.data() } as Device;
            }
          } catch (e) {
            // continue fallback
          }
        }

        // 3. Search by Serial Number (standard Barcode or SN input)
        if (!foundDevice) {
          const q = query(collection(db, 'devices'), where('serialNumber', '==', rawCode));
          const qs = await getDocs(q);
          if (!qs.empty) {
            foundDevice = { id: qs.docs[0].id, ...qs.docs[0].data() } as Device;
          }
        }

        if (foundDevice) {
          setDevice(foundDevice);
        } else {
          setError('Nessun dispositivo trovato con questo codice o QR code.');
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'devices');
      } finally {
        setLoading(false);
      }
    };

    window.addEventListener('barcode-scanned', handleScan);
    return () => window.removeEventListener('barcode-scanned', handleScan);
  }, []);

  if (!barcode) return null;

  const closeModal = () => {
    setBarcode('');
    setDevice(null);
    setError('');
    setShowAssignModal(false);
  };

  const handleDelete = () => {
    if (!isAdminOrTech) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Elimina Dispositivo',
      message: 'Sei sicuro di voler eliminare questo dispositivo?',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'devices', device!.id));
          await logOperation('delete', 'devices', `Eliminato dispositivo (scanner): ${device!.category} (${device!.serialNumber})`, currentUser!.uid, currentUser!.email || '');
          setConfirmDialog(null);
          closeModal();
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `devices/${device!.id}`);
          setConfirmDialog(null);
        }
      }
    });
  };

  const handleMaintenance = async () => {
    if (!isAdminOrTech) return;
    try {
      const newStatus = !device!.isUnderMaintenance;
      const historyEntry = {
        date: new Date(),
        action: newStatus ? 'maintenance_start' : 'maintenance_end',
        userId: currentUser!.uid,
        userEmail: currentUser!.email,
        notes: newStatus ? 'Inviato in manutenzione' : 'Tornato dalla manutenzione'
      };
      
      await updateDoc(doc(db, 'devices', device!.id), {
        isUnderMaintenance: newStatus,
        history: [...(device!.history || []), historyEntry],
        updatedAt: serverTimestamp()
      });
      
      await logOperation('maintenance', 'devices', `Manutenzione ${newStatus ? 'iniziata' : 'terminata'} per: ${device!.category} (${device!.serialNumber})`, currentUser!.uid, currentUser!.email || '', device!.id);
      
      closeModal();
      navigate(`/devices/${device!.id}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `devices/${device!.id}`);
    }
  };
  
  const handleAssign = () => {
    navigate(`/devices/${device!.id}`);
    closeModal();
  };

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px] animate-in" onClick={closeModal} />
        <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden animate-in">
          <header className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 min-w-0 pr-2">
              <QrCode className="w-4 h-4 text-blue-600 shrink-0" />
              <h3 className="text-base font-semibold tracking-tight text-slate-900 truncate">
                Scansione: <span className="text-blue-600 font-mono">{barcode.length > 30 ? barcode.slice(0, 28) + '...' : barcode}</span>
              </h3>
            </div>
            <button onClick={closeModal} className="icon-btn">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </header>

          <div className="p-6">
            {loading && <p className="text-sm text-slate-500 text-center py-4">Ricerca in corso...</p>}
            
            {error && (
              <div className="text-center py-4 space-y-4">
                <p className="text-sm text-red-500">{error}</p>
                <button 
                  onClick={closeModal}
                  className="btn btn-secondary"
                >
                  Chiudi
                </button>
              </div>
            )}

            {device && (
              <div className="space-y-6">
                <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <Search className="w-8 h-8 text-blue-500 shrink-0" />
                  <div>
                    <h4 className="font-bold text-slate-800 text-lg leading-tight">{device.category}</h4>
                    <p className="text-sm text-slate-500 mb-2">SN: {device.serialNumber}</p>
                    
                    {device.isUnderMaintenance ? (
                      <span className="px-2 py-1 bg-red-100 text-red-700 text-[10px] font-bold uppercase tracking-wider rounded border border-red-200 mr-2">
                        In Manutenzione
                      </span>
                    ) : device.assignedToUserId ? (
                      <span className="px-2 py-1 bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider rounded border border-amber-200 mr-2">
                        Assegnato: {device.assignedToUserEmail}
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold uppercase tracking-wider rounded border border-green-200 mr-2">
                        Disponibile
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleAssign}
                    className="flex flex-col items-center justify-center p-4 bg-white border border-slate-200 rounded-lg hover:bg-blue-50 hover:border-blue-200 transition-colors gap-2"
                  >
                    <Search className="w-5 h-5 text-blue-500" />
                    <span className="text-xs font-medium text-center text-slate-700">Dettagli</span>
                  </button>
                  
                  {isAdminOrTech && (
                    <>
                      <button
                        onClick={() => setShowAssignModal(true)}
                        className="flex flex-col items-center justify-center p-4 bg-white border border-slate-200 rounded-lg hover:bg-emerald-50 hover:border-emerald-200 transition-colors gap-2"
                      >
                        {device.assignedToUserId ? <UserMinus className="w-5 h-5 text-emerald-600" /> : <UserCheck className="w-5 h-5 text-emerald-600" />}
                        <span className="text-xs font-medium text-center text-slate-700">
                          {device.assignedToUserId ? 'Ritira' : 'Assegna'}
                        </span>
                      </button>

                      <button
                        onClick={handleMaintenance}
                        className="flex flex-col items-center justify-center p-4 bg-white border border-slate-200 rounded-lg hover:bg-orange-50 hover:border-orange-200 transition-colors gap-2"
                      >
                        <Wrench className="w-5 h-5 text-orange-500" />
                        <span className="text-xs font-medium text-center text-slate-700">
                          {device.isUnderMaintenance ? 'Fine Manutenzione' : 'Manutenzione'}
                        </span>
                      </button>

                      {userData?.role === 'admin' && (
                        <button
                          onClick={handleDelete}
                          className="flex flex-col items-center justify-center p-4 bg-white border border-slate-200 rounded-lg hover:bg-red-50 hover:border-red-200 transition-colors gap-2"
                        >
                          <Trash2 className="w-5 h-5 text-red-500" />
                          <span className="text-xs font-medium text-center text-slate-700">Elimina</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {showAssignModal && device && (
        <DeviceAssignmentModal device={device} onClose={() => { setShowAssignModal(false); closeModal(); }} />
      )}

      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          isDestructive={confirmDialog.isDestructive}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </>
  );
}

