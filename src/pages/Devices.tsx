import React, { useEffect, useState, useRef, useMemo } from 'react';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp, updateDoc, writeBatch, getDocs, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Device } from '../types';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader, PageBody, PageLoader, EmptyState, SearchInput, DropdownMenu, MenuItem, Modal, DeviceStatusBadge, Avatar } from '../components/ui';
import { 
  Plus, 
  Trash2, 
  Printer, 
  Search, 
  UserCheck, 
  UserMinus, 
  Eye, 
  Edit2, 
  MessageSquare, 
  Package, 
  X, 
  Filter, 
  Upload, 
  QrCode, 
  Download, 
  FileText, 
  FileSpreadsheet, 
  ChevronDown 
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Barcode from 'react-barcode';
import DeviceModal from './DeviceModal';
import LoanModal from './LoanModal';
import ConfirmDialog from '../components/ConfirmDialog';
import CsvImportModal from '../components/CsvImportModal';
import DeviceLabelModal from '../components/DeviceLabelModal';
import { logOperation } from '../lib/logger';
import { 
  exportDevicesToCsv, 
  exportDevicesToPdf, 
  exportMaintenanceLogsToCsv, 
  exportMaintenanceLogsToPdf, 
  MaintenanceExportItem 
} from '../lib/exportUtils';

export default function Devices() {
  const { userData, currentUser } = useAuth();
  const isAdminOrTech = userData?.role === 'admin' || userData?.role === 'tecnico';
  const navigate = useNavigate();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editDevice, setEditDevice] = useState<Device | undefined>(undefined);
  const [showImportCsv, setShowImportCsv] = useState(false);
  const [assignmentModalDevice, setAssignmentModalDevice] = useState<Device | null>(null);
  
  const [quickTicketDevice, setQuickTicketDevice] = useState<{ device: Device, type: 'support' | 'request' } | null>(null);
  const [quickTicketDescription, setQuickTicketDescription] = useState('');
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());

  // QR Code Labels and Export Dropdown State
  const [labelModalDevices, setLabelModalDevices] = useState<Device[] | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    requireString?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  } | null>(null);

  const printRef = useRef<HTMLDivElement>(null);

  // Close export dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleQuickTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTicketDevice || !quickTicketDescription) return;

    try {
      const newTicketRef = doc(collection(db, 'tickets'));
      await setDoc(newTicketRef, {
        type: quickTicketDevice.type,
        description: quickTicketDescription,
        userId: currentUser!.uid,
        status: 'open',
        deviceId: quickTicketDevice.device.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await logOperation('create', 'tickets', `Creato ticket rapido per ${quickTicketDevice.device.category}`, currentUser!.uid, currentUser!.email || '', newTicketRef.id);
      
      setQuickTicketDevice(null);
      setQuickTicketDescription('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'tickets');
    }
  };

  const handlePrint = () => {
    try {
      if (window.self !== window.top) {
        setConfirmDialog({
          isOpen: true,
          title: 'Limitazione Anteprima',
          message: "Sei in modalità anteprima e la stampa potrebbe essere bloccata dal browser. Per stampare correttamente, apri l'applicazione in una nuova scheda (tramite l'icona in alto a destra o cliccando su 'Stampa Comunque' per tentare lo stesso).",
          confirmText: 'Stampa Comunque',
          onConfirm: () => {
            window.print();
            setConfirmDialog(null);
          }
        });
        return;
      }
    } catch (e) {
      // Ignore
    }
    window.print();
  };

  useEffect(() => {
    const q = query(collection(db, 'devices'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const devicesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Device));
      setDevices(devicesData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'devices');
    });

    return unsubscribe;
  }, []);

  const handleDelete = (deviceId: string) => {
    const device = devices.find(d => d.id === deviceId);
    setConfirmDialog({
      isOpen: true,
      title: 'Elimina Dispositivo',
      message: `Sei sicuro di voler eliminare ${device?.category} (${device?.serialNumber})? L'operazione è irreversibile.`,
      isDestructive: true,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'devices', deviceId));
          if (device) {
            await logOperation('delete', 'devices', `Eliminato dispositivo: ${device.category} (${device.serialNumber})`, currentUser!.uid, currentUser!.email || '');
          }
          setConfirmDialog(null);
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `devices/${deviceId}`);
          setConfirmDialog(null);
        }
      }
    });
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedDevices);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedDevices(newSet);
  };

  const handleBulkDelete = () => {
    if (!isAdminOrTech || selectedDevices.size === 0) return;
    setConfirmDialog({
      isOpen: true,
      title: 'Elimina Selezionati',
      message: `Vuoi eliminare definitivamente ${selectedDevices.size} dispositivi selezionati? L'operazione è irreversibile.`,
      requireString: 'ELIMINA',
      isDestructive: true,
      onConfirm: async () => {
        try {
          const promises = Array.from(selectedDevices).map((id: string) => deleteDoc(doc(db, 'devices', id)));
          await Promise.all(promises);
          await logOperation('delete', 'devices', `Eliminati ${selectedDevices.size} dispositivi in blocco`, currentUser!.uid, currentUser!.email || '');
          setSelectedDevices(new Set());
          setConfirmDialog(null);
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `devices`);
          setConfirmDialog(null);
        }
      }
    });
  };

  const handleReturnDevice = async (device: Device) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Restituisci Dispositivo',
      message: `Vuoi registrare la restituzione del dispositivo ${device.category} - ${device.serialNumber}? Verrà chiuso l'eventuale prestito attivo.`,
      onConfirm: async () => {
        try {
          // Update device
          await updateDoc(doc(db, 'devices', device.id), {
            assignedToUserId: null,
            assignedToUserEmail: null,
            updatedAt: serverTimestamp()
          });

          // Find active loans and close them
          const q = query(
            collection(db, 'loans'), 
            where('targetDocId', '==', device.id), 
            where('status', 'in', ['active', 'expiring', 'expired'])
          );
          const snap = await getDocs(q);
          const batch = writeBatch(db);
          snap.forEach(d => {
            batch.update(d.ref, {
              status: 'returned',
              actualReturnDate: new Date().toISOString(),
              updatedAt: serverTimestamp()
            });
          });
          await batch.commit();
          
          await logOperation('update', 'devices', `Restituito dispositivo: ${device.category} - ${device.serialNumber}`, currentUser!.uid, currentUser!.email || '');
          setConfirmDialog(null);
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `devices/${device.id}`);
          setConfirmDialog(null);
        }
      }
    });
  };

  const uniqueCategories = useMemo(() => Array.from(new Set(devices.map(d => d.category).filter(Boolean))), [devices]);

  const filteredDevices = useMemo(() => {
    return devices.filter(d => {
      const matchCategory = categoryFilter === 'all' || d.category === categoryFilter;
      
      let matchStatus = true;
      if (statusFilter === 'available') matchStatus = !d.assignedToUserId && !d.isUnderMaintenance;
      if (statusFilter === 'assigned') matchStatus = !!d.assignedToUserId;
      if (statusFilter === 'maintenance') matchStatus = !!d.isUnderMaintenance;

      const searchLower = searchTerm.toLowerCase();
      const matchSearch = searchTerm === '' || 
        d.category.toLowerCase().includes(searchLower) ||
        d.serialNumber.toLowerCase().includes(searchLower) ||
        (d.assignedToUserEmail || '').toLowerCase().includes(searchLower) ||
        Object.values(d.dynamicFields || {}).some(v => String(v).toLowerCase().includes(searchLower));

      if (!matchCategory || !matchStatus || !matchSearch) return false;
      
      // Admins and techs see all devices
      if (isAdminOrTech) return true;
      
      // Normal users see ONLY unassigned devices, or devices explicitly assigned to them
      return !d.assignedToUserId || d.assignedToUserId === currentUser?.uid;
    });
  }, [devices, categoryFilter, statusFilter, searchTerm, isAdminOrTech, currentUser?.uid]);

  const getTargetDevices = () => {
    if (selectedDevices.size > 0) {
      return devices.filter(d => selectedDevices.has(d.id));
    }
    return filteredDevices;
  };

  const handleExportCsv = () => {
    const targets = getTargetDevices();
    exportDevicesToCsv(targets);
    setShowExportMenu(false);
  };

  const handleExportPdf = () => {
    const targets = getTargetDevices();
    exportDevicesToPdf(targets);
    setShowExportMenu(false);
  };

  const handleExportMaintenanceLogsCsv = () => {
    const targets = getTargetDevices();
    const items: MaintenanceExportItem[] = [];
    targets.forEach(d => {
      (d.history || []).forEach((h, idx) => {
        const isMaint = h.action?.toLowerCase().includes('maint') || 
                        h.action?.toLowerCase().includes('manut') || 
                        d.isUnderMaintenance;
        if (isMaint) {
          items.push({
            id: `${d.id}-${idx}`,
            date: h.date,
            category: d.category,
            serialNumber: d.serialNumber,
            action: h.action === 'maintenance_start' ? 'Inizio Manutenzione' :
                    h.action === 'maintenance_end' ? 'Fine Manutenzione' : h.action,
            operator: h.userEmail || 'Tecnico',
            notes: h.notes || '',
            deviceId: d.id,
          });
        }
      });
    });
    exportMaintenanceLogsToCsv(items);
    setShowExportMenu(false);
  };

  const handleExportMaintenanceLogsPdf = () => {
    const targets = getTargetDevices();
    const items: MaintenanceExportItem[] = [];
    targets.forEach(d => {
      (d.history || []).forEach((h, idx) => {
        const isMaint = h.action?.toLowerCase().includes('maint') || 
                        h.action?.toLowerCase().includes('manut') || 
                        d.isUnderMaintenance;
        if (isMaint) {
          items.push({
            id: `${d.id}-${idx}`,
            date: h.date,
            category: d.category,
            serialNumber: d.serialNumber,
            action: h.action === 'maintenance_start' ? 'Inizio Manutenzione' :
                    h.action === 'maintenance_end' ? 'Fine Manutenzione' : h.action,
            operator: h.userEmail || 'Tecnico',
            notes: h.notes || '',
            deviceId: d.id,
          });
        }
      });
    });
    exportMaintenanceLogsToPdf(items, 'Registro Manutenzioni Dispositivi IT');
    setShowExportMenu(false);
  };

  const statusCounts = useMemo(() => {
    const visible = isAdminOrTech ? devices : devices.filter(d => !d.assignedToUserId || d.assignedToUserId === currentUser?.uid);
    return {
      all: visible.length,
      available: visible.filter(d => !d.assignedToUserId && !d.isUnderMaintenance).length,
      assigned: visible.filter(d => !!d.assignedToUserId).length,
      maintenance: visible.filter(d => !!d.isUnderMaintenance).length,
    };
  }, [devices, isAdminOrTech, currentUser?.uid]);

  const hasFilters = searchTerm !== '' || categoryFilter !== 'all' || statusFilter !== 'all';
  const resetFilters = () => { setSearchTerm(''); setCategoryFilter('all'); setStatusFilter('all'); };

  const rowMenu = (device: Device): MenuItem[] => {
    const items: MenuItem[] = [
      { label: 'Apri scheda', icon: <Eye />, onClick: () => navigate(`/devices/${device.id}`) },
      { label: 'Etichetta QR', icon: <QrCode />, onClick: () => setLabelModalDevices([device]) },
    ];
    if (device.assignedToUserId === currentUser?.uid) {
      items.push({ label: 'Richiedi assistenza', icon: <MessageSquare />, onClick: () => setQuickTicketDevice({ device, type: 'support' }) });
    } else if (!device.assignedToUserId) {
      items.push({ label: 'Richiedi dotazione', icon: <Package />, onClick: () => setQuickTicketDevice({ device, type: 'request' }) });
    }
    if (isAdminOrTech) {
      items.push({ separator: true });
      items.push({ label: 'Modifica', icon: <Edit2 />, onClick: () => { setEditDevice(device); setIsModalOpen(true); } });
      items.push(device.assignedToUserId
        ? { label: 'Registra riconsegna', icon: <UserMinus />, onClick: () => handleReturnDevice(device) }
        : { label: 'Assegna a dipendente', icon: <UserCheck />, onClick: () => setAssignmentModalDevice(device) });
    }
    if (userData?.role === 'admin') {
      items.push({ separator: true });
      items.push({ label: 'Elimina', icon: <Trash2 />, danger: true, onClick: () => handleDelete(device.id) });
    }
    return items;
  };

  const modelOf = (d: Device) => {
    const f = d.dynamicFields || {};
    return f.modello || f.Modello || f.model || f.marca || Object.values(f)[0] || '';
  };

  if (loading) return <PageLoader />;

  const allSelected = filteredDevices.length > 0 && filteredDevices.every(d => selectedDevices.has(d.id));

  return (
    <div className="flex flex-col flex-1">
      <PageHeader
        title="Dispositivi"
        description="Hardware aziendale, assegnazioni, etichette QR ed export."
        actions={
          <div id="onboarding-devices-actions" className="flex items-center gap-2 flex-wrap">
            <DropdownMenu
              width="w-72"
              disabled={filteredDevices.length === 0}
              trigger={<><Download /> Esporta <ChevronDown className="!w-3.5 !h-3.5 -mr-1" /></>}
              items={[
                { separator: true, label: selectedDevices.size > 0 ? `${selectedDevices.size} selezionati` : `Inventario (${filteredDevices.length})` },
                { label: 'Inventario CSV', description: 'Compatibile con Excel', icon: <FileSpreadsheet />, onClick: handleExportCsv },
                { label: 'Inventario PDF', description: 'Report per audit offline', icon: <FileText />, onClick: handleExportPdf },
                { separator: true, label: 'Registro manutenzioni' },
                { label: 'Manutenzioni CSV', icon: <FileSpreadsheet />, onClick: handleExportMaintenanceLogsCsv },
                { label: 'Manutenzioni PDF', icon: <FileText />, onClick: handleExportMaintenanceLogsPdf },
                { separator: true, label: 'Etichette' },
                { label: 'Genera etichette QR', icon: <QrCode />, onClick: () => setLabelModalDevices(getTargetDevices()) },
                { label: 'Stampa barcode', description: selectedDevices.size ? undefined : 'Seleziona prima i dispositivi', icon: <Printer />, onClick: handlePrint, disabled: selectedDevices.size === 0 },
              ]}
            />
            {isAdminOrTech && (
              <>
                <button onClick={() => setShowImportCsv(true)} className="btn btn-secondary">
                  <Upload /> <span className="hidden sm:inline">Importa</span>
                </button>
                <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">
                  <Plus /> Nuovo dispositivo
                </button>
              </>
            )}
          </div>
        }
      />

      <PageBody>
        <div className="card overflow-hidden">
          {/* Toolbar */}
          <div className="p-3 sm:p-4 flex flex-col lg:flex-row lg:items-center gap-3 border-b border-slate-100">
            <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Cerca per seriale, modello, utente…" className="lg:w-80" />
            <div className="flex items-center gap-2 overflow-x-auto -mx-1 px-1 pb-0.5">
              <div className="segmented shrink-0">
                {([
                  ['all', 'Tutti'],
                  ['available', 'Disponibili'],
                  ['assigned', 'In uso'],
                  ['maintenance', 'Manutenzione'],
                ] as const).map(([k, l]) => (
                  <button key={k} data-active={statusFilter === k} onClick={() => setStatusFilter(k)} className="flex items-center gap-1.5">
                    {l}
                    <span className="text-[11px] text-slate-400 tabular-nums">{statusCounts[k]}</span>
                  </button>
                ))}
              </div>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="select h-8 text-xs shrink-0" aria-label="Categoria">
                <option value="all">Tutte le categorie</option>
                {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              {hasFilters && (
                <button onClick={resetFilters} className="btn btn-ghost btn-sm shrink-0">
                  <X /> Azzera
                </button>
              )}
            </div>
          </div>

          {filteredDevices.length === 0 ? (
            <EmptyState
              icon={hasFilters ? <Search /> : <Package />}
              title={hasFilters ? 'Nessun risultato' : 'Nessun dispositivo in inventario'}
              description={hasFilters ? 'Prova a modificare la ricerca o i filtri.' : 'Aggiungi il primo dispositivo o importa un file CSV.'}
              action={hasFilters
                ? <button onClick={resetFilters} className="btn btn-secondary btn-sm">Azzera filtri</button>
                : isAdminOrTech && <button onClick={() => setIsModalOpen(true)} className="btn btn-primary btn-sm"><Plus /> Nuovo dispositivo</button>}
            />
          ) : (
            <>
              {/* Tabella desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="data-table min-w-[760px]">
                  <thead>
                    <tr>
                      <th className="w-10 !pr-0">
                        <input
                          type="checkbox"
                          aria-label="Seleziona tutti"
                          className="w-4 h-4 rounded"
                          onChange={(e) => setSelectedDevices(e.target.checked ? new Set(filteredDevices.map(d => d.id)) : new Set())}
                          checked={allSelected}
                        />
                      </th>
                      <th>Dispositivo</th>
                      <th>Seriale</th>
                      <th>Stato</th>
                      {isAdminOrTech && <th>Assegnato a</th>}
                      <th className="w-28 text-right"><span className="sr-only">Azioni</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDevices.map(device => {
                      const selected = selectedDevices.has(device.id);
                      return (
                        <tr key={`desk-${device.id}`} className={selected ? '!bg-blue-50/50' : ''}>
                          <td className="!pr-0">
                            <input type="checkbox" checked={selected} onChange={() => toggleSelection(device.id)} className="w-4 h-4 rounded" aria-label={`Seleziona ${device.serialNumber}`} />
                          </td>
                          <td>
                            <Link to={`/devices/${device.id}`} className="block group/link">
                              <span className="block font-medium text-slate-900 group-hover/link:text-blue-600">{device.category}</span>
                              {modelOf(device) && <span className="block text-xs text-slate-500 truncate max-w-[260px]">{modelOf(device)}</span>}
                            </Link>
                          </td>
                          <td><span className="font-mono text-xs text-slate-700">{device.serialNumber}</span></td>
                          <td><DeviceStatusBadge maintenance={device.isUnderMaintenance} assigned={!!device.assignedToUserId} /></td>
                          {isAdminOrTech && (
                            <td>
                              {device.assignedToUserId ? (
                                <span className="flex items-center gap-2 min-w-0">
                                  <Avatar email={device.assignedToUserEmail} size="sm" />
                                  <span className="truncate text-slate-700">{device.assignedToUserEmail?.split('@')[0]}</span>
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                          )}
                          <td className="text-right">
                            <div className="flex items-center justify-end gap-0.5">
                              {isAdminOrTech && !device.isUnderMaintenance && (
                                device.assignedToUserId ? (
                                  <button onClick={() => handleReturnDevice(device)} className="icon-btn" title="Registra riconsegna" aria-label="Registra riconsegna"><UserMinus /></button>
                                ) : (
                                  <button onClick={() => setAssignmentModalDevice(device)} className="icon-btn" title="Assegna" aria-label="Assegna"><UserCheck /></button>
                                )
                              )}
                              <DropdownMenu items={rowMenu(device)} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Lista mobile */}
              <ul className="md:hidden divide-y divide-slate-100">
                {filteredDevices.map(device => (
                  <li key={`mob-${device.id}`} className="flex items-center gap-3 px-3 py-3">
                    <input type="checkbox" checked={selectedDevices.has(device.id)} onChange={() => toggleSelection(device.id)} className="w-4 h-4 rounded shrink-0" aria-label={`Seleziona ${device.serialNumber}`} />
                    <Link to={`/devices/${device.id}`} className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900 truncate">{device.category}</span>
                        <DeviceStatusBadge maintenance={device.isUnderMaintenance} assigned={!!device.assignedToUserId} />
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 truncate">
                        <span className="font-mono">{device.serialNumber}</span>
                        {isAdminOrTech && device.assignedToUserEmail && <> · {device.assignedToUserEmail.split('@')[0]}</>}
                      </div>
                    </Link>
                    <DropdownMenu items={rowMenu(device)} />
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="px-4 py-2.5 border-t border-slate-100 text-xs text-slate-500 bg-slate-50/50">
            <span className="tabular-nums font-medium text-slate-700">{filteredDevices.length}</span> {filteredDevices.length === 1 ? 'dispositivo' : 'dispositivi'}
            {hasFilters && <> su {statusCounts.all}</>}
          </div>
        </div>
      </PageBody>

      {/* Barra azioni selezione */}
      {selectedDevices.size > 0 && (
        <div className="print:hidden fixed bottom-4 inset-x-0 z-40 flex justify-center px-4 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-1 bg-slate-900 text-white rounded-xl shadow-xl pl-4 pr-1.5 py-1.5 animate-slide-up max-w-full overflow-x-auto">
            <span className="text-[13px] font-medium whitespace-nowrap pr-2 tabular-nums">{selectedDevices.size} selezionati</span>
            <button onClick={() => setLabelModalDevices(getTargetDevices())} className="btn btn-sm text-white hover:bg-white/10"><QrCode /> <span className="hidden sm:inline">Etichette</span></button>
            <button onClick={handlePrint} className="btn btn-sm text-white hover:bg-white/10"><Printer /> <span className="hidden sm:inline">Stampa</span></button>
            <button onClick={handleExportCsv} className="btn btn-sm text-white hover:bg-white/10"><FileSpreadsheet /> <span className="hidden sm:inline">CSV</span></button>
            {isAdminOrTech && (
              <button onClick={handleBulkDelete} className="btn btn-sm text-rose-300 hover:bg-rose-500/20"><Trash2 /> <span className="hidden sm:inline">Elimina</span></button>
            )}
            <span className="w-px h-5 bg-white/15 mx-1" />
            <button onClick={() => setSelectedDevices(new Set())} className="icon-btn text-slate-300 hover:text-white hover:bg-white/10" aria-label="Deseleziona"><X /></button>
          </div>
        </div>
      )}

      {quickTicketDevice && (
        <Modal
          onClose={() => setQuickTicketDevice(null)}
          title={quickTicketDevice.type === 'support' ? 'Richiedi assistenza' : 'Richiedi dispositivo'}
          description={`${quickTicketDevice.device.category} · ${quickTicketDevice.device.serialNumber}`}
          icon={quickTicketDevice.type === 'support' ? <MessageSquare /> : <Package />}
          footer={
            <>
              <button type="button" onClick={() => setQuickTicketDevice(null)} className="btn btn-secondary">Annulla</button>
              <button type="submit" form="quick-ticket" className="btn btn-primary">Invia richiesta</button>
            </>
          }
        >
          <form id="quick-ticket" onSubmit={handleQuickTicketSubmit} className="p-5">
            <label htmlFor="qt-desc" className="field-label">{quickTicketDevice.type === 'support' ? 'Descrivi il problema' : 'Motivazione'}</label>
            <textarea
              id="qt-desc"
              required
              rows={4}
              autoFocus
              value={quickTicketDescription}
              onChange={e => setQuickTicketDescription(e.target.value)}
              className="input resize-none"
              placeholder={quickTicketDevice.type === 'support' ? 'Es. lo schermo si spegne dopo pochi minuti…' : 'Es. mi serve per le trasferte del mese prossimo…'}
            />
          </form>
        </Modal>
      )}

      {isModalOpen && <DeviceModal editDevice={editDevice} onClose={() => { setIsModalOpen(false); setEditDevice(undefined); }} />}
      
      {assignmentModalDevice && (
        <LoanModal 
          isOpen={true}
          preselectedDeviceId={assignmentModalDevice.id}
          preselectedDeviceName={`${assignmentModalDevice.category} - ${assignmentModalDevice.serialNumber}`}
          onClose={() => setAssignmentModalDevice(null)} 
        />
      )}

      {/* Hidden print area */}
      <div className="absolute opacity-0 pointer-events-none -z-50 print:opacity-100 print:pointer-events-auto print:z-50 print:relative bg-white p-8 inset-0 overflow-visible">
        <div ref={printRef} className="print-container">
          {devices.filter(d => selectedDevices.has(d.id)).map(device => (
            <div key={device.id} className="flex flex-col items-center justify-center p-4 border border-dashed border-gray-400">
              <p className="font-bold mb-2">{device.category}</p>
              <Barcode value={device.serialNumber} width={1.5} height={50} />
            </div>
          ))}
        </div>
      </div>

      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmText={confirmDialog.confirmText}
          requireString={confirmDialog.requireString}
          isDestructive={confirmDialog.isDestructive}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
      
      <CsvImportModal
        isOpen={showImportCsv}
        onClose={() => setShowImportCsv(false)}
        importType="device"
        onSuccess={() => setShowImportCsv(false)}
      />

      {labelModalDevices && (
        <DeviceLabelModal
          devices={labelModalDevices}
          isOpen={true}
          onClose={() => setLabelModalDevices(null)}
        />
      )}
    </div>
  );
}
