#!/bin/bash
# ── ESCALANDO PREMOLDADOS — Setup VPS ──────────────────────────
# Roda uma vez no VPS para configurar tudo
# Uso: bash scripts/setup-vps.sh

set -e
REPO="https://github.com/escalandoco/escalando-premoldados.git"
DIR="/opt/escalando-premoldados"
GITHUB_TOKEN="${1:-}"

echo ""
echo "  Escalando Premoldados — Setup VPS"
echo "  Ubuntu $(lsb_release -rs) — $(date '+%Y-%m-%d %H:%M')"
echo ""

# ── 1. Sistema ──────────────────────────────────────────────────
echo "[ 1/6 ] Atualizando sistema..."
apt-get update -qq && apt-get upgrade -y -qq

# ── 2. Node.js 22 ───────────────────────────────────────────────
echo "[ 2/6 ] Instalando Node.js 22..."
curl -fsSL https://deb.nodesource.com/setup_22.x | bash - > /dev/null
apt-get install -y nodejs git > /dev/null
echo "        Node $(node -v) | npm $(npm -v)"

# ── 3. Clonar repositório ───────────────────────────────────────
echo "[ 3/6 ] Clonando repositório..."
if [ -d "$DIR" ]; then
  echo "        Já existe — fazendo git pull..."
  cd "$DIR" && git pull origin main
else
  if [ -n "$GITHUB_TOKEN" ]; then
    CLONE_URL="https://${GITHUB_TOKEN}@github.com/escalandoco/escalando-premoldados.git"
  else
    CLONE_URL="$REPO"
  fi
  git clone "$CLONE_URL" "$DIR"
fi
cd "$DIR"

# ── 4. Dependências ─────────────────────────────────────────────
echo "[ 4/6 ] Instalando dependências npm..."
npm install --omit=dev > /dev/null

# ── 5. .env ─────────────────────────────────────────────────────
echo "[ 5/6 ] Configurando .env..."
if [ ! -f "$DIR/.env" ]; then
  cp "$DIR/.env.example" "$DIR/.env"
  echo "        .env criado a partir do .env.example"
  echo "        ATENÇÃO: edite o .env com as credenciais reais"
  echo "        nano $DIR/.env"
else
  echo "        .env já existe — mantido sem alterações"
fi

# ── 6. Crontab ──────────────────────────────────────────────────
echo "[ 6/6 ] Configurando crontab..."
CRON_CMD="$DIR/scripts/cron-runner.sh"
(crontab -l 2>/dev/null | grep -v "escalando-premoldados"; cat << CRONS
# Escalando Premoldados — Workers 24/7
# Monitorar anúncios — todo dia 08h BRT (11h UTC)
0 11 * * * $CRON_CMD monitorar-ads concrenor >> /var/log/escalando-monitorar.log 2>&1
# Relatório de performance — dia 1 e 15 às 08h BRT
0 11 1,15 * * $CRON_CMD relatorio-ads concrenor >> /var/log/escalando-relatorio.log 2>&1
# Exportar leads — toda segunda 08h BRT
0 11 * * 1 $CRON_CMD exportar-leads-meta concrenor >> /var/log/escalando-leads.log 2>&1
CRONS
) | crontab -
echo "        3 cron jobs configurados"

chmod +x "$DIR/scripts/cron-runner.sh"
chmod +x "$DIR/scripts/atualizar-vps.sh"

echo ""
echo "  ✓ Setup concluído!"
echo ""
echo "  Próximos passos:"
echo "  1. Preencher credenciais: nano $DIR/.env"
echo "  2. Testar um Worker:      $DIR/scripts/cron-runner.sh monitorar-ads concrenor"
echo "  3. Ver logs:              tail -f /var/log/escalando-monitorar.log"
echo "  4. Atualizar código:      $DIR/scripts/atualizar-vps.sh"
echo ""
