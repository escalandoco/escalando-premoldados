/**
 * ESCALANDO PREMOLDADOS — Relatório Mensal de Leads (PDF)
 * Versão: 1.0 | 2026-03-06
 *
 * Como usar:
 * 1. Na planilha CRM, vá em Extensões → Apps Script
 * 2. Crie um novo arquivo: relatorio-mensal.gs
 * 3. Cole este código e salve
 * 4. Execute configurarTriggerMensal() UMA VEZ
 *
 * O script roda automaticamente no dia 1 de cada mês e:
 *   - Coleta dados do mês anterior da aba MESTRE
 *   - Gera um HTML com métricas por cliente
 *   - Converte para PDF e salva no Google Drive
 *   - Envia por email ao gestor (e ao cliente, se configurado)
 */

// ============================================================
// CONFIGURAÇÃO
// ============================================================
const REL_CONFIG = {
  // Email do gestor (recebe todos os relatórios)
  EMAIL_GESTOR: 'jon@escalando.co',

  // Clientes ativos e seus emails
  // Adicionar conforme novos clientes forem cadastrados
  CLIENTES: [
    {
      nome:       'Concrenor',
      abaSheets:  'CONCRENOR',
      email:      '',   // email do cliente (deixar '' para não enviar ao cliente)
      whatsapp:   '',   // número WPP do contato no cliente (ex: '5579999999999')
    },
  ],

  // ID da pasta no Google Drive onde salvar os PDFs
  // Criar pasta "Relatórios — Escalando Premoldados" e pegar o ID da URL
  DRIVE_FOLDER_ID: '',  // ex: '1ABC...XYZ'

  // Nome da aba mestre
  ABA_MESTRE: 'MESTRE',

  // Colunas (índice 0)
  COL_IDX: {
    DATA:     0,  // A
    CLIENTE:  1,  // B
    CANAL:    2,  // C
    STATUS:   8,  // I
    ULT_CONT: 10, // K
    DIAS:     11, // L
    VALOR:    12, // M
  },
};

// ============================================================
// TRIGGER MENSAL (executar UMA VEZ)
// ============================================================
function configurarTriggerMensal() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'gerarRelatorioMensal')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('gerarRelatorioMensal')
    .timeBased()
    .onMonthDay(1)
    .atHour(7)
    .inTimezone('America/Sao_Paulo')
    .create();

  SpreadsheetApp.getUi().alert(
    '✅ Trigger configurado!\n\nO relatório mensal vai rodar automaticamente no dia 1 de cada mês às 07h.\n\nPara testar agora, execute gerarRelatorioMensal().'
  );
}

// ============================================================
// FUNÇÃO PRINCIPAL
// ============================================================
function gerarRelatorioMensal() {
  const hoje   = new Date();
  const mesRef = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1); // mês anterior
  const mesNome = Utilities.formatDate(mesRef, 'America/Sao_Paulo', 'MMMM/yyyy');
  const mesLabel = Utilities.formatDate(mesRef, 'America/Sao_Paulo', 'MM-yyyy');

  Logger.log(`Gerando relatório de ${mesNome}...`);

  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(REL_CONFIG.ABA_MESTRE);
  if (!sheet) { Logger.log('Aba MESTRE não encontrada.'); return; }

  const dados = _lerDadosMes(sheet, mesRef);

  // Geral (todos os clientes)
  const totalGeral = _calcularMetricas(dados);

  // Por cliente
  REL_CONFIG.CLIENTES.forEach(cliente => {
    const dadosCliente = dados.filter(r => {
      const nomeCliente = r[REL_CONFIG.COL_IDX.CLIENTE] || '';
      return nomeCliente.toUpperCase() === cliente.nome.toUpperCase();
    });

    const metricas = _calcularMetricas(dadosCliente);
    const html     = _gerarHTML(cliente.nome, mesNome, metricas, totalGeral);
    const blob     = _htmlParaPDF(html, `relatorio-leads-${cliente.nome.toLowerCase()}-${mesLabel}`);

    // Salva no Drive
    let driveUrl = '';
    if (REL_CONFIG.DRIVE_FOLDER_ID) {
      const folder = DriveApp.getFolderById(REL_CONFIG.DRIVE_FOLDER_ID);
      const arquivo = folder.createFile(blob);
      arquivo.setName(`Relatório Leads ${cliente.nome} — ${mesNome}.pdf`);
      driveUrl = arquivo.getUrl();
    }

    // Envia ao gestor
    _enviarEmail(
      REL_CONFIG.EMAIL_GESTOR,
      `Relatório de Leads — ${cliente.nome} — ${mesNome}`,
      html,
      blob,
      driveUrl
    );

    // Envia ao cliente (se configurado)
    if (cliente.email) {
      _enviarEmail(
        cliente.email,
        `Seu relatório de leads — ${mesNome}`,
        _gerarHTMLCliente(cliente.nome, mesNome, metricas),
        blob,
        driveUrl
      );
    }

    Logger.log(`Relatório ${cliente.nome} gerado. Leads: ${metricas.total}`);
  });
}

// ============================================================
// LEITURA DE DADOS
// ============================================================
function _lerDadosMes(sheet, mesRef) {
  const ultimaLinha = sheet.getLastRow();
  if (ultimaLinha < 5) return [];

  const rows = sheet.getRange(5, 1, ultimaLinha - 4, 15).getValues();
  const mesInicio = new Date(mesRef.getFullYear(), mesRef.getMonth(), 1);
  const mesFim    = new Date(mesRef.getFullYear(), mesRef.getMonth() + 1, 0, 23, 59, 59);

  return rows.filter(row => {
    if (!row[REL_CONFIG.COL_IDX.DATA]) return false;
    const data = new Date(row[REL_CONFIG.COL_IDX.DATA]);
    return data >= mesInicio && data <= mesFim;
  });
}

// ============================================================
// CÁLCULO DE MÉTRICAS
// ============================================================
function _calcularMetricas(dados) {
  const total     = dados.length;
  const fechados  = dados.filter(r => r[REL_CONFIG.COL_IDX.STATUS] === 'Fechado').length;
  const perdidos  = dados.filter(r => r[REL_CONFIG.COL_IDX.STATUS] === 'Perdido').length;
  const novos     = dados.filter(r => r[REL_CONFIG.COL_IDX.STATUS] === 'Novo').length;
  const em_neg    = dados.filter(r => ['Contatado','Em negociação'].includes(r[REL_CONFIG.COL_IDX.STATUS])).length;

  const taxaConv  = total > 0 ? (fechados / total * 100).toFixed(1) : '0';

  const porCanal  = {};
  dados.forEach(r => {
    const canal = r[REL_CONFIG.COL_IDX.CANAL] || 'Outro';
    porCanal[canal] = (porCanal[canal] || 0) + 1;
  });

  const valorTotal = dados.reduce((acc, r) => {
    const v = parseFloat((r[REL_CONFIG.COL_IDX.VALOR] || '0').toString().replace(/[^0-9.]/g, ''));
    return acc + (isNaN(v) ? 0 : v);
  }, 0);

  return { total, fechados, perdidos, novos, em_neg, taxaConv, porCanal, valorTotal };
}

// ============================================================
// GERAÇÃO DO HTML
// ============================================================
function _gerarHTML(nomeCliente, mesNome, metricas, totalGeral) {
  const canaisHTML = Object.entries(metricas.porCanal)
    .sort((a, b) => b[1] - a[1])
    .map(([canal, qtd]) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${canal}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;font-weight:600;">${qtd}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;color:#666;">
          ${metricas.total > 0 ? Math.round(qtd / metricas.total * 100) + '%' : '—'}
        </td>
      </tr>`).join('');

  return `<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f5;margin:0;padding:20px;color:#1a1a1a;">
<div style="max-width:680px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.1);">

  <div style="background:#1C1C1C;padding:24px 28px;">
    <div style="color:#E85110;font-size:20px;font-weight:700;letter-spacing:-.3px;">Escalando Premoldados</div>
    <div style="color:#fff;font-size:15px;font-weight:600;margin-top:6px;">${nomeCliente}</div>
    <div style="color:#aaa;font-size:13px;margin-top:2px;">Relatório de Leads — ${mesNome}</div>
  </div>

  <div style="padding:24px 28px;">

    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;">
      ${[
        ['Total de Leads', metricas.total, '#111'],
        ['Fechados', metricas.fechados, '#16A34A'],
        ['Em andamento', metricas.em_neg, '#D97706'],
        ['Taxa de conv.', metricas.taxaConv + '%', '#E85110'],
      ].map(([label, val, cor]) => `
        <div style="background:#F9FAFB;border-radius:6px;padding:14px 12px;text-align:center;">
          <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">${label}</div>
          <div style="font-size:26px;font-weight:700;color:${cor};">${val}</div>
        </div>`).join('')}
    </div>

    <!-- Leads por canal -->
    <div style="margin-bottom:24px;">
      <div style="font-size:13px;font-weight:700;color:#374151;margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px;">Leads por canal</div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#F3F4F6;">
            <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#6B7280;">Canal</th>
            <th style="padding:8px 12px;text-align:center;font-size:11px;text-transform:uppercase;color:#6B7280;">Leads</th>
            <th style="padding:8px 12px;text-align:center;font-size:11px;text-transform:uppercase;color:#6B7280;">% do total</th>
          </tr>
        </thead>
        <tbody>${canaisHTML || '<tr><td colspan="3" style="padding:12px;text-align:center;color:#999;">Sem dados no período</td></tr>'}</tbody>
      </table>
    </div>

    <!-- Status detalhado -->
    <div style="background:#F9FAFB;border-radius:6px;padding:16px 18px;margin-bottom:24px;">
      <div style="font-size:13px;font-weight:700;color:#374151;margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px;">Funil</div>
      ${[
        ['Novos (sem contato)', metricas.novos, '#DBEAFE', '#1D4ED8'],
        ['Em andamento', metricas.em_neg, '#FEF3C7', '#D97706'],
        ['Fechados', metricas.fechados, '#DCFCE7', '#16A34A'],
        ['Perdidos', metricas.perdidos, '#FEE2E2', '#DC2626'],
      ].map(([label, val, bg, cor]) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #eee;">
          <span style="font-size:13px;color:#374151;">${label}</span>
          <span style="background:${bg};color:${cor};padding:2px 10px;border-radius:12px;font-size:12px;font-weight:600;">${val}</span>
        </div>`).join('')}
    </div>

    ${metricas.valorTotal > 0 ? `
    <div style="background:#FFF7ED;border-radius:6px;padding:14px 18px;margin-bottom:24px;border-left:3px solid #E85110;">
      <div style="font-size:12px;color:#666;">Valor estimado dos fechamentos</div>
      <div style="font-size:22px;font-weight:700;color:#E85110;margin-top:4px;">
        R$ ${metricas.valorTotal.toLocaleString('pt-BR', {minimumFractionDigits:2})}
      </div>
    </div>` : ''}

  </div>

  <div style="background:#F9FAFB;padding:14px 28px;text-align:center;font-size:11px;color:#9CA3AF;border-top:1px solid #eee;">
    Relatório gerado automaticamente no dia 1 · Escalando Premoldados
  </div>
</div>
</body>
</html>`;
}

// Versão simplificada para envio ao cliente (sem dados internos)
function _gerarHTMLCliente(nomeCliente, mesNome, metricas) {
  return _gerarHTML(nomeCliente, mesNome, metricas, null)
    .replace('Escalando Premoldados', nomeCliente);
}

// ============================================================
// HTML → PDF via Google Drive
// ============================================================
function _htmlParaPDF(html, nomeArquivo) {
  // Cria arquivo HTML temporário no Drive, converte para PDF
  const tempFile = DriveApp.createFile(
    nomeArquivo + '.html',
    html,
    MimeType.HTML
  );

  const pdfBlob = tempFile.getAs(MimeType.PDF);
  pdfBlob.setName(nomeArquivo + '.pdf');

  // Remove arquivo HTML temporário
  tempFile.setTrashed(true);

  return pdfBlob;
}

// ============================================================
// ENVIO DE EMAIL
// ============================================================
function _enviarEmail(destinatario, assunto, htmlBody, pdfBlob, driveUrl) {
  if (!destinatario) return;

  const corpo = htmlBody + (driveUrl
    ? `<p style="text-align:center;margin-top:16px;"><a href="${driveUrl}" style="background:#E85110;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:13px;">Abrir no Google Drive</a></p>`
    : '');

  GmailApp.sendEmail(destinatario, assunto, '', {
    htmlBody:    corpo,
    attachments: [pdfBlob],
  });
}

// ============================================================
// TESTE MANUAL
// ============================================================
function testarRelatorio() {
  gerarRelatorioMensal();
  SpreadsheetApp.getUi().alert('✅ Relatório gerado. Verifique o email e o Google Drive.');
}
