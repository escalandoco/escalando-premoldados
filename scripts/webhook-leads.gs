/**
 * ESCALANDO PREMOLDADOS — Webhook de Leads
 * Versão: 1.0 | 2026-03-04
 *
 * Este script é uma Web App do Google Apps Script que recebe
 * os leads do formulário da LP e registra automaticamente
 * na planilha CRM.
 *
 * Como publicar:
 * 1. Na planilha CRM, vá em Extensões → Apps Script
 * 2. Cole este código em um novo arquivo (webhook-leads.gs)
 * 3. Clique em Implantar → Nova implantação
 * 4. Tipo: Web App
 * 5. Executar como: Eu (sua conta)
 * 6. Quem tem acesso: Qualquer pessoa
 * 7. Copie a URL gerada
 * 8. Cole essa URL no CONFIG.webhookUrl da landing page (lp/index.html)
 */

// ============================================================
// CONFIGURAÇÃO
// ============================================================
const WH_CONFIG = {
  // Aba MESTRE recebe todos os leads
  ABA_MESTRE: 'MESTRE',

  // Mapeamento de produto → nome da aba do cliente
  // Ajustar conforme clientes ativos
  // Ex: 'concrenor' → aba 'CONCRENOR'
  CLIENTES_MAP: {
    // 'slug-do-cliente': 'NOME_DA_ABA',
    // Exemplo: 'concrenor': 'CONCRENOR',
  },

  // Coluna onde começa a inserção no MESTRE (linha após headers = 5)
  PRIMEIRA_LINHA_DADOS: 5,

  // Notificação por email ao receber lead (opcional)
  NOTIFICAR_EMAIL: '',  // ex: 'jon@escalando.co'
};

// ============================================================
// RECEBE POST DA LP
// ============================================================
function doPost(e) {
  try {
    const dados = JSON.parse(e.postData.contents);
    const resultado = _registrarLead(dados);
    return ContentService
      .createTextOutput(JSON.stringify({ success: true, msg: resultado }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log('Erro webhook: ' + err.toString());
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// GET para teste (acesse a URL no browser para confirmar que está no ar)
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      status: 'online',
      app: 'Escalando Premoldados — Webhook Leads',
      timestamp: new Date().toISOString(),
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// REGISTRA LEAD NA PLANILHA
// ============================================================
function _registrarLead(dados) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const agora        = new Date();
  const dataFormatada = Utilities.formatDate(agora, 'America/Sao_Paulo', 'dd/MM/yyyy HH:mm');

  // Detecta canal pela origem
  const canal = _detectarCanal(dados.origem || '');

  // Linha para o MESTRE
  const linhaMestre = [
    dataFormatada,                    // A - Data entrada
    dados.nomeCliente || '',          // B - Cliente (Fábrica) — preenchido manualmente ou via param
    canal,                            // C - Canal
    dados.nome        || '',          // D - Nome do Lead
    dados.whatsapp    || '',          // E - Telefone / WhatsApp
    _extrairCidade(dados.cidade),     // F - Cidade
    _extrairEstado(dados.cidade),     // G - Estado
    _formatarProduto(dados.produto),  // H - Produto de interesse
    'Novo',                           // I - Status
    '',                               // J - Responsável
    '',                               // K - Data último contato
    '',                               // L - Dias sem contato (fórmula)
    '',                               // M - Valor estimado
    dados.origem || '',               // N - Observação
    dados.source  || '',              // O - UTM source
  ];

  // Insere no MESTRE
  const mestreSheet = ss.getSheetByName(WH_CONFIG.ABA_MESTRE);
  if (!mestreSheet) throw new Error('Aba MESTRE não encontrada');

  const ultimaLinha = _proximaLinhaVazia(mestreSheet, WH_CONFIG.PRIMEIRA_LINHA_DADOS);
  mestreSheet.getRange(ultimaLinha, 1, 1, linhaMestre.length).setValues([linhaMestre]);

  // Aplica formatação na nova linha
  mestreSheet.getRange(ultimaLinha, 9).setBackground('#DBEAFE'); // Status "Novo" = azul

  // Tenta inserir na aba do cliente específico (se mapeado)
  let abaClienteMsg = '';
  const nomeCliente = dados.nomeCliente || '';
  const slugCliente = nomeCliente.toLowerCase().replace(/\s+/g, '-');

  if (WH_CONFIG.CLIENTES_MAP[slugCliente]) {
    const nomeAba = WH_CONFIG.CLIENTES_MAP[slugCliente];
    const clienteSheet = ss.getSheetByName(nomeAba);

    if (clienteSheet) {
      const linhaCliente = [
        dataFormatada,
        canal,
        dados.nome        || '',
        dados.whatsapp    || '',
        _extrairCidade(dados.cidade),
        _extrairEstado(dados.cidade),
        _formatarProduto(dados.produto),
        'Novo',
        '',
        '',
        '',
        '',
        dados.origem || '',
        dados.source  || '',
      ];

      const ultimaLinhaCliente = _proximaLinhaVazia(clienteSheet, 7);
      clienteSheet.getRange(ultimaLinhaCliente, 1, 1, linhaCliente.length).setValues([linhaCliente]);
      abaClienteMsg = ` + aba ${nomeAba}`;
    }
  }

  // Notificação por email (opcional)
  if (WH_CONFIG.NOTIFICAR_EMAIL) {
    _enviarNotificacao(dados, dataFormatada);
  }

  return `Lead registrado na linha ${ultimaLinha} do MESTRE${abaClienteMsg}`;
}

// ============================================================
// HELPERS
// ============================================================
function _proximaLinhaVazia(sheet, startRow) {
  const dados = sheet.getRange(startRow, 1, sheet.getLastRow() + 1, 1).getValues();
  for (let i = 0; i < dados.length; i++) {
    if (!dados[i][0]) return startRow + i;
  }
  return startRow;
}

function _detectarCanal(origem) {
  const map = {
    'google':             'Google Ads',
    'instagram':          'Meta Ads',
    'instagram-facebook': 'Meta Ads',
    'facebook':           'Meta Ads',
    'indicacao':          'Indicação',
    'whatsapp':           'WhatsApp Orgânico',
  };
  return map[origem.toLowerCase()] || 'Outro';
}

function _extrairCidade(cidadeEstado) {
  if (!cidadeEstado) return '';
  const partes = cidadeEstado.split(',');
  return partes[0] ? partes[0].trim() : cidadeEstado.trim();
}

function _extrairEstado(cidadeEstado) {
  if (!cidadeEstado) return '';
  const partes = cidadeEstado.split(',');
  return partes[1] ? partes[1].trim().toUpperCase() : '';
}

function _formatarProduto(produto) {
  const map = {
    'cerca-mourao': 'Cerca/Mourão',
    'laje-viga':    'Laje/Viga',
    'bloco-muro':   'Bloco/Muro',
    'outro':        'Outro',
  };
  return map[produto] || produto || '';
}

function _enviarNotificacao(dados, dataHora) {
  const assunto = `🔔 Novo lead — ${dados.empresa || dados.nome} (${_formatarProduto(dados.produto)})`;
  const corpo = `
Novo lead recebido em ${dataHora}:

Nome: ${dados.nome}
Empresa: ${dados.empresa}
Cidade: ${dados.cidade}
Produto: ${_formatarProduto(dados.produto)}
WhatsApp: ${dados.whatsapp}
Como encontrou: ${dados.origem}

Acesse a planilha para registrar o atendimento.
  `.trim();

  GmailApp.sendEmail(WH_CONFIG.NOTIFICAR_EMAIL, assunto, corpo);
}

// ============================================================
// TESTE MANUAL
// Execute esta função para simular um lead de teste
// ============================================================
function testarWebhook() {
  const leadTeste = {
    nome:        'João da Silva',
    empresa:     'Premoldados Silva',
    cidade:      'Ribeirão Preto, SP',
    whatsapp:    '(16) 99999-9999',
    produto:     'cerca-mourao',
    origem:      'google',
    source:      'google-ads',
    nomeCliente: '',
    timestamp:   new Date().toISOString(),
  };

  const resultado = _registrarLead(leadTeste);
  SpreadsheetApp.getUi().alert('✅ Teste concluído!\n\n' + resultado);
}
