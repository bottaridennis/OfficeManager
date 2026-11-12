import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { User, Device } from '../types';
import { X, UserPlus, CheckCircle2, UserMinus, Search } from 'lucide-react';
import { logOperation } from '../lib/logger';
import { useAuth } from '../contexts/AuthContext';

export default function DeviceAssignmentModal({ device, onClose }: { device: Device, onClose: () => void }) {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      setUsers(usersData.filter(u => u.status === 'approved'));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return unsubscribe;
  }, []);

  const handleAssign = async (userId: string | null) => {
    setIsSubmitting(true);
    try {
      const deviceRef = doc(db, 'devices', device.id);
      
      const newHistoryEntry = {
        date: new Date(),
        action: userId ? 'assigned' : 'returned',
        userId: userId || null,
        userEmail: userId ? users.find(u => u.id === userId)?.email : null,
      };

      const updatedHistory = [...(device.history || []), newHistoryEntry];

      await setDoc(deviceRef, {
        assignedToUserId: userId,
        assignedToUserEmail: userId ? users.find(u => u.id === userId)?.email : null,
        history: updatedHistory,
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      const newEmail = userId ? users.find(u => u.id === userId)?.email : null;
      await logOperation(
        userId ? 'assign' : 'withdraw', 
        'devices', 
        userId ? `Assegnato a ${newEmail}` : 'Ritirato in magazzino', 
        currentUser!.uid, 
        currentUser!.email || '', 
        device.id
      );

      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `devices/${device.id}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.firstName?.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (u.lastName?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const currentAssignedUser = users.find(u => u.id === device.assignedToUserId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px] animate-in" onClick={onClose} />
      
      <div className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden animate-in">
        <header className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900 tracking-tight">Assegnazione Rapida</h3>
            <p className="text-xs text-slate-500 font-mono">{device.category} — {device.serialNumber}</p>
          </div>
          <button onClick={onClose} className="icon-btn">
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="p-5">
          {currentAssignedUser ? (
            <div className="mb-4 p-3 bg-blue-50/70 border border-blue-100 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {currentAssignedUser.firstName?.[0] || 'U'}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-blue-800">Attualmente Assegnato A:</p>
                  <p className="text-xs font-semibold text-slate-900 truncate">
                    {currentAssignedUser.firstName} {currentAssignedUser.lastName}
                  </p>
                  <p className="text-[11px] text-blue-700 truncate">{currentAssignedUser.email}</p>
                </div>
              </div>
              <button
                onClick={() => handleAssign(null)}
                disabled={isSubmitting}
                className="h-8 px-2.5 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                title="Rimuovi assegnazione e riponi in magazzino"
              >
                <UserMinus className="w-3.5 h-3.5" />
                <span>Ritira</span>
              </button>
            </div>
          ) : (
            <div className="mb-4 p-3.5 border border-dashed border-slate-200 rounded-xl text-center bg-slate-50/50">
              <p className="text-xs text-slate-500 font-medium italic">Dispositivo attualmente non assegnato (disponibile in magazzino)</p>
            </div>
          )}

          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cerca dipendente per nome o email..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="input w-full h-10 pl-9 pr-4 font-medium"
            />
          </div>

          <div className="max-h-[260px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
            {loading ? (
              <div className="text-center py-8 text-xs text-slate-400 font-medium">Caricamento utenti approvati...</div>
            ) : filteredUsers.length > 0 ? (
              filteredUsers.map(user => {
                const isSelected = device.assignedToUserId === user.id;
                return (
                  <button
                    key={user.id}
                    onClick={() => handleAssign(user.id)}
                    disabled={isSubmitting || isSelected}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl border transition-all text-left cursor-pointer ${
                      isSelected 
                      ? 'border-blue-500 bg-blue-50/60 cursor-default' 
                      : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0 ${
                        isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {user.firstName?.[0] || user.email[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-800 truncate">
                          {user.firstName} {user.lastName}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {user.email}
                        </div>
                      </div>
                    </div>
                    {isSelected ? (
                      <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    ) : (
                      <UserPlus className="w-4 h-4 text-slate-400 hover:text-blue-600 shrink-0" />
                    )}
                  </button>
                );
              })
            ) : (
              <div className="text-center py-8 text-xs text-slate-400 font-medium italic">Nessun dipendente trovato.</div>
            )}
          </div>
        </div>

        <footer className="p-3 bg-slate-50/80 border-t border-slate-200/80 flex items-center justify-end px-5">
          <button
            onClick={onClose}
            className="btn btn-secondary"
          >
            Chiudi
          </button>
        </footer>
      </div>
    </div>
  );
}
