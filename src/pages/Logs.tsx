import React, { useEffect, useState, useMemo } from 'react';
import { collection, query, onSnapshot, doc, deleteDoc, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { SystemLog } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Download, FileSpreadsheet, FileText, Search, Trash2, Wrench } from 'lucide-react';
import { PageHeader, PageBody, PageLoader, EmptyState, SearchInput, DropdownMenu } from '../components/ui';
import { logOperation } from '../lib/logger';
import ConfirmDialog from '../components/ConfirmDialog';
import { 
  exportSystemLogsToCsv, 
  exportSystemLogsToPdf, 
  exportMaintenanceLogsToCsv, 
  exportMaintenanceLogsToPdf,
  MaintenanceExportItem 
} from '../lib/exportUtils';

export default function Logs() {
  const { userData, currentUser } = useAuth();
  const isAdmin = userData?.role === 'admin';
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [collectionFilter, setCollectionFilter] = useState('all');

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    requireString?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    if (!isAdmin) return;

    const q = query(collection(db, 'logs'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SystemLog)));
      setLoading(false);
    }, error => handleFirestoreError(error, OperationType.LIST, 'logs'));

    return unsubscribe;
  }, [isAdmin]);

  const uniqueActions = useMemo(() => Array.from(new Set(logs.map(l => l.action).filter(Boolean))), [logs]);
  const uniqueCollections = useMemo(() => Array.from(new Set(logs.map(l => l.collection).filter(Boolean))), [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchAction = actionFilter === 'all' || log.action === actionFilter;
      const matchCollection = collectionFilter === 'all' || log.collection === collectionFilter;
      const searchLower = searchTerm.toLowerCase();
      const matchSearch = searchTerm === '' || 
        log.description?.toLowerCase().includes(searchLower) ||
        log.userEmail?.toLowerCase().includes(searchLower) ||
        log.action?.toLowerCase().includes(searchLower) ||
        log.collection?.toLowerCase().includes(searchLower);
      
      return matchAction && matchCollection && matchSearch;
    });
  }, [logs, actionFilter, collectionFilter, searchTerm]);

  const handleExportCsv = () => {
    if (actionFilter === 'maintenance') {
      const items: MaintenanceExportItem[] = filteredLogs.map(l => ({
        id: l.id,
        date: l.createdAt,
        category: l.collection,
        serialNumber: l.targetId || '-',
        action: l.action,
        operator: l.userEmail,
        notes: l.description,
        deviceId: l.targetId
      }));
      exportMaintenanceLogsToCsv(items);
    } else {
      exportSystemLogsToCsv(filteredLogs);
    }
  };

  const handleExportPdf = () => {
    if (actionFilter === 'maintenance') {
      const items: MaintenanceExportItem[] = filteredLogs.map(l => ({
        id: l.id,
        date: l.createdAt,
        category: l.collection,
        serialNumber: l.targetId || '-',
        action: l.action,
        operator: l.userEmail,
        notes: l.description,
        deviceId: l.targetId
      }));
      exportMaintenanceLogsToPdf(items, 'Registro Interventi di Manutenzione');
    } else {
      exportSystemLogsToPdf(filteredLogs, 'Log di Sistema & Audit IT');
    }
  };

  const handleDeleteLog = (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Elimina Log',
      message: 'Sei sicuro di voler eliminare questo log?',
      isDestructive: true,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'logs', id));
          setConfirmDialog(null);
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `logs/${id}`);
          setConfirmDialog(null);
        }
      }
    });
  };

  const handleClearLogs = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'Svuota Log',
      message: 'Questa operazione eliminerà TUTTI i log.',
      requireString: 'CANCELLA',
      isDestructive: true,
      onConfirm: async () => {
        try {
          const logsToDelete = logs.slice(0, 500);
          for (const log of logsToDelete) {
            await deleteDoc(doc(db, 'logs', log.id));
          }
          await logOperation('delete', 'system', `Svuotamento log (eliminati ${logsToDelete.length} record)`, currentUser!.uid, currentUser!.email || '');
          setConfirmDialog(null);
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, 'logs');
          setConfirmDialog(null);
        }
      }
    });
  };

  if (!isAdmin) return <PageBody className="pt-10"><div className="card"><EmptyState title="Accesso riservato" description="Solo gli amministratori possono consultare i log di audit." /></div></PageBody>;
  if (loading) return <PageLoader />;

  const actionTone: Record<string, string> = {
    create: 'badge-success', update: 'badge-brand', delete: 'badge-danger', assign: 'badge-info',
    withdraw: 'badge-warning', maintenance: 'badge-warning', login: 'badge-neutral',
  };
  const ACTION_LABEL: Record<string, string> = {
    create: 'Creazione', update: 'Modifica', delete: 'Eliminazione', assign: 'Assegnazione',
    withdraw: 'Prelievo', maintenance: 'Manutenzione', login: 'Accesso',
  };
  const fmt = (log: any) => (log.createdAt?.toDate ? log.createdAt.toDate().toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' }) : '—');

  return (
    <div className="flex flex-col flex-1">
      <PageHeader
        title="Log di audit"
        description="Tracciamento delle operazioni e registro manutenzioni."
        actions={logs.length > 0 && (
          <>
            <DropdownMenu
              trigger={<><Download /> Esporta</>}
              items={[
                { label: 'CSV', description: 'Log filtrati', icon: <FileSpreadsheet />, onClick: handleExportCsv },
                { label: 'PDF', description: 'Log filtrati', icon: <FileText />, onClick: handleExportPdf },
              ]}
            />
            <button onClick={handleClearLogs} className="btn btn-danger-soft">
              <Trash2 /> <span className="hidden sm:inline">Svuota log</span>
            </button>
          </>
        )}
      />

      <PageBody>
        <div className="card overflow-hidden">
          <div className="p-3 sm:p-4 flex flex-col lg:flex-row gap-2 border-b border-slate-100">
            <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Cerca per descrizione, utente, azione…" className="lg:w-80" />
            <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="select" aria-label="Azione">
              <option value="all">Tutte le azioni</option>
              {uniqueActions.map(a => <option key={a} value={a}>{ACTION_LABEL[a] || a}</option>)}
            </select>
            <select value={collectionFilter} onChange={(e) => setCollectionFilter(e.target.value)} className="select" aria-label="Sezione">
              <option value="all">Tutte le sezioni</option>
              {uniqueCollections.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button
              onClick={() => setActionFilter(actionFilter === 'maintenance' ? 'all' : 'maintenance')}
              className={`btn ${actionFilter === 'maintenance' ? 'btn-soft' : 'btn-ghost'} lg:ml-auto`}
              aria-pressed={actionFilter === 'maintenance'}
            >
              <Wrench /> Solo manutenzioni
            </button>
          </div>

          {filteredLogs.length === 0 ? (
            <EmptyState icon={<Search />} title="Nessun log trovato" description="Nessuna voce corrisponde ai filtri correnti." />
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="w-40">Data</th>
                      <th className="w-44">Azione</th>
                      <th>Descrizione</th>
                      <th>Utente</th>
                      <th className="w-12"><span className="sr-only">Azioni</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((log) => (
                      <tr key={log.id} className="group">
                        <td className="whitespace-nowrap tabular-nums text-slate-500">{fmt(log)}</td>
                        <td className="whitespace-nowrap">
                          <span className={`badge ${actionTone[log.action] || 'badge-neutral'}`}>{ACTION_LABEL[log.action] || log.action}</span>
                          <span className="ml-2 text-xs text-slate-400">{log.collection}</span>
                        </td>
                        <td className="max-w-md truncate" title={log.description}>{log.description}</td>
                        <td className="whitespace-nowrap text-slate-600">{log.userEmail}</td>
                        <td className="text-right">
                          <button onClick={() => handleDeleteLog(log.id)} className="icon-btn opacity-0 group-hover:opacity-100 focus:opacity-100 hover:!text-rose-600 hover:!bg-rose-50" title="Elimina voce" aria-label="Elimina voce">
                            <Trash2 />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="md:hidden divide-y divide-slate-100">
                {filteredLogs.map((log) => (
                  <li key={`mob-${log.id}`} className="p-3 flex gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`badge ${actionTone[log.action] || 'badge-neutral'}`}>{ACTION_LABEL[log.action] || log.action}</span>
                        <span className="text-xs text-slate-400 tabular-nums">{fmt(log)}</span>
                      </div>
                      <p className="text-[13px] text-slate-800">{log.description}</p>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{log.userEmail}</p>
                    </div>
                    <button onClick={() => handleDeleteLog(log.id)} className="icon-btn shrink-0" aria-label="Elimina voce"><Trash2 /></button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="px-4 py-2.5 border-t border-slate-100 text-xs text-slate-500 bg-slate-50/50">
            <span className="tabular-nums font-medium text-slate-700">{filteredLogs.length}</span> voci
          </div>
        </div>
      </PageBody>

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
