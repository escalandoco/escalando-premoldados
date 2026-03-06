/**
 * ESCALANDO PREMOLDADOS — Alertas de Follow-up de Leads
 * Versão: 1.0 | 2026-03-06
 *
 * Como usar:
 * 1. Na planilha CRM, vá em Extensões → Apps Script
 * 2. Crie um novo arquivo: alertas-followup.gs
 * 3. Cole este código e salve
 * 4. Execute configurarTrigger() UMA VEZ para agendar o alerta diário
 * 5. Autorize as permissões solicitadas
 *
 * O script roda automaticamente toda manhã às 08h e:
 *   - Verifica todos os leads com status "Novo" ou "Contatado"
 *   - Identifica os que estão sem contato há X dias (padrão: 2)
 *   - Envia email resumo ao gestor
 *   - Envia alerta via WhatsApp (Tintim) se configurado
 */

// ============================================================
// CONFIGURAÇÃO — ajustar conforme necessário
// ============================================================
const ALERTA_CONFIG = {
  // Email do gestor (obrigatório)
  EMAIL_GESTOR: 'jon@escalando.co',

  // Dias sem contato antes de alertar (padrão: 2)
  DIAS_LIMITE: 2,

  // Status que entram no alerta (leads "em aberto")
  STATUS_ALERTAR: ['Novo', 'Contatado', 'Em negociação'],

  // Tintim WhatsApp (opcional — deixar em branco para desativar)
  TINTIM_API_URL: '',  // ex: 'https://api.tintim.com/v1/messages'
  TINTIM_TOKEN:   '',  // token da API Tintim
  TINTIM_NUMERO:  '',  // número do gestor: '5579999999999'

  // Nome da aba mestre
  ABA_MESTRE: 'MESTRE',

  // Colunas da aba MESTRE (índice 1)
  COL: {
    DATA_ENTRADA:      1,  // A
    CLIENTE:           2,  // B
    CANAL:             3,  // C
    NOME_LEAD:         4,  // D
    TELEFONE:          5,  // E
    CIDADE:            6,  // F
    ESTADO:            7,  // G
    PRODUTO:           8,  // H
    STATUS:            9,  // I
    RESPONSAVEL:      10,  // J
    DATA_ULT_CONTATO: 11,  // K
    DIAS_SEM_CONTATO: 12,  // L
    VALOR:            13,  // M
    OBSERVACAO:       14,  // N
  },

  // Linha onde começam os dados (após headers)
  PRIMEIRA_LINHA: 5,
};

// ============================================================
// CONFIGURAR TRIGGER DIÁRIO (executar UMA VEZ)
// ============================================================
function configurarTrigger() {
  // Remove triggers antigos deste script para evitar duplicação
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'verificarLeadsSemContato')
    .forEach(t => ScriptApp.deleteTrigger(t));

  // Cria trigger diário às 08h (horário de São Paulo)
  ScriptApp.newTrigger('verificarLeadsSemContato')
    .timeBased()
    .atHour(8)
    .everyDays(1)
    .inTimezone('America/Sao_Paulo')
    .create();

  SpreadsheetApp.getUi().alert(
    '✅ Trigger configurado!\n\n' +
    'O alerta de follow-up vai rodar automaticamente toda manhã às 08h.\n\n' +
    'Para testar agora, execute a função verificarLeadsSemContato().'
  );
}

// ============================================================
// VERIFICAÇÃO PRINCIPAL (roda diariamente)
// ============================================================
function verificarLeadsSemContato() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(ALERTA_CONFIG.ABA_MESTRE);

  if (!sheet) {
    Logger.log('Aba MESTRE não encontrada.');
    return;
  }

  const ultimaLinha = sheet.getLastRow();
  if (ultimaLinha < ALERTA_CONFIG.PRIMEIRA_LINHA) {
    Logger.log('Nenhum dado na planilha ainda.');
    return;
  }

  const dados = sheet.getRange(
    ALERTA_CONFIG.PRIMEIRA_LINHA, 1,
    ultimaLinha - ALERTA_CONFIG.PRIMEIRA_LINHA + 1,
    Object.keys(ALERTA_CONFIG.COL).length
  ).getValues();

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const leadsPendentes = [];

  dados.forEach((linha, i) => {
    const nome    = linha[ALERTA_CONFIG.COL.NOME_LEAD - 1];
    const status  = linha[ALERTA_CONFIG.COL.STATUS - 1];
    const cliente = linha[ALERTA_CONFIG.COL.CLIENTE - 1];
    const canal   = linha[ALERTA_CONFIG.COL.CANAL - 1];
    const tel     = linha[ALERTA_CONFIG.COL.TELEFONE - 1];
    const ultContato = linha[ALERTA_CONFIG.COL.DATA_ULT_CONTATO - 1];
    const dataEntrada = linha[ALERTA_CONFIG.COL.DATA_ENTRADA - 1];

    // Pula linhas vazias
    if (!nome && !status) return;

    // Só alerta status em aberto
    if (!ALERTA_CONFIG.STATUS_ALERTAR.includes(status)) return;

    // Calcula dias sem contato
    let diasSemContato;
    const refData = ultContato ? new Date(ultContato) : (dataEntrada ? new Date(dataEntrada) : null);

    if (!refData || isNaN(refData.getTime())) {
      diasSemContato = 99; // sem data = tratar como muito tempo
    } else {
      refData.setHours(0, 0, 0, 0);
      diasSemContato = Math.floor((hoje - refData) / (1000 * 60 * 60 * 24));
    }

    if (diasSemContato >= ALERTA_CONFIG.DIAS_LIMITE) {
      leadsPendentes.push({
        linha:    ALERTA_CONFIG.PRIMEIRA_LINHA + i,
        nome:     nome || '(sem nome)',
        cliente:  cliente || '—',
        canal:    canal || '—',
        tel:      tel || '—',
        status:   status,
        dias:     diasSemContato,
      });
    }
  });

  Logger.log(`Leads pendentes encontrados: ${leadsPendentes.length}`);

  if (leadsPendentes.length === 0) {
    Logger.log('Nenhum lead pendente de contato. ✅');
    return;
  }

  // Ordena por mais dias sem contato
  leadsPendentes.sort((a, b) => b.dias - a.dias);

  // Envia email
  _enviarEmailAlerta(leadsPendentes, hoje);

  // Envia WhatsApp via Tintim (se configurado)
  if (ALERTA_CONFIG.TINTIM_API_URL && ALERTA_CONFIG.TINTIM_TOKEN) {
    _enviarWhatsAppAlerta(leadsPendentes, hoje);
  }
}

// ============================================================
// EMAIL DE ALERTA
// ============================================================
function _enviarEmailAlerta(leads, hoje) {
  const dataHoje = Utilities.formatDate(hoje, 'America/Sao_Paulo', 'dd/MM/yyyy');
  const urgentes = leads.filter(l => l.dias >= 3);
  const normais  = leads.filter(l => l.dias < 3);

  const assunto = `🔔 ${leads.length} lead(s) aguardando contato — ${dataHoje}`;

  const linhasTabela = leads.map(l => `
    <tr style="background:${l.dias >= 3 ? '#fff5f5' : '#fff'}">
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${l.nome}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${l.cliente}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${l.canal}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${l.tel}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;">${l.status}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:bold;color:${l.dias >= 3 ? '#DC2626' : '#D97706'};">
        ${l.dias} dia(s)
      </td>
    </tr>`).join('');

  const corpo = `
<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f5;margin:0;padding:20px;">
  <div style="max-width:700px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.1);">

    <div style="background:#1C1C1C;padding:20px 24px;">
      <div style="color:#E85110;font-size:18px;font-weight:700;">Escalando Premoldados</div>
      <div style="color:#aaa;font-size:13px;margin-top:4px;">Alerta de Follow-up — ${dataHoje}</div>
    </div>

    <div style="padding:24px;">
      <p style="margin:0 0 16px;font-size:15px;color:#111;">
        ${urgentes.length > 0
          ? `<strong style="color:#DC2626;">⚠️ ${urgentes.length} lead(s) URGENTE(S)</strong> com 3+ dias sem contato.`
          : `<strong style="color:#D97706;">🔔 ${leads.length} lead(s)</strong> aguardando retorno.`
        }
      </p>

      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#F3F4F6;">
            <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#6B7280;">Lead</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#6B7280;">Cliente</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#6B7280;">Canal</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#6B7280;">Telefone</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#6B7280;">Status</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;color:#6B7280;">Sem contato</th>
          </tr>
        </thead>
        <tbody>
          ${linhasTabela}
        </tbody>
      </table>

      <div style="margin-top:24px;padding:16px;background:#FFF7ED;border-radius:6px;border-left:3px solid #E85110;">
        <strong style="font-size:13px;">Ação necessária:</strong>
        <ul style="margin:8px 0 0;padding-left:20px;font-size:13px;color:#374151;">
          <li>Contatar cada lead na lista acima</li>
          <li>Atualizar "Data último contato" na planilha após contato</li>
          <li>Atualizar o Status conforme evolução</li>
        </ul>
      </div>
    </div>

    <div style="background:#F9FAFB;padding:12px 24px;text-align:center;font-size:11px;color:#9CA3AF;">
      Escalando Premoldados · Alerta automático gerado às 08h
    </div>
  </div>
</body>
</html>`;

  GmailApp.sendEmail(ALERTA_CONFIG.EMAIL_GESTOR, assunto, '', { htmlBody: corpo });
  Logger.log(`Email de alerta enviado para ${ALERTA_CONFIG.EMAIL_GESTOR}`);
}

// ============================================================
// WHATSAPP VIA TINTIM (opcional)
// ============================================================
function _enviarWhatsAppAlerta(leads, hoje) {
  const dataHoje = Utilities.formatDate(hoje, 'America/Sao_Paulo', 'dd/MM/yyyy');
  const urgentes = leads.filter(l => l.dias >= 3);

  const linhas = leads.slice(0, 10).map(
    l => `• ${l.nome} (${l.cliente}) — ${l.dias} dia(s) — ${l.status}`
  ).join('\n');

  const mensagem = [
    `🔔 *Follow-up — ${dataHoje}*`,
    `${leads.length} lead(s) aguardando contato${urgentes.length > 0 ? ` (${urgentes.length} urgente(s))` : ''}:`,
    '',
    linhas,
    '',
    leads.length > 10 ? `... e mais ${leads.length - 10} outros.` : '',
    'Acesse a planilha para atualizar.',
  ].filter(Boolean).join('\n');

  try {
    const payload = JSON.stringify({
      to:      ALERTA_CONFIG.TINTIM_NUMERO,
      message: mensagem,
    });

    UrlFetchApp.fetch(ALERTA_CONFIG.TINTIM_API_URL, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${ALERTA_CONFIG.TINTIM_TOKEN}`,
        'Content-Type':  'application/json',
      },
      payload: payload,
      muteHttpExceptions: true,
    });

    Logger.log('WhatsApp de alerta enviado via Tintim.');
  } catch (err) {
    Logger.log('Erro ao enviar WhatsApp: ' + err.toString());
  }
}

// ============================================================
// TESTE MANUAL (executar para testar sem esperar o trigger)
// ============================================================
function testarAlertas() {
  verificarLeadsSemContato();
  SpreadsheetApp.getUi().alert('✅ Verificação executada. Verifique o email configurado e os logs (Ver → Logs).');
}
