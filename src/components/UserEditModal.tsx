import React, { useState } from 'react';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { User } from '../types';
import { X, Save, Trash2, Camera } from 'lucide-react';
import { deleteDoc } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { logOperation } from '../lib/logger';
import ConfirmDialog from './ConfirmDialog';

interface Props {
  user: User;
  onClose: () => void;
}

export default function UserEditModal({ user, onClose }: Props) {
  const { currentUser } = useAuth();
  const [firstName, setFirstName] = useState(user.firstName || '');
  const [lastName, setLastName] = useState(user.lastName || '');
  const [photoUrl, setPhotoUrl] = useState(user.photoUrl || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    requireString?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  } | null>(null);

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;
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
    setLoading(true);
    setError('');
    try {
      const trimmedFirst = firstName.trim();
      const trimmedLast = lastName.trim();

      await updateDoc(doc(db, 'users', user.id), {
        firstName: trimmedFirst,
        lastName: trimmedLast,
        photoUrl
      });

      await logOperation('update', 'users', `Aggiornati nome/cognome di ${user.email}`, currentUser!.uid, currentUser!.email || '', user.id);

      onClose();
    } catch (err: any) {
      setError(err.message);
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.id}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Elimina Utente',
      message: `Vuoi eliminare l'utente ${user.email}? L'operazione è irreversibile.`,
      requireString: 'ELIMINA',
      isDestructive: true,
      onConfirm: async () => {
        setLoading(true);
        try {
          await deleteDoc(doc(db, 'users', user.id));
          await logOperation('delete', 'users', `Eliminato utente ${user.email}`, currentUser!.uid, currentUser!.email || '', user.id);
          setConfirmDialog(null);
          onClose();
        } catch (err: any) {
          setError(err.message);
          handleFirestoreError(err, OperationType.DELETE, `users/${user.id}`);
          setConfirmDialog(null);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px] animate-in" onClick={onClose} />
        
        <div className="relative bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden animate-in">
          <header className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
            <h3 className="text-base font-semibold text-slate-900 tracking-tight">Modifica Utente</h3>
            <button onClick={onClose} className="icon-btn">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </header>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && <div className="text-xs text-red-600 bg-red-50 p-2 rounded">{error}</div>}
            
            <div className="mb-4">
              <div className="text-xs font-bold text-slate-800">{user.email}</div>
            </div>

            <div className="flex flex-col items-center mb-6">
              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handleCapture} className="hidden" />
              <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                {photoUrl ? (
                  <img src={photoUrl} alt="Avatar" className="w-20 h-20 rounded-full object-cover border-2 border-slate-200" />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 group-hover:bg-slate-200 transition-colors">
                    <Camera className="w-6 h-6 mb-1" />
                    <span className="text-[10px] font-medium text-center leading-tight">Carica<br/>Foto</span>
                  </div>
                )}
                {photoUrl && (
                  <button 
                    type="button" 
                    onClick={(e) => { e.stopPropagation(); setPhotoUrl(''); }}
                    className="absolute top-0 right-0 bg-white border border-slate-200 text-rose-500 rounded-full p-1 shadow-sm hover:bg-rose-50"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5 ml-1">Nome</label>
              <input
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                className="input w-full h-9"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5 ml-1">Cognome</label>
              <input
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                className="input w-full h-9"
              />
            </div>

            <footer className="pt-4 flex flex-row-reverse justify-between gap-3">
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
              >
                <Save className="w-4 h-4" />
                Salva
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="btn btn-danger-soft transition-all flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Elimina
              </button>
            </footer>
          </form>
        </div>
      </div>

      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          requireString={confirmDialog.requireString}
          isDestructive={confirmDialog.isDestructive}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </>
  );
}
