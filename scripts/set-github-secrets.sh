#!/usr/bin/env bash
# Carica l'intero firebase-applet-config.json come secret FIREBASE_APPLET_CONFIG.
# Uso: ./scripts/set-github-secrets.sh [percorso/firebase-applet-config.json]
# In alternativa: GitHub > Settings > Secrets and variables > Actions > New repository secret,
# nome FIREBASE_APPLET_CONFIG, valore = contenuto del file incollato così com'è.
set -euo pipefail
CFG="${1:-firebase-applet-config.json}"
[ -f "$CFG" ] || { echo "File non trovato: $CFG" >&2; exit 1; }
command -v gh >/dev/null || { echo "Serve la GitHub CLI (gh)" >&2; exit 1; }
gh secret set FIREBASE_APPLET_CONFIG < "$CFG"
gh secret list
