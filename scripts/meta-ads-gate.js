/**
 * ESCALANDO PREMOLDADOS — Meta Ads Gate Engine v1.0
 *
 * Pipeline completo de Meta Ads com 7 gates:
 *   Gate MA-A → 🔑 Coletar Acessos → complete    → cria 📊 Briefing + Benchmarking
 *   Gate MA-B → 📊 Briefing + Benchmarking        → cria 📐 Estratégia + Nomenclatura
 *   Gate MA-C → 📐 Estratégia + Nomenclatura      → cria ✏️ Copy dos Anúncios (+ roda gerar-copy-ads)
 *   Gate MA-D → ✏️ Copy dos Anúncios              → cria 🎨 Criativos
 *   Gate MA-E → 🎨 Criativos → complete           → Fluxo B: cria 🚀 Go-Live
 *                                                   Fluxo A: cria 🔗 Sync LP + Pixel
 *   Gate MA-F → 🔗 Sync LP + Pixel (Fluxo A)     → cria 🚀 Go-Live
 *   Gate MA-G → 🚀 Go-Live → complete             → registra go-live + cria 📊 Monitoramento D+7
 *
 * Chamado por: api/clickup-status-change.js
 */

import { notifyMsg, MSG } from './notify.js';

const CLICKUP_API_KEY = process.env.CLICKUP_API_KEY;
const SPACE_CLIENTES  = process.env.CLICKUP_SPACE_ID || '901313678809';
const BASE_URL        = 'https://api.clickup.com/api/v2';
const VPS_URL         = (process.env.VPS_URL || 'http://129.121.45.61:3030').trim();
const WORKER_SECRET   = (process.env.WORKER_SECRET || '').trim();

// ── ClickUp helper ──────────────────────────────────────────────────────────
async function cu(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method:  method.toUpperCase(),
    headers: { Authorization: CLICKUP_API_KEY, 'Content-Type': 'application/json' },
    body:    body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`ClickUp [${method} ${path}]: ${JSON.stringify(json)}`);
  return json;
}

// ── VPS worker ──────────────────────────────────────────────────────────────
async function runWorker(script, cliente) {
  return fetch(`${VPS_URL}/api/run-worker`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ secret: WORKER_SECRET, script, cliente }),
  }).then(r => r.json()).catch(() => ({ ok: false }));
}

// ── Dashboard log ───────────────────────────────────────────────────────────
async function logJob(gate, empresa, step) {
  await fetch(`${VPS_URL}/api/log-job`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      secret:   WORKER_SECRET,
      id:       `${gate}-${empresa.toLowerCase()}-${Date.now()}`,
      script:   gate,
      cliente:  empresa.toLowerCase(),
      status:   'completed',
      progress: 100,
      step,
    }),
  }).catch(() => {});
}

// ── Encontra folder do cliente ───────────────────────────────────────────────
async function encontrarFolder(empresa) {
  const { folders } = await cu('get', `/space/${SPACE_CLIENTES}/folder?archived=false`);
  return folders.find(f => f.name.toLowerCase() === empresa.toLowerCase()) || null;
}

// ── Encontra lista por nome ──────────────────────────────────────────────────
async function encontrarLista(folderId, nome) {
  const { lists } = await cu('get', `/folder/${folderId}/list?archived=false`);
  return lists.find(l => l.name.toLowerCase() === nome.toLowerCase()) || null;
}

// ── Encontra task por prefixo (busca em tasks abertas e fechadas) ────────────
async function encontrarTask(listId, prefixo) {
  const { tasks } = await cu('get', `/list/${listId}/task?archived=false&include_closed=true`);
  return tasks.find(t => t.name.toLowerCase().startsWith(prefixo.toLowerCase())) || null;
}

// ── Adiciona checklist a uma task ────────────────────────────────────────────
async function adicionarChecklist(taskId, nome, itens) {
  try {
    const cl = await cu('post', `/task/${taskId}/checklist`, { name: nome });
    for (const item of itens) {
      await cu('post', `/checklist/${cl.checklist.id}/checklist_item`, { name: item }).catch(() => {});
    }
  } catch { /* silencioso — checklist é bônus */ }
}

// ── Detecta Fluxo A (com LP) ou B (direto WhatsApp) ─────────────────────────
function detectarFluxo(task) {
  const desc = (task?.description || '').toLowerCase();
  const cf   = (task?.custom_fields || []).find(f => f.name?.toLowerCase() === 'fluxo');
  if (cf?.value && String(cf.value).toLowerCase().match(/a|lp/)) return 'A';
  if (desc.includes('fluxo: a') || desc.includes('fluxo a') || desc.includes('com lp')) return 'A';
  return 'B';
}

// ── Helper: cria task Go-Live (reutilizado em MA-E e MA-F) ──────────────────
async function criarGoLive(empresa, listaMetaId) {
  const existe = await encontrarTask(listaMetaId, '🚀 Go-Live');
  if (existe) return;

  const task = await cu('post', `/list/${listaMetaId}/task`, {
    name:        `🚀 Go-Live — ${empresa}`,
    description: [
      `**Gate MA-G — Autorização de Go-Live**`,
      ``,
      `Agentes: media-buyer (executa) + traffic-chief (autoriza) + fiscal (confirma budget)`,
      ``,
      `Marque como complete → campanhas registradas + Monitoramento D+7 criado automaticamente`,
    ].join('\n'),
    priority: 1,
  });

  await adicionarChecklist(task.id, 'Validações Go-Live', [
    'Reputação da conta ok (verificação final)',
    'Budget configurado no Meta Ads Manager',
    'Alertas de custo configurados no Meta',
    'Públicos criados conforme nomenclatura MAT',
    'Cliente confirmou disponibilidade para atender lead em até 2h',
    'traffic-chief autorizou subida das campanhas',
    'fiscal confirmou budget aprovado',
  ]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// GATE MA-A — Coletar Acessos → complete
// Valida que acessos foram recebidos → dispara setup campanha → cria Briefing
// ═══════════════════════════════════════════════════════════════════════════════
export async function gateMaA(empresa) {
  console.log(`\n[Gate MA-A] ${empresa}`);
  try {
    const folder = await encontrarFolder(empresa);
    if (!folder) throw new Error(`Folder "${empresa}" não encontrado.`);

    const listaMeta = await encontrarLista(folder.id, 'Meta Ads');
    if (!listaMeta) throw new Error('Lista Meta Ads não encontrada.');

    // Dispara setup-campanha-meta no VPS (lê ficha + gera briefing inicial)
    runWorker('setup-campanha-meta', empresa).catch(() => {});

    // Cria task Briefing + Benchmarking (idempotente)
    const existe = await encontrarTask(listaMeta.id, '📊 Briefing + Benchmarking');
    if (!existe) {
      const task = await cu('post', `/list/${listaMeta.id}/task`, {
        name:        `📊 Briefing + Benchmarking — ${empresa}`,
        description: [
          `**Gate MA-B — Briefing + Benchmarking**`,
          ``,
          `Agentes: pedro-sobral (briefing) + ads-analyst (Ad Library)`,
          ``,
          `Dados da Ficha do ClickUp alimentam este gate automaticamente.`,
          `Realize a call de ideias com o cliente (30min) e analise concorrentes na Meta Ad Library.`,
          ``,
          `Marque como complete → Gate MA-C (Estratégia + Nomenclatura) dispara automaticamente`,
        ].join('\n'),
        priority: 2,
      });
      await adicionarChecklist(task.id, 'Validações Gate MA-B', [
        'Briefing completo: avatar, dor, desejo, objeções, produto, área de atuação',
        'Call de ideias realizada com cliente (30min)',
        'Mínimo 5 concorrentes analisados na Meta Ad Library',
        '3 oportunidades de diferenciação identificadas',
        'traffic-chief aprovou o briefing',
      ]);
    }

    await logJob('gate-ma-a', empresa, 'Acessos recebidos → Briefing + Benchmarking criado');
    await notifyMsg(MSG.gateMaA(empresa)).catch(() => {});
    console.log('[Gate MA-A] ✅');
    return { ok: true };

  } catch (err) {
    console.error('[Gate MA-A] Erro:', err.message);
    await notifyMsg(MSG.erroSistema(empresa, 'Gate MA-A', err.message)).catch(() => {});
    return { ok: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GATE MA-B — Briefing + Benchmarking → complete
// Cria Estratégia + Nomenclatura MAT
// ═══════════════════════════════════════════════════════════════════════════════
export async function gateMaB(empresa) {
  console.log(`\n[Gate MA-B] ${empresa}`);
  try {
    const folder = await encontrarFolder(empresa);
    if (!folder) throw new Error(`Folder "${empresa}" não encontrado.`);

    const listaMeta = await encontrarLista(folder.id, 'Meta Ads');
    if (!listaMeta) throw new Error('Lista Meta Ads não encontrada.');

    const existe = await encontrarTask(listaMeta.id, '📐 Estratégia + Nomenclatura');
    if (!existe) {
      const task = await cu('post', `/list/${listaMeta.id}/task`, {
        name:        `📐 Estratégia + Nomenclatura — ${empresa}`,
        description: [
          `**Gate MA-C — Estratégia + Nomenclatura MAT**`,
          ``,
          `Agentes: pedro-sobral + traffic-chief`,
          ``,
          `**Nomenclatura MAT — Campanha:**`,
          `(TEMPERATURA) | (PRODUTO) | (OBJETIVO) | (OTIMIZAÇÃO) | (DATA)`,
          `Ex: FRIO | PISO INTERTRAVADO | MENSAGENS | CBO | ${new Date().toISOString().slice(0,10)}`,
          ``,
          `**Nomenclatura MAT — Conjunto:**`,
          `(ORIGEM) | (SEXO) | (IDADE) | (ETAPA) | (DURAÇÃO)`,
          `Ex: INTERESSE | H & M | 30-60 | TODOS OS VISITANTES | 30D`,
          ``,
          `Marque como complete → Gate MA-D (Copy dos Anúncios) dispara automaticamente`,
        ].join('\n'),
        priority: 2,
      });
      await adicionarChecklist(task.id, 'Validações Gate MA-C', [
        'Ângulo principal da campanha definido',
        '3 abordagens criativas mapeadas',
        'Fase definida: Discovery ou Scale',
        'Nomenclatura MAT aplicada em todas as campanhas',
        'Nomenclatura MAT aplicada em todos os conjuntos de anúncios',
        'traffic-chief aprovou a estratégia',
      ]);
    }

    await logJob('gate-ma-b', empresa, 'Briefing aprovado → Estratégia + Nomenclatura criada');
    await notifyMsg(MSG.gateMaB(empresa)).catch(() => {});
    console.log('[Gate MA-B] ✅');
    return { ok: true };

  } catch (err) {
    console.error('[Gate MA-B] Erro:', err.message);
    await notifyMsg(MSG.erroSistema(empresa, 'Gate MA-B', err.message)).catch(() => {});
    return { ok: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GATE MA-C — Estratégia + Nomenclatura → complete
// Roda gerar-copy-ads + cria Copy dos Anúncios
// ═══════════════════════════════════════════════════════════════════════════════
export async function gateMaC(empresa) {
  console.log(`\n[Gate MA-C] ${empresa}`);
  try {
    const folder = await encontrarFolder(empresa);
    if (!folder) throw new Error(`Folder "${empresa}" não encontrado.`);

    const listaMeta = await encontrarLista(folder.id, 'Meta Ads');
    if (!listaMeta) throw new Error('Lista Meta Ads não encontrada.');

    // Dispara geração de copy no VPS
    runWorker('gerar-copy-ads', empresa).catch(() => {});

    const existe = await encontrarTask(listaMeta.id, '✏️ Copy dos Anúncios');
    if (!existe) {
      const task = await cu('post', `/list/${listaMeta.id}/task`, {
        name:        `✏️ Copy dos Anúncios — ${empresa}`,
        description: [
          `**Gate MA-D — Copy dos Anúncios**`,
          ``,
          `Agentes: pedro-sobral (escrita) + creative-analyst (revisão)`,
          ``,
          `⚡ Script gerar-copy-ads disparado automaticamente — resultado postado aqui em breve`,
          ``,
          `**Estrutura por variação:**`,
          `Hook → Narrativa → Dor/Desejo → Contra-intuitivo → CTA`,
          ``,
          `**Formatos:** feed (curto) e stories (longo) para cada variação`,
          ``,
          `Marque como complete → Gate MA-E (Criativos) dispara automaticamente`,
        ].join('\n'),
        priority: 1,
      });
      await adicionarChecklist(task.id, 'Validações Gate MA-D', [
        'Mínimo 3 hooks por abordagem criativa',
        'Copy completa: Hook → Narrativa → Dor/Desejo → Contra-intuitivo → CTA',
        'Versão feed (curto) e stories (longo) para cada variação',
        'Sem promessas que violem políticas do Meta',
        'Copy aprovada pelo cliente',
        'creative-analyst revisou e aprovou',
      ]);
    }

    await logJob('gate-ma-c', empresa, 'Estratégia aprovada → Copy em geração (gerar-copy-ads disparado)');
    await notifyMsg(MSG.gateMaC(empresa)).catch(() => {});
    console.log('[Gate MA-C] ✅');
    return { ok: true };

  } catch (err) {
    console.error('[Gate MA-C] Erro:', err.message);
    await notifyMsg(MSG.erroSistema(empresa, 'Gate MA-C', err.message)).catch(() => {});
    return { ok: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GATE MA-D — Copy dos Anúncios → complete
// Cria Criativos
// ═══════════════════════════════════════════════════════════════════════════════
export async function gateMaD(empresa) {
  console.log(`\n[Gate MA-D] ${empresa}`);
  try {
    const folder = await encontrarFolder(empresa);
    if (!folder) throw new Error(`Folder "${empresa}" não encontrado.`);

    const listaMeta = await encontrarLista(folder.id, 'Meta Ads');
    if (!listaMeta) throw new Error('Lista Meta Ads não encontrada.');

    const existe = await encontrarTask(listaMeta.id, '🎨 Criativos');
    if (!existe) {
      const task = await cu('post', `/list/${listaMeta.id}/task`, {
        name:        `🎨 Criativos — ${empresa}`,
        description: [
          `**Gate MA-E — Criativos**`,
          ``,
          `Agentes: ad-midas (conceito/brief) + ux-design-expert (visual)`,
          ``,
          `**Nomenclatura MAT — Anúncio:**`,
          `AD (NÚMERO) | (FORMATO) | (HOOK — PRIMEIRA FRASE)`,
          `Ex: AD 01 | IMG | HOOK PRINCIPAL DO ANÚNCIO AQUI`,
          ``,
          `**Formatos obrigatórios:** Feed 1:1 e Stories 9:16 para cada variação`,
          ``,
          `Marque como complete → Gate MA-E dispara (Go-Live ou Sync LP+Pixel conforme Fluxo)`,
        ].join('\n'),
        priority: 1,
      });
      await adicionarChecklist(task.id, 'Validações Gate MA-E', [
        'Brief visual gerado a partir da copy aprovada',
        'Mínimo 2 artes por formato: feed 1:1 e stories 9:16',
        'Texto na imagem: máximo 20% da área',
        'UTMs padronizados em todos os links',
        'Nomenclatura MAT aplicada nos anúncios',
        'Criativos aprovados pelo cliente',
        'ad-midas aprovou conceito',
        'ux-design-expert aprovou visual',
      ]);
    }

    await logJob('gate-ma-d', empresa, 'Copy aprovada → Criativos criados');
    await notifyMsg(MSG.gateMaD(empresa)).catch(() => {});
    console.log('[Gate MA-D] ✅');
    return { ok: true };

  } catch (err) {
    console.error('[Gate MA-D] Erro:', err.message);
    await notifyMsg(MSG.erroSistema(empresa, 'Gate MA-D', err.message)).catch(() => {});
    return { ok: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GATE MA-E — Criativos → complete
// Fluxo B: cria Go-Live direto | Fluxo A: cria Sync LP + Pixel
// ═══════════════════════════════════════════════════════════════════════════════
export async function gateMaE(empresa) {
  console.log(`\n[Gate MA-E] ${empresa}`);
  try {
    const folder = await encontrarFolder(empresa);
    if (!folder) throw new Error(`Folder "${empresa}" não encontrado.`);

    const listaMeta = await encontrarLista(folder.id, 'Meta Ads');
    if (!listaMeta) throw new Error('Lista Meta Ads não encontrada.');

    const taskCriativos = await encontrarTask(listaMeta.id, '🎨 Criativos');
    const fluxo = detectarFluxo(taskCriativos);

    if (fluxo === 'A') {
      // Fluxo A — precisa sincronizar LP + Pixel antes de ir ao ar
      const existe = await encontrarTask(listaMeta.id, '🔗 Sync LP + Pixel');
      if (!existe) {
        const task = await cu('post', `/list/${listaMeta.id}/task`, {
          name:        `🔗 Sync LP + Pixel — ${empresa}`,
          description: [
            `**Gate MA-F — Sync LP + Pixel (Fluxo A)**`,
            ``,
            `Agente: pixel-specialist`,
            ``,
            `Configurar rastreamento completo antes de subir as campanhas.`,
            ``,
            `Marque como complete → Gate MA-G (Go-Live) dispara automaticamente`,
          ].join('\n'),
          priority: 1,
        });
        await adicionarChecklist(task.id, 'Validações Gate MA-F', [
          'LP publicada em URL definitiva',
          'Pixel disparando evento PageView',
          'Evento Contact no clique do botão WhatsApp',
          'Evento Lead no submit do formulário',
          'Conversions API (CAPI) ativa e validada',
          'Link WhatsApp com UTM configurado',
          'pixel-specialist validou todos os eventos no Events Manager',
        ]);
      }
      await logJob('gate-ma-e', empresa, `Fluxo A — Criativos aprovados → Sync LP + Pixel criado`);
      await notifyMsg(MSG.gateMaEFluxoA(empresa)).catch(() => {});

    } else {
      // Fluxo B — direto para Go-Live
      await criarGoLive(empresa, listaMeta.id);
      await logJob('gate-ma-e', empresa, `Fluxo B — Criativos aprovados → Go-Live criado`);
      await notifyMsg(MSG.gateMaEFluxoB(empresa)).catch(() => {});
    }

    console.log(`[Gate MA-E] ✅ Fluxo ${fluxo}`);
    return { ok: true, fluxo };

  } catch (err) {
    console.error('[Gate MA-E] Erro:', err.message);
    await notifyMsg(MSG.erroSistema(empresa, 'Gate MA-E', err.message)).catch(() => {});
    return { ok: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GATE MA-F — Sync LP + Pixel → complete (Fluxo A)
// Cria Go-Live
// ═══════════════════════════════════════════════════════════════════════════════
export async function gateMaF(empresa) {
  console.log(`\n[Gate MA-F] ${empresa}`);
  try {
    const folder = await encontrarFolder(empresa);
    if (!folder) throw new Error(`Folder "${empresa}" não encontrado.`);

    const listaMeta = await encontrarLista(folder.id, 'Meta Ads');
    if (!listaMeta) throw new Error('Lista Meta Ads não encontrada.');

    await criarGoLive(empresa, listaMeta.id);
    await logJob('gate-ma-f', empresa, 'LP + Pixel sincronizados → Go-Live liberado');
    await notifyMsg(MSG.gateMaF(empresa)).catch(() => {});
    console.log('[Gate MA-F] ✅');
    return { ok: true };

  } catch (err) {
    console.error('[Gate MA-F] Erro:', err.message);
    await notifyMsg(MSG.erroSistema(empresa, 'Gate MA-F', err.message)).catch(() => {});
    return { ok: false, error: err.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GATE MA-G — Go-Live → complete
// Registra go-live no VPS + cria Monitoramento D+7
// ═══════════════════════════════════════════════════════════════════════════════
export async function gateMaG(empresa) {
  console.log(`\n[Gate MA-G] ${empresa}`);
  try {
    const folder = await encontrarFolder(empresa);
    if (!folder) throw new Error(`Folder "${empresa}" não encontrado.`);

    const listaMeta = await encontrarLista(folder.id, 'Meta Ads');
    if (!listaMeta) throw new Error('Lista Meta Ads não encontrada.');

    // Registra go-live no VPS (log + ativa cron de monitoramento)
    runWorker('registrar-golive', empresa).catch(() => {});

    // Cria task Monitoramento D+7 com due date
    const existe = await encontrarTask(listaMeta.id, '📊 Monitoramento D+7');
    if (!existe) {
      const d7 = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const task = await cu('post', `/list/${listaMeta.id}/task`, {
        name:        `📊 Monitoramento D+7 — ${empresa}`,
        description: [
          `**Ciclo Pós Go-Live — Rotina de Monitoramento**`,
          ``,
          `Agentes: media-buyer + performance-analyst`,
          ``,
          `**D+1 a D+7:** Checklist diário + monitoramento sem intervir`,
          `**D+7:** creative-analyst analisa qual hook está ganhando`,
          `**D+14:** traffic-chief pausa perdedores, escala vencedor`,
          `**D+15:** Relatório quinzenal + CPL vs meta`,
          `**D+30:** scale-optimizer + depesh-mandalia avaliam escala (ROAS > 3x)`,
          `**D+60:** kasim-aslam avalia expansão para Google Ads Search`,
        ].join('\n'),
        priority: 2,
        due_date: d7.getTime(),
      });
      await adicionarChecklist(task.id, 'Checklist Diário D+1 a D+7', [
        'Criativo com baixa qualidade ativo?',
        'Conta com reputação negativa?',
        'Anúncio reprovado? (máx 3/mês — pausar imediatamente)',
        'Conta ou BM bloqueado?',
        'Criativo com mais de 20% de texto na imagem?',
        'Comentários dos anúncios respondidos?',
        'CPL dentro da meta definida?',
        'CTR acima de 1%?',
        'Frequência abaixo de 3?',
      ]);
    }

    await logJob('gate-ma-g', empresa, 'Go-Live registrado + Monitoramento D+7 criado');
    await notifyMsg(MSG.gateMaG(empresa)).catch(() => {});
    console.log('[Gate MA-G] ✅ GO-LIVE — campanhas no ar!');
    return { ok: true };

  } catch (err) {
    console.error('[Gate MA-G] Erro:', err.message);
    await notifyMsg(MSG.erroSistema(empresa, 'Gate MA-G', err.message)).catch(() => {});
    return { ok: false, error: err.message };
  }
}
