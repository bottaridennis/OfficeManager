# Piano Operativo di Testing & Collaudo QA - Office Manager

Piano di collaudo operativo, checklist di validazione funzionale e console interattiva di testing per verificare in modo sistematico tutti i flussi dell'applicazione (Hardware, Consumabili, Prestiti, Ticket, Sicurezza RBAC e Barcode).

---

## Decisioni Confermate & Requisiti di Collaudo

> [!IMPORTANT]
> **Scelte confermate tramite questionario:**
> - **Formato del Piano**: Piano di collaudo operativo manuale con Checklist QA interattiva integrata nell'applicazione per consentire ai tecnici di eseguire test guidati e salvare lo stato dei collaudi.
> - **Aree Funzionali di Priorità Massima**: 
>   1. Controllo permessi e sicurezza RBAC (Admin / Tecnico / Utente / Utente in attesa)
>   2. Gestione hardware, generazione etichette QR e scansione barcode universale
>   3. Ciclo di vita dei ticket di assistenza (apertura, presa in carico, risoluzione, ripristino asset)
>   4. Prestiti temporanei, gestione scadenze, solleciti e chiusura con reintegro magazzino
>   5. Consumabili, monitoraggio soglie minime, scarico scorte e procedura di Restock rapido
> - **Gestione Dati di Test**: Supporto combinato a dati di collaudo guidati (dataset demo isolato) e verifica sicura su dati reali di produzione con audit log.

---

## 1. Architettura del Piano di Testing

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       OFFICE MANAGER QA & TEST SUITE                        │
└──────┬──────────────────────────────┬───────────────────────────────┬───────┘
       │                              │                               │
       ▼                              ▼                               ▼
┌──────────────┐              ┌──────────────┐                ┌──────────────┐
│  Sicurezza   │              │  Magazzino   │                │   Helpdesk   │
│  & Ruoli     │              │  & Asset IT  │                │   & Prestiti │
├──────────────┤              ├──────────────┤                ├──────────────┤
│ • Admin      │              │ • Dispositivi│                │ • Ticket Guas│
│ • Tecnico    │              │ • Consumabili│                │ • Ticket Rich│
│ • Utente     │              │ • Barcode/QR │                │ • Prestiti   │
│ • Pending    │              │ • Restock    │                │ • Rientri    │
└──────┬───────┘              └──────┬───────┘                └──────┬───────┘
       │                             │                               │
       └─────────────────────────────┼───────────────────────────────┘
                                     │
                                     ▼
                   ┌───────────────────────────────────┐
                   │    Pannello QA & Checklist        │
                   │    Interattiva In-App (/qa-test)  │
                   │  • Esecuzione casi di test        │
                   │  • Simulatore di Ruolo            │
                   │  • Verifica Regole Firestore      │
                   │  • Esportazione Report Collaudo   │
                   └───────────────────────────────────┘
```

---

## 2. Matrice Operativa dei Casi di Test

### Area 1: Autenticazione & Controllo Accessi (RBAC & Firestore Rules)

| ID Caso | Titolo del Test | Procedura Operativa | Risultato Atteso | Ruoli Coinvolti |
| :--- | :--- | :--- | :--- | :--- |
| **TC-SEC-01** | Login Utente & Reindirizzamento | Accesso con credenziali o Google Auth | Accesso immediato alla dashboard con caricamento del profilo utente | Tutti i ruoli |
| **TC-SEC-02** | Isolamento Dati Utente Standard | Login come Utente e accesso a `/tickets` e `/my-inventory` | L'utente visualizza **solo** i propri ticket e le proprie dotazioni assegnate | Utente |
| **TC-SEC-03** | Blocco Azioni Amministrative per Utente | Tentativo di modifica giacenza o cancellazione asset | Interfaccia priva di pulsanti di modifica; blocco a livello di `firestore.rules` | Utente |
| **TC-SEC-04** | Privilegi Operativi del Tecnico | Accesso come Tecnico e modifica stato ticket / presa in carico | Il Tecnico può aggiornare lo stato del ticket e i registri senza permessi di cancellazione massiva | Tecnico |
| **TC-SEC-05** | Approvazione Utenti Nuovi | Registrazione nuovo account e approvazione da pannello Admin | L'utente in stato `pending` non accede alle risorse finché l'admin non imposta `status: 'approved'` | Admin |

---

### Area 2: Parco Dispositivi & Barcode / QR

| ID Caso | Titolo del Test | Procedura Operativa | Risultato Atteso |
| :--- | :--- | :--- | :--- |
| **TC-DEV-01** | Creazione Nuovo Dispositivo | Compilare categoria, marca, modello, seriale e prezzo in `/devices` | Dispositivo registrato su Firestore, log registrato e disponibile per assegnazione |
| **TC-DEV-02** | Generatore Etichette QR | Selezionare uno o più dispositivi e premere "Etichette QR" | Modale con QR code scansionabili, matricola e layout di stampa foglio A4 |
| **TC-DEV-03** | Ricerca Rapida tramite Pistola Barcode | Sparare o digitare il seriale nell'input in testata (`#onboarding-header-scanner`) | Apertura immediata della scheda dettaglio del dispositivo con storico |
| **TC-DEV-04** | Esportazione Inventario & Registro Manutenzioni | Cliccare "Esporta" -> "Esporta Inventario CSV" e "Registro Manutenzioni PDF" | Download di file formattati conformi per audit e reportistica aziendale |
| **TC-DEV-05** | Avvio & Chiusura Manutenzione | Impostare flag manutenzione su PC e verificare blocco assegnazione | Il PC risulta `In Manutenzione`, non selezionabile per nuovi prestiti |

---

### Area 3: Materiali Consumabili, Soglie & Restock

| ID Caso | Titolo del Test | Procedura Operativa | Risultato Atteso |
| :--- | :--- | :--- | :--- |
| **TC-CON-01** | Registrazione Consumabile & Soglia Minima | Creare articolo (es. *Toner HP 85A*, Giacenza: 2, Minimo: 3) | L'articolo appare con badge di attenzione "Scorte Basse" nella Dashboard |
| **TC-CON-02** | Scarico Consumo Rapido | Eseguire scarico di 1 unità tramite pulsante dedicato | Giacenza decrementata in tempo reale e operazione tracciata nei log |
| **TC-CON-03** | Rifornimento Rapido (+ Restock) | Cliccare su "+ Restock", indicare pezzi in arrivo e salvare | Giacenza aggiornata, alert ricalcolato e costo totale aggiornato |
| **TC-CON-04** | Importazione Massiva CSV | Caricare un file CSV di prova con intestazioni corrette | Creazione in blocco degli articoli con validazione duplicati |

---

### Area 4: Moduli & Prestiti Temporanei

| ID Caso | Titolo del Test | Procedura Operativa | Risultato Atteso |
| :--- | :--- | :--- | :--- |
| **TC-LOA-01** | Assegnazione Prestito con Data di Rientro | Assegnare un notebook a un dipendente con scadenza a 7 giorni | Dispositivo marcato come `In Uso`, prestito registrato nello storico |
| **TC-LOA-02** | Calcolo Alert Scadenza & Ritardo | Testare prestito con data rientro superata | Evidenziazione in rosso "Scaduto", incremento contatore prestiti critici |
| **TC-LOA-03** | Restituzione & Reintegro Magazzino | Cliccare "Restituisci" nella scheda del prestito | Prestito chiuso con data rientro effettiva, dispositivo torna `Disponibile` |

---

### Area 5: Ticketing & Assistenza Tecnica

| ID Caso | Titolo del Test | Procedura Operativa | Risultato Atteso |
| :--- | :--- | :--- | :--- |
| **TC-TCK-01** | Creazione Ticket Utente | L'utente invia segnalazione guasto su PC personale | Notifica ticket aperto in lista, priorità visualizzata correttamente |
| **TC-TCK-02** | Presa in Carico ("In Carico") | Il Tecnico clicca "In Carico" | Campo `assignedTo` valorizzato con l'ID del tecnico, stato aggiornato |
| **TC-TCK-03** | Risoluzione con Sostituzione Hardware | Tecnico chiude il ticket assegnando dispositivo sostitutivo | Ticket segnato come `Risolto`, matricola aggiornata nel profilo utente |
| **TC-TCK-04** | Azioni di Massa (Bulk Actions) | Selezionare 3 ticket e applicare "Archivia" o "Risolto" in blocco | Aggiornamento batch atomico su Firestore e pulizia selezione |

---

## 3. Strumenti Operativi da Integrare

Per facilitare l'esecuzione del piano e garantire un monitoraggio continuo della qualità:

1. **Console di Collaudo QA Integrata (`/qa-test`)**:
   - Pagina protetta (accessibile da Amministratori e Tecnici) contenente la checklist interattiva dei 20 casi di test.
   - Tracciamento dello stato di superamento (`Passato` / `In Corso` / `Fallito`) con salvataggio locale o su Firestore.
   - Possibilità di inserire note e screenshot per eventuali anomalie riscontrate.
2. **Generatore Dati Demo Isolati (Data Seeder)**:
   - Pulsante di caricamento rapido di 3 dispositivi campione, 3 consumabili e 2 ticket di test con prefisso `[TEST]`.
   - Pulsante di pulizia immediata con un clic per rimuovere tutti i dati con prefisso `[TEST]`.
3. **Simulatore Rapido di Ruolo (Testing View Switcher)**:
   - Selettore nella Console QA per simulare la visualizzazione dell'interfaccia dal punto di vista di un **Utente Standard**, un **Tecnico** o un **Admin**.

---

## 4. Fasi di Rilascio & Esecuzione

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Fase 1: Setup   │ ──> │ Fase 2: Collaudo │ ──> │ Fase 3: Stress   │ ──> │ Fase 4: Report  │
│ Dati Demo & QA  │     │ Funzionale       │     │ & Permessi       │     │ Finale QA       │
└─────────────────┘     └──────────────────┘     └──────────────────┘     └─────────────────┘
```

1. **Fase 1 - Configurazione Ambiente**: Attivazione della pagina QA e caricamento dei dati di prova.
2. **Fase 2 - Esecuzione Checklist**: Collaudo manuale ordinato delle Aree 1-5 spuntando le voci nella Console.
3. **Fase 3 - Verifica Sicurezza**: Test con account a privilegi ridotti per confermare la robustezza delle regole Firestore.
4. **Fase 4 - Pulizia & Report**: Rimozione dei dati fittizi ed esportazione del verbale di collaudo.
