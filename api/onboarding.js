/**
 * ESCALANDO PREMOLDADOS — Onboarding API
 * Vercel Serverless Function
 *
 * POST /api/onboarding
 * Body: { action: 'fechamento' | 'kickoff', ...dados }
 */

const CLICKUP_API_KEY    = process.env.CLICKUP_API_KEY;
const SPACE_CLIENTES     = process.env.CLICKUP_SPACE_ID || '901313553858';
const BASE_URL           = 'https://api.clickup.com/api/v2';
const KICKOFF_URL        = (process.env.KICKOFF_URL || 'https://escalando.co/kickoff').trim();
const GOOGLE_WORKSPACE   = (process.env.GOOGLE_WORKSPACE_URL || '').trim();

// ── CUSTOM FIELD IDs (Onboarding list) ───────────────────────
const CF = {
  // Fechamento
  whatsapp:      'c8d8bb6d-656f-4d4b-89c7-d37ce1311bbe',
  cnpj:          '232d32d6-cad3-4bd9-8546-d1b101d795fd',
  responsavel:   '35803d01-c334-4f1a-b402-48c635a53e0b',
  plano:         'ba13b1aa-e9ee-47e3-b51b-2142db7b4fc7',
  plano_opts:    { starter: 'f2eac063-f13f-493a-b07f-e7c09b22fa25', growth: '0b0e41c4-fa0c-4f80-8a9d-65ab2e6d9209', pro: '8a724d88-dc3b-42c6-8355-ed4544b37ad8' },
  valor_mensal:  '38bd0f83-b8f0-4e42-9ad7-29d73b861d88',
  data_inicio:   'a8cc4abf-70a0-4fe0-8f55-41ab7c02f27f',
  // Kickoff
  produtos:      '2198aba2-bf7d-4f33-b74d-fae51053744f',
  area_atuacao:  'a7f39530-56ae-44a8-827e-5fe43b02f295',
  ticket_medio:  'b9bcacfa-fa82-458d-a075-3cd0804d2098',
  verba_mensal:  '06986839-de08-44d7-b9d3-edb37c93aed8',
  acesso_meta:   '836718ae-38fb-466b-9106-aa4e884a4536',
  acesso_google: '9a775a51-e3b7-45f1-b1d0-3abc74b5a23a',
  acesso_gmb:    '49fdbb26-04d6-4ed9-83bc-6477d455600f',
  acesso_site:   'a66f8163-a649-4b4a-abd1-8226a47314d2',
  acesso_opts:   { coletado: null, pendente: null, sem: null }, // resolvidos dinamicamente abaixo
};
// Opções dos dropdowns de acesso (mesmas para todos os 4 campos)
const ACESSO_OPT = { coletado: 0, pendente: 1, sem: 2 }; // orderindex

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
// FORM 1 — FECHAMENTO
// ============================================================
async function processarFechamento(d) {
  // 1. Cria folder do cliente
  const folder = await cu('post', `/space/${SPACE_CLIENTES}/folder`, { name: d.empresa.trim() });

  // 2. Cria listas por plano
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

  // 3. Task: Emitir NF + Contrato
  const nfTask = await cu('post', `/list/${onboarding.id}/task`, {
    name: `Emitir NF + Contrato — ${d.empresa}`,
    description: `**Plano:** ${nomePlano(d.plano)} — R$ ${d.valor}/mês\n**Início:** ${d.dataInicio}`,
    priority: 1,
  });
  // Popula custom fields
  const tsInicio = toTs(d.dataInicio);
  await setFields(nfTask.id, {
    [CF.whatsapp]:     d.whatsapp    || '',
    [CF.cnpj]:         d.cnpj        || '',
    [CF.responsavel]:  d.responsavel || '',
    [CF.valor_mensal]: parseFloat(String(d.valor || 0).replace(/[^\d.]/g, '')) || 0,
    [CF.plano]:        CF.plano_opts[d.plano] || CF.plano_opts.starter,
    ...(tsInicio ? { [CF.data_inicio]: tsInicio } : {}),
  });

  // 4. Task: Marcar Kickoff (com link do Form 2)
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

  // Cria estrutura no Drive (pasta + planilha de leads)
  let drive = {};
  if (GOOGLE_WORKSPACE) {
    try {
      const gRes = await fetch(GOOGLE_WORKSPACE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'criar-cliente', empresa: d.empresa }),
      });
      drive = await gRes.json();

      // Salva link da planilha na task de NF+Contrato
      if (drive.planilhaUrl) {
        const { tasks: taskList } = await cu('get', `/list/${onboarding.id}/task?archived=false`);
        const nfTask = taskList.find(t => t.name.startsWith('Emitir NF'));
        if (nfTask) {
          const descAtual = nfTask.description || '';
          await cu('put', `/task/${nfTask.id}`, {
            description: descAtual + `\n\n📊 **Planilha de Leads:** ${drive.planilhaUrl}\n📁 **Drive:** ${drive.pastaDriveUrl}`,
          });
        }
      }
    } catch (err) {
      drive = { error: err.message };
    }
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

  // Busca lista Onboarding
  const { lists } = await cu('get', `/folder/${folder.id}/list?archived=false`);
  const onboarding = lists.find(l => l.name === 'Onboarding');
  if (!onboarding) throw new Error('Lista Onboarding não encontrada.');

  // Busca task "Marcar Kickoff"
  const { tasks } = await cu('get', `/list/${onboarding.id}/task?archived=false`);
  const kickoffTask = tasks.find(t => t.name.toLowerCase().startsWith('marcar kickoff'));
  if (!kickoffTask) throw new Error('Task "Marcar Kickoff" não encontrada.');

  // Seta custom fields com os dados do briefing
  await setFields(kickoffTask.id, {
    [CF.produtos]:      (d.produtos || '').slice(0, 200),
    [CF.area_atuacao]:  d.areaAtuacao  || '',
    [CF.ticket_medio]:  parseFloat(String(d.ticketMedio || 0).replace(/[^\d.]/g, '')) || 0,
    [CF.verba_mensal]:  parseFloat(String(d.verba       || 0).replace(/[^\d.]/g, '')) || 0,
    [CF.acesso_meta]:   acessoOpt(d.acessoMeta),
    [CF.acesso_google]: acessoOpt(d.acessoGoogle),
    [CF.acesso_gmb]:    acessoOpt(d.acessoGmb),
    [CF.acesso_site]:   acessoOpt(d.acessoSite),
  });

  // Mantém comentário com detalhes completos (diferenciais, depoimentos, obs)
  const comentario = [
    `📋 **Briefing de Kickoff — ${d.empresa}**`,
    ``,
    `**Produtos:** ${d.produtos}`,
    d.diferenciais    ? `**Diferenciais:** ${d.diferenciais}` : '',
    d.perfilClientes  ? `**Perfil dos clientes:** ${d.perfilClientes}` : '',
    d.comoVendem      ? `**Como vendem hoje:** ${d.comoVendem}` : '',
    d.concorrentes    ? `**Concorrentes:** ${d.concorrentes}` : '',
    d.obs             ? `**Observações:** ${d.obs}` : '',
  ].filter(Boolean).join('\n');

  await cu('post', `/task/${kickoffTask.id}/comment`, { comment_text: comentario });

  return { msg: `Briefing registrado para ${d.empresa}` };
}

// ============================================================
// NOVO LEAD — Registra lead na planilha do cliente
// ============================================================
async function processarNovoLead(d) {
  if (!GOOGLE_WORKSPACE) throw new Error('Google Workspace não configurado.');
  const res = await fetch(GOOGLE_WORKSPACE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'novo-lead', ...d }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Erro ao registrar lead.');
  return { msg: json.msg };
}

// ============================================================
// LP BRIEFING — Salva briefing no Drive + cria task no ClickUp
// ============================================================
async function processarLpBriefing(d) {
  // 1. Salva dados no Drive via Apps Script
  if (GOOGLE_WORKSPACE) {
    try {
      await fetch(GOOGLE_WORKSPACE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'salvar-lp-briefing', ...d }),
      });
    } catch (_) {}
  }

  // 2. Busca folder do cliente no ClickUp
  const { folders } = await cu('get', `/space/${SPACE_CLIENTES}/folder?archived=false`);
  const folder = folders.find(f => f.name.toLowerCase() === d.empresa.toLowerCase());
  if (!folder) throw new Error(`Folder "${d.empresa}" não encontrado no ClickUp.`);

  // 3. Busca lista Onboarding
  const { lists } = await cu('get', `/folder/${folder.id}/list?archived=false`);
  const onboarding = lists.find(l => l.name === 'Onboarding');
  if (!onboarding) throw new Error('Lista Onboarding não encontrada.');

  // 4. Monta descrição da task
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

  const lpLabel = d.lp_nome ? ` (${d.lp_nome})` : '';
  return { msg: `Briefing de LP${lpLabel} recebido para ${d.empresa}. Task criada no ClickUp.` };
}

// ============================================================
// NOVO ORÇAMENTO — Registra orçamento na planilha do cliente
// ============================================================
async function processarNovoOrcamento(d) {
  if (!GOOGLE_WORKSPACE) throw new Error('Google Workspace não configurado.');
  const res = await fetch(GOOGLE_WORKSPACE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'novo-orcamento', ...d }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Erro ao registrar orçamento.');
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
    { nome: 'S1 — Enviar roteiro de fotos ao cliente', desc: 'docs/playbooks/roteiro-fotos.md', prioridade: 2 },
    { nome: 'S1 — Coletar acessos (Meta, Google, GMB, site)' },
    { nome: 'S2 — Configurar LP', desc: 'Checklist: logo, cores, produto, webhook, mobile' },
    { nome: 'S2 — Configurar GMB (15 itens)', desc: 'Categoria, fotos, horários, produtos, posts' },
    { nome: 'S2 — Configurar CRM/Sheets', desc: 'Rodar setup-crm.gs, publicar webhook, testar lead' },
    { nome: 'S2 — Configurar Tintim', desc: 'Rastreio de leads via WhatsApp' },
    { nome: 'S2 — Briefing de criativos ao designer' },
    { nome: 'Go-live — Checklist antes de ligar campanhas', prioridade: 2 },
    { nome: 'Go-live — Notificar primeiro lead ao cliente' },
  ];

  if (plano === 'growth' || plano === 'pro') {
    tasks.splice(4, 0, { nome: 'S2 — Configurar Meta Ads', desc: 'Conta, pixel, públicos, campanha inicial' });
  }
  if (plano === 'pro') {
    tasks.splice(5, 0, { nome: 'S2 — Configurar Google Ads', desc: 'Conta, conversões, campanha Search local' });
  }

  return tasks;
}
