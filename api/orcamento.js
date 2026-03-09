/**
 * ESCALANDO PREMOLDADOS — Endpoint de Orçamento
 * POST /api/orcamento
 *
 * Recebe dados do formulário de orçamento e:
 *  1. Registra nova linha na aba "Orçamentos" da planilha do cliente
 *  2. Atualiza Status do lead na aba "Leads" → "Orçamento Enviado"
 */

import { registrarOrcamento, atualizarStatusLead } from './google-drive.js';

const CLIENTES = {
  concrenor: 'Concrenor',
  brasbloco: 'Brasbloco',
  levert:    'Levert',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const { cliente, nome, telefone, regiao, itens, frete, prazo, obs } = req.body || {};

  const empresa = CLIENTES[(cliente || '').toLowerCase()];
  if (!empresa) return res.status(400).json({ ok: false, error: `Cliente inválido: "${cliente}"` });
  if (!telefone) return res.status(400).json({ ok: false, error: 'Telefone é obrigatório' });

  try {
    const result = await registrarOrcamento(empresa, {
      canal: 'Formulário Web',
      nome:     nome     || '',
      telefone: telefone || '',
      regiao:   regiao   || '',
      itens:    itens    || [],
      frete:    parseFloat(frete) || 0,
      prazo:    prazo    || '',
      obs:      obs      || '',
    });

    // Atualiza Status do lead → "Orçamento Enviado" (best-effort)
    try {
      await atualizarStatusLead(empresa, telefone, 'Orçamento Enviado', null);
    } catch (e) {
      console.warn('[orcamento] lead não encontrado para atualizar status:', e.message);
    }

    console.log(`[orcamento] ${empresa} | ${nome} | ${telefone}`);
    return res.status(200).json({ ok: true, ...result });

  } catch (err) {
    console.error('[orcamento]', err.message);
    return res.status(200).json({ ok: false, error: err.message });
  }
}
