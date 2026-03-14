#!/usr/bin/env node
/**
 * ESCALANDO PREMOLDADOS — Registrar Go-Live de Campanha Meta Ads
 *
 * Uso:
 *   node scripts/registrar-golive.js --task=TASK_ID --cliente=concrenor
 *
 * O script:
 *   1. Lê o card ClickUp para extrair dados da campanha
 *   2. Salva go-live em data/campanhas.json
 *   3. Posta comentário de confirmação no card
 *   4. Agenda automaticamente D+7 e D+15 no registro
 */

import fs from 'fs';
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
const cliente = (args.cliente || 'concrenor').toLowerCase();

// ── Helpers ClickUp ──────────────────────────────────────────
async function clickupGet(endpoint) {
  const r = await fetch(`https://api.clickup.com/api/v2${endpoint}`, {
    headers: { Authorization: CLICKUP_KEY },
  });
  if (!r.ok) throw new Error(`ClickUp GET ${endpoint} → ${r.status}`);
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

function extrairCampos(task) {
  const cf = {};
  for (const f of (task.custom_fields || [])) {
    if (f.value !== null && f.value !== undefined && f.value !== '') {
      if (f.type === 'drop_down' && f.type_config?.options) {
        const opt = f.type_config.options.find(o => o.orderindex === f.value);
        cf[f.name] = opt ? opt.name : f.value;
      } else {
        cf[f.name] = typeof f.value === 'string' ? f.value.trim() : f.value;
      }
    }
  }
  return cf;
}

// ── MAIN ─────────────────────────────────────────────────────
(async () => {
  console.log(`\n🚀 Registrando go-live — ${cliente}`);
  if (taskId) console.log(`   Task: ${taskId}`);

  const hoje = new Date();
  const dataGolive = hoje.toISOString().split('T')[0];
  const d7 = new Date(hoje); d7.setDate(d7.getDate() + 7);
  const d15 = new Date(hoje); d15.setDate(d15.getDate() + 15);

  // Lê dados do card se task_id disponível
  let campanha = {};
  if (taskId && CLICKUP_KEY) {
    try {
      const task = await clickupGet(`/task/${taskId}`);
      const cf = extrairCampos(task);
      campanha = {
        task_id:   taskId,
        task_name: task.name,
        produto:   cf['Produto'] || cf['Produto Foco'] || '—',
        fluxo:     cf['Fluxo'] || 'B - Direto WhatsApp',
        budget:    cf['Budget Diario (R$)'] || '—',
        cpl_meta:  cf['CPL Meta (R$)'] || '—',
      };
    } catch (e) {
      console.warn('   Aviso: não foi possível ler o card ClickUp:', e.message);
    }
  }

  // Carrega / atualiza data/campanhas.json
  const campFile = path.join(ROOT, 'data/campanhas.json');
  let dados = { campanhas: [] };
  try {
    if (fs.existsSync(campFile)) dados = JSON.parse(fs.readFileSync(campFile, 'utf8'));
  } catch { /* arquivo corrompido — recria */ }

  const registro = {
    cliente,
    data_golive:  dataGolive,
    d7:           d7.toISOString().split('T')[0],
    d15:          d15.toISOString().split('T')[0],
    d7_executado: false,
    d15_executado: false,
    registrado_em: new Date().toISOString(),
    ...campanha,
  };

  // Remove registro antigo do mesmo cliente+task e adiciona o novo
  dados.campanhas = dados.campanhas.filter(
    c => !(c.cliente === cliente && c.task_id === taskId)
  );
  dados.campanhas.push(registro);

  fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
  fs.writeFileSync(campFile, JSON.stringify(dados, null, 2));

  console.log(`   ✅ Go-live registrado!`);
  console.log(`   📅 D+7:  ${registro.d7} (monitoramento)`);
  console.log(`   📅 D+15: ${registro.d15} (relatório completo)`);

  // Posta comentário de confirmação no ClickUp
  if (taskId && CLICKUP_KEY) {
    try {
      const msg = `🚀 **Go-Live Registrado!**

📅 **Data de Go-Live:** ${dataGolive}

**Ciclo de Otimização:**
- 📊 D+7 (${registro.d7}): Monitoramento automático — CPL, CTR, frequência vs metas
- 📈 D+15 (${registro.d15}): Relatório completo de performance + recomendações

O sistema irá rodar verificações automáticas nas datas programadas e postar os resultados aqui.

_Registrado automaticamente — Escalando Premoldados_`;
      await clickupComment(taskId, msg);
      console.log(`   💬 Comentário postado no ClickUp`);
    } catch (e) {
      console.warn('   Aviso ao comentar:', e.message);
    }
  }

  console.log('\n✅ Concluído.\n');
})();
