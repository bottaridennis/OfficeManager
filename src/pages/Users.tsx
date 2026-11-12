import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { User, Role, UserStatus } from '../types';
import { Check, X, UserPlus, Edit2, Link, Search, Trash2 } from 'lucide-react';
import { PageHeader, PageBody, PageLoader, EmptyState, SearchInput, Avatar, Modal } from '../components/ui';
import UserCreationModal from '../components/UserCreationModal';
import UserEditModal from '../components/UserEditModal';
import ConfirmDialog from '../components/ConfirmDialog';
import { useNavigate } from 'react-router-dom';
import { logOperation } from '../lib/logger';
import { useAuth } from '../contexts/AuthContext';

export default function Users() {
  const { currentUser, userData } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<UserStatus | 'all'>('all');

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const navigate = useNavigate();

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    requireString?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
      setUsers(usersData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users');
    });

    return unsubscribe;
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchRole = roleFilter === 'all' || user.role === roleFilter;
      const matchStatus = statusFilter === 'all' || user.status === statusFilter;
      const searchLower = searchTerm.toLowerCase();
      const matchSearch = searchTerm === '' || 
        user.firstName?.toLowerCase().includes(searchLower) ||
        user.lastName?.toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower);
      return matchRole && matchStatus && matchSearch;
    });
  }, [users, roleFilter, statusFilter, searchTerm]);

  const handleUpdateStatus = async (userId: string, newStatus: UserStatus) => {
    try {
      await updateDoc(doc(db, 'users', userId), { status: newStatus });
      const u = users.find(u => u.id === userId);
      await logOperation('update', 'users', `Aggiornato stato utente ${u?.email} a ${newStatus}`, currentUser!.uid, currentUser!.email || '', userId);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: Role) => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      const u = users.find(u => u.id === userId);
      await logOperation('update', 'users', `Aggiornato ruolo utente ${u?.email} a ${newRole}`, currentUser!.uid, currentUser!.email || '', userId);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (userData?.role !== 'admin') return;
    setConfirmDialog({
      isOpen: true,
      title: 'Elimina Utente',
      message: `Attenzione: eliminare l'utente eliminerà solo il record locale, non il suo account Firebase Auth. Vuoi continuare?`,
      requireString: 'ELIMINA',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'users', userId));
          await logOperation('delete', 'users', `Eliminato utente ${userId}`, currentUser!.uid, currentUser!.email || '');
          setConfirmDialog(null);
          setSelectedUser(null);
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `users/${userId}`);
        }
      }
    });
  };

  const handleBulkDelete = () => {
    if (userData?.role !== 'admin' || selectedUsers.size === 0) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Elimina Selezionati',
      message: `Vuoi eliminare definitivamente ${selectedUsers.size} utenti selezionati? L'operazione è irreversibile.`,
      requireString: 'ELIMINA',
      isDestructive: true,
      onConfirm: async () => {
        try {
          const promises = Array.from(selectedUsers).map((id: string) => deleteDoc(doc(db, 'users', id)));
          await Promise.all(promises);
          await logOperation('delete', 'users', `Eliminati ${selectedUsers.size} utenti in blocco`, currentUser!.uid, currentUser!.email || '');
          setSelectedUsers(new Set());
          setConfirmDialog(null);
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `users`);
          setConfirmDialog(null);
        }
      }
    });
  };

  const toggleSelection = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newSet = new Set(selectedUsers);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedUsers(newSet);
  };

  if (loading) return <PageLoader />;

  const ROLE_LABEL: Record<string, string> = { admin: 'Amministratore', tecnico: 'Tecnico', utente: 'Utente' };
  const STATUS: Record<string, [string, string]> = {
    approved: ['Attivo', 'badge-success'],
    pending: ['In attesa', 'badge-warning'],
    inactive: ['Disattivato', 'badge-neutral'],
    rejected: ['Rifiutato', 'badge-danger'],
  };
  const pendingCount = users.filter(u => u.status === 'pending').length;
  const fullName = (u: User) => (u.firstName || u.lastName ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : u.email.split('@')[0]);
  const isAdmin = userData?.role === 'admin';

  return (
    <div className="flex flex-col flex-1">
      <PageHeader
        title="Utenti"
        description="Account, ruoli e approvazioni di accesso."
        actions={isAdmin && (
          <>
            {selectedUsers.size > 0 && (
              <button onClick={handleBulkDelete} className="btn btn-danger-soft">
                <Trash2 /> Elimina ({selectedUsers.size})
              </button>
            )}
            <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">
              <UserPlus /> Nuovo utente
            </button>
          </>
        )}
      />

      <PageBody>
        {pendingCount > 0 && statusFilter !== 'pending' && (
          <button onClick={() => setStatusFilter('pending')} className="w-full mb-4 flex items-center gap-3 p-3 rounded-xl border border-amber-200 bg-amber-50 text-left hover:bg-amber-100/70 transition-colors">
            <span className="w-8 h-8 rounded-lg bg-white text-amber-600 flex items-center justify-center shrink-0"><UserPlus className="w-4 h-4" /></span>
            <span className="flex-1 text-[13px] text-amber-900"><span className="font-semibold">{pendingCount} {pendingCount === 1 ? 'richiesta' : 'richieste'} di accesso</span> in attesa di approvazione</span>
            <span className="text-xs font-medium text-amber-800">Rivedi</span>
          </button>
        )}

        <div className="card overflow-hidden">
          <div className="p-3 sm:p-4 flex flex-col sm:flex-row gap-2 border-b border-slate-100">
            <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Cerca per nome o email…" className="sm:w-80" />
            <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as any)} className="select" aria-label="Ruolo">
              <option value="all">Tutti i ruoli</option>
              <option value="admin">Amministratori</option>
              <option value="tecnico">Tecnici</option>
              <option value="utente">Utenti</option>
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className="select" aria-label="Stato">
              <option value="all">Tutti gli stati</option>
              <option value="approved">Attivi</option>
              <option value="pending">In attesa</option>
              <option value="inactive">Disattivati</option>
              <option value="rejected">Rifiutati</option>
            </select>
          </div>

          {filteredUsers.length === 0 ? (
            <EmptyState
              icon={<Search />}
              title="Nessun utente trovato"
              description={searchTerm || statusFilter !== 'all' || roleFilter !== 'all' ? 'Nessun utente corrisponde ai filtri correnti.' : undefined}
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {filteredUsers.map((user) => {
                const [stLabel, stCls] = STATUS[user.status] || ['—', 'badge-neutral'];
                return (
                  <li
                    key={user.id}
                    onClick={() => setSelectedUser(user)}
                    onKeyDown={(e) => e.key === 'Enter' && setSelectedUser(user)}
                    tabIndex={0}
                    role="button"
                    className={`flex items-center gap-3 px-3 sm:px-4 py-3 cursor-pointer transition-colors outline-none focus-visible:bg-slate-50 ${selectedUsers.has(user.id) ? 'bg-blue-50/50' : 'hover:bg-slate-50/80'}`}
                  >
                    {isAdmin && (
                      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedUsers.has(user.id)} onChange={(e) => toggleSelection(e, user.id)} className="w-4 h-4 rounded" aria-label={`Seleziona ${user.email}`} />
                      </div>
                    )}
                    {user.photoUrl
                      ? <img src={user.photoUrl} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
                      : <Avatar name={fullName(user)} email={user.email} className="w-9 h-9" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-slate-900 truncate">{fullName(user)}</div>
                      <div className="text-xs text-slate-500 truncate">{user.email}</div>
                    </div>
                    <span className="hidden md:inline text-xs text-slate-600 w-28">{ROLE_LABEL[user.role] || user.role}</span>
                    {user.mustChangePassword && <span className="hidden lg:inline-flex badge badge-info">Cambio password</span>}
                    <div className="shrink-0 sm:w-[190px] flex justify-end" onClick={(e) => user.status === 'pending' && isAdmin && e.stopPropagation()}>
                    {isAdmin && user.status === 'pending' ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleUpdateStatus(user.id, 'rejected')} className="btn btn-ghost btn-sm" aria-label="Rifiuta"><X /> <span className="hidden sm:inline">Rifiuta</span></button>
                        <button onClick={() => handleUpdateStatus(user.id, 'approved')} className="btn btn-primary btn-sm" aria-label="Approva"><Check /> <span className="hidden sm:inline">Approva</span></button>
                      </div>
                    ) : (
                      <span className={`badge badge-dot ${stCls}`}>{stLabel}</span>
                    )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="px-4 py-2.5 border-t border-slate-100 text-xs text-slate-500 bg-slate-50/50">
            <span className="tabular-nums font-medium text-slate-700">{filteredUsers.length}</span> utenti
          </div>
        </div>
      </PageBody>

      {selectedUser && (
        <Modal
          onClose={() => setSelectedUser(null)}
          title="Dettagli utente"
          footer={isAdmin ? (
            <>
              <button onClick={() => handleDeleteUser(selectedUser.id)} className="btn btn-ghost !text-rose-600 hover:!bg-rose-50 sm:mr-auto"><Trash2 /> Elimina</button>
              <button onClick={() => { setEditingUser(selectedUser); setSelectedUser(null); }} className="btn btn-secondary"><Edit2 /> Modifica</button>
              <button onClick={() => navigate(`/users/${selectedUser.id}`)} className="btn btn-primary"><Link /> Dotazioni</button>
            </>
          ) : (
            <button onClick={() => navigate(`/users/${selectedUser.id}`)} className="btn btn-primary"><Link /> Dotazioni</button>
          )}
        >
          <div className="p-5 space-y-6">
            <div className="flex items-center gap-4">
              {selectedUser.photoUrl
                ? <img src={selectedUser.photoUrl} alt="" className="w-14 h-14 rounded-full object-cover" />
                : <Avatar name={fullName(selectedUser)} email={selectedUser.email} className="w-14 h-14 text-lg" />}
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-slate-900 tracking-tight truncate">{fullName(selectedUser)}</h3>
                <p className="text-[13px] text-slate-500 truncate">{selectedUser.email}</p>
                <div className="mt-1.5"><span className={`badge badge-dot ${(STATUS[selectedUser.status] || ['', 'badge-neutral'])[1]}`}>{(STATUS[selectedUser.status] || ['—'])[0]}</span></div>
              </div>
            </div>

            {isAdmin && (
              <>
                <div>
                  <div className="field-label">Ruolo</div>
                  <div className="segmented w-full">
                    {(['utente', 'tecnico', 'admin'] as Role[]).map((r) => (
                      <button
                        key={r}
                        className="flex-1"
                        data-active={selectedUser.role === r}
                        onClick={() => { handleUpdateRole(selectedUser.id, r); setSelectedUser({ ...selectedUser, role: r }); }}
                      >
                        {ROLE_LABEL[r]}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="field-label">Accesso</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedUser.status === 'pending' && (
                      <>
                        <button onClick={() => { handleUpdateStatus(selectedUser.id, 'approved'); setSelectedUser({ ...selectedUser, status: 'approved' }); }} className="btn btn-primary btn-sm"><Check /> Approva</button>
                        <button onClick={() => { handleUpdateStatus(selectedUser.id, 'rejected'); setSelectedUser({ ...selectedUser, status: 'rejected' }); }} className="btn btn-secondary btn-sm"><X /> Rifiuta</button>
                      </>
                    )}
                    {selectedUser.status === 'approved' && (
                      <button onClick={() => { handleUpdateStatus(selectedUser.id, 'inactive'); setSelectedUser({ ...selectedUser, status: 'inactive' }); }} className="btn btn-secondary btn-sm">Disattiva account</button>
                    )}
                    {(selectedUser.status === 'inactive' || selectedUser.status === 'rejected') && (
                      <button onClick={() => { handleUpdateStatus(selectedUser.id, 'approved'); setSelectedUser({ ...selectedUser, status: 'approved' }); }} className="btn btn-secondary btn-sm"><Check /> Riattiva</button>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {isModalOpen && <UserCreationModal onClose={() => setIsModalOpen(false)} />}
      {editingUser && <UserEditModal user={editingUser} onClose={() => setEditingUser(null)} />}
      
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
    </div>
  );
}
