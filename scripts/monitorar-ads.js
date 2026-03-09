#!/usr/bin/env node
/**
 * ESCALANDO PREMOLDADOS — Monitor de Anúncios (Meta API)
 *
 * Uso:
 *   node scripts/monitorar-ads.js --cliente=concrenor
 *   node scripts/monitorar-ads.js --cliente=concrenor --dias=7
 *
 * Fluxo:
 *   1. Lê config/briefing-ads-{cliente}.json → pega ad_account_id
 *   2. Chama Meta Marketing API → insights dos últimos N dias
 *   3. Avalia CPL, CTR, frequência, gasto contra metas
 *   4. Posta resultado como comentário na task do ClickUp (se task_id passado)
 *      OU cria task de alerta em "Ações do Dia" se houver alertas
 *
 * Env vars necessárias:
 *   META_ADS_TOKEN       — token de acesso Meta Marketing API
 *   META_AD_ACCOUNT_ID   — conta padrão (sobreposto pelo briefing-ads)
 *   CLICKUP_API_KEY      — para criar tasks
 *   CLICKUP_BOT_API_KEY  — para postar comentários (bot Escalando)
 *   CLICKUP_LIST_ACOES_DIA — lista onde criar tasks de alerta
 */

import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { appendSection } from './dossie.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.join(__dirname, '..');

// ── CLI args ──────────────────────────────────────────────────
const args = {};
for (const a of process.argv.slice(2)) {
  const [k, ...v] = a.replace(/^--/, '').split('=');
  args[k] = v.join('=') || true;
}

function toSlug(str) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}

const clienteRaw  = args.cliente || args.c;
const taskId      = args.task_id || null;   // passado pelo dispatcher
const diasAnalisar = parseInt(args.dias || '7');

if (!clienteRaw) {
  console.error('Uso: node scripts/monitorar-ads.js --cliente=concrenor');
  process.exit(1);
}

const clienteSlug = toSlug(clienteRaw);

// ── ENV ───────────────────────────────────────────────────────
const META_TOKEN      = process.env.META_ADS_TOKEN;
const CLICKUP_KEY     = process.env.CLICKUP_API_KEY;
const CLICKUP_BOT_KEY = process.env.CLICKUP_BOT_API_KEY || CLICKUP_KEY;
const CLICKUP_LIST    = process.env.CLICKUP_LIST_ACOES_DIA;
const JON_USER_ID     = 84613660;

// ── CONFIG DO CLIENTE ─────────────────────────────────────────
function carregarConfig() {
  const briefingPath = path.join(ROOT, 'config', `briefing-ads-${clienteSlug}.json`);
  if (!fs.existsSync(briefingPath)) {
    throw new Error(`Config não encontrada: config/briefing-ads-${clienteSlug}.json`);
  }
  const b = JSON.parse(fs.readFileSync(briefingPath, 'utf8'));
  const adAccountId = (b.acessos_necessarios?.meta_ad_account_id || process.env.META_AD_ACCOUNT_ID || '').replace('act_','');
  if (!adAccountId) throw new Error('meta_ad_account_id não encontrado no briefing nem em META_AD_ACCOUNT_ID.');
  return {
    adAccountId,
    orcamentoDiario: (b.orcamento_mensal_brl || 1500) / 30,
    empresa: b.cliente || clienteRaw,
  };
}

// ── META MARKETING API ────────────────────────────────────────
const META_API = 'https://graph.facebook.com/v21.0';

async function metaGet(endpoint, params = {}) {
  const qs = new URLSearchParams({ access_token: META_TOKEN, ...params });
  const url = `${META_API}/${endpoint}?${qs}`;
  const r = await fetch(url);
  const data = await r.json();
  if (data.error) throw new Error(`Meta API: ${data.error.message} (code ${data.error.code})`);
  return data;
}

async function buscarInsights(adAccountId, dias) {
  const hoje   = new Date();
  const fim    = hoje.toISOString().slice(0,10);
  const inicio = new Date(hoje - dias * 86400000).toISOString().slice(0,10);

  const FIELDS = ['spend','impressions','reach','clicks','ctr','cpm','frequency','actions','cost_per_action_type','date_start','date_stop'].join(',');

  // Breakdown diário (time_increment=1)
  const diario = await metaGet(`act_${adAccountId}/insights`, {
    fields: FIELDS,
    time_range: JSON.stringify({ since: inicio, until: fim }),
    time_increment: '1',
    level: 'account',
  });

  // Totais agregados
  const total = await metaGet(`act_${adAccountId}/insights`, {
    fields: FIELDS,
    time_range: JSON.stringify({ since: inicio, until: fim }),
    level: 'account',
  });

  const diasData = diario.data || [];
  const totalData = total.data?.[0] || null;

  return { diasData, totalData };
}

async function buscarCampanhas(adAccountId) {
  const data = await metaGet(`act_${adAccountId}/campaigns`, {
    fields: 'name,status,effective_status,daily_budget,lifetime_budget',
    limit: 10,
  });
  return data.data || [];
}

// ── EXTRAIR LEADS DO CAMPO ACTIONS ────────────────────────────
function extrairLeads(actions = []) {
  const tiposLead = ['lead','onsite_conversion.lead_grouped','offsite_conversion.fb_pixel_lead','contact'];
  for (const tipo of tiposLead) {
    const a = actions.find(x => x.action_type === tipo);
    if (a) return parseInt(a.value || 0);
  }
  return 0;
}

function extrairCplReal(costPerAction = [], leads) {
  const tiposLead = ['lead','onsite_conversion.lead_grouped','offsite_conversion.fb_pixel_lead','contact'];
  for (const tipo of tiposLead) {
    const a = costPerAction.find(x => x.action_type === tipo);
    if (a) return parseFloat(a.value || 0);
  }
  return 0;
}

// ── ANÁLISE ───────────────────────────────────────────────────
const LIMITES = {
  cpl_meta:        60,
  cpl_max:        100,
  ctr_min:          0.5,
  ctr_meta:         1.5,
  cpm_max:         80,
  frequencia_max:   4.0,
};

function analisar(totalData, diasData, orcamentoDiario) {
  const gasto      = parseFloat(totalData.spend       || 0);
  const impressoes = parseInt(totalData.impressions   || 0);
  const alcance    = parseInt(totalData.reach         || 0);
  const cliques    = parseInt(totalData.clicks        || 0);
  const ctr        = parseFloat(totalData.ctr         || 0);
  const cpm        = parseFloat(totalData.cpm         || 0);
  const freq       = parseFloat(totalData.frequency   || 0);
  const leads      = extrairLeads(totalData.actions   || []);
  const cpl        = extrairCplReal(totalData.cost_per_action_type || [], leads);

  // Dias com gasto efetivo (ignora dias zerados na média)
  const diasAtivos = diasData.filter(d => parseFloat(d.spend || 0) > 0);
  const gastoMedioDia = diasAtivos.length > 0
    ? gasto / diasAtivos.length
    : 0;

  // Última data com gasto
  const ultimoDiaAtivo = diasAtivos.length > 0
    ? diasAtivos[diasAtivos.length - 1].date_start
    : null;

  // Dias sem gasto no final (campanha parada)
  const diasSemGasto = diasData.filter(d => parseFloat(d.spend || 0) === 0).length;
  const campanhaParada = diasSemGasto > 0 && diasAtivos.length > 0 &&
    diasData[diasData.length - 1].date_start > ultimoDiaAtivo;

  const alertas = [];
  const info    = [];

  // CPL
  if (cpl > LIMITES.cpl_max) {
    alertas.push({ nivel:'CRITICO', metrica:'CPL', valor:`R$${cpl.toFixed(2)}`, limite:`máx R$${LIMITES.cpl_max}`, acao:'Pausar conjuntos com CPL alto. Revisar criativos.' });
  } else if (cpl > LIMITES.cpl_meta) {
    alertas.push({ nivel:'ATENÇÃO', metrica:'CPL', valor:`R$${cpl.toFixed(2)}`, limite:`meta R$${LIMITES.cpl_meta}`, acao:'Monitorar. Se mantiver 2 dias, testar novo hook.' });
  } else if (cpl > 0) {
    info.push({ metrica:'CPL', valor:`R$${cpl.toFixed(2)}`, status:'OK', obs:'Dentro da meta.' });
  }

  // CTR
  if (ctr > 0 && ctr < LIMITES.ctr_min) {
    alertas.push({ nivel:'CRITICO', metrica:'CTR', valor:`${ctr.toFixed(2)}%`, limite:`mín ${LIMITES.ctr_min}%`, acao:'Hook fraco. Testar novo criativo.' });
  } else if (ctr >= LIMITES.ctr_min && ctr < LIMITES.ctr_meta) {
    info.push({ metrica:'CTR', valor:`${ctr.toFixed(2)}%`, status:'ATENÇÃO', obs:'Abaixo da meta. Monitorar.' });
  } else if (ctr >= LIMITES.ctr_meta) {
    info.push({ metrica:'CTR', valor:`${ctr.toFixed(2)}%`, status:'OK', obs:'Acima da meta.' });
  }

  // Frequência
  if (freq > LIMITES.frequencia_max) {
    alertas.push({ nivel:'ATENÇÃO', metrica:'Frequência', valor:freq.toFixed(1), limite:`máx ${LIMITES.frequencia_max}`, acao:'Fadiga de criativo. Lançar novo anúncio.' });
  }

  // CPM
  if (cpm > LIMITES.cpm_max) {
    alertas.push({ nivel:'ATENÇÃO', metrica:'CPM', valor:`R$${cpm.toFixed(2)}`, limite:`máx R$${LIMITES.cpm_max}`, acao:'Público saturado. Expandir segmentação.' });
  }

  // Campanha parada — compara média diária dos dias ativos vs orçamento
  if (campanhaParada) {
    alertas.push({ nivel:'CRITICO', metrica:'Campanha parada', valor:`Sem veiculação desde ${ultimoDiaAtivo}`, limite:'', acao:'Verificar se orçamento esgotou, campanha foi pausada ou problema no pagamento.' });
  } else if (diasAtivos.length > 0 && gastoMedioDia < orcamentoDiario * 0.5) {
    alertas.push({ nivel:'ATENÇÃO', metrica:'Gasto médio/dia', valor:`R$${gastoMedioDia.toFixed(2)}`, limite:`orçamento R$${orcamentoDiario.toFixed(2)}/dia`, acao:'Entrega abaixo do esperado. Verificar limites de orçamento.' });
  }

  return { alertas, info, metricas: { gasto, gastoMedioDia, diasAtivos: diasAtivos.length, impressoes, alcance, cliques, ctr, cpm, freq, leads, cpl, campanhaParada, ultimoDiaAtivo } };
}

// ── FORMATAR COMENTÁRIO ───────────────────────────────────────
function formatarComentario(empresa, metricas, alertas, info, campanhas, diasData, periodo) {
  const m = metricas;
  const linhas = [
    `📡 **Monitoramento Meta Ads — ${empresa}** (${periodo})`,
    '',
    `**Totais do período:**`,
    `💰 Gasto total: R$${m.gasto.toFixed(2)} | Média/dia ativo: R$${m.gastoMedioDia.toFixed(2)} (${m.diasAtivos} dias com veiculação)`,
    `👁️ Impressões: ${m.impressoes.toLocaleString('pt-BR')} | 🎯 Alcance: ${m.alcance.toLocaleString('pt-BR')}`,
    `🖱️ Cliques: ${m.cliques} | CTR: ${m.ctr.toFixed(2)}% | CPM: R$${m.cpm.toFixed(2)} | Freq: ${m.freq.toFixed(1)}`,
    `🎫 Leads: ${m.leads}${m.cpl > 0 ? ` | CPL: R$${m.cpl.toFixed(2)}` : ''}`,
  ];

  // Breakdown diário
  const diasComDados = diasData.filter(d => parseFloat(d.spend || 0) > 0 || parseInt(d.impressions || 0) > 0);
  if (diasComDados.length > 0) {
    linhas.push('', `**Breakdown diário:**`);
    for (const d of diasData) {
      const gasto = parseFloat(d.spend || 0);
      const imp = parseInt(d.impressions || 0);
      if (gasto === 0 && imp === 0) {
        linhas.push(`📅 ${d.date_start}: ⛔ Sem veiculação`);
      } else {
        const ctr = parseFloat(d.ctr || 0).toFixed(2);
        const leads = extrairLeads(d.actions || []);
        linhas.push(`📅 ${d.date_start}: R$${gasto.toFixed(2)} gasto | ${imp.toLocaleString('pt-BR')} imp | CTR ${ctr}%${leads > 0 ? ` | ${leads} lead(s)` : ''}`);
      }
    }
  }

  // Campanhas
  if (campanhas.length > 0) {
    linhas.push('', `**Campanhas:**`);
    for (const c of campanhas) {
      const status = c.effective_status === 'ACTIVE' ? '🟢' : c.effective_status === 'PAUSED' ? '⏸️' : '🔴';
      linhas.push(`${status} ${c.name}`);
    }
  }

  // Alertas
  if (alertas.length > 0) {
    linhas.push('', `**⚠️ Alertas (${alertas.length}):**`);
    for (const a of alertas) {
      const icone = a.nivel === 'CRITICO' ? '🔴' : '🟡';
      linhas.push(`${icone} **${a.metrica}:** ${a.valor}${a.limite ? ` (limite: ${a.limite})` : ''}`);
      linhas.push(`   ↳ ${a.acao}`);
    }
  } else {
    linhas.push('', `✅ Nenhum alerta — campanha dentro dos parâmetros.`);
  }

  if (info.length > 0) {
    linhas.push('', `**Status das métricas:**`);
    for (const i of info) {
      const icone = i.status === 'OK' ? '✅' : i.status === 'OPORTUNIDADE' ? '🚀' : '⚠️';
      linhas.push(`${icone} ${i.metrica}: ${i.valor} — ${i.obs}`);
    }
  }

  linhas.push('', `---`, `_Monitor automático — Escalando Premoldados_`);
  return linhas.join('\n');
}

// ── CLICKUP: postar comentário ────────────────────────────────
async function postarComentario(tId, texto) {
  // Adiciona Jon como watcher
  await fetch(`https://api.clickup.com/api/v2/task/${tId}`, {
    method: 'PUT',
    headers: { Authorization: CLICKUP_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ watchers: { add: [JON_USER_ID] } }),
  }).catch(() => {});

  const r = await fetch(`https://api.clickup.com/api/v2/task/${tId}/comment`, {
    method: 'POST',
    headers: { Authorization: CLICKUP_BOT_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ comment_text: texto, notify_all: true }),
  });
  if (!r.ok) throw new Error(`ClickUp comment ${r.status}: ${await r.text()}`);
}

// ── CLICKUP: criar task de alerta ─────────────────────────────
async function criarTaskAlerta(empresa, alertas, metricas) {
  if (!CLICKUP_KEY || !CLICKUP_LIST) return;
  const hoje = new Date().toLocaleDateString('pt-BR');
  const temCritico = alertas.some(a => a.nivel === 'CRITICO');
  const desc = alertas.map(a => `[${a.nivel}] ${a.metrica}: ${a.valor}\nAção: ${a.acao}`).join('\n\n');

  const resp = await fetch(`https://api.clickup.com/api/v2/list/${CLICKUP_LIST}/task`, {
    method: 'POST',
    headers: { Authorization: CLICKUP_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `[ALERTA ADS] ${empresa} — ${hoje}`,
      description: desc,
      priority: temCritico ? 1 : 2,
      assignees: [JON_USER_ID],
      tags: ['ads', 'alerta'],
    }),
  });
  const task = await resp.json();
  if (task.id) console.log(`  📋 Task criada no ClickUp: ${task.id}`);
}

// ── MAIN ──────────────────────────────────────────────────────
async function main() {
  if (!META_TOKEN) {
    console.error('❌ META_ADS_TOKEN não configurado.');
    process.exit(1);
  }

  const cfg = carregarConfig();
  const { adAccountId, orcamentoDiario, empresa } = cfg;

  console.log(`\n📡 Monitoramento Meta Ads — ${empresa}`);
  console.log(`   Conta: act_${adAccountId} | Período: últimos ${diasAnalisar} dias\n`);

  // Buscar dados da Meta API
  const [{ diasData, totalData }, campanhas] = await Promise.all([
    buscarInsights(adAccountId, diasAnalisar),
    buscarCampanhas(adAccountId),
  ]);

  if (!totalData) {
    console.log('  ℹ️  Sem dados de performance para o período. Campanha ainda não veiculou?\n');
    if (taskId) await postarComentario(taskId, `📡 **Monitor Ads — ${empresa}**\n\nNenhum dado disponível para os últimos ${diasAnalisar} dias. A campanha pode não ter veiculado ainda.`);
    process.exit(0);
  }

  const periodo = `${totalData.date_start} → ${totalData.date_stop}`;
  const { alertas, info, metricas } = analisar(totalData, diasData, orcamentoDiario);

  // Log no console
  console.log(`  Período: ${periodo}`);
  console.log(`  Gasto total: R$${metricas.gasto.toFixed(2)} | Média/dia ativo: R$${metricas.gastoMedioDia.toFixed(2)} (${metricas.diasAtivos} dias)`);
  console.log(`  Impressões: ${metricas.impressoes.toLocaleString('pt-BR')} | Alcance: ${metricas.alcance.toLocaleString('pt-BR')}`);
  console.log(`  Cliques: ${metricas.cliques} | CTR: ${metricas.ctr.toFixed(2)}% | CPM: R$${metricas.cpm.toFixed(2)} | Freq: ${metricas.freq.toFixed(1)}`);
  console.log(`  Leads: ${metricas.leads}${metricas.cpl > 0 ? ` | CPL: R$${metricas.cpl.toFixed(2)}` : ''}\n`);

  console.log(`  Breakdown diário:`);
  diasData.forEach(d => {
    const g = parseFloat(d.spend || 0);
    const imp = parseInt(d.impressions || 0);
    if (g === 0 && imp === 0) {
      console.log(`    ${d.date_start}: ⛔ sem veiculação`);
    } else {
      const leads = extrairLeads(d.actions || []);
      console.log(`    ${d.date_start}: R$${g.toFixed(2)} | ${imp.toLocaleString('pt-BR')} imp | CTR ${parseFloat(d.ctr||0).toFixed(2)}%${leads > 0 ? ` | ${leads} lead(s)` : ''}`);
    }
  });
  console.log('');

  console.log(`  Campanhas (${campanhas.filter(c => c.effective_status === 'ACTIVE').length} ativas / ${campanhas.length} total):`);
  campanhas.forEach(c => console.log(`    ${c.effective_status === 'ACTIVE' ? '🟢' : '⏸️ '} ${c.name}`));
  console.log('');

  if (alertas.length > 0) {
    console.log(`  ⚠️  ${alertas.length} alerta(s):`);
    alertas.forEach(a => console.log(`  ${a.nivel === 'CRITICO' ? '🔴' : '🟡'} ${a.metrica}: ${a.valor} — ${a.acao}`));
    console.log('');
  } else {
    console.log('  ✅ Sem alertas. Campanha dentro dos parâmetros.\n');
  }

  // Postar no ClickUp
  const comentario = formatarComentario(empresa, metricas, alertas, info, campanhas, diasData, periodo);

  if (taskId) {
    // Modo dispatcher: posta comentário na task atual
    await postarComentario(taskId, comentario);
    console.log(`  ✅ Resultado postado na task ${taskId}`);
  } else if (alertas.length > 0) {
    // Modo cron: cria task de alerta apenas se houver alertas
    await criarTaskAlerta(empresa, alertas, metricas);
  } else {
    console.log('  ℹ️  Sem alertas — nenhuma task criada no ClickUp.\n');
  }

  // Registrar no Dossiê — página Performance
  try {
    const m = metricas;
    const linhasAlerta = alertas.length > 0
      ? alertas.map(a => `- **${a.nivel}** ${a.metrica}: ${a.valor} → ${a.acao}`).join('\n')
      : '- Nenhum alerta';
    const entradaPerformance = [
      `### 📡 Monitoramento Meta Ads (${periodo})`,
      '',
      `| Métrica | Valor |`,
      `|---------|-------|`,
      `| Gasto total | R$${m.gasto.toFixed(2)} |`,
      `| Média/dia ativo | R$${m.gastoMedioDia.toFixed(2)} (${m.diasAtivos} dias) |`,
      `| Impressões | ${m.impressoes.toLocaleString('pt-BR')} |`,
      `| CTR | ${m.ctr.toFixed(2)}% |`,
      `| CPM | R$${m.cpm.toFixed(2)} |`,
      `| Frequência | ${m.freq.toFixed(1)} |`,
      `| Leads | ${m.leads} |`,
      `| CPL | ${m.cpl > 0 ? `R$${m.cpl.toFixed(2)}` : '—'} |`,
      '',
      `**Alertas:**`,
      linhasAlerta,
    ].join('\n');

    await appendSection(clienteSlug, 'performance', entradaPerformance);
    console.log(`  📋 Registrado no Dossiê — Performance`);
  } catch (e) {
    console.warn(`  ⚠️  Dossiê não atualizado: ${e.message}`);
  }

  const temCritico = alertas.some(a => a.nivel === 'CRITICO');
  process.exit(temCritico ? 1 : 0);
}

main().catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
