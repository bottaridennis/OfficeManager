import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Device, User, Ticket, Consumable } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { PageHeader, PageBody, StatCard, EmptyState, SearchInput } from '../components/ui';
import { 
  Users, 
  Smartphone, 
  Ticket as TicketIcon, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  BarChart3,
  Package,
  Laptop,
  Monitor,
  Headphones,
  Printer,
  Mouse,
  Keyboard,
  Cpu,
  Tablet,
  Box,
  TrendingUp,
  Coins,
  ArrowUpRight,
  Layers,
  Search,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  LineChart,
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as ReChartsTooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

const CHART = {
  brand: '#4f4ddc',
  accent: '#14b8a6',
  grid: '#ececf0',
  tick: '#8a8a96',
};

// Tooltip grafici
const CustomTooltip = ({ active, payload, label, prefix = '', suffix = '' }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white px-3 py-2.5 rounded-lg shadow-lg border border-slate-200 text-xs min-w-[160px]">
        <p className="font-medium text-slate-900 mb-1.5 capitalize">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={`item-${index}`} className="flex items-center justify-between gap-4 py-0.5">
            <span className="flex items-center gap-1.5 text-slate-500">
              <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: entry.color }} />
              {entry.name}
            </span>
            <span className="font-medium text-slate-900 tabular-nums">
              {prefix}{typeof entry.value === 'number' ? entry.value.toLocaleString('it-IT', { maximumFractionDigits: 2 }) : entry.value}{suffix}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const { currentUser, userData } = useAuth();
  const navigate = useNavigate();
  const [devices, setDevices] = useState<Device[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [consumables, setConsumables] = useState<Consumable[]>([]);
  const [loans, setLoans] = useState<any[]>([]);

  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [activeChartTab, setActiveChartTab] = useState<'costs' | 'monthly' | 'weekly' | 'users'>('costs');
  const [dashboardSearchTerm, setDashboardSearchTerm] = useState('');

  useEffect(() => {
    let unsubDevices = () => {};
    let unsubUsers = () => {};
    let unsubTickets = () => {};
    let unsubConsumables = () => {};
    let unsubLoans = () => {};

    if (currentUser && userData) {
      const isAdminOrTech = userData.role === 'admin' || userData.role === 'tecnico';

      unsubDevices = onSnapshot(collection(db, 'devices'), (snap) => {
        setDevices(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Device)));
      });

      if (isAdminOrTech) {
        unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
          setUsers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
        });
        unsubLoans = onSnapshot(collection(db, 'loans'), (snap) => {
          setLoans(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
      }

      const ticketsQuery = isAdminOrTech 
        ? collection(db, 'tickets') 
        : query(collection(db, 'tickets'), where('userId', '==', currentUser.uid));
        
      unsubTickets = onSnapshot(ticketsQuery, (snap) => {
        setTickets(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ticket)));
      });

      unsubConsumables = onSnapshot(collection(db, 'consumables'), (snap) => {
        setConsumables(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Consumable)));
      });
    }

    return () => {
      unsubDevices();
      unsubUsers();
      unsubTickets();
      unsubConsumables();
      unsubLoans();
    };
  }, [currentUser, userData]);

  const costData = React.useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      name: new Date(2000, i, 1).toLocaleString('it-IT', { month: 'short' }),
      Dispositivi: 0,
      Consumabili: 0,
    }));

    devices.forEach(d => {
      if (d.price && d.purchaseDate) {
        const date = new Date(d.purchaseDate);
        if (date.getFullYear() === selectedYear) {
          months[date.getMonth()].Dispositivi += Number(d.price);
        }
      }
    });

    consumables.forEach(c => {
      if (c.price && c.createdAt) {
        let date;
        if (typeof c.createdAt === 'string') date = new Date(c.createdAt);
        else if (c.createdAt?.toDate) date = c.createdAt.toDate();
        else date = new Date(c.createdAt);

        if (date && date.getFullYear() === selectedYear) {
          months[date.getMonth()].Consumabili += Number(c.price) * (c.totalQuantity || 0);
        }
      }
    });

    return months;
  }, [devices, consumables, selectedYear]);

  const totalCostDevices = React.useMemo(() => devices.reduce((sum, d) => sum + (Number(d.price) || 0), 0), [devices]);
  const totalCostConsumables = React.useMemo(() => consumables.reduce((sum, c) => sum + ((Number(c.price) || 0) * (c.totalQuantity || 0)), 0), [consumables]);

  const userConsumptionData = React.useMemo(() => {
    const consumptionMap: Record<string, number> = {};

    loans.forEach(loan => {
      if (loan.targetType === 'consumable' && loan.targetDocName) {
        if (selectedUserId === 'all' || loan.userId === selectedUserId) {
          consumptionMap[loan.targetDocName] = (consumptionMap[loan.targetDocName] || 0) + (loan.quantity || 1);
        }
      }
    });

    return Object.entries(consumptionMap)
      .map(([name, Quantita]) => ({ name, Quantita }))
      .sort((a, b) => b.Quantita - a.Quantita)
      .slice(0, 10);
  }, [loans, selectedUserId]);

  const monthlyConsumptions = React.useMemo(() => {
    const months = Array.from({ length: 12 }, (_, i) => ({
      name: new Date(2000, i, 1).toLocaleString('it-IT', { month: 'short' }),
      Materiali: 0,
      Dispositivi: 0,
    }));

    loans.forEach(loan => {
      if (loan.checkoutDate) {
        const date = new Date(loan.checkoutDate);
        if (date.getFullYear() === selectedYear) {
          if (loan.targetType === 'consumable') {
            months[date.getMonth()].Materiali += (loan.quantity || 1);
          } else {
            months[date.getMonth()].Dispositivi += 1;
          }
        }
      }
    });
    return months;
  }, [loans, selectedYear]);

  const weeklyConsumptions = React.useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return {
        dateObj: d,
        name: d.toLocaleString('it-IT', { weekday: 'short', day: 'numeric' }),
        Materiali: 0,
        Dispositivi: 0,
      };
    });

    loans.forEach(loan => {
      if (loan.checkoutDate) {
        const date = new Date(loan.checkoutDate);
        days.forEach(day => {
          if (date.getDate() === day.dateObj.getDate() && 
              date.getMonth() === day.dateObj.getMonth() && 
              date.getFullYear() === day.dateObj.getFullYear()) {
            if (loan.targetType === 'consumable') {
              day.Materiali += (loan.quantity || 1);
            } else {
              day.Dispositivi += 1;
            }
          }
        });
      }
    });
    return days;
  }, [loans]);

  const isAdminOrTech = userData?.role === 'admin' || userData?.role === 'tecnico';

  const stats = {
    totalDevices: isAdminOrTech ? devices.length : devices.filter(d => d.assignedToUserId === currentUser?.uid).length,
    assignedDevices: isAdminOrTech ? devices.filter(d => !!d.assignedToUserId).length : devices.filter(d => d.assignedToUserId === currentUser?.uid).length,
    availableDevices: isAdminOrTech ? devices.filter(d => !d.assignedToUserId && !d.isUnderMaintenance).length : 0,
    underMaintenance: isAdminOrTech ? devices.filter(d => !!d.isUnderMaintenance).length : 0,
    totalConsumablesStock: consumables.reduce((acc, c) => acc + (c.totalQuantity - c.consumedQuantity), 0),
    totalUsers: users.length,
    pendingUsers: users.filter(u => u.status === 'pending').length,
    openTickets: isAdminOrTech ? tickets.filter(t => t.status === 'open').length : tickets.filter(t => t.userId === currentUser?.uid && t.status === 'open').length,
    almostEmptyConsumables: consumables.filter(c => (c.totalQuantity - c.consumedQuantity) <= 5).length
  };

  const filteredDevices = isAdminOrTech ? devices : devices.filter(d => d.assignedToUserId === currentUser?.uid);

  const devicesByCategory = filteredDevices.reduce((acc, d) => {
    acc[d.category] = (acc[d.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const chartData = Object.entries(devicesByCategory).map(([name, value]) => ({ name, value: value as number }));

  const pieData = isAdminOrTech
    ? [
        { name: 'Disponibili', value: stats.availableDevices },
        { name: 'Assegnati', value: stats.assignedDevices },
        { name: 'In Manutenzione', value: stats.underMaintenance },
      ].filter(d => d.value > 0)
    : [];

  const PIE_COLORS = ['#10b981', CHART.brand, '#f59e0b'];

  const getCategoryIconComponent = (category: string) => {
    const c = category.toLowerCase();
    const cls = 'w-4 h-4';
    if (c.includes('smartphone') || c.includes('telefono') || c.includes('cellulare')) return <Smartphone className={cls} />;
    if (c.includes('laptop') || c.includes('computer') || c.includes('pc') || c.includes('macbook') || c.includes('portatile')) return <Laptop className={cls} />;
    if (c.includes('monitor') || c.includes('schermo') || c.includes('display')) return <Monitor className={cls} />;
    if (c.includes('cuffie') || c.includes('auricolari') || c.includes('headset')) return <Headphones className={cls} />;
    if (c.includes('stampante') || c.includes('printer')) return <Printer className={cls} />;
    if (c.includes('mouse') || c.includes('touchpad')) return <Mouse className={cls} />;
    if (c.includes('tastiera') || c.includes('keyboard')) return <Keyboard className={cls} />;
    if (c.includes('tablet') || c.includes('ipad')) return <Tablet className={cls} />;
    if (c.includes('server') || c.includes('switch') || c.includes('router') || c.includes('hub')) return <Cpu className={cls} />;
    return <Box className={cls} />;
  };

  const hour = new Date().getHours();
  const greeting = hour < 13 ? 'Buongiorno' : hour < 18 ? 'Buon pomeriggio' : 'Buonasera';
  const today = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  const maxCategory = Math.max(1, ...chartData.map((c) => c.value));
  const sortedStock = [...consumables]
    .map((c) => {
      const remaining = c.totalQuantity - c.consumedQuantity;
      const pct = c.totalQuantity > 0 ? Math.max(0, Math.round((remaining / c.totalQuantity) * 100)) : 0;
      return { ...c, remaining, pct };
    })
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 6);
  const fmtEur = (n: number) => n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

  const alerts = [
    isAdminOrTech && stats.pendingUsers > 0 && {
      key: 'users',
      tone: 'warning',
      icon: <Clock className="w-4 h-4" />,
      title: `${stats.pendingUsers} ${stats.pendingUsers === 1 ? 'utente in attesa' : 'utenti in attesa'} di approvazione`,
      hint: 'Vai a Gestione utenti',
      to: '/users',
    },
    stats.openTickets > 0 && {
      key: 'tickets',
      tone: 'danger',
      icon: <AlertCircle className="w-4 h-4" />,
      title: `${stats.openTickets} ticket ${isAdminOrTech ? 'da prendere in carico' : stats.openTickets === 1 ? 'aperto' : 'aperti'}`,
      hint: 'Apri Richieste e ticket',
      to: '/tickets',
    },
    isAdminOrTech && stats.almostEmptyConsumables > 0 && {
      key: 'stock',
      tone: 'brand',
      icon: <Package className="w-4 h-4" />,
      title: `${stats.almostEmptyConsumables} consumabili sotto scorta (≤ 5)`,
      hint: 'Pianifica il riordino',
      to: '/consumables',
    },
  ].filter(Boolean) as { key: string; tone: string; icon: React.ReactNode; title: string; hint: string; to: string }[];

  const alertTone: Record<string, string> = {
    warning: 'bg-amber-50 text-amber-600',
    danger: 'bg-rose-50 text-rose-600',
    brand: 'bg-blue-50 text-blue-600',
  };

  const axisProps = { tick: { fontSize: 11, fill: CHART.tick }, axisLine: false, tickLine: false } as const;

  return (
    <div className="flex-1">
      <PageHeader
        title={`${greeting}, ${userData?.firstName || userData?.email?.split('@')[0] || ''}`}
        description={<span className="capitalize">{today}</span>}
        actions={
          <div id="onboarding-quick-search" className="w-full sm:w-80">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (dashboardSearchTerm.trim()) navigate(`/consumables?search=${encodeURIComponent(dashboardSearchTerm.trim())}`);
              }}
            >
              <SearchInput value={dashboardSearchTerm} onChange={setDashboardSearchTerm} placeholder="Cerca materiale (carta, toner…)" />
            </form>
          </div>
        }
      />

      <PageBody className="space-y-5">
        {/* KPI */}
        <div id="onboarding-kpi-grid" className={`grid grid-cols-2 ${isAdminOrTech ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-3 sm:gap-4 scroll-mt-6`}>
          <StatCard
            label={isAdminOrTech ? 'Dispositivi' : 'I miei dispositivi'}
            value={stats.totalDevices}
            icon={<Laptop />}
            tone="brand"
            hint={isAdminOrTech ? <><span className="text-emerald-600 font-medium">{stats.availableDevices} disponibili</span> · {stats.assignedDevices} in uso</> : 'In dotazione personale'}
            onClick={() => navigate(isAdminOrTech ? '/devices' : '/my-inventory')}
          />
          {isAdminOrTech ? (
            <StatCard
              label="Scorte consumabili"
              value={stats.totalConsumablesStock.toLocaleString('it-IT')}
              icon={<Package />}
              tone={stats.almostEmptyConsumables > 0 ? 'warning' : 'success'}
              hint={stats.almostEmptyConsumables > 0 ? <span className="text-amber-700 font-medium">{stats.almostEmptyConsumables} sotto scorta</span> : `${consumables.length} articoli · scorte OK`}
              onClick={() => navigate('/consumables')}
            />
          ) : (
            <StatCard label="Ticket aperti" value={stats.openTickets} icon={<TicketIcon />} tone="danger" hint="Richieste a tuo nome" onClick={() => navigate('/tickets')} />
          )}
          {isAdminOrTech ? (
            <StatCard
              label="Ticket aperti"
              value={stats.openTickets}
              icon={<TicketIcon />}
              tone={stats.openTickets > 0 ? 'danger' : 'success'}
              hint={stats.openTickets === 0 ? 'Nessuna richiesta in attesa' : <span className="text-rose-600 font-medium">Richiedono intervento</span>}
              onClick={() => navigate('/tickets')}
            />
          ) : (
            <StatCard label="Consumabili disponibili" value={stats.totalConsumablesStock} icon={<Package />} tone="violet" hint="Materiale in magazzino" onClick={() => navigate('/consumables')} />
          )}
          {isAdminOrTech && (
            <StatCard
              label="Valore asset"
              value={fmtEur(totalCostDevices + totalCostConsumables)}
              icon={<Coins />}
              tone="success"
              hint={`Hardware ${fmtEur(totalCostDevices)}`}
            />
          )}
        </div>

        {/* Grafico + Avvisi */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-5">
          {isAdminOrTech && (
            <div className="card xl:col-span-2 flex flex-col min-w-0">
              <div className="card-header flex-col sm:flex-row items-start sm:items-center">
                <div>
                  <h3 className="card-title">Andamento</h3>
                  <p className="card-subtitle">
                    {activeChartTab === 'costs' && <>Spesa {selectedYear}: <span className="font-medium text-slate-700 tabular-nums">{fmtEur(totalCostDevices + totalCostConsumables)}</span></>}
                    {activeChartTab === 'monthly' && <>Assegnazioni e prelievi mensili · {selectedYear}</>}
                    {activeChartTab === 'weekly' && <>Movimentazioni degli ultimi 7 giorni</>}
                    {activeChartTab === 'users' && <>Top 10 consumabili prelevati</>}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="segmented overflow-x-auto max-w-full">
                    {([
                      ['costs', 'Spese'],
                      ['monthly', 'Mensile'],
                      ['weekly', '7 giorni'],
                      ['users', 'Per utente'],
                    ] as const).map(([k, l]) => (
                      <button key={k} data-active={activeChartTab === k} onClick={() => setActiveChartTab(k)}>
                        {l}
                      </button>
                    ))}
                  </div>
                  {activeChartTab !== 'weekly' && activeChartTab !== 'users' && (
                    <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="select h-8 text-xs" aria-label="Anno">
                      {[0, 1, 2].map((d) => {
                        const y = new Date().getFullYear() - d;
                        return <option key={y} value={y}>{y}</option>;
                      })}
                    </select>
                  )}
                  {activeChartTab === 'users' && (
                    <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} className="select h-8 text-xs max-w-[200px]" aria-label="Utente">
                      <option value="all">Tutti gli utenti</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>{u.firstName ? `${u.firstName} ${u.lastName || ''}` : u.email}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="p-4 sm:p-5 h-[300px]">
                {activeChartTab === 'costs' && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={costData} margin={{ top: 8, right: 8, bottom: 0, left: -8 }} barGap={2}>
                      <CartesianGrid stroke={CHART.grid} vertical={false} />
                      <XAxis dataKey="name" {...axisProps} />
                      <YAxis {...axisProps} tickFormatter={(v) => `€${v >= 1000 ? `${(v / 1000).toLocaleString('it-IT', { maximumFractionDigits: 1 })}k` : v}`} />
                      <ReChartsTooltip cursor={{ fill: '#f1f1f4' }} content={<CustomTooltip prefix="€ " />} />
                      <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                      <Bar name="Dispositivi" dataKey="Dispositivi" stackId="a" fill={CHART.brand} radius={[0, 0, 0, 0]} maxBarSize={28} />
                      <Bar name="Consumabili" dataKey="Consumabili" stackId="a" fill={CHART.accent} radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
                {activeChartTab === 'monthly' && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyConsumptions} margin={{ top: 8, right: 8, bottom: 0, left: -16 }} barGap={2}>
                      <CartesianGrid stroke={CHART.grid} vertical={false} />
                      <XAxis dataKey="name" {...axisProps} />
                      <YAxis {...axisProps} allowDecimals={false} />
                      <ReChartsTooltip cursor={{ fill: '#f1f1f4' }} content={<CustomTooltip />} />
                      <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                      <Bar name="Dispositivi" dataKey="Dispositivi" fill={CHART.brand} radius={[4, 4, 0, 0]} maxBarSize={16} />
                      <Bar name="Consumabili" dataKey="Materiali" fill={CHART.accent} radius={[4, 4, 0, 0]} maxBarSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
                {activeChartTab === 'weekly' && (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={weeklyConsumptions} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
                      <CartesianGrid stroke={CHART.grid} vertical={false} />
                      <XAxis dataKey="name" {...axisProps} />
                      <YAxis {...axisProps} allowDecimals={false} />
                      <ReChartsTooltip content={<CustomTooltip />} />
                      <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                      <Line type="monotone" name="Dispositivi" dataKey="Dispositivi" stroke={CHART.brand} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                      <Line type="monotone" name="Consumabili" dataKey="Materiali" stroke={CHART.accent} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
                {activeChartTab === 'users' &&
                  (userConsumptionData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={userConsumptionData} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }}>
                        <CartesianGrid stroke={CHART.grid} horizontal={false} />
                        <XAxis type="number" {...axisProps} allowDecimals={false} />
                        <YAxis dataKey="name" type="category" {...axisProps} tick={{ fontSize: 12, fill: '#52525d' }} width={130} />
                        <ReChartsTooltip cursor={{ fill: '#f1f1f4' }} content={<CustomTooltip suffix=" pz" />} />
                        <Bar name="Quantità" dataKey="Quantita" fill={CHART.brand} radius={[0, 4, 4, 0]} maxBarSize={18} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState className="h-full" icon={<BarChart3 />} title="Nessun prelievo registrato" description="Non ci sono consumi per la selezione corrente." />
                  ))}
              </div>
            </div>
          )}

          {/* Avvisi */}
          <div className={`card flex flex-col ${isAdminOrTech ? '' : 'xl:col-span-3'}`}>
            <div className="card-header">
              <div>
                <h3 className="card-title">Da gestire</h3>
                <p className="card-subtitle">Elementi che richiedono attenzione</p>
              </div>
              {alerts.length > 0 && <span className="badge badge-danger tabular-nums">{alerts.length}</span>}
            </div>
            <div className="p-2 flex-1">
              {alerts.length > 0 ? (
                <ul className="space-y-0.5">
                  {alerts.map((a) => (
                    <li key={a.key}>
                      <Link to={a.to} className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors group">
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${alertTone[a.tone]}`}>{a.icon}</span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[13px] font-medium text-slate-900">{a.title}</span>
                          <span className="block text-xs text-slate-500">{a.hint}</span>
                        </span>
                        <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all" />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={<CheckCircle2 className="text-emerald-500" />} title="Tutto in ordine" description="Nessun avviso o urgenza in sospeso." />
              )}
            </div>

            {isAdminOrTech && pieData.length > 0 && (
              <div className="border-t border-slate-100 p-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-[13px] font-medium text-slate-900">Stato dispositivi</h4>
                  <span className="text-xs text-slate-500 tabular-nums">{stats.totalDevices} totali</span>
                </div>
                <div className="flex h-2 rounded-full overflow-hidden bg-slate-100 gap-0.5">
                  {pieData.map((d, i) => (
                    <div key={d.name} style={{ width: `${(d.value / Math.max(1, stats.totalDevices)) * 100}%`, backgroundColor: PIE_COLORS[i] }} />
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {pieData.map((d, i) => (
                    <div key={d.name} className="min-w-0">
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 truncate">
                        <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: PIE_COLORS[i] }} />
                        {d.name}
                      </div>
                      <div className="text-base font-semibold text-slate-900 tabular-nums mt-0.5">{d.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Categorie + Scorte */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
          <div className={`card ${isAdminOrTech ? '' : 'lg:col-span-2'}`}>
            <div className="card-header">
              <div>
                <h3 className="card-title">{isAdminOrTech ? 'Inventario per categoria' : 'I tuoi dispositivi per categoria'}</h3>
                <p className="card-subtitle">{chartData.length} {chartData.length === 1 ? 'categoria' : 'categorie'}</p>
              </div>
              <Link to="/devices" className="btn btn-ghost btn-sm">
                Vedi tutti <ArrowRight />
              </Link>
            </div>
            {chartData.length > 0 ? (
              <ul className="p-2">
                {[...chartData].sort((a, b) => b.value - a.value).map((c) => (
                  <li key={c.name} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50">
                    <span className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">{getCategoryIconComponent(c.name)}</span>
                    <span className="w-28 sm:w-36 text-[13px] font-medium text-slate-800 truncate">{c.name}</span>
                    <span className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <span className="block h-full rounded-full bg-blue-500" style={{ width: `${(c.value / maxCategory) * 100}%` }} />
                    </span>
                    <span className="w-8 text-right text-[13px] font-semibold text-slate-900 tabular-nums">{c.value}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={<Layers />} title="Nessun dispositivo" description="L'inventario è ancora vuoto." />
            )}
          </div>

          {isAdminOrTech && (
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">Livello scorte</h3>
                  <p className="card-subtitle">Articoli ordinati dal più critico</p>
                </div>
                <Link to="/consumables" className="btn btn-ghost btn-sm">
                  Magazzino <ArrowRight />
                </Link>
              </div>
              {sortedStock.length > 0 ? (
                <ul className="p-2">
                  {sortedStock.map((c) => {
                    const tone = c.remaining <= 5 ? 'bg-rose-500' : c.pct < 35 ? 'bg-amber-500' : 'bg-emerald-500';
                    return (
                      <li key={c.id} className="px-3 py-2.5 rounded-lg hover:bg-slate-50">
                        <div className="flex items-center justify-between gap-3 mb-1.5">
                          <span className="text-[13px] font-medium text-slate-800 truncate">{c.name}</span>
                          <span className="text-xs text-slate-500 tabular-nums shrink-0">
                            <span className={`font-semibold ${c.remaining <= 5 ? 'text-rose-600' : 'text-slate-900'}`}>{c.remaining}</span> / {c.totalQuantity} {c.unit || 'pz'}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div className={`h-full rounded-full ${tone} transition-all duration-500`} style={{ width: `${c.pct}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState icon={<Package />} title="Nessun consumabile" description="Aggiungi articoli dalla sezione Consumabili." />
              )}
            </div>
          )}
        </div>
      </PageBody>
    </div>
  );
}
