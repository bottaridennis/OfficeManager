import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { ShieldCheck, ArrowRight, Eye, EyeOff, ScanLine, Ticket, Boxes, AlertCircle } from 'lucide-react';
import { Spinner } from '../components/ui';

function friendlyError(err: any): string {
  const msg: string = err?.message || '';
  const code: string = err?.code || msg;
  if (code.includes('invalid-credential') || code.includes('wrong-password')) return 'Credenziali non valide. Controlla email e password.';
  if (code.includes('user-not-found')) return 'Nessun account trovato con queste credenziali.';
  if (code.includes('email-already-in-use')) return 'Esiste già un account con questa email.';
  if (code.includes('weak-password')) return 'La password deve contenere almeno 6 caratteri.';
  if (code.includes('too-many-requests')) return 'Troppi tentativi. Riprova tra qualche minuto.';
  if (code.includes('popup-closed')) return 'Accesso con Google annullato.';
  if (code.includes('network')) return 'Connessione assente. Verifica la rete e riprova.';
  if (code.includes('unauthorized-domain')) return `Questo dominio (${window.location.hostname}) non è autorizzato in Firebase. Un amministratore deve aggiungerlo in Firebase Console → Authentication → Settings → Authorized domains.`;
  if (code.includes('operation-not-allowed')) return 'Questo metodo di accesso non è abilitato in Firebase.';
  return msg || "Errore durante l'autenticazione.";
}

function PasswordInput({
  value,
  onChange,
  placeholder = '••••••••',
  autoComplete,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete: string;
  id: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? 'text' : 'password'}
        required
        minLength={6}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input h-10 pr-10"
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-1 top-1/2 -translate-y-1/2 icon-btn w-8 h-8"
        aria-label={show ? 'Nascondi password' : 'Mostra password'}
      >
        {show ? <EyeOff /> : <Eye />}
      </button>
    </div>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="flex items-start gap-2.5 bg-rose-50 border border-rose-200/80 text-rose-700 px-3 py-2.5 rounded-lg text-[13px] animate-in">
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-[10px] bg-blue-600 flex items-center justify-center shadow-sm ring-1 ring-inset ring-white/15">
        <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
          <path d="M4 8l8-4.5L20 8v8l-8 4.5L4 16z" />
          <path d="M4 8l8 4.5L20 8M12 12.5V20.5" />
        </svg>
      </div>
      <div className="leading-tight">
        <div className="text-[15px] font-semibold tracking-tight text-slate-900">Office Manager</div>
        <div className="text-xs text-slate-500">Magazzino & IT</div>
      </div>
    </div>
  );
}

export default function Login() {
  const { loginProvider, loginEmail, loginWithName, registerEmail, currentUser, userData, updateUserPassword } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [useNameLogin, setUseNameLogin] = useState(false);

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changingPass, setChangingPass] = useState(false);

  if (currentUser && userData) {
    if (userData.mustChangePassword) {
      const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (newPassword !== confirmNewPassword) {
          setError('Le password non coincidono.');
          return;
        }
        try {
          setChangingPass(true);
          await updateUserPassword(newPassword);
        } catch (err: any) {
          setError(friendlyError(err));
        } finally {
          setChangingPass(false);
        }
      };

      return (
        <div className="min-h-dvh bg-canvas flex flex-col items-center justify-center px-4 py-12">
          <div className="w-full max-w-sm">
            <div className="flex justify-center mb-8">
              <Brand />
            </div>
            <div className="card p-6 sm:p-8 shadow-md">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h1 className="text-lg font-semibold text-slate-900 tracking-tight">Imposta una nuova password</h1>
              <p className="text-[13px] text-slate-500 mt-1 mb-6">È il tuo primo accesso: per sicurezza scegli una password personale.</p>

              <form className="space-y-4" onSubmit={handleChangePassword}>
                {error && <ErrorBox>{error}</ErrorBox>}
                <div>
                  <label htmlFor="np" className="field-label">Nuova password</label>
                  <PasswordInput id="np" value={newPassword} onChange={setNewPassword} placeholder="Minimo 6 caratteri" autoComplete="new-password" />
                </div>
                <div>
                  <label htmlFor="np2" className="field-label">Conferma password</label>
                  <PasswordInput id="np2" value={confirmNewPassword} onChange={setConfirmNewPassword} placeholder="Ripeti la password" autoComplete="new-password" />
                </div>
                <button type="submit" disabled={changingPass} className="btn btn-primary w-full h-10 mt-2">
                  {changingPass ? <Spinner /> : null}
                  {changingPass ? 'Aggiornamento…' : 'Salva e continua'}
                </button>
              </form>
            </div>
          </div>
        </div>
      );
    }

    if (userData.status === 'pending') return <Navigate to="/pending" replace />;
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isRegister && password !== confirmPassword) {
      setError('Le password non coincidono.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isRegister) {
        await registerEmail(email, password, firstName, lastName);
      } else if (useNameLogin) {
        await loginWithName(username, password);
      } else {
        await loginEmail(email, password);
      }
    } catch (err: any) {
      setError(friendlyError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    try {
      await loginProvider();
    } catch (err: any) {
      setError(friendlyError(err));
    }
  };

  const features = [
    { icon: <Boxes className="w-4 h-4" />, title: 'Inventario centralizzato', text: 'Dispositivi, consumabili e licenze in un unico posto.' },
    { icon: <ScanLine className="w-4 h-4" />, title: 'Scansione barcode e QR', text: 'Trova o assegna un asset in un secondo.' },
    { icon: <Ticket className="w-4 h-4" />, title: 'Richieste e assistenza', text: 'Ticket tracciati dalla richiesta alla chiusura.' },
  ];

  return (
    <div className="min-h-dvh grid lg:grid-cols-[1fr_minmax(0,560px)] bg-white">
      {/* Colonna form */}
      <div className="flex flex-col px-5 sm:px-10 py-8 order-1">
        <Brand />

        <div className="flex-1 flex items-center justify-center py-10">
          <div className="w-full max-w-[380px]">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              {isRegister ? 'Crea il tuo account' : 'Bentornato'}
            </h1>
            <p className="text-[13px] text-slate-500 mt-1.5">
              {isRegister
                ? "Dopo la registrazione un amministratore approverà l'accesso."
                : 'Accedi per gestire magazzino, prestiti e richieste.'}
            </p>

            <button type="button" onClick={handleGoogle} className="btn btn-secondary w-full h-10 mt-7">
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              Continua con Google
            </button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200" /></div>
              <div className="relative flex justify-center"><span className="px-3 bg-white text-xs text-slate-400">oppure</span></div>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit} noValidate={false}>
              {error && <ErrorBox>{error}</ErrorBox>}

              {!isRegister && (
                <div className="segmented w-full">
                  <button type="button" className="flex-1" data-active={!useNameLogin} onClick={() => { setUseNameLogin(false); setError(''); }}>
                    Email
                  </button>
                  <button type="button" className="flex-1" data-active={useNameLogin} onClick={() => { setUseNameLogin(true); setError(''); }}>
                    Nome utente
                  </button>
                </div>
              )}

              {isRegister && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="fn" className="field-label">Nome</label>
                    <input id="fn" type="text" required autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="input h-10" placeholder="Mario" />
                  </div>
                  <div>
                    <label htmlFor="ln" className="field-label">Cognome</label>
                    <input id="ln" type="text" required autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} className="input h-10" placeholder="Rossi" />
                  </div>
                </div>
              )}

              {isRegister || !useNameLogin ? (
                <div>
                  <label htmlFor="email" className="field-label">Email aziendale</label>
                  <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input h-10" placeholder="nome.cognome@azienda.it" />
                </div>
              ) : (
                <div>
                  <label htmlFor="user" className="field-label">Nome utente</label>
                  <input id="user" type="text" required autoComplete="username" autoCapitalize="none" value={username} onChange={(e) => setUsername(e.target.value)} className="input h-10" placeholder="mario.rossi" />
                </div>
              )}

              <div>
                <label htmlFor="pw" className="field-label">Password</label>
                <PasswordInput id="pw" value={password} onChange={setPassword} autoComplete={isRegister ? 'new-password' : 'current-password'} />
              </div>

              {isRegister && (
                <div>
                  <label htmlFor="pw2" className="field-label">Conferma password</label>
                  <PasswordInput id="pw2" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
                </div>
              )}

              <button type="submit" disabled={isSubmitting} className="btn btn-primary w-full h-10 !mt-6">
                {isSubmitting ? <Spinner /> : null}
                {isSubmitting ? 'Attendere…' : isRegister ? 'Crea account' : 'Accedi'}
                {!isSubmitting && <ArrowRight />}
              </button>
            </form>

            <p className="mt-6 text-center text-[13px] text-slate-500">
              {isRegister ? 'Hai già un account?' : 'Non hai un account?'}{' '}
              <button
                type="button"
                onClick={() => { setIsRegister(!isRegister); setError(''); }}
                className="font-medium text-blue-600 hover:text-blue-700"
              >
                {isRegister ? 'Accedi' : 'Registrati'}
              </button>
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-400">© {new Date().getFullYear()} Office Manager</p>
      </div>

      {/* Pannello brand */}
      <aside className="hidden lg:flex order-2 m-3 rounded-2xl bg-slate-950 text-white relative overflow-hidden flex-col justify-end p-10">
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
            maskImage: 'radial-gradient(ellipse at 70% 20%, black 10%, transparent 70%)',
            WebkitMaskImage: 'radial-gradient(ellipse at 70% 20%, black 10%, transparent 70%)',
          }}
        />
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-blue-600/40 blur-[100px]" />
        <div className="relative">
          <p className="text-[13px] font-medium text-blue-300">Hub IT aziendale</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight leading-tight max-w-sm">Ogni asset al suo posto, ogni richiesta sotto controllo.</h2>
          <ul className="mt-8 space-y-4">
            {features.map((f) => (
              <li key={f.title} className="flex gap-3">
                <span className="w-8 h-8 rounded-lg bg-white/10 ring-1 ring-inset ring-white/10 flex items-center justify-center shrink-0 text-blue-200">{f.icon}</span>
                <span>
                  <span className="block text-sm font-medium">{f.title}</span>
                  <span className="block text-[13px] text-slate-400">{f.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
