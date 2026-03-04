/**
 * ESCALANDO PREMOLDADOS — Onboarding ClickUp
 * Versão: 1.0 | 2026-03-04
 *
 * Web App que processa os dois formulários de onboarding:
 * - action: 'fechamento' → cria toda a estrutura do cliente no ClickUp
 * - action: 'kickoff'    → adiciona briefing completo na task do cliente
 *
 * Como publicar:
 * 1. Extensões → Apps Script → cole este código
 * 2. Em Project Settings → Script Properties, adicione:
 *    CLICKUP_API_KEY = pk_84613660_Y5NTPRP7ZLIRVYYAM6QBX7DXTOL91GTV
 *    KICKOFF_URL     = https://escalando.co/kickoff (URL do Form 2 após deploy)
 * 3. Implantar → Nova implantação → Web App
 *    Executar como: Eu | Acesso: Qualquer pessoa
 * 4. Copiar URL e colar nos CONFIG das duas páginas HTML
 */

// ============================================================
// IDs DO CLICKUP (não alterar)
// ============================================================
const CU = {
  SPACE_CLIENTES: '901313340318',
  BASE_URL: 'https://api.clickup.com/api/v2',
};

// ============================================================
// PONTO DE ENTRADA
// ============================================================
function doPost(e) {
  try {
    const dados = JSON.parse(e.postData.contents);
    let resultado;

    if (dados.action === 'fechamento') {
      resultado = _processarFechamento(dados);
    } else if (dados.action === 'kickoff') {
      resultado = _processarKickoff(dados);
    } else {
      throw new Error('action inválida: ' + dados.action);
    }

    return _jsonOk(resultado);
  } catch (err) {
    Logger.log('Erro: ' + err.toString());
    return _jsonErr(err.toString());
  }
}

function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'online', app: 'Onboarding ClickUp' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// FORM 1 — FECHAMENTO
// Cria toda a estrutura do cliente no ClickUp
// ============================================================
function _processarFechamento(d) {
  const apiKey  = PropertiesService.getScriptProperties().getProperty('CLICKUP_API_KEY');
  const kickUrl = PropertiesService.getScriptProperties().getProperty('KICKOFF_URL') || '[URL do kickoff]';

  // 1. Criar folder do cliente no Space CLIENTES
  const folderName = d.empresa.trim();
  const folder = _criarFolder(apiKey, CU.SPACE_CLIENTES, folderName);
  const folderId = folder.id;

  // 2. Criar lista Onboarding (todos os planos)
  const listaOnboarding = _criarLista(apiKey, folderId, 'Onboarding');

  // 3. Criar listas condicionais por plano
  _criarLista(apiKey, folderId, 'GMB');
  _criarLista(apiKey, folderId, 'Landing Pages');
  _criarLista(apiKey, folderId, 'CRM — Leads');

  if (d.plano === 'growth' || d.plano === 'pro') {
    _criarLista(apiKey, folderId, 'Meta Ads');
  }
  if (d.plano === 'pro') {
    _criarLista(apiKey, folderId, 'Google Ads');
  }

  // 4. Criar tasks na lista Onboarding
  const onbId = listaOnboarding.id;
  const nomeCliente = d.empresa;

  // Task: NF + Contrato
  const descNF = [
    `**Cliente:** ${d.empresa}`,
    `**CNPJ:** ${d.cnpj}`,
    `**Responsável:** ${d.responsavel}`,
    `**WhatsApp:** ${d.whatsapp}`,
    `**Plano:** ${_nomePlano(d.plano)} — R$ ${d.valor}/mês`,
    `**Início:** ${d.dataInicio}`,
    '',
    '---',
    'Usar esses dados para emitir NF e preparar o contrato.',
  ].join('\n');

  _criarTask(apiKey, onbId, `Emitir NF + Contrato — ${nomeCliente}`, descNF, 'urgent');

  // Task: Marcar Kickoff
  const descKickoff = [
    `**Cliente:** ${nomeCliente}`,
    `**WhatsApp:** ${d.whatsapp}`,
    '',
    `Preencher o formulário de briefing junto com o cliente durante a reunião:`,
    `👉 ${kickUrl}?cliente=${encodeURIComponent(nomeCliente)}`,
  ].join('\n');

  _criarTask(apiKey, onbId, `Marcar Kickoff — ${nomeCliente}`, descKickoff, 'high');

  // Tasks do checklist de onboarding (21 dias)
  const checklistTasks = _getChecklistTasks(d.plano, nomeCliente);
  for (const t of checklistTasks) {
    _criarTask(apiKey, onbId, t.nome, t.desc, t.prioridade || 'normal');
  }

  return {
    msg: `Estrutura criada para ${nomeCliente} (${_nomePlano(d.plano)})`,
    folderId,
    listas: ['Onboarding', 'GMB', 'Landing Pages', 'CRM — Leads',
             ...(d.plano !== 'starter' ? ['Meta Ads'] : []),
             ...(d.plano === 'pro' ? ['Google Ads'] : [])],
  };
}

// ============================================================
// FORM 2 — KICKOFF
// Cria task com o briefing completo na lista Onboarding
// ============================================================
function _processarKickoff(d) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('CLICKUP_API_KEY');

  // Busca o folder do cliente pelo nome
  const folders = _listarFolders(apiKey, CU.SPACE_CLIENTES);
  const folder   = folders.find(f => f.name.toLowerCase() === d.empresa.toLowerCase());

  if (!folder) throw new Error(`Folder "${d.empresa}" não encontrado no ClickUp.`);

  // Busca a lista Onboarding dentro do folder
  const listas  = _listarListas(apiKey, folder.id);
  const onb     = listas.find(l => l.name === 'Onboarding');

  if (!onb) throw new Error('Lista Onboarding não encontrada.');

  const desc = [
    `## Briefing de Kickoff — ${d.empresa}`,
    '',
    `**Produtos principais:** ${d.produtos}`,
    `**Diferenciais:** ${d.diferenciais}`,
    `**Área de atuação:** ${d.areaAtuacao}`,
    `**Perfil dos clientes:** ${d.perfilClientes}`,
    `**Ticket médio:** R$ ${d.ticketMedio}`,
    `**Como vendem hoje:** ${d.comoVendem}`,
    d.verba ? `**Verba mensal (anúncios):** R$ ${d.verba}` : '',
    '',
    '### Acessos necessários',
    `- Meta Business: ${d.acessoMeta || 'pendente'}`,
    `- Google Ads: ${d.acessoGoogle || 'pendente'}`,
    `- GMB: ${d.acessoGmb || 'pendente'}`,
    `- Site/Hospedagem: ${d.acessoSite || 'pendente'}`,
    '',
    `**Observações:** ${d.obs || '—'}`,
  ].filter(Boolean).join('\n');

  _criarTask(apiKey, onb.id, `Briefing Completo — ${d.empresa}`, desc, 'high');

  return { msg: `Briefing de kickoff registrado para ${d.empresa}` };
}

// ============================================================
// HELPERS — CLICKUP API
// ============================================================
function _req(apiKey, method, path, body) {
  const opts = {
    method,
    headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
    muteHttpExceptions: true,
  };
  if (body) opts.payload = JSON.stringify(body);
  const res  = UrlFetchApp.fetch(CU.BASE_URL + path, opts);
  const json = JSON.parse(res.getContentText());
  if (res.getResponseCode() >= 400) throw new Error(JSON.stringify(json));
  return json;
}

function _criarFolder(apiKey, spaceId, name) {
  return _req(apiKey, 'post', `/space/${spaceId}/folder`, { name });
}

function _criarLista(apiKey, folderId, name) {
  return _req(apiKey, 'post', `/folder/${folderId}/list`, { name });
}

function _criarTask(apiKey, listId, name, description, priority) {
  const prioMap = { urgent: 1, high: 2, normal: 3, low: 4 };
  return _req(apiKey, 'post', `/list/${listId}/task`, {
    name,
    description,
    priority: prioMap[priority] || 3,
  });
}

function _listarFolders(apiKey, spaceId) {
  return _req(apiKey, 'get', `/space/${spaceId}/folder?archived=false`).folders || [];
}

function _listarListas(apiKey, folderId) {
  return _req(apiKey, 'get', `/folder/${folderId}/list?archived=false`).lists || [];
}

// ============================================================
// CHECKLIST DE ONBOARDING (21 dias)
// ============================================================
function _getChecklistTasks(plano, cliente) {
  const base = [
    { nome: `S1 — Enviar roteiro de fotos ao cliente`, desc: 'PDF: docs/playbooks/roteiro-fotos.md', prioridade: 'high' },
    { nome: `S1 — Coletar acessos necessários`, desc: 'Meta Business, Google Ads, GMB, site/hospedagem' },
    { nome: `S2 — Configurar LP`, desc: 'Checklist: logo, cores, produto, webhook CRM, mobile test' },
    { nome: `S2 — Configurar GMB (15 itens)`, desc: 'Categoria, fotos, horários, produtos, posts' },
    { nome: `S2 — Configurar CRM/Sheets`, desc: 'Rodar setup-crm.gs, publicar webhook, testar lead de teste' },
    { nome: `S2 — Configurar Tintim`, desc: 'Rastreio de leads via WhatsApp' },
    { nome: `S2 — Briefing de criativos ao designer`, desc: 'Usar template: onboarding.md seção 3.6' },
    { nome: `Go-live — Checklist antes de ligar campanhas`, desc: 'LP no ar, pixel instalado, webhook funcionando, CRM pronto' },
    { nome: `Go-live — Notificar primeiro lead ao cliente`, desc: 'Usar template de mensagem: onboarding.md seção 6.4' },
  ];

  if (plano === 'growth' || plano === 'pro') {
    base.splice(4, 0, { nome: `S2 — Configurar Meta Ads`, desc: 'Conta de anúncios, pixel, públicos, campanha inicial' });
  }
  if (plano === 'pro') {
    base.splice(5, 0, { nome: `S2 — Configurar Google Ads`, desc: 'Conta, conversões, campanha Search local' });
  }

  return base;
}

// ============================================================
// HELPERS — RESPOSTA
// ============================================================
function _nomePlano(slug) {
  return { starter: 'Starter', growth: 'Growth', pro: 'Pro' }[slug] || slug;
}

function _jsonOk(data) {
  return ContentService
    .createTextOutput(JSON.stringify({ success: true, ...data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function _jsonErr(msg) {
  return ContentService
    .createTextOutput(JSON.stringify({ success: false, error: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// TESTE MANUAL
// Execute para simular fechamento de um cliente
// ============================================================
function testarFechamento() {
  const dados = {
    action:     'fechamento',
    empresa:    'Premoldados Silva',
    cnpj:       '12.345.678/0001-99',
    responsavel:'João Silva',
    whatsapp:   '(16) 99999-9999',
    plano:      'growth',
    valor:      '1497',
    dataInicio: '01/04/2026',
  };
  const resultado = _processarFechamento(dados);
  SpreadsheetApp.getUi().alert('✅ Teste OK!\n\n' + JSON.stringify(resultado, null, 2));
}
