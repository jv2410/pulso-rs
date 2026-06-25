#!/bin/bash
# Pipeline diário completo: sync (janela D-1) → audit banner-bug → categorize.
# Agendado via LaunchAgent com.scraper.sync (07:00 e 18:30, todos os dias).
# Logs em logs/cron-sync-YYYY-MM-DD-HHMM.log; alerta (exit 1 + .ALERT) se 0 inserts em dia útil.
set -uo pipefail
cd /Users/macos/automation-scraper

export PATH="/Users/macos/.nvm/versions/node/v20.19.0/bin:/usr/local/bin:/usr/bin:/bin"

TODAY="$(date +%F)"
YESTERDAY="$(date -v-1d +%F)"
STAMP="$(date +%F-%H%M)"
mkdir -p logs
LOG="logs/cron-sync-${STAMP}.log"

echo "=== run-daily-sync ${STAMP} (TODAY=${TODAY}) ===" >> "$LOG"

# Evitar runs concorrentes
if pgrep -f "sync-today-strict.js" > /dev/null; then
  echo "SKIP: sync já em execução" >> "$LOG"
  exit 0
fi

node sync-today-strict.js "$TODAY" >> "$LOG" 2>&1
SYNC_EXIT=$?
echo "--- sync exit=${SYNC_EXIT} ---" >> "$LOG"

# Pipeline para hoje E ontem (janela D-1 pode ter inserido em ambos).
# Ordem importa: audit ANTES de categorize (evita race em datas).
# audit v2 (Atlas 2026-06-25): detecção corrigida (estruturada > rótulo > data crua,
# JSON-LD, container .noticia) e BACKWARD-ONLY — corrige "antiga como nova" que o v1
# deixava passar. DRY_RUN=false para APLICAR (o default do script é dry-run seguro).
for D in "$TODAY" "$YESTERDAY"; do
  DRY_RUN=false node audit-banner-bug-v2.js "$D" >> "$LOG" 2>&1
done
for D in "$TODAY" "$YESTERDAY"; do
  node categorize-today.js "$D" >> "$LOG" 2>&1
done

# Alerta: inserts zerados em dia útil (seg-sex) é anomalia
INSERTS=$(grep -o 'INSERIDOS novos: [0-9]*' "$LOG" | head -1 | grep -o '[0-9]*$' || echo 0)
DOW=$(date +%u)
echo "--- inserts=${INSERTS} dow=${DOW} ---" >> "$LOG"
if [ "$DOW" -le 5 ] && [ "${INSERTS:-0}" -eq 0 ]; then
  echo "ALERTA: 0 inserts em dia útil — investigar" >> "$LOG"
  touch "logs/.ALERT-${STAMP}"
  exit 1
fi
exit 0
