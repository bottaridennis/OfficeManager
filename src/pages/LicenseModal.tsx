import React, { useState, useEffect } from 'react';
import { collection, doc, setDoc, updateDoc, serverTimestamp, query, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { License, Device, User } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { X, Save, Edit2 } from 'lucide-react';
import { logOperation } from '../lib/logger';

interface LicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  licenseToEdit?: License;
}

export default function LicenseModal({ isOpen, onClose, licenseToEdit }: LicenseModalProps) {
  const { currentUser } = useAuth();
  
  const [formData, setFormData] = useState<Partial<License>>({
    softwareName: '',
    licenseKey: '',
    status: 'available',
    issueDate: '',
    expiryDate: '',
    notes: '',
    assignedToDeviceId: '',
    assignedToUserId: ''
  });

  const [loading, setLoading] = useState(false);
  const [devices, setDevices] = useState<{id: string, name: string}[]>([]);
  const [users, setUsers] = useState<{id: string, email: string}[]>([]);

  useEffect(() => {
    if (licenseToEdit) {
      setFormData({
        softwareName: licenseToEdit.softwareName,
        licenseKey: licenseToEdit.licenseKey,
        status: licenseToEdit.status,
        issueDate: licenseToEdit.issueDate || '',
        expiryDate: licenseToEdit.expiryDate || '',
        notes: licenseToEdit.notes || '',
        assignedToDeviceId: licenseToEdit.assignedToDeviceId || '',
        assignedToUserId: licenseToEdit.assignedToUserId || ''
      });
    } else {
      setFormData({
        softwareName: '',
        licenseKey: '',
        status: 'available',
        issueDate: '',
        expiryDate: '',
        notes: '',
        assignedToDeviceId: '',
        assignedToUserId: ''
      });
    }

    const fetchOptions = async () => {
      try {
        const [devicesSnap, usersSnap] = await Promise.all([
          getDocs(query(collection(db, 'devices'))),
          getDocs(query(collection(db, 'users')))
        ]);
        
        setDevices(devicesSnap.docs.map(d => ({ 
          id: d.id, 
          name: `${d.data().category} - ${d.data().serialNumber}` 
        })));
        
        setUsers(usersSnap.docs.map(u => ({ 
          id: u.id, 
          email: u.data().email 
        })));
      } catch (e) {
        console.error("Error fetching options", e);
      }
    };
    
    if (isOpen) {
        fetchOptions();
    }
  }, [licenseToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setLoading(true);

    try {
      const selectedDevice = devices.find(d => d.id === formData.assignedToDeviceId);
      const selectedUser = users.find(u => u.id === formData.assignedToUserId);

      const assignedToDeviceName = selectedDevice ? selectedDevice.name : null;
      const assignedToUserEmail = selectedUser ? selectedUser.email : null;
      const assignedToDeviceId = formData.assignedToDeviceId || null;
      const assignedToUserId = formData.assignedToUserId || null;

      // Auto update status based on assignment
      let finalStatus = formData.status || 'available';
      if (finalStatus === 'available' && (assignedToDeviceId || assignedToUserId)) {
        finalStatus = 'active';
      }

      const dataToSave = {
        softwareName: formData.softwareName,
        licenseKey: formData.licenseKey,
        status: finalStatus,
        issueDate: formData.issueDate || null,
        expiryDate: formData.expiryDate || null,
        notes: formData.notes || null,
        assignedToDeviceId,
        assignedToDeviceName,
        assignedToUserId,
        assignedToUserEmail,
        updatedAt: serverTimestamp()
      };

      if (licenseToEdit) {
        await updateDoc(doc(db, 'licenses', licenseToEdit.id), dataToSave);
        await logOperation('update', 'system', `Modificata licenza: ${formData.softwareName}`, currentUser.uid, currentUser.email || '');
      } else {
        const newLicenseRef = doc(collection(db, 'licenses'));
        await setDoc(newLicenseRef, {
          ...dataToSave,
          createdAt: serverTimestamp()
        });
        await logOperation('create', 'system', `Creata nuova licenza: ${formData.softwareName}`, currentUser.uid, currentUser.email || '');
      }

      onClose();
    } catch (error) {
      handleFirestoreError(error, licenseToEdit ? OperationType.UPDATE : OperationType.CREATE, 'licenses');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px] animate-in" onClick={onClose} />
      
      <div className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[92dvh]">
        <header className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4 shrink-0">
          <h3 className="text-base font-semibold text-slate-900 tracking-tight flex items-center gap-2">
            {licenseToEdit ? <Edit2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {licenseToEdit ? 'Modifica Licenza' : 'Nuova Licenza'}
          </h3>
          <button onClick={onClose} className="icon-btn">
            <X />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex flex-col grow min-h-0">
          <div className="p-6 overflow-y-auto space-y-6 flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="field-label">
                  Nome Software *
                </label>
                <input
                  type="text"
                  required
                  value={formData.softwareName}
                  onChange={(e) => setFormData({ ...formData, softwareName: e.target.value })}
                  className="input w-full text-sm"
                  placeholder="Es. Office 365, Adobe CC"
                />
              </div>
              
              <div>
                <label className="field-label">
                  Stato Licenza *
                </label>
                <select
                  required
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as License['status'] })}
                  className="input w-full text-sm"
                >
                  <option value="available">Disponibile</option>
                  <option value="active">Attiva/Assegnata</option>
                  <option value="expired">Scaduta</option>
                  <option value="revoked">Revocata</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="field-label">
                  Chiave / License Key *
                </label>
                <input
                  type="text"
                  required
                  value={formData.licenseKey}
                  onChange={(e) => setFormData({ ...formData, licenseKey: e.target.value })}
                  className="input w-full text-sm font-mono"
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                />
              </div>

              <div>
                <label className="field-label">
                  Data Rilascio/Acquisto
                </label>
                <input
                  type="date"
                  value={formData.issueDate}
                  onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })}
                  className="input w-full text-sm"
                />
              </div>

              <div>
                <label className="field-label">
                  Data Scadenza
                </label>
                <input
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                  className="input w-full text-sm"
                />
              </div>

              <div className="border-t border-slate-200 sm:col-span-2 pt-6 mt-2">
                <h4 className="text-sm font-semibold text-slate-900 mb-4">Assegnazione (Opzionale)</h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="field-label">
                      Dispositivo Associato
                    </label>
                    <select
                      value={formData.assignedToDeviceId || ''}
                      onChange={(e) => setFormData({ ...formData, assignedToDeviceId: e.target.value })}
                      className="input w-full text-sm"
                    >
                      <option value="">-- Nessun Dispositivo --</option>
                      {devices.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="field-label">
                      Utente Associato
                    </label>
                    <select
                      value={formData.assignedToUserId || ''}
                      onChange={(e) => setFormData({ ...formData, assignedToUserId: e.target.value })}
                      className="input w-full text-sm"
                    >
                      <option value="">-- Nessun Utente --</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.email}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="sm:col-span-2">
                <label className="field-label">
                  Note Aggiuntive
                </label>
                <textarea
                  rows={3}
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="input w-full text-sm"
                  placeholder="URL portale licenze, credenziali aggiuntive, etc."
                />
              </div>
            </div>
          </div>

          <footer className="px-5 sm:px-6 py-4 bg-slate-50/60 border-t border-slate-100 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? 'Salvataggio...' : (licenseToEdit ? 'Salva Modifiche' : 'Crea Licenza')}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
