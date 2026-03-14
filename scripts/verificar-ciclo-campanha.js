#!/usr/bin/env node
/**
 * ESCALANDO PREMOLDADOS — Verificar Ciclo de Campanha Meta Ads
 *
 * Roda diariamente às 08:05h no VPS (após monitorar-ads).
 * Verifica data/campanhas.json e dispara automaticamente:
 *   - D+7:  monitoramento detalhado + alerta no ClickUp
 *   - D+15: relatório completo de performance no ClickUp
 *
 * Uso:
 *   node scripts/verificar-ciclo-campanha.js
 *   node scripts/verificar-ciclo-campanha.js --force-d7=concrenor
 *   node scripts/verificar-ciclo-campanha.js --force-d15=concrenor
 */

import fs    from 'fs';
import path  from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const CLICKUP_KEY = process.env.CLICKUP_API_KEY;
const VPS_URL     = process.env.VPS_URL     || 'http://129.121.45.61:3030';
const WKR_SECRET  = process.env.WORKER_SECRET || '';

// ── CLI args ─────────────────────────────────────────────────
const args = {};
for (const a of process.argv.slice(2)) {
  const [k, ...v] = a.replace(/^--/, '').split('=');
  args[k] = v.join('=') || true;
}

// ── Helper ClickUp ────────────────────────────────────────────
async function clickupComment(taskId, text) {
  if (!CLICKUP_KEY || !taskId) return;
  await fetch(`https://api.clickup.com/api/v2/task/${taskId}/comment`, {
    method: 'POST',
    headers: { Authorization: CLICKUP_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ comment_text: text, notify_all: true }),
  }).catch(e => console.warn('  Aviso ClickUp:', e.message));
}

// ── Helper: rodar script local ────────────────────────────────
async function rodarScript(script, extraArgs = '') {
  const cmd = `node --env-file=${ROOT}/.env ${ROOT}/scripts/${script}.js ${extraArgs}`;
  try {
    const { stdout, stderr } = await execAsync(cmd, { cwd: ROOT, timeout: 120000 });
    return { ok: true, output: (stdout + stderr).trim() };
  } catch (e) {
    return { ok: false, output: e.message };
  }
}

// ── MAIN ─────────────────────────────────────────────────────
(async () => {
  const hoje = new Date().toISOString().split('T')[0];
  console.log(`\n🔄 Verificar Ciclo Campanha — ${hoje}`);

  const campFile = path.join(ROOT, 'data/campanhas.json');
  if (!fs.existsSync(campFile)) {
    console.log('   Nenhuma campanha registrada ainda. Aguardando go-live.');
    return;
  }

  let dados;
  try {
    dados = JSON.parse(fs.readFileSync(campFile, 'utf8'));
  } catch (e) {
    console.error('   Erro ao ler campanhas.json:', e.message);
    return;
  }

  const campanhas = dados.campanhas || [];
  if (!campanhas.length) {
    console.log('   Nenhuma campanha ativa.');
    return;
  }

  let atualizado = false;

  for (const camp of campanhas) {
    const forceD7  = args['force-d7']  === camp.cliente || args['force-d7']  === 'all';
    const forceD15 = args['force-d15'] === camp.cliente || args['force-d15'] === 'all';

    // ── D+7: monitoramento detalhado ──────────────────────────
    if ((hoje === camp.d7 || forceD7) && !camp.d7_executado) {
      console.log(`\n📊 D+7 — ${camp.cliente} (go-live: ${camp.data_golive})`);

      const resultado = await rodarScript('monitorar-ads', `--cliente=${camp.cliente} --dias=7`);
      console.log(resultado.ok ? '   ✅ monitorar-ads executado' : '   ❌ Falha:', resultado.output.slice(0, 200));

      if (camp.task_id && CLICKUP_KEY) {
        const status = resultado.ok ? '✅ completo' : `⚠️ erro: ${resultado.output.slice(0, 100)}`;
        await clickupComment(camp.task_id,
          `📊 **Monitoramento D+7 — ${camp.cliente}**\n\n` +
          `Campanha está há 7 dias no ar desde ${camp.data_golive}.\n` +
          `Monitoramento automático: ${status}\n\n` +
          `Próxima verificação automática: D+15 (${camp.d15})\n\n` +
          `_Ciclo automático — Escalando Premoldados_`
        );
      }

      camp.d7_executado = true;
      atualizado = true;
    }

    // ── D+15: relatório completo ───────────────────────────────
    if ((hoje === camp.d15 || forceD15) && !camp.d15_executado) {
      console.log(`\n📈 D+15 — ${camp.cliente} (go-live: ${camp.data_golive})`);

      const resultado = await rodarScript('relatorio-ads', `--cliente=${camp.cliente}`);
      console.log(resultado.ok ? '   ✅ relatorio-ads executado' : '   ❌ Falha:', resultado.output.slice(0, 200));

      if (camp.task_id && CLICKUP_KEY) {
        const status = resultado.ok ? '✅ completo' : `⚠️ erro: ${resultado.output.slice(0, 100)}`;
        await clickupComment(camp.task_id,
          `📈 **Relatório D+15 — ${camp.cliente}**\n\n` +
          `Campanha completou 15 dias no ar desde ${camp.data_golive}.\n` +
          `Relatório completo de performance: ${status}\n\n` +
          `O relatório HTML foi gerado e o ciclo de otimização foi registrado.\n` +
          `Próximos passos: revisar CPL vs meta (R$${camp.cpl_meta || '60'}) e decidir se escala ou ajusta.\n\n` +
          `_Ciclo automático — Escalando Premoldados_`
        );
      }

      camp.d15_executado = true;
      atualizado = true;
    }
  }

  if (atualizado) {
    fs.writeFileSync(campFile, JSON.stringify(dados, null, 2));
    console.log('\n   💾 campanhas.json atualizado');
  }

  const pendentes = campanhas.filter(c => !c.d7_executado || !c.d15_executado);
  if (pendentes.length) {
    console.log('\n📅 Próximas verificações:');
    for (const c of pendentes) {
      if (!c.d7_executado)  console.log(`   D+7  ${c.d7}  — ${c.cliente}`);
      if (!c.d15_executado) console.log(`   D+15 ${c.d15} — ${c.cliente}`);
    }
  }

  console.log('\n✅ Concluído.\n');
})();
