#!/usr/bin/env node
/**
 * ESCALANDO PREMOLDADOS — Onboarding Alerta
 *
 * Roda diariamente via GitHub Actions.
 * Detecta clientes parados em algum gate de onboarding há mais de 48h
 * e envia WhatsApp para Jon.
 *
 * Uso:
 *   node --env-file=.env scripts/onboarding-alerta.js
 */

import { notifyMsg, MSG } from './notify.js';

const CLICKUP_API_KEY = process.env.CLICKUP_API_KEY;
const SPACE_CLIENTES  = process.env.CLICKUP_SPACE_ID || '901313678809';
const BASE_URL        = 'https://api.clickup.com/api/v2';
const HORAS_LIMITE    = 48;

async function cu(method, path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: method.toUpperCase(),
    headers: { Authorization: CLICKUP_API_KEY, 'Content-Type': 'application/json' },
  });
  return res.json();
}

function horasDesde(timestamp) {
  if (!timestamp) return 0;
  return (Date.now() - Number(timestamp)) / (1000 * 60 * 60);
}

function isDone(status) {
  const s = (status || '').toLowerCase();
  return ['complete', 'done', 'concluído'].some(d => s.includes(d));
}

async function verificarCliente(folder) {
  try {
    const { lists } = await cu('get', `/folder/${folder.id}/list?archived=false`);
    const onboarding = lists.find(l => l.name === 'Onboarding');
    if (!onboarding) return null;

    const { tasks } = await cu('get', `/list/${onboarding.id}/task?archived=false&include_closed=true`);

    for (const task of tasks) {
      // Só tasks de onboarding não concluídas
      if (isDone(task.status?.status)) continue;

      const nome  = task.name || '';
      const horas = Math.round(horasDesde(task.date_created));

      if (horas < HORAS_LIMITE) continue;

      let gate = null;
      if (nome.startsWith('💰 Confirmar Pagamento')) gate = 'Gate A (Confirmar Pagamento)';
      if (nome.startsWith('📋 Kickoff'))             gate = 'Gate B (Kickoff)';
      if (nome.startsWith('📸 Fotos Recebidas'))     gate = 'Gate C (Fotos)';

      if (gate) {
        return { empresa: folder.name, gate, horas };
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function main() {
  console.log('\n⏰ Onboarding Alerta — iniciando');
  console.log(`   Limite: ${HORAS_LIMITE}h sem movimento\n`);

  const { folders } = await cu('get', `/space/${SPACE_CLIENTES}/folder?archived=false`);
  const parados = [];

  for (const folder of folders) {
    const resultado = await verificarCliente(folder);
    if (resultado) parados.push(resultado);
  }

  if (parados.length === 0) {
    console.log('✅ Nenhum cliente parado no onboarding.');
    return;
  }

  console.log(`⚠️ ${parados.length} cliente(s) parado(s):`);
  for (const p of parados) {
    console.log(`   • ${p.empresa} — ${p.gate} — ${p.horas}h`);
    await notifyMsg(MSG.alertaParado(p.empresa, p.gate, p.horas));
  }

  console.log('\n✅ Alertas enviados.');
}

main().catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
