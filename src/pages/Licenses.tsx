import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { License } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Key, Plus, Trash2, Edit2, Lock, Copy, Check, Monitor } from 'lucide-react';
import { PageHeader, PageBody, PageLoader, EmptyState, SearchInput, Avatar } from '../components/ui';
import { logOperation } from '../lib/logger';
import ConfirmDialog from '../components/ConfirmDialog';
import LicenseModal from './LicenseModal';

export default function Licenses() {
  const { userData, currentUser } = useAuth();
  const isAdminOrTech = userData?.role === 'admin' || userData?.role === 'tecnico';
  
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [copied, setCopied] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editLicense, setEditLicense] = useState<License | undefined>(undefined);
  
  const [selectedLicenses, setSelectedLicenses] = useState<Set<string>>(new Set());
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    if (!isAdminOrTech) return;
    const q = query(collection(db, 'licenses'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as License));
      setLicenses(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'licenses');
      setLoading(false);
    });
    return unsubscribe;
  }, [isAdminOrTech]);

  const handleDelete = (licenseId: string) => {
    const license = licenses.find(l => l.id === licenseId);
    setConfirmDialog({
      isOpen: true,
      title: 'Elimina Licenza',
      message: `Sei sicuro di voler eliminare la licenza per ${license?.softwareName}? L'operazione è irreversibile.`,
      isDestructive: true,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'licenses', licenseId));
          if (license) {
            await logOperation('delete', 'system', `Eliminata licenza: ${license.softwareName}`, currentUser!.uid, currentUser!.email || '');
          }
          setConfirmDialog(null);
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `licenses/${licenseId}`);
          setConfirmDialog(null);
        }
      }
    });
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedLicenses);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedLicenses(newSet);
  };

  const handleBulkDelete = () => {
    if (!isAdminOrTech || selectedLicenses.size === 0) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Elimina Selezionati',
      message: `Vuoi eliminare definitivamente ${selectedLicenses.size} licenze selezionate? L'operazione è irreversibile.`,
      isDestructive: true,
      onConfirm: async () => {
        try {
          const promises = Array.from(selectedLicenses).map((id: string) => deleteDoc(doc(db, 'licenses', id)));
          await Promise.all(promises);
          await logOperation('delete', 'system', `Eliminate ${selectedLicenses.size} licenze in blocco`, currentUser!.uid, currentUser!.email || '');
          setSelectedLicenses(new Set());
          setConfirmDialog(null);
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, 'licenses');
          setConfirmDialog(null);
        }
      }
    });
  };

  const filteredLicenses = useMemo(() => {
    return licenses.filter(l => {
      const matchStatus = statusFilter === 'all' || l.status === statusFilter;
      const term = searchTerm.toLowerCase();
      const matchSearch = l.softwareName.toLowerCase().includes(term) ||
        l.licenseKey.toLowerCase().includes(term) ||
        (l.assignedToUserEmail && l.assignedToUserEmail.toLowerCase().includes(term)) ||
        (l.assignedToDeviceName && l.assignedToDeviceName.toLowerCase().includes(term));
      return matchStatus && matchSearch;
    });
  }, [licenses, statusFilter, searchTerm]);

  if (!isAdminOrTech) {
    return (
      <PageBody className="pt-10">
        <div className="card">
          <EmptyState icon={<Lock />} title="Accesso riservato" description="Solo amministratori e tecnici possono consultare le licenze software." />
        </div>
      </PageBody>
    );
  }

  if (loading) return <PageLoader />;

  const statusBadge: Record<string, string> = {
    active: 'badge-success',
    available: 'badge-brand',
    expired: 'badge-danger',
    revoked: 'badge-neutral',
  };

  const statusLabels: Record<string, string> = {
    active: 'Attiva',
    available: 'Disponibile',
    expired: 'Scaduta',
    revoked: 'Revocata'
  };

  const counts: Record<string, number> = { all: licenses.length };
  licenses.forEach(l => { counts[l.status] = (counts[l.status] || 0) + 1; });

  const daysTo = (iso?: string) => {
    if (!iso) return null;
    const d = new Date(iso).getTime();
    if (isNaN(d)) return null;
    return Math.ceil((d - Date.now()) / 86400000);
  };

  const maskKey = (k: string) => (k.length <= 8 ? k : `${k.slice(0, 4)}••••${k.slice(-4)}`);
  const copyKey = async (k: string) => {
    try { await navigator.clipboard.writeText(k); setCopied(k); setTimeout(() => setCopied(null), 1500); } catch { /* ignore */ }
  };

  return (
    <div className="flex flex-col flex-1">
      <PageHeader
        title="Licenze software"
        description="Chiavi, assegnazioni e scadenze delle licenze aziendali."
        actions={
          <>
            {userData?.role === 'admin' && selectedLicenses.size > 0 && (
              <button onClick={handleBulkDelete} className="btn btn-danger-soft">
                <Trash2 /> Elimina ({selectedLicenses.size})
              </button>
            )}
            <button onClick={() => { setEditLicense(undefined); setIsModalOpen(true); }} className="btn btn-primary">
              <Plus /> Nuova licenza
            </button>
          </>
        }
      />

      <PageBody>
        <div className="card overflow-hidden">
          <div className="p-3 sm:p-4 flex flex-col lg:flex-row lg:items-center gap-3 border-b border-slate-100">
            <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Cerca software, chiave, utente…" className="lg:w-80" />
            <div className="overflow-x-auto -mx-1 px-1">
              <div className="segmented">
                {['all', 'available', 'active', 'expired', 'revoked'].map((status) => (
                  <button key={status} data-active={statusFilter === status} onClick={() => setStatusFilter(status)} className="flex items-center gap-1.5 whitespace-nowrap">
                    {status === 'all' ? 'Tutte' : statusLabels[status]}
                    <span className="text-[11px] text-slate-400 tabular-nums">{counts[status] || 0}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filteredLicenses.length === 0 ? (
            <EmptyState
              icon={<Key />}
              title={licenses.length ? 'Nessuna licenza trovata' : 'Nessuna licenza registrata'}
              description={licenses.length ? 'Prova a modificare la ricerca o il filtro.' : 'Aggiungi la prima licenza per tenerne traccia.'}
              action={!licenses.length && <button onClick={() => { setEditLicense(undefined); setIsModalOpen(true); }} className="btn btn-primary btn-sm"><Plus /> Nuova licenza</button>}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table min-w-[820px]">
                <thead>
                  <tr>
                    <th className="w-10 !pr-0">
                      <input
                        type="checkbox"
                        aria-label="Seleziona tutte"
                        className="w-4 h-4 rounded"
                        checked={filteredLicenses.length > 0 && selectedLicenses.size === filteredLicenses.length}
                        onChange={(e) => setSelectedLicenses(e.target.checked ? new Set(filteredLicenses.map(l => l.id)) : new Set())}
                      />
                    </th>
                    <th>Software</th>
                    <th>Chiave</th>
                    <th>Stato</th>
                    <th>Assegnata a</th>
                    <th>Scadenza</th>
                    <th className="w-24"><span className="sr-only">Azioni</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLicenses.map((license) => {
                    const d = daysTo(license.expiryDate);
                    const soon = d !== null && d >= 0 && d <= 30 && license.status !== 'expired';
                    return (
                      <tr key={license.id} className={selectedLicenses.has(license.id) ? '!bg-blue-50/50' : ''}>
                        <td className="!pr-0">
                          <input type="checkbox" className="w-4 h-4 rounded" checked={selectedLicenses.has(license.id)} onChange={() => toggleSelection(license.id)} aria-label={`Seleziona ${license.softwareName}`} />
                        </td>
                        <td className="font-medium text-slate-900">{license.softwareName}</td>
                        <td>
                          <button onClick={() => copyKey(license.licenseKey)} className="group inline-flex items-center gap-1.5 font-mono text-xs text-slate-600 hover:text-slate-900" title="Copia chiave">
                            {maskKey(license.licenseKey)}
                            {copied === license.licenseKey ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500" />}
                          </button>
                        </td>
                        <td><span className={`badge badge-dot ${statusBadge[license.status]}`}>{statusLabels[license.status]}</span></td>
                        <td>
                          <div className="flex flex-col gap-1">
                            {license.assignedToUserEmail && (
                              <span className="flex items-center gap-2"><Avatar email={license.assignedToUserEmail} size="sm" /><span className="truncate">{license.assignedToUserEmail.split('@')[0]}</span></span>
                            )}
                            {license.assignedToDeviceName && (
                              <span className="flex items-center gap-1.5 text-xs text-slate-500"><Monitor className="w-3.5 h-3.5" />{license.assignedToDeviceName}</span>
                            )}
                            {!license.assignedToDeviceName && !license.assignedToUserEmail && <span className="text-slate-400">—</span>}
                          </div>
                        </td>
                        <td className="whitespace-nowrap">
                          {license.expiryDate ? (
                            <div>
                              <div className="tabular-nums">{new Date(license.expiryDate).toLocaleDateString('it-IT')}</div>
                              {soon && <div className="text-xs text-amber-600 font-medium">tra {d} {d === 1 ? 'giorno' : 'giorni'}</div>}
                              {d !== null && d < 0 && <div className="text-xs text-rose-600">scaduta</div>}
                            </div>
                          ) : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end">
                            <button onClick={() => { setEditLicense(license); setIsModalOpen(true); }} className="icon-btn" title="Modifica" aria-label="Modifica"><Edit2 /></button>
                            {userData?.role === 'admin' && (
                              <button onClick={() => handleDelete(license.id)} className="icon-btn hover:!text-rose-600 hover:!bg-rose-50" title="Elimina" aria-label="Elimina"><Trash2 /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="px-4 py-2.5 border-t border-slate-100 text-xs text-slate-500 bg-slate-50/50">
            <span className="tabular-nums font-medium text-slate-700">{filteredLicenses.length}</span> licenze
          </div>
        </div>
      </PageBody>

      {isModalOpen && (
        <LicenseModal
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); setEditLicense(undefined); }}
          licenseToEdit={editLicense}
        />
      )}

      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          isDestructive={confirmDialog.isDestructive}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
}
