import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, doc, updateDoc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Loan, Device } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { FileSignature, Plus, CheckCircle2, Clock, Laptop, Package, Lock } from 'lucide-react';
import { PageHeader, PageBody, PageLoader, EmptyState, SearchInput, Avatar } from '../components/ui';
import ConfirmDialog from '../components/ConfirmDialog';
import LoanModal from './LoanModal';

export default function Loans() {
  const { userData, currentUser } = useAuth();
  const isAdminOrTech = userData?.role === 'admin' || userData?.role === 'tecnico';
  
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    if (!isAdminOrTech) return;
    const q = query(collection(db, 'loans'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Loan));
      
      const now = new Date();
      const updatedData = data.map(loan => {
        if (loan.status === 'active' && loan.expectedReturnDate) {
          const expected = new Date(loan.expectedReturnDate);
          const diffDays = Math.ceil((expected.getTime() - now.getTime()) / (1000 * 3600 * 24));
          if (diffDays < 0) {
            return { ...loan, status: 'expired' as const };
          } else if (diffDays <= 7) {
            return { ...loan, status: 'expiring' as const };
          }
        }
        return loan;
      });

      updatedData.sort((a, b) => {
        const dateA = a.createdAt?.toMillis?.() || 0;
        const dateB = b.createdAt?.toMillis?.() || 0;
        return dateB - dateA;
      });
      
      setLoans(updatedData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'loans');
      setLoading(false);
    });
    return unsubscribe;
  }, [isAdminOrTech]);

  const handleManualClose = (loan: Loan) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Chiudi Prestito Manualmente',
      message: `Vuoi chiudere anticipatamente il prestito per ${loan.targetDocName || 'questo elemento'}? ${loan.targetType === 'consumable' ? 'La quantità in prestito verrà reintrodotta in magazzino.' : 'Questa azione segnerà il dispositivo come non assegnato.'}`,
      onConfirm: async () => {
        try {
          await updateDoc(doc(db, 'loans', loan.id), {
             status: 'manual_close',
             actualReturnDate: new Date().toISOString(),
             updatedAt: new Date().toISOString()
          });

          if (loan.targetDocId) {
            if (loan.targetType === 'consumable') {
              const cRef = doc(db, 'consumables', loan.targetDocId);
              const cSnap = await getDoc(cRef);
              if (cSnap.exists()) {
                const consumedQty = cSnap.data().consumedQuantity || 0;
                await updateDoc(cRef, {
                  consumedQuantity: Math.max(0, consumedQty - (loan.quantity || 1))
                });
              }
            } else {
              await updateDoc(doc(db, 'devices', loan.targetDocId), {
                assignedToUserId: null,
                assignedToUserEmail: null
              });
            }
          }

          setConfirmDialog(null);
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `loans/${loan.id}`);
          setConfirmDialog(null);
        }
      }
    });
  };

  const filteredLoans = useMemo(() => {
    return loans.filter(l => {
      const matchStatus = statusFilter === 'all' || l.status === statusFilter || 
        (statusFilter === 'active' && (l.status === 'expiring' || l.status === 'expired'));
      
      const term = searchTerm.toLowerCase();
      const matchSearch = 
        (l.targetDocName && l.targetDocName.toLowerCase().includes(term)) ||
        (l.userEmail && l.userEmail.toLowerCase().includes(term)) ||
        (l.notes && l.notes.toLowerCase().includes(term));
      return matchStatus && matchSearch;
    });
  }, [loans, statusFilter, searchTerm]);

  if (!isAdminOrTech) {
    return (
      <PageBody className="pt-10">
        <div className="card">
          <EmptyState icon={<Lock />} title="Accesso riservato" description="Solo amministratori e tecnici possono gestire moduli e prestiti." />
        </div>
      </PageBody>
    );
  }

  if (loading) return <PageLoader />;

  const statusLabels: Record<string, string> = {
    all: 'Tutti',
    active: 'In corso',
    expiring: 'In scadenza',
    expired: 'Scaduti',
    returned: 'Restituiti',
    early_returned: 'Rest. anticipata',
    manual_close: 'Chiusi'
  };

  const isOpen = (l: Loan) => l.status === 'active' || l.status === 'expiring' || l.status === 'expired';
  const counts = {
    all: loans.length,
    active: loans.filter(isOpen).length,
    returned: loans.filter(l => l.status === 'returned' || l.status === 'early_returned').length,
    manual_close: loans.filter(l => l.status === 'manual_close').length,
  };
  const overdue = loans.filter(l => l.status === 'expired').length;
  const fmtDate = (d: any) => (d ? new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

  const StatusBadge = ({ loan }: { loan: Loan }) =>
    loan.status === 'expired' ? <span className="badge badge-dot badge-danger">Scaduto</span>
    : loan.status === 'expiring' ? <span className="badge badge-dot badge-warning">In scadenza</span>
    : loan.status === 'active' ? <span className="badge badge-dot badge-brand">In corso</span>
    : <span className="badge badge-neutral"><CheckCircle2 className="w-3 h-3 text-emerald-600" />{loan.status === 'manual_close' ? 'Chiuso' : 'Restituito'}</span>;

  return (
    <div className="flex flex-col flex-1">
      <PageHeader
        title="Prestiti e moduli"
        description="Consegne, comodati d'uso e scadenze di restituzione."
        actions={
          <div id="onboarding-loans-actions">
            <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">
              <Plus /> Nuovo prestito
            </button>
          </div>
        }
      />

      <PageBody>
        {overdue > 0 && statusFilter !== 'active' && (
          <button onClick={() => setStatusFilter('active')} className="w-full mb-4 flex items-center gap-3 p-3 rounded-xl border border-rose-200 bg-rose-50 text-left hover:bg-rose-100/70 transition-colors">
            <span className="w-8 h-8 rounded-lg bg-white text-rose-600 flex items-center justify-center shrink-0"><Clock className="w-4 h-4" /></span>
            <span className="flex-1 text-[13px] text-rose-800"><span className="font-semibold">{overdue} {overdue === 1 ? 'prestito scaduto' : 'prestiti scaduti'}</span> in attesa di restituzione</span>
            <span className="text-xs font-medium text-rose-700">Mostra</span>
          </button>
        )}

        <div className="card overflow-hidden">
          <div className="p-3 sm:p-4 flex flex-col lg:flex-row lg:items-center gap-3 border-b border-slate-100">
            <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Cerca dipendente, oggetto, note…" className="lg:w-80" />
            <div className="overflow-x-auto -mx-1 px-1">
              <div className="segmented">
                {(['all', 'active', 'returned', 'manual_close'] as const).map((status) => (
                  <button key={status} data-active={statusFilter === status} onClick={() => setStatusFilter(status)} className="flex items-center gap-1.5 whitespace-nowrap">
                    {statusLabels[status]}
                    <span className="text-[11px] text-slate-400 tabular-nums">{counts[status]}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filteredLoans.length === 0 ? (
            <EmptyState
              icon={<FileSignature />}
              title={searchTerm || statusFilter !== 'all' ? 'Nessun risultato' : 'Nessun prestito registrato'}
              description={searchTerm || statusFilter !== 'all' ? 'Prova a modificare la ricerca o il filtro.' : 'Registra la prima consegna di un dispositivo o materiale.'}
            />
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="data-table min-w-[860px]">
                  <thead>
                    <tr>
                      <th>Oggetto</th>
                      <th>Assegnatario</th>
                      <th>Stato</th>
                      <th>Consegna</th>
                      <th>Restituzione</th>
                      <th>Note</th>
                      <th className="w-28"><span className="sr-only">Azioni</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLoans.map((loan) => (
                      <tr key={loan.id}>
                        <td>
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${loan.targetType === 'consumable' ? 'bg-violet-50 text-violet-600' : 'bg-blue-50 text-blue-600'}`}>
                              {loan.targetType === 'consumable' ? <Package className="w-4 h-4" /> : <Laptop className="w-4 h-4" />}
                            </span>
                            <div className="min-w-0">
                              <div className="font-medium text-slate-900 truncate max-w-[240px]">
                                {loan.targetDocName || 'Dispositivo N/D'}
                                {loan.targetType === 'consumable' && loan.quantity ? <span className="ml-1.5 text-xs font-normal text-slate-500 tabular-nums">× {loan.quantity}</span> : null}
                              </div>
                              <div className="text-xs text-slate-500">{loan.type === 'checkout' ? 'Assegnazione definitiva' : 'Prestito temporaneo'}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="flex items-center gap-2 min-w-0">
                            <Avatar email={loan.userEmail} size="sm" />
                            <span className="truncate max-w-[180px]">{loan.userEmail || 'Non specificato'}</span>
                          </span>
                        </td>
                        <td><StatusBadge loan={loan} /></td>
                        <td className="whitespace-nowrap tabular-nums text-slate-600">{fmtDate(loan.checkoutDate)}</td>
                        <td className="whitespace-nowrap tabular-nums">
                          {loan.expectedReturnDate ? (
                            <span className={loan.status === 'expired' ? 'text-rose-600 font-medium' : loan.status === 'expiring' ? 'text-amber-600 font-medium' : 'text-slate-600'}>
                              {fmtDate(loan.expectedReturnDate)}
                            </span>
                          ) : <span className="text-slate-400">Nessuna</span>}
                        </td>
                        <td className="text-slate-500 max-w-[180px] truncate" title={loan.notes}>{loan.notes || '—'}</td>
                        <td className="text-right">
                          {isOpen(loan) && (
                            <button onClick={() => handleManualClose(loan)} className="btn btn-secondary btn-sm" title="Registra restituzione e chiudi">
                              <CheckCircle2 className="!text-emerald-600" /> Chiudi
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul className="md:hidden divide-y divide-slate-100">
                {filteredLoans.map((loan) => (
                  <li key={loan.id} className="p-3 flex items-start gap-3">
                    <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${loan.targetType === 'consumable' ? 'bg-violet-50 text-violet-600' : 'bg-blue-50 text-blue-600'}`}>
                      {loan.targetType === 'consumable' ? <Package className="w-4 h-4" /> : <Laptop className="w-4 h-4" />}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900 truncate">{loan.targetDocName || 'Dispositivo N/D'}</span>
                        <StatusBadge loan={loan} />
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 truncate">{loan.userEmail} · {fmtDate(loan.checkoutDate)}{loan.expectedReturnDate ? ` → ${fmtDate(loan.expectedReturnDate)}` : ''}</div>
                      {isOpen(loan) && (
                        <button onClick={() => handleManualClose(loan)} className="btn btn-secondary btn-sm mt-2"><CheckCircle2 className="!text-emerald-600" /> Chiudi</button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="px-4 py-2.5 border-t border-slate-100 text-xs text-slate-500 bg-slate-50/50">
            <span className="tabular-nums font-medium text-slate-700">{filteredLoans.length}</span> registrazioni
          </div>
        </div>
      </PageBody>

      {/* Loan Modal */}
      {isModalOpen && (
        <LoanModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
}
