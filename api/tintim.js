/**
 * ESCALANDO PREMOLDADOS — Webhook Tintim Multi-Cliente
 * Vercel Serverless Function
 *
 * POST /api/tintim
 * Recebe eventos do Tintim e roteia o lead para:
 *   1. Apps Script CRM (planilha Google Sheets) — via webhookUrl
 *   2. ClickUp — task em "Ações do Dia" se configurado
 *
 * Identificação do cliente:
 *   - Por número de WhatsApp do cliente (cada cliente tem um número)
 *   - Por tag/label configurado no Tintim
 *
 * Variáveis de ambiente necessárias (Vercel):
 *   SHEETS_WEBHOOK_URL  — URL do Apps Script Web App (webhook-leads.gs)
 *   TINTIM_SECRET       — Token de validação do Tintim (opcional)
 */

// Mapa: número WhatsApp do cliente → dados do cliente
// Atualizar ao adicionar novo cliente
const CLIENTES_MAP = {
  // 'numero_completo_com_ddi': { slug, nome, abaSheets }
  '5579991558504': { slug: 'concrenor', nome: 'Concrenor', abaSheets: 'CONCRENOR' },
};

// Fallback: se não encontrar o número, usa esse cliente padrão
const CLIENTE_DEFAULT = {
  slug:       'desconhecido',
  nome:       'Desconhecido',
  abaSheets:  '',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Health check
  if (req.method === 'GET') {
    return res.status(200).json({
      status:  'online',
      app:     'Escalando Premoldados — Tintim Webhook',
      clientes: Object.keys(CLIENTES_MAP).length,
      timestamp: new Date().toISOString(),
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const payload = req.body;

    // Validação básica
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Payload inválido' });
    }

    // Tintim pode enviar diferentes estruturas — normalizar
    const lead = _normalizarPayload(payload);

    if (!lead) {
      // Evento que não é lead (ex: mensagem de saída, status update)
      return res.status(200).json({ ok: true, msg: 'evento ignorado' });
    }

    // Identificar cliente pelo número de destino (para qual número o lead enviou)
    const numeroDestino = lead.numeroDestino || '';
    const cliente = CLIENTES_MAP[numeroDestino] || CLIENTE_DEFAULT;

    // Montar dados para o CRM
    const dadosCRM = {
      nome:        lead.nome || lead.numero || 'Lead WhatsApp',
      whatsapp:    _formatarTelefone(lead.numero),
      cidade:      lead.cidade || '',
      produto:     lead.produto || 'outro',
      origem:      'whatsapp',
      source:      'tintim',
      nomeCliente: cliente.nome,
      abaCliente:  cliente.abaSheets,
      canal:       'WhatsApp Orgânico',
      timestamp:   new Date().toISOString(),
    };

    // Enviar para Apps Script (CRM Google Sheets)
    const sheetsUrl = process.env.SHEETS_WEBHOOK_URL;
    if (sheetsUrl) {
      await _enviarParaSheets(sheetsUrl, dadosCRM);
    }

    return res.status(200).json({
      ok:      true,
      cliente: cliente.nome,
      lead:    dadosCRM.nome,
    });

  } catch (err) {
    console.error('[tintim webhook]', err.message);
    // Retorna 200 para o Tintim não retentar indefinidamente
    return res.status(200).json({ ok: false, error: err.message });
  }
}

// ---- Normaliza diferentes formatos de payload do Tintim ----
function _normalizarPayload(payload) {
  // Evento de nova conversa / mensagem recebida
  const eventosLead = ['new_conversation', 'new_message', 'contact_created'];
  const tipoEvento  = payload.event || payload.type || payload.hook_event || '';

  // Ignora eventos que não são entrada de lead
  if (tipoEvento && !eventosLead.some(e => tipoEvento.includes(e))) {
    return null;
  }

  // Tenta extrair dados do contato (varia por versão da API Tintim)
  const contato = payload.contact || payload.customer || payload.data?.contact || payload;

  return {
    nome:           contato.name || contato.nome || '',
    numero:         contato.phone || contato.whatsapp || contato.number || payload.from || '',
    numeroDestino:  contato.to || payload.to || payload.account_phone || '',
    cidade:         contato.city || contato.cidade || '',
    produto:        contato.custom_field_produto || '',
    mensagemInicial: payload.message?.text || payload.body || '',
  };
}

// ---- Formata número para padrão brasileiro ----
function _formatarTelefone(numero) {
  if (!numero) return '';
  const digits = numero.replace(/\D/g, '');
  // Remove DDI 55 se presente
  const local = digits.startsWith('55') && digits.length > 11
    ? digits.slice(2)
    : digits;
  if (local.length === 11) return `(${local.slice(0,2)}) ${local.slice(2,7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0,2)}) ${local.slice(2,6)}-${local.slice(6)}`;
  return numero;
}

// ---- Envia dados para Apps Script CRM ----
async function _enviarParaSheets(url, dados) {
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(dados),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    console.error('[sheets webhook]', res.status, txt.slice(0, 200));
  }
}
