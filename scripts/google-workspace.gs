// ============================================================
// ESCALANDO PREMOLDADOS — Google Workspace API
// Apps Script Web App
// POST /exec → { action: 'criar-cliente' | 'novo-lead' | 'novo-orcamento', ...dados }
// ============================================================

const PASTA_CLIENTES_ID = '1MIvzKWOyA875Vvbq3D8P8B0qJb3NseOh';

function doPost(e) {
  try {
    const dados = JSON.parse(e.postData.contents);

    if (dados.action === 'criar-cliente')    return resposta(criarCliente(dados));
    if (dados.action === 'novo-lead')        return resposta(novoLead(dados));
    if (dados.action === 'novo-orcamento')   return resposta(novoOrcamento(dados));
    if (dados.action === 'salvar-lp-briefing') return resposta(salvarLpBriefing(dados));

    return resposta({ success: false, error: 'action inválida' });
  } catch (err) {
    return resposta({ success: false, error: err.message });
  }
}

function doGet() {
  return resposta({ status: 'ok', msg: 'Escalando Premoldados — Google API' });
}

// ============================================================
// CRIAR CLIENTE — Pasta Drive + Planilha Leads
// ============================================================
function criarCliente(d) {
  const nome = d.empresa.trim();
  const pastaClientes = DriveApp.getFolderById(PASTA_CLIENTES_ID);

  // Cria pasta do cliente
  const pastaCliente = pastaClientes.createFolder(nome);

  // Cria subpastas
  let pastaCRM;
  ['01 - Briefing', '02 - Criativos', '03 - Relatórios',
   '04 - Contratos', '05 - Fotos', '06 - CRM Leads'].forEach(sub => {
    const p = pastaCliente.createFolder(sub);
    if (sub === '06 - CRM Leads') pastaCRM = p;
  });

  // Cria e move planilha
  const ss = SpreadsheetApp.create(`Leads — ${nome}`);
  const arquivo = DriveApp.getFileById(ss.getId());
  pastaCRM.addFile(arquivo);
  DriveApp.getRootFolder().removeFile(arquivo);

  // Configura planilha (Leads + Orçamentos)
  configurarPlanilha(ss, nome);

  // Leitura pública via link
  arquivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    success: true,
    msg: `Drive criado para ${nome}`,
    pastaDriveId: pastaCliente.getId(),
    pastaDriveUrl: pastaCliente.getUrl(),
    planilhaId: ss.getId(),
    planilhaUrl: ss.getUrl(),
  };
}

// ============================================================
// CONFIGURAR PLANILHA DE LEADS
// ============================================================
function configurarPlanilha(ss, nome) {
  const aba = ss.getActiveSheet();
  aba.setName('Leads');

  // Cabeçalho
  const cols = [
    'Data', 'Canal', 'Nome', 'Telefone', 'Cidade',
    'Produto de Interesse', 'Valor Orçamento (R$)',
    'Status', 'Último Contato', 'Dias sem Contato', 'Observação'
  ];
  const header = aba.getRange(1, 1, 1, cols.length);
  header.setValues([cols]);
  header.setBackground('#0D1117');
  header.setFontColor('#C4B470');
  header.setFontWeight('bold');
  header.setFontSize(11);
  aba.setFrozenRows(1);

  // Larguras
  [100,120,180,140,120,180,160,150,130,130,250].forEach((w, i) => aba.setColumnWidth(i+1, w));

  // Validação Canal (B)
  aba.getRange('B2:B1000').setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['Meta Ads','Google Ads','GMB','WhatsApp Direto','Indicação','Ligação','Visita','Site'], true)
      .build()
  );

  // Validação Status (H)
  aba.getRange('H2:H1000').setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['Novo','Contatado','Orçamento Enviado','Em Negociação','Fechado','Perdido','Sem Qualidade'], true)
      .build()
  );

  // Dias sem Contato automático (J) — calcula a partir de Último Contato (I)
  aba.getRange('J2').setFormula('=ARRAYFORMULA(IF(I2:I="",,TODAY()-I2:I))');

  // Formatação condicional
  const range = aba.getRange('A2:K1000');
  aba.setConditionalFormatRules([
    // Novo = azul
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$H2="Novo"').setBackground('#DBEAFE')
      .setRanges([range]).build(),
    // Fechado = verde
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$H2="Fechado"').setBackground('#D1FAE5')
      .setRanges([range]).build(),
    // Perdido = vermelho
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$H2="Perdido"').setBackground('#FEE2E2')
      .setRanges([range]).build(),
    // Orçamento Enviado + >2 dias = laranja (alerta follow-up!)
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=AND($H2="Orçamento Enviado",$J2>2)')
      .setBackground('#FED7AA').setFontColor('#9A3412')
      .setRanges([range]).build(),
  ]);

  // ---- ABA ORÇAMENTOS ----
  const abaOrc = ss.insertSheet('Orçamentos');
  const colsOrc = [
    'Data', 'Canal', 'Nome', 'Telefone', 'Região',
    'Itens', 'Total (R$)', 'Prazo', 'Status', 'Observação'
  ];
  const headerOrc = abaOrc.getRange(1, 1, 1, colsOrc.length);
  headerOrc.setValues([colsOrc]);
  headerOrc.setBackground('#0D1117');
  headerOrc.setFontColor('#C4B470');
  headerOrc.setFontWeight('bold');
  headerOrc.setFontSize(11);
  abaOrc.setFrozenRows(1);

  [100,120,180,140,140,320,120,130,130,250].forEach((w, i) => abaOrc.setColumnWidth(i+1, w));

  // Validação Status (I)
  abaOrc.getRange('I2:I1000').setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['Pendente','Enviado','Em Negociação','Aprovado','Recusado'], true)
      .build()
  );

  // Formatação condicional Orçamentos
  const rangeOrc = abaOrc.getRange('A2:J1000');
  abaOrc.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$I2="Aprovado"').setBackground('#D1FAE5')
      .setRanges([rangeOrc]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$I2="Recusado"').setBackground('#FEE2E2')
      .setRanges([rangeOrc]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied('=$I2="Pendente"').setBackground('#DBEAFE')
      .setRanges([rangeOrc]).build(),
  ]);
}

// ============================================================
// NOVO LEAD — Adiciona linha na planilha do cliente
// ============================================================
function novoLead(d) {
  // Busca planilha pelo nome da empresa
  const pastas = DriveApp.getFolderById(PASTA_CLIENTES_ID).searchFolders(`title = "${d.empresa}"`);
  if (!pastas.hasNext()) throw new Error(`Pasta "${d.empresa}" não encontrada no Drive.`);

  const pastaCRM = pastas.next().searchFolders('title = "06 - CRM Leads"');
  if (!pastaCRM.hasNext()) throw new Error('Pasta CRM não encontrada.');

  const arquivos = pastaCRM.next().getFilesByName(`Leads — ${d.empresa}`);
  if (!arquivos.hasNext()) throw new Error(`Planilha "Leads — ${d.empresa}" não encontrada.`);

  const aba = SpreadsheetApp.openById(arquivos.next().getId()).getSheetByName('Leads');
  const hoje = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'dd/MM/yyyy');

  aba.appendRow([
    hoje,
    d.canal       || '',
    d.nome        || '',
    d.telefone    || '',
    d.cidade      || '',
    d.produto     || '',
    d.valor       || '',
    'Novo',
    hoje, // Último Contato
    '',   // Dias sem Contato (calculado por fórmula)
    d.obs || '',
  ]);

  return { success: true, msg: `Lead "${d.nome}" registrado para ${d.empresa}` };
}

// ============================================================
// SALVAR LP BRIEFING — Cria doc de briefing em 02 - Criativos
// ============================================================
function salvarLpBriefing(d) {
  const pastas = DriveApp.getFolderById(PASTA_CLIENTES_ID).searchFolders(`title = "${d.empresa}"`);
  if (!pastas.hasNext()) throw new Error(`Pasta "${d.empresa}" não encontrada.`);

  const pastaCliente   = pastas.next();
  const pastasCriativos = pastaCliente.searchFolders('title = "02 - Criativos"');
  if (!pastasCriativos.hasNext()) throw new Error('Pasta Criativos não encontrada.');
  const pastaCriativos = pastasCriativos.next();

  // Cria documento de briefing
  const doc  = DocumentApp.create(`Briefing LP — ${d.empresa}`);
  const body = doc.getBody();

  body.appendParagraph(`Briefing de Landing Page — ${d.empresa}`).setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph('');

  body.appendParagraph('IDENTIDADE VISUAL').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph(`Slogan: ${d.slogan || '—'}`);
  body.appendParagraph(`Estilo: ${d.estilo || '—'}`);
  body.appendParagraph(`Cor principal: ${d.cor_primaria || '—'}`);
  body.appendParagraph(`Cor secundária: ${d.cor_secundaria || '—'}`);
  body.appendParagraph('');

  body.appendParagraph('CONTATO & LOCALIZAÇÃO').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  body.appendParagraph(`WhatsApp: ${d.whatsapp}`);
  body.appendParagraph(`Cidade: ${d.cidade || '—'}`);
  body.appendParagraph(`Regiões de entrega: ${d.regioes || '—'}`);
  body.appendParagraph('');

  body.appendParagraph('PRODUTOS').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  (d.produtos || []).forEach((p, i) => {
    body.appendParagraph(`Produto ${i+1}: ${p.nome}`).setBold(true);
    if (p.aplicacao) body.appendParagraph(`Aplicação: ${p.aplicacao}`);
    if (p.preco)     body.appendParagraph(`Preço: ${p.preco}`);
    if (p.desc)      body.appendParagraph(p.desc);
    body.appendParagraph('');
  });

  body.appendParagraph('DIFERENCIAIS').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  (d.diferenciais || []).forEach((item, i) => body.appendParagraph(`${i+1}. ${item}`));
  body.appendParagraph('');

  body.appendParagraph('DEPOIMENTOS').setHeading(DocumentApp.ParagraphHeading.HEADING2);
  (d.depoimentos || []).forEach(dep => {
    body.appendParagraph(`"${dep.texto}"`).setItalic(true);
    body.appendParagraph(`— ${dep.nome}${dep.cidade ? ', ' + dep.cidade : ''}`);
    body.appendParagraph('');
  });

  if (d.headline) {
    body.appendParagraph('HEADLINE SUGERIDA PELO CLIENTE').setHeading(DocumentApp.ParagraphHeading.HEADING2);
    body.appendParagraph(d.headline);
  }
  if (d.obs) {
    body.appendParagraph('OBSERVAÇÕES').setHeading(DocumentApp.ParagraphHeading.HEADING2);
    body.appendParagraph(d.obs);
  }

  doc.saveAndClose();

  // Move para pasta Criativos
  const arquivo = DriveApp.getFileById(doc.getId());
  pastaCriativos.addFile(arquivo);
  DriveApp.getRootFolder().removeFile(arquivo);

  return { success: true, msg: `Briefing LP salvo para ${d.empresa}`, docUrl: doc.getUrl() };
}

// ============================================================
// NOVO ORÇAMENTO — Adiciona linha na aba Orçamentos
// ============================================================
function novoOrcamento(d) {
  const pastas = DriveApp.getFolderById(PASTA_CLIENTES_ID).searchFolders(`title = "${d.empresa}"`);
  if (!pastas.hasNext()) throw new Error(`Pasta "${d.empresa}" não encontrada no Drive.`);

  const pastaCRM = pastas.next().searchFolders('title = "06 - CRM Leads"');
  if (!pastaCRM.hasNext()) throw new Error('Pasta CRM não encontrada.');

  const arquivos = pastaCRM.next().getFilesByName(`Leads — ${d.empresa}`);
  if (!arquivos.hasNext()) throw new Error(`Planilha "Leads — ${d.empresa}" não encontrada.`);

  const ss  = SpreadsheetApp.openById(arquivos.next().getId());
  const aba = ss.getSheetByName('Orçamentos');
  if (!aba) throw new Error('Aba "Orçamentos" não encontrada na planilha.');

  const hoje = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'dd/MM/yyyy');

  // Serializa itens: "Mourão torneado x5 = R$500,00; Bloco x100 = R$300,00"
  const itensTexto = (d.itens || []).map(i => {
    const t = (i.total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    return `${i.produto} x${i.qtd} = R$${t}`;
  }).join('; ');

  const total = parseFloat(d.totalGeral) || 0;

  aba.appendRow([
    d.data   || hoje,
    d.canal  || '',
    d.nome   || '',
    d.telefone || '',
    d.regiao || '',
    itensTexto,
    total,
    d.prazo  || '',
    'Pendente',
    d.obs    || '',
  ]);

  return { success: true, msg: `Orçamento de "${d.nome}" registrado para ${d.empresa}` };
}

// ============================================================
// HELPER
// ============================================================
function resposta(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
