/**
 * ESCALANDO PREMOLDADOS — Meta Conversions API (server-side)
 *
 * Recebe eventos do browser e envia para a Meta CAPI server-side.
 * Deduplicado com o pixel browser via event_id.
 *
 * POST /api/events
 * {
 *   event_name:       "Contact" | "Lead" | "PageView",
 *   event_id:         "contact_1234567890_abc123",  // mesmo id enviado ao fbq()
 *   pixel_id:         "1234567890",                 // Pixel ID do cliente
 *   event_source_url: "https://lp.escalando.co/...",
 *   user_data: {
 *     fbc:   "_fbc cookie value",   // optional
 *     fbp:   "_fbp cookie value",   // optional
 *     ph:    "telefone raw",        // hashed no servidor
 *     em:    "email raw",           // hashed no servidor (se disponível)
 *   }
 * }
 */

import crypto from 'crypto';

function sha256(value) {
  if (!value) return undefined;
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

function normalizePhone(phone) {
  if (!phone) return null;
  // Remove tudo que não é dígito
  let digits = phone.replace(/\D/g, '');
  // Garante DDI 55 (Brasil)
  if (!digits.startsWith('55')) digits = '55' + digits;
  return digits;
}

export default async function handler(req, res) {
  // CORS — LP serve de domínio diferente
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = process.env.META_CAPI_TOKEN;
  if (!token) {
    console.warn('[events] META_CAPI_TOKEN não configurado');
    return res.status(200).json({ success: true, skipped: true, reason: 'token_not_configured' });
  }

  const {
    event_name,
    event_id,
    pixel_id,
    event_source_url = '',
    user_data = {},
  } = req.body || {};

  if (!event_name) return res.status(400).json({ error: 'event_name é obrigatório' });
  if (!pixel_id)   return res.status(400).json({ error: 'pixel_id é obrigatório' });

  const clientIp = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || req.socket?.remoteAddress
    || '';

  const clientUserAgent = req.headers['user-agent'] || '';

  // Monta user_data com hash server-side
  const capiUserData = {
    client_ip_address: clientIp,
    client_user_agent: clientUserAgent,
  };

  if (user_data.fbc) capiUserData.fbc = user_data.fbc;
  if (user_data.fbp) capiUserData.fbp = user_data.fbp;
  if (user_data.ph)  capiUserData.ph  = [sha256(normalizePhone(user_data.ph))].filter(Boolean);
  if (user_data.em)  capiUserData.em  = [sha256(user_data.em)].filter(Boolean);

  const event = {
    event_name,
    event_time:       Math.floor(Date.now() / 1000),
    event_id:         event_id || `${event_name}_${Date.now()}`,
    action_source:    'website',
    event_source_url,
    user_data:        capiUserData,
  };

  try {
    const response = await fetch(
      `https://graph.facebook.com/v19.0/${pixel_id}/events`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data:         [event],
          access_token: token,
        }),
      }
    );

    const json = await response.json();

    if (!response.ok) {
      console.error('[events] Meta CAPI error:', JSON.stringify(json));
      return res.status(500).json({ error: 'meta_api_error', details: json });
    }

    console.log(`[events] ${event_name} enviado | pixel=${pixel_id} | events_received=${json.events_received}`);
    return res.json({ success: true, events_received: json.events_received });

  } catch (err) {
    console.error('[events] fetch error:', err.message);
    // Retorna 200 para não quebrar o fluxo do usuário no browser
    return res.status(200).json({ success: false, error: err.message });
  }
}
