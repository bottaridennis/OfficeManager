import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, doc, setDoc, updateDoc, deleteDoc, serverTimestamp, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { logOperation } from '../lib/logger';
import { Ticket, TicketStatus, Device, User, Consumable } from '../types';
import { Plus, X, MessageSquare, Package, Trash2, CheckCircle, Archive, Check, Search, Filter, Minus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useOnboarding } from '../contexts/OnboardingContext';
import ConfirmDialog from '../components/ConfirmDialog';
import LoanModal from './LoanModal';
import { PageHeader, PageBody, PageLoader, EmptyState, SearchInput, Avatar, Modal } from '../components/ui';

export default function Tickets() {
  const { userData, currentUser } = useAuth();
  const { isActive: isOnboardingActive, currentStep, nextStep } = useOnboarding();
  const isAdminOrTech = userData?.role === 'admin' || userData?.role === 'tecnico';
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [consumables, setConsumables] = useState<Consumable[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    requireString?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  } | null>(null);

  const [showArchived, setShowArchived] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set());

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [checkoutModalTicket, setCheckoutModalTicket] = useState<Ticket | null>(null);
  const [type, setType] = useState<'support' | 'request'>('support');
  const [requestTarget, setRequestTarget] = useState<'device' | 'consumable'>('device');
  const [description, setDescription] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [deviceCategory, setDeviceCategory] = useState('Portatile');
  const [consumableId, setConsumableId] = useState('');
  const [consumableQuantity, setConsumableQuantity] = useState(1);
  const [priority, setPriority] = useState<'bassa' | 'media' | 'alta'>('media');
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'support' | 'request'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'priority-desc' | 'priority-asc'>('newest');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Determine which tickets to fetch: if admin/tech all, else only own
    let q = isAdminOrTech 
      ? query(collection(db, 'tickets'))
      : query(collection(db, 'tickets'), where('userId', '==', currentUser?.uid));
    
    const unsubscribeTickets = onSnapshot(q, (snapshot) => {
      let ticketsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ticket));
      // Store all tickets; we'll filter them during render
      setTickets(ticketsData.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis()));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tickets');
    });

    const unsubscribeDevices = onSnapshot(query(collection(db, 'devices')), (snapshot) => {
      setDevices(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Device)));
    }, error => handleFirestoreError(error, OperationType.LIST, 'devices'));

    const unsubscribeConsumables = onSnapshot(query(collection(db, 'consumables')), (snapshot) => {
      setConsumables(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Consumable)));
    }, error => handleFirestoreError(error, OperationType.LIST, 'consumables'));

    let unsubscribeUsers = () => {};
    if (isAdminOrTech) {
      unsubscribeUsers = onSnapshot(query(collection(db, 'users')), (snapshot) => {
        setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
      }, error => handleFirestoreError(error, OperationType.LIST, 'users'));
    }

    return () => {
      unsubscribeTickets();
      unsubscribeDevices();
      unsubscribeConsumables();
      unsubscribeUsers();
    };
  }, [isAdminOrTech, currentUser?.uid]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description) return;

    try {
      const newTicketRef = doc(collection(db, 'tickets'));
      const ticketData: any = {
        type,
        description,
        priority,
        userId: currentUser!.uid,
        status: 'open' as TicketStatus,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (type === 'support' && deviceId) {
        ticketData.deviceId = deviceId;
      }
      
      if (type === 'request' && requestTarget === 'device' && deviceCategory) {
        ticketData.deviceCategory = deviceCategory;
      }

      if (type === 'request' && requestTarget === 'consumable' && consumableId) {
        ticketData.consumableId = consumableId;
        ticketData.consumableQuantity = consumableQuantity;
      }

      await setDoc(newTicketRef, ticketData);
      
      await logOperation('create', 'tickets', `Creato ticket ${type === 'request' ? 'di richiesta' : 'di supporto'}: ${description}`, currentUser!.uid, currentUser!.email || '', newTicketRef.id);

      setIsModalOpen(false);
      setDescription('');
      setDeviceId('');
      setConsumableId('');
      setConsumableQuantity(1);
      setDeviceCategory('Portatile');
      setPriority('media');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `tickets`);
    }
  };

  const handleUpdateStatus = async (ticket: Ticket, newStatus: TicketStatus) => {
    try {
      const updateData: any = { status: newStatus, updatedAt: serverTimestamp() };
      if (newStatus === 'closed') {
        updateData.resolvedBy = currentUser!.uid;
      }
      if (newStatus === 'in-progress' && !ticket.assignedTo) {
        updateData.assignedTo = currentUser!.uid;
        updateData.assignedBy = currentUser!.uid;
      }
      
      await updateDoc(doc(db, 'tickets', ticket.id), updateData);
      await logOperation('update', 'tickets', `Aggiornato stato ticket a ${newStatus}`, currentUser!.uid, currentUser!.email || '', ticket.id);
      
      if (ticket.type === 'support' && ticket.deviceId) {
        if (newStatus === 'in-progress') {
          await updateDoc(doc(db, 'devices', ticket.deviceId), { isUnderMaintenance: true, updatedAt: serverTimestamp() });
          await logOperation('maintenance', 'devices', `In manutenzione (Ticket #${ticket.id})`, currentUser!.uid, currentUser!.email || '', ticket.deviceId);
        } else if (newStatus === 'closed') {
          await updateDoc(doc(db, 'devices', ticket.deviceId), { isUnderMaintenance: false, updatedAt: serverTimestamp() });
          await logOperation('maintenance', 'devices', `Fine manutenzione (Ticket #${ticket.id})`, currentUser!.uid, currentUser!.email || '', ticket.deviceId);
        }
      }

      if (newStatus === 'closed' && ticket.type === 'request') {
        const creator = users.find(u => u.id === ticket.userId);
        
        if (ticket.deviceId) {
          const device = devices.find(d => d.id === ticket.deviceId);
          if (device) {
            const newHistoryEntry = {
              date: new Date(),
              action: 'assigned',
              userId: ticket.userId,
              userEmail: creator?.email || 'Sconosciuto',
              notes: `Risoluzione ticket #${ticket.id}`
            };
            const updatedHistory = [...(device.history || []), newHistoryEntry];
            
            await updateDoc(doc(db, 'devices', ticket.deviceId), {
              assignedToUserId: ticket.userId,
              assignedToUserEmail: creator?.email || 'Sconosciuto',
              history: updatedHistory,
              updatedAt: serverTimestamp()
            });
            await logOperation('assign', 'devices', `Assegnato a ${creator?.email || 'Sconosciuto'} (Ticket #${ticket.id})`, currentUser!.uid, currentUser!.email || '', ticket.deviceId);
          }
        }

        if (ticket.consumableId && ticket.consumableQuantity) {
          const consumable = consumables.find(c => c.id === ticket.consumableId);
          if (consumable) {
            const newQty = consumable.consumedQuantity + ticket.consumableQuantity;
            await updateDoc(doc(db, 'consumables', ticket.consumableId), {
              consumedQuantity: newQty,
              updatedAt: serverTimestamp()
            });
            await logOperation('withdraw', 'consumables', `Prelevati ${ticket.consumableQuantity} per ${creator?.email || 'Sconosciuto'} (Ticket #${ticket.id})`, currentUser!.uid, currentUser!.email || '', ticket.consumableId);
          }
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tickets/${ticket.id}`);
    }
  };

  const handleDeleteTicket = (ticketId: string) => {
    if (!isAdminOrTech) return;
    
    setConfirmDialog({
      isOpen: true,
      title: 'Elimina Richiesta',
      message: 'Vuoi eliminare definitivamente questa richiesta?',
      requireString: 'ELIMINA',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'tickets', ticketId));
          await logOperation('delete', 'tickets', `Eliminato ticket #${ticketId}`, currentUser!.uid, currentUser!.email || '', ticketId);
          setConfirmDialog(null);
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `tickets/${ticketId}`);
          setConfirmDialog(null);
        }
      }
    });
  };

  const handleArchiveTicket = async (ticketId: string) => {
    if (!isAdminOrTech) return;
    
    try {
      await updateDoc(doc(db, 'tickets', ticketId), { status: 'archived', updatedAt: serverTimestamp() });
      await logOperation('update', 'tickets', `Archiviato ticket #${ticketId}`, currentUser!.uid, currentUser!.email || '', ticketId);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tickets/${ticketId}`);
    }
  };

  const handleRestoreTicket = async (ticketId: string) => {
    if (!isAdminOrTech) return;
    
    try {
      await updateDoc(doc(db, 'tickets', ticketId), { status: 'closed', updatedAt: serverTimestamp() });
      await logOperation('update', 'tickets', `Ripristinato ticket #${ticketId}`, currentUser!.uid, currentUser!.email || '', ticketId);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tickets/${ticketId}`);
    }
  };

  const toggleSelection = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newSet = new Set(selectedTickets);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedTickets(newSet);
  };

  const handleBulkAction = async (action: 'archive' | 'restore' | 'close' | 'in-progress') => {
    if (!isAdminOrTech || selectedTickets.size === 0) return;
    try {
      const promises = Array.from(selectedTickets).map((id: string) => {
        const ticket = tickets.find(t => t.id === id);
        if (!ticket) return Promise.resolve();
        
        const updateData: any = { updatedAt: serverTimestamp() };
        let actionDesc = '';
        
        switch (action) {
          case 'archive':
            updateData.status = 'archived';
            actionDesc = 'Archiviato';
            break;
          case 'restore':
            updateData.status = 'closed';
            actionDesc = 'Ripristinato';
            break;
          case 'close':
            updateData.status = 'closed';
            updateData.resolvedBy = currentUser!.uid;
            actionDesc = 'Segnato come risolto';
            if (ticket.type === 'support' && ticket.deviceId) {
              updateDoc(doc(db, 'devices', ticket.deviceId), { isUnderMaintenance: false, updatedAt: serverTimestamp() });
              logOperation('maintenance', 'devices', `Fine manutenzione (Ticket Bulk #${ticket.id})`, currentUser!.uid, currentUser!.email || '', ticket.deviceId);
            }
            break;
          case 'in-progress':
            updateData.status = 'in-progress';
            if (!ticket.assignedTo) {
              updateData.assignedTo = currentUser!.uid;
              updateData.assignedBy = currentUser!.uid;
            }
            actionDesc = 'Preso in carico';
            if (ticket.type === 'support' && ticket.deviceId) {
              updateDoc(doc(db, 'devices', ticket.deviceId), { isUnderMaintenance: true, updatedAt: serverTimestamp() });
              logOperation('maintenance', 'devices', `In manutenzione (Ticket Bulk #${ticket.id})`, currentUser!.uid, currentUser!.email || '', ticket.deviceId);
            }
            break;
        }
        
        return updateDoc(doc(db, 'tickets', id), updateData).then(() => {
          return logOperation('update', 'tickets', `${actionDesc} ticket #${id}`, currentUser!.uid, currentUser!.email || '', id);
        });
      });
      
      await Promise.all(promises);
      setSelectedTickets(new Set());
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tickets`);
    }
  };

  const handleBulkDelete = () => {
    if (!isAdminOrTech || selectedTickets.size === 0) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Elimina Selezionati',
      message: `Vuoi eliminare definitivamente ${selectedTickets.size} ticket selezionati? L'operazione è irreversibile.`,
      requireString: 'ELIMINA',
      isDestructive: true,
      onConfirm: async () => {
        try {
          const promises = Array.from(selectedTickets).map((id: string) => deleteDoc(doc(db, 'tickets', id)));
          await Promise.all(promises);
          await logOperation('delete', 'tickets', `Eliminati ${selectedTickets.size} ticket in blocco`, currentUser!.uid, currentUser!.email || '');
          setSelectedTickets(new Set());
          setConfirmDialog(null);
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `tickets`);
          setConfirmDialog(null);
        }
      }
    });
  };

  if (loading) return <PageLoader />;

  const matchesFilters = (t: Ticket) => {
    if (!showArchived && t.status === 'archived') return false;
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (typeFilter !== 'all' && t.type !== typeFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      if (!t.id.toLowerCase().includes(q) && !t.description.toLowerCase().includes(q)) return false;
    }
    return true;
  };
  const prioRank = (p?: string) => (p === 'alta' ? 3 : p === 'media' ? 2 : 1);
  const ms = (t: Ticket) => t.createdAt?.toMillis?.() || 0;
  const visibleTickets = tickets.filter(matchesFilters).sort((a, b) => {
    if (sortBy === 'oldest') return ms(a) - ms(b);
    if (sortBy.startsWith('priority')) {
      const d = prioRank(b.priority) - prioRank(a.priority);
      if (d !== 0) return sortBy === 'priority-desc' ? d : -d;
    }
    return ms(b) - ms(a);
  });

  const tabCounts = {
    all: tickets.filter(t => t.status !== 'archived').length,
    open: tickets.filter(t => t.status === 'open').length,
    'in-progress': tickets.filter(t => t.status === 'in-progress').length,
    closed: tickets.filter(t => t.status === 'closed').length,
    archived: tickets.filter(t => t.status === 'archived').length,
  };
  const tabs: [string, string][] = [
    ['all', 'Tutti'],
    ['open', 'Aperti'],
    ['in-progress', 'In carico'],
    ['closed', 'Risolti'],
    ...(isAdminOrTech ? [['archived', 'Archiviati'] as [string, string]] : []),
  ];
  const selectTab = (k: string) => {
    setShowArchived(k === 'archived');
    setStatusFilter(k as any);
    setSelectedTickets(new Set());
  };
  const activeTab = showArchived ? 'archived' : statusFilter;

  const statusBadge = (st: string) =>
    st === 'open' ? <span className="badge badge-dot badge-warning">Aperto</span>
    : st === 'in-progress' ? <span className="badge badge-dot badge-brand">In carico</span>
    : st === 'closed' ? <span className="badge badge-dot badge-success">Risolto</span>
    : <span className="badge badge-neutral">Archiviato</span>;

  const prioBadge = (p?: string) => !p ? null
    : p === 'alta' ? <span className="badge badge-danger">Alta</span>
    : p === 'media' ? <span className="badge badge-warning">Media</span>
    : <span className="badge badge-neutral">Bassa</span>;

  return (
    <div className="flex flex-col flex-1">
      <PageHeader
        title="Richieste e ticket"
        description="Segnalazioni di guasti e richieste di nuove dotazioni."
        actions={
          <div id="onboarding-tickets-actions" className="flex items-center gap-2 flex-wrap">
            <button id="onboarding-btn-new-ticket" onClick={() => setIsModalOpen(true)} className="btn btn-primary">
              <Plus /> Nuova richiesta
            </button>
          </div>
        }
      />

      <PageBody>
        <div className="card overflow-hidden">
          <div className="p-3 sm:p-4 border-b border-slate-100 flex flex-col gap-3">
            <div className="overflow-x-auto -mx-1 px-1">
              <div className="segmented">
                {tabs.map(([k, l]) => (
                  <button key={k} data-active={activeTab === k} onClick={() => selectTab(k)} className="flex items-center gap-1.5 whitespace-nowrap">
                    {l}
                    <span className="text-[11px] text-slate-400 tabular-nums">{tabCounts[k as keyof typeof tabCounts]}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Cerca nel testo o per ID…" className="sm:w-80" />
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)} className="select" aria-label="Tipo">
                <option value="all">Tutti i tipi</option>
                <option value="support">Assistenza</option>
                <option value="request">Richiesta dotazione</option>
              </select>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="select sm:ml-auto" aria-label="Ordina">
                <option value="newest">Più recenti</option>
                <option value="oldest">Meno recenti</option>
                <option value="priority-desc">Priorità più alta</option>
                <option value="priority-asc">Priorità più bassa</option>
              </select>
            </div>
          </div>

          {visibleTickets.length === 0 ? (
            <EmptyState
              icon={searchTerm ? <Search /> : <MessageSquare />}
              title={searchTerm || typeFilter !== 'all' || statusFilter !== 'all' ? 'Nessun ticket trovato' : 'Nessuna richiesta'}
              description="Apri una nuova richiesta per assistenza hardware o nuove dotazioni."
              action={<button onClick={() => setIsModalOpen(true)} className="btn btn-primary btn-sm"><Plus /> Nuova richiesta</button>}
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {visibleTickets.map((ticket) => {
                const relatedDevice = devices.find(d => d.id === ticket.deviceId);
                const creator = users.find(u => u.id === ticket.userId);
                const assignee = ticket.assignedTo ? users.find(u => u.id === ticket.assignedTo) : null;
                const selected = selectedTickets.has(ticket.id);
                return (
                  <li
                    key={ticket.id}
                    onClick={() => setSelectedTicket(ticket)}
                    onKeyDown={(e) => e.key === 'Enter' && setSelectedTicket(ticket)}
                    tabIndex={0}
                    role="button"
                    className={`flex items-start sm:items-center gap-3 px-3 sm:px-4 py-3 cursor-pointer transition-colors outline-none focus-visible:bg-slate-50 ${selected ? 'bg-blue-50/50' : 'hover:bg-slate-50/80'}`}
                  >
                    {isAdminOrTech && (
                      <div className="shrink-0 pt-1 sm:pt-0" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selected} onChange={(e) => toggleSelection(e, ticket.id)} className="w-4 h-4 rounded" aria-label="Seleziona ticket" />
                      </div>
                    )}
                    <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${ticket.type === 'support' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                      {ticket.type === 'support' ? <MessageSquare className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-slate-900 truncate">{ticket.description}</p>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5 min-w-0 flex-wrap">
                        {creator && <span className="text-slate-700">{creator.firstName} {creator.lastName}</span>}
                        {creator && <span className="text-slate-300">·</span>}
                        <span className="tabular-nums">{ticket.createdAt?.toDate?.().toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) || '—'}</span>
                        {relatedDevice && <><span className="text-slate-300">·</span><span className="font-mono text-[11px]">{relatedDevice.serialNumber}</span></>}
                        {!relatedDevice && ticket.deviceCategory && <><span className="text-slate-300">·</span><span>{ticket.deviceCategory}</span></>}
                        <span className="sm:hidden flex items-center gap-1.5 ml-1">{prioBadge(ticket.priority)}{statusBadge(ticket.status)}</span>
                      </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 shrink-0">
                      {assignee && <span title={`Assegnato a ${assignee.firstName || assignee.email}`}><Avatar name={`${assignee.firstName || ''} ${assignee.lastName || ''}`} email={assignee.email} size="sm" /></span>}
                      {prioBadge(ticket.priority)}
                      <span className="w-[92px] flex justify-end">{statusBadge(ticket.status)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="px-4 py-2.5 border-t border-slate-100 text-xs text-slate-500 bg-slate-50/50">
            <span className="tabular-nums font-medium text-slate-700">{visibleTickets.length}</span> ticket
          </div>
        </div>
      </PageBody>

      {isAdminOrTech && selectedTickets.size > 0 && (
        <div className="fixed bottom-4 inset-x-0 z-40 flex justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-1 bg-slate-900 text-white rounded-xl shadow-xl pl-4 pr-1.5 py-1.5 animate-slide-up max-w-full overflow-x-auto">
            <span className="text-[13px] font-medium whitespace-nowrap pr-2 tabular-nums">{selectedTickets.size} selezionati</span>
            <button onClick={() => handleBulkAction('in-progress')} className="btn btn-sm text-white hover:bg-white/10">In carico</button>
            <button onClick={() => handleBulkAction('close')} className="btn btn-sm text-white hover:bg-white/10"><Check /> Risolto</button>
            {showArchived
              ? <button onClick={() => handleBulkAction('restore')} className="btn btn-sm text-white hover:bg-white/10">Ripristina</button>
              : <button onClick={() => handleBulkAction('archive')} className="btn btn-sm text-white hover:bg-white/10"><Archive /> Archivia</button>}
            <button onClick={handleBulkDelete} className="btn btn-sm text-rose-300 hover:bg-rose-500/20"><Trash2 /></button>
            <span className="w-px h-5 bg-white/15 mx-1" />
            <button onClick={() => setSelectedTickets(new Set())} className="icon-btn text-slate-300 hover:text-white hover:bg-white/10" aria-label="Deseleziona"><X /></button>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px] animate-in" onClick={() => setIsModalOpen(false)} />
          
          <div className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden animate-in">
            <header className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900 tracking-tight">Nuova richiesta</h3>
                <p className="text-[13px] text-slate-500">Il team IT riceverà subito la tua segnalazione.</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="icon-btn">
                <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
              </button>
            </header>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <span className="field-label">Di cosa hai bisogno?</span>
                <div className="grid grid-cols-2 gap-2" role="radiogroup">
                  {([
                    ['support', 'Assistenza', 'Guasto o problema tecnico', MessageSquare],
                    ['request', 'Richiesta', 'Dispositivo o materiale', Package],
                  ] as const).map(([k, l, d, Icon]) => (
                    <button
                      key={k}
                      type="button"
                      role="radio"
                      aria-checked={type === k}
                      onClick={() => setType(k)}
                      className={`text-left p-3 rounded-xl border transition-all ${type === k ? 'border-blue-500 bg-blue-50/50 ring-[3px] ring-blue-500/10' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                    >
                      <Icon className={`w-4 h-4 mb-2 ${type === k ? 'text-blue-600' : 'text-slate-400'}`} />
                      <span className="block text-[13px] font-medium text-slate-900">{l}</span>
                      <span className="block text-xs text-slate-500">{d}</span>
                    </button>
                  ))}
                </div>
              </div>

              {type === 'request' && (
                <div className="animate-in bg-slate-50 p-4 rounded-xl border border-slate-200/70">
                  <div className="flex gap-4 mb-3">
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                      <input type="radio" checked={requestTarget === 'device'} onChange={() => setRequestTarget('device')} className="text-blue-600" /> Dotazione Dispositivo
                    </label>
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                      <input type="radio" checked={requestTarget === 'consumable'} onChange={() => setRequestTarget('consumable')} className="text-blue-600" /> Materiale Consumabile
                    </label>
                  </div>

                  {requestTarget === 'device' && (
                    <div>
                      <label className="field-label">Tipo di Dispositivo Richiesto</label>
                      <select
                        value={deviceCategory}
                        onChange={e => setDeviceCategory(e.target.value)}
                        className="input w-full h-10"
                      >
                        <option value="Portatile">Macchina Portatile (Laptop)</option>
                        <option value="Fisso">Macchina Fissa (Desktop)</option>
                        <option value="Altro">Altro (Specificare in descrizione)</option>
                      </select>
                    </div>
                  )}

                  {requestTarget === 'consumable' && (
                    <div className="flex gap-3 items-end">
                      <div className="flex-1">
                        <label className="field-label">Consumabile</label>
                        <select
                          required
                          value={consumableId}
                          onChange={e => setConsumableId(e.target.value)}
                          className="input w-full h-10"
                        >
                          <option value="">-- Seleziona materiale --</option>
                          {consumables.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.name} (Disp: {c.totalQuantity - c.consumedQuantity})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="shrink-0" id="onboarding-qty-stepper">
                        <label className="field-label">Quantità</label>
                        <div className="flex items-center h-10 border border-slate-200 rounded-lg bg-white overflow-hidden shadow-xs">
                          <button
                            type="button"
                            onClick={() => setConsumableQuantity(Math.max(1, consumableQuantity - 1))}
                            className="w-8 h-full flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="number"
                            required
                            min="1"
                            max={consumableId ? (consumables.find(c => c.id === consumableId)?.totalQuantity! - consumables.find(c => c.id === consumableId)?.consumedQuantity!) : 50}
                            value={consumableQuantity}
                            onChange={e => setConsumableQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-12 h-full text-center text-xs font-bold font-mono outline-none border-0"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const max = consumableId ? (consumables.find(c => c.id === consumableId)?.totalQuantity! - consumables.find(c => c.id === consumableId)?.consumedQuantity!) : 50;
                              setConsumableQuantity(Math.min(max || 50, consumableQuantity + 1));
                            }}
                            className="w-8 h-full flex items-center justify-center text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {type === 'support' && (
                <div className="animate-in slide-in-from-top-2 duration-200">
                  <label className="field-label">Dispositivo Coinvolto (Opzionale)</label>
                  <select
                    value={deviceId}
                    onChange={e => setDeviceId(e.target.value)}
                    className="input w-full h-10"
                  >
                    <option value="">-- Seleziona un tuo dispositivo --</option>
                    {devices.filter(d => d.assignedToUserId === currentUser?.uid).map(d => (
                      <option key={d.id} value={d.id}>
                        {d.category} - {d.serialNumber}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="field-label">Livello di Priorità</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['bassa', 'media', 'alta'] as const).map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`h-9 rounded-lg text-[13px] font-medium capitalize transition-all border flex items-center justify-center gap-1.5 ${
                        priority === p 
                          ? (p === 'alta' ? 'bg-rose-50 border-rose-300 text-rose-700' : p === 'media' ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-slate-100 border-slate-300 text-slate-800')
                          : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full ${p === 'alta' ? 'bg-rose-500' : p === 'media' ? 'bg-amber-500' : 'bg-slate-400'}`} />
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="field-label">Descrizione Dettagliata</label>
                <textarea
                  required
                  rows={4}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="input w-full resize-none"
                  placeholder="Descrivi dettagliatamente il problema riscontrato o la richiesta..."
                />
              </div>

              <footer className="pt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
                  Annulla
                </button>
                <button type="submit" className="btn btn-primary">
                  Invia richiesta
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      {selectedTicket && (() => {
        const t = selectedTicket;
        const requester = users.find(u => u.id === t.userId);
        const dev = t.deviceId ? devices.find(d => d.id === t.deviceId) : undefined;
        const isActiveT = t.status === 'open' || t.status === 'in-progress';
        return (
          <Modal
            onClose={() => setSelectedTicket(null)}
            icon={t.type === 'support' ? <MessageSquare /> : <Package />}
            title={t.type === 'support' ? 'Richiesta di assistenza' : 'Richiesta dotazione'}
            description={<span className="font-mono text-xs">#{t.id}</span>}
            footer={isAdminOrTech ? (
              <>
                <button onClick={() => { handleDeleteTicket(t.id); setSelectedTicket(null); }} className="btn btn-ghost !text-rose-600 hover:!bg-rose-50 sm:mr-auto">
                  <Trash2 /> Elimina
                </button>
                {t.status === 'archived' && (
                  <button onClick={() => { handleRestoreTicket(t.id); setSelectedTicket(null); }} className="btn btn-secondary">Ripristina</button>
                )}
                {t.status === 'closed' && (
                  <button onClick={() => { handleArchiveTicket(t.id); setSelectedTicket(null); }} className="btn btn-secondary"><Archive /> Archivia</button>
                )}
                {t.type === 'request' && isActiveT && (
                  <button onClick={() => { setCheckoutModalTicket(t); setSelectedTicket(null); }} className="btn btn-secondary">Crea prestito</button>
                )}
                {t.status === 'open' && (
                  <button onClick={() => { handleUpdateStatus(t, 'in-progress'); setSelectedTicket(null); }} className="btn btn-secondary">Prendi in carico</button>
                )}
                {isActiveT && (
                  <button onClick={() => { handleUpdateStatus(t, 'closed'); setSelectedTicket(null); }} className="btn btn-primary"><Check /> Segna risolto</button>
                )}
              </>
            ) : undefined}
          >
            <div className="p-5 space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                {statusBadge(t.status)}
                {prioBadge(t.priority)}
              </div>

              <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{t.description}</p>

              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-[13px] border-t border-slate-100 pt-4">
                <div>
                  <dt className="text-xs text-slate-500 mb-1">Richiedente</dt>
                  <dd className="flex items-center gap-2 min-w-0">
                    <Avatar name={requester ? `${requester.firstName || ''} ${requester.lastName || ''}` : undefined} email={requester?.email} size="sm" />
                    <span className="truncate text-slate-900">{requester ? (requester.firstName ? `${requester.firstName} ${requester.lastName || ''}` : requester.email) : 'Sconosciuto'}</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500 mb-1">Aperto il</dt>
                  <dd className="text-slate-900 tabular-nums">{t.createdAt?.toDate?.().toLocaleString('it-IT', { dateStyle: 'medium', timeStyle: 'short' }) || '—'}</dd>
                </div>
                {t.deviceId && (
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-slate-500 mb-1">Dispositivo</dt>
                    <dd className="text-slate-900">{dev?.category || 'Sconosciuto'} <span className="font-mono text-xs text-slate-500">· {dev?.serialNumber || t.deviceId}</span></dd>
                  </div>
                )}
                {t.deviceCategory && (
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-slate-500 mb-1">Dotazione richiesta</dt>
                    <dd className="text-slate-900">{t.deviceCategory}</dd>
                  </div>
                )}
                {isAdminOrTech && t.status !== 'archived' && (
                  <div className="sm:col-span-2">
                    <dt><label htmlFor="assignee" className="text-xs text-slate-500 mb-1 block">Tecnico incaricato</label></dt>
                    <dd>
                      <select
                        id="assignee"
                        value={t.assignedTo || ''}
                        onChange={async (e) => {
                          const newAssignee = e.target.value;
                          if (!newAssignee) return;
                          try {
                            await updateDoc(doc(db, 'tickets', t.id), {
                              assignedTo: newAssignee,
                              assignedBy: currentUser!.uid,
                              status: t.status === 'open' ? 'in-progress' : t.status,
                              updatedAt: serverTimestamp()
                            });
                            await logOperation('update', 'tickets', `Assegnato ticket #${t.id} a ${newAssignee}`, currentUser!.uid, currentUser!.email || '', t.id);
                            setSelectedTicket(prev => prev ? { ...prev, assignedTo: newAssignee, assignedBy: currentUser!.uid, status: t.status === 'open' ? 'in-progress' : t.status } : null);
                          } catch (err) {
                            handleFirestoreError(err, OperationType.UPDATE, `tickets/${t.id}`);
                          }
                        }}
                        className="input"
                      >
                        <option value="">Non assegnato</option>
                        {users.filter(u => u.role === 'admin' || u.role === 'tecnico').map(u => (
                          <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.email})</option>
                        ))}
                      </select>
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </Modal>
        );
      })()}

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

      {checkoutModalTicket && (
        <LoanModal
          isOpen={true}
          preselectedUserId={checkoutModalTicket.userId}
          preselectedType={checkoutModalTicket.consumableId ? 'consumable' : 'device'}
          preselectedDeviceId={checkoutModalTicket.consumableId || checkoutModalTicket.deviceId || undefined}
          onClose={() => setCheckoutModalTicket(null)}
          onSuccess={() => handleUpdateStatus(checkoutModalTicket, 'closed')}
        />
      )}
    </div>
  );
}
