/**
 * ESCALANDO PREMOLDADOS — Onboarding Gate Engine
 *
 * Lógica dos 3 gates de onboarding:
 *   Gate A → Pagamento confirmado → libera Kickoff
 *   Gate B → Kickoff submetido → libera aguardar fotos
 *   Gate C → Fotos recebidas → libera produção (LP + Tráfego)
 *
 * Chamado por:
 *   api/clickup-status-change.js  (Gates A e C)
 *   api/onboarding.js             (Gate B — no submit do kickoff)
 */

import { notifyMsg, MSG } from './notify.js';

const CLICKUP_API_KEY = process.env.CLICKUP_API_KEY;
const SPACE_CLIENTES  = process.env.CLICKUP_SPACE_ID || '901313553858';
const SPACE_OPERACAO  = process.env.CLICKUP_SPACE_OPERACAO || '901313601522';
const BASE_URL        = 'https://api.clickup.com/api/v2';
const KICKOFF_URL     = (process.env.KICKOFF_URL || 'https://escalando.co/kickoff').trim();

// Status que significam "concluído" no ClickUp
const STATUS_DONE = ['complete', 'done', 'concluído', 'concluida', 'aprovado'];

// ── ClickUp helper ─────────────────────────────────────────────────────────────
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

function isDone(status) {
  return STATUS_DONE.some(s => (status || '').toLowerCase().includes(s));
}

// ── Encontra folder do cliente ────────────────────────────────────────────────
async function encontrarFolder(empresa) {
  const { folders } = await cu('get', `/space/${SPACE_CLIENTES}/folder?archived=false`);
  return folders.find(f => f.name.toLowerCase() === empresa.toLowerCase()) || null;
}

// ── Encontra lista por nome dentro de um folder ───────────────────────────────
async function encontrarLista(folderId, nome) {
  const { lists } = await cu('get', `/folder/${folderId}/list?archived=false`);
  return lists.find(l => l.name.toLowerCase() === nome.toLowerCase()) || null;
}

// ── Encontra task por prefixo de nome dentro de uma lista ─────────────────────
async function encontrarTask(listId, prefixo) {
  const { tasks } = await cu('get', `/list/${listId}/task?archived=false`);
  return tasks.find(t => t.name.toLowerCase().startsWith(prefixo.toLowerCase())) || null;
}

// ── Lê Ficha do Cliente em OPERAÇÃO/Fichas ────────────────────────────────────
async function getFichasList() {
  const listId = process.env.CLICKUP_LIST_FICHAS;
  if (listId) return { id: listId };

  const data = await cu('get', `/space/${SPACE_OPERACAO}/list?archived=false`).catch(() => ({ lists: [] }));
  return (data.lists || []).find(l => l.name === 'Fichas') || null;
}

async function lerFicha(empresa) {
  const lista = await getFichasList();
  if (!lista) return null;
  const { tasks } = await cu('get', `/list/${lista.id}/task?archived=false`);
  return (tasks || []).find(t => t.name.toLowerCase() === `ficha — ${empresa.toLowerCase()}`) || null;
}

// ============================================================
// GATE A — Pagamento confirmado → libera Kickoff
// ============================================================
export async function gateA(empresa, whatsappCliente) {
  console.log(`\n[Gate A] Iniciando para: ${empresa}`);

  try {
    const folder = await encontrarFolder(empresa);
    if (!folder) throw new Error(`Folder "${empresa}" não encontrado.`);

    // Valida Ficha do Cliente em OPERAÇÃO/Fichas via custom fields
    const ficha  = await lerFicha(empresa);
    const campos = ficha?.custom_fields || [];

    function cfVazio(nome) {
      const f = campos.find(c => c.name === nome);
      if (!f) return true;
      const v = f.value;
      return v === null || v === undefined || v === '' || v === '—';
    }

    const faltando = [];
    if (cfVazio('Responsável')) faltando.push('Responsável');
    if (cfVazio('WhatsApp'))    faltando.push('WhatsApp');
    if (cfVazio('Plano'))       faltando.push('Plano');

    if (faltando.length > 0) {
      console.warn('[Gate A] FALHOU — campos faltando:', faltando);
      await notifyMsg(MSG.gateAFalha(empresa, faltando)).catch(() => {});
      return { ok: false, faltando };
    }

    // Cria task de Kickoff na lista Onboarding
    const onboarding = await encontrarLista(folder.id, 'Onboarding');
    if (!onboarding) throw new Error('Lista Onboarding não encontrada.');

    // Verifica se task de kickoff já existe
    const taskExistente = await encontrarTask(onboarding.id, '📋 Kickoff');
    if (!taskExistente) {
      const kickoffLink = `${KICKOFF_URL}?cliente=${encodeURIComponent(empresa)}`;
      await cu('post', `/list/${onboarding.id}/task`, {
        name: `📋 Kickoff — ${empresa}`,
        description: `Preencher junto com o cliente na reunião:\n\n👉 ${kickoffLink}`,
        priority: 1,
      });
      console.log('[Gate A] Task de Kickoff criada.');
    }

    // Notifica Jon
    await notifyMsg(MSG.gateAJon(empresa)).catch(() => {});

    console.log('[Gate A] ✅ PASSOU');
    return { ok: true };

  } catch (err) {
    console.error('[Gate A] Erro:', err.message);
    await notifyMsg(MSG.erroSistema(empresa, 'Gate A', err.message)).catch(() => {});
    return { ok: false, error: err.message };
  }
}

// ============================================================
// GATE B — Kickoff submetido → valida briefing
// ============================================================
export async function gateB(empresa, dadosKickoff, whatsappCliente) {
  console.log(`\n[Gate B] Iniciando para: ${empresa}`);

  try {
    const faltando = [];
    if (!dadosKickoff.objetivoPrincipal) faltando.push('Objetivo principal');
    if (!dadosKickoff.produtos)          faltando.push('Produtos');
    if (!dadosKickoff.perfilClientes)    faltando.push('Perfil dos clientes');
    if (!dadosKickoff.areaAtuacao)       faltando.push('Área de atuação');

    if (faltando.length > 0) {
      console.warn('[Gate B] FALHOU — campos faltando:', faltando);
      await notifyMsg(MSG.gateBFalha(empresa, faltando)).catch(() => {});
      return { ok: false, faltando };
    }

    // Marca task de Kickoff como concluída
    const folder = await encontrarFolder(empresa);
    if (folder) {
      const onboarding = await encontrarLista(folder.id, 'Onboarding');
      if (onboarding) {
        const kickoffTask = await encontrarTask(onboarding.id, '📋 Kickoff');
        if (kickoffTask && !isDone(kickoffTask.status?.status)) {
          await cu('put', `/task/${kickoffTask.id}`, { status: 'complete' }).catch(() => {});
        }
      }
    }

    // Notifica
    await notifyMsg(MSG.gateBJon(empresa)).catch(() => {});

    console.log('[Gate B] ✅ PASSOU');
    return { ok: true };

  } catch (err) {
    console.error('[Gate B] Erro:', err.message);
    return { ok: false, error: err.message };
  }
}

// ============================================================
// GATE C — Fotos recebidas → valida tudo e libera produção
// ============================================================
export async function gateC(empresa) {
  console.log(`\n[Gate C] Iniciando para: ${empresa}`);

  try {
    const folder = await encontrarFolder(empresa);
    if (!folder) throw new Error(`Folder "${empresa}" não encontrado.`);

    const onboarding = await encontrarLista(folder.id, 'Onboarding');
    if (!onboarding) throw new Error('Lista Onboarding não encontrada.');

    const { tasks } = await cu('get', `/list/${onboarding.id}/task?archived=false`);

    const faltando = [];

    // Verifica se Kickoff está completo
    const kickoffTask = tasks.find(t => t.name.toLowerCase().startsWith('📋 kickoff'));
    if (!kickoffTask || !isDone(kickoffTask.status?.status)) {
      faltando.push('Kickoff não concluído');
    }

    // Verifica se Fotos está completo
    const fotosTask = tasks.find(t => t.name.toLowerCase().startsWith('📸 fotos'));
    if (!fotosTask || !isDone(fotosTask.status?.status)) {
      faltando.push('Fotos não recebidas');
    }

    // Valida Ficha do Cliente em OPERAÇÃO/Fichas
    const ficha = await lerFicha(empresa);
    const desc  = ficha?.description || '';
    if (!desc.includes('Objetivo')) {
      faltando.push('Objetivo principal não preenchido na Ficha');
    }

    if (faltando.length > 0) {
      console.warn('[Gate C] FALHOU:', faltando);
      await notifyMsg(MSG.gateCFalha(empresa, faltando)).catch(() => {});
      return { ok: false, faltando };
    }

    // Descobre plano para criar tasks corretas
    const plano = desc.includes('Pro') ? 'pro' : desc.includes('Growth') ? 'growth' : 'starter';

    // Cria 1ª task no squad LP
    const listaLP = await encontrarLista(folder.id, 'Landing Pages');
    if (listaLP) {
      const lpExiste = await encontrarTask(listaLP.id, '📝 LP Briefing');
      if (!lpExiste) {
        await cu('post', `/list/${listaLP.id}/task`, {
          name: `📝 LP Briefing — ${empresa}`,
          description: `Primeira task do squad de Landing Page.\n\nColetar dados visuais e criativos para gerar a LP.\n\n👉 Usar formulário: https://escalando.co/lp-briefing?cliente=${encodeURIComponent(empresa)}`,
          priority: 1,
        });
        console.log('[Gate C] Task LP Briefing criada.');
      }
    }

    // Cria 1ª task no squad Tráfego (growth/pro)
    if (plano === 'growth' || plano === 'pro') {
      const listaMeta = await encontrarLista(folder.id, 'Meta Ads');
      if (listaMeta) {
        const metaExiste = await encontrarTask(listaMeta.id, '🔑 Coletar Acessos');
        if (!metaExiste) {
          await cu('post', `/list/${listaMeta.id}/task`, {
            name: `🔑 Coletar Acessos — ${empresa}`,
            description: `Primeira task do squad de Tráfego Pago.\n\nSolicitar ao cliente:\n- Meta Business Manager (admin: jonatas@escalando.co)\n- Google Meu Negócio (gerente: jonatas@escalando.co)\n${plano === 'pro' ? '- Google Ads (admin: jonatas@escalando.co)' : ''}`,
            priority: 1,
          });
          console.log('[Gate C] Task Coletar Acessos criada.');
        }
      }
    }

    // Notifica Jon
    await notifyMsg(MSG.gateCJon(empresa)).catch(() => {});

    console.log('[Gate C] ✅ PASSOU — produção liberada');
    return { ok: true };

  } catch (err) {
    console.error('[Gate C] Erro:', err.message);
    await notifyMsg(MSG.erroSistema(empresa, 'Gate C', err.message)).catch(() => {});
    return { ok: false, error: err.message };
  }
}
