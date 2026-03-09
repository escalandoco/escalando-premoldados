/**
 * ESCALANDO PREMOLDADOS — Webhook Tintim Multi-Cliente
 * Vercel Serverless Function
 *
 * POST /api/tintim
 * Recebe eventos do Tintim e:
 *   1. Novo lead → registra na planilha Google Sheets (aba Leads)
 *   2. Mudança de etapa → atualiza coluna Status na planilha
 *
 * Identificação do cliente: por número de WhatsApp de destino
 */

import { registrarLead, atualizarStatusLead } from './google-drive.js';

// Mapa: número WhatsApp do cliente → dados do cliente
// Para adicionar novo cliente: inserir o número no formato 55 + DDD + número (sem espaços/traços)
const CLIENTES_MAP = {
  '5579991558504': { slug: 'concrenor',  nome: 'Concrenor',  abaSheets: 'CONCRENOR'  },
  // 'NUMERO_BRASBLOCO': { slug: 'brasbloco', nome: 'Brasbloco', abaSheets: 'BRASBLOCO' },
  // 'NUMERO_LEVERT':    { slug: 'levert',    nome: 'Levert',    abaSheets: 'LEVERT'    },
};

const CLIENTE_DEFAULT = {
  slug:      'desconhecido',
  nome:      'Desconhecido',
  abaSheets: '',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return res.status(200).json({
      status:   'online',
      app:      'Escalando Premoldados — Tintim Webhook',
      clientes: Object.keys(CLIENTES_MAP).length,
      timestamp: new Date().toISOString(),
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Payload inválido' });
    }

    // Log para debug (primeiras 500 chars)
    console.log('[tintim] payload:', JSON.stringify(payload).slice(0, 500));

    // ── 1. Mudança de etapa ────────────────────────────────────
    const mudanca = _extrairMudancaEtapa(payload);
    if (mudanca) {
      const cliente = CLIENTES_MAP[mudanca.numeroDestino] || CLIENTE_DEFAULT;
      if (cliente.slug !== 'desconhecido') {
        await atualizarStatusLead(cliente.nome, mudanca.telefone, mudanca.novoStatus, mudanca.valor);
      }
      return res.status(200).json({ ok: true, action: 'status_updated', status: mudanca.novoStatus });
    }

    // ── 2. Novo lead ───────────────────────────────────────────
    const lead = _normalizarLead(payload);
    if (!lead) {
      return res.status(200).json({ ok: true, msg: 'evento ignorado' });
    }

    const numeroDestino = lead.numeroDestino || '';
    const cliente = CLIENTES_MAP[numeroDestino] || CLIENTE_DEFAULT;

    await registrarLead(cliente.nome, {
      canal:     'WhatsApp Orgânico',
      nome:      lead.nome || lead.numero || 'Lead WhatsApp',
      telefone:  _formatarTelefone(lead.numero),
      cidade:    lead.cidade || '',
      interesse: lead.produto || 'pisos intertravados / meio fio',
      obs:       lead.mensagemInicial ? `Msg inicial: ${lead.mensagemInicial.slice(0, 100)}` : '',
    });

    return res.status(200).json({ ok: true, action: 'lead_registered', cliente: cliente.nome });

  } catch (err) {
    console.error('[tintim webhook]', err.message);
    return res.status(200).json({ ok: false, error: err.message });
  }
}

// ── Detecta mudança de etapa ──────────────────────────────────────────────────
function _extrairMudancaEtapa(payload) {
  const evento = payload.event || payload.type || payload.hook_event || '';

  // Eventos de alteração de conversa do Tintim
  const isAlteracao = [
    'conversation_updated', 'lead_status_changed', 'stage_changed',
    'conversation_stage_changed',
  ].some(e => evento.includes(e));

  if (!isAlteracao) return null;

  // Extrai nova etapa (Tintim pode enviar em estruturas diferentes)
  const novoStatus =
    payload.lead_status?.name ||
    payload.data?.lead_status?.name ||
    payload.stage?.name ||
    payload.data?.stage?.name ||
    payload.status ||
    null;

  if (!novoStatus) return null;

  // Extrai telefone do lead
  const contato = payload.contact || payload.customer || payload.data?.contact || {};
  const telefone = contato.phone || contato.whatsapp || contato.number || payload.from || '';

  if (!telefone) return null;

  // Extrai número de destino (qual WhatsApp do cliente recebeu)
  const numeroDestino =
    payload.account_phone ||
    payload.data?.account?.phone ||
    contato.to ||
    payload.to ||
    '';

  // Extrai valor monetário se a etapa for Pagamento Confirmado
  // O Tintim captura o valor quando o atendente digita "Pagamento confirmado R$ 4.800"
  const valor = payload.sale_value || payload.data?.sale_value || null;

  return { telefone, novoStatus, numeroDestino, valor };
}

// ── Normaliza payload de novo lead ────────────────────────────────────────────
function _normalizarLead(payload) {
  const eventosLead = ['new_conversation', 'new_message', 'contact_created'];
  const tipoEvento  = payload.event || payload.type || payload.hook_event || '';

  if (tipoEvento && !eventosLead.some(e => tipoEvento.includes(e))) return null;

  const contato = payload.contact || payload.customer || payload.data?.contact || payload;

  return {
    nome:            contato.name || contato.nome || '',
    numero:          contato.phone || contato.whatsapp || contato.number || payload.from || '',
    numeroDestino:   contato.to || payload.to || payload.account_phone || '',
    cidade:          contato.city || contato.cidade || '',
    produto:         contato.custom_field_produto || '',
    mensagemInicial: payload.message?.text || payload.body || '',
  };
}

// ── Formata número para padrão brasileiro ─────────────────────────────────────
function _formatarTelefone(numero) {
  if (!numero) return '';
  const digits = numero.replace(/\D/g, '');
  const local = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits;
  if (local.length === 11) return `(${local.slice(0,2)}) ${local.slice(2,7)}-${local.slice(7)}`;
  if (local.length === 10) return `(${local.slice(0,2)}) ${local.slice(2,6)}-${local.slice(6)}`;
  return numero;
}
