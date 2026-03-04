/**
 * ESCALANDO PREMOLDADOS — Setup CRM Google Sheets
 * Versão: 1.0 | 2026-03-04
 *
 * Como usar:
 * 1. Abra o Google Sheets (planilha em branco)
 * 2. Extensões → Apps Script
 * 3. Cole este código e salve
 * 4. Execute a função setupCRM()
 * 5. Autorize as permissões solicitadas
 *
 * O script cria automaticamente:
 *   - Aba MESTRE (consolidado de todos os clientes)
 *   - Aba TEMPLATE_CLIENTE (duplicar para cada novo cliente)
 *   - Aba DASHBOARD (visão executiva)
 */

// ============================================================
// CONFIGURAÇÃO
// ============================================================
const CONFIG = {
  STATUS_OPTIONS: ['Novo', 'Contatado', 'Em negociação', 'Fechado', 'Perdido', 'Sem qualidade'],
  CANAIS: ['Meta Ads', 'Google Ads', 'GMB', 'Indicação', 'WhatsApp Orgânico', 'Outro'],
  PRODUTOS: ['Cerca/Mourão', 'Laje/Viga', 'Bloco/Muro', 'Outro'],

  CORES: {
    HEADER_BG:    '#1C1C1C',
    HEADER_TEXT:  '#FFFFFF',
    NOVO:         '#DBEAFE',  // azul claro
    CONTATADO:    '#FEF9C3',  // amarelo claro
    NEGOCIACAO:   '#FEF3C7',  // laranja claro
    FECHADO:      '#DCFCE7',  // verde claro
    PERDIDO:      '#FEE2E2',  // vermelho claro
    SEM_QUAL:     '#F3F4F6',  // cinza claro
    ACCENT:       '#E85110',  // laranja Escalando
  },

  COLUNAS_MESTRE: [
    'Data entrada',
    'Cliente (Fábrica)',
    'Canal',
    'Nome do Lead',
    'Telefone / WhatsApp',
    'Cidade',
    'Estado',
    'Produto de interesse',
    'Status',
    'Responsável (cliente)',
    'Data último contato',
    'Dias sem contato',
    'Valor estimado (R$)',
    'Observação',
    'Origem (utm_source)',
  ],

  COLUNAS_CLIENTE: [
    'Data entrada',
    'Canal',
    'Nome do Lead',
    'Telefone / WhatsApp',
    'Cidade',
    'Estado',
    'Produto de interesse',
    'Status',
    'Responsável',
    'Data último contato',
    'Dias sem contato',
    'Valor estimado (R$)',
    'Observação',
    'Origem (utm)',
  ],
};

// ============================================================
// FUNÇÃO PRINCIPAL
// ============================================================
function setupCRM() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Remove abas padrão se existirem
  _removeDefaultSheets(ss);

  // Cria as abas
  const mestre    = _criarMestre(ss);
  const template  = _criarTemplateCliente(ss);
  const dashboard = _criarDashboard(ss);

  // Reordena abas
  ss.setActiveSheet(mestre);
  ss.moveActiveSheet(1);
  ss.setActiveSheet(dashboard);
  ss.moveActiveSheet(2);
  ss.setActiveSheet(template);
  ss.moveActiveSheet(3);

  // Volta para o dashboard
  ss.setActiveSheet(dashboard);

  SpreadsheetApp.getUi().alert(
    '✅ CRM configurado com sucesso!\n\n' +
    '• MESTRE — consolidado de todos os clientes\n' +
    '• DASHBOARD — visão executiva\n' +
    '• TEMPLATE_CLIENTE — duplicar para cada novo cliente\n\n' +
    'Para adicionar um cliente: clique com botão direito em TEMPLATE_CLIENTE → Duplicar → Renomear com o nome do cliente.'
  );
}

// ============================================================
// ABA MESTRE
// ============================================================
function _criarMestre(ss) {
  let sheet = ss.getSheetByName('MESTRE');
  if (sheet) ss.deleteSheet(sheet);
  sheet = ss.insertSheet('MESTRE');

  // Título
  sheet.getRange('A1').setValue('ESCALANDO PREMOLDADOS — CRM MESTRE');
  sheet.getRange('A1').setFontSize(13).setFontWeight('bold').setFontColor(CONFIG.CORES.ACCENT);
  sheet.getRange('A1:O1').merge();

  // Subtítulo com data de atualização
  sheet.getRange('A2').setFormula('="Atualizado em: " & TEXT(NOW(),"DD/MM/YYYY HH:MM")');
  sheet.getRange('A2').setFontSize(9).setFontColor('#666666').setFontStyle('italic');
  sheet.getRange('A2:O2').merge();

  // Headers (linha 4)
  const headerRange = sheet.getRange(4, 1, 1, CONFIG.COLUNAS_MESTRE.length);
  headerRange.setValues([CONFIG.COLUNAS_MESTRE]);
  headerRange.setBackground(CONFIG.CORES.HEADER_BG)
             .setFontColor(CONFIG.CORES.HEADER_TEXT)
             .setFontWeight('bold')
             .setFontSize(10);

  // Congelar linhas de cabeçalho
  sheet.setFrozenRows(4);
  sheet.setFrozenColumns(2);

  // Larguras das colunas
  const larguras = [110, 160, 110, 160, 140, 110, 80, 130, 110, 160, 130, 100, 120, 200, 130];
  larguras.forEach((w, i) => sheet.setColumnWidth(i + 1, w));

  // Validação: Status (coluna I = 9)
  _addDropdown(sheet, 5, 9, 500, CONFIG.STATUS_OPTIONS);

  // Validação: Canal (coluna C = 3)
  _addDropdown(sheet, 5, 3, 500, CONFIG.CANAIS);

  // Validação: Produto (coluna H = 8)
  _addDropdown(sheet, 5, 8, 500, CONFIG.PRODUTOS);

  // Formatação condicional por Status
  _addConditionalFormatting(sheet, 5, 9, 500);

  // Fórmula: Dias sem contato (coluna L = 12)
  for (let i = 5; i <= 504; i++) {
    sheet.getRange(i, 12).setFormula(
      `=IF(K${i}="","",IF(I${i}="Fechado","—",INT(TODAY()-K${i})))`
    );
    sheet.getRange(i, 12).setFontColor('#888888').setHorizontalAlignment('center');
  }

  // Linha de totais fixos no topo (linha 3)
  sheet.getRange('A3').setValue('TOTAL LEADS →');
  sheet.getRange('A3').setFontWeight('bold').setFontSize(9).setFontColor(CONFIG.CORES.ACCENT);
  sheet.getRange('B3').setFormula('=COUNTA(B5:B504)');
  sheet.getRange('B3').setFontWeight('bold').setFontColor(CONFIG.CORES.ACCENT);

  sheet.getRange('C3').setValue('Fechados:');
  sheet.getRange('C3').setFontSize(9).setFontColor('#16A34A');
  sheet.getRange('D3').setFormula('=COUNTIF(I5:I504,"Fechado")');
  sheet.getRange('D3').setFontWeight('bold').setFontColor('#16A34A');

  sheet.getRange('E3').setValue('Perdidos:');
  sheet.getRange('E3').setFontSize(9).setFontColor('#DC2626');
  sheet.getRange('F3').setFormula('=COUNTIF(I5:I504,"Perdido")');
  sheet.getRange('F3').setFontWeight('bold').setFontColor('#DC2626');

  sheet.getRange('G3').setValue('Taxa fechamento:');
  sheet.getRange('G3').setFontSize(9);
  sheet.getRange('H3').setFormula('=IF(B3=0,"—",TEXT(D3/B3,"0%"))');
  sheet.getRange('H3').setFontWeight('bold');

  // Bordas nos headers
  headerRange.setBorder(true, true, true, true, true, true, '#333333', SpreadsheetApp.BorderStyle.SOLID);

  // Linha de totais com fundo leve
  sheet.getRange('A3:O3').setBackground('#FFF7ED');

  return sheet;
}

// ============================================================
// ABA TEMPLATE_CLIENTE
// ============================================================
function _criarTemplateCliente(ss) {
  let sheet = ss.getSheetByName('TEMPLATE_CLIENTE');
  if (sheet) ss.deleteSheet(sheet);
  sheet = ss.insertSheet('TEMPLATE_CLIENTE');

  // Cabeçalho
  sheet.getRange('A1').setValue('CRM — [NOME DO CLIENTE]');
  sheet.getRange('A1').setFontSize(13).setFontWeight('bold').setFontColor(CONFIG.CORES.ACCENT);
  sheet.getRange('A1:N1').merge();

  sheet.getRange('A2').setFormula('="Período: " & TEXT(DATE(YEAR(TODAY()),MONTH(TODAY()),1),"MMMM/YYYY") & "  |  Atualizado: " & TEXT(NOW(),"DD/MM HH:MM")');
  sheet.getRange('A2').setFontSize(9).setFontColor('#666666').setFontStyle('italic');
  sheet.getRange('A2:N2').merge();

  // Métricas rápidas (linha 3)
  const metricas = [
    ['Total leads', '=COUNTA(A6:A505)'],
    ['Fechados',    '=COUNTIF(H6:H505,"Fechado")'],
    ['Perdidos',    '=COUNTIF(H6:H505,"Perdido")'],
    ['Taxa conv.',  '=IF(B3=0,"—",TEXT(C3/B3,"0%"))'],
    ['CPL médio',   '=IF(B3=0,"—","R$ "&TEXT(IFERROR(VLOOKUP("CPL",Dashboard_Info!A:B,2,0),0),"#,##0.00"))'],
  ];

  metricas.forEach(([label, formula], i) => {
    const col = i * 2 + 1;
    sheet.getRange(3, col).setValue(label).setFontSize(8).setFontColor('#666666');
    sheet.getRange(4, col).setFormula(formula).setFontSize(14).setFontWeight('bold').setFontColor(CONFIG.CORES.ACCENT);
    sheet.getRange(3, col, 2, 1).setBorder(false, false, false, true, false, false, '#E5E7EB', SpreadsheetApp.BorderStyle.SOLID);
  });

  // Linha em branco
  sheet.getRange('A5:N5').setBackground('#F9FAFB');

  // Headers (linha 6)
  const headerRange = sheet.getRange(6, 1, 1, CONFIG.COLUNAS_CLIENTE.length);
  headerRange.setValues([CONFIG.COLUNAS_CLIENTE]);
  headerRange.setBackground(CONFIG.CORES.HEADER_BG)
             .setFontColor(CONFIG.CORES.HEADER_TEXT)
             .setFontWeight('bold')
             .setFontSize(10);

  sheet.setFrozenRows(6);
  sheet.setFrozenColumns(1);

  // Larguras
  const larguras = [110, 110, 160, 140, 110, 80, 130, 110, 160, 130, 100, 120, 200, 130];
  larguras.forEach((w, i) => sheet.setColumnWidth(i + 1, w));

  // Validações
  _addDropdown(sheet, 7, 8, 500, CONFIG.STATUS_OPTIONS);   // Status col H
  _addDropdown(sheet, 7, 2, 500, CONFIG.CANAIS);            // Canal col B
  _addDropdown(sheet, 7, 7, 500, CONFIG.PRODUTOS);          // Produto col G

  // Formatação condicional por Status
  _addConditionalFormatting(sheet, 7, 8, 500);

  // Dias sem contato (coluna K = 11)
  for (let i = 7; i <= 506; i++) {
    sheet.getRange(i, 11).setFormula(
      `=IF(J${i}="","",IF(H${i}="Fechado","—",INT(TODAY()-J${i})))`
    );
    sheet.getRange(i, 11).setFontColor('#888888').setHorizontalAlignment('center');
  }

  // Formatação data col A
  sheet.getRange('A7:A506').setNumberFormat('DD/MM/YYYY');
  sheet.getRange('J7:J506').setNumberFormat('DD/MM/YYYY');

  // Tab color
  sheet.setTabColor('#6366F1');

  return sheet;
}

// ============================================================
// ABA DASHBOARD
// ============================================================
function _criarDashboard(ss) {
  let sheet = ss.getSheetByName('DASHBOARD');
  if (sheet) ss.deleteSheet(sheet);
  sheet = ss.insertSheet('DASHBOARD');

  sheet.getRange('A1').setValue('DASHBOARD — ESCALANDO PREMOLDADOS');
  sheet.getRange('A1').setFontSize(15).setFontWeight('bold').setFontColor(CONFIG.CORES.ACCENT);
  sheet.getRange('A1:H1').merge();

  sheet.getRange('A2').setFormula('="Gerado em: " & TEXT(NOW(),"DD/MM/YYYY HH:MM")');
  sheet.getRange('A2').setFontSize(9).setFontColor('#666666').setFontStyle('italic');

  // Seção: Resumo Geral (linha 4)
  sheet.getRange('A4').setValue('RESUMO GERAL — MÊS ATUAL');
  sheet.getRange('A4').setFontWeight('bold').setFontSize(11).setFontColor('#111827');
  sheet.getRange('A4:H4').setBackground('#F3F4F6').setBorder(false, false, true, false, false, false, '#D1D5DB', SpreadsheetApp.BorderStyle.SOLID);

  const resumoLabels = ['Total leads', 'Novos', 'Em andamento', 'Fechados', 'Perdidos', 'Sem qualidade', 'Taxa conv.', 'Dias médio resposta'];
  resumoLabels.forEach((label, i) => {
    sheet.getRange(5, i + 1).setValue(label).setFontSize(8).setFontColor('#6B7280').setFontWeight('bold');
    sheet.getRange(5, i + 1).setBackground('#F9FAFB');
  });

  // Fórmulas do resumo — puxam da aba MESTRE
  sheet.getRange('A6').setFormula('=COUNTA(MESTRE!B5:B504)');
  sheet.getRange('B6').setFormula('=COUNTIF(MESTRE!I5:I504,"Novo")');
  sheet.getRange('C6').setFormula('=COUNTIF(MESTRE!I5:I504,"Em negociação")+COUNTIF(MESTRE!I5:I504,"Contatado")');
  sheet.getRange('D6').setFormula('=COUNTIF(MESTRE!I5:I504,"Fechado")');
  sheet.getRange('E6').setFormula('=COUNTIF(MESTRE!I5:I504,"Perdido")');
  sheet.getRange('F6').setFormula('=COUNTIF(MESTRE!I5:I504,"Sem qualidade")');
  sheet.getRange('G6').setFormula('=IF(A6=0,"—",TEXT(D6/A6,"0.0%"))');
  sheet.getRange('H6').setFormula('=IF(D6=0,"—",TEXT(AVERAGEIF(MESTRE!I5:I504,"Fechado",MESTRE!L5:L504),"0")&" dias")');

  sheet.getRange('A6:H6').setFontSize(14).setFontWeight('bold').setHorizontalAlignment('center');
  sheet.getRange('D6').setFontColor('#16A34A');
  sheet.getRange('E6').setFontColor('#DC2626');
  sheet.getRange('G6').setFontColor(CONFIG.CORES.ACCENT);

  // Seção: Leads por canal (linha 9)
  sheet.getRange('A9').setValue('LEADS POR CANAL');
  sheet.getRange('A9').setFontWeight('bold').setFontSize(11);
  sheet.getRange('A9:C9').setBackground('#F3F4F6');

  sheet.getRange('A10:C10').setValues([['Canal', 'Total', '% do total']]);
  sheet.getRange('A10:C10').setFontWeight('bold').setFontSize(9).setBackground('#1C1C1C').setFontColor('#FFFFFF');

  CONFIG.CANAIS.forEach((canal, i) => {
    const row = 11 + i;
    sheet.getRange(row, 1).setValue(canal);
    sheet.getRange(row, 2).setFormula(`=COUNTIF(MESTRE!C5:C504,"${canal}")`);
    sheet.getRange(row, 3).setFormula(`=IF($A6=0,"—",TEXT(B${row}/$A$6,"0%"))`);
  });

  sheet.setColumnWidth(1, 160);
  sheet.setColumnWidth(2, 80);
  sheet.setColumnWidth(3, 80);

  // Seção: Leads por status detalhado (linha 9, colunas E-G)
  sheet.getRange('E9').setValue('LEADS POR STATUS');
  sheet.getRange('E9').setFontWeight('bold').setFontSize(11);
  sheet.getRange('E9:G9').setBackground('#F3F4F6');

  sheet.getRange('E10:G10').setValues([['Status', 'Qtd', '% do total']]);
  sheet.getRange('E10:G10').setFontWeight('bold').setFontSize(9).setBackground('#1C1C1C').setFontColor('#FFFFFF');

  CONFIG.STATUS_OPTIONS.forEach((status, i) => {
    const row = 11 + i;
    sheet.getRange(row, 5).setValue(status);
    sheet.getRange(row, 6).setFormula(`=COUNTIF(MESTRE!I5:I504,"${status}")`);
    sheet.getRange(row, 7).setFormula(`=IF($A$6=0,"—",TEXT(F${row}/$A$6,"0%"))`);
  });

  [5, 6, 7].forEach(col => sheet.setColumnWidth(col, col === 5 ? 140 : 80));

  // Instruções de uso (linha 20)
  sheet.getRange('A20').setValue('📋 COMO USAR ESTE CRM');
  sheet.getRange('A20').setFontWeight('bold').setFontSize(11).setFontColor(CONFIG.CORES.ACCENT);

  const instrucoes = [
    ['1.', 'Novo lead chega → adicionar na aba MESTRE e na aba do cliente específico'],
    ['2.', 'Atualizar Status conforme evolução: Novo → Contatado → Em negociação → Fechado ou Perdido'],
    ['3.', 'Sempre preencher "Data último contato" — coluna "Dias sem contato" calcula automaticamente'],
    ['4.', 'Novo cliente? Duplicar aba TEMPLATE_CLIENTE e renomear com nome do cliente'],
    ['5.', 'Dashboard atualiza automaticamente — compartilhar com cliente somente a aba dele (leitura)'],
    ['6.', 'Leads do formulário LP entram automaticamente via webhook (ver script webhook-leads.gs)'],
  ];

  instrucoes.forEach(([num, texto], i) => {
    sheet.getRange(21 + i, 1).setValue(num).setFontWeight('bold').setFontColor(CONFIG.CORES.ACCENT);
    sheet.getRange(21 + i, 2).setValue(texto).setFontColor('#374151');
    sheet.getRange(21 + i, 2, 1, 7).merge();
  });

  sheet.setTabColor(CONFIG.CORES.ACCENT);

  return sheet;
}

// ============================================================
// HELPERS
// ============================================================
function _addDropdown(sheet, startRow, col, numRows, options) {
  const range = sheet.getRange(startRow, col, numRows, 1);
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(options, true)
    .setAllowInvalid(false)
    .build();
  range.setDataValidation(rule);
}

function _addConditionalFormatting(sheet, startRow, statusCol, numRows) {
  const range = sheet.getRange(startRow, 1, numRows, 15);
  const col   = String.fromCharCode(64 + statusCol); // ex: col 9 = I, col 8 = H

  const rules = [
    { status: 'Novo',           color: CONFIG.CORES.NOVO },
    { status: 'Contatado',      color: CONFIG.CORES.CONTATADO },
    { status: 'Em negociação',  color: CONFIG.CORES.NEGOCIACAO },
    { status: 'Fechado',        color: CONFIG.CORES.FECHADO },
    { status: 'Perdido',        color: CONFIG.CORES.PERDIDO },
    { status: 'Sem qualidade',  color: CONFIG.CORES.SEM_QUAL },
  ];

  const cfRules = rules.map(({ status, color }) =>
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(`=$${col}${startRow}="${status}"`)
      .setBackground(color)
      .setRanges([range])
      .build()
  );

  sheet.setConditionalFormatRules(cfRules);
}

function _removeDefaultSheets(ss) {
  // Cria aba temporária para não ficar sem abas
  let temp = ss.insertSheet('_temp_');

  ['Plan1', 'Sheet1', 'Página1', 'Folha1'].forEach(name => {
    const s = ss.getSheetByName(name);
    if (s) ss.deleteSheet(s);
  });
}

// ============================================================
// ADICIONAR NOVO CLIENTE
// Executa após setupCRM() para cada novo cliente
// ============================================================
function adicionarCliente() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt('Novo cliente', 'Digite o nome do cliente (ex: Concrenor):', ui.ButtonSet.OK_CANCEL);

  if (response.getSelectedButton() !== ui.Button.OK) return;

  const nome = response.getResponseText().trim().toUpperCase();
  if (!nome) return ui.alert('Nome inválido.');

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const template = ss.getSheetByName('TEMPLATE_CLIENTE');

  if (!template) return ui.alert('Aba TEMPLATE_CLIENTE não encontrada. Execute setupCRM() primeiro.');

  const novaAba = template.copyTo(ss);
  novaAba.setName(nome);

  // Atualiza título da aba
  novaAba.getRange('A1').setValue(`CRM — ${nome}`);

  // Cor da aba
  novaAba.setTabColor('#16A34A');

  // Move para antes do TEMPLATE
  const templateIndex = ss.getSheets().findIndex(s => s.getName() === 'TEMPLATE_CLIENTE');
  ss.moveActiveSheet(templateIndex + 1);

  ui.alert(`✅ Cliente "${nome}" adicionado!\n\nCompartilhe a aba "${nome}" com o cliente (somente leitura).`);
}
