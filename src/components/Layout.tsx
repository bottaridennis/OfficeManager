import { Outlet, NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useOnboarding } from '../contexts/OnboardingContext';
import {
  LogOut,
  Monitor,
  Users,
  Ticket,
  LayoutDashboard,
  Package,
  ShieldCheck,
  Menu,
  X,
  ScanLine,
  UserRound,
  KeyRound,
  FileSignature,
  ClipboardCheck,
  PanelLeftClose,
  PanelLeftOpen,
  CircleHelp,
  ChevronsUpDown,
  CornerDownLeft,
} from 'lucide-react';
import { cn } from '../lib/utils';
import ScannerActionModal from './ScannerActionModal';
import OnboardingTour from './OnboardingTour';
import { Avatar, DropdownMenu } from './ui';
import { useEffect, useMemo, useRef, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';

type NavItem = { name: string; href: string; icon: any; badge?: number; id?: string };
type NavGroup = { label: string; items: NavItem[] };

const ROLE_LABEL: Record<string, string> = { admin: 'Amministratore', tecnico: 'Tecnico', utente: 'Utente' };

function BrandMark({ className }: { className?: string }) {
  return (
    <div className={cn('w-8 h-8 rounded-[9px] bg-blue-600 flex items-center justify-center shadow-sm ring-1 ring-inset ring-white/15', className)}>
      <svg viewBox="0 0 24 24" className="w-[18px] h-[18px] text-white" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
        <path d="M4 8l8-4.5L20 8v8l-8 4.5L4 16z" />
        <path d="M4 8l8 4.5L20 8M12 12.5V20.5" />
      </svg>
    </div>
  );
}

export default function Layout() {
  const { userData, currentUser, logout } = useAuth();
  const { startOnboarding, isActive: isOnboardingActive } = useOnboarding();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('om_sidebar_collapsed') === '1';
    } catch {
      return false;
    }
  });
  const [openTickets, setOpenTickets] = useState(0);
  const [mobileScanOpen, setMobileScanOpen] = useState(false);
  const scannerInputRef = useRef<HTMLInputElement>(null);

  const role = userData?.role;
  const isAdminOrTech = role === 'admin' || role === 'tecnico';

  useEffect(() => {
    try {
      localStorage.setItem('om_sidebar_collapsed', collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  // Chiudi il menu mobile quando cambia pagina
  useEffect(() => setMobileMenuOpen(false), [location.pathname]);

  // Contatore ticket aperti (badge nel menu)
  useEffect(() => {
    if (!currentUser || !userData) return;
    const q = isAdminOrTech
      ? query(collection(db, 'tickets'), where('status', '==', 'open'))
      : query(collection(db, 'tickets'), where('userId', '==', currentUser.uid));
    return onSnapshot(
      q,
      (snap) => {
        const n = isAdminOrTech ? snap.size : snap.docs.filter((d) => d.data().status === 'open').length;
        setOpenTickets(n);
      },
      () => setOpenTickets(0)
    );
  }, [currentUser, userData, isAdminOrTech]);

  // Scorciatoia "/" per il campo scanner
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) && !t.isContentEditable) {
        e.preventDefault();
        scannerInputRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const groups: NavGroup[] = useMemo(
    () =>
      [
        {
          label: 'Panoramica',
          items: [
            { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
            { name: 'Il mio inventario', href: '/my-inventory', icon: UserRound },
          ],
        },
        {
          label: 'Magazzino',
          items: [
            { name: 'Dispositivi', href: '/devices', icon: Monitor },
            { name: 'Consumabili', href: '/consumables', icon: Package },
            ...(isAdminOrTech ? [{ name: 'Licenze', href: '/licenses', icon: KeyRound }] : []),
          ],
        },
        {
          label: 'Operazioni',
          items: [
            ...(isAdminOrTech ? [{ name: 'Prestiti e moduli', href: '/loans', icon: FileSignature }] : []),
            { name: 'Richieste e ticket', href: '/tickets', icon: Ticket, badge: openTickets, id: 'onboarding-nav-tickets' },
          ],
        },
        {
          label: 'Amministrazione',
          items: [
            ...(isAdminOrTech ? [{ name: 'Collaudo QA', href: '/qa-testing', icon: ClipboardCheck }] : []),
            ...(role === 'admin' ? [{ name: 'Utenti', href: '/users', icon: Users }] : []),
            ...(role === 'admin' ? [{ name: 'Log di audit', href: '/logs', icon: ShieldCheck }] : []),
          ],
        },
      ].filter((g) => g.items.length > 0),
    [isAdminOrTech, role, openTickets]
  );

  const allItems = groups.flatMap((g) => g.items);
  const current = allItems.find((n) => location.pathname.startsWith(n.href));
  const currentGroup = groups.find((g) => g.items.includes(current as NavItem));
  const isDetail = current && location.pathname !== current.href;

  const displayName = userData?.firstName ? `${userData.firstName} ${userData.lastName || ''}`.trim() : userData?.email || 'Utente';

  const submitScan = (val: string) => {
    const v = val.trim();
    if (!v) return;
    window.dispatchEvent(new CustomEvent('barcode-scanned', { detail: v }));
  };

  const sidebar = (isMobile: boolean) => {
    const mini = collapsed && !isMobile;
    return (
      <div className="flex flex-col h-full">
        {/* Brand */}
        <div className={cn('h-14 flex items-center gap-2.5 shrink-0', mini ? 'justify-center px-2' : 'px-4')}>
          <Link to="/dashboard" className="flex items-center gap-2.5 min-w-0" aria-label="Office Manager — Dashboard">
            <BrandMark />
            {!mini && (
              <div className="min-w-0 leading-tight">
                <div className="text-[14px] font-semibold tracking-tight text-slate-900">Office Manager</div>
                <div className="text-[11px] text-slate-500">Magazzino & IT</div>
              </div>
            )}
          </Link>
          {isMobile && (
            <button className="icon-btn ml-auto" onClick={() => setMobileMenuOpen(false)} aria-label="Chiudi menu">
              <X />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className={cn('flex-1 overflow-y-auto py-2 space-y-5', mini ? 'px-2' : 'px-3')} aria-label="Navigazione principale">
          {groups.map((group) => (
            <div key={group.label}>
              {mini ? (
                <div className="mx-2 mb-2 border-t border-slate-200/80 first:hidden" />
              ) : (
                <div className="px-2.5 pb-1.5 text-[11px] font-medium text-slate-400">{group.label}</div>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <NavLink
                        id={item.id}
                        to={item.href}
                        title={mini ? item.name : undefined}
                        className={({ isActive }) =>
                          cn(
                            'group relative flex items-center gap-2.5 h-9 rounded-lg text-[13px] font-medium transition-colors',
                            mini ? 'justify-center px-0' : 'px-2.5',
                            isActive
                              ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                          )
                        }
                      >
                        {({ isActive }) => (
                          <>
                            <Icon className={cn('w-[17px] h-[17px] shrink-0', isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600')} />
                            {!mini && <span className="flex-1 truncate">{item.name}</span>}
                            {!!item.badge && item.badge > 0 && (
                              <span
                                className={cn(
                                  'tabular-nums text-[11px] font-semibold rounded-full bg-blue-600 text-white',
                                  mini ? 'absolute top-1 right-1 min-w-4 h-4 px-1 text-[9px] flex items-center justify-center' : 'px-1.5 min-w-5 h-5 flex items-center justify-center'
                                )}
                              >
                                {item.badge > 99 ? '99+' : item.badge}
                              </span>
                            )}
                          </>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer: utente */}
        <div className={cn('shrink-0 border-t border-slate-200/80', mini ? 'p-2' : 'p-3')}>
          <DropdownMenu
            align="left"
            width="w-60"
            triggerClassName={cn(
              'w-full flex items-center gap-2.5 rounded-lg hover:bg-slate-200/50 transition-colors text-left',
              mini ? 'justify-center p-1' : 'p-1.5'
            )}
            trigger={
              <>
                <Avatar name={displayName} email={userData?.email} />
                {!mini && (
                  <>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13px] font-medium text-slate-900 truncate">{displayName}</span>
                      <span className="block text-[11px] text-slate-500 truncate">{ROLE_LABEL[role || 'utente']}</span>
                    </span>
                    <ChevronsUpDown className="w-4 h-4 text-slate-400" />
                  </>
                )}
              </>
            }
            items={[
              { separator: true, label: userData?.email || '' },
              { label: 'Il mio inventario', icon: <UserRound />, onClick: () => navigate('/my-inventory') },
              { label: 'Tour guidato', description: 'Riscopri le funzioni principali', icon: <CircleHelp />, onClick: startOnboarding },
              { separator: true },
              { label: 'Esci', icon: <LogOut />, onClick: logout, danger: true },
            ]}
          />
          {!isMobile && (
            <button
              onClick={() => setCollapsed((c) => !c)}
              className={cn('mt-1 w-full flex items-center gap-2.5 h-8 rounded-lg text-[12px] text-slate-500 hover:text-slate-900 hover:bg-slate-200/50 transition-colors', mini ? 'justify-center' : 'px-2.5')}
              title={collapsed ? 'Espandi barra laterale' : 'Comprimi barra laterale'}
            >
              {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
              {!mini && <span>Comprimi</span>}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-dvh bg-canvas text-slate-900 overflow-hidden">
      {/* Sidebar desktop */}
      <aside
        className={cn(
          'print:hidden hidden md:flex flex-col shrink-0 bg-slate-100/70 border-r border-slate-200/80 transition-[width] duration-200',
          collapsed ? 'w-[64px]' : 'w-[248px]'
        )}
      >
        {sidebar(false)}
      </aside>

      {/* Sidebar mobile (drawer) */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] animate-in" onClick={() => setMobileMenuOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-slate-50 shadow-2xl animate-in">{sidebar(true)}</aside>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="print:hidden h-14 shrink-0 flex items-center gap-3 px-3 sm:px-6 bg-canvas/80 backdrop-blur border-b border-slate-200/70 z-20">
          <button className="icon-btn md:hidden" onClick={() => setMobileMenuOpen(true)} aria-label="Apri menu">
            <Menu />
          </button>

          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-[13px] min-w-0" aria-label="Percorso">
            {currentGroup && <span className="hidden sm:inline text-slate-400">{currentGroup.label}</span>}
            {currentGroup && <span className="hidden sm:inline text-slate-300">/</span>}
            {isDetail ? (
              <>
                <Link to={current!.href} className="text-slate-500 hover:text-slate-900 truncate">
                  {current!.name}
                </Link>
                <span className="text-slate-300">/</span>
                <span className="font-medium text-slate-900">Dettaglio</span>
              </>
            ) : (
              <span className="font-medium text-slate-900 truncate">{current?.name || 'Panoramica'}</span>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            {/* Scanner desktop */}
            <form
              id="onboarding-header-scanner"
              className="relative hidden md:block"
              onSubmit={(e) => {
                e.preventDefault();
                const input = scannerInputRef.current!;
                submitScan(input.value);
                input.value = '';
                input.blur();
              }}
            >
              <ScanLine className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={scannerInputRef}
                type="text"
                inputMode="search"
                autoComplete="off"
                aria-label="Scansiona barcode o seriale"
                placeholder="Scansiona o digita seriale"
                className="input w-72 lg:w-80 pl-9 pr-16 bg-white peer"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
                <span className="kbd peer-focus:hidden">/</span>
                <span className="kbd hidden peer-focus:inline-flex">
                  <CornerDownLeft className="w-3 h-3" />
                </span>
              </span>
            </form>

            {/* Scanner mobile */}
            <button className="icon-btn md:hidden" onClick={() => setMobileScanOpen(true)} aria-label="Scansiona barcode">
              <ScanLine />
            </button>

            <button
              onClick={startOnboarding}
              className={cn('icon-btn', isOnboardingActive && 'bg-blue-50 text-blue-600')}
              title="Tour guidato"
              aria-label="Avvia tour guidato"
            >
              <CircleHelp />
            </button>
          </div>
        </header>

        {/* Mobile scan sheet */}
        {mobileScanOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex items-start p-3 pt-16">
            <div className="absolute inset-0 bg-slate-950/40" onClick={() => setMobileScanOpen(false)} />
            <form
              className="relative w-full card p-3 shadow-xl flex gap-2 animate-in"
              onSubmit={(e) => {
                e.preventDefault();
                const input = (e.currentTarget.elements.namedItem('scan') as HTMLInputElement);
                submitScan(input.value);
                setMobileScanOpen(false);
              }}
            >
              <input name="scan" autoFocus className="input h-10" placeholder="Seriale o barcode…" autoComplete="off" />
              <button type="submit" className="btn btn-primary h-10">Cerca</button>
            </form>
          </div>
        )}

        <div className="flex-1 flex flex-col min-h-0 overflow-y-auto">
          <Outlet />
        </div>
      </main>

      <ScannerActionModal />
      <OnboardingTour />
    </div>
  );
}
