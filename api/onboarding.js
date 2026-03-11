/**
 * ESCALANDO PREMOLDADOS — Onboarding API v2
 * Vercel Serverless Function
 *
 * POST /api/onboarding
 * Body: { action: 'fechamento' | 'kickoff' | 'novo-lead' | 'novo-orcamento' | 'lp-briefing' }
 *
 * Estrutura criada por cliente:
 *   ClickUp: folder → DADOS, Onboarding (3 tasks), Landing Pages, Meta Ads*, Google Ads*, CRM — Leads
 *   Drive:   Contratos, Fotos, CRM — Leads
 *
 * Gates:
 *   Gate A → clickup-status-change.js (💰 Confirmar Pagamento → complete)
 *   Gate B → aqui, no submit do kickoff
 *   Gate C → clickup-status-change.js (📸 Fotos Recebidas → complete)
 */

import { criarPastaCliente, registrarLead, registrarOrcamento } from './google-drive.js';
import { gateB }                                                 from '../scripts/onboarding-gate.js';

const CLICKUP_API_KEY = process.env.CLICKUP_API_KEY;
const SPACE_CLIENTES  = process.env.CLICKUP_SPACE_ID || '901313553858';
const SPACE_OPERACAO  = process.env.CLICKUP_SPACE_OPERACAO || '901313601522';
const BASE_URL        = 'https://api.clickup.com/api/v2';
const WS_ID           = '90133050692';

// Custom field IDs da lista OPERAÇÃO/Fichas
const CF = {
  responsavel:       'd1009da6-09ef-424e-b971-2fa7fd7321bb',
  whatsapp:          'c8d8bb6d-656f-4d4b-89c7-d37ce1311bbe',
  plano:             'b01d0f39-4e74-4c0c-a063-48cdd866915a',  // dropdown: 0=Starter 1=Growth 2=Pro
  valorMensal:       '38bd0f83-b8f0-4e42-9ad7-29d73b861d88',
  canalContato:      '78383f59-9fd3-4ab5-9dee-bc6c916d0886',  // dropdown: 0=WhatsApp 1=Indicação 2=Instagram 3=Google
  b2bOuB2c:         '3b325843-7f8b-4f80-ab0a-fe1eaf77697a',  // dropdown: 0=B2B 1=B2C 2=Ambos
  produtoFoco:       'f819f0d8-489f-4550-a203-e4179df94ed8',
  areaAtuacao:       'f4099bbb-3850-4734-a6f6-6fbc40aa0d9d',
  verbaAds:          'ff097df2-d88f-428f-bd3e-f6a4196e5b5a',
  objetivoPrincipal: 'b0252a10-e4aa-4c25-a6db-bfd7594d7656',
  sucesso60dias:     '5972830e-fab4-4ecf-ab37-1bdc0dee0f31',
  tomDeVoz:          '2087bfc7-6889-40a9-a7d4-0e03dd567775', // dropdown: 0=Técnico 1=Direto 2=Próximo
};

// Mapas dropdown → orderindex
const PLANO_IDX   = { starter: 0, growth: 1, pro: 2 };
const CANAL_IDX   = { whatsapp: 0, indicação: 1, indicacao: 1, instagram: 2, google: 3 };
const B2B_IDX     = { b2b: 0, b2c: 1, ambos: 2 };
const TOM_IDX     = { 'técnico': 0, 'tecnico': 0, 'direto': 1, 'próximo': 2, 'proximo': 2 };

function buildCustomFields(d) {
  const fields = [];
  const add = (id, value) => { if (value !== undefined && value !== null && value !== '') fields.push({ id, value }); };

  add(CF.responsavel, d.responsavel || null);
  // Phone field aceita apenas dígitos com código do país
  if (d.whatsapp) {
    const digits = String(d.whatsapp).replace(/\D/g, '');
    const formatted = digits.startsWith('55') ? `+${digits}` : `+55${digits}`;
    add(CF.whatsapp, formatted);
  }
  add(CF.produtoFoco,       d.produtoFoco || null);
  add(CF.areaAtuacao,       d.areaAtuacao || null);
  add(CF.objetivoPrincipal, d.objetivoPrincipal || null);
  add(CF.sucesso60dias,     d.sucesso60Dias || null);

  if (d.valor)        add(CF.valorMensal, parseFloat(String(d.valor).replace(/[^\d.,]/g, '').replace(',', '.')) || null);
  if (d.verba)        add(CF.verbaAds,    parseFloat(String(d.verba).replace(/[^\d.,]/g, '').replace(',', '.')) || null);
  if (d.verbaMensal)  add(CF.verbaAds,    parseFloat(String(d.verbaMensal).replace(/[^\d.,]/g, '').replace(',', '.')) || null);

  const planoIdx = PLANO_IDX[(d.plano || '').toLowerCase()];
  if (planoIdx !== undefined) add(CF.plano, planoIdx);

  const canalIdx = CANAL_IDX[(d.canal || '').toLowerCase()];
  if (canalIdx !== undefined) add(CF.canalContato, canalIdx);

  const b2bIdx = B2B_IDX[(d.b2b || '').toLowerCase()];
  if (b2bIdx !== undefined) add(CF.b2bOuB2c, b2bIdx);

  const tomIdx = TOM_IDX[(d.tom || '').toLowerCase()];
  if (tomIdx !== undefined) add(CF.tomDeVoz, tomIdx);

  return fields;
}

// ── Fichas (OPERAÇÃO) ─────────────────────────────────────────────────────────
// Encontra ou cria a lista "Fichas" no espaço OPERAÇÃO
async function getFichasList() {
  const listId = process.env.CLICKUP_LIST_FICHAS;
  if (listId) return { id: listId };

  const data = await cu('get', `/space/${SPACE_OPERACAO}/list?archived=false`).catch(() => ({ lists: [] }));
  const fichas = (data.lists || []).find(l => l.name === 'Fichas');
  if (fichas) return fichas;

  return cu('post', `/space/${SPACE_OPERACAO}/list`, { name: 'Fichas' });
}

// Encontra a task Ficha de um cliente na lista OPERAÇÃO/Fichas
async function encontrarFichaOperacao(empresa) {
  const lista = await getFichasList();
  const { tasks } = await cu('get', `/list/${lista.id}/task?archived=false`);
  return (tasks || []).find(t => t.name.toLowerCase() === `ficha — ${empresa.toLowerCase()}`) || null;
}

// ============================================================
// HANDLER PRINCIPAL
// ============================================================
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Método não permitido' });

  try {
    const dados = req.body;

    if (dados.action === 'fechamento')     return res.status(200).json({ success: true, ...(await processarFechamento(dados)) });
    if (dados.action === 'kickoff')        return res.status(200).json({ success: true, ...(await processarKickoff(dados)) });
    if (dados.action === 'novo-lead')      return res.status(200).json({ success: true, ...(await processarNovoLead(dados)) });
    if (dados.action === 'novo-orcamento') return res.status(200).json({ success: true, ...(await processarNovoOrcamento(dados)) });
    if (dados.action === 'lp-briefing')   return res.status(200).json({ success: true, ...(await processarLpBriefing(dados)) });

    return res.status(400).json({ error: 'action inválida' });

  } catch (err) {
    console.error('Erro onboarding:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// ============================================================
// FORM 1 — FECHAMENTO
// Cria estrutura no ClickUp + Drive. 3 tasks. 3 pastas.
// ============================================================
async function processarFechamento(d) {
  const empresa = d.empresa.trim();

  // 1. Folder do cliente no espaço CLIENTES
  const folder = await cu('post', `/space/${SPACE_CLIENTES}/folder`, { name: empresa });

  // 2. Ficha do Cliente na lista centralizada OPERAÇÃO/Fichas
  const fichasList = await getFichasList();
  await cu('post', `/list/${fichasList.id}/task`, {
    name:          `Ficha — ${empresa}`,
    description:   buildFichaDesc(empresa, d),
    priority:      2,
    custom_fields: buildCustomFields(d),
  });

  // 3. Lista Onboarding + 2 tasks (Kickoff criado pelo Gate A)
  const onboarding = await cu('post', `/folder/${folder.id}/list`, { name: 'Onboarding' });

  const taskPagamento = await cu('post', `/list/${onboarding.id}/task`, {
    name: `💰 Confirmar Pagamento — ${empresa}`,
    description: buildDescPagamento(empresa, d),
    priority: 1,
  });

  await cu('post', `/list/${onboarding.id}/task`, {
    name: `📸 Fotos Recebidas — ${empresa}`,
    description: `Marcar quando o cliente enviar as fotos pelo WhatsApp.\n\nFotos devem ser salvas em:\n📁 Drive → ${empresa} → Fotos\n\nMínimo 10 fotos:\n• Produto acabado (vários ângulos)\n• Produto instalado em obra\n• Processo de fabricação\n• Equipe trabalhando\n• Entrega sendo feita`,
    priority: 2,
  });

  // 4. Listas dos squads (vazias — cada squad popula)
  await cu('post', `/folder/${folder.id}/list`, { name: 'Landing Pages' });
  await cu('post', `/folder/${folder.id}/list`, { name: 'Comercial' });

  if (d.plano === 'growth' || d.plano === 'pro') {
    await cu('post', `/folder/${folder.id}/list`, { name: 'Meta Ads' });
  }
  if (d.plano === 'pro') {
    await cu('post', `/folder/${folder.id}/list`, { name: 'Google Ads' });
  }

  // 5. Estrutura no Drive (3 pastas: Contratos, Fotos, CRM — Leads)
  let drive = {};
  try {
    drive = await criarPastaCliente(empresa);
  } catch (err) {
    drive = { error: err.message };
  }

  // Atualiza descrição da task Pagamento com links do Drive
  if (drive.pastaUrl && taskPagamento?.id) {
    await cu('put', `/task/${taskPagamento.id}`, {
      description: buildDescPagamento(empresa, d, drive),
    }).catch(() => {});
  }

  const listas = ['Onboarding', 'Landing Pages', 'Comercial',
    ...(d.plano === 'growth' || d.plano === 'pro' ? ['Meta Ads'] : []),
    ...(d.plano === 'pro' ? ['Google Ads'] : [])];

  return { msg: `Estrutura criada para ${empresa} (${nomePlano(d.plano)})`, listas, drive };
}

// ============================================================
// FORM 2 — KICKOFF
// Atualiza Ficha + Dossiê + dispara Gate B
// ============================================================
async function processarKickoff(d) {
  const { folders } = await cu('get', `/space/${SPACE_CLIENTES}/folder?archived=false`);
  const folder = folders.find(f => f.name.toLowerCase() === d.empresa.toLowerCase());
  if (!folder) throw new Error(`Folder "${d.empresa}" não encontrado no ClickUp.`);

  // 1. Atualiza Ficha do Cliente em OPERAÇÃO/Fichas
  const ficha = await encontrarFichaOperacao(d.empresa).catch(() => null);
  if (ficha) {
    const dadosCompletos = {
      ...d,
      acessoMeta:   acessoOpt(d.acessoMeta),
      acessoGoogle: acessoOpt(d.acessoGoogle),
      acessoGmb:    acessoOpt(d.acessoGmb),
      acessoSite:   acessoOpt(d.acessoSite),
    };
    await cu('put', `/task/${ficha.id}`, {
      description:   buildFichaDesc(d.empresa, dadosCompletos),
      custom_fields: buildCustomFields(dadosCompletos),
    });

    // Posta briefing narrativo completo como comentário na Ficha
    await cu('post', `/task/${ficha.id}/comment`, {
      comment_text: buildComentarioKickoff(d),
    });
  }

  // 2. Atualiza Dossiê (fire-and-forget)
  atualizarDossieKickoff(folder.id, d).catch(e =>
    console.warn('[kickoff] Dossiê não atualizado:', e.message)
  );

  // 3. Dispara análise de concorrentes no VPS (fire-and-forget)
  const VPS_URL       = (process.env.VPS_URL || 'http://129.121.45.61:3030').trim();
  const WORKER_SECRET = (process.env.WORKER_SECRET || '').trim();
  fetch(`${VPS_URL}/api/run-worker`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: WORKER_SECRET, script: 'analisar-concorrentes', cliente: d.empresa }),
  }).catch(() => {});

  // 4. Gate B — valida briefing + envia WhatsApp + marca task como complete
  const whatsappCliente = d.whatsapp?.replace(/\D/g, '') || '';
  await gateB(d.empresa, d, whatsappCliente);

  return { msg: `Briefing registrado para ${d.empresa}` };
}

// ============================================================
// LP BRIEFING — squad LP cria task na lista Landing Pages
// ============================================================
async function processarLpBriefing(d) {
  const { folders } = await cu('get', `/space/${SPACE_CLIENTES}/folder?archived=false`);
  const folder = folders.find(f => f.name.toLowerCase() === d.empresa.toLowerCase());
  if (!folder) throw new Error(`Folder "${d.empresa}" não encontrado no ClickUp.`);

  const { lists } = await cu('get', `/folder/${folder.id}/list?archived=false`);
  const listaLP = lists.find(l => l.name === 'Landing Pages');
  if (!listaLP) throw new Error('Lista "Landing Pages" não encontrada.');

  const produtos      = (d.produtos     || []).map((p, i) => `**Produto ${i+1}:** ${p.nome}${p.preco ? ` — ${p.preco}` : ''}\n${p.desc || ''}`).join('\n\n');
  const diferenciais  = (d.diferenciais || []).map((df, i) => `${i+1}. ${df}`).join('\n');
  const depoimentos   = (d.depoimentos  || []).map(dep => `"${dep.texto}" — ${dep.nome}${dep.cidade ? `, ${dep.cidade}` : ''}`).join('\n');

  const taskName = d.lp_nome ? `📝 LP Briefing — ${d.empresa} — ${d.lp_nome}` : `📝 LP Briefing — ${d.empresa}`;

  const task = await cu('post', `/list/${listaLP.id}/task`, {
    name: taskName,
    description: [
      `📋 **Briefing de LP — ${d.empresa}**`,
      ``,
      `**Slogan:** ${d.slogan || '—'}`,
      `**Estilo visual:** ${d.estilo || '—'}`,
      `**Cor principal:** ${d.cor_primaria || '—'} | **Cor secundária:** ${d.cor_secundaria || '—'}`,
      `**Cidade:** ${d.cidade || '—'} | **Regiões:** ${d.regioes || '—'}`,
      `**WhatsApp:** ${d.whatsapp || '—'}`,
      `**Headline:** ${d.headline || '(gerar automaticamente)'}`,
      ``,
      `---\n**PRODUTOS:**\n${produtos || '—'}`,
      `---\n**DIFERENCIAIS:**\n${diferenciais || '—'}`,
      `---\n**DEPOIMENTOS:**\n${depoimentos || '—'}`,
      d.obs ? `---\n**Obs:** ${d.obs}` : '',
    ].filter(Boolean).join('\n'),
    priority: 1,
  });

  // Config JSON como comentário (insumo para gerar-lp.js)
  const configJson = {
    empresa: d.empresa, lp_nome: d.lp_nome || '',
    whatsapp: d.whatsapp, cidade: d.cidade || '', regioes: d.regioes || '',
    slogan: d.slogan || '', estilo: d.estilo || 'clean',
    cor_primaria: d.cor_primaria || '#C4B470', cor_secundaria: d.cor_secundaria || '#0D1117',
    headline: d.headline || '',
    produtos: d.produtos || [], diferenciais: d.diferenciais || [],
    depoimentos: d.depoimentos || [], obs: d.obs || '',
  };
  await cu('post', `/task/${task.id}/comment`, {
    comment_text: `\`\`\`json\n${JSON.stringify(configJson, null, 2)}\n\`\`\``,
  });

  const lpLabel = d.lp_nome ? ` — ${d.lp_nome}` : '';
  return { msg: `LP Briefing${lpLabel} recebido para ${d.empresa}. Task criada em Landing Pages.` };
}

// ============================================================
// NOVO LEAD
// ============================================================
async function processarNovoLead(d) {
  if (!d.empresa) throw new Error('Campo empresa obrigatório.');
  const result = await registrarLead(d.empresa, d);
  return { msg: result.msg };
}

// ============================================================
// NOVO ORÇAMENTO
// ============================================================
async function processarNovoOrcamento(d) {
  if (!d.empresa) throw new Error('Campo empresa obrigatório.');
  const result = await registrarOrcamento(d.empresa, d);

  // Posta na Ficha do Cliente (fire-and-forget)
  const itensTexto = (d.itens || []).map(i => `- ${i.nome || '?'}: ${i.qtd || 1}x R$ ${i.preco || '—'}`).join('\n');
  const total = (d.itens || []).reduce((s, i) => s + ((i.qtd || 1) * (parseFloat(String(i.preco || 0).replace(/[^\d.]/g, '')) || 0)), 0);
  fichaComment(d.empresa, [
    `💰 **Orçamento — ${d.data || new Date().toLocaleDateString('pt-BR')}**`,
    `**Lead:** ${d.nome || '—'} | **Tel:** ${d.telefone || '—'}`,
    `**Canal:** ${d.canal || '—'} | **Região:** ${d.regiao || '—'}`,
    itensTexto ? `\n**Itens:**\n${itensTexto}` : '',
    total ? `\n**Total:** R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '',
    d.obs ? `**Obs:** ${d.obs}` : '',
  ].filter(Boolean).join('\n')).catch(() => {});

  return { msg: result.msg };
}

// ============================================================
// BUILDERS — Ficha do Cliente
// ============================================================
function buildFichaDesc(empresa, d) {
  const local = [d.cidade, d.estado].filter(Boolean).join(' — ') || '—';
  const lines = [
    `CNPJ: ${d.cnpj || '—'}`,
    `Localidade: ${local}`,
    `Data Início: ${d.dataInicio || '—'}`,
  ];

  if (d.produtos)        lines.push(`Produtos: ${d.produtos}`);
  if (d.ticketMedio)     lines.push(`Ticket Médio: R$ ${d.ticketMedio}`);
  if (d.diferenciais)    lines.push(`Diferenciais: ${d.diferenciais}`);
  if (d.perfilClientes)  lines.push(`Perfil dos Clientes: ${d.perfilClientes}`);
  if (d.comoVendem)      lines.push(`Como Vendem Hoje: ${d.comoVendem}`);
  if (d.concorrentes)    lines.push(`Concorrentes: ${d.concorrentes}`);
  if (d.obs)             lines.push(`Observações: ${d.obs}`);

  return lines.join('\n');
}

function buildDescPagamento(empresa, d, drive = {}) {
  const driveLinks = drive.pastaUrl
    ? `\n📁 Drive: ${drive.pastaUrl}\n📸 Fotos: ${drive.fotosUrl || drive.pastaUrl}`
    : '';
  return `Marcar como ✅ quando o Pix cair no banco.

---

**Cliente:** ${empresa}
**Responsável:** ${d.responsavel || '—'}
**WhatsApp:** ${d.whatsapp || '—'}
CNPJ: ${d.cnpj || '—'}
**Plano:** ${nomePlano(d.plano)} — R$ ${d.valor}/mês
**Início:** ${d.dataInicio || '—'}${driveLinks}`;
}

function buildComentarioKickoff(d) {
  return [
    `📋 **Briefing de Kickoff — ${d.empresa}**`,
    ``,
    `**🎯 Objetivo:** ${d.objetivoPrincipal || '—'}`,
    d.objetivosSecundarios ? `**Objetivos secundários:** ${d.objetivosSecundarios}` : '',
    d.problemasVendas      ? `**O que trava as vendas:** ${d.problemasVendas}` : '',
    ``,
    `**📦 Produto foco:** ${d.produtoFoco || d.produtos || '—'}`,
    d.diferenciais         ? `**Diferenciais:** ${d.diferenciais}` : '',
    d.areaAtuacao          ? `**Área de atuação:** ${d.areaAtuacao}` : '',
    d.raioEntrega          ? `**Raio de entrega:** ${d.raioEntrega}` : '',
    d.ticketMedio          ? `**Ticket médio:** R$ ${d.ticketMedio}` : '',
    ``,
    `**👥 Perfil:** ${d.perfilClientes || '—'}`,
    d.doresCliente         ? `**Dores:** ${d.doresCliente}` : '',
    d.desejos              ? `**Desejos:** ${d.desejos}` : '',
    ``,
    d.concorrentes         ? `**🏁 Concorrentes:** ${d.concorrentes}` : '',
    d.oportunidades        ? `**💡 Oportunidades:** ${d.oportunidades}` : '',
    ``,
    d.verba                ? `**💰 Verba:** R$ ${d.verba}` : '',
    d.sucesso60Dias        ? `**Sucesso em 60 dias:** ${d.sucesso60Dias}` : '',
  ].filter(Boolean).join('\n');
}

// ============================================================
// DOSSIÊ — Atualiza páginas Kickoff + Briefing no ClickUp v3
// ============================================================
async function cuV3(method, path, body) {
  const res = await fetch(`https://api.clickup.com/api/v3${path}`, {
    method: method.toUpperCase(),
    headers: { Authorization: CLICKUP_API_KEY, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return res.json();
}

async function atualizarDossieKickoff(folderId, d) {
  const docsRes = await cuV3('get', `/workspaces/${WS_ID}/docs?parent_id=${folderId}&parent_type=5`);
  const docs    = docsRes.docs || docsRes.data || [];
  const doc     = docs.find(dc => dc.name?.toLowerCase().includes('doss'));
  if (!doc) return;

  const pagesRes = await cuV3('get', `/workspaces/${WS_ID}/docs/${doc.id}/pages`);
  const pages    = Array.isArray(pagesRes) ? pagesRes : (pagesRes.pages || pagesRes.data || []);
  const hoje     = new Date().toLocaleDateString('pt-BR');

  const pgKickoff = pages.find(p => p.name?.toLowerCase().includes('kickoff'));
  if (pgKickoff) {
    await cuV3('put', `/workspaces/${WS_ID}/docs/${doc.id}/pages/${pgKickoff.id}`, {
      content: buildMdKickoff(d, hoje),
      content_format: 'text/md',
    });
  }

  const pgBriefing = pages.find(p => p.name?.toLowerCase().includes('briefing'));
  if (pgBriefing) {
    await cuV3('put', `/workspaces/${WS_ID}/docs/${doc.id}/pages/${pgBriefing.id}`, {
      content: buildMdBriefing(d, hoje),
      content_format: 'text/md',
    });
  }
}

function buildMdKickoff(d, hoje) {
  return `# 📋 Kickoff — ${d.empresa}

> Atualizado em ${hoje} via formulário de kickoff.

## 🎯 Objetivo Principal
${d.objetivoPrincipal || '_Não informado_'}

## ⚠️ O que está travando as vendas
${d.problemasVendas || '_Não informado_'}

## 📦 Negócio
**Produtos:** ${d.produtos || '_Não informado_'}
**Produto foco:** ${d.produtoFoco || '_Não informado_'}
**Diferenciais:** ${d.diferenciais || '_Não informado_'}
**Área de Atuação:** ${d.areaAtuacao || '_Não informado_'}
**Raio de Entrega:** ${d.raioEntrega || '_Não informado_'}
**Ticket Médio:** ${d.ticketMedio ? `R$ ${d.ticketMedio}` : '_Não informado_'}

## 👥 Clientes
**Perfil:** ${d.perfilClientes || '_Não informado_'}

## 🏁 Concorrentes
${d.concorrentes || '_Não informado_'}

## 💡 Oportunidades
${d.oportunidades || '_Não informado_'}

## 🏆 Sucesso em 60 dias
${d.sucesso60Dias || '_Preencher após alinhamento_'}

## 💰 Campanha
**Verba Mensal:** ${d.verba ? `R$ ${d.verba}` : '_Não informado_'}
**Taxa de Conversão Atual:** ${d.taxaConversao || '_Não informado_'}

## 🌐 Presença Digital
**Site:** ${d.siteUrl || '_Não informado_'}
**Instagram:** ${d.instagram || '_Não informado_'}
**Como Divulga Hoje:** ${d.comoVendem || '_Não informado_'}`;
}

function buildMdBriefing(d, hoje) {
  return `# 🎯 Briefing Criativo — ${d.empresa}

> Atualizado em ${hoje} via kickoff.

## 👤 Avatar
**Perfil:** ${d.perfilClientes || '_Preencher_'}
**Onde Está:** ${d.areaAtuacao || '_Preencher_'}

## 💥 Dores, Desejos e Dúvidas
**Dores:** ${d.doresCliente || '_Preencher_'}
**Desejos:** ${d.desejos || '_Preencher_'}
**O que trava a compra:** ${d.duvidасCompra || '_Preencher_'}

## 🏷️ Produto Principal
**Nome:** ${d.produtoFoco || d.produtos?.split(',')[0]?.trim() || '_Preencher_'}
**Diferenciais:** ${d.diferenciais || '_Preencher_'}
**Preço médio:** ${d.ticketMedio ? `R$ ${d.ticketMedio}` : '_Preencher_'}
**Raio de entrega:** ${d.raioEntrega || '_Preencher_'}

## 📣 Como Divulga Hoje
${d.comoVendem || '_Preencher_'}
**Melhor ação já feita:** ${d.melhorAcaoMarketing || '_Preencher_'}`;
}

// ============================================================
// HELPERS
// ============================================================
async function cu(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: method.toUpperCase(),
    headers: { Authorization: CLICKUP_API_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json));
  return json;
}

function nomePlano(slug) {
  return { starter: 'Starter', growth: 'Growth', pro: 'Pro' }[slug] || slug;
}

function acessoOpt(val) {
  const v = (val || '').toLowerCase();
  if (v === 'sim' || v === 'coletado') return 0;
  if (v === 'pendente') return 1;
  return 2;
}

async function fichaComment(empresa, text) {
  try {
    const ficha = await encontrarFichaOperacao(empresa);
    if (ficha) await cu('post', `/task/${ficha.id}/comment`, { comment_text: text, notify_all: false });
  } catch { /* silencioso */ }
}
