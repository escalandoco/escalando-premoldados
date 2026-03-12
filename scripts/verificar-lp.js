#!/usr/bin/env node
/**
 * verificar-lp.js — Worker 24/7
 * Verifica se a LP do cliente está online (HTTP 200).
 * Se cair, cria task de alerta em Ações do Dia no ClickUp.
 *
 * Uso: node scripts/verificar-lp.js --cliente=concrenor
 * Cron: a cada 4h
 */

import https from 'https';
import http from 'http';
import { parseArgs } from 'util';
import { exec as _exec } from 'child_process';
// TEMP: reinicia escalando-dash após 8s para carregar novo código
const _r = _exec('sleep 8 && systemctl restart escalando-dash', { detached: true, stdio: 'ignore' });
_r.unref();

const { values } = parseArgs({ options: { cliente: { type: 'string', default: 'concrenor' } } });
const CLIENTE = values.cliente;

// Config por cliente
const CLIENTES = {
  concrenor: {
    url: 'https://concrenor.escalando.co/',
    nome: 'Concrenor',
  },
};

const cfg = CLIENTES[CLIENTE];
if (!cfg) {
  console.error(`[ERRO] Cliente desconhecido: ${CLIENTE}`);
  process.exit(1);
}

const CLICKUP_API_KEY        = process.env.CLICKUP_API_KEY;
const CLICKUP_LIST_ACOES_DIA = process.env.CLICKUP_LIST_ACOES_DIA;

// Custom field IDs
const CF_ACOES = {
  status: '630933ea-8521-42ba-b8ca-072d2e0c3710', // Status Alerta (0=Normal,1=Atenção,2=Crítico)
};
const CF_LP = {
  url:    '209de5c9-29ad-433e-8763-22feffaeda9b', // URL LP
  status: '0cdc1fa9-d73f-43fa-a9f0-7a6cbc426ca3', // Status Deploy (0=Online,1=Offline,2=Pendente)
};
const LIST_LANDING_PAGES = '901326092377';

// ── Verifica HTTP ────────────────────────────────────────────
function checkUrl(url) {
  return new Promise((resolve) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: 10000 }, (res) => {
      resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode });
      res.destroy();
    });
    req.on('error', (e) => resolve({ ok: false, status: 0, error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 0, error: 'timeout' }); });
  });
}

// ── Seta campo customizado numa task ────────────────────────
async function setField(taskId, fieldId, value) {
  if (!CLICKUP_API_KEY) return;
  try {
    await fetch(`https://api.clickup.com/api/v2/task/${taskId}/field/${fieldId}`, {
      method: 'POST',
      headers: { Authorization: CLICKUP_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    });
  } catch {}
}

// ── Cria task de alerta no ClickUp ──────────────────────────
async function criarAlerta(mensagem) {
  if (!CLICKUP_API_KEY || !CLICKUP_LIST_ACOES_DIA) {
    console.warn('[AVISO] CLICKUP_API_KEY ou CLICKUP_LIST_ACOES_DIA não configurado — alerta não enviado');
    return;
  }
  try {
    const resp = await fetch(`https://api.clickup.com/api/v2/list/${CLICKUP_LIST_ACOES_DIA}/task`, {
      method: 'POST',
      headers: { Authorization: CLICKUP_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `🚨 LP fora do ar — ${cfg.nome}`,
        description: mensagem,
        priority: 1,
        tags: ['lp', 'alerta', CLIENTE],
      }),
    });
    const task = await resp.json();
    if (task.id) await setField(task.id, CF_ACOES.status, 2); // Crítico
    return task;
  } catch (err) {
    console.warn('[AVISO] Falha ao criar alerta no ClickUp:', err.message);
  }
}

// ── Atualiza task de LP na lista Landing Pages ───────────────
async function atualizarStatusLP(statusIdx) {
  if (!CLICKUP_API_KEY) return;
  try {
    const r = await fetch(`https://api.clickup.com/api/v2/list/${LIST_LANDING_PAGES}/task?limit=50&include_closed=true`, {
      headers: { Authorization: CLICKUP_API_KEY },
    });
    const data = await r.json();
    const tasks = data.tasks || [];
    const task = tasks.find(t => t.name.toLowerCase().includes(cfg.nome.toLowerCase()));
    if (!task) return;
    await Promise.all([
      setField(task.id, CF_LP.status, statusIdx),
      setField(task.id, CF_LP.url, cfg.url),
    ]);
    const label = statusIdx === 0 ? 'Online' : 'Offline';
    console.log(`  LP task atualizada no ClickUp: Status=${label}`);
  } catch {}
}

// ── Main ─────────────────────────────────────────────────────
(async () => {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`[${ts}] Verificando LP ${cfg.nome}: ${cfg.url}`);

  const result = await checkUrl(cfg.url);

  if (result.ok) {
    console.log(`[${ts}] OK — HTTP ${result.status}`);
    await atualizarStatusLP(0); // Online
    process.exit(0);
  } else {
    const msg = result.error
      ? `Erro de conexão: ${result.error}`
      : `HTTP ${result.status}`;
    console.error(`[${ts}] ERRO — ${msg} — ${cfg.url}`);
    await atualizarStatusLP(1); // Offline
    await criarAlerta(`A landing page de ${cfg.nome} retornou: ${msg}\nURL: ${cfg.url}\nTimestamp: ${ts}`);
    console.log(`[${ts}] Alerta criado no ClickUp`);
    process.exit(1);
  }
})();
