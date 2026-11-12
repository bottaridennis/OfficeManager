import React, { useState } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, firebaseConfig } from '../lib/firebase';
import { X, UserPlus, KeyRound, Mail, User as UserIcon, Camera } from 'lucide-react';
import { Role, UserStatus } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { logOperation } from '../lib/logger';

// Initialize a secondary app to create users without affecting the main login session
const secondaryApp = initializeApp(firebaseConfig, 'AdminUserCreation');
const secondaryAuth = getAuth(secondaryApp);

export default function UserCreationModal({ onClose }: { onClose: () => void }) {
  const { currentUser } = useAuth();
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<Role>('utente');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

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
    setError('');
    
    if (password !== confirmPassword) {
      setError('Le password non coincidono.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create Auth user in secondary instance
      const { user } = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      
      // 2. Create Firestore document in main DB instance
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, {
        email,
        firstName,
        lastName,
        photoUrl,
        role,
        status: 'approved' as UserStatus,
        mustChangePassword: true,
        createdAt: serverTimestamp()
      });

      // 3. Add to lookup table for username-based login
      const username = email.split('@')[0].toLowerCase();
      await setDoc(doc(db, 'public_lookup', username), { email });

      // 4. Sign out the secondary instance immediately
      await signOut(secondaryAuth);
      
      await logOperation('create', 'users', `Creato nuovo utente: ${email}`, currentUser!.uid, currentUser!.email || '', user.uid);
      
      setSuccess(true);
      setTimeout(onClose, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px] animate-in" />
        <div className="relative bg-white w-full max-w-sm rounded-2xl shadow-2xl p-8 text-center animate-in">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserPlus className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 tracking-tight">Utente Creato!</h3>
          <p className="text-sm text-slate-500 mt-2">L'account per {firstName} è stato attivato con successo.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px] animate-in" onClick={onClose} />
      
      <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden animate-in">
        <header className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
          <h3 className="text-base font-semibold text-slate-900 tracking-tight">Crea Nuovo Utente</h3>
          <button onClick={onClose} className="icon-btn">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </header>

        {error && <div className="mx-6 mt-4 text-[13px] text-rose-700 bg-rose-50 border border-rose-200/80 px-3 py-2 rounded-lg text-center">{error}</div>}

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="flex flex-col items-center mb-2">
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5 ml-1">Nome</label>
              <div className="relative">
                <UserIcon className="w-3.5 h-3.5 text-slate-300 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  className="input w-full h-9 pl-9 pr-3"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5 ml-1">Cognome</label>
              <div className="relative">
                <UserIcon className="w-3.5 h-3.5 text-slate-300 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  className="input w-full h-9 pl-9 pr-3"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5 ml-1">Email</label>
            <div className="relative">
              <Mail className="w-3.5 h-3.5 text-slate-300 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input w-full h-9 pl-9 pr-3"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5 ml-1">Password Temporanea</label>
              <div className="relative">
                <KeyRound className="w-3.5 h-3.5 text-slate-300 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input w-full h-9 pl-9 pr-3"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5 ml-1">Conferma Password</label>
              <div className="relative">
                <KeyRound className="w-3.5 h-3.5 text-slate-300 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="input w-full h-9 pl-9 pr-3"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-3 ml-1">Ruolo Iniziale</label>
            <div className="flex bg-slate-100 p-1 rounded-lg">
              {(['admin', 'tecnico', 'utente'] as Role[]).map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`flex-1 h-7 text-xs font-medium capitalize rounded-md transition-all ${role === r ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <footer className="pt-4 flex flex-row-reverse gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary"
            >
              {isSubmitting ? 'Creazione...' : 'Crea Utente'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
            >
              Annulla
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
