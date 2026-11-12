import { PageHeader } from '../components/ui';
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  FileText, 
  FileSpreadsheet, 
  RefreshCw, 
  Search, 
  ExternalLink, 
  ShieldCheck, 
  Sliders, 
  Play, 
  RotateCcw, 
  Database, 
  Sparkles,
  ChevronDown,
  ChevronRight,
  Send,
  PlusCircle,
  Trash2,
  Activity,
  CheckSquare,
  Smartphone,
  Package,
  FileSignature,
  Ticket,
  Barcode,
  Layers,
  Info
} from 'lucide-react';
import { collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { exportQATestReportToPdf, exportQATestReportToCsv, QATestExportItem } from '../lib/exportUtils';
import { logOperation } from '../lib/logger';

export type TestStatus = 'passed' | 'failed' | 'pending' | 'in_progress';

export interface TestCase {
  id: string;
  category: string;
  title: string;
  precondition: string;
  procedure: string[];
  expectedResult: string;
  targetPath: string;
  badge: string;
  roleScope: string;
}

const QA_TEST_CATALOG: TestCase[] = [
  // ==========================================
  // 1. AUTENTICAZIONE & RBAC
  // ==========================================
  {
    id: 'TC-01',
    category: 'Autenticazione & RBAC',
    title: 'Accesso Amministratore & Controllo Privilegi Totali',
    precondition: 'Account con ruolo "admin" approvato',
    procedure: [
      '1. Effettua il login con l\'account amministratore.',
      '2. Verifica che nel menu laterale siano visibili le voci "Gestione Utenti" e "Log di Audit".',
      '3. Controlla che le azioni di eliminazione, approvazione utenti e creazione siano tutte abilitate.'
    ],
    expectedResult: 'Accesso garantito senza errori di permessi; tutte le sezioni di configurazione e log sono accessibili.',
    targetPath: '/dashboard',
    badge: 'Admin',
    roleScope: 'Amministratore'
  },
  {
    id: 'TC-02',
    category: 'Autenticazione & RBAC',
    title: 'Accesso Tecnico & Isolamento Amministrativo',
    precondition: 'Account con ruolo "tecnico" approvato',
    procedure: [
      '1. Accedi come utente con ruolo "tecnico".',
      '2. Verifica la possibilità di gestire dispositivi, consumabili, prestiti e ticket.',
      '3. Tenta di accedere manualmente alla rotta /users o /logs.'
    ],
    expectedResult: 'Le rotte /users e /logs reindirizzano o mostrano la schermata di accesso riservato; i moduli operativi funzionano al 100%.',
    targetPath: '/devices',
    badge: 'Tecnico',
    roleScope: 'Tecnico'
  },
  {
    id: 'TC-03',
    category: 'Autenticazione & RBAC',
    title: 'Accesso Utente Standard (Self-Service)',
    precondition: 'Account con ruolo "utente" standard',
    procedure: [
      '1. Accedi con account utente standard.',
      '2. Verifica che la navigazione sia ristretta a Dashboard, Il mio Inventario e Richieste & Ticket.',
      '3. Invia una nuova richiesta di cancelleria o segnalazione guasto.'
    ],
    expectedResult: 'L\'utente vede unicamente le proprie dotazioni e i propri ticket, senza accesso alle funzioni di modifica del magazzino.',
    targetPath: '/my-inventory',
    badge: 'Utente',
    roleScope: 'Utente'
  },
  {
    id: 'TC-04',
    category: 'Autenticazione & RBAC',
    title: 'Sicurezza Regole Firestore (Audit Anti-Bypass)',
    precondition: 'Utente connesso',
    procedure: [
      '1. Esegui il test diagnostico di sicurezza database.',
      '2. Verifica che le operazioni di scrittura non autorizzate vengano respinte dal server Firestore.',
      '3. Controlla l\'integrità dell\'audit trail.'
    ],
    expectedResult: 'Regole di Firestore compliant: permessi autorizzati passano con successo, scritture non lecite bloccate.',
    targetPath: '/dashboard',
    badge: 'Sicurezza',
    roleScope: 'Tutti'
  },

  // ==========================================
  // 2. DISPOSITIVI & ASSET IT
  // ==========================================
  {
    id: 'TC-05',
    category: 'Dispositivi & Hardware',
    title: 'Censimento Nuovo Dispositivo con Matricola Seriale',
    precondition: 'Ruolo Admin o Tecnico',
    procedure: [
      '1. Apri la pagina "Inventario Dispositivi".',
      '2. Fai clic su "+ Aggiungi Dispositivo".',
      '3. Compila categoria (es. Laptop), matricola (SN), modello, prezzo e note.',
      '4. Salva il dispositivo e verifica la comparsa istantanea nella tabella.'
    ],
    expectedResult: 'Il dispositivo viene registrato nel database con codice a barre generato e stato "Disponibile".',
    targetPath: '/devices',
    badge: 'Hardware',
    roleScope: 'Admin / Tecnico'
  },
  {
    id: 'TC-06',
    category: 'Dispositivi & Hardware',
    title: 'Assegnazione Diretta & Storico Timeline Asset',
    precondition: 'Almeno 1 dispositivo disponibile e 1 utente approvato',
    procedure: [
      '1. Dalla tabella dispositivi, clicca sull\'icona "Assegna" (omino verde).',
      '2. Seleziona il dipendente destinatario e conferma.',
      '3. Apri la scheda di dettaglio del dispositivo.'
    ],
    expectedResult: 'Il dispositivo passa in stato "Assegnato"; nella timeline della scheda compare la voce di assegnazione datata con operatore.',
    targetPath: '/devices',
    badge: 'Assegnazione',
    roleScope: 'Admin / Tecnico'
  },
  {
    id: 'TC-07',
    category: 'Dispositivi & Hardware',
    title: 'Gestione Intervento Manutenzione & Blocco Uso',
    precondition: 'Dispositivo disponibile',
    procedure: [
      '1. Dalla scheda o riga dispositivo, avvia una manutenzione tecnica.',
      '2. Inserisci note guasto (es. Sostituzione display).',
      '3. Verifica che il badge diventi "In Manutenzione" (Giallo) e che non sia assegnabile.'
    ],
    expectedResult: 'L\'asset viene escluso dalle disponibilità fino alla chiusura dell\'intervento.',
    targetPath: '/devices',
    badge: 'Manutenzione',
    roleScope: 'Admin / Tecnico'
  },
  {
    id: 'TC-08',
    category: 'Dispositivi & Hardware',
    title: 'Generazione & Stampa Etichette QR / Barcode',
    precondition: 'Dispositivi registrati a catalogo',
    procedure: [
      '1. Clicca su "Etichette QR" nella testata della pagina Dispositivi.',
      '2. Seleziona il formato di stampa desiderato (compatto o standard).',
      '3. Invia la stampa di anteprima.'
    ],
    expectedResult: 'Generazione corretta del foglio etichette con QR code scansionabili e matricola leggibile.',
    targetPath: '/devices',
    badge: 'QR Code',
    roleScope: 'Admin / Tecnico'
  },
  {
    id: 'TC-09',
    category: 'Dispositivi & Hardware',
    title: 'Esportazione Inventario & Registro Manutenzioni (PDF/CSV)',
    precondition: 'Catalogo dispositivi popolato',
    procedure: [
      '1. Apri il menu a tendina "Esporta" nella pagina Dispositivi.',
      '2. Esegui il download sia del formato CSV che del report PDF.',
      '3. Esegui il download del Registro Manutenzioni PDF.'
    ],
    expectedResult: 'File scaricati correttamente: il CSV contiene tutte le colonne con separatore standard; il PDF include intestazione e conteggi corretti.',
    targetPath: '/devices',
    badge: 'Export',
    roleScope: 'Admin / Tecnico'
  },

  // ==========================================
  // 3. MATERIALI CONSUMABILI & RESTOCK
  // ==========================================
  {
    id: 'TC-10',
    category: 'Consumabili & Scorte',
    title: 'Creazione Consumabile & Configurazione Soglia Minima',
    precondition: 'Ruolo Admin o Tecnico',
    procedure: [
      '1. Vai a "Materiale Consumabile".',
      '2. Fai clic su "+ Nuovo Consumabile".',
      '3. Inserisci nome (es. Toner Nero HP), quantità iniziale (10 pz) e soglia minima (3 pz).'
    ],
    expectedResult: 'Articolo creato con giacenza indicata e stato verde "Scorte OK".',
    targetPath: '/consumables',
    badge: 'Magazzino',
    roleScope: 'Admin / Tecnico'
  },
  {
    id: 'TC-11',
    category: 'Consumabili & Scorte',
    title: 'Rifornimento Rapido (+ Restock Magazzino)',
    precondition: 'Articolo consumabile esistente',
    procedure: [
      '1. Sulla card dell\'articolo, clicca sul pulsante "+ Restock / Rifornisci".',
      '2. Aggiungi 5 unità.',
      '3. Salva la modifica.'
    ],
    expectedResult: 'La quantità disponibile si incrementa esattamente del numero indicato e l\'operazione compare nei log.',
    targetPath: '/consumables',
    badge: 'Restock',
    roleScope: 'Admin / Tecnico'
  },
  {
    id: 'TC-12',
    category: 'Consumabili & Scorte',
    title: 'Scarico Materiale & Scatto Allarme Scorta Bassa',
    precondition: 'Consumabile con giacenza di test',
    procedure: [
      '1. Esegui lo scarico del materiale fino a scendere sotto la soglia minima impostata.',
      '2. Verifica che la card mostri il badge arancione "Scorta Bassa".',
      '3. Controlla che nella Dashboard il contatore "Scorte Basse" si aggiorni.'
    ],
    expectedResult: 'Segnalazione visiva immediata di esaurimento scorte sia nella pagina dedicata che nella Dashboard.',
    targetPath: '/consumables',
    badge: 'Allarmi',
    roleScope: 'Admin / Tecnico'
  },
  {
    id: 'TC-13',
    category: 'Consumabili & Scorte',
    title: 'Importazione Massiva Consumabili da CSV',
    precondition: 'File CSV con colonne name, category, totalQuantity, minThreshold',
    procedure: [
      '1. Clicca su "Importa CSV" nella testata dei Consumabili.',
      '2. Carica un file CSV di esempio.',
      '3. Verifica l\'anteprima e conferma l\'importazione.'
    ],
    expectedResult: 'Tutti gli articoli validi vengono inseriti a magazzino senza duplicazioni o errori.',
    targetPath: '/consumables',
    badge: 'CSV Import',
    roleScope: 'Admin / Tecnico'
  },

  // ==========================================
  // 4. PRESTITI & ASSEGNAZIONI TEMPORANEE
  // ==========================================
  {
    id: 'TC-14',
    category: 'Moduli & Prestiti',
    title: 'Emissione Nuovo Modulo Prestito / Comodato',
    precondition: 'Dispositivo disponibile e utente assegnatario',
    procedure: [
      '1. Vai a "Moduli/Prestiti" e clicca "+ Nuovo Modulo Prestito".',
      '2. Seleziona il dipendente, l\'asset da prestare e la data prevista di rientro (es. +7 giorni).',
      '3. Inserisci eventuali note o motivo e conferma.'
    ],
    expectedResult: 'Modulo registrato in stato "Attivo"; il dispositivo viene contrassegnato come prestato.',
    targetPath: '/loans',
    badge: 'Comodato',
    roleScope: 'Admin / Tecnico'
  },
  {
    id: 'TC-15',
    category: 'Moduli & Prestiti',
    title: 'Rilevamento Automatico Prestiti in Scadenza / Scaduti',
    precondition: 'Prestito con data di rientro passata o entro 48h',
    procedure: [
      '1. Visualizza l\'elenco prestiti.',
      '2. Verifica la presenza del badge rosso "Scaduto" o giallo "In Scadenza".',
      '3. Filtra per stato "Attivi" o "Scaduti".'
    ],
    expectedResult: 'Evidenziazione chiara dei prestiti non rientrati per consentire il sollecito al dipendente.',
    targetPath: '/loans',
    badge: 'Scadenze',
    roleScope: 'Admin / Tecnico'
  },
  {
    id: 'TC-16',
    category: 'Moduli & Prestiti',
    title: 'Restituzione Prestito & Reintegro Disponibilità',
    precondition: 'Prestito attivo',
    procedure: [
      '1. Fai clic sul pulsante "Restituisci" sulla riga del prestito.',
      '2. Conferma la riconsegna nel dialogo modale.',
      '3. Controlla che il prestito passi in stato "Restituito".'
    ],
    expectedResult: 'Il prestito viene archiviato con data effettiva di rientro; l\'asset torna subito "Disponibile" per nuove assegnazioni.',
    targetPath: '/loans',
    badge: 'Riconsegna',
    roleScope: 'Admin / Tecnico'
  },

  // ==========================================
  // 5. HELPDESK & TICKET DI ASSISTENZA
  // ==========================================
  {
    id: 'TC-17',
    category: 'Richieste & Ticket',
    title: 'Apertura Richiesta Fornitura / Segnalazione Guasto',
    precondition: 'Qualsiasi utente loggato',
    procedure: [
      '1. Vai alla pagina "Richieste & Ticket".',
      '2. Clicca su "+ Nuova Richiesta".',
      '3. Scegli tipo (Richiesta Materiale o Assistenza Guasto), oggetto, priorità e descrizione.',
      '4. Invia la richiesta.'
    ],
    expectedResult: 'Il ticket viene creato in stato "Aperto" (Open) e inserito in cima alla lista con priorità visibile.',
    targetPath: '/tickets',
    badge: 'Helpdesk',
    roleScope: 'Tutti'
  },
  {
    id: 'TC-18',
    category: 'Richieste & Ticket',
    title: 'Presa in Carico Ticket da parte del Tecnico',
    precondition: 'Ticket in stato "Aperto"',
    procedure: [
      '1. Da Tecnico/Admin, individua il ticket aperto.',
      '2. Fai clic sul pulsante "In Carico" (o seleziona per azione massiva).',
      '3. Verifica il cambio stato immediato.'
    ],
    expectedResult: 'Lo stato passa a "In Carico" (In Progress); il ticket viene assegnato all\'operatore corrente.',
    targetPath: '/tickets',
    badge: 'Workflow',
    roleScope: 'Admin / Tecnico'
  },
  {
    id: 'TC-19',
    category: 'Richieste & Ticket',
    title: 'Risoluzione Ticket & Collegamento Asset Assegnato',
    precondition: 'Ticket in carico',
    procedure: [
      '1. Fai clic su "Risolvi Ticket" / "Risolto".',
      '2. Se il ticket richiedeva un dispositivo, verifica l\'eventuale assegnazione automatica.',
      '3. Verifica il passaggio dello stato a "Risolto" (Verde).'
    ],
    expectedResult: 'Ticket marcato come risolto con timestamp di completamento; log di audit aggiornato.',
    targetPath: '/tickets',
    badge: 'Risoluzione',
    roleScope: 'Admin / Tecnico'
  },
  {
    id: 'TC-20',
    category: 'Richieste & Ticket',
    title: 'Operazioni Massive su Ticket Multipli (Bulk Actions)',
    precondition: 'Almeno 2 ticket presenti',
    procedure: [
      '1. Seleziona 2 o più ticket tramite la casella di selezione.',
      '2. Usa la barra multifunzione in alto per cambiare stato in blocco o archiviare.',
      '3. Verifica l\'applicazione a tutti i selezionati.'
    ],
    expectedResult: 'Tutti i ticket selezionati vengono aggiornati contemporaneamente senza errori.',
    targetPath: '/tickets',
    badge: 'Bulk Action',
    roleScope: 'Admin / Tecnico'
  },

  // ==========================================
  // 6. SCANSIONE BARCODE & RICERCA
  // ==========================================
  {
    id: 'TC-21',
    category: 'Scansione & Ricerca',
    title: 'Scansione Rapida Barcode / Seriale in Testata',
    precondition: 'Matricola seriale di un dispositivo esistente',
    procedure: [
      '1. Clicca nel campo "Scansione barcode / seriale..." nella barra superiore (o usa pistola laser).',
      '2. Inserisci la matricola e premi Invio.',
      '3. Verifica l\'apertura immediata della modale di scheda tecnica.'
    ],
    expectedResult: 'L\'asset viene identificato istantaneamente con visualizzazione rapida di stato, assegnatario e azioni.',
    targetPath: '/dashboard',
    badge: 'Barcode',
    roleScope: 'Tutti'
  },
  {
    id: 'TC-22',
    category: 'Scansione & Ricerca',
    title: 'Ricerca Universale Rapida da Dashboard',
    precondition: 'Dispositivi e consumabili presenti',
    procedure: [
      '1. Dalla Dashboard, usa la barra di ricerca rapida "Cerca materiale...".',
      '2. Digita una parola chiave (es. "Carta", "Toner", "Dell") e premi Invio.',
      '3. Controlla il reindirizzamento filtrato.'
    ],
    expectedResult: 'La pagina di destinazione si apre con il filtro applicato e mostra i risultati pertinenti.',
    targetPath: '/dashboard',
    badge: 'Ricerca',
    roleScope: 'Tutti'
  },

  // ==========================================
  // 7. AUDIT TRAIL & ONBOARDING
  // ==========================================
  {
    id: 'TC-23',
    category: 'Audit & Compliance',
    title: 'Tracciamento Immutabile nei Log di Audit',
    precondition: 'Ruolo Amministratore',
    procedure: [
      '1. Apri la pagina "Log di Audit".',
      '2. Esegui un\'azione (es. creazione o modifica di un ticket/dispositivo).',
      '3. Torna nei log e verifica la registrazione dell\'evento con data, operatore ed entità.'
    ],
    expectedResult: 'Ogni operazione critica viene registrata con data, email operatore e azione per conformità GDPR/ISO.',
    targetPath: '/logs',
    badge: 'Audit Trail',
    roleScope: 'Amministratore'
  },
  {
    id: 'TC-24',
    category: 'Audit & Compliance',
    title: 'Esecuzione Tour di Onboarding Guidato (9 Fasi)',
    precondition: 'Qualsiasi utente',
    procedure: [
      '1. Clicca sul pulsante "Rifai Tutorial" in alto a destra.',
      '2. Scorri i 9 passaggi guidati (Dashboard, Scanner, Dispositivi, Consumabili, Prestiti, Ticket, Inventario).',
      '3. Naviga anche a ritroso e tramite i pallini di avanzamento.'
    ],
    expectedResult: 'Il tour scorre in modo fluido attraverso tutte le rotte senza interruzioni o errori di render.',
    targetPath: '/dashboard',
    badge: 'Onboarding',
    roleScope: 'Tutti'
  }
];

export default function QATesting() {
  const { userData, currentUser } = useAuth();
  const navigate = useNavigate();

  // Storage key for test execution state
  const storageKey = 'om_qa_test_execution_state_v1';

  const [testResults, setTestResults] = useState<Record<string, { status: TestStatus; notes: string; testedAt?: string; testedBy?: string }>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set(['TC-01', 'TC-05', 'TC-10', 'TC-14', 'TC-17']));
  
  // Health check state
  const [isHealthChecking, setIsHealthChecking] = useState(false);
  const [healthStatus, setHealthStatus] = useState<{
    firestore: 'idle' | 'ok' | 'error';
    auth: 'idle' | 'ok' | 'error';
    collections: Record<string, boolean>;
    latencyMs: number;
    lastCheck?: string;
  }>({
    firestore: 'idle',
    auth: 'idle',
    collections: {},
    latencyMs: 0
  });

  // Test fixture generator state
  const [fixtureStatus, setFixtureStatus] = useState<string | null>(null);
  const [isCreatingFixtures, setIsCreatingFixtures] = useState(false);

  // Load saved test results
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setTestResults(JSON.parse(saved));
      } else {
        // Initialize default empty state
        const initial: Record<string, { status: TestStatus; notes: string }> = {};
        QA_TEST_CATALOG.forEach(tc => {
          initial[tc.id] = { status: 'pending', notes: '' };
        });
        setTestResults(initial);
      }
    } catch (e) {
      console.error('Error loading QA results', e);
    }
  }, []);

  // Save changes
  const updateTestStatus = (id: string, status: TestStatus) => {
    const updated = {
      ...testResults,
      [id]: {
        ...(testResults[id] || { notes: '' }),
        status,
        testedAt: new Date().toISOString(),
        testedBy: userData?.email || currentUser?.email || 'Tecnico'
      }
    };
    setTestResults(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  };

  const updateTestNotes = (id: string, notes: string) => {
    const updated = {
      ...testResults,
      [id]: {
        ...(testResults[id] || { status: 'pending' as TestStatus }),
        notes,
        testedAt: new Date().toISOString(),
        testedBy: userData?.email || currentUser?.email || 'Tecnico'
      }
    };
    setTestResults(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  };

  const toggleExpand = (id: string) => {
    const next = new Set(expandedTests);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedTests(next);
  };

  const resetAllTests = () => {
    if (window.confirm('Sei sicuro di voler azzerare lo stato di tutti i test?')) {
      const initial: Record<string, { status: TestStatus; notes: string }> = {};
      QA_TEST_CATALOG.forEach(tc => {
        initial[tc.id] = { status: 'pending', notes: '' };
      });
      setTestResults(initial);
      localStorage.setItem(storageKey, JSON.stringify(initial));
    }
  };

  const markAllAsPassed = () => {
    if (window.confirm('Vuoi contrassegnare tutti i test come SUPERATI (PASS)?')) {
      const updated: Record<string, { status: TestStatus; notes: string; testedAt: string; testedBy: string }> = {};
      QA_TEST_CATALOG.forEach(tc => {
        updated[tc.id] = {
          status: 'passed',
          notes: testResults[tc.id]?.notes || 'Verifica operativa eseguita con successo',
          testedAt: new Date().toISOString(),
          testedBy: userData?.email || currentUser?.email || 'Tecnico'
        };
      });
      setTestResults(updated);
      localStorage.setItem(storageKey, JSON.stringify(updated));
    }
  };

  // Run real-time database connectivity and security health check
  const runLiveHealthCheck = async () => {
    setIsHealthChecking(true);
    const start = performance.now();
    const cols = ['users', 'devices', 'consumables', 'loans', 'tickets', 'logs'];
    const colStatus: Record<string, boolean> = {};

    try {
      for (const colName of cols) {
        try {
          await getDocs(collection(db, colName));
          colStatus[colName] = true;
        } catch (err) {
          colStatus[colName] = false;
        }
      }

      const elapsed = Math.round(performance.now() - start);
      setHealthStatus({
        firestore: 'ok',
        auth: currentUser ? 'ok' : 'error',
        collections: colStatus,
        latencyMs: elapsed,
        lastCheck: new Date().toLocaleTimeString('it-IT')
      });
    } catch (e) {
      setHealthStatus({
        firestore: 'error',
        auth: currentUser ? 'ok' : 'error',
        collections: colStatus,
        latencyMs: 0,
        lastCheck: new Date().toLocaleTimeString('it-IT')
      });
    } finally {
      setIsHealthChecking(false);
    }
  };

  // Create temporary test fixtures for testing edge cases (e.g. low stock, pending ticket)
  const handleCreateTestFixtures = async () => {
    setIsCreatingFixtures(true);
    setFixtureStatus('Creazione dati di collaudo in corso...');
    try {
      // 1. Create a mock test device
      const testDeviceId = 'test_qa_device_' + Date.now().toString().slice(-4);
      await setDoc(doc(db, 'devices', testDeviceId), {
        category: 'Laptop',
        serialNumber: `TEST-QA-${Date.now().toString().slice(-4)}`,
        isUnderMaintenance: false,
        price: 850,
        notes: '[DATO DI COLLAUDO QA] Dispositivo di prova temporaneo',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // 2. Create a low-stock test consumable
      const testConsumableId = 'test_qa_consumable_' + Date.now().toString().slice(-4);
      await setDoc(doc(db, 'consumables', testConsumableId), {
        name: '[TEST-QA] Toner Prova Scorta Bassa',
        category: 'Toner & Inchiostri',
        totalQuantity: 2,
        consumedQuantity: 0,
        minThreshold: 5,
        unit: 'pz',
        price: 45,
        notes: '[DATO DI COLLAUDO QA] Generato per verificare scatto allarmi',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      // 3. Create a test ticket
      const testTicketId = 'test_qa_ticket_' + Date.now().toString().slice(-4);
      await setDoc(doc(db, 'tickets', testTicketId), {
        title: '[TEST-QA] Richiesta dotazione aggiuntiva',
        description: 'Test operativo di presa in carico e transizione di stato ticket',
        type: 'request',
        priority: 'alta',
        status: 'open',
        userId: currentUser?.uid || 'tester',
        userEmail: currentUser?.email || 'tester@example.com',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      await logOperation('create', 'qa_testing', 'Creati record di test temporanei per collaudo', currentUser!.uid, currentUser!.email || '');
      setFixtureStatus('Dataset di collaudo creato con successo! Dispositivo, consumabile e ticket generati.');
    } catch (e: any) {
      setFixtureStatus('Errore nella creazione dei dati di collaudo: ' + e.message);
    } finally {
      setIsCreatingFixtures(false);
    }
  };

  // Remove test fixtures
  const handleCleanTestFixtures = async () => {
    setIsCreatingFixtures(true);
    setFixtureStatus('Pulizia dati di collaudo in corso...');
    try {
      const devSnap = await getDocs(collection(db, 'devices'));
      const devPromises: Promise<any>[] = [];
      devSnap.forEach(d => {
        if (d.id.startsWith('test_qa_') || d.data().serialNumber?.startsWith('TEST-QA')) {
          devPromises.push(deleteDoc(d.ref));
        }
      });

      const consSnap = await getDocs(collection(db, 'consumables'));
      consSnap.forEach(c => {
        if (c.id.startsWith('test_qa_') || c.data().name?.startsWith('[TEST-QA]')) {
          devPromises.push(deleteDoc(c.ref));
        }
      });

      const tickSnap = await getDocs(collection(db, 'tickets'));
      tickSnap.forEach(t => {
        if (t.id.startsWith('test_qa_') || t.data().title?.startsWith('[TEST-QA]')) {
          devPromises.push(deleteDoc(t.ref));
        }
      });

      await Promise.all(devPromises);
      setFixtureStatus('Tutti i record di test con prefisso [TEST-QA] sono stati rimossi dal database.');
    } catch (e: any) {
      setFixtureStatus('Errore nella rimozione dei dati di test: ' + e.message);
    } finally {
      setIsCreatingFixtures(false);
    }
  };

  // Statistics Calculation
  const stats = useMemo(() => {
    let total = QA_TEST_CATALOG.length;
    let passed = 0;
    let failed = 0;
    let inProgress = 0;
    let pending = 0;

    QA_TEST_CATALOG.forEach(tc => {
      const res = testResults[tc.id]?.status || 'pending';
      if (res === 'passed') passed++;
      else if (res === 'failed') failed++;
      else if (res === 'in_progress') inProgress++;
      else pending++;
    });

    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

    return { total, passed, failed, inProgress, pending, passRate };
  }, [testResults]);

  // Categories list
  const categories = useMemo(() => {
    return Array.from(new Set(QA_TEST_CATALOG.map(t => t.category)));
  }, []);

  // Filtered Test Catalog
  const filteredCatalog = useMemo(() => {
    return QA_TEST_CATALOG.filter(tc => {
      const matchCat = selectedCategory === 'all' || tc.category === selectedCategory;
      const curStatus = testResults[tc.id]?.status || 'pending';
      const matchStat = selectedStatus === 'all' || curStatus === selectedStatus;
      
      const q = searchQuery.toLowerCase();
      const matchSearch = !q || 
        tc.id.toLowerCase().includes(q) ||
        tc.title.toLowerCase().includes(q) ||
        tc.category.toLowerCase().includes(q) ||
        tc.expectedResult.toLowerCase().includes(q) ||
        (testResults[tc.id]?.notes || '').toLowerCase().includes(q);

      return matchCat && matchStat && matchSearch;
    });
  }, [selectedCategory, selectedStatus, searchQuery, testResults]);

  // Prepare Export Items
  const prepareExportItems = (): QATestExportItem[] => {
    return QA_TEST_CATALOG.map(tc => {
      const res = testResults[tc.id];
      return {
        id: tc.id,
        category: tc.category,
        title: tc.title,
        precondition: tc.precondition,
        procedure: tc.procedure.join(' \n '),
        expectedResult: tc.expectedResult,
        status: res?.status || 'pending',
        notes: res?.notes || '',
        testedBy: res?.testedBy || userData?.email || '',
        testedAt: res?.testedAt ? new Date(res.testedAt).toLocaleString('it-IT') : ''
      };
    });
  };

  const handleExportPdf = () => {
    const items = prepareExportItems();
    exportQATestReportToPdf(
      items, 
      stats, 
      {
        name: `${userData?.firstName || ''} ${userData?.lastName || ''}`.trim() || 'Collaudatore QA',
        email: userData?.email || currentUser?.email || 'admin@example.com',
        role: userData?.role?.toUpperCase() || 'TECNICO'
      }
    );
  };

  const handleExportCsv = () => {
    const items = prepareExportItems();
    exportQATestReportToCsv(items);
  };

  return (
    <div className="flex-1 flex flex-col">
      <PageHeader
        title="Collaudo QA"
        description="Piano di verifica funzionale, controllo ruoli, integrità dati ed esportazione del verbale."
        actions={
          <>
            <button onClick={handleExportCsv} className="btn btn-secondary" title="Esporta foglio di calcolo CSV">
              <FileSpreadsheet /> <span className="hidden sm:inline">Esporta CSV</span>
            </button>
            <button onClick={handleExportPdf} className="btn btn-primary" title="Genera il verbale ufficiale di collaudo in PDF">
              <FileText /> Genera verbale PDF
            </button>
          </>
        }
      />

      <div className="px-4 sm:px-6 lg:px-8 pb-10 max-w-7xl mx-auto w-full space-y-5 flex-1">
        
        {/* KPI & Progress Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          
          {/* Progress Card */}
          <div className="card p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Avanzamento Collaudo</span>
              <span className="text-xs font-bold text-blue-600 font-mono">{stats.passRate}%</span>
            </div>
            <div className="my-2">
              <div className="text-2xl font-semibold text-slate-900 font-mono tracking-tight">
                {stats.passed} <span className="text-xs font-normal text-slate-400">/ {stats.total} Superati</span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-2">
                <div 
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${stats.passRate}%` }}
                />
              </div>
            </div>
          </div>

          {/* Pass Card */}
          <div className="card p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Superati (PASS)</div>
              <div className="text-xl font-bold text-emerald-700 font-mono mt-0.5">{stats.passed}</div>
            </div>
          </div>

          {/* Fail Card */}
          <div className="card p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <XCircle className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Non Superati (FAIL)</div>
              <div className="text-xl font-bold text-rose-700 font-mono mt-0.5">{stats.failed}</div>
            </div>
          </div>

          {/* In Progress Card */}
          <div className="card p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">In Esecuzione</div>
              <div className="text-xl font-bold text-blue-700 font-mono mt-0.5">{stats.inProgress}</div>
            </div>
          </div>

          {/* Pending Card */}
          <div className="card p-4 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Da Eseguire</div>
              <div className="text-xl font-bold text-slate-700 font-mono mt-0.5">{stats.pending}</div>
            </div>
          </div>
        </div>

        {/* Live Diagnostics & Test Fixtures Toolbar */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            
            {/* Live System Health Section */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Diagnostica Connettività & Firestore Live
                  </h3>
                  {healthStatus.firestore === 'ok' && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                      Online ({healthStatus.latencyMs}ms)
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Verifica in tempo reale lettura e scrittura regole per: 
                  <span className="font-mono text-slate-700 ml-1">users, devices, consumables, loans, tickets, logs</span>
                </p>
              </div>
            </div>

            {/* Health & Fixture Action Buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={runLiveHealthCheck}
                disabled={isHealthChecking}
                className="h-9 px-3.5 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-2xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isHealthChecking ? 'animate-spin' : ''}`} />
                <span>{isHealthChecking ? 'Controllo...' : 'Esegui Health Check'}</span>
              </button>

              <button
                onClick={handleCreateTestFixtures}
                disabled={isCreatingFixtures}
                className="h-9 px-3.5 bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-2xs"
                title="Genera record di test temporanei per simulare flussi ed allarmi"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Genera Dati di Collaudo</span>
              </button>

              <button
                onClick={handleCleanTestFixtures}
                disabled={isCreatingFixtures}
                className="h-9 px-3.5 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-2xs"
                title="Rimuove tutti i record temporanei con prefisso [TEST-QA]"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Pulisci Dati Test</span>
              </button>
            </div>
          </div>

          {/* Fixture Feedback message */}
          {fixtureStatus && (
            <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-600 shrink-0" />
                <span>{fixtureStatus}</span>
              </div>
              <button 
                onClick={() => setFixtureStatus(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                Chiudi
              </button>
            </div>
          )}
        </div>

        {/* Filters & Control Bar */}
        <div className="card p-3 sm:p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cerca per codice test (es. TC-05), titolo o parole chiave..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-9 pr-4"
            />
          </div>

          {/* Filter Dropdowns & Bulk controls */}
          <div className="flex items-center gap-2 flex-wrap">
            
            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="select"
            >
              <option value="all">Tutti gli Ambiti ({QA_TEST_CATALOG.length})</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="select"
            >
              <option value="all">Tutti gli Esiti</option>
              <option value="passed">Solo Superati (PASS)</option>
              <option value="failed">Solo Non Superati (FAIL)</option>
              <option value="in_progress">Solo In Esecuzione</option>
              <option value="pending">Solo Da Eseguire</option>
            </select>

            {/* Reset / Mark All buttons */}
            <button
              onClick={markAllAsPassed}
              className="btn btn-secondary"
              title="Segna tutti i test come conformi"
            >
              Tutti PASS
            </button>

            <button
              onClick={resetAllTests}
              className="btn btn-secondary px-2.5"
              title="Azzera esiti dei test"
              aria-label="Azzera esiti dei test"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Test Matrix List */}
        <div className="space-y-3">
          {filteredCatalog.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200/80 text-center">
              <CheckSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-800">Nessuno scenario corrisponde ai filtri</h3>
              <p className="text-xs text-slate-500 mt-1">Prova a reimpostare i filtri di ricerca o la categoria selezionata.</p>
            </div>
          ) : (
            filteredCatalog.map((tc) => {
              const res = testResults[tc.id] || { status: 'pending', notes: '' };
              const isExpanded = expandedTests.has(tc.id);

              return (
                <div 
                  key={tc.id}
                  className={`bg-white rounded-2xl border transition-all shadow-2xs overflow-hidden ${
                    res.status === 'passed' ? 'border-emerald-200 bg-emerald-50/10' :
                    res.status === 'failed' ? 'border-rose-200 bg-rose-50/10' :
                    res.status === 'in_progress' ? 'border-blue-200 bg-blue-50/10' :
                    'border-slate-200/80'
                  }`}
                >
                  {/* Test Row Header */}
                  <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    
                    {/* Left Info */}
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <button 
                        onClick={() => toggleExpand(tc.id)}
                        className="mt-0.5 p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>

                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-xs px-2 py-0.5 bg-slate-900 text-white rounded-md">
                            {tc.id}
                          </span>
                          <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                            {tc.category}
                          </span>
                          <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                            {tc.badge}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Ruolo: <strong className="text-slate-600">{tc.roleScope}</strong>
                          </span>
                        </div>

                        <h4 
                          onClick={() => toggleExpand(tc.id)}
                          className="text-sm font-bold text-slate-900 cursor-pointer hover:text-blue-600 transition-colors"
                        >
                          {tc.title}
                        </h4>
                      </div>
                    </div>

                    {/* Right Controls (Status Toggles & Direct Link) */}
                    <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                      
                      {/* Navigate to module button */}
                      <Link
                        to={tc.targetPath}
                        className="h-8 px-3 rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-2xs"
                        title="Apri la schermata per eseguire il test"
                      >
                        <span>Esegui Test</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>

                      {/* Status Selector Buttons */}
                      <div className="inline-flex bg-slate-100 p-1 rounded-xl gap-1">
                        <button
                          onClick={() => updateTestStatus(tc.id, 'passed')}
                          className={`h-7 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                            res.status === 'passed' 
                              ? 'bg-emerald-600 text-white shadow-xs' 
                              : 'text-slate-600 hover:bg-white/60'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>PASS</span>
                        </button>

                        <button
                          onClick={() => updateTestStatus(tc.id, 'failed')}
                          className={`h-7 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                            res.status === 'failed' 
                              ? 'bg-rose-600 text-white shadow-xs' 
                              : 'text-slate-600 hover:bg-white/60'
                          }`}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>FAIL</span>
                        </button>

                        <button
                          onClick={() => updateTestStatus(tc.id, 'in_progress')}
                          className={`h-7 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                            res.status === 'in_progress' 
                              ? 'bg-blue-600 text-white shadow-xs' 
                              : 'text-slate-600 hover:bg-white/60'
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>IN CORSO</span>
                        </button>

                        <button
                          onClick={() => updateTestStatus(tc.id, 'pending')}
                          className={`h-7 px-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                            res.status === 'pending' 
                              ? 'bg-slate-400 text-white shadow-xs' 
                              : 'text-slate-500 hover:bg-white/60'
                          }`}
                          title="Da eseguire"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details Panel */}
                  {isExpanded && (
                    <div className="px-6 pb-5 pt-2 border-t border-slate-100 bg-slate-50/50 space-y-4">
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        
                        {/* Procedure */}
                        <div className="bg-white p-3.5 rounded-xl border border-slate-200/70 space-y-2">
                          <div className="font-bold text-slate-800 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-blue-600" />
                            <span>Procedura di Collaudo Passo-Passo</span>
                          </div>
                          <div className="text-slate-500 text-[11px] mb-1">
                            <strong>Precondizione:</strong> {tc.precondition}
                          </div>
                          <ul className="space-y-1 text-slate-700 font-medium">
                            {tc.procedure.map((step, idx) => (
                              <li key={idx} className="leading-relaxed">{step}</li>
                            ))}
                          </ul>
                        </div>

                        {/* Expected Result */}
                        <div className="bg-white p-3.5 rounded-xl border border-slate-200/70 space-y-2 flex flex-col justify-between">
                          <div>
                            <div className="font-bold text-slate-800 uppercase tracking-wider text-[10px] flex items-center gap-1.5 mb-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Risultato Atteso & Criterio di Accettazione</span>
                            </div>
                            <p className="text-slate-700 leading-relaxed font-medium">
                              {tc.expectedResult}
                            </p>
                          </div>

                          {res.testedAt && (
                            <div className="text-[10px] text-slate-400 pt-2 border-t border-slate-100">
                              Ultima verifica: {new Date(res.testedAt).toLocaleString('it-IT')} da {res.testedBy || 'Operatore'}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Operator Notes Input */}
                      <div className="bg-white p-3.5 rounded-xl border border-slate-200/70">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                          Note Operative / Evidenze di Collaudo (Opzionale)
                        </label>
                        <input
                          type="text"
                          placeholder="Inserisci note su eventuali anomalie riscontrate o dettagli del test..."
                          value={res.notes || ''}
                          onChange={(e) => updateTestNotes(tc.id, e.target.value)}
                          className="input w-full h-8"
                        />
                      </div>

                    </div>
                  )}

                </div>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
}
