#!/bin/bash
# ── Atualiza o projeto no VPS ──────────────────────────────────
# Uso: bash scripts/atualizar-vps.sh [token]

DIR="/opt/escalando-premoldados"
GITHUB_TOKEN="${1:-}"

cd "$DIR"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Atualizando projeto..."

if [ -n "$GITHUB_TOKEN" ]; then
  git remote set-url origin "https://${GITHUB_TOKEN}@github.com/escalandoco/escalando-premoldados.git"
fi

git pull origin main
npm install --omit=dev > /dev/null

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Atualizado para: $(git log --oneline -1)"

# Limpa o token da URL se foi passado
if [ -n "$GITHUB_TOKEN" ]; then
  git remote set-url origin "https://github.com/escalandoco/escalando-premoldados.git"
fi
