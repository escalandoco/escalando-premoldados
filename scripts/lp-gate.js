/**
 * ESCALANDO PREMOLDADOS — LP Gate Engine
 *
 * Gates de automação do pipeline de Landing Page:
 *   Gate LP-1 → 📝 LP Briefing → complete → valida config + cria pipeline + lp-ux posta estrutura
 *   Gate LP-2 → [FASE 1] DNA do Cliente → complete → quality gate + gera copy (4 experts) + posta
 *   Gate LP-3 → [FASE 2] Copy da LP → complete → valida config + gera visual + salva JSON
 *   Gate LP-4 → [FASE 3] Identidade Visual → complete → quality gate + gera LP + posta checklist
 *   Gate LP-5 → [FASE 4] Geração da LP → complete → quality gate + deploy + verifica URL
 *
 * Chamado por:
 *   api/clickup-status-change.js
 */

import { notifyMsg, MSG } from './notify.js';
import { verificarGate } from './quality-gate.js';

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

// ── VPS config helpers ─────────────────────────────────────────────────────
async function readConfig(slug, type = 'lp') {
  try {
    const res = await fetch(`${VPS_URL}/api/read-config?cliente=${slug}&type=${type}`, {
      headers: { 'x-worker-secret': WORKER_SECRET },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function saveConfig(slug, type, data) {
  await fetch(`${VPS_URL}/api/save-config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: WORKER_SECRET, cliente: slug, type, data }),
  }).catch(() => {});
}

// ── Config validation ──────────────────────────────────────────────────────
function validarCamposObrig(config, campos) {
  const faltando = [];
  for (const campo of campos) {
    const val = config?.[campo];
    if (!val) { faltando.push(campo); continue; }
    if (typeof val === 'string' && val.toUpperCase().includes('A DEFINIR')) faltando.push(campo);
    if (Array.isArray(val) && val.length === 0) faltando.push(campo);
  }
  return faltando;
}

function temCamposIndefinidos(config, camposChave = ['headline']) {
  for (const campo of camposChave) {
    const val = config?.[campo];
    if (typeof val === 'string' && val.toUpperCase().includes('A DEFINIR')) return true;
  }
  return false;
}

// ── URL verification ──────────────────────────────────────────────────────
async function verificarUrl(url) {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(10000),
    });
    return { ok: res.ok, status: res.status, ssl: url.startsWith('https') };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ── Shared Claude caller ───────────────────────────────────────────────────
async function callClaude(prompt, maxTokens = 600) {
  if (!ANTHROPIC_KEY) return null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await res.json();
    return data.content?.[0]?.text || null;
  } catch {
    return null;
  }
}

// ── lp-ux: gera estrutura de seções para [FASE 1] ─────────────────────────
async function gerarEstruturaUx(empresa, config) {
  if (!ANTHROPIC_KEY) {
    console.warn('[Gate LP-1] ANTHROPIC_API_KEY não configurada — pulando estrutura UX.');
    return null;
  }
  const produtos = config?.produtos?.map(p => p.nome).join(', ') || 'pré-moldados de concreto';
  const publico  = config?.perfil_clientes || 'pedreiros, construtoras, proprietários rurais';
  const cidade   = config?.cidade || 'Nordeste/Sudeste';

  const prompt = `Você é lp-ux (Uma), especialista em estrutura de landing pages para empresas industriais brasileiras.

Empresa: ${empresa}
Produtos: ${produtos}
Cidade/Região: ${cidade}
Público: ${publico}

Defina a estrutura completa da LP (seções, ordem e objetivo de cada bloco).
Seja objetivo. O público é prático — pedreiro, proprietário rural, construtora pequena.

Responda EXATAMENTE neste formato (6 seções fixas):

SEÇÃO 1 — HERO
Objetivo: [1 linha]
Elementos: [lista separada por | ]

SEÇÃO 2 — PROBLEMA
Objetivo: [1 linha]
Elementos: [lista separada por | ]

SEÇÃO 3 — SOLUÇÃO
Objetivo: [1 linha]
Elementos: [lista separada por | ]

SEÇÃO 4 — PROVA SOCIAL
Objetivo: [1 linha]
Elementos: [lista separada por | ]

SEÇÃO 5 — COMO FUNCIONA
Objetivo: [1 linha]
Elementos: [lista separada por | ]

SEÇÃO 6 — CTA FINAL
Objetivo: [1 linha]
Elementos: [lista separada por | ]

POSICIONAMENTO CTA: [onde aparece e quantas vezes]
PRODUTO FOCO: [qual produto/benefício deve liderar]`;

  const texto = await callClaude(prompt, 900);
  if (!texto) return null;

  return [
    `📐 Estrutura da LP — ${empresa}`,
    `Definida automaticamente por lp-ux (Uma):`,
    ``,
    texto,
    ``,
    `---`,
    `Revise a estrutura e dê ok para liberar a geração de copy (Fase 2).`,
    `Marque esta task como concluída quando aprovado.`,
  ].join('\n');
}

// ── lp-copywriter: gera copy com 4 experts para [FASE 2] ──────────────────
function extrairCampo(texto, campo) {
  if (!texto) return null;
  const re = new RegExp(`${campo}:\\s*([^\\n|]+)`, 'i');
  return texto.match(re)?.[1]?.trim() || null;
}

async function gerarCopyCompleta(empresa, config) {
  if (!ANTHROPIC_KEY) {
    console.warn('[Gate LP-2] ANTHROPIC_API_KEY não configurada — pulando geração de copy.');
    return null;
  }

  const produto    = config?.produtos?.[0]?.nome || 'pré-moldados';
  const cidade     = config?.cidade || 'Nordeste';
  const difs       = config?.diferenciais?.map(d => d.titulo).join(', ') || '';
  const numeros    = config?.numeros?.map(n => `${n.valor} ${n.label}`).join(', ') || '';
  const publico    = config?.perfil_clientes || 'pedreiros e construtoras';

  // Contexto do Gate LP-1: produto foco e estrutura de seções aprovada
  const uxBlueprint = config?.ux_estrutura
    ? `\n\nEstrutura de seções aprovada por lp-ux:\n${config.ux_estrutura}`
    : '';

  const ctx = `Empresa: ${empresa} | Produto: ${produto} | Cidade: ${cidade} | Diferenciais: ${difs} | Números: ${numeros} | Público: ${publico}${uxBlueprint}`;

  try {
    // 4 chamadas em paralelo — um expert por vez
    const [halbert, kennedy, hopkins, carlton] = await Promise.all([
      callClaude(
        `Você é Gary Halbert adaptado para pré-moldados brasileiros.\n${ctx}\n\nEscreva o hook emocional e headline SSS (Star, Story, Solution) para o hero da LP.\nLinguagem direta, prática, sem enrolação. Público: pedreiro e proprietário rural.\nFormato: HOOK: [texto] | HEADLINE SSS: [texto] | SUBHEADLINE: [texto]`,
        400
      ),
      callClaude(
        `Você é Dan Kennedy adaptado para pré-moldados brasileiros.\n${ctx}\n\nEscreva a estrutura PAS (Problem, Agitate, Solution) para a seção de problema + CTA com urgência.\nFoco em: por que comprar desta empresa e não do concorrente.\nFormato: PROBLEMA: [texto] | AGITAÇÃO: [texto] | SOLUÇÃO: [texto] | CTA: [texto]`,
        400
      ),
      callClaude(
        `Você é Claude Hopkins adaptado para pré-moldados brasileiros.\n${ctx}\n\nEscreva 3 claims específicos com números e fatos concretos para a seção de diferenciais.\nUse dados reais. Ex: "mourão que agüenta 30 anos", "entrega em até 48h".\nFormato: CLAIM 1: [texto] | CLAIM 2: [texto] | CLAIM 3: [texto]`,
        350
      ),
      callClaude(
        `Você é John Carlton adaptado para pré-moldados brasileiros.\n${ctx}\n\nEscreva a headline definitiva "gun to the head" — 1 headline que captura o maior benefício real.\nDepois escreva o P.S. para reforçar a oferta no final da página.\nFormato: HEADLINE FINAL: [texto] | PS: [texto]`,
        300
      ),
    ]);

    if (!halbert && !kennedy && !hopkins && !carlton) return null;

    const copy = {
      headline:     extrairCampo(carlton, 'HEADLINE FINAL') || extrairCampo(halbert, 'HEADLINE SSS') || 'A DEFINIR',
      subheadline:  extrairCampo(halbert, 'SUBHEADLINE') || 'A DEFINIR',
      hook:         extrairCampo(halbert, 'HOOK') || 'A DEFINIR',
      problema:     extrairCampo(kennedy, 'PROBLEMA') || 'A DEFINIR',
      agitacao:     extrairCampo(kennedy, 'AGITAÇÃO') || 'A DEFINIR',
      solucao:      extrairCampo(kennedy, 'SOLUÇÃO') || 'A DEFINIR',
      cta_principal: extrairCampo(kennedy, 'CTA') || `Peça seu orçamento agora pelo WhatsApp`,
      claims: [
        extrairCampo(hopkins, 'CLAIM 1'),
        extrairCampo(hopkins, 'CLAIM 2'),
        extrairCampo(hopkins, 'CLAIM 3'),
      ].filter(Boolean),
      ps: extrairCampo(carlton, 'PS') || '',
    };

    const texto = [
      `✍️ Copy gerada pelos 4 especialistas — ${empresa}`,
      ``,
      `📌 HEADLINE FINAL (Carlton — "gun to the head"):`,
      copy.headline,
      ``,
      `📌 HERO (Halbert — SSS):`,
      `Hook: ${copy.hook}`,
      `Subheadline: ${copy.subheadline}`,
      ``,
      `📌 PROBLEMA/PAS (Kennedy):`,
      `Problema: ${copy.problema}`,
      `Agitação: ${copy.agitacao}`,
      `Solução: ${copy.solucao}`,
      `CTA: ${copy.cta_principal}`,
      ``,
      `📌 DIFERENCIAIS (Hopkins — claims com números):`,
      ...copy.claims.map((c, i) => `${i + 1}. ${c}`),
      ``,
      `📌 P.S. (Carlton):`,
      copy.ps,
      ``,
      `---`,
      `Revise os textos e ajuste conforme necessário.`,
      `Marque como concluída para liberar a Fase 3 (Identidade Visual).`,
    ].join('\n');

    return { copy, texto };
  } catch (err) {
    console.warn('[Gate LP-2] Falha ao gerar copy:', err.message);
    return null;
  }
}

// ── lp-visual: gera identidade visual para [FASE 3] ───────────────────────
async function gerarSugestaoVisual(empresa, config) {
  if (!ANTHROPIC_KEY) {
    console.warn('[Gate LP-3] ANTHROPIC_API_KEY não configurada — pulando sugestão visual.');
    return { texto: null, json: null };
  }

  const produto  = config?.produtos?.[0]?.nome || 'pré-moldados de concreto';
  const estiloAtual = config?.estilo || 'não definido';
  const corAtual    = config?.cor_primaria || 'não definida';

  // Contexto do Gate LP-2: copy aprovada para alinhar tom visual
  const headline   = config?.headline && !config.headline.includes('A DEFINIR') ? config.headline : null;
  const hook       = config?.hook && !config.hook.includes('A DEFINIR') ? config.hook : null;
  const copyCtx    = headline
    ? `\nCopy aprovada:\n- Headline: "${headline}"${hook ? `\n- Hook: "${hook}"` : ''}`
    : '';

  const prompt = `Você é um especialista em identidade visual para empresas industriais brasileiras.

A empresa "${empresa}" fabrica pré-moldados de concreto.
Produto principal: ${produto}
Estilo atual: ${estiloAtual} | Cor atual: ${corAtual}
Público: pedreiros, proprietários rurais, construtoras — região Nordeste/Sudeste.${copyCtx}

Sugira uma identidade visual para a landing page coerente com o tom da copy acima.
Responda APENAS com JSON válido (sem markdown, sem texto extra):

{
  "cor_primaria": "#hex",
  "cor_secundaria": "#hex",
  "cor_texto": "#hex",
  "cor_fundo": "#hex",
  "estilo": "clean|industrial|rustico|bold",
  "fonte_titulo": "nome da fonte Google",
  "fonte_corpo": "nome da fonte Google",
  "prompts_fotos": ["prompt em inglês para foto hero", "prompt para foto de produto"],
  "justificativa": "1 linha explicando as escolhas"
}`;

  try {
    const raw = await callClaude(prompt, 600);
    if (!raw) return { texto: null, json: null };

    let visualJson = null;
    try {
      const match = raw.match(/\{[\s\S]+\}/);
      if (match) visualJson = JSON.parse(match[0]);
    } catch {}

    const texto = visualJson ? [
      `🎨 Sugestão Visual — ${empresa}`,
      `Gerado automaticamente por lp-visual (Visual Generator + Brad Frost):`,
      ``,
      `🎨 COR PRIMÁRIA:   ${visualJson.cor_primaria}`,
      `🔲 COR SECUNDÁRIA: ${visualJson.cor_secundaria}`,
      `✏️ COR TEXTO:      ${visualJson.cor_texto}`,
      `🖼️  COR FUNDO:      ${visualJson.cor_fundo}`,
      `✨ ESTILO:         ${visualJson.estilo}`,
      `🔤 FONTES:         ${visualJson.fonte_titulo} (títulos) / ${visualJson.fonte_corpo} (corpo)`,
      ``,
      `📸 PROMPTS PARA FOTOS AI:`,
      ...(visualJson.prompts_fotos || []).map((p, i) => `${i + 1}. ${p}`),
      ``,
      `💡 Justificativa: ${visualJson.justificativa}`,
      ``,
      `---`,
      `Revise e ajuste conforme a identidade do cliente.`,
      `Após aprovar, marque esta fase como concluída.`,
    ].join('\n') : raw;

    return { texto, json: visualJson };
  } catch (err) {
    console.warn('[Gate LP-3] Falha ao chamar Claude:', err.message);
    return { texto: null, json: null };
  }
}

// ============================================================
// GATE LP-1 — LP Briefing recebido → valida config + cria pipeline + lp-ux
// ============================================================
export async function gateLp1(empresa) {
  console.log(`\n[Gate LP-1] Iniciando para: ${empresa}`);

  try {
    const folder = await encontrarFolder(empresa);
    if (!folder) throw new Error(`Folder "${empresa}" não encontrado.`);

    const listaLP = await encontrarLista(folder.id, 'Landing Pages');
    if (!listaLP) throw new Error('Lista "Landing Pages" não encontrada.');

    // ── Valida config no VPS ──────────────────────────────────
    const slug   = empresa.toLowerCase();
    const config = await readConfig(slug);

    if (!config) {
      const motivo = `config/lp-${slug}.json não encontrado no VPS.`;
      console.warn('[Gate LP-1] BLOQUEADO:', motivo);
      await notifyMsg(MSG.erroSistema(empresa, 'Gate LP-1', motivo)).catch(() => {});
      return { ok: false, faltando: [motivo] };
    }

    const camposFaltando = validarCamposObrig(config, ['whatsapp', 'cidade', 'produtos']);
    if (camposFaltando.length > 0) {
      const motivo = `Campos obrigatórios faltando: ${camposFaltando.join(', ')}`;
      console.warn('[Gate LP-1] BLOQUEADO:', motivo);
      await notifyMsg(MSG.erroSistema(empresa, 'Gate LP-1', motivo)).catch(() => {});
      return { ok: false, faltando: camposFaltando.map(c => `Campo "${c}" não preenchido em config/lp-${slug}.json`) };
    }

    // ── Verifica se pipeline já existe ────────────────────────
    const fase1Existente = await encontrarTaskFase(listaLP.id, 1);
    if (fase1Existente) {
      console.log('[Gate LP-1] Pipeline já existe — pulando criação.');
      return { ok: true, skip: true, motivo: 'Pipeline já existente.' };
    }

    // ── Cria pipeline via VPS (criar-pipeline-lp.js) ─────────
    await runWorker('criar-pipeline-lp', slug);
    console.log('[Gate LP-1] Pipeline criado via VPS.');
    await logJob('gate-lp1-pipeline-criado', empresa, 'completed', 'Pipeline criado (Fases 1–5 na lista Landing Pages)');

    // ── lp-ux: posta estrutura de seções na [FASE 1] ─────────
    const fase1 = await encontrarTaskFase(listaLP.id, 1);
    if (fase1) {
      const estrutura = await gerarEstruturaUx(empresa, config);
      if (estrutura) {
        await postarComentario(fase1.id, estrutura);
        console.log('[Gate LP-1] Estrutura UX postada na Fase 1.');

        // Salva estrutura UX no lp config para uso pelo Gate LP-2 (copywriters)
        const lpConfig = await readConfig(slug);
        if (lpConfig) {
          await saveConfig(slug, 'lp', { ...lpConfig, ux_estrutura: estrutura });
          console.log('[Gate LP-1] Estrutura UX salva no lp config (ux_estrutura).');
        }
      }
    }

    // ── Notifica Jon ──────────────────────────────────────────
    await notifyMsg(MSG.gateLp1Jon(empresa)).catch(() => {});

    console.log('[Gate LP-1] ✅ PASSOU');
    return { ok: true };

  } catch (err) {
    console.error('[Gate LP-1] Erro:', err.message);
    await logJob('gate-lp1-pipeline-criado', empresa, 'failed', 'Erro ao criar pipeline', err.message);
    await notifyMsg(MSG.erroSistema(empresa, 'Gate LP-1', err.message)).catch(() => {});
    return { ok: false, error: err.message };
  }
}

// ============================================================
// GATE LP-2 — Fase 1 (DNA) concluída → quality gate + gera copy via 4 experts
// ============================================================
export async function gateLp2(empresa) {
  console.log(`\n[Gate LP-2] Iniciando para: ${empresa}`);

  try {
    const folder = await encontrarFolder(empresa);
    if (!folder) throw new Error(`Folder "${empresa}" não encontrado.`);

    const listaLP = await encontrarLista(folder.id, 'Landing Pages');
    if (!listaLP) throw new Error('Lista "Landing Pages" não encontrada.');

    // ── Valida Fase 1 concluída ───────────────────────────────
    const fase1 = await encontrarTaskFase(listaLP.id, 1);
    if (!fase1 || !isDone(fase1.status?.status)) {
      const motivo = 'Fase 1 (DNA do Cliente) ainda não concluída.';
      console.warn('[Gate LP-2] BLOQUEADO:', motivo);
      return { ok: false, faltando: [motivo] };
    }

    // ── Quality gate: checklist da Fase 1 ────────────────────
    const qg = await verificarGate(empresa, 'Geral', 2).catch(() => null);
    if (qg && !qg.ok && qg.faltando?.length > 0) {
      console.warn('[Gate LP-2] Checklist incompleto:', qg.faltando);
      await notifyMsg(MSG.erroSistema(empresa, 'Gate LP-2', `Checklist pendente: ${qg.faltando.join(', ')}`)).catch(() => {});
      return { ok: false, faltando: qg.faltando };
    }

    // ── Lê config para contexto da copy ──────────────────────
    const slug   = empresa.toLowerCase();
    const config = await readConfig(slug);

    // ── Gera copy com os 4 copy experts (lp-copywriter) ──────
    const copyResult = await gerarCopyCompleta(empresa, config);

    if (copyResult) {
      // Salva config/copy-{slug}.json no VPS
      await saveConfig(slug, 'copy', copyResult.copy);
      console.log('[Gate LP-2] config/copy-{slug}.json salvo.');

      // Merge copy fields into lp config so gerar-lp.js uses the approved copy
      const lpConfig = await readConfig(slug, 'lp');
      if (lpConfig) {
        const merged = { ...lpConfig, ...copyResult.copy };
        await saveConfig(slug, 'lp', merged);
        console.log('[Gate LP-2] Copy merged into lp config.');
      }

      // Posta copy como comentário na [FASE 2]
      const fase2 = await encontrarTaskFase(listaLP.id, 2);
      if (fase2) {
        await postarComentario(fase2.id, copyResult.texto);
        console.log('[Gate LP-2] Copy postada na Fase 2.');
      }
    } else {
      console.warn('[Gate LP-2] Copy não gerada (Claude indisponível) — prosseguindo sem comentário.');
    }

    await logJob('gate-lp2-copy-gerada', empresa, 'completed', 'Geração de copy via 4 experts concluída');

    // ── Notifica Jon ──────────────────────────────────────────
    await notifyMsg(MSG.gateLp2Jon(empresa)).catch(() => {});

    console.log('[Gate LP-2] ✅ PASSOU');
    return { ok: true };

  } catch (err) {
    console.error('[Gate LP-2] Erro:', err.message);
    await logJob('gate-lp2-copy-gerada', empresa, 'failed', 'Erro ao gerar copy', err.message);
    await notifyMsg(MSG.erroSistema(empresa, 'Gate LP-2', err.message)).catch(() => {});
    return { ok: false, error: err.message };
  }
}

// ============================================================
// GATE LP-3 — Fase 2 (Copy) concluída → valida config + gera visual + salva JSON
// ============================================================
export async function gateLp3(empresa) {
  console.log(`\n[Gate LP-3] Iniciando para: ${empresa}`);

  try {
    const folder = await encontrarFolder(empresa);
    if (!folder) throw new Error(`Folder "${empresa}" não encontrado.`);

    const listaLP = await encontrarLista(folder.id, 'Landing Pages');
    if (!listaLP) throw new Error('Lista "Landing Pages" não encontrada.');

    // ── Valida Fase 2 concluída ───────────────────────────────
    const fase2 = await encontrarTaskFase(listaLP.id, 2);
    if (!fase2 || !isDone(fase2.status?.status)) {
      const motivo = 'Fase 2 (Copy) ainda não concluída.';
      console.warn('[Gate LP-3] BLOQUEADO:', motivo);
      return { ok: false, faltando: [motivo] };
    }

    // ── Lê config e valida campos de identidade ───────────────
    const slug   = empresa.toLowerCase();
    const config = await readConfig(slug);

    if (config) {
      const camposFaltando = validarCamposObrig(config, ['produtos', 'cidade']);
      if (camposFaltando.length > 0) {
        console.warn('[Gate LP-3] Campos de identidade faltando:', camposFaltando);
        // Avisa mas não bloqueia — visual pode ser definido sem dados completos
        await logJob('gate-lp3-visual-gerado', empresa, 'warning',
          `Campos recomendados faltando: ${camposFaltando.join(', ')} — continuando mesmo assim`);
      }
    }

    // ── lp-visual: gera identidade visual ────────────────────
    const { texto, json: visualJson } = await gerarSugestaoVisual(empresa, config);

    // Posta na task Fase 3
    const fase3 = await encontrarTaskFase(listaLP.id, 3);
    if (fase3 && texto) {
      await postarComentario(fase3.id, texto);
      console.log('[Gate LP-3] Sugestão visual postada na Fase 3.');
    }

    // Salva config/visual-{slug}.json no VPS
    if (visualJson) {
      await saveConfig(slug, 'visual', visualJson);
      console.log('[Gate LP-3] config/visual-{slug}.json salvo.');

      // Merge visual fields into lp config — só preenche campos ainda ausentes
      // (valores definidos manualmente no lp config têm prioridade)
      const lpConfig = await readConfig(slug, 'lp');
      if (lpConfig) {
        const VISUAL_FIELDS = ['cor_primaria', 'cor_secundaria', 'cor_texto', 'cor_fundo', 'estilo', 'fonte_titulo', 'fonte_corpo'];
        const patch = {};
        for (const f of VISUAL_FIELDS) {
          if (visualJson[f] && !lpConfig[f]) patch[f] = visualJson[f];
        }
        if (Object.keys(patch).length > 0) {
          await saveConfig(slug, 'lp', { ...lpConfig, ...patch });
          console.log('[Gate LP-3] Visual merged into lp config (campos faltantes preenchidos):', Object.keys(patch).join(', '));
        } else {
          console.log('[Gate LP-3] lp config já tem todos os campos visuais — nenhum patch necessário.');
        }
      }
    }

    await logJob('gate-lp3-visual-gerado', empresa, 'completed', 'Sugestão visual gerada e postada na Fase 3');

    // ── Notifica Jon ──────────────────────────────────────────
    await notifyMsg(MSG.gateLp3Jon(empresa)).catch(() => {});

    console.log('[Gate LP-3] ✅ PASSOU');
    return { ok: true };

  } catch (err) {
    console.error('[Gate LP-3] Erro:', err.message);
    await logJob('gate-lp3-visual-gerado', empresa, 'failed', 'Erro ao gerar identidade visual', err.message);
    await notifyMsg(MSG.erroSistema(empresa, 'Gate LP-3', err.message)).catch(() => {});
    return { ok: false, error: err.message };
  }
}

// ============================================================
// GATE LP-4 — Fase 3 (Visual) concluída → quality gate + gera LP + checklist
// ============================================================
export async function gateLp4(empresa) {
  console.log(`\n[Gate LP-4] Iniciando para: ${empresa}`);

  try {
    const folder = await encontrarFolder(empresa);
    if (!folder) throw new Error(`Folder "${empresa}" não encontrado.`);

    const listaLP = await encontrarLista(folder.id, 'Landing Pages');
    if (!listaLP) throw new Error('Lista "Landing Pages" não encontrada.');

    const faltando = [];

    // ── Valida Fase 2 e Fase 3 concluídas ────────────────────
    const fase2 = await encontrarTaskFase(listaLP.id, 2);
    if (!fase2 || !isDone(fase2.status?.status)) faltando.push('Fase 2 (Copy) não concluída');

    const fase3 = await encontrarTaskFase(listaLP.id, 3);
    if (!fase3 || !isDone(fase3.status?.status)) faltando.push('Fase 3 (Identidade Visual) não concluída');

    if (faltando.length > 0) {
      console.warn('[Gate LP-4] BLOQUEADO:', faltando);
      await notifyMsg(MSG.gateLp4Falha(empresa, faltando)).catch(() => {});
      return { ok: false, faltando };
    }

    // ── Valida config sem campos "A DEFINIR" críticos ─────────
    const slug   = empresa.toLowerCase();
    const config = await readConfig(slug);

    if (config && temCamposIndefinidos(config, ['headline'])) {
      const motivo = 'Headline ainda é "A DEFINIR" — atualize config/lp-{slug}.json antes de gerar.';
      console.warn('[Gate LP-4] BLOQUEADO:', motivo);
      await notifyMsg(MSG.erroSistema(empresa, 'Gate LP-4', motivo)).catch(() => {});
      return { ok: false, faltando: [motivo] };
    }

    // ── Quality gate: checklist das Fases 2 e 3 ──────────────
    const qg = await verificarGate(empresa, 'Geral', 4).catch(() => null);
    if (qg && !qg.ok && qg.faltando?.length > 0) {
      console.warn('[Gate LP-4] Quality gate bloqueou:', qg.faltando);
      await notifyMsg(MSG.gateLp4Falha(empresa, qg.faltando)).catch(() => {});
      return { ok: false, faltando: qg.faltando };
    }

    // ── Dispara gerar-lp no VPS ───────────────────────────────
    await runWorker('gerar-lp', slug);
    console.log('[Gate LP-4] gerar-lp disparado via VPS.');
    await logJob('gate-lp4-lp-gerada', empresa, 'completed', 'Geração de LP disparada via gerar-lp.js');

    // ── Posta checklist de qualidade na [FASE 4] ─────────────
    const fase4 = await encontrarTaskFase(listaLP.id, 4);
    if (fase4) {
      await postarComentario(fase4.id, [
        `⚙️ LP em geração — ${empresa}`,
        ``,
        `Checklist de validação (preencher após geração):`,
        `☐ HTML gerado em dist/${slug}/index.html`,
        `☐ Botão WhatsApp presente`,
        `☐ Formulário de lead presente`,
        `☐ Pixel Meta presente`,
        `☐ Página carrega corretamente no browser`,
        ``,
        `Marque como concluída após validar todos os itens acima.`,
      ].join('\n'));
      console.log('[Gate LP-4] Checklist postado na Fase 4.');
    }

    // ── Notifica Jon ──────────────────────────────────────────
    await notifyMsg(MSG.gateLp4Jon(empresa)).catch(() => {});

    console.log('[Gate LP-4] ✅ PASSOU');
    return { ok: true };

  } catch (err) {
    console.error('[Gate LP-4] Erro:', err.message);
    await logJob('gate-lp4-lp-gerada', empresa, 'failed', 'Erro ao disparar geração de LP', err.message);
    await notifyMsg(MSG.erroSistema(empresa, 'Gate LP-4', err.message)).catch(() => {});
    return { ok: false, error: err.message };
  }
}

// ============================================================
// GATE LP-5 — Fase 4 (Geração) concluída → quality gate + deploy + verifica URL
// ============================================================
export async function gateLp5(empresa) {
  console.log(`\n[Gate LP-5] Iniciando para: ${empresa}`);

  try {
    const folder = await encontrarFolder(empresa);
    if (!folder) throw new Error(`Folder "${empresa}" não encontrado.`);

    const listaLP = await encontrarLista(folder.id, 'Landing Pages');
    if (!listaLP) throw new Error('Lista "Landing Pages" não encontrada.');

    // ── Valida Fase 4 concluída ───────────────────────────────
    const fase4 = await encontrarTaskFase(listaLP.id, 4);
    if (!fase4 || !isDone(fase4.status?.status)) {
      const motivo = 'Fase 4 (Geração da LP) ainda não concluída.';
      console.warn('[Gate LP-5] BLOQUEADO:', motivo);
      return { ok: false, faltando: [motivo] };
    }

    // ── Lê config e valida pixel Meta ────────────────────────
    const slug   = empresa.toLowerCase();
    const config = await readConfig(slug);

    if (config && !config.pixel_meta) {
      const motivo = `pixel_meta não configurado em config/lp-${slug}.json — configure antes do deploy.`;
      console.warn('[Gate LP-5] BLOQUEADO:', motivo);
      await notifyMsg(MSG.erroSistema(empresa, 'Gate LP-5', motivo)).catch(() => {});
      return { ok: false, faltando: [motivo] };
    }

    // ── Quality gate: checklist da Fase 4 ────────────────────
    const qg = await verificarGate(empresa, 'Geral', 5).catch(() => null);
    if (qg && !qg.ok && qg.faltando?.length > 0) {
      console.warn('[Gate LP-5] Quality gate bloqueou:', qg.faltando);
      await notifyMsg(MSG.erroSistema(empresa, 'Gate LP-5', `Checklist pendente: ${qg.faltando.join(', ')}`)).catch(() => {});
      return { ok: false, faltando: qg.faltando };
    }

    // ── Dispara deploy-lp no VPS ──────────────────────────────
    const deployResult = await runWorker('deploy-lp', slug);
    const deployOk     = deployResult?.ok !== false;
    console.log(`[Gate LP-5] deploy-lp resultado: ${deployOk ? 'OK' : 'FALHOU'}`);
    await logJob('gate-lp5-deploy-realizado', empresa, deployOk ? 'completed' : 'failed',
      deployOk ? 'Deploy realizado via deploy-lp.js' : `Deploy falhou: ${deployResult?.output || 'sem output'}`
    );

    // ── Verifica URL em produção ──────────────────────────────
    const url = config?.url;
    let textoUrl = '';

    if (url && deployOk) {
      const urlCheck = await verificarUrl(url);
      const sslOk    = urlCheck.ok && url.startsWith('https');

      textoUrl = urlCheck.ok
        ? `✅ URL online: ${url} (HTTP ${urlCheck.status})${sslOk ? ' | SSL OK ✅' : ''}`
        : `⚠️ URL não respondeu: ${url} — ${urlCheck.error || `HTTP ${urlCheck.status}`}`;

      console.log(`[Gate LP-5] Verificação URL: ${textoUrl}`);
      await logJob('gate-lp5-url-check', empresa, urlCheck.ok ? 'completed' : 'warning', textoUrl);
    }

    // ── Posta resultado na [FASE 5] ───────────────────────────
    const fase5 = await encontrarTaskFase(listaLP.id, 5);
    if (fase5) {
      await postarComentario(fase5.id, [
        `🚀 Deploy realizado — ${empresa}`,
        ``,
        textoUrl || `Deploy disparado. Verifique a URL em breve.`,
        ``,
        `📎 URL: ${url || 'não configurada'}`,
        `🔢 Pixel Meta: ${config?.pixel_meta || 'não configurado'}`,
        ``,
        deployOk ? '✅ Deploy concluído com sucesso.' : `⚠️ Possível falha no deploy — verifique o dashboard.`,
      ].join('\n'));
      console.log('[Gate LP-5] Resultado postado na Fase 5.');
    }

    // ── Notifica Jon ──────────────────────────────────────────
    await notifyMsg(MSG.gateLp5Jon(empresa)).catch(() => {});

    console.log('[Gate LP-5] ✅ PASSOU');
    return { ok: true };

  } catch (err) {
    console.error('[Gate LP-5] Erro:', err.message);
    await logJob('gate-lp5-deploy-realizado', empresa, 'failed', 'Erro ao disparar deploy', err.message);
    await notifyMsg(MSG.erroSistema(empresa, 'Gate LP-5', err.message)).catch(() => {});
    return { ok: false, error: err.message };
  }
}
