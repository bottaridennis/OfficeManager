import { useAuth } from '../contexts/AuthContext';
import { Hourglass, LogOut, RefreshCw } from 'lucide-react';

export default function PendingApproval() {
  const { logout, userData } = useAuth();

  return (
    <div className="min-h-dvh bg-canvas flex items-center justify-center px-4 py-12">
      <div className="card w-full max-w-md p-8 text-center shadow-md">
        <div className="mx-auto w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-5">
          <Hourglass className="w-6 h-6" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Account in attesa di approvazione</h1>
        <p className="mt-2 text-[13px] text-slate-500 leading-relaxed">
          Il tuo account{userData?.email ? <> (<span className="font-medium text-slate-700">{userData.email}</span>)</> : null} è stato creato.
          Un amministratore deve abilitarlo prima che tu possa accedere.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
          <button onClick={() => window.location.reload()} className="btn btn-secondary">
            <RefreshCw /> Verifica di nuovo
          </button>
          <button onClick={logout} className="btn btn-ghost">
            <LogOut /> Esci
          </button>
        </div>
      </div>
    </div>
  );
}
