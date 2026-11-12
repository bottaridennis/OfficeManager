import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Info } from 'lucide-react';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  requireString?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
}

export default function ConfirmDialog({
  title,
  message,
  confirmText = 'Conferma',
  cancelText = 'Annulla',
  requireString,
  onConfirm,
  onCancel,
  isDestructive = false,
}: ConfirmDialogProps) {
  const [inputValue, setInputValue] = useState('');
  const [busy, setBusy] = useState(false);
  const isValid = requireString ? inputValue.trim().toUpperCase() === requireString.toUpperCase() : true;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const confirm = async () => {
    if (!isValid || busy) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] animate-in" onClick={onCancel} />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200/80 animate-slide-up sm:animate-in">
        <div className="p-5 sm:p-6 flex gap-4">
          <div
            className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center ${
              isDestructive ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'
            }`}
          >
            {isDestructive ? <AlertTriangle className="w-5 h-5" /> : <Info className="w-5 h-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <h3 id="confirm-title" className="text-base font-semibold text-slate-900 tracking-tight">{title}</h3>
            <p className="text-[13px] text-slate-500 leading-relaxed mt-1">{message}</p>

            {requireString && (
              <div className="mt-4">
                <label className="field-label">
                  Digita <span className="font-mono font-semibold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded">{requireString}</span> per confermare
                </label>
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && confirm()}
                  placeholder={requireString}
                  className="input font-mono"
                  autoFocus
                />
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-5 sm:px-6 py-4 bg-slate-50/70 border-t border-slate-100 rounded-b-2xl">
          <button onClick={onCancel} className="btn btn-secondary">
            {cancelText}
          </button>
          <button
            onClick={confirm}
            disabled={!isValid || busy}
            autoFocus={!requireString}
            className={`btn ${isDestructive ? 'btn-danger' : 'btn-primary'}`}
          >
            {busy && <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-r-transparent animate-spin" />}
            {confirmText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
