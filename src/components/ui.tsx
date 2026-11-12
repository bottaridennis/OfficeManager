import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, X, Inbox, Search } from 'lucide-react';
import { cn } from '../lib/utils';

/* -------------------------------------------------------------------------- */
/* Page layout                                                                */
/* -------------------------------------------------------------------------- */

export function PageHeader({
  title,
  description,
  actions,
  icon,
  className,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className={cn('print:hidden px-4 sm:px-6 lg:px-8 pt-6 pb-5', className)}>
      <div className="mx-auto max-w-7xl flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          {icon && (
            <div className="hidden sm:flex w-10 h-10 shrink-0 rounded-xl bg-white border border-slate-200/80 shadow-xs items-center justify-center text-slate-600 [&_svg]:w-5 [&_svg]:h-5">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-xl sm:text-[22px] font-semibold tracking-tight text-slate-900 leading-tight">{title}</h1>
            {description && <p className="text-[13px] text-slate-500 mt-1 max-w-2xl">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
      </div>
      {children && <div className="mx-auto max-w-7xl mt-5">{children}</div>}
    </header>
  );
}

export function PageBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className="print:hidden px-4 sm:px-6 lg:px-8 pb-10">
      <div className={cn('mx-auto max-w-7xl', className)}>{children}</div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Feedback                                                                   */
/* -------------------------------------------------------------------------- */

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn('inline-block w-4 h-4 rounded-full border-2 border-current border-r-transparent animate-spin', className)}
      aria-hidden
    />
  );
}

export function PageLoader({ label = 'Caricamento…' }: { label?: string }) {
  return (
    <div className="px-4 sm:px-6 lg:px-8 pt-6" aria-busy="true" aria-live="polite">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="space-y-2">
          <div className="skeleton h-6 w-56" />
          <div className="skeleton h-4 w-80 max-w-full" />
        </div>
        <div className="card p-4 space-y-3">
          <div className="skeleton h-9 w-full max-w-md" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-11 w-full" />
          ))}
        </div>
        <span className="sr-only">{label}</span>
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-14 px-6', className)}>
      <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3 [&_svg]:w-5 [&_svg]:h-5">
        {icon ?? <Inbox />}
      </div>
      <p className="text-sm font-medium text-slate-900">{title}</p>
      {description && <p className="text-[13px] text-slate-500 mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Inputs                                                                     */
/* -------------------------------------------------------------------------- */

export function SearchInput({
  value,
  onChange,
  placeholder = 'Cerca…',
  className,
  autoFocus,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  id?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input
        id={id}
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input pl-9 pr-8 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          aria-label="Cancella ricerca"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Stat card                                                                  */
/* -------------------------------------------------------------------------- */

const toneMap = {
  brand: 'bg-blue-50 text-blue-600',
  success: 'bg-emerald-50 text-emerald-600',
  warning: 'bg-amber-50 text-amber-600',
  danger: 'bg-rose-50 text-rose-600',
  neutral: 'bg-slate-100 text-slate-600',
  violet: 'bg-violet-50 text-violet-600',
} as const;

export type Tone = keyof typeof toneMap;

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'brand',
  trend,
  onClick,
  id,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: Tone;
  trend?: React.ReactNode;
  onClick?: () => void;
  id?: string;
}) {
  const Comp: any = onClick ? 'button' : 'div';
  return (
    <Comp
      id={id}
      onClick={onClick}
      className={cn(
        'card p-4 sm:p-5 text-left w-full flex flex-col gap-3 transition-all',
        onClick && 'hover:border-slate-300 hover:shadow-md group'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-slate-500">{label}</span>
        {icon && (
          <span className={cn('w-8 h-8 rounded-lg flex items-center justify-center [&_svg]:w-4 [&_svg]:h-4', toneMap[tone])}>
            {icon}
          </span>
        )}
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className="text-[26px] leading-none font-semibold tracking-tight text-slate-900 tabular-nums">{value}</span>
        {trend}
      </div>
      {hint && <div className="text-xs text-slate-500 -mt-1">{hint}</div>}
    </Comp>
  );
}

/* -------------------------------------------------------------------------- */
/* Modal                                                                      */
/* -------------------------------------------------------------------------- */

export function Modal({
  open = true,
  onClose,
  title,
  description,
  icon,
  size = 'md',
  footer,
  children,
  className,
}: {
  open?: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const widths = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' };

  return createPortal(
    <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] animate-in" onClick={onClose} />
      <div
        className={cn(
          'relative w-full bg-white shadow-2xl border border-slate-200/80 flex flex-col max-h-[92dvh]',
          'rounded-t-2xl sm:rounded-2xl animate-slide-up sm:animate-in',
          widths[size],
          className
        )}
      >
        {title && (
          <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-slate-100">
            {icon && (
              <div className="w-9 h-9 shrink-0 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center [&_svg]:w-[18px] [&_svg]:h-[18px]">
                {icon}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-slate-900 tracking-tight">{title}</h2>
              {description && <p className="text-[13px] text-slate-500 mt-0.5">{description}</p>}
            </div>
            <button onClick={onClose} className="icon-btn -mr-1.5 -mt-1" aria-label="Chiudi">
              <X />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && (
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50/60 rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

/* -------------------------------------------------------------------------- */
/* Dropdown menu (row actions, export…)                                       */
/* -------------------------------------------------------------------------- */

export type MenuItem =
  | {
      label: string;
      icon?: React.ReactNode;
      onClick?: () => void;
      href?: string;
      danger?: boolean;
      description?: string;
      disabled?: boolean;
    }
  | { separator: true; label?: string };

export function DropdownMenu({
  items,
  trigger,
  align = 'right',
  width = 'w-56',
  label = 'Altre azioni',
  triggerClassName = 'btn btn-secondary',
  disabled,
}: {
  items: MenuItem[];
  trigger?: React.ReactNode;
  triggerClassName?: string;
  disabled?: boolean;
  align?: 'left' | 'right';
  width?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      const up = r.bottom + 280 > window.innerHeight && r.top > 280;
      setPos({ top: up ? r.top - 6 : r.bottom + 6, left: align === 'right' ? r.right : r.left, up });
    }
    setOpen((o) => !o);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        aria-label={trigger ? undefined : label}
        title={trigger ? undefined : label}
        className={trigger ? triggerClassName : cn('icon-btn', open && 'bg-slate-100 text-slate-900')}
      >
        {trigger ?? <MoreHorizontal />}
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: 'fixed',
              top: pos.up ? undefined : pos.top,
              bottom: pos.up ? window.innerHeight - pos.top : undefined,
              left: align === 'left' ? pos.left : undefined,
              right: align === 'right' ? window.innerWidth - pos.left : undefined,
            }}
            className={cn('z-[300] bg-white rounded-xl border border-slate-200 shadow-lg p-1 animate-in', width)}
          >
            {items.map((it, i) => {
              if ('separator' in it) {
                return (
                  <div key={i} className={cn(i > 0 && 'mt-1 pt-1 border-t border-slate-100')}>
                    {it.label && (
                      <div className="px-2.5 pt-1.5 pb-1 text-[11px] font-medium text-slate-400 uppercase tracking-wide">{it.label}</div>
                    )}
                  </div>
                );
              }
              const content = (
                <>
                  {it.icon && <span className={cn('w-4 h-4 shrink-0 [&_svg]:w-4 [&_svg]:h-4 mt-px', it.danger ? 'text-rose-500' : 'text-slate-400')}>{it.icon}</span>}
                  <span className="flex-1 min-w-0">
                    <span className="block truncate">{it.label}</span>
                    {it.description && <span className="block text-[11px] text-slate-400 font-normal truncate">{it.description}</span>}
                  </span>
                </>
              );
              const cls = cn(
                'w-full flex items-start gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium text-left transition-colors disabled:opacity-40',
                it.danger ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-700 hover:bg-slate-100'
              );
              if (it.href) {
                return (
                  <a key={i} href={it.href} role="menuitem" className={cls} onClick={() => setOpen(false)}>
                    {content}
                  </a>
                );
              }
              return (
                <button
                  key={i}
                  role="menuitem"
                  disabled={it.disabled}
                  className={cls}
                  onClick={() => {
                    setOpen(false);
                    it.onClick?.();
                  }}
                >
                  {content}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Avatar                                                                     */
/* -------------------------------------------------------------------------- */

const avatarColors = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-700',
  'bg-violet-100 text-violet-700',
  'bg-sky-100 text-sky-700',
  'bg-teal-100 text-teal-700',
];

export function Avatar({ name, email, size = 'md', className }: { name?: string; email?: string | null; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const src = (name || email || '?').trim();
  const parts = src.split(/[\s.@_-]+/).filter(Boolean);
  const initials = ((parts[0]?.[0] || '?') + (parts[1]?.[0] || '')).toUpperCase();
  const hash = Array.from(email || src).reduce((a, c) => a + c.charCodeAt(0), 0);
  const sizes = { sm: 'w-6 h-6 text-[10px]', md: 'w-8 h-8 text-xs', lg: 'w-11 h-11 text-sm' };
  return (
    <span className={cn('inline-flex shrink-0 items-center justify-center rounded-full font-semibold', avatarColors[hash % avatarColors.length], sizes[size], className)}>
      {initials}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Device status badge                                                        */
/* -------------------------------------------------------------------------- */

export function DeviceStatusBadge({ maintenance, assigned }: { maintenance?: boolean; assigned?: boolean }) {
  if (maintenance) return <span className="badge badge-dot badge-warning">Manutenzione</span>;
  if (assigned) return <span className="badge badge-dot badge-brand">In uso</span>;
  return <span className="badge badge-dot badge-success">Disponibile</span>;
}
