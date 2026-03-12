/**
 * ESCALANDO PREMOLDADOS — LP Gate Engine
 *
 * Gates de automação do pipeline de Landing Page:
 *   Gate LP-1 → 📝 LP Briefing → complete → cria pipeline Fase 1–5
 *   Gate LP-2 → [FASE 1] DNA do Cliente → complete → gera copy
 *   Gate LP-3 → [FASE 2] Copy da LP → complete → gera sugestão visual
 *   Gate LP-4 → [FASE 3] Identidade Visual → complete → gera LP
 *   Gate LP-5 → [FASE 4] Geração da LP → complete → deploy
 *
 * Chamado por:
 *   api/clickup-status-change.js
 */

import { notifyMsg, MSG } from './notify.js';

const CLICKUP_API_KEY = process.env.CLICKUP_API_KEY;
const SPACE_CLIENTES  = process.env.CLICKUP_SPACE_ID || '901313553858';
const BASE_URL        = 'https://api.clickup.com/api/v2';
const VPS_URL         = (process.env.VPS_URL || 'http://129.121.45.61:3030').trim();
const WORKER_SECRET   = (process.env.WORKER_SECRET || '').trim();
const ANTHROPIC_KEY   = process.env.ANTHROPIC_API_KEY;

const STATUS_DONE = ['complete', 'done', 'concluído', 'concluida', 'aprovado', 'no ar'];

function isDone(status) {
  return STATUS_DONE.some(s => (status || '').toLowerCase().includes(s));
}

// ── ClickUp helper ─────────────────────────────────────────────────────────
async function cu(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: method.toUpperCase(),
    headers: { Authorization: CLICKUP_API_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`ClickUp [${method} ${path}]: ${JSON.stringify(json)}`);
  return json;
}

// ── VPS run-worker helper ───────────────────────────────────────────────────
async function runWorker(script, cliente) {
  const res = await fetch(`${VPS_URL}/api/run-worker`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: WORKER_SECRET, script, cliente }),
  });
  return res.json().catch(() => ({ ok: false }));
}

// ── Log no dashboard ───────────────────────────────────────────────────────
async function logJob(script, cliente, status, step, error = null) {
  const entry = {
    secret:   WORKER_SECRET,
    id:       `${script}-${cliente.toLowerCase()}-${Date.now()}`,
    script,
    cliente:  cliente.toLowerCase(),
    status,
    progress: status === 'completed' ? 100 : 0,
    step,
    error,
  };
  await fetch(`${VPS_URL}/api/log-job`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
  }).catch(() => {});
}

// ── ClickUp helpers ────────────────────────────────────────────────────────
async function encontrarFolder(empresa) {
  const { folders } = await cu('get', `/space/${SPACE_CLIENTES}/folder?archived=false`);
  return folders.find(f => f.name.toLowerCase() === empresa.toLowerCase()) || null;
}

async function encontrarLista(folderId, nome) {
  const { lists } = await cu('get', `/folder/${folderId}/list?archived=false`);
  return lists.find(l => l.name.toLowerCase() === nome.toLowerCase()) || null;
}

async function encontrarTaskFase(listaId, numeroFase) {
  const { tasks } = await cu('get', `/list/${listaId}/task?archived=false&include_closed=true`);
  return tasks.find(t => t.name.startsWith(`[FASE ${numeroFase}]`)) || null;
}

async function postarComentario(taskId, texto) {
  await cu('post', `/task/${taskId}/comment`, { comment_text: texto }).catch(() => {});
}

// ============================================================
// GATE LP-1 — LP Briefing recebido → cria pipeline Fase 1–5
// ============================================================
export async function gateLp1(empresa) {
  console.log(`\n[Gate LP-1] Iniciando para: ${empresa}`);

  try {
    const folder = await encontrarFolder(empresa);
    if (!folder) throw new Error(`Folder "${empresa}" não encontrado.`);

    const listaLP = await encontrarLista(folder.id, 'Landing Pages');
    if (!listaLP) throw new Error('Lista "Landing Pages" não encontrada.');

    // Verifica se pipeline já existe
    const fase1Existente = await encontrarTaskFase(listaLP.id, 1);
    if (fase1Existente) {
      console.log('[Gate LP-1] Pipeline já existe — pulando criação.');
      return { ok: true, skip: true, motivo: 'Pipeline já existente.' };
    }

    // Cria pipeline via VPS (criar-pipeline-lp.js)
    const slug = empresa.toLowerCase();
    await runWorker('criar-pipeline-lp', slug);
    console.log('[Gate LP-1] Pipeline criado via VPS.');
    await logJob('gate-lp1-pipeline', empresa, 'completed', 'Pipeline criado (Fases 1–5 na lista Landing Pages)');

    // Notifica Jon
    await notifyMsg(MSG.gateLp1Jon(empresa)).catch(() => {});

    console.log('[Gate LP-1] ✅ PASSOU');
    return { ok: true };

  } catch (err) {
    console.error('[Gate LP-1] Erro:', err.message);
    await logJob('gate-lp1-pipeline', empresa, 'failed', 'Erro ao criar pipeline', err.message);
    await notifyMsg(MSG.erroSistema(empresa, 'Gate LP-1', err.message)).catch(() => {});
    return { ok: false, error: err.message };
  }
}

// ============================================================
// GATE LP-2 — Fase 1 (DNA) concluída → gera copy via Claude
// ============================================================
export async function gateLp2(empresa) {
  console.log(`\n[Gate LP-2] Iniciando para: ${empresa}`);

  try {
    const folder = await encontrarFolder(empresa);
    if (!folder) throw new Error(`Folder "${empresa}" não encontrado.`);

    const listaLP = await encontrarLista(folder.id, 'Landing Pages');
    if (!listaLP) throw new Error('Lista "Landing Pages" não encontrada.');

    // Valida Fase 1 concluída
    const fase1 = await encontrarTaskFase(listaLP.id, 1);
    if (!fase1 || !isDone(fase1.status?.status)) {
      const motivo = 'Fase 1 (DNA do Cliente) ainda não concluída.';
      console.warn('[Gate LP-2] BLOQUEADO:', motivo);
      return { ok: false, faltando: [motivo] };
    }

    // Dispara gerar-copy no VPS
    const slug = empresa.toLowerCase();
    await runWorker('gerar-copy', slug);
    console.log('[Gate LP-2] gerar-copy disparado via VPS.');
    await logJob('gate-lp2-copy', empresa, 'completed', 'Geração de copy disparada via gerar-copy.js');

    // Notifica Jon
    await notifyMsg(MSG.gateLp2Jon(empresa)).catch(() => {});

    console.log('[Gate LP-2] ✅ PASSOU');
    return { ok: true };

  } catch (err) {
    console.error('[Gate LP-2] Erro:', err.message);
    await logJob('gate-lp2-copy', empresa, 'failed', 'Erro ao disparar geração de copy', err.message);
    await notifyMsg(MSG.erroSistema(empresa, 'Gate LP-2', err.message)).catch(() => {});
    return { ok: false, error: err.message };
  }
}

// ============================================================
// GATE LP-3 — Fase 2 (Copy) concluída → gera sugestão visual
// ============================================================
export async function gateLp3(empresa) {
  console.log(`\n[Gate LP-3] Iniciando para: ${empresa}`);

  try {
    const folder = await encontrarFolder(empresa);
    if (!folder) throw new Error(`Folder "${empresa}" não encontrado.`);

    const listaLP = await encontrarLista(folder.id, 'Landing Pages');
    if (!listaLP) throw new Error('Lista "Landing Pages" não encontrada.');

    // Valida Fase 2 concluída
    const fase2 = await encontrarTaskFase(listaLP.id, 2);
    if (!fase2 || !isDone(fase2.status?.status)) {
      const motivo = 'Fase 2 (Copy) ainda não concluída.';
      console.warn('[Gate LP-3] BLOQUEADO:', motivo);
      return { ok: false, faltando: [motivo] };
    }

    // Gera sugestão visual com Claude (lp-visual agent)
    const sugestao = await gerarSugestaoVisual(empresa);

    // Posta na task Fase 3
    const fase3 = await encontrarTaskFase(listaLP.id, 3);
    if (fase3 && sugestao) {
      await postarComentario(fase3.id, sugestao);
      console.log('[Gate LP-3] Sugestão visual postada na Fase 3.');
    }

    await logJob('gate-lp3-visual', empresa, 'completed', 'Sugestão visual gerada e postada na Fase 3');

    // Notifica Jon
    await notifyMsg(MSG.gateLp3Jon(empresa)).catch(() => {});

    console.log('[Gate LP-3] ✅ PASSOU');
    return { ok: true };

  } catch (err) {
    console.error('[Gate LP-3] Erro:', err.message);
    await logJob('gate-lp3-visual', empresa, 'failed', 'Erro ao gerar identidade visual', err.message);
    await notifyMsg(MSG.erroSistema(empresa, 'Gate LP-3', err.message)).catch(() => {});
    return { ok: false, error: err.message };
  }
}

// ============================================================
// GATE LP-4 — Fase 3 (Visual) concluída → gera LP
// ============================================================
export async function gateLp4(empresa) {
  console.log(`\n[Gate LP-4] Iniciando para: ${empresa}`);

  try {
    const folder = await encontrarFolder(empresa);
    if (!folder) throw new Error(`Folder "${empresa}" não encontrado.`);

    const listaLP = await encontrarLista(folder.id, 'Landing Pages');
    if (!listaLP) throw new Error('Lista "Landing Pages" não encontrada.');

    const faltando = [];

    // Valida Fase 2 e Fase 3 concluídas
    const fase2 = await encontrarTaskFase(listaLP.id, 2);
    if (!fase2 || !isDone(fase2.status?.status)) faltando.push('Fase 2 (Copy) não concluída');

    const fase3 = await encontrarTaskFase(listaLP.id, 3);
    if (!fase3 || !isDone(fase3.status?.status)) faltando.push('Fase 3 (Identidade Visual) não concluída');

    if (faltando.length > 0) {
      console.warn('[Gate LP-4] BLOQUEADO:', faltando);
      await notifyMsg(MSG.gateLp4Falha(empresa, faltando)).catch(() => {});
      return { ok: false, faltando };
    }

    // Dispara gerar-lp no VPS
    const slug = empresa.toLowerCase();
    await runWorker('gerar-lp', slug);
    console.log('[Gate LP-4] gerar-lp disparado via VPS.');
    await logJob('gate-lp4-gerar', empresa, 'completed', 'Geração de LP disparada via gerar-lp.js');

    // Notifica Jon
    await notifyMsg(MSG.gateLp4Jon(empresa)).catch(() => {});

    console.log('[Gate LP-4] ✅ PASSOU');
    return { ok: true };

  } catch (err) {
    console.error('[Gate LP-4] Erro:', err.message);
    await logJob('gate-lp4-gerar', empresa, 'failed', 'Erro ao disparar geração de LP', err.message);
    await notifyMsg(MSG.erroSistema(empresa, 'Gate LP-4', err.message)).catch(() => {});
    return { ok: false, error: err.message };
  }
}

// ============================================================
// GATE LP-5 — Fase 4 (Geração) concluída → deploy
// ============================================================
export async function gateLp5(empresa) {
  console.log(`\n[Gate LP-5] Iniciando para: ${empresa}`);

  try {
    const folder = await encontrarFolder(empresa);
    if (!folder) throw new Error(`Folder "${empresa}" não encontrado.`);

    const listaLP = await encontrarLista(folder.id, 'Landing Pages');
    if (!listaLP) throw new Error('Lista "Landing Pages" não encontrada.');

    // Valida Fase 4 concluída
    const fase4 = await encontrarTaskFase(listaLP.id, 4);
    if (!fase4 || !isDone(fase4.status?.status)) {
      const motivo = 'Fase 4 (Geração da LP) ainda não concluída.';
      console.warn('[Gate LP-5] BLOQUEADO:', motivo);
      return { ok: false, faltando: [motivo] };
    }

    // Dispara deploy-lp no VPS
    const slug = empresa.toLowerCase();
    await runWorker('deploy-lp', slug);
    console.log('[Gate LP-5] deploy-lp disparado via VPS.');
    await logJob('gate-lp5-deploy', empresa, 'completed', 'Deploy de LP disparado via deploy-lp.js');

    // Notifica Jon
    await notifyMsg(MSG.gateLp5Jon(empresa)).catch(() => {});

    console.log('[Gate LP-5] ✅ PASSOU');
    return { ok: true };

  } catch (err) {
    console.error('[Gate LP-5] Erro:', err.message);
    await logJob('gate-lp5-deploy', empresa, 'failed', 'Erro ao disparar deploy', err.message);
    await notifyMsg(MSG.erroSistema(empresa, 'Gate LP-5', err.message)).catch(() => {});
    return { ok: false, error: err.message };
  }
}

// ============================================================
// Geração de sugestão visual — lp-visual agent (Claude Haiku)
// ============================================================
async function gerarSugestaoVisual(empresa) {
  if (!ANTHROPIC_KEY) {
    console.warn('[Gate LP-3] ANTHROPIC_API_KEY não configurada — pulando sugestão visual.');
    return null;
  }

  try {
    const prompt = `Você é um especialista em identidade visual para empresas industriais brasileiras.

A empresa "${empresa}" fabrica pré-moldados de concreto (cerca, laje, bloco, mourão, piso intertravado).
Público: pedreiros, proprietários rurais, construtoras — região Nordeste/Sudeste.

Sugira uma identidade visual para a landing page de captação de leads.

Responda EXATAMENTE neste formato (sem markdown, sem explicações adicionais):

COR PRIMÁRIA: #[hex]
COR SECUNDÁRIA: #[hex]
COR TEXTO: #[hex]
COR FUNDO: #[hex]
ESTILO: [clean|industrial|rustico|bold]
FONTE: [nome da fonte Google]
PROMPT FOTO HERO: [prompt em inglês para gerar foto de destaque com IA]
PROMPT FOTO PRODUTO: [prompt em inglês para foto do produto em uso]
JUSTIFICATIVA: [1 linha explicando as escolhas]`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const data = await res.json();
    const texto = data.content?.[0]?.text || '';

    return [
      `🎨 Sugestão Visual — ${empresa}`,
      `Gerado automaticamente pelo lp-visual (Visual Generator + Brad Frost):`,
      ``,
      texto,
      ``,
      `---`,
      `Revise e ajuste conforme a identidade do cliente.`,
      `Após aprovar, marque esta fase como concluída.`,
    ].join('\n');

  } catch (err) {
    console.warn('[Gate LP-3] Falha ao chamar Claude:', err.message);
    return null;
  }
}
