# Proposta Tecnica: Estensione Gestione Asset IT

A seguito dell'analisi dei requisiti richiesti, di seguito viene presentata la proposta tecnica strutturata per l'implementazione delle nuove funzionalità all'interno della Web App esistente.

---

## 1. Analisi delle modifiche da implementare

Le nuove funzionalità impattano trasversalmente l'applicazione, portandola da un sistema base di inventario e ticketing a un vero e proprio **IT Asset Management (ITAM)**. Le aree chiave di intervento sono:
- **Reporting e Analytics**: Introduzione di dashboard avanzate per monitorare consumi (consumabili) e spese (acquisti/costi).
- **Gestione Software**: Nuova area dedicata al tracciamento e associazione delle licenze (Asset immateriali).
- **Service Desk**: Evoluzione delle richieste verso cataloghi generici (richiesta di un "PC Portatile" anziché un modello specifico).
- **Logistica e Moduli**: Tracciamento strutturato e documentale degli shift/prestiti degli asset verso studenti e dipendenti.
- **Data Entry**: Utilità di importazione massiva (CSV) per facilitare il popolare e manutentare il database.

---

## 2. Nuove tabelle o campi database (Firestore)

Per supportare le nuove logiche evitando duplicazioni, è necessario introdurre nuove collezioni e aggiornare alcune esistenti:

### Nuove Collezioni

*   `consumable_logs`: Per tracciare ogni singola operazione di prelievo.
    *   Campi: `id`, `consumableId`, `userId`, `deviceId` (opzionale), `quantity`, `date`, `ticketId` (opzionale).
*   `licenses`:
    *   Campi: `id`, `softwareName`, `licenseKey`, `status` (active, available, expired, revoked), `assignedToDeviceId` (rif: Device), `assignedToUserId` (rif: User), `issueDate`, `expiryDate`, `notes`.
*   `purchases` (o `costs`):
    *   Campi: `id`, `itemName`, `category` (mouse, adattatori, etc.), `quantity`, `unitCost`, `totalCost`, `purchaseDate`, `supplier`.
*   `loans` (Prestiti/Moduli):
    *   Campi: `id`, `type` (assegnazione conf, restituzione, prestito temporaneo), `targetDocId` (ID del dispositivo o list di consumabili), `userId` (chi riceve), `checkoutDate`, `expectedReturnDate`, `actualReturnDate`, `status` (active, expiring, expired, returned, early_returned, manual_close), `notes`.

### Modifiche a Entità Esistenti

*   `Ticket`: Aggiungere nuovi `type` come `device_request` e campi specifici: `deviceCategory` (es. "PC Fisso", "PC Portatile"), `priority` (low, medium, high, urgent).
*   `User` & `Device`: Nessuna modifica strutturale diretta, ma referenziati pesantemente dalle nuove collezioni.

---

## 3. Relazioni tra Entità

Le relazioni nel database NoSQL (Firestore) si baseranno su riferimenti via Document ID aziendali, permettendo query incrociate efficaci:

*   **Licenze**: 
    *   `1:N` da Utente a Licenze.
    *   `1:1` o `1:N` da Device a Licenze (a seconda se la licenza è di tipo *device-based* o *user-based*).
*   **Moduli/Prestiti**: 
    *   Un Modulo (`loan`) si lega sempre a `1` Utente e a `1-N` Dispositivi/Consumabili.
    *   Lo stato di un dispositivo (isAssegnato) deve riflettere lo stato del prestito (Atomic Transaction).
*   **Richieste**: 
    *   Un `ticket` di device request può evolvere, sfociando nella creazione di un `loan` quando il tecnico consegna materialmente l'asset.
*   **Consumi**:
    *   Il `consumable_log` unisce Utente, Consumabile e cronologia (tempo) permettendo l'estrazione in dashboard.

---

## 4. Struttura delle nuove pagine/sezioni

*   `/dashboard`: Nuovo hub principale suddiviso in due tab:
    *   **Tab Consumi**: Filtri (Utente, Dispositivo, Tipo, Periodo) -> Grafico barra o linea -> Tabella dettaglio per operazione.
    *   **Tab Costi Acquisti**: Filtri (Periodo, Categoria) -> Breakdown spese -> Totali.
*   `/licenses`: Tabella filtrabile e ricercabile di tutte le chiavi software, con indicatori visivi di scadenze o disponibilità. Modal di assegnazione.
*   `/loans`: Gestione dei "Moduli", con visualizzazione chiara dei prestiti in scadenza (evidenziati in rosso ai tecnici/admin), in corso o conclusi.
*   Nuovo Action Button *"Importa CSV"* nelle sezioni Inventario/Consumabili.

---

## 5. Componenti UI necessari

Assumendo che il progetto usi **React** e **Tailwind CSS**:
1.  **Libreria Grafici**: `recharts` (consigliato per React, leggero e flessibile per BarChart e LineChart).
2.  **Libreria CSV Parser**: `papaparse` (per gestire in modo robusto l'importazione lato client con validazioni).
3.  **UI Components** specifici:
    *   `DashboardFiltersPanel`: Componente riutilizzabile e compatto con Dropdowns per tipo, utente e date (range picker).
    *   `StatusBadge` (migliorati): Badge dinamici per le licenze (`available` = verde, `expired` = rosso, etc.).
    *   `CsvImportModal`: Processo guidato (wizard) a step (Upload -> Anteprima e Mapping Errori -> Risultato).
    *   `LoanCheckoutModal`: Form per compilazione date prestito e legame Utente-Device.

---

## 6. Flussi operativi principali

1.  **Richiesta Dispositivo Generico**:
    *   L'utente clicca su "Nuova Richiesta" -> Seleziona "Richiesta Hardware" -> Sceglie Categoria (Es. PC Portatile), Priorità -> Submit.
    *   Il ticket appare ai tecnici in stato `new`.
2.  **Evasione Richiesta e Prestito**:
    *   Il Tecnico valuta e cambia lo stato in `in-progress`.
    *   Al momento dell'assegnazione fisica del PC scelto dallo stock, si sfrutta un'azione "Crea Modulo di Prestito".
    *   Il PC cambia status (assegnato). Viene generato il record `loan`. Il ticket viene chiuso.
3.  **Importazione Massiva CSV**:
    *   Admin apre il modale -> scarica il `template.csv` per capire i formati.
    *   Carica il CSV -> `papaparse` esegue l'anteprima. I dati mancanti mostrano "Errore riga X".
    *   Se ok -> Batch Write in Firestore (massimo 500 records per operazione/batch).
4.  **Chiusura Forzata Prestito (Studente Abbandona)**:
    *   Il tecnico apre il dettaglio `loan` dello studente -> click "Chiudi Manualmente" (restituzione anticipata).
    *   Firestore Transactions (`runTransaction`): Aggiorna `loan` a `early_returned`, scollega lo userID dal documento `Device`.

---

## 7. Priorità di Sviluppo (Roadmap Consigliata)

Per inserire funzionalità senza bloccare o corrompere i dati attuali, la strategia migliore è un rilascio iterativo:

*   **Fase 1: Importazione Massiva (CSV)**.
    *   *Perché*: Alimenta rapidamente tutto il sistema evitando la frustrante fase di data-entry manuale.
*   **Fase 2: Gestione Licenze Software**.
    *   *Perché*: È un nucleo isolato che non entra inizialmente in conflitto con l'hardware e fornisce subito alto valore sugli abbonamenti.
*   **Fase 3: Moduli e Prestiti**.
    *   *Perché*: Richiede precisione per sintonizzare i cambi di stato hardware con i moduli di affido degli studenti.
*   **Fase 4: Nuova gestione Richieste Generiche (Tickets)**.
    *   *Perché*: Facile evoluzione e si aggancia alla logica appena scritta dei "Moduli", chiudendo l'operatività HelpDesk -> Inventario.
*   **Fase 5: Dashboards Statistiche (Grafici Consumi e Costi)**.
    *   *Perché*: Ha senso solo con dati reali e sufficientemente strutturati dalle fasi precedenti. Richiede la raccolta nel tempo.

---

## 8. Criticità tecniche da considerare

*   **Firebase Constraints**: Firestore fatica con aggregazioni massicce (ex: `COUNT`, `SUM` storici). Per far girare i grafici di costi e consumi senza usare troppi documenti, sarà cruciale:
    *   Scarico differito cliente: O scaricare i sample limitati al range temporale selezionato dal client.
    *   Documenti riassuntivi: Adottare un pattern "Cloud function" o server-side che, all'aggiunta di una riga spesa, incrementi un contatore mensile, da far scaricare immediatamente al grafico (evitando query costose O(N)).
*   **Atomic Operations (Firestore Batches/Transactions)**: Quando un prestito viene creato as is, il dispositivo relazionato *deve* aggiornare il proprio parametro `assignedToUserId`. Se ciò dovesse fallire a metà (per disconnessione o permessi), il DB diventerà inconsistente. Usare obbligatoriamente i `WriteBatch`.
*   **Security Rules**: Con l'aggiunta dei report e dell'archiviazione licenze (spesso contenenti product key segrete), le Firebase rules dovranno segmentare strettamente i dati: chi non è Admin/Tecnico non potrà `read` la collection licenze o l'elenco costi.

---

## 9. Suggerimenti per mantenere l'app scalabile

1.  **Architettura delle Query**: Sostituire ove possibile Snapshot Listener attivi su *tutta* la collection di consumabili/devices. Introdurre filtri `query(..., limit(50))` implementando una paginazione infinita tramite `startAfter(lastVisible)`. Le dashboard con migliaia di `loans` futuri affosserebbero il browser senza paginazione.
2.  **CronJobs o App Engine / Cloud Run**: Poiché Firestore non ha CRON nativi, per avvisare che una licenza o un prestito sta per scadere (Alerting/Reminder after X days), sarà essenziale uno scheduled task su Google Cloud che ogni notte legga i record in scadenza ed emetta nodi di notifica sull'utente o email automatiche. 
3.  **Dati Storici vs Dati Vivi**: Quando una licenza diventa obsoleta e non verrà mai più usata (es anno 2021), spingerla su uno stato "Archived". Le select in dashboard dovrebbero escludere l'`archived` by default. Lo stesso per moduli di prestito molto vecchi. Questo mantiene lo standard payload client sempre snello.
