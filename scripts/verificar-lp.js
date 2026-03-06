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

// ── Cria task de alerta no ClickUp ──────────────────────────
async function criarAlerta(mensagem) {
  if (!CLICKUP_API_KEY || !CLICKUP_LIST_ACOES_DIA) {
    console.warn('[AVISO] CLICKUP_API_KEY ou CLICKUP_LIST_ACOES_DIA não configurado — alerta não enviado');
    return;
  }
  const body = JSON.stringify({
    name: `🚨 LP fora do ar — ${cfg.nome}`,
    description: mensagem,
    priority: 1, // urgent
    tags: ['lp', 'alerta', CLIENTE],
  });
  const url = new URL(`https://api.clickup.com/api/v2/list/${CLICKUP_LIST_ACOES_DIA}/task`);
  return new Promise((resolve) => {
    const req = https.request(url, {
      method: 'POST',
      headers: { Authorization: CLICKUP_API_KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', resolve);
    req.write(body);
    req.end();
  });
}

// ── Main ─────────────────────────────────────────────────────
(async () => {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`[${ts}] Verificando LP ${cfg.nome}: ${cfg.url}`);

  const result = await checkUrl(cfg.url);

  if (result.ok) {
    console.log(`[${ts}] OK — HTTP ${result.status}`);
    process.exit(0);
  } else {
    const msg = result.error
      ? `Erro de conexão: ${result.error}`
      : `HTTP ${result.status}`;
    console.error(`[${ts}] ERRO — ${msg} — ${cfg.url}`);
    await criarAlerta(`A landing page de ${cfg.nome} retornou: ${msg}\nURL: ${cfg.url}\nTimestamp: ${ts}`);
    console.log(`[${ts}] Alerta criado no ClickUp`);
    process.exit(1);
  }
})();
