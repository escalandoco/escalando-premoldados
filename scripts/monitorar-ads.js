#!/usr/bin/env node
/**
 * ESCALANDO PREMOLDADOS — Monitor Diário de Anúncios
 *
 * Uso:
 *   node scripts/monitorar-ads.js --cliente=Concrenor
 *   node scripts/monitorar-ads.js --cliente=Concrenor --dias=7
 *
 * O script:
 *   1. Lê config/log-ads-{cliente}.json (últimos N dias)
 *   2. Avalia CPL, CTR, frequência contra as metas definidas
 *   3. Imprime alertas no console (GitHub Actions → log visível)
 *   4. Se META_WEBHOOK_CLICKUP configurado, cria task de alerta no ClickUp
 *   5. Exit code 1 se há alertas críticos (dispara notificação no CI)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// ---- CLI args ----
const args = {};
for (const a of process.argv.slice(2)) {
  const [k, ...v] = a.replace(/^--/, '').split('=');
  args[k] = v.join('=') || true;
}

function toSlug(str) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const clienteRaw = args.cliente || args.c;
if (!clienteRaw) {
  console.error('Uso: node scripts/monitorar-ads.js --cliente=NomeCliente');
  process.exit(1);
}

const clienteSlug = toSlug(clienteRaw);
const diasAnalisar = parseInt(args.dias || '3');

// ---- Limites por produto (Concrenor) ----
const LIMITES = {
  cpl_meta: 60,       // CPL meta (R$)
  cpl_max: 100,       // CPL máximo aceitável (R$)
  ctr_min: 0.5,       // CTR mínimo (%)
  ctr_meta: 1.5,      // CTR meta (%)
  cpm_max: 80,        // CPM máximo (R$)
  frequencia_max: 4.0,// Frequência máxima antes da fadiga
  gasto_min_dia: 20,  // Gasto mínimo esperado por dia (R$)
};

// ---- Análise ----
function analisarLog(registros, dias) {
  const recentes = registros
    .filter(r => !r._template)
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, dias);

  if (recentes.length === 0) return { alertas: [], info: [], dados: null };

  const alertas = [];
  const info    = [];

  // Médias dos últimos N dias
  const media = recentes.reduce((acc, r) => {
    acc.cpl   += r.cpl_brl || 0;
    acc.ctr   += r.ctr_pct || 0;
    acc.cpm   += r.cpm_brl || 0;
    acc.freq  += r.frequencia || 0;
    acc.gasto += r.gasto_total_brl || 0;
    acc.leads += r.leads || 0;
    return acc;
  }, { cpl: 0, ctr: 0, cpm: 0, freq: 0, gasto: 0, leads: 0 });

  const n = recentes.length;
  media.cpl  = +(media.cpl  / n).toFixed(2);
  media.ctr  = +(media.ctr  / n).toFixed(2);
  media.cpm  = +(media.cpm  / n).toFixed(2);
  media.freq = +(media.freq / n).toFixed(2);
  media.gasto_total = +media.gasto.toFixed(2);
  media.dias = n;

  // CPL
  if (media.cpl > LIMITES.cpl_max) {
    alertas.push({ nivel: 'CRITICO', metrica: 'CPL', valor: `R$${media.cpl}`, limite: `R$${LIMITES.cpl_max}`, acao: 'Pausar conjuntos com CPL alto. Revisar criativos.' });
  } else if (media.cpl > LIMITES.cpl_meta && media.cpl <= LIMITES.cpl_max) {
    alertas.push({ nivel: 'ATENCAO', metrica: 'CPL', valor: `R$${media.cpl}`, limite: `meta R$${LIMITES.cpl_meta}`, acao: 'Monitorar por mais 2 dias. Se mantiver, testar novo hook.' });
  } else if (media.cpl > 0 && media.cpl <= LIMITES.cpl_meta) {
    info.push({ metrica: 'CPL', valor: `R$${media.cpl}`, status: 'OK', obs: 'Dentro da meta.' });
  }

  // CTR
  if (media.ctr > 0 && media.ctr < LIMITES.ctr_min) {
    alertas.push({ nivel: 'CRITICO', metrica: 'CTR', valor: `${media.ctr}%`, limite: `min ${LIMITES.ctr_min}%`, acao: 'Hook fraco. Testar novo criativo (V3 ou novo hook).' });
  } else if (media.ctr >= LIMITES.ctr_min && media.ctr < LIMITES.ctr_meta) {
    info.push({ metrica: 'CTR', valor: `${media.ctr}%`, status: 'ATENCAO', obs: 'Abaixo da meta. Monitorar.' });
  } else if (media.ctr >= LIMITES.ctr_meta) {
    info.push({ metrica: 'CTR', valor: `${media.ctr}%`, status: 'OK', obs: 'Acima da meta.' });
  }

  // Frequência (fadiga)
  if (media.freq > LIMITES.frequencia_max) {
    alertas.push({ nivel: 'ATENCAO', metrica: 'Frequência', valor: media.freq, limite: `max ${LIMITES.frequencia_max}`, acao: 'Fadiga de criativo. Pausar anúncio e lançar novo.' });
  }

  // CPM
  if (media.cpm > LIMITES.cpm_max) {
    alertas.push({ nivel: 'ATENCAO', metrica: 'CPM', valor: `R$${media.cpm}`, limite: `max R$${LIMITES.cpm_max}`, acao: 'Público saturado ou leilão disputado. Expandir público.' });
  }

  // Gasto zerado (campanha parou?)
  if (media.gasto_total < LIMITES.gasto_min_dia * n) {
    alertas.push({ nivel: 'CRITICO', metrica: 'Gasto', valor: `R$${media.gasto_total}`, limite: `esperado R$${LIMITES.gasto_min_dia * n}`, acao: 'Campanha pausada ou método de pagamento com problema. Verificar conta.' });
  }

  // Potencial de escala
  const ultimosDias = recentes.slice(0, 7);
  if (ultimosDias.length >= 7) {
    const cplsBaixos = ultimosDias.filter(r => r.cpl_brl > 0 && r.cpl_brl <= LIMITES.cpl_meta);
    if (cplsBaixos.length === 7) {
      info.push({ metrica: 'Escala', valor: '7 dias consecutivos', status: 'OPORTUNIDADE', obs: `CPL abaixo de R$${LIMITES.cpl_meta} por 7 dias. Considerar aumentar orçamento 20-30%.` });
    }
  }

  return { alertas, info, dados: media };
}

// ---- ClickUp alert (opcional) ----
async function criarTaskClickUp(cliente, alertas, dados) {
  const apiKey = process.env.CLICKUP_API_KEY;
  const listId = process.env.CLICKUP_LIST_ACOES_DIA;
  if (!apiKey || !listId) return;

  const texto = alertas.map(a => `[${a.nivel}] ${a.metrica}: ${a.valor} (limite: ${a.limite})\nAção: ${a.acao}`).join('\n\n');
  const hoje  = new Date().toLocaleDateString('pt-BR');
  const temCritico = alertas.some(a => a.nivel === 'CRITICO');

  // Custom field IDs — Ações do Dia
  const CF = {
    cpl:    'faa57f3f-ec17-4f8c-8982-e39984fb4b78',
    ctr:    '2b5d6b80-7d78-412e-ae17-865b24c78ba3',
    cpm:    'ba4c016e-ebda-405f-b815-0ae97ec2605b',
    leads:  'aa1d596f-ca08-41b4-bbd5-468c58e9a848',
    status: '630933ea-8521-42ba-b8ca-072d2e0c3710',
  };

  try {
    const resp = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task`, {
      method: 'POST',
      headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `[ALERTA ADS] ${cliente} — ${hoje}`,
        description: texto,
        priority: temCritico ? 1 : 2,
        tags: ['ads', 'alerta'],
      }),
    });
    const task = await resp.json();
    console.log('  Task de alerta criada no ClickUp.');
    if (!task.id) return;

    // Popula campos customizados
    const campos = [
      { id: CF.status, value: temCritico ? 2 : 1 }, // 0=Normal 1=Atenção 2=Crítico
    ];
    if (dados) {
      if (dados.cpl   > 0) campos.push({ id: CF.cpl,   value: dados.cpl   });
      if (dados.ctr   > 0) campos.push({ id: CF.ctr,   value: dados.ctr   });
      if (dados.cpm   > 0) campos.push({ id: CF.cpm,   value: dados.cpm   });
      if (dados.leads > 0) campos.push({ id: CF.leads, value: dados.leads });
    }
    await Promise.all(campos.map(c =>
      fetch(`https://api.clickup.com/api/v2/task/${task.id}/field/${c.id}`, {
        method: 'POST',
        headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: c.value }),
      })
    ));
  } catch {
    // silencia erro — alerta no console é suficiente
  }
}

// ---- Main ----
async function main() {
  const logPath = path.join(ROOT, 'config', `log-ads-${clienteSlug}.json`);

  if (!fs.existsSync(logPath)) {
    console.log(`\n⚠️  Log não encontrado: config/log-ads-${clienteSlug}.json`);
    console.log(`   Preencha o log após publicar a campanha.\n`);
    process.exit(0);
  }

  const log = JSON.parse(fs.readFileSync(logPath, 'utf8'));
  const registros = log.registros || [];

  console.log(`\n📡 Monitoramento de Anúncios — ${clienteRaw}`);
  console.log(`   Analisando últimos ${diasAnalisar} dias\n`);

  const { alertas, info, dados } = analisarLog(registros, diasAnalisar);

  if (!dados) {
    console.log('  ℹ️  Nenhum registro no log ainda. Preencha após publicar a campanha.\n');
    process.exit(0);
  }

  console.log(`  Médias (${dados.dias} dias):`);
  console.log(`    CPL: R$${dados.cpl}  CTR: ${dados.ctr}%  CPM: R$${dados.cpm}  Freq: ${dados.freq}  Gasto total: R$${dados.gasto_total}\n`);

  // Info / positivos
  if (info.length > 0) {
    info.forEach(i => {
      const icone = i.status === 'OK' ? '✅' : i.status === 'OPORTUNIDADE' ? '🚀' : 'ℹ️';
      console.log(`  ${icone} ${i.metrica} ${i.valor} — ${i.obs}`);
    });
    console.log('');
  }

  // Alertas
  if (alertas.length === 0) {
    console.log('  ✅ Nenhum alerta. Campanha dentro dos parâmetros.\n');
    process.exit(0);
  }

  console.log(`  ⚠️  ${alertas.length} alerta(s) encontrado(s):\n`);
  alertas.forEach((a, i) => {
    const icone = a.nivel === 'CRITICO' ? '🔴' : '🟡';
    console.log(`  ${icone} [${a.nivel}] ${a.metrica}: ${a.valor} (limite: ${a.limite})`);
    console.log(`     Ação: ${a.acao}\n`);
  });

  // ClickUp alert
  await criarTaskClickUp(clienteRaw, alertas, dados);

  const temCritico = alertas.some(a => a.nivel === 'CRITICO');
  if (temCritico) {
    console.log('  ❌ Alertas críticos encontrados. Ação imediata necessária.\n');
    process.exit(1);
  }

  console.log('  ⚠️  Alertas de atenção. Monitorar nos próximos dias.\n');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
