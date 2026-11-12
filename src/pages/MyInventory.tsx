import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, doc, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Device, User, Ticket, Consumable } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';
import { Smartphone, Wrench, Package, History } from 'lucide-react';
import { PageHeader, PageBody, PageLoader, EmptyState, Avatar, Modal } from '../components/ui';

export default function MyInventory() {
  const { userData, currentUser } = useAuth();
  
  const [selectedUserId, setSelectedUserId] = useState<string>(currentUser?.uid || '');
  const [users, setUsers] = useState<User[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [historyDevices, setHistoryDevices] = useState<Device[]>([]);
  const [consumables, setConsumables] = useState<Consumable[]>([]);
  const [consumableTickets, setConsumableTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  // Repair Modal State
  const [isRepairModalOpen, setIsRepairModalOpen] = useState(false);
  const [repairDevice, setRepairDevice] = useState<Device | null>(null);
  const [repairDescription, setRepairDescription] = useState('');
  const [isSubmittingRepair, setIsSubmittingRepair] = useState(false);

  const isAdmin = userData?.role === 'admin';

  useEffect(() => {
    if (isAdmin) {
      const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
        const allUsers = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as User));
        setUsers(allUsers);
      }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));
      return () => unsubUsers();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!selectedUserId) return;

    const unsubUser = onSnapshot(doc(db, 'users', selectedUserId), (docSnap) => {
      if (docSnap.exists()) {
        setUser({ id: docSnap.id, ...docSnap.data() } as User);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `users/${selectedUserId}`));

    const unsubAllDevices = onSnapshot(collection(db, 'devices'), (snapshot) => {
      const all = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Device));
      setDevices(all.filter(d => d.assignedToUserId === selectedUserId && !d.isUnderMaintenance));
      setHistoryDevices(all.filter(d => 
        d.assignedToUserId !== selectedUserId && 
        d.history?.some(h => h.userId === selectedUserId)
      ));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'devices'));

    const unsubConsumables = onSnapshot(collection(db, 'consumables'), (snapshot) => {
      setConsumables(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Consumable)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'consumables'));

    const unsubTickets = onSnapshot(query(collection(db, 'tickets')), (snapshot) => {
       const allTickets = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Ticket));
       setConsumableTickets(allTickets.filter(t => 
         t.userId === selectedUserId && 
         t.type === 'request' && 
         t.consumableId && 
         (t.status === 'closed' || t.status === 'archived')
       ));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'tickets'));

    return () => {
      unsubUser();
      unsubAllDevices();
      unsubConsumables();
      unsubTickets();
    };
  }, [selectedUserId]);

  const handleRequestRepair = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repairDevice || !repairDescription.trim() || !currentUser) return;
    
    setIsSubmittingRepair(true);
    try {
      await addDoc(collection(db, 'tickets'), {
        type: 'support',
        description: `Riparazione richiesta per ${repairDevice.category} (SN: ${repairDevice.serialNumber}): ${repairDescription}`,
        deviceId: repairDevice.id,
        userId: currentUser.uid,
        status: 'open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setIsRepairModalOpen(false);
      setRepairDescription('');
      setRepairDevice(null);
      // alert could be better, but we are inside an iframe often, so simple dismiss is fine
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'tickets');
    } finally {
      setIsSubmittingRepair(false);
    }
  };

  const openRepairModal = (d: Device) => {
    setRepairDevice(d);
    setRepairDescription('');
    setIsRepairModalOpen(true);
  };

  if (loading) return <PageLoader />;
  if (!user) return <PageBody className="pt-10"><div className="card"><EmptyState title="Profilo non trovato" /></div></PageBody>;

  const ROLE_LABEL: Record<string, string> = { admin: 'Amministratore', tecnico: 'Tecnico', utente: 'Utente' };
  const isMe = selectedUserId === currentUser?.uid;
  const name = user.firstName || user.lastName ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : user.email;

  return (
    <div className="flex flex-col flex-1">
      <PageHeader
        title={isMe ? 'Il mio inventario' : `Inventario di ${user.firstName || user.email}`}
        description="Dispositivi in dotazione, materiale prelevato e storico."
        actions={isAdmin && (
          <div className="flex items-center gap-2">
            <label htmlFor="inv-user" className="text-[13px] text-slate-500 hidden sm:block">Utente</label>
            <select id="inv-user" value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} className="select max-w-[240px]">
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.firstName} {u.lastName} {u.id === currentUser?.uid ? '(tu)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      />

      <PageBody className="space-y-5">
        <div id="onboarding-myinventory-profile" className="card p-5 flex items-center flex-wrap gap-4">
          {user.photoUrl ? <img src={user.photoUrl} alt="" className="w-12 h-12 rounded-full object-cover" /> : <Avatar name={name} email={user.email} size="lg" className="w-12 h-12 text-base" />}
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-slate-900 truncate">{name}</h2>
            <p className="text-[13px] text-slate-500 truncate">{user.email} · {ROLE_LABEL[user.role] || user.role}</p>
          </div>
          <div className="flex gap-6 sm:gap-8">
            <div>
              <div className="text-xs text-slate-500">Dispositivi</div>
              <div className="text-xl font-semibold text-slate-900 tabular-nums">{devices.length}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Prelievi</div>
              <div className="text-xl font-semibold text-slate-900 tabular-nums">{consumableTickets.length}</div>
            </div>
          </div>
        </div>

        <section className="card overflow-hidden">
          <header className="card-header">
            <div>
              <h3 className="card-title">Dispositivi assegnati</h3>
              <p className="card-subtitle">{devices.length} in dotazione</p>
            </div>
          </header>
          {devices.length === 0 ? (
            <EmptyState icon={<Smartphone />} title="Nessun dispositivo assegnato" description="Puoi richiederne uno dalla sezione Richieste e ticket." action={<Link to="/tickets" className="btn btn-secondary btn-sm">Nuova richiesta</Link>} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {devices.map(device => (
                <li key={device.id} className="flex items-center gap-3 px-4 sm:px-5 py-3">
                  <span className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><Smartphone className="w-4 h-4" /></span>
                  <Link to={`/devices/${device.id}`} className="flex-1 min-w-0 group">
                    <div className="text-[13px] font-medium text-slate-900 group-hover:text-blue-600 truncate">{device.category}</div>
                    <div className="text-xs text-slate-500 truncate"><span className="font-mono">{device.serialNumber}</span> · dal {device.updatedAt?.toDate?.().toLocaleDateString('it-IT') || '—'}</div>
                  </Link>
                  <button onClick={() => openRepairModal(device)} className="btn btn-secondary btn-sm shrink-0">
                    <Wrench /> <span className="hidden sm:inline">Segnala guasto</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {consumableTickets.length > 0 && (
          <section className="card overflow-hidden">
            <header className="card-header">
              <div>
                <h3 className="card-title">Consumabili prelevati</h3>
                <p className="card-subtitle">{consumableTickets.length} prelievi registrati</p>
              </div>
            </header>
            <ul className="divide-y divide-slate-100">
              {consumableTickets.map(ticket => {
                const consumable = consumables.find(c => c.id === ticket.consumableId);
                return (
                  <li key={`cons-${ticket.id}`} className="flex items-center gap-3 px-4 sm:px-5 py-3">
                    <span className="w-9 h-9 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center shrink-0"><Package className="w-4 h-4" /></span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-slate-900 truncate">{consumable?.name || 'Consumabile eliminato'}</div>
                      <div className="text-xs text-slate-500">{consumable?.category || '—'}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[13px] font-semibold text-slate-900 tabular-nums">{ticket.consumableQuantity} {consumable?.unit || 'pz'}</div>
                      <div className="text-xs text-slate-500 tabular-nums">{ticket.updatedAt?.toDate?.().toLocaleDateString('it-IT') || '—'}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {historyDevices.length > 0 && (
          <section className="card overflow-hidden">
            <header className="card-header">
              <div>
                <h3 className="card-title">Storico</h3>
                <p className="card-subtitle">Dispositivi restituiti o trasferiti</p>
              </div>
            </header>
            <ul className="divide-y divide-slate-100">
              {historyDevices.map(device => {
                const historyEntry = device.history?.filter(h => h.userId === selectedUserId).sort((a, b) => b.date?.toMillis() - a.date?.toMillis())[0];
                return (
                  <li key={`hist-${device.id}`} className="flex items-center gap-3 px-4 sm:px-5 py-3">
                    <span className="w-9 h-9 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center shrink-0"><History className="w-4 h-4" /></span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-slate-700 truncate">{device.category}</div>
                      <div className="text-xs text-slate-500 font-mono">{device.serialNumber}</div>
                    </div>
                    <span className="text-xs text-slate-500 tabular-nums">{historyEntry?.date?.toDate?.().toLocaleDateString('it-IT') || '—'}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </PageBody>

      {isRepairModalOpen && repairDevice && (
        <Modal
          onClose={() => setIsRepairModalOpen(false)}
          title="Segnala un guasto"
          description={`${repairDevice.category} · ${repairDevice.serialNumber}`}
          icon={<Wrench />}
          footer={
            <>
              <button type="button" onClick={() => setIsRepairModalOpen(false)} className="btn btn-secondary">Annulla</button>
              <button type="submit" form="repair-form" disabled={isSubmittingRepair} className="btn btn-primary">
                {isSubmittingRepair ? 'Invio…' : 'Invia richiesta'}
              </button>
            </>
          }
        >
          <form id="repair-form" onSubmit={handleRequestRepair} className="p-5">
            <label htmlFor="repair-desc" className="field-label">Descrizione del problema</label>
            <textarea
              id="repair-desc"
              required
              rows={4}
              autoFocus
              className="input resize-none"
              placeholder="Es. la batteria si scarica in meno di un'ora…"
              value={repairDescription}
              onChange={(e) => setRepairDescription(e.target.value)}
            />
          </form>
        </Modal>
      )}
    </div>
  );
}
