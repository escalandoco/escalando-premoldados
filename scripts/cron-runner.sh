#!/bin/bash
# ── Wrapper para rodar Workers com .env carregado ──────────────
# Uso: cron-runner.sh <script> <cliente>
# Ex:  cron-runner.sh monitorar-ads concrenor

SCRIPT="$1"
CLIENTE="$2"
DIR="/opt/escalando-premoldados"

if [ -z "$SCRIPT" ] || [ -z "$CLIENTE" ]; then
  echo "Uso: cron-runner.sh <script> <cliente>"
  exit 1
fi

# Carrega .env
set -a
source "$DIR/.env"
set +a

cd "$DIR"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Iniciando $SCRIPT --cliente=$CLIENTE"
node "scripts/$SCRIPT.js" --cliente="$CLIENTE"
EXIT_CODE=$?
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Concluído $SCRIPT (code $EXIT_CODE)"
exit $EXIT_CODE
