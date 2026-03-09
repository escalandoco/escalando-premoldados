/**
 * ESCALANDO PREMOLDADOS — Onboarding API
 * Vercel Serverless Function
 *
 * POST /api/onboarding
 * Body: { action: 'fechamento' | 'kickoff', ...dados }
 */

import { criarPastaCliente, registrarLead, registrarOrcamento } from './google-drive.js';

const CLICKUP_API_KEY    = process.env.CLICKUP_API_KEY;
const SPACE_CLIENTES     = process.env.CLICKUP_SPACE_ID || '901313553858';
const BASE_URL           = 'https://api.clickup.com/api/v2';
const KICKOFF_URL        = (process.env.KICKOFF_URL || 'https://escalando.co/kickoff').trim();

// ── CUSTOM FIELD IDs — Onboarding list (campos de AÇÃO apenas) ───────────────
// Apenas campos relevantes para as tasks de ação (NF, Kickoff, etc.)
// Campos de perfil do cliente ficam na Ficha do Cliente (lista DADOS)
const CF = {
  whatsapp:      'c8d8bb6d-656f-4d4b-89c7-d37ce1311bbe',
  cnpj:          '232d32d6-cad3-4bd9-8546-d1b101d795fd',
  responsavel:   '35803d01-c334-4f1a-b402-48c635a53e0b',
  plano:         'ba13b1aa-e9ee-47e3-b51b-2142db7b4fc7',
  plano_opts:    { starter: 'f2eac063-f13f-493a-b07f-e7c09b22fa25', growth: '0b0e41c4-fa0c-4f80-8a9d-65ab2e6d9209', pro: '8a724d88-dc3b-42c6-8355-ed4544b37ad8' },
  valor_mensal:  '38bd0f83-b8f0-4e42-9ad7-29d73b861d88',
  data_inicio:   'a8cc4abf-70a0-4fe0-8f55-41ab7c02f27f',
};

// ============================================================
// HANDLER PRINCIPAL
// ============================================================
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  try {
    const dados = req.body;

    if (dados.action === 'fechamento') {
      const resultado = await processarFechamento(dados);
      return res.status(200).json({ success: true, ...resultado });
    }

    if (dados.action === 'kickoff') {
      const resultado = await processarKickoff(dados);
      return res.status(200).json({ success: true, ...resultado });
    }

    if (dados.action === 'novo-lead') {
      const resultado = await processarNovoLead(dados);
      return res.status(200).json({ success: true, ...resultado });
    }

    if (dados.action === 'novo-orcamento') {
      const resultado = await processarNovoOrcamento(dados);
      return res.status(200).json({ success: true, ...resultado });
    }

    if (dados.action === 'lp-briefing') {
      const resultado = await processarLpBriefing(dados);
      return res.status(200).json({ success: true, ...resultado });
    }

    return res.status(400).json({ error: 'action inválida' });

  } catch (err) {
    console.error('Erro onboarding:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// ============================================================
// FICHA DO CLIENTE — helper
// ============================================================
function buildFichaDesc(empresa, d) {
  const acesso = v => v === 0 ? '✅ Coletado' : v === 1 ? '⏳ Pendente' : '—';
  const localidade = [d.cidade, d.estado].filter(Boolean).join(' — ') || '—';
  const canalTexto = d.indicadoPor
    ? `${d.canal || '—'} (por ${d.indicadoPor})`
    : (d.canal || '—');
  return `## 📋 Ficha do Cliente — ${empresa}

---

### 🏢 Dados Comerciais
| Campo | Valor |
|-------|-------|
| **Responsável** | ${d.responsavel || '—'} |
| **WhatsApp** | ${d.whatsapp || '—'} |
| **CNPJ** | ${d.cnpj || '—'} |
| **Localidade** | ${localidade} |
| **Plano** | ${nomePlano(d.plano)} |
| **Valor Mensal** | ${d.valor ? `R$ ${d.valor}` : '—'} |
| **Data Início** | ${d.dataInicio || '—'} |
| **Canal de Captação** | ${canalTexto} |

---

### 🔑 Acessos
| Canal | Status |
|-------|--------|
| **Meta Ads** | ${acesso(d.acessoMeta)} |
| **Google Ads** | ${acesso(d.acessoGoogle)} |
| **GMB** | ${acesso(d.acessoGmb)} |
| **Site** | ${acesso(d.acessoSite)} |

---

### 📦 Negócio
**Produtos/Serviços:** ${d.produtos || '—'}

**Área de Atuação:** ${d.areaAtuacao || '—'}

**Ticket Médio:** ${d.ticketMedio ? `R$ ${d.ticketMedio}` : '—'}

**Verba Mensal (Ads):** ${d.verbaMensal ? `R$ ${d.verbaMensal}` : '—'}

**Diferenciais:** ${d.diferenciais || '—'}

---

### 👥 Mercado
**Perfil dos Clientes:** ${d.perfilClientes || '—'}

**Como Vendem Hoje:** ${d.comoVendem || '—'}

**Concorrentes:** ${d.concorrentes || '—'}

---

### 📝 Observações
${d.obs || '—'}

---
_Atualizado automaticamente pelo sistema Escalando Premoldados_`;
}

async function criarListaDados(folderId, empresa, dadosIniciais = {}) {
  const dadosList = await cu('post', `/folder/${folderId}/list`, { name: 'DADOS' });
  const ficha = await cu('post', `/list/${dadosList.id}/task`, {
    name: `Ficha do Cliente — ${empresa}`,
    description: buildFichaDesc(empresa, dadosIniciais),
    priority: 1,
  });
  return { dadosList, ficha };
}

async function atualizarFichaDesc(folderId, dadosKickoff) {
  const { lists } = await cu('get', `/folder/${folderId}/list?archived=false`);
  const dadosList = lists.find(l => l.name === 'DADOS');
  if (!dadosList) return;
  const { tasks } = await cu('get', `/list/${dadosList.id}/task?archived=false`);
  const ficha = tasks.find(t => t.name.toLowerCase().includes('ficha do cliente'));
  if (!ficha) return;
  await cu('put', `/task/${ficha.id}`, {
    description: buildFichaDesc(dadosKickoff.empresa || '', dadosKickoff),
  });
  return ficha.id;
}

// Encontra a task Ficha do Cliente pelo nome da empresa e retorna seu ID
async function encontrarFichaId(empresa) {
  try {
    const { folders } = await cu('get', `/space/${SPACE_CLIENTES}/folder?archived=false`);
    const folder = folders.find(f => f.name.toLowerCase() === empresa.toLowerCase());
    if (!folder) return null;
    const { lists } = await cu('get', `/folder/${folder.id}/list?archived=false`);
    const dadosList = lists.find(l => l.name === 'DADOS');
    if (!dadosList) return null;
    const { tasks } = await cu('get', `/list/${dadosList.id}/task?archived=false`);
    const ficha = tasks.find(t => t.name.toLowerCase().includes('ficha do cliente'));
    return ficha?.id || null;
  } catch { return null; }
}

async function fichaComment(empresa, text) {
  const fichaId = await encontrarFichaId(empresa);
  if (fichaId) {
    await cu('post', `/task/${fichaId}/comment`, { comment_text: text, notify_all: false });
  }
}

// ============================================================
// FORM 1 — FECHAMENTO
// ============================================================
async function processarFechamento(d) {
  // 1. Cria folder do cliente
  const folder = await cu('post', `/space/${SPACE_CLIENTES}/folder`, { name: d.empresa.trim() });

  // 2. Cria lista DADOS + Ficha do Cliente (nova estrutura)
  await criarListaDados(folder.id, d.empresa.trim(), {
    responsavel: d.responsavel, whatsapp: d.whatsapp, cnpj: d.cnpj,
    plano: d.plano, valor: d.valor, dataInicio: d.dataInicio,
    cidade: d.cidade, estado: d.estado,
    canal: d.canal, indicadoPor: d.indicadoPor,
  });

  // 3. Cria listas por plano
  const onboarding = await cu('post', `/folder/${folder.id}/list`, { name: 'Onboarding' });
  await cu('post', `/folder/${folder.id}/list`, { name: 'GMB' });
  await cu('post', `/folder/${folder.id}/list`, { name: 'Landing Pages' });
  await cu('post', `/folder/${folder.id}/list`, { name: 'CRM — Leads' });

  if (d.plano === 'growth' || d.plano === 'pro') {
    await cu('post', `/folder/${folder.id}/list`, { name: 'Meta Ads' });
  }
  if (d.plano === 'pro') {
    await cu('post', `/folder/${folder.id}/list`, { name: 'Google Ads' });
  }

  // 4. Task: Emitir NF + Contrato (só campos de ação)
  const nfTask = await cu('post', `/list/${onboarding.id}/task`, {
    name: `Emitir NF + Contrato — ${d.empresa}`,
    description: `**Cliente:** ${d.empresa}\n**CNPJ:** ${d.cnpj || '—'}\n**Responsável:** ${d.responsavel || '—'}\n**WhatsApp:** ${d.whatsapp || '—'}\n**Plano:** ${nomePlano(d.plano)} — R$ ${d.valor}/mês\n**Início:** ${d.dataInicio}`,
    priority: 1,
  });
  const tsInicio = toTs(d.dataInicio);
  await setFields(nfTask.id, {
    [CF.whatsapp]:     d.whatsapp    || '',
    [CF.cnpj]:         d.cnpj        || '',
    [CF.responsavel]:  d.responsavel || '',
    [CF.valor_mensal]: parseFloat(String(d.valor || 0).replace(/[^\d.]/g, '')) || 0,
    [CF.plano]:        CF.plano_opts[d.plano] || CF.plano_opts.starter,
    ...(tsInicio ? { [CF.data_inicio]: tsInicio } : {}),
  });

  // 5. Task: Marcar Kickoff (com link do Form 2)
  const kickoffLink = `${KICKOFF_URL}?cliente=${encodeURIComponent(d.empresa)}`;
  const kickoffTask = await cu('post', `/list/${onboarding.id}/task`, {
    name: `Marcar Kickoff — ${d.empresa}`,
    description: `Preencher o briefing junto com o cliente na reunião:\n👉 ${kickoffLink}`,
    priority: 2,
  });
  await setFields(kickoffTask.id, {
    [CF.whatsapp]:     d.whatsapp || '',
    [CF.responsavel]:  d.responsavel || '',
  });

  // 5. Checklist de onboarding (21 dias)
  for (const task of getChecklistTasks(d.plano)) {
    await cu('post', `/list/${onboarding.id}/task`, {
      name: task.nome,
      description: task.desc || '',
      priority: task.prioridade || 3,
    });
  }

  // Cria estrutura no Drive (pasta + subpasta Fotos + planilha CRM)
  let drive = {};
  try {
    drive = await criarPastaCliente(d.empresa);

    // Salva link da planilha na task de NF+Contrato
    if (drive.planilhaUrl) {
      const { tasks: taskList } = await cu('get', `/list/${onboarding.id}/task?archived=false`);
      const nfTask = taskList.find(t => t.name.startsWith('Emitir NF'));
      if (nfTask) {
        const descAtual = nfTask.description || '';
        await cu('put', `/task/${nfTask.id}`, {
          description: descAtual + `\n\n📊 **Planilha de Leads:** ${drive.planilhaUrl}\n📁 **Drive:** ${drive.pastaUrl}\n📸 **Fotos:** ${drive.fotosUrl}`,
        });
      }
    }
  } catch (err) {
    drive = { error: err.message };
  }

  const listas = ['Onboarding', 'GMB', 'Landing Pages', 'CRM — Leads',
    ...(d.plano !== 'starter' ? ['Meta Ads'] : []),
    ...(d.plano === 'pro' ? ['Google Ads'] : [])];

  return { msg: `Estrutura criada para ${d.empresa} (${nomePlano(d.plano)})`, listas, drive };
}

// ============================================================
// FORM 2 — KICKOFF
// ============================================================
async function processarKickoff(d) {
  // Busca folder do cliente
  const { folders } = await cu('get', `/space/${SPACE_CLIENTES}/folder?archived=false`);
  const folder = folders.find(f => f.name.toLowerCase() === d.empresa.toLowerCase());
  if (!folder) throw new Error(`Folder "${d.empresa}" não encontrado no ClickUp.`);

  const { lists } = await cu('get', `/folder/${folder.id}/list?archived=false`);

  // 1. Atualiza Ficha do Cliente na lista DADOS
  await atualizarFichaDesc(folder.id, {
    empresa:       d.empresa,
    responsavel:   d.responsavel,
    whatsapp:      d.whatsapp,
    cnpj:          d.cnpj,
    plano:         d.plano,
    valor:         d.valor,
    dataInicio:    d.dataInicio,
    produtos:      d.produtos,
    areaAtuacao:   d.areaAtuacao,
    ticketMedio:   d.ticketMedio,
    verbaMensal:   d.verba,
    acessoMeta:    acessoOpt(d.acessoMeta),
    acessoGoogle:  acessoOpt(d.acessoGoogle),
    acessoGmb:     acessoOpt(d.acessoGmb),
    acessoSite:    acessoOpt(d.acessoSite),
    diferenciais:  d.diferenciais,
    perfilClientes:d.perfilClientes,
    comoVendem:    d.comoVendem,
    concorrentes:  d.concorrentes,
    obs:           d.obs,
  });

  // 2. Busca lista Onboarding + task "Marcar Kickoff" para marcar como concluída
  const onboarding = lists.find(l => l.name === 'Onboarding');
  if (onboarding) {
    const { tasks } = await cu('get', `/list/${onboarding.id}/task?archived=false`);
    const kickoffTask = tasks.find(t => t.name.toLowerCase().startsWith('marcar kickoff'));
    if (kickoffTask) {
      // Marca como concluída
      await cu('put', `/task/${kickoffTask.id}`, { status: 'complete' }).catch(() => {});
    }
  }

  // Comentário completo com todos os campos do formulário (vai na Ficha do Cliente)
  const comentario = [
    `📋 **Briefing de Kickoff — ${d.empresa}**`,
    ``,
    `**🎯 Objetivo principal:** ${d.objetivoPrincipal || '—'}`,
    d.objetivosSecundarios ? `**Objetivos secundários:** ${d.objetivosSecundarios}` : '',
    d.problemasVendas      ? `**O que trava as vendas:** ${d.problemasVendas}` : '',
    ``,
    `**📦 Produtos:** ${d.produtos || '—'}`,
    d.produtoFoco          ? `**Produto foco:** ${d.produtoFoco}` : '',
    d.diferenciais         ? `**Diferenciais:** ${d.diferenciais}` : '',
    d.areaAtuacao          ? `**Área de atuação:** ${d.areaAtuacao}` : '',
    d.raioEntrega          ? `**Raio de entrega:** ${d.raioEntrega}` : '',
    d.ticketMedio          ? `**Ticket médio:** R$ ${d.ticketMedio}` : '',
    d.volumeLeads          ? `**Volume de leads atual:** ${d.volumeLeads}` : '',
    d.processoComercial    ? `**Processo comercial:** ${d.processoComercial}` : '',
    ``,
    `**👥 Perfil dos clientes:** ${d.perfilClientes || '—'}`,
    d.doresCliente         ? `**Dores:** ${d.doresCliente}` : '',
    d.desejos              ? `**Desejos:** ${d.desejos}` : '',
    d.duvidасCompra        ? `**O que trava a compra:** ${d.duvidасCompra}` : '',
    ``,
    d.concorrentes         ? `**🏁 Concorrentes:** ${d.concorrentes}` : '',
    d.oportunidades        ? `**💡 Oportunidades:** ${d.oportunidades}` : '',
    ``,
    d.verba                ? `**💰 Verba mensal:** R$ ${d.verba}` : '',
    d.taxaConversao        ? `**Taxa de conversão atual:** ${d.taxaConversao}` : '',
    d.melhorAcaoMarketing  ? `**Melhor ação de marketing:** ${d.melhorAcaoMarketing}` : '',
    d.sucesso60Dias        ? `**Sucesso em 60 dias:** ${d.sucesso60Dias}` : '',
    ``,
    d.siteUrl              ? `**🌐 Site:** ${d.siteUrl}` : '',
    d.instagram            ? `**Instagram:** ${d.instagram}` : '',
    d.comoVendem           ? `**Como divulga hoje:** ${d.comoVendem}` : '',
    ``,
    d.obs                  ? `**📝 Observações:** ${d.obs}` : '',
  ].filter(Boolean).join('\n');

  // Posta comentário de briefing na Ficha do Cliente (lista DADOS)
  const fichaTaskId = await atualizarFichaDesc(folder.id, {
    empresa: d.empresa, responsavel: d.responsavel, whatsapp: d.whatsapp,
    cnpj: d.cnpj, plano: d.plano, valor: d.valor, dataInicio: d.dataInicio,
    produtos: d.produtos, areaAtuacao: d.areaAtuacao, ticketMedio: d.ticketMedio,
    verbaMensal: d.verba, acessoMeta: acessoOpt(d.acessoMeta),
    acessoGoogle: acessoOpt(d.acessoGoogle), acessoGmb: acessoOpt(d.acessoGmb),
    acessoSite: acessoOpt(d.acessoSite), diferenciais: d.diferenciais,
    perfilClientes: d.perfilClientes, comoVendem: d.comoVendem,
    concorrentes: d.concorrentes, obs: d.obs,
  });
  if (fichaTaskId) {
    await cu('post', `/task/${fichaTaskId}/comment`, { comment_text: comentario });
  }

  // Atualiza Dossiê do cliente (Kickoff + Briefing pages) via ClickUp v3 — async
  atualizarDossieKickoff(folder.id, d).catch(e =>
    console.warn('[kickoff] Dossiê não atualizado:', e.message)
  );

  // Dispara análise de concorrentes no VPS — fire-and-forget
  const VPS_URL       = (process.env.VPS_URL || 'http://129.121.45.61:3030').trim();
  const WORKER_SECRET = (process.env.WORKER_SECRET || 'esc-worker-2026-secret').trim();
  fetch(`${VPS_URL}/api/run-worker`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: WORKER_SECRET, script: 'analisar-concorrentes', cliente: d.empresa }),
  }).catch(() => {});

  return { msg: `Briefing registrado para ${d.empresa}` };
}

// ============================================================
// ATUALIZA DOSSIÊ — Kickoff + Briefing pages via ClickUp v3
// ============================================================
const WS_ID = '90133050692';

async function cuV3(method, path, body) {
  const res = await fetch(`https://api.clickup.com/api/v3${path}`, {
    method: method.toUpperCase(),
    headers: { Authorization: CLICKUP_API_KEY, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return res.json();
}

async function atualizarDossieKickoff(folderId, d) {
  // 1. Lista docs do folder
  const docsRes = await cuV3('get', `/workspaces/${WS_ID}/docs?parent_id=${folderId}&parent_type=5`);
  const docs = docsRes.docs || docsRes.data || [];
  const empresa = d.empresa;
  const doc = docs.find(dc =>
    dc.name && dc.name.toLowerCase().includes('dossiê') ||
    dc.name && dc.name.toLowerCase().includes('dossie')
  );
  if (!doc) return; // Dossiê ainda não criado — ok

  // 2. Lista páginas do doc
  // A API v3 retorna array direto (não objeto com chave 'pages')
  const pagesRes = await cuV3('get', `/workspaces/${WS_ID}/docs/${doc.id}/pages`);
  const pages = Array.isArray(pagesRes) ? pagesRes : (pagesRes.pages || pagesRes.data || []);

  const hoje = new Date().toLocaleDateString('pt-BR');

  // 3. Atualiza página Kickoff
  const pgKickoff = pages.find(p => p.name && p.name.toLowerCase().includes('kickoff'));
  if (pgKickoff) {
    const mdKickoff = `# 📋 Kickoff — ${empresa}

> Atualizado em ${hoje} via formulário de kickoff.

---

## 🎯 Objetivo Principal

${d.objetivoPrincipal || '_Não informado_'}

## 🎯 Objetivos Secundários

${d.objetivosSecundarios || '_Não informado_'}

## ⚠️ O que está travando as vendas hoje

${d.problemasVendas || '_Não informado_'}

---

## 🏢 Negócio

**Produtos/Serviços:** ${d.produtos || '_Não informado_'}

**Produto foco:** ${d.produtoFoco || '_Não informado_'}

**Diferenciais:** ${d.diferenciais || '_Não informado_'}

**Área de Atuação:** ${d.areaAtuacao || '_Não informado_'}

**Raio de Entrega:** ${d.raioEntrega || '_Não informado_'}

**Ticket Médio:** ${d.ticketMedio ? `R$ ${d.ticketMedio}` : '_Não informado_'}

**Volume de Leads Atual:** ${d.volumeLeads || '_Não informado_'}

**Processo Comercial:** ${d.processoComercial || '_Não informado_'}

---

## 👥 Clientes

**Perfil dos Clientes:** ${d.perfilClientes || '_Não informado_'}

**Área de Atuação:** ${d.areaAtuacao || '_Não informado_'}

---

## 🏁 Concorrentes

${d.concorrentes || '_Não informado_'}

---

## 💡 Oportunidades de Mercado

${d.oportunidades || '_Não informado_'}

---

## 🏆 Sucesso em 60 dias

${d.sucesso60Dias || '_Preencher após alinhamento_'}

---

## 💰 Campanha

**Verba Mensal:** ${d.verba ? `R$ ${d.verba}` : '_Não informado_'}

**Taxa de Conversão Atual:** ${d.taxaConversao || '_Não informado_'}

**Melhor Ação de Marketing:** ${d.melhorAcaoMarketing || '_Não informado_'}

---

## 🌐 Presença Digital

**Site:** ${d.siteUrl || '_Não informado_'}

**Instagram:** ${d.instagram || '_Não informado_'}

**Como Divulga Hoje:** ${d.comoVendem || '_Não informado_'}

---

## 📝 Observações

${d.obs || '_Sem observações_'}

---

## 📬 Contato Comercial

**Responsável:** ${d.responsavel || '_Preencher_'}`;

    await cuV3('put', `/workspaces/${WS_ID}/docs/${doc.id}/pages/${pgKickoff.id}`, {
      content: mdKickoff,
      content_format: 'text/md',
    });
  }

  // 4. Atualiza página Briefing
  const pgBriefing = pages.find(p => p.name && p.name.toLowerCase().includes('briefing'));
  if (pgBriefing) {
    const mdBriefing = `# 🎯 Briefing Criativo — ${empresa}

> Atualizado em ${hoje} via formulário de kickoff.
> Base para geração de copy, anúncios e landing pages pelos agentes.

---

## 👤 Avatar — Cliente Ideal

**Perfil:** ${d.perfilClientes || '_Descrever o cliente ideal_'}

**Faixa de Idade:** _Preencher_

**Onde Está:** ${d.areaAtuacao || '_Cidade, região, zona rural?_'}

---

## 💥 Dores, Desejos e Dúvidas

### Dores (o que ele sofre hoje)
${d.doresCliente || '_Preencher_'}

### Desejos (o que ele quer alcançar)
${d.desejos || '_Preencher_'}

### Dúvidas (o que trava a compra)
${d.duvidасCompra || '_Preencher_'}

---

## ✍️ Direção de Copy

**Tom de comunicação:** _Direto, técnico, regional?_

**Promessa principal:** _A frase central que gera conversão_

**Principal objeção a superar:** ${d.duvidасCompra ? d.duvidасCompra.split('.')[0] : '_Preencher_'}

**O que o cliente fala ao escolher a empresa:** ${d.diferenciais || '_Preencher_'}

---

## 🏷️ Produto Principal

**Nome:** ${d.produtoFoco || d.produtos?.split(',')[0]?.trim() || '_Preencher_'}

**Diferenciais:**
${d.diferenciais || '_Preencher_'}

**Preço médio:** ${d.ticketMedio ? `R$ ${d.ticketMedio}` : '_Preencher_'}

**Raio de entrega:** ${d.raioEntrega || '_Preencher_'}

---

## 📣 Como Divulga Hoje

${d.comoVendem || '_Preencher_'}

**Melhor ação já feita:** ${d.melhorAcaoMarketing || '_Preencher_'}`;

    await cuV3('put', `/workspaces/${WS_ID}/docs/${doc.id}/pages/${pgBriefing.id}`, {
      content: mdBriefing,
      content_format: 'text/md',
    });
  }

  // 5. Atualiza página Estratégia com metas do cliente
  const pgEstrategia = pages.find(p => p.name && (
    p.name.toLowerCase().includes('estratégia') ||
    p.name.toLowerCase().includes('estrategia') ||
    p.name.toLowerCase().includes('decisões')
  ));
  if (pgEstrategia && (d.sucesso60Dias || d.oportunidades)) {
    const pgAtual = await cuV3('get', `/workspaces/${WS_ID}/docs/${doc.id}/pages/${pgEstrategia.id}`);
    const conteudoAtual = pgAtual.content || '';
    const entrada = `\n\n---\n\n**${hoje} — Kickoff preenchido**\n- **Sucesso em 60 dias:** ${d.sucesso60Dias || '—'}\n- **Oportunidades:** ${d.oportunidades || '—'}`;
    await cuV3('put', `/workspaces/${WS_ID}/docs/${doc.id}/pages/${pgEstrategia.id}`, {
      content: conteudoAtual + entrada,
      content_format: 'text/md',
    });
  }
}

// ============================================================
// NOVO LEAD — Registra lead na planilha do cliente
// ============================================================
async function processarNovoLead(d) {
  if (!d.empresa) throw new Error('Campo empresa obrigatório.');
  const result = await registrarLead(d.empresa, d);
  return { msg: result.msg };
}

// ============================================================
// LP BRIEFING — Salva briefing no Drive + cria task no ClickUp
// ============================================================
async function processarLpBriefing(d) {
  // 1. Busca folder do cliente no ClickUp
  const { folders } = await cu('get', `/space/${SPACE_CLIENTES}/folder?archived=false`);
  const folder = folders.find(f => f.name.toLowerCase() === d.empresa.toLowerCase());
  if (!folder) throw new Error(`Folder "${d.empresa}" não encontrado no ClickUp.`);

  // 2. Busca lista Onboarding
  const { lists } = await cu('get', `/folder/${folder.id}/list?archived=false`);
  const onboarding = lists.find(l => l.name === 'Onboarding');
  if (!onboarding) throw new Error('Lista Onboarding não encontrada.');

  // 3. Monta descrição da task
  const produtos = (d.produtos || []).map((p, i) =>
    `**Produto ${i+1}:** ${p.nome}${p.preco ? ` — ${p.preco}` : ''}\n${p.aplicacao ? `Aplicação: ${p.aplicacao}\n` : ''}${p.desc || ''}`
  ).join('\n\n');

  const diferenciais = (d.diferenciais || []).map((d, i) => `${i+1}. ${d}`).join('\n');
  const depoimentos  = (d.depoimentos  || []).map(d => `"${d.texto}" — ${d.nome}${d.cidade ? `, ${d.cidade}` : ''}`).join('\n');

  const desc = [
    `📋 **Briefing de LP — ${d.empresa}**`,
    ``,
    `**Slogan:** ${d.slogan || '—'}`,
    `**Estilo visual:** ${d.estilo || '—'}`,
    `**Cor principal:** ${d.cor_primaria || '—'}`,
    `**Cor secundária:** ${d.cor_secundaria || '—'}`,
    ``,
    `**WhatsApp:** ${d.whatsapp}`,
    `**Cidade sede:** ${d.cidade || '—'}`,
    `**Regiões de entrega:** ${d.regioes || '—'}`,
    ``,
    `**Headline sugerida:** ${d.headline || '(gerar automaticamente)'}`,
    ``,
    `---`,
    `**PRODUTOS:**`,
    produtos || '—',
    ``,
    `---`,
    `**DIFERENCIAIS:**`,
    diferenciais || '—',
    ``,
    `---`,
    `**DEPOIMENTOS:**`,
    depoimentos || '—',
    d.obs ? `\n**Obs:** ${d.obs}` : '',
  ].filter(v => v !== '').join('\n');

  // 5. Cria task no ClickUp
  const taskName = d.lp_nome
    ? `Gerar LP — ${d.empresa} — ${d.lp_nome}`
    : `Gerar LP — ${d.empresa}`;

  const task = await cu('post', `/list/${onboarding.id}/task`, {
    name: taskName,
    description: desc,
    priority: 2,
  });

  // 6. Salva config JSON como comentário (usado pelo gerador de LP)
  const configJson = {
    empresa:       d.empresa,
    lp_nome:       d.lp_nome || '',
    whatsapp:      d.whatsapp,
    cidade:        d.cidade       || '',
    regioes:       d.regioes      || '',
    slogan:        d.slogan       || '',
    estilo:        d.estilo       || 'clean',
    cor_primaria:  d.cor_primaria  || '#C4B470',
    cor_secundaria:d.cor_secundaria || '#0D1117',
    headline:      d.headline     || '',
    produtos:      d.produtos     || [],
    diferenciais:  d.diferenciais || [],
    depoimentos:   d.depoimentos  || [],
    obs:           d.obs          || '',
  };
  await cu('post', `/task/${task.id}/comment`, {
    comment_text: `\`\`\`json\n${JSON.stringify(configJson, null, 2)}\n\`\`\``,
  });

  // 7. Posta resumo do LP Briefing na Ficha do Cliente
  const produtosTexto = (d.produtos || []).map(p => `- ${p.nome}${p.preco ? ` (${p.preco})` : ''}`).join('\n');
  const diferenciaisTexto = (d.diferenciais || []).map((df, i) => `${i+1}. ${df}`).join('\n');
  const depoimentosTexto = (d.depoimentos || []).map(dep => `"${dep.texto}" — ${dep.nome}${dep.local ? `, ${dep.local}` : ''}`).join('\n');
  const lpLabel = d.lp_nome ? ` — ${d.lp_nome}` : '';
  await fichaComment(d.empresa, [
    `🎨 **LP Briefing preenchido${lpLabel}**`,
    ``,
    `**WhatsApp:** ${d.whatsapp || '—'}`,
    `**Cidade:** ${d.cidade || '—'} | **Regiões:** ${d.regioes || '—'}`,
    `**Slogan:** ${d.slogan || '—'}`,
    `**Estilo visual:** ${d.estilo || '—'} | **Cores:** ${d.cor_primaria || ''} / ${d.cor_secundaria || ''}`,
    `**Headline:** ${d.headline || '(a gerar)'}`,
    ``,
    produtosTexto ? `**Produtos:**\n${produtosTexto}` : '',
    diferenciaisTexto ? `\n**Diferenciais:**\n${diferenciaisTexto}` : '',
    depoimentosTexto ? `\n**Depoimentos:**\n${depoimentosTexto}` : '',
    d.obs ? `\n**Obs:** ${d.obs}` : '',
    ``,
    `---\n_LP Briefing — Escalando Premoldados_`,
  ].filter(v => v !== '').join('\n'));

  return { msg: `Briefing de LP${lpLabel} recebido para ${d.empresa}. Task criada no ClickUp.` };
}

// ============================================================
// NOVO ORÇAMENTO — Registra orçamento na planilha do cliente
// ============================================================
async function processarNovoOrcamento(d) {
  if (!d.empresa) throw new Error('Campo empresa obrigatório.');
  const result = await registrarOrcamento(d.empresa, d);
  const json = { success: true, msg: result.msg };

  // Posta registro do orçamento na Ficha do Cliente (fire-and-forget)
  if (d.empresa) {
    const itensTexto = (d.itens || []).map(item =>
      `- ${item.nome || item.produto || '?'}: ${item.qtd || 1}x R$ ${item.preco || '—'}`
    ).join('\n');
    const total = (d.itens || []).reduce((s, i) => s + ((i.qtd || 1) * (parseFloat(String(i.preco || 0).replace(/[^\d.]/g, '')) || 0)), 0);
    fichaComment(d.empresa, [
      `💰 **Orçamento registrado — ${d.data || new Date().toLocaleDateString('pt-BR')}**`,
      ``,
      `**Lead:** ${d.nome || '—'} | **Tel:** ${d.telefone || '—'}`,
      `**Canal:** ${d.canal || '—'} | **Região:** ${d.regiao || '—'}`,
      itensTexto ? `\n**Itens:**\n${itensTexto}` : '',
      total ? `\n**Total estimado:** R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '',
      d.prazo ? `**Prazo desejado:** ${d.prazo}` : '',
      d.obs ? `**Obs:** ${d.obs}` : '',
      ``,
      `---\n_Orçamento — Escalando Premoldados_`,
    ].filter(v => v !== '').join('\n')).catch(() => {});
  }

  return { msg: json.msg };
}

// ============================================================
// HELPERS
// ============================================================
async function cu(method, path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: method.toUpperCase(),
    headers: { Authorization: CLICKUP_API_KEY, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json));
  return json;
}

// Seta um custom field numa task (falha silenciosa para não travar o fluxo)
async function setField(taskId, fieldId, value) {
  try {
    await cu('post', `/task/${taskId}/field/${fieldId}`, { value });
  } catch (e) {
    console.warn(`[setField] ${fieldId}=${value}: ${e.message}`);
  }
}

// Seta vários campos de uma vez: { fieldId: value, ... }
async function setFields(taskId, fields) {
  await Promise.all(Object.entries(fields).map(([fid, val]) => setField(taskId, fid, val)));
}

// Converte "dd/mm/aaaa" ou "aaaa-mm-dd" para timestamp ms
function toTs(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.includes('/') ? dateStr.split('/').reverse() : dateStr.split('-');
  const d = new Date(parts.join('-'));
  return isNaN(d) ? null : d.getTime();
}

// Retorna orderindex da opção de acesso ("sim"/"coletado" → 0, "pendente" → 1, else → 2)
function acessoOpt(val) {
  const v = (val || '').toLowerCase();
  if (v === 'sim' || v === 'coletado' || v === 'yes') return 0;
  if (v === 'pendente') return 1;
  return 2;
}

function nomePlano(slug) {
  return { starter: 'Starter', growth: 'Growth', pro: 'Pro' }[slug] || slug;
}

function getChecklistTasks(plano) {
  const tasks = [
    {
      nome: 'S1 — Enviar roteiro de fotos ao cliente',
      prioridade: 2,
      desc: `📸 **Roteiro de Fotos — enviar ao cliente via WhatsApp**

Sem fotos reais a LP fica com imagens genéricas. Esse passo destrava tudo que vem depois.

**O que pedir:**
- [ ] Fachada da empresa (externa, com placa visível)
- [ ] Produtos acabados expostos (vários ângulos, boa luz)
- [ ] Processo de fabricação / máquinas em operação
- [ ] Equipe trabalhando (humaniza a marca)
- [ ] Entrega sendo feita (caminhão, obra, cliente recebendo)
- [ ] Close nos produtos (textura, detalhe, qualidade)

**Como enviar:**
Manda por WhatsApp com o texto:
_"Olá! Para começarmos a montar sua página e os anúncios, preciso de algumas fotos. Manda no WhatsApp mesmo, em boa resolução (sem zoom). Lista aqui: [lista acima]"_

**Prazo sugerido:** pedir para a semana seguinte ao kickoff.`,
    },
    {
      nome: 'S1 — Coletar acessos (Meta, Google, GMB, site)',
      desc: `🔑 **Coletar todos os acessos necessários para operar a conta**

Sem acessos não conseguimos configurar nem monitorar nada. Prioridade máxima na semana 1.

**Meta Business Manager**
- [ ] Acessar business.facebook.com → Configurações → Pessoas
- [ ] Adicionar: jonatas@escalando.co como **Administrador**
- [ ] Confirmar que a conta de anúncios está vinculada ao BM do cliente
- [ ] Confirmar acesso ao Pixel (ou criar se não existir)

**Google Meu Negócio (GMB)**
- [ ] Acessar business.google.com → Gerenciar acesso
- [ ] Adicionar jonatas@escalando.co como **Gerente**
- [ ] Aceitar convite (pedir ao cliente para confirmar no e-mail)

**Google Ads** _(plano Pro)_
- [ ] Acessar ads.google.com → Admin → Acesso e segurança
- [ ] Convidar jonatas@escalando.co como **Administrador**

**Site (se tiver)**
- [ ] Pedir login/senha do painel (WordPress, Wix, etc.)
- [ ] Ou adicionar usuário administrador

**Confirmação final:**
- [ ] Todos os acessos testados com login da Escalando`,
    },
    {
      nome: 'S2 — Configurar LP',
      desc: `🌐 **Configurar e publicar a Landing Page do cliente**

A LP é o destino de todos os anúncios. Precisa estar 100% antes do go-live.

**Pré-requisitos:** fotos do cliente recebidas ✓

**Passo a passo:**
- [ ] Preencher \`lp/lp-briefing.html\` com dados do cliente (ou acessar escalando.co/lp-briefing)
- [ ] Rodar: \`node scripts/gerar-lp.js --empresa=CLIENTE --config=config/lp-CLIENTE.json --no-upload\`
- [ ] Revisar LP gerada em \`dist/\` no browser
- [ ] Verificar: headline clara, produto destacado, WhatsApp funcionando
- [ ] Verificar: versão mobile (redimensionar janela)
- [ ] Confirmar Pixel Meta instalado (ver no Meta Pixel Helper)
- [ ] Rodar deploy: \`node scripts/deploy-lp.js --cliente=CLIENTE\`
- [ ] Testar URL ao vivo: abrir no celular e no desktop
- [ ] Enviar link da LP para o cliente aprovar`,
    },
    {
      nome: 'S2 — Configurar GMB (15 itens)',
      desc: `📍 **Configurar o perfil do Google Meu Negócio — 15 itens obrigatórios**

GMB bem configurado aparece no Google Maps e nas pesquisas locais. É tráfego gratuito.

**Acesso:** business.google.com → perfil do cliente

- [ ] 1. **Categoria principal** — escolher a mais específica possível (ex: "Fabricante de concreto pré-moldado")
- [ ] 2. **Categorias secundárias** — adicionar 2 a 3 categorias complementares
- [ ] 3. **Descrição do negócio** — 750 caracteres com palavras-chave locais (ex: "pisos intertravados em Sergipe")
- [ ] 4. **Endereço completo** — com CEP, bairro e cidade
- [ ] 5. **Área de atendimento** — cidades/regiões que atendem
- [ ] 6. **Telefone** — número principal com WhatsApp
- [ ] 7. **Site** — URL da LP (não do site institucional genérico)
- [ ] 8. **Horário de funcionamento** — todos os dias preenchidos
- [ ] 9. **Fotos da fachada** — mínimo 3 fotos externas
- [ ] 10. **Fotos dos produtos** — mínimo 5 fotos de produtos
- [ ] 11. **Foto de perfil** — logo em fundo branco ou foto da fachada
- [ ] 12. **Foto de capa** — melhor foto dos produtos
- [ ] 13. **Produtos/serviços** — cadastrar produtos com nome, descrição e preço (ou "consulte")
- [ ] 14. **Primeiro post** — publicar uma novidade ou promoção
- [ ] 15. **Perguntas frequentes** — adicionar 3 perguntas + respostas comuns

**Resultado esperado:** perfil completo com nota "Excelente" no GMB.`,
    },
    {
      nome: 'S2 — Configurar CRM/Sheets',
      desc: `📊 **Configurar planilha de CRM e webhook de leads**

Todo lead da LP e do WhatsApp vai para o Sheets. Precisa estar funcionando antes do go-live.

- [ ] Abrir a planilha do cliente no Google Drive
- [ ] Confirmar que as colunas estão corretas: Data, Nome, Telefone, Produto, Canal, Status
- [ ] Acessar Apps Script (Extensões → Apps Script) e confirmar que o webhook está publicado
- [ ] Copiar a URL do Web App e salvar em \`GOOGLE_WORKSPACE_URL\` no Vercel
- [ ] Testar o webhook: enviar um lead de teste via \`lp/lead.html\`
- [ ] Confirmar que o lead aparece na planilha em menos de 30s
- [ ] Testar também via formulário da LP (botão WhatsApp → verificar registro)

**Onde fica:** Google Drive → pasta do cliente → "CRM — Leads — EMPRESA"`,
    },
    {
      nome: 'S2 — Configurar Tintim',
      desc: `💬 **Conectar Tintim para rastrear leads via WhatsApp**

O Tintim captura quem manda mensagem no WhatsApp da empresa e registra no CRM.

- [ ] Acessar painel do Tintim com login da Escalando
- [ ] Conectar o número de WhatsApp do cliente (QR Code ou API)
- [ ] Configurar webhook de saída: \`https://escalando-premoldados.vercel.app/api/tintim\`
- [ ] Configurar tag automática: "Lead LP" para quem vem via link da LP
- [ ] Testar: mandar mensagem no WhatsApp do cliente → verificar se aparece no Sheets
- [ ] Confirmar que nome, telefone e origem estão registrados corretamente

**Número do cliente:** ver campo WhatsApp no Dossiê do ClickUp`,
    },
    {
      nome: 'S2 — Briefing de criativos ao designer',
      desc: `🎨 **Briefing completo para o designer criar os criativos dos anúncios**

Os criativos são a peça mais importante dos anúncios. Briefing ruim = criativos ruins.

**O que enviar ao designer:**

- [ ] **Fotos** — selecionar as 5 melhores fotos do cliente para usar nos anúncios
- [ ] **Paleta de cores** — cor primária e secundária da marca (ver Dossiê → Briefing)
- [ ] **Logo** — arquivo PNG com fundo transparente
- [ ] **Produto foco** — qual produto será anunciado primeiro
- [ ] **Headline principal** — frase de impacto (ex: "Piso Intertravado direto da fábrica em Sergipe")
- [ ] **CTA** — chamada para ação (ex: "Peça seu orçamento no WhatsApp")
- [ ] **Formatos necessários:**
  - Feed quadrado (1080x1080)
  - Stories vertical (1080x1920)
  - Banner carrossel (1080x1080 × 3 cards)
- [ ] **Referências visuais** — 2 a 3 anúncios de referência do setor (buscar na Meta Ads Library)
- [ ] **Prazo** — combinar entrega em no máximo 5 dias úteis`,
    },
    {
      nome: 'Go-live — Checklist antes de ligar campanhas',
      prioridade: 2,
      desc: `🚀 **Checklist final antes de ativar os anúncios**

Não ligue as campanhas sem confirmar cada item. Erro aqui = dinheiro perdido.

**LP**
- [ ] LP está no ar e abrindo rápido (testar no celular com 4G, não Wi-Fi)
- [ ] Botão de WhatsApp funcionando (abre conversa com mensagem pré-preenchida)
- [ ] Formulário de lead funcionando (se existir)
- [ ] LP aprovada pelo cliente

**Rastreamento**
- [ ] Pixel Meta disparando na LP (verificar com Meta Pixel Helper)
- [ ] Evento "Lead" configurado (dispara quando clica no WhatsApp)
- [ ] Lead de teste chegando na planilha Sheets

**Meta Ads**
- [ ] Campanha criada com objetivo correto (Leads ou Mensagens)
- [ ] Público configurado (localização, interesse, cargo)
- [ ] Criativos aprovados e enviados
- [ ] Orçamento diário definido (R$ verba ÷ 30)
- [ ] Pixel vinculado à campanha
- [ ] URL de destino: LP do cliente (não o site)

**Comunicação**
- [ ] Cliente avisado que os anúncios vão ao ar hoje
- [ ] Cliente sabe que pode começar a receber leads`,
    },
    {
      nome: 'Go-live — Notificar primeiro lead ao cliente',
      desc: `🎉 **Celebrar e registrar o primeiro lead com o cliente**

O primeiro lead é um marco importante. Não deixe passar em branco — gera confiança.

- [ ] Aguardar o primeiro lead chegar (via Sheets ou WhatsApp do cliente)
- [ ] Confirmar dados do lead: nome, telefone, produto de interesse
- [ ] Mandar mensagem para o cliente no WhatsApp:
  _"🎉 Primeiro lead chegou! [Nome] entrou em contato interessado em [produto]. Tá na planilha e no WhatsApp de vocês."_
- [ ] Orientar o cliente a responder em menos de 5 minutos (taxa de conversão cai muito depois disso)
- [ ] Registrar data/hora do primeiro lead no Dossiê → Histórico de Performance`,
    },
  ];

  if (plano === 'growth' || plano === 'pro') {
    tasks.splice(4, 0, {
      nome: 'S2 — Configurar Meta Ads',
      desc: `📘 **Configurar conta e estrutura de Meta Ads do cliente**

Essa configuração é feita uma vez e serve de base para todas as campanhas futuras.

**Pré-requisitos:** acesso ao BM do cliente ✓ | Pixel instalado na LP ✓ | Criativos prontos ✓

**Conta e Pixel**
- [ ] Confirmar que a conta de anúncios está vinculada ao BM da Escalando
- [ ] Pixel instalado na LP e disparando eventos corretamente
- [ ] Configurar evento "Lead" (clique no WhatsApp ou envio de formulário)
- [ ] Criar Custom Audience: visitantes da LP (últimos 30 dias)
- [ ] Criar Lookalike 1% baseado nos leads do Sheets (quando tiver 100+)

**Campanha inicial — Topo de Funil**
- [ ] Objetivo: Tráfego ou Leads (testar qual converte melhor)
- [ ] Público: localização + interesse + cargo (definir no briefing)
- [ ] Orçamento diário: R$ [verba ÷ 30]
- [ ] Criativos: mínimo 3 variações (imagem, carrossel, vídeo se disponível)
- [ ] URL de destino: LP do cliente com UTM (?utm_source=meta&utm_medium=paid)
- [ ] Período inicial: 7 dias sem otimização (deixar o algoritmo aprender)

**Monitoramento**
- [ ] Configurar alerta de CPL no sistema (monitorar-ads.js já faz isso)
- [ ] Definir CPL máximo aceitável com o cliente`,
    });
  }

  if (plano === 'pro') {
    tasks.splice(5, 0, {
      nome: 'S2 — Configurar Google Ads',
      desc: `🔍 **Configurar conta e campanha Search no Google Ads**

Google Ads Search captura quem já está procurando ativamente — intenção de compra alta.

**Pré-requisitos:** acesso à conta Google Ads ✓ | LP no ar ✓ | Conversões configuradas ✓

**Configuração inicial**
- [ ] Vincular conta Google Ads ao MCC da Escalando
- [ ] Configurar conversão: "Lead" (clique no WhatsApp da LP)
- [ ] Instalar tag de conversão na LP (via Google Tag Manager ou código direto)
- [ ] Testar disparando conversão manual

**Pesquisa de palavras-chave**
- [ ] Levantar 20 a 30 keywords do produto (usar Keyword Planner)
- [ ] Separar por intenção: compra ("comprar piso intertravado"), informação ("preço piso"), local ("piso intertravado Aracaju")
- [ ] Negativar termos irrelevantes (DIY, "como fazer", concorrentes)

**Campanha Search**
- [ ] Criar campanha com objetivo "Leads"
- [ ] Grupo de anúncio por categoria de produto
- [ ] 3 anúncios responsivos por grupo (títulos e descrições variados)
- [ ] Lance: CPC manual no início, mudar para tCPA quando tiver 30+ conversões
- [ ] Orçamento diário: R$ [verba_google ÷ 30]
- [ ] Extensões: sitelinks (LP, sobre, contato), chamada (telefone), local`,
    });
  }

  return tasks;
}
