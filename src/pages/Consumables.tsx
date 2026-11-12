import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, onSnapshot, doc, deleteDoc, updateDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Consumable } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Trash2, Edit2, Package, Save, X, Search, Filter, Upload, UserCheck, AlertTriangle, ArrowUpRight } from 'lucide-react';
import { logOperation } from '../lib/logger';
import ConfirmDialog from '../components/ConfirmDialog';
import CsvImportModal from '../components/CsvImportModal';
import LoanModal from './LoanModal';
import { PageHeader, PageBody, PageLoader, SearchInput, EmptyState, Modal } from '../components/ui';

export default function Consumables() {
  const { userData, currentUser } = useAuth();
  const isAdminOrTech = userData?.role === 'admin' || userData?.role === 'tecnico';
  
  const [consumables, setConsumables] = useState<Consumable[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Consumable>>({});

  const [showImportCsv, setShowImportCsv] = useState(false);
  const [assignmentModalConsumable, setAssignmentModalConsumable] = useState<Consumable | null>(null);

  const [selectedConsumables, setSelectedConsumables] = useState<Set<string>>(new Set());
  const [restockId, setRestockId] = useState<string | null>(null);
  const [restockQuantity, setRestockQuantity] = useState<number>(0);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    isDestructive?: boolean;
    requireString?: string;
    onConfirm: () => void;
  } | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'consumables'));
    const unsub = onSnapshot(q, (snapshot) => {
      setConsumables(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Consumable)));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'consumables'));
    return () => unsub();
  }, []);

  const uniqueCategories = useMemo(() => Array.from(new Set(consumables.map(c => c.category).filter(Boolean))), [consumables]);

  const filteredConsumables = useMemo(() => {
    return consumables.filter(c => {
      const matchCategory = categoryFilter === 'all' || c.category === categoryFilter;
      const searchLower = searchTerm.toLowerCase();
      const matchSearch = searchTerm === '' || 
        c.name.toLowerCase().includes(searchLower) ||
        c.category.toLowerCase().includes(searchLower);
      return matchCategory && matchSearch;
    });
  }, [consumables, categoryFilter, searchTerm]);

  const handleSave = async () => {
    try {
      if (isAdding) {
        const newRef = doc(collection(db, 'consumables'));
        await setDoc(newRef, {
          name: formData.name || '',
          category: formData.category || '',
          totalQuantity: Number(formData.totalQuantity || 0),
          consumedQuantity: Number(formData.consumedQuantity || 0),
          unit: formData.unit || 'pz',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        await logOperation('create', 'consumables', `Aggiunto consumabile: ${formData.name}`, currentUser!.uid, currentUser!.email || '', newRef.id);
      } else if (editingId) {
        await updateDoc(doc(db, 'consumables', editingId), {
          name: formData.name,
          category: formData.category,
          totalQuantity: Number(formData.totalQuantity || 0),
          consumedQuantity: Number(formData.consumedQuantity || 0),
          unit: formData.unit,
          updatedAt: serverTimestamp()
        });
        await logOperation('update', 'consumables', `Modificato consumabile: ${formData.name}`, currentUser!.uid, currentUser!.email || '', editingId);
      }
      setIsAdding(false);
      setEditingId(null);
      setFormData({});
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'consumables');
    }
  };

  const handleDelete = (id: string) => {
    const c = consumables.find(cons => cons.id === id);
    setConfirmDialog({
      isOpen: true,
      title: 'Elimina Consumabile',
      message: `Sei sicuro di voler eliminare definitivamente "${c?.name}"? L'operazione non può essere annullata. Digita il nome per confermare.`,
      requireString: c?.name,
      isDestructive: true,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'consumables', id));
          await logOperation('delete', 'consumables', `Eliminato consumabile: ${c?.name}`, currentUser!.uid, currentUser!.email || '');
          setConfirmDialog(null);
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `consumables/${id}`);
          setConfirmDialog(null);
        }
      }
    });
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedConsumables);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedConsumables(newSet);
  };

  const handleBulkDelete = () => {
    if (userData?.role !== 'admin' || selectedConsumables.size === 0) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Elimina Selezionati',
      message: `Vuoi eliminare definitivamente ${selectedConsumables.size} consumabili selezionati?`,
      requireString: 'ELIMINA',
      isDestructive: true,
      onConfirm: async () => {
        try {
          const promises = Array.from(selectedConsumables).map((id: string) => deleteDoc(doc(db, 'consumables', id)));
          await Promise.all(promises);
          await logOperation('delete', 'consumables', `Eliminati ${selectedConsumables.size} consumabili in blocco`, currentUser!.uid, currentUser!.email || '');
          setSelectedConsumables(new Set());
          setConfirmDialog(null);
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `consumables`);
          setConfirmDialog(null);
        }
      }
    });
  };

  const handleRestockSave = async () => {
    if (!restockId || restockQuantity <= 0) return;
    const c = consumables.find(cons => cons.id === restockId);
    if (!c) return;

    try {
      await updateDoc(doc(db, 'consumables', restockId), {
        totalQuantity: c.totalQuantity + restockQuantity,
        updatedAt: serverTimestamp()
      });
      await logOperation('update', 'consumables', `Rifornimento: aggiunti ${restockQuantity} ${c.unit} a ${c.name}`, currentUser!.uid, currentUser!.email || '');
      setRestockId(null);
      setRestockQuantity(0);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `consumables/${restockId}`);
    }
  };

  const currentStock = (c: Consumable) => Math.max(0, c.totalQuantity - c.consumedQuantity);

  if (loading) return <PageLoader />;

  const hasFilters = searchTerm !== '' || categoryFilter !== 'all';

  return (
    <div className="flex flex-col flex-1">
      <PageHeader
        title="Consumabili"
        description="Scorte di cancelleria, toner, cavi e materiale d'uso."
        actions={isAdminOrTech && !isAdding && !editingId && (
          <div id="onboarding-consumables-actions" className="flex items-center gap-2 flex-wrap">
            {userData?.role === 'admin' && selectedConsumables.size > 0 && (
              <button onClick={handleBulkDelete} className="btn btn-danger-soft">
                <Trash2 /> Elimina ({selectedConsumables.size})
              </button>
            )}
            <button onClick={() => setShowImportCsv(true)} className="btn btn-secondary">
              <Upload /> <span className="hidden sm:inline">Importa CSV</span>
            </button>
            <button
              onClick={() => { setIsAdding(true); setFormData({ totalQuantity: 0, consumedQuantity: 0, unit: 'pz' }); }}
              className="btn btn-primary"
            >
              <Plus /> Nuovo consumabile
            </button>
          </div>
        )}
      >
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Cerca per nome o categoria…" className="sm:w-80" />
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="select" aria-label="Categoria">
            <option value="all">Tutte le categorie</option>
            {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <span className="text-xs text-slate-500 sm:ml-auto">
            <span className="font-medium text-slate-800 tabular-nums">{filteredConsumables.length}</span> articoli
          </span>
        </div>
      </PageHeader>

      {/* Main Content Grid */}
      <PageBody>
        {/* Form Modal/Card for Add/Edit */}
        {(isAdding || editingId) && (
          <div className="mb-5 card p-5 sm:p-6 shadow-md ring-[3px] ring-blue-500/10 !border-blue-200 animate-in">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <h3 className="card-title">
                {isAdding ? 'Nuovo consumabile' : 'Modifica consumabile'}
              </h3>
              <button 
                onClick={() => { setIsAdding(false); setEditingId(null); setFormData({}); }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="sm:col-span-2">
                <label className="field-label">Nome Consumabile</label>
                <input 
                  type="text" 
                  value={formData.name || ''} 
                  onChange={e => setFormData({ ...formData, name: e.target.value })} 
                  className="input w-full h-9" 
                  placeholder="es. Toner HP LaserJet W1106A" 
                />
              </div>

              <div>
                <label className="field-label">Categoria</label>
                <input 
                  type="text" 
                  value={formData.category || ''} 
                  onChange={e => setFormData({ ...formData, category: e.target.value })} 
                  className="input w-full h-9" 
                  placeholder="es. Toner & Cartucce" 
                />
              </div>

              <div>
                <label className="field-label">Unità di Misura</label>
                <input 
                  type="text" 
                  value={formData.unit || ''} 
                  onChange={e => setFormData({ ...formData, unit: e.target.value })} 
                  className="input w-full h-9" 
                  placeholder="pz, risme, kit..." 
                />
              </div>

              <div>
                <label className="field-label">Quantità Totale Acquistata</label>
                <input 
                  type="number" 
                  min="0" 
                  value={formData.totalQuantity || 0} 
                  onChange={e => setFormData({ ...formData, totalQuantity: Number(e.target.value) })} 
                  className="input w-full h-9" 
                  disabled={!!editingId} 
                />
              </div>

              {editingId && (
                <div>
                  <label className="field-label">Quantità Già Consumata</label>
                  <input 
                    type="number" 
                    min="0" 
                    value={formData.consumedQuantity || 0} 
                    className="input w-full h-9" 
                    disabled 
                  />
                </div>
              )}

              <div>
                <label className="field-label">Costo Unitario Stimato (€)</label>
                <input 
                  type="number" 
                  min="0" 
                  step="0.01" 
                  value={formData.price || ''} 
                  onChange={e => setFormData({ ...formData, price: Number(e.target.value) })} 
                  className="input w-full h-9" 
                  placeholder="0.00" 
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-4 mt-4 border-t border-slate-100">
              <button 
                onClick={() => { setIsAdding(false); setEditingId(null); setFormData({}); }} 
                className="btn btn-secondary"
              >
                Annulla
              </button>
              <button 
                onClick={handleSave} 
                className="btn btn-primary"
              >
                <Save className="w-4 h-4" />
                <span>Salva</span>
              </button>
            </div>
          </div>
        )}

        {/* Consumables Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
          {filteredConsumables.map(c => {
            const available = currentStock(c);
            const total = Math.max(c.totalQuantity, 1);
            const ratio = (available / total) * 100;
            const isLowStock = available <= 5;
            const isCritical = available <= 1;
            const selected = selectedConsumables.has(c.id);

            return (
              <div
                key={c.id}
                className={`card p-4 sm:p-5 flex flex-col gap-4 transition-all hover:border-slate-300 ${selected ? '!border-blue-400 ring-[3px] ring-blue-500/15' : ''}`}
              >
                <div className="flex items-start gap-3">
                  {userData?.role === 'admin' && (
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleSelection(c.id)}
                      className="w-4 h-4 mt-0.5 rounded shrink-0"
                      aria-label={`Seleziona ${c.name}`}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-slate-900 truncate">{c.name}</h3>
                    <p className="text-xs text-slate-500 truncate">{c.category}</p>
                  </div>
                  {isCritical ? (
                    <span className="badge badge-danger"><AlertTriangle className="w-3 h-3" /> Esaurito</span>
                  ) : isLowStock ? (
                    <span className="badge badge-dot badge-warning">Scorta bassa</span>
                  ) : (
                    <span className="badge badge-dot badge-success">Disponibile</span>
                  )}
                </div>

                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
                      {available}
                      <span className="text-[13px] font-normal text-slate-500 ml-1">{c.unit}</span>
                    </span>
                    <span className="text-xs text-slate-500 tabular-nums">{c.consumedQuantity} prelevati · {c.totalQuantity} tot.</span>
                  </div>
                  <div className="mt-2 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden" role="progressbar" aria-valuenow={Math.round(ratio)} aria-valuemin={0} aria-valuemax={100}>
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${isCritical ? 'bg-rose-500' : isLowStock ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(100, Math.max(0, ratio))}%` }}
                    />
                  </div>
                </div>

                {isAdminOrTech && (
                  <div className="flex items-center gap-1.5 pt-3 border-t border-slate-100 mt-auto">
                    <button onClick={() => setAssignmentModalConsumable(c)} disabled={available <= 0} className="btn btn-soft btn-sm" title="Assegna o preleva per un dipendente">
                      <UserCheck /> Preleva
                    </button>
                    <button onClick={() => { setRestockId(c.id); setRestockQuantity(0); }} className="btn btn-ghost btn-sm" title="Rifornisci scorte">
                      <Plus /> Carica
                    </button>
                    <div className="ml-auto flex items-center">
                      <button onClick={() => { setEditingId(c.id); setFormData(c); setIsAdding(false); window.scrollTo({ top: 0 }); }} className="icon-btn" title="Modifica" aria-label="Modifica">
                        <Edit2 />
                      </button>
                      {userData?.role === 'admin' && (
                        <button onClick={() => handleDelete(c.id)} className="icon-btn hover:!text-rose-600 hover:!bg-rose-50" title="Elimina" aria-label="Elimina">
                          <Trash2 />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {filteredConsumables.length === 0 && !isAdding && (
            <div className="col-span-full card">
              <EmptyState
                icon={hasFilters ? <Search /> : <Package />}
                title={hasFilters ? 'Nessun risultato' : 'Nessun consumabile registrato'}
                description={hasFilters ? 'Prova a modificare la ricerca o la categoria.' : 'Registra i prodotti per monitorare scorte, rifornimenti e prelievi.'}
                action={hasFilters
                  ? <button onClick={() => { setSearchTerm(''); setCategoryFilter('all'); }} className="btn btn-secondary btn-sm">Azzera filtri</button>
                  : isAdminOrTech && (
                    <button onClick={() => { setIsAdding(true); setFormData({ totalQuantity: 0, consumedQuantity: 0, unit: 'pz' }); }} className="btn btn-primary btn-sm">
                      <Plus /> Aggiungi consumabile
                    </button>
                  )}
              />
            </div>
          )}
        </div>
      </PageBody>

      {/* Confirmation Dialog */}
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

      {/* Restock Modal */}
      {restockId && (
        <Modal
          size="sm"
          onClose={() => setRestockId(null)}
          title="Carica scorte"
          description={consumables.find(c => c.id === restockId)?.name}
          icon={<Plus />}
          footer={
            <>
              <button onClick={() => setRestockId(null)} className="btn btn-secondary">Annulla</button>
              <button onClick={handleRestockSave} disabled={!restockQuantity || restockQuantity <= 0} className="btn btn-primary">Conferma carico</button>
            </>
          }
        >
          <div className="p-5">
            <label htmlFor="restock-qty" className="field-label">
              Quantità ricevuta ({consumables.find(c => c.id === restockId)?.unit || 'pz'})
            </label>
            <input
              id="restock-qty"
              type="number"
              min="1"
              inputMode="numeric"
              value={restockQuantity || ''}
              onChange={e => setRestockQuantity(Number(e.target.value))}
              onKeyDown={e => e.key === 'Enter' && restockQuantity > 0 && handleRestockSave()}
              className="input h-11 text-base font-semibold tabular-nums"
              placeholder="es. 10"
              autoFocus
            />
          </div>
        </Modal>
      )}

      {/* CSV Import Modal */}
      <CsvImportModal
        isOpen={showImportCsv}
        onClose={() => setShowImportCsv(false)}
        importType="consumable"
        onSuccess={() => setShowImportCsv(false)}
      />

      {/* Assignment Modal */}
      {assignmentModalConsumable && (
        <LoanModal 
          isOpen={true}
          preselectedDeviceId={assignmentModalConsumable.id}
          preselectedDeviceName={assignmentModalConsumable.name}
          preselectedType="consumable"
          onClose={() => setAssignmentModalConsumable(null)} 
        />
      )}
    </div>
  );
}
