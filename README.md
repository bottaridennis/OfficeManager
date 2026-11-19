<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/c4529a1a-6146-453a-a4f9-3ae16d4ea882

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`


## Design system (restyle 2026)

L'interfaccia usa un design system condiviso:

- **`src/index.css`** — token di tema (Tailwind v4 `@theme`): palette brand *iris* (rimappata su `blue-*`), neutri (rimappati su `slate-*`), font Geist / Geist Mono, ombre, raggi, animazioni. Classi di componente: `btn` (`btn-primary`, `btn-secondary`, `btn-ghost`, `btn-danger`, `btn-danger-soft`, `btn-soft`, `btn-sm`), `icon-btn`, `card`, `card-header`, `input`, `select`, `field-label`, `badge` (`badge-success`, `badge-warning`, `badge-danger`, `badge-brand`, `badge-neutral`, `badge-dot`), `data-table`, `segmented`, `skeleton`, `kbd`.
- **`src/components/ui.tsx`** — componenti React riutilizzabili: `PageHeader`, `PageBody`, `PageLoader`, `EmptyState`, `SearchInput`, `StatCard`, `Modal`, `DropdownMenu`, `Avatar`, `DeviceStatusBadge`.

Per una nuova pagina: `PageHeader` (titolo, descrizione, azioni) + `PageBody` con dentro una `card`.

## Configurazione Firebase

La configurazione Firebase **non è nel repository**: viene letta dalle variabili `VITE_FIREBASE_*` (vedi `.env.example`).

- **In locale:** crea `.env.local` copiando `.env.example` e compilando i valori.
- **Su GitHub:** basta un solo *Actions secret* chiamato `FIREBASE_APPLET_CONFIG`, con dentro il contenuto di `firebase-applet-config.json` incollato così com'è (Settings → Secrets and variables → Actions → New repository secret). In alternativa: `./scripts/set-github-secrets.sh percorso/firebase-applet-config.json` (richiede `gh auth login`).
- Il workflow `.github/workflows/build.yml` legge quel secret, genera le variabili `VITE_FIREBASE_*` e compila l'app.
