import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Device, User } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Smartphone, History, ChevronRight } from 'lucide-react';
import { PageHeader, PageBody, PageLoader, EmptyState } from '../components/ui';

export default function UserDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userData, currentUser } = useAuth();
  
  const [user, setUser] = useState<User | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [historyDevices, setHistoryDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  const isSelf = currentUser?.uid === id;
  const isAdminOrTech = userData?.role === 'admin' || userData?.role === 'tecnico';

  useEffect(() => {
    if (!id) return;
    if (!isAdminOrTech && !isSelf) {
      navigate('/dashboard');
      return;
    }

    const unsubUser = onSnapshot(doc(db, 'users', id), (docSnap) => {
      if (docSnap.exists()) {
        setUser({ id: docSnap.id, ...docSnap.data() } as User);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `users/${id}`));

    const unsubAllDevices = onSnapshot(collection(db, 'devices'), (snapshot) => {
      const all = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Device));
      setDevices(all.filter(d => d.assignedToUserId === id));
      setHistoryDevices(all.filter(d => 
        d.assignedToUserId !== id && 
        d.history?.some(h => h.userId === id)
      ));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'devices'));

    return () => {
      unsubUser();
      unsubAllDevices();
    };
  }, [id, isAdminOrTech, isSelf, navigate]);

  if (loading) return <PageLoader />;
  if (!user) return <PageBody className="pt-10"><div className="card"><EmptyState title="Utente non trovato" /></div></PageBody>;

  const ROLE_LABEL: Record<string, string> = { admin: 'Amministratore', tecnico: 'Tecnico', utente: 'Utente' };
  const name = user.firstName || user.lastName ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : user.email;

  const Row = ({ d, sub, muted }: { d: Device; sub: string; muted?: boolean; key?: React.Key }) => (
    <li>
      <button onClick={() => navigate(`/devices/${d.id}`)} className="w-full flex items-center gap-3 px-4 sm:px-5 py-3 text-left hover:bg-slate-50 transition-colors group">
        <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${muted ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-600'}`}>
          {muted ? <History className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[13px] font-medium text-slate-900 group-hover:text-blue-600 truncate">{d.category}</span>
          <span className="block text-xs text-slate-500 font-mono truncate">{d.serialNumber}</span>
        </span>
        <span className="text-xs text-slate-500 tabular-nums">{sub}</span>
        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500" />
      </button>
    </li>
  );

  return (
    <div className="flex flex-col flex-1">
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="icon-btn -ml-2" aria-label="Indietro"><ArrowLeft /></button>
            {name}
          </span>
        }
        description={`${user.email} · ${ROLE_LABEL[user.role] || user.role}`}
      />

      <PageBody className="space-y-5 max-w-4xl">
        <section className="card overflow-hidden">
          <header className="card-header">
            <div>
              <h3 className="card-title">Dispositivi assegnati</h3>
              <p className="card-subtitle">{devices.length} in dotazione</p>
            </div>
          </header>
          {devices.length === 0 ? (
            <EmptyState icon={<Smartphone />} title="Nessun dispositivo assegnato" className="py-10" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {devices.map(d => <Row key={d.id} d={d} sub={`dal ${d.updatedAt?.toDate?.().toLocaleDateString('it-IT') || '—'}`} />)}
            </ul>
          )}
        </section>

        {historyDevices.length > 0 && (
          <section className="card overflow-hidden">
            <header className="card-header">
              <div>
                <h3 className="card-title">Storico</h3>
                <p className="card-subtitle">Dispositivi restituiti o trasferiti</p>
              </div>
            </header>
            <ul className="divide-y divide-slate-100">
              {historyDevices.map(d => {
                const h = d.history?.filter(x => x.userId === id).sort((a, b) => b.date?.toMillis() - a.date?.toMillis())[0];
                return <Row key={`hist-${d.id}`} d={d} muted sub={h?.date?.toDate?.().toLocaleDateString('it-IT') || '—'} />;
              })}
            </ul>
          </section>
        )}
      </PageBody>
    </div>
  );
}
