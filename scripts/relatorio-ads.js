#!/usr/bin/env node
/**
 * ESCALANDO PREMOLDADOS — Gerador de Relatório de Performance de Anúncios
 *
 * Uso:
 *   node scripts/relatorio-ads.js --cliente=Concrenor
 *   node scripts/relatorio-ads.js --cliente=Concrenor --periodo=2026-03-01:2026-03-15
 *   node scripts/relatorio-ads.js --cliente=Concrenor --fonte=log   (usa log manual)
 *   node scripts/relatorio-ads.js --cliente=Concrenor --fonte=api   (usa Meta API)
 *
 * Fontes de dados (por prioridade):
 *   1. Meta Marketing API (se META_ADS_TOKEN + META_AD_ACCOUNT_ID configurados)
 *   2. config/log-ads-{cliente}.json (log manual quinzenal)
 *
 * Output:
 *   dist/{cliente}/relatorio-ads-{periodo}.html
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
  console.error('Uso: node scripts/relatorio-ads.js --cliente=NomeCliente');
  process.exit(1);
}

const clienteSlug = toSlug(clienteRaw);
const fonteArg = args.fonte || 'auto';

// Período default: quinzena atual
function getPeriodoDefault() {
  const hoje = new Date();
  const dia = hoje.getDate();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  if (dia <= 15) {
    const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    const anoAnt = mesAnterior.getFullYear();
    const mesAnt = String(mesAnterior.getMonth() + 1).padStart(2, '0');
    return `${anoAnt}-${mesAnt}-16:${ano}-${mes}-01`;
  }
  return `${ano}-${mes}-01:${ano}-${mes}-15`;
}

const periodoRaw = args.periodo || getPeriodoDefault();
const [dataInicio, dataFim] = periodoRaw.split(':');

// ---- Coleta de dados ----

async function coletarDadosAPI(dataInicio, dataFim) {
  const token = process.env.META_ADS_TOKEN;
  const accountId = process.env.META_AD_ACCOUNT_ID;

  if (!token || !accountId) return null;

  const fields = 'campaign_name,adset_name,ad_name,spend,impressions,reach,clicks,ctr,cpm,actions,cost_per_action_type';
  const url = `https://graph.facebook.com/v19.0/act_${accountId}/insights?fields=${fields}&time_range={"since":"${dataInicio}","until":"${dataFim}"}&level=ad&access_token=${token}`;

  try {
    const res = await fetch(url);
    const json = await res.json();
    if (json.error) {
      console.warn(`  ⚠️  Meta API erro: ${json.error.message}`);
      return null;
    }
    return json.data || [];
  } catch (err) {
    console.warn(`  ⚠️  Meta API indisponível: ${err.message}`);
    return null;
  }
}

function coletarDadosLog(clienteSlug, dataInicio, dataFim) {
  const logPath = path.join(ROOT, 'config', `log-ads-${clienteSlug}.json`);
  if (!fs.existsSync(logPath)) return null;

  const log = JSON.parse(fs.readFileSync(logPath, 'utf8'));
  const registros = (log.registros || []).filter(r => !r._template && r.data >= dataInicio && r.data <= dataFim);

  if (registros.length === 0) return null;

  // Agrega totais
  const totais = registros.reduce((acc, r) => {
    acc.gasto      += r.gasto_total_brl || 0;
    acc.impressoes += r.impressoes || 0;
    acc.alcance    += r.alcance || 0;
    acc.cliques    += r.cliques || 0;
    acc.leads      += r.leads || 0;
    acc.wpp        += r.contatos_whatsapp || 0;
    return acc;
  }, { gasto: 0, impressoes: 0, alcance: 0, cliques: 0, leads: 0, wpp: 0 });

  totais.ctr = totais.impressoes > 0 ? (totais.cliques / totais.impressoes * 100).toFixed(2) : 0;
  totais.cpm = totais.impressoes > 0 ? (totais.gasto / totais.impressoes * 1000).toFixed(2) : 0;
  totais.cpl = totais.leads > 0 ? (totais.gasto / totais.leads).toFixed(2) : 0;
  totais.dias = registros.length;
  totais.registros = registros;
  totais.meta_cpl = log.meta_cpl_brl || 50;
  totais.campanha = log.campanha || '';

  return totais;
}

function normalizarDadosAPI(apiData) {
  if (!apiData || apiData.length === 0) return null;

  const totais = apiData.reduce((acc, row) => {
    const leads = (row.actions || []).find(a => a.action_type === 'lead');
    const msgs  = (row.actions || []).find(a => a.action_type === 'onsite_conversion.messaging_conversation_started_7d');

    acc.gasto      += parseFloat(row.spend || 0);
    acc.impressoes += parseInt(row.impressions || 0);
    acc.alcance    += parseInt(row.reach || 0);
    acc.cliques    += parseInt(row.clicks || 0);
    acc.leads      += parseInt(leads?.value || 0);
    acc.wpp        += parseInt(msgs?.value || 0);
    return acc;
  }, { gasto: 0, impressoes: 0, alcance: 0, cliques: 0, leads: 0, wpp: 0 });

  totais.ctr = totais.impressoes > 0 ? (totais.cliques / totais.impressoes * 100).toFixed(2) : 0;
  totais.cpm = totais.impressoes > 0 ? (totais.gasto / totais.impressoes * 1000).toFixed(2) : 0;
  totais.cpl = totais.leads > 0 ? (totais.gasto / totais.leads).toFixed(2) : 0;
  totais.por_anuncio = apiData.map(row => {
    const leads = (row.actions || []).find(a => a.action_type === 'lead');
    return {
      nome:       row.ad_name,
      conjunto:   row.adset_name,
      gasto:      parseFloat(row.spend || 0).toFixed(2),
      impressoes: parseInt(row.impressions || 0),
      ctr:        parseFloat(row.ctr || 0).toFixed(2),
      leads:      parseInt(leads?.value || 0),
      cpl:        leads?.value > 0 ? (row.spend / leads.value).toFixed(2) : '--',
    };
  }).sort((a, b) => parseInt(b.leads) - parseInt(a.leads));

  return totais;
}

// ---- Geração do HTML ----

function gerarInterpretacao(dados, metaCPL) {
  const insights = [];

  if (dados.cpl > 0 && dados.cpl <= metaCPL) {
    insights.push({ tipo: 'positivo', texto: `CPL de R$${dados.cpl} dentro da meta (R$${metaCPL}). Campanha saudável.` });
  } else if (dados.cpl > metaCPL) {
    insights.push({ tipo: 'atencao', texto: `CPL de R$${dados.cpl} está acima da meta (R$${metaCPL}). Revisar criativos e públicos.` });
  }

  if (dados.ctr >= 2) {
    insights.push({ tipo: 'positivo', texto: `CTR de ${dados.ctr}% excelente. Hook funcionando — manter e escalar.` });
  } else if (dados.ctr >= 1 && dados.ctr < 2) {
    insights.push({ tipo: 'neutro', texto: `CTR de ${dados.ctr}% ok. Testar hook alternativo para melhorar.` });
  } else if (dados.ctr > 0 && dados.ctr < 1) {
    insights.push({ tipo: 'atencao', texto: `CTR de ${dados.ctr}% abaixo de 1%. Hook fraco — testar variação V3 ou novo criativo.` });
  }

  if (dados.leads >= 20) {
    insights.push({ tipo: 'positivo', texto: `${dados.leads} leads no período. Bom volume para análise estatística.` });
  } else if (dados.leads > 0 && dados.leads < 20) {
    insights.push({ tipo: 'neutro', texto: `${dados.leads} leads no período. Volume baixo — aguardar mais dados antes de otimizar.` });
  } else {
    insights.push({ tipo: 'atencao', texto: `Nenhum lead registrado. Verificar tracking, LP e aprovação dos anúncios.` });
  }

  if (dados.cpm > 60) {
    insights.push({ tipo: 'atencao', texto: `CPM de R$${dados.cpm} alto. Considerar expandir público ou testar interesse diferente.` });
  }

  return insights;
}

function gerarHTML(dados, cliente, dataInicio, dataFim, fonte) {
  const metaCPL = dados.meta_cpl || 50;
  const insights = gerarInterpretacao(dados, metaCPL);
  const hoje = new Date().toLocaleDateString('pt-BR');

  const statusCPL = dados.cpl > 0 && dados.cpl <= metaCPL ? 'verde' : dados.cpl > metaCPL ? 'vermelho' : 'cinza';
  const statusCTR = dados.ctr >= 1.5 ? 'verde' : dados.ctr >= 0.5 ? 'amarelo' : dados.ctr > 0 ? 'vermelho' : 'cinza';

  const tabelaAnuncios = dados.por_anuncio ? dados.por_anuncio.map((a, i) => `
    <tr class="${i === 0 ? 'melhor' : ''}">
      <td>${a.nome}</td>
      <td>R$${a.gasto}</td>
      <td>${Number(a.impressoes).toLocaleString('pt-BR')}</td>
      <td>${a.ctr}%</td>
      <td>${a.leads}</td>
      <td>R$${a.cpl}</td>
      <td>${i === 0 ? '<span class="badge verde">Melhor</span>' : a.cpl !== '--' && parseFloat(a.cpl) > metaCPL * 2 ? '<span class="badge vermelho">Pausar</span>' : ''}</td>
    </tr>`).join('') : '<tr><td colspan="7" class="vazio">Dados por anúncio disponíveis apenas via Meta API</td></tr>';

  const insightsHTML = insights.map(i => `
    <div class="insight ${i.tipo}">
      <span class="icone">${i.tipo === 'positivo' ? '✅' : i.tipo === 'atencao' ? '⚠️' : 'ℹ️'}</span>
      ${i.texto}
    </div>`).join('');

  const evolucaoHTML = dados.registros ? dados.registros.map(r => `
    <tr>
      <td>${new Date(r.data + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
      <td>R$${r.gasto_total_brl.toFixed(2)}</td>
      <td>${(r.impressoes || 0).toLocaleString('pt-BR')}</td>
      <td>${r.ctr_pct || '–'}%</td>
      <td>${r.leads || 0}</td>
      <td>${r.contatos_whatsapp || 0}</td>
      <td>R$${r.cpl_brl || '–'}</td>
    </tr>`).join('') : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Relatório de Anúncios — ${cliente} — ${dataInicio}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; color: #1a1a1a; }
    .header { background: #1a1a2e; color: white; padding: 32px 40px; }
    .header h1 { font-size: 22px; font-weight: 600; margin-bottom: 4px; }
    .header p { color: #aaa; font-size: 14px; }
    .container { max-width: 900px; margin: 32px auto; padding: 0 20px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; margin-bottom: 32px; }
    .kpi { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 1px 4px rgba(0,0,0,.08); }
    .kpi .label { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 8px; }
    .kpi .valor { font-size: 28px; font-weight: 700; }
    .kpi .sub { font-size: 12px; color: #888; margin-top: 4px; }
    .kpi.verde .valor { color: #16a34a; }
    .kpi.vermelho .valor { color: #dc2626; }
    .kpi.amarelo .valor { color: #d97706; }
    .kpi.cinza .valor { color: #6b7280; }
    .card { background: white; border-radius: 8px; padding: 24px; box-shadow: 0 1px 4px rgba(0,0,0,.08); margin-bottom: 24px; }
    .card h2 { font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #1a1a2e; border-bottom: 2px solid #f0f0f0; padding-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { text-align: left; padding: 10px 12px; background: #f8f8f8; font-weight: 600; color: #555; font-size: 12px; text-transform: uppercase; }
    td { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; }
    tr.melhor { background: #f0fdf4; }
    tr.melhor td { font-weight: 500; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
    .badge.verde { background: #dcfce7; color: #166534; }
    .badge.vermelho { background: #fee2e2; color: #991b1b; }
    .insight { display: flex; gap: 10px; padding: 12px 16px; border-radius: 6px; margin-bottom: 10px; font-size: 14px; line-height: 1.5; }
    .insight.positivo { background: #f0fdf4; border-left: 3px solid #16a34a; }
    .insight.atencao { background: #fffbeb; border-left: 3px solid #d97706; }
    .insight.neutro { background: #eff6ff; border-left: 3px solid #2563eb; }
    .icone { flex-shrink: 0; }
    .vazio { text-align: center; color: #999; padding: 24px; }
    .fonte { font-size: 11px; color: #bbb; margin-top: 40px; text-align: center; padding-bottom: 40px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Relatório de Anúncios — ${cliente}</h1>
    <p>Período: ${new Date(dataInicio + 'T12:00:00').toLocaleDateString('pt-BR')} a ${new Date(dataFim + 'T12:00:00').toLocaleDateString('pt-BR')} &nbsp;·&nbsp; Gerado em ${hoje}</p>
  </div>

  <div class="container">

    <div class="kpi-grid">
      <div class="kpi">
        <div class="label">Investimento</div>
        <div class="valor">R$${Number(dados.gasto.toFixed(2)).toLocaleString('pt-BR')}</div>
        <div class="sub">${dados.dias || '–'} dias ativos</div>
      </div>
      <div class="kpi">
        <div class="label">Leads</div>
        <div class="valor">${dados.leads}</div>
        <div class="sub">${dados.wpp} cliques WhatsApp</div>
      </div>
      <div class="kpi ${statusCPL}">
        <div class="label">Custo por Lead</div>
        <div class="valor">${dados.cpl > 0 ? 'R$' + dados.cpl : '–'}</div>
        <div class="sub">Meta: R$${metaCPL}</div>
      </div>
      <div class="kpi ${statusCTR}">
        <div class="label">CTR</div>
        <div class="valor">${dados.ctr}%</div>
        <div class="sub">Meta: &gt; 1.5%</div>
      </div>
      <div class="kpi">
        <div class="label">CPM</div>
        <div class="valor">R$${dados.cpm}</div>
        <div class="sub">${Number(dados.impressoes).toLocaleString('pt-BR')} impressões</div>
      </div>
      <div class="kpi">
        <div class="label">Alcance</div>
        <div class="valor">${Number(dados.alcance).toLocaleString('pt-BR')}</div>
        <div class="sub">${Number(dados.cliques).toLocaleString('pt-BR')} cliques</div>
      </div>
    </div>

    <div class="card">
      <h2>Interpretacao e Recomendacoes</h2>
      ${insightsHTML}
    </div>

    <div class="card">
      <h2>Performance por Anuncio</h2>
      <table>
        <thead>
          <tr>
            <th>Anuncio</th><th>Invest.</th><th>Impres.</th><th>CTR</th><th>Leads</th><th>CPL</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${tabelaAnuncios}
        </tbody>
      </table>
    </div>

    ${evolucaoHTML ? `
    <div class="card">
      <h2>Evolucao Diaria</h2>
      <table>
        <thead>
          <tr><th>Data</th><th>Gasto</th><th>Impressoes</th><th>CTR</th><th>Leads</th><th>WhatsApp</th><th>CPL</th></tr>
        </thead>
        <tbody>${evolucaoHTML}</tbody>
      </table>
    </div>` : ''}

    <p class="fonte">Escalando Premoldados · Fonte: ${fonte} · ${dados.campanha || ''}</p>
  </div>
</body>
</html>`;
}

// ---- Claude: gera "O que fazer agora" ----
async function gerarRecomendacoesIA(dados, cliente, dataInicio, dataFim) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const prompt = `Você é um especialista sênior em tráfego pago para construção civil e pré-moldados no Brasil.

DADOS REAIS DA CAMPANHA — ${cliente} (${dataInicio} a ${dataFim}):
- Investimento: R$${Number(dados.gasto).toFixed(2)}
- Leads: ${dados.leads}
- CPL: R$${dados.cpl} (meta: R$${dados.meta_cpl || 50})
- CTR: ${dados.ctr}%
- CPM: R$${dados.cpm}
- Alcance: ${dados.alcance}
- Cliques WhatsApp: ${dados.wpp}
- Dias ativos: ${dados.dias || '?'}

REGRAS INEGOCIÁVEIS:
- Baseie cada recomendação nos dados acima. Sem generalismo.
- Se os dados são ruins, diga — e aponte a causa provável real, não genérica.
- Pense nos dois ângulos: o que o cliente deve fazer E o que a agência deve ajustar na gestão.

Retorne JSON válido sem markdown:
{
  "diagnostico": "1 frase honesta sobre o estado atual da campanha",
  "acoes": [
    { "prioridade": 1, "acao": "o que fazer", "motivo": "por que — baseado nos dados", "impacto": "resultado esperado" },
    { "prioridade": 2, "acao": "o que fazer", "motivo": "por que — baseado nos dados", "impacto": "resultado esperado" },
    { "prioridade": 3, "acao": "o que fazer", "motivo": "por que — baseado nos dados", "impacto": "resultado esperado" }
  ]
}`;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 800, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    const text = data.content?.[0]?.text || '';
    const match = text.match(/\{[\s\S]+\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch { return null; }
}

// ---- ClickUp: cria task no Relatórios ----
async function criarTaskRelatorio(cliente, dados, dataInicio, dataFim, recomendacoes = null) {
  const apiKey = process.env.CLICKUP_API_KEY;
  const listId = '901326173211'; // Relatórios
  if (!apiKey) return;

  const periodo = `${dataInicio} → ${dataFim}`;

  // Custom field IDs — Relatórios
  const CF = {
    periodo: '9ce79034-81a4-495f-8785-46b98abdc62e',
    leads:   'e5e59390-89bf-408c-b88a-39697ee8b963',
    cpl:     '8a6405e9-dc83-491e-8f8b-0ffeceefa714',
    gasto:   'afbb2491-a654-4b1d-a489-4daf29a2790b',
    roas:    'cf3d142c-c448-48ef-8415-7a90dbf1b54e',
  };

  try {
    const hoje = new Date().toLocaleDateString('pt-BR');
    const resp = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task`, {
      method: 'POST',
      headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Relatório ${cliente} — ${periodo}`,
        description: [
          `Gerado em ${hoje} | Leads: ${dados.leads} | CPL: R$${dados.cpl} | Gasto: R$${Number(dados.gasto).toFixed(2)} | CTR: ${dados.ctr}%`,
          recomendacoes?.diagnostico ? `\n🎯 Diagnóstico: ${recomendacoes.diagnostico}` : '',
          ...(recomendacoes?.acoes || []).map(a => `\n#${a.prioridade} ${a.acao} — ${a.motivo}`),
        ].join(''),
        tags: ['relatorio', 'ads'],
      }),
    });
    const task = await resp.json();
    if (!task.id) return;

    const roas = dados.leads > 0 && dados.gasto > 0
      ? +((dados.leads * (dados.meta_cpl || 50)) / dados.gasto).toFixed(2)
      : 0;

    const campos = [
      { id: CF.periodo, value: periodo },
      { id: CF.leads,   value: dados.leads || 0 },
      { id: CF.cpl,     value: parseFloat(dados.cpl) || 0 },
      { id: CF.gasto,   value: +Number(dados.gasto).toFixed(2) },
      { id: CF.roas,    value: roas },
    ];
    await Promise.all(campos.map(c =>
      fetch(`https://api.clickup.com/api/v2/task/${task.id}/field/${c.id}`, {
        method: 'POST',
        headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: c.value }),
      })
    ));
    console.log(`  Task criada no ClickUp (Relatórios): ${task.id}`);
  } catch (err) {
    console.warn(`  ⚠️  Falha ao criar task no ClickUp: ${err.message}`);
  }
}

// ---- Main ----
async function main() {
  console.log(`\n📊 Gerando relatório de anúncios — ${clienteRaw}`);
  console.log(`   Período: ${dataInicio} → ${dataFim}`);
  console.log(`   Fonte: ${fonteArg}\n`);

  let dados = null;
  let fonteUsada = 'log';

  // Tenta Meta API primeiro (se não forçado a usar log)
  if (fonteArg !== 'log') {
    process.stdout.write('  Consultando Meta Marketing API...');
    const apiData = await coletarDadosAPI(dataInicio, dataFim);
    if (apiData && apiData.length > 0) {
      dados = normalizarDadosAPI(apiData);
      fonteUsada = 'Meta Marketing API';
      console.log(' ✅');
    } else {
      console.log(' ⚠️  sem dados (usando log manual)');
    }
  }

  // Fallback: log manual
  if (!dados) {
    process.stdout.write('  Lendo log manual...');
    const logPath = path.join(ROOT, 'config', `log-ads-${clienteSlug}.json`);
    if (!fs.existsSync(logPath)) {
      console.log(' ❌');
      console.error(`\n❌ Nenhuma fonte de dados disponível.`);
      console.error(`   Configure META_ADS_TOKEN + META_AD_ACCOUNT_ID ou preencha config/log-ads-${clienteSlug}.json\n`);
      process.exit(1);
    }
    dados = coletarDadosLog(clienteSlug, dataInicio, dataFim);
    if (!dados) {
      console.log(' ⚠️  sem registros no período');
      // Cria dados zerados para relatório vazio
      dados = { gasto: 0, impressoes: 0, alcance: 0, cliques: 0, leads: 0, wpp: 0, ctr: 0, cpm: 0, cpl: 0, meta_cpl: 50, dias: 0 };
    }
    fonteUsada = 'log manual';
    console.log(' ✅');
  }

  // Gera "O que fazer agora" via Claude
  process.stdout.write('  Gerando recomendações com Claude...');
  const recomendacoes = await gerarRecomendacoesIA(dados, clienteRaw, dataInicio, dataFim);
  console.log(recomendacoes ? ' ✅' : ' ⚠️  (sem API key ou falha)');

  // Monta bloco HTML das recomendações
  const recomHtml = recomendacoes ? `
    <div class="card">
      <h2>O que fazer agora</h2>
      ${recomendacoes.diagnostico ? `<div class="insight neutro"><span class="icone">🎯</span><strong>${recomendacoes.diagnostico}</strong></div>` : ''}
      ${(recomendacoes.acoes || []).map(a => `
        <div class="insight ${a.prioridade === 1 ? 'atencao' : a.prioridade === 2 ? 'neutro' : 'positivo'}" style="flex-direction:column;gap:4px">
          <div style="display:flex;gap:8px;align-items:center">
            <span class="badge ${a.prioridade === 1 ? 'vermelho' : a.prioridade === 2 ? '' : 'verde'}" style="${a.prioridade === 2 ? 'background:#dbeafe;color:#1d4ed8' : ''}">#${a.prioridade}</span>
            <strong>${a.acao}</strong>
          </div>
          <div style="font-size:13px;color:#555;padding-left:36px">${a.motivo}</div>
          <div style="font-size:12px;color:#888;padding-left:36px">→ ${a.impacto}</div>
        </div>`).join('')}
    </div>` : '';

  // Gera HTML
  let html = gerarHTML(dados, clienteRaw, dataInicio, dataFim, fonteUsada);
  if (recomHtml) html = html.replace('</body>', `${recomHtml}</body>`);

  // Salva output
  const outDir = path.join(ROOT, 'dist', clienteSlug);
  fs.mkdirSync(outDir, { recursive: true });

  const periodoSlug = `${dataInicio}_${dataFim}`.replace(/:/g, '_');
  const outPath = path.join(outDir, `relatorio-ads-${periodoSlug}.html`);
  fs.writeFileSync(outPath, html, 'utf8');

  console.log(`\n✅ Relatório gerado: dist/${clienteSlug}/relatorio-ads-${periodoSlug}.html`);
  console.log(`   Abrir no browser para visualizar.\n`);

  // Cria task no ClickUp com campos preenchidos
  await criarTaskRelatorio(clienteRaw, dados, dataInicio, dataFim, recomendacoes);
}

main().catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
