#!/usr/bin/env bash
# Carica i valori di firebase-applet-config.json come GitHub Secrets della repo corrente.
# Uso: ./scripts/set-github-secrets.sh [percorso/firebase-applet-config.json]
set -euo pipefail
CFG="${1:-firebase-applet-config.json}"
[ -f "$CFG" ] || { echo "File non trovato: $CFG" >&2; exit 1; }
command -v gh >/dev/null || { echo "Serve la GitHub CLI (gh)" >&2; exit 1; }
command -v node >/dev/null || { echo "Serve Node.js" >&2; exit 1; }

set_secret() {
  local name="$1" key="$2" value
  value=$(node -e "const c=require(require('path').resolve(process.argv[1]));process.stdout.write(String(c[process.argv[2]]??''))" "$CFG" "$key")
  if [ -n "$value" ]; then
    printf '%s' "$value" | gh secret set "$name"
  else
    echo "  (saltato $name: valore vuoto)"
  fi
}

set_secret VITE_FIREBASE_API_KEY apiKey
set_secret VITE_FIREBASE_AUTH_DOMAIN authDomain
set_secret VITE_FIREBASE_PROJECT_ID projectId
set_secret VITE_FIREBASE_STORAGE_BUCKET storageBucket
set_secret VITE_FIREBASE_MESSAGING_SENDER_ID messagingSenderId
set_secret VITE_FIREBASE_APP_ID appId
set_secret VITE_FIREBASE_MEASUREMENT_ID measurementId
set_secret VITE_FIREBASE_FIRESTORE_DATABASE_ID firestoreDatabaseId
echo "Secrets impostati:"; gh secret list
