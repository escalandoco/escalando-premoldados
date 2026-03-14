#!/usr/bin/env node
/**
 * ESCALANDO PREMOLDADOS — Aprovar Gate Meta Ads
 *
 * Uso:
 *   node scripts/aprovar-gate.js --task=PARENT_ID --gate=copy
 *   node scripts/aprovar-gate.js --task=PARENT_ID --gate=criativos
 *
 * Gates suportados:
 *   copy       → MA-D — Copy Aprovada
 *   criativos  → MA-E — Criativos Aprovados
 *   golive     → MA-G — Go-Live Autorizado
 *   briefing   → MA-B — Briefing + Benchmarking
 *   estrategia → MA-C — Estrategia + Nomenclatura
 *
 * O script:
 *   1. Busca subtasks do card pai no ClickUp
 *   2. Encontra o gate pelo nome
 *   3. Marca como "complete"
 *   4. Posta comentário de confirmação no card pai
 *   5. Se gate = golive → também aciona registrar-golive
 */

import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const CLICKUP_KEY = process.env.CLICKUP_API_KEY;

// ── CLI args ─────────────────────────────────────────────────
const args = {};
for (const a of process.argv.slice(2)) {
  const [k, ...v] = a.replace(/^--/, '').split('=');
  args[k] = v.join('=') || true;
}

const taskId  = args.task || args.task_id;
const gateArg = (args.gate || '').toLowerCase();
const cliente = (args.cliente || 'concrenor').toLowerCase();

if (!taskId || !gateArg) {
  console.error('Uso: node scripts/aprovar-gate.js --task=TASK_ID --gate=copy|criativos|golive|briefing|estrategia');
  process.exit(1);
}

// ── Mapeamento gate → padrão de nome do subtask ──────────────
const GATE_MAP = {
  'copy':        { pattern: 'MA-D',        label: '✏️ Gate MA-D — Copy Aprovada',          next: 'Próximo: encaminhar brief para o designer/Canva' },
  'criativos':   { pattern: 'MA-E',        label: '🎨 Gate MA-E — Criativos Aprovados',    next: 'Próximo: checar reputação da conta e preparar go-live' },
  'golive':      { pattern: 'MA-G',        label: '🚀 Gate MA-G — Go-Live Autorizado',     next: 'Campanha autorizada! Registrar go-live para ativar ciclo D+7/D+15.' },
  'briefing':    { pattern: 'MA-B',        label: '📋 Gate MA-B — Briefing Aprovado',      next: 'Próximo: definir estratégia e nomenclatura MAT (MA-C)' },
  'estrategia':  { pattern: 'MA-C',        label: '📐 Gate MA-C — Estratégia Aprovada',    next: 'Próximo: criar copy com 7 pilares Pedro Sobral (MA-D)' },
};

const gateCfg = GATE_MAP[gateArg];
if (!gateCfg) {
  console.error(`Gate desconhecido: "${gateArg}". Use: copy, criativos, golive, briefing, estrategia`);
  process.exit(1);
}

// ── Helpers ClickUp ──────────────────────────────────────────
async function clickupGet(endpoint) {
  const r = await fetch(`https://api.clickup.com/api/v2${endpoint}`, {
    headers: { Authorization: CLICKUP_KEY },
  });
  if (!r.ok) throw new Error(`ClickUp GET ${endpoint} → ${r.status}`);
  return r.json();
}

async function clickupUpdateStatus(id, status) {
  const r = await fetch(`https://api.clickup.com/api/v2/task/${id}`, {
    method: 'PUT',
    headers: { Authorization: CLICKUP_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!r.ok) {
    const msg = await r.text();
    throw new Error(`Status update ${r.status}: ${msg.slice(0, 200)}`);
  }
  return r.json();
}

async function clickupComment(id, text) {
  const r = await fetch(`https://api.clickup.com/api/v2/task/${id}/comment`, {
    method: 'POST',
    headers: { Authorization: CLICKUP_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ comment_text: text, notify_all: true }),
  });
  if (!r.ok) throw new Error(`ClickUp comment ${r.status}`);
}

// ── MAIN ─────────────────────────────────────────────────────
(async () => {
  console.log(`\n✅ Aprovar Gate — ${gateCfg.label}`);
  console.log(`   Task pai: ${taskId}`);

  // 1. Busca subtasks do card pai
  const task = await clickupGet(`/task/${taskId}?subtasks=true`);
  const subtasks = task.subtasks || [];

  if (!subtasks.length) {
    // Tenta listar via endpoint de subtasks
    const listId = task.list?.id;
    if (listId) {
      const { tasks } = await clickupGet(`/list/${listId}/task?subtasks=true&include_closed=true`).catch(() => ({ tasks: [] }));
      subtasks.push(...(tasks || []).filter(t => t.parent === taskId));
    }
  }

  console.log(`   Subtasks encontrados: ${subtasks.length}`);

  // 2. Encontra o gate pelo padrão
  const gate = subtasks.find(s => s.name.includes(gateCfg.pattern));

  if (!gate) {
    console.error(`   ❌ Gate "${gateCfg.pattern}" não encontrado nos subtasks.`);
    console.log('   Subtasks disponíveis:', subtasks.map(s => s.name).join(', ') || '(nenhum)');

    await clickupComment(taskId,
      `⚠️ **Gate não encontrado**\n\nNão foi possível localizar o subtask "${gateCfg.pattern}".\n` +
      `Subtasks existentes: ${subtasks.map(s => s.name).join(', ') || 'nenhum'}\n\n` +
      `_Sistema Escalando Premoldados_`
    );
    process.exit(1);
  }

  console.log(`   Gate encontrado: "${gate.name}" (${gate.id}) — status atual: ${gate.status?.status}`);

  // 3. Marca como complete
  try {
    await clickupUpdateStatus(gate.id, 'complete');
    console.log(`   ✅ Status atualizado para "complete"`);
  } catch (e) {
    console.warn(`   ⚠️ Não foi possível atualizar status: ${e.message}`);
    console.log(`   Continuando mesmo assim...`);
  }

  // 4. Posta comentário de confirmação
  const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Recife', day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
  const msg = `${gateCfg.label.split('—')[0].trim()} **${gateCfg.label.split('—')[1]?.trim() || 'Aprovado'}** ✅

📅 Aprovado em: ${agora}
🔗 Gate: \`${gate.id}\` — ${gate.name}

${gateCfg.next}

_Registrado automaticamente — Escalando Premoldados_`;

  await clickupComment(taskId, msg);
  console.log(`   💬 Comentário postado no card`);

  // 5. Se go-live: aciona registrar-golive
  if (gateArg === 'golive') {
    console.log(`   🚀 Acionando registrar-golive...`);
    try {
      execSync(
        `node --env-file=${ROOT}/.env ${ROOT}/scripts/registrar-golive.js --task=${taskId} --cliente=${cliente}`,
        { cwd: ROOT, stdio: 'inherit' }
      );
    } catch (e) {
      console.warn('   Aviso ao registrar go-live:', e.message);
    }
  }

  console.log('\n✅ Concluído.\n');
})();
