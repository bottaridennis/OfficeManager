import React, { useState, useEffect } from 'react';
import { collection, doc, setDoc, updateDoc, serverTimestamp, query, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Loan, Device, Consumable } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { X, Save, FileSignature, Calendar, User, Package, Laptop } from 'lucide-react';
import { logOperation } from '../lib/logger';

interface LoanModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedDeviceId?: string;
  preselectedDeviceName?: string;
  preselectedType?: 'device' | 'consumable';
  preselectedUserId?: string;
  onSuccess?: () => void;
}

export default function LoanModal({ 
  isOpen, 
  onClose, 
  preselectedDeviceId, 
  preselectedDeviceName, 
  preselectedType = 'device', 
  preselectedUserId, 
  onSuccess 
}: LoanModalProps) {
  const { currentUser } = useAuth();
  
  const [formData, setFormData] = useState<Partial<Loan>>({
    type: 'checkout',
    targetType: preselectedType,
    targetDocId: preselectedDeviceId || '',
    quantity: 1,
    userId: preselectedUserId || '',
    checkoutDate: new Date().toISOString().split('T')[0],
    expectedReturnDate: '',
    notes: ''
  });

  const [loading, setLoading] = useState(false);
  const [devices, setDevices] = useState<{id: string, name: string}[]>([]);
  const [consumables, setConsumables] = useState<{id: string, name: string, stock: number}[]>([]);
  const [users, setUsers] = useState<{id: string, email: string}[]>([]);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [devicesSnap, usersSnap, consumablesSnap] = await Promise.all([
          getDocs(query(collection(db, 'devices'))),
          getDocs(query(collection(db, 'users'))),
          getDocs(query(collection(db, 'consumables')))
        ]);
        
        setDevices(devicesSnap.docs
          .map(d => ({ 
            id: d.id, 
            name: `${d.data().category} - ${d.data().serialNumber}`,
            assignedToUserId: d.data().assignedToUserId 
          }))
          .filter(d => !d.assignedToUserId || d.id === preselectedDeviceId)
        );

        setConsumables(consumablesSnap.docs.map(c => ({
          id: c.id,
          name: c.data().name,
          stock: (c.data().totalQuantity || 0) - (c.data().consumedQuantity || 0),
          consumedQuantity: c.data().consumedQuantity || 0
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
  }, [isOpen, preselectedDeviceId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setLoading(true);

    try {
      const isDevice = formData.targetType === 'device';
      const targetList = isDevice ? devices : consumables;
      const selectedItem = targetList.find(i => i.id === formData.targetDocId);
      const selectedUser = users.find(u => u.id === formData.userId);

      if (!selectedItem || !selectedUser) {
        throw new Error("Dispositivo/Consumabile o Utente non valido");
      }

      if (!isDevice) {
        const cons = selectedItem as {id: string, name: string, stock: number, consumedQuantity: number};
        if (cons.stock < (formData.quantity || 1)) {
          throw new Error("Quantità non sufficiente in magazzino.");
        }
      }

      const newLoanRef = doc(collection(db, 'loans'));
      
      await setDoc(newLoanRef, {
        type: formData.type,
        targetType: formData.targetType,
        targetDocId: formData.targetDocId,
        targetDocName: selectedItem.name,
        quantity: isDevice ? 1 : (formData.quantity || 1),
        userId: formData.userId,
        userEmail: selectedUser.email,
        checkoutDate: formData.checkoutDate,
        expectedReturnDate: formData.type === 'temporary_loan' ? (formData.expectedReturnDate || null) : null,
        status: 'active',
        notes: formData.notes || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      if (isDevice) {
        await updateDoc(doc(db, 'devices', formData.targetDocId!), {
          assignedToUserId: formData.userId,
          assignedToUserEmail: selectedUser.email,
          updatedAt: serverTimestamp()
        });
      } else {
        const cons = selectedItem as {id: string, name: string, stock: number, consumedQuantity: number};
        await updateDoc(doc(db, 'consumables', formData.targetDocId!), {
          consumedQuantity: cons.consumedQuantity + (formData.quantity || 1),
          updatedAt: serverTimestamp()
        });
      }

      await logOperation('create', isDevice ? 'devices' : 'consumables', `Creato prestito per ${selectedItem.name} a ${selectedUser.email}`, currentUser.uid, currentUser.email || '');

      if (onSuccess) onSuccess();
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'loans');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px] animate-in" onClick={onClose} />
      
      <div className="relative bg-white w-full max-w-lg max-h-[92dvh] rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col animate-in">
        <header className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4 shrink-0">
          <div>
            <h3 className="text-base font-semibold text-slate-900 tracking-tight">Nuovo Modulo di Assegnazione</h3>
            <p className="text-xs text-slate-500">Assegna un dispositivo o materiale di consumo ad un dipendente</p>
          </div>
          <button onClick={onClose} className="icon-btn">
            <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="flex flex-col grow min-h-0">
          <div className="p-6 overflow-y-auto space-y-4 flex-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label">
                  Oggetto Assegnazione
                </label>
                <select
                  required
                  disabled={!!preselectedDeviceId}
                  value={formData.targetType}
                  onChange={(e) => setFormData({ ...formData, targetType: e.target.value as 'device' | 'consumable', targetDocId: '' })}
                  className="input w-full h-10 font-medium"
                >
                  <option value="device">Dispositivo (HW)</option>
                  <option value="consumable">Materiale Consumabile</option>
                </select>
              </div>

              <div>
                <label className="field-label">
                  Modalità Consegna
                </label>
                <select
                  required
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as Loan['type'] })}
                  className="input w-full h-10 font-medium"
                >
                  <option value="checkout">Assegnazione Definitiva</option>
                  <option value="temporary_loan">Prestito Temporaneo</option>
                </select>
              </div>
            </div>

            <div>
              <label className="field-label">
                Dipendente Assegnatario *
              </label>
              <select
                required
                value={formData.userId}
                onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                className="input w-full h-10 font-medium"
              >
                <option value="">-- Seleziona Utente --</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.email}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label">
                {formData.targetType === 'device' ? 'Dispositivo Selezionato *' : 'Articolo Consumabile *'}
              </label>
              <select
                required
                disabled={!!preselectedDeviceId}
                value={formData.targetDocId}
                onChange={(e) => setFormData({ ...formData, targetDocId: e.target.value })}
                className="input w-full h-10 font-medium"
              >
                <option value="">-- Seleziona Elemento --</option>
                {formData.targetType === 'device' ? (
                  devices.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))
                ) : (
                  consumables.map(c => (
                    <option key={c.id} value={c.id}>{c.name} (Disp: {c.stock})</option>
                  ))
                )}
              </select>
              {preselectedDeviceId && <p className="text-[11px] text-slate-400 mt-1">Pre-selezionato dal responsabile di magazzino.</p>}
            </div>

            {formData.targetType === 'consumable' && (
              <div>
                <label className="field-label">
                  Quantità da Assegnare *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={consumables.find(c => c.id === formData.targetDocId)?.stock}
                  value={formData.quantity || 1}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                  className="input w-full h-10 font-mono font-bold"
                />
              </div>
            )}

            <div className={`grid ${formData.type === 'temporary_loan' ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
              <div>
                <label className="field-label">
                  Data Consegna *
                </label>
                <input
                  type="date"
                  required
                  value={formData.checkoutDate}
                  onChange={(e) => setFormData({ ...formData, checkoutDate: e.target.value })}
                  className="input w-full h-10 font-mono"
                />
              </div>

              {formData.type === 'temporary_loan' && (
                <div>
                  <label className="field-label">
                    Data Prevista Restituzione
                  </label>
                  <input
                    type="date"
                    value={formData.expectedReturnDate}
                    onChange={(e) => setFormData({ ...formData, expectedReturnDate: e.target.value })}
                    className="input w-full h-10 font-mono"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="field-label">
                Note o Note di Consegna
              </label>
              <textarea
                rows={3}
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="input w-full resize-none"
                placeholder="Riferimento modulo cartaceo, accordo, condizioni del dispositivo..."
              />
            </div>
          </div>

          <footer className="p-4 bg-slate-50/80 border-t border-slate-200/80 flex justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary h-10"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary h-10"
            >
              <Save className="w-4 h-4" />
              <span>{loading ? 'Salvataggio...' : 'Conferma Assegnazione'}</span>
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
