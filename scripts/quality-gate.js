#!/usr/bin/env node
/**
 * ESCALANDO PREMOLDADOS — Quality Gate Engine
 *
 * Verifica se a fase anterior de uma LP está aprovada antes de avançar.
 *
 * Uso como CLI:
 *   node scripts/quality-gate.js --cliente=Concrenor --fase=4
 *   node scripts/quality-gate.js --cliente=Concrenor --campanha="Mourao Torneado" --fase=4
 *
 * Uso como módulo:
 *   import { verificarGate } from './quality-gate.js';
 *   const result = await verificarGate('Concrenor', 'Geral', 4);
 *   // { ok: true, motivo: '...', faltando: [] }
 */

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const IS_CLI = process.argv[1] === __filename;

// ---- Env ----
const CLICKUP_API_KEY = process.env.CLICKUP_API_KEY || 'pk_84613660_MVXFF2FG90QSK6YN1RLF1LBA7C4NXK7J';
const SPACE_CLIENTES  = process.env.CLICKUP_SPACE_ID || '901313678809';
const BASE_URL        = 'https://api.clickup.com/api/v2';

// Status do ClickUp que significam "aprovado"
const STATUS_APROVADOS = ['complete', 'aprovado', 'aprovada', 'done', 'no ar'];

// ============================================================
// FUNÇÃO PRINCIPAL (exportável)
// ============================================================
/**
 * Verifica se a fase anterior está aprovada para avançar para faseAlvo.
 * @param {string} cliente   - Nome do folder no ClickUp (ex: "Concrenor")
 * @param {string} campanha  - Nome da campanha (ex: "Geral", "Mourao Torneado")
 * @param {number} faseAlvo  - Fase que se quer executar (ex: 4)
 * @returns {{ ok: boolean, motivo: string, faltando: string[] }}
 */
export async function verificarGate(cliente, campanha = 'Geral', faseAlvo) {
  // Fase 1 não tem pré-requisito
  if (faseAlvo <= 1) {
    return { ok: true, motivo: 'Fase 1 não tem pré-requisito.', faltando: [] };
  }

  const faseAnterior = faseAlvo - 1;

  try {
    // 1. Encontra folder e lista
    const folderId = await encontrarFolder(cliente);
    const listaId  = await encontrarListaLandingPages(folderId, cliente);

    // 2. Busca tasks da lista
    const { tasks } = await cu('get', `/list/${listaId}/task?archived=false&include_closed=true`);

    // 3. Encontra a task da fase anterior
    const sufixo   = campanha !== 'Geral' ? ` — ${campanha}` : '';
    const nomeTask = `[FASE ${faseAnterior}]`;
    const task = tasks.find(t => t.name.startsWith(nomeTask) && t.name.includes(sufixo || ''));

    if (!task) {
      return {
        ok: false,
        motivo: `Task da Fase ${faseAnterior} não encontrada na lista "Landing Pages" — ${cliente}.`,
        faltando: [`Criar pipeline com: node scripts/criar-pipeline-lp.js --cliente=${cliente}`],
      };
    }

    // 4. Verifica status da task
    const statusAtual = (task.status?.status || '').toLowerCase();
    const statusOk    = STATUS_APROVADOS.some(s => statusAtual.includes(s));

    if (!statusOk) {
      return {
        ok: false,
        motivo: `Fase ${faseAnterior} ainda não aprovada (status atual: "${task.status?.status || 'desconhecido'}").`,
        faltando: [`Aprovar Fase ${faseAnterior} no ClickUp antes de avançar para Fase ${faseAlvo}.`],
      };
    }

    // 5. Verifica checklist items pendentes
    const faltando = await verificarChecklist(task.id);

    if (faltando.length > 0) {
      return {
        ok: false,
        motivo: `Fase ${faseAnterior} aprovada mas com ${faltando.length} item(s) pendente(s) no checklist.`,
        faltando,
      };
    }

    return {
      ok: true,
      motivo: `Fase ${faseAnterior} aprovada. Pode avançar para Fase ${faseAlvo}.`,
      faltando: [],
    };

  } catch (err) {
    return {
      ok: false,
      motivo: `Erro ao verificar gate: ${err.message}`,
      faltando: [],
    };
  }
}

// ============================================================
// Verifica checklist items não concluídos
// ============================================================
async function verificarChecklist(taskId) {
  const task = await cu('get', `/task/${taskId}?include_subtasks=false`);
  const faltando = [];

  for (const checklist of (task.checklists || [])) {
    for (const item of (checklist.items || [])) {
      if (!item.resolved) {
        faltando.push(item.name);
      }
    }
  }

  return faltando;
}

// ============================================================
// Encontra folder do cliente
// ============================================================
async function encontrarFolder(nomeCliente) {
  const { folders } = await cu('get', `/space/${SPACE_CLIENTES}/folder?archived=false`);
  const folder = folders.find(f => f.name.toLowerCase() === nomeCliente.toLowerCase());
  if (!folder) throw new Error(`Folder "${nomeCliente}" não encontrado no ClickUp.`);
  return folder.id;
}

// ============================================================
// Encontra lista "Landing Pages"
// ============================================================
async function encontrarListaLandingPages(folderId, nomeCliente) {
  const { lists } = await cu('get', `/folder/${folderId}/list?archived=false`);
  const lista = lists.find(l => l.name.toLowerCase() === 'landing pages');
  if (!lista) throw new Error(`Lista "Landing Pages" não encontrada no folder "${nomeCliente}".`);
  return lista.id;
}

// ============================================================
// ClickUp helper
// ============================================================
async function cu(method, urlPath, body) {
  const res = await fetch(`${BASE_URL}${urlPath}`, {
    method:  method.toUpperCase(),
    headers: { Authorization: CLICKUP_API_KEY, 'Content-Type': 'application/json' },
    body:    body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`ClickUp API [${method.toUpperCase()} ${urlPath}]: ${JSON.stringify(json)}`);
  return json;
}

// ============================================================
// CLI standalone
// ============================================================
if (IS_CLI) {
  const args = {};
  for (const a of process.argv.slice(2)) {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    args[k] = v.join('=') || true;
  }

  const cliente  = args.cliente;
  const campanha = args.campanha || 'Geral';
  const fase     = parseInt(args.fase, 10);

  if (!cliente || !fase) {
    console.error('Uso: node scripts/quality-gate.js --cliente=NomeCliente --fase=N [--campanha=NomeCampanha]');
    process.exit(1);
  }

  console.log(`\n🔍 Verificando Quality Gate`);
  console.log(`   Cliente:  ${cliente}`);
  console.log(`   Campanha: ${campanha}`);
  console.log(`   Fase alvo: ${fase}\n`);

  verificarGate(cliente, campanha, fase).then(result => {
    if (result.ok) {
      console.log(`✅ LIBERADO — ${result.motivo}\n`);
      process.exit(0);
    } else {
      console.log(`🚫 BLOQUEADO — ${result.motivo}`);
      if (result.faltando.length > 0) {
        console.log('\n   Pendências:');
        result.faltando.forEach(f => console.log(`   • ${f}`));
      }
      console.log('');
      process.exit(1);
    }
  }).catch(err => {
    console.error(`❌ Erro: ${err.message}`);
    process.exit(1);
  });
}
