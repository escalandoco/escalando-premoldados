/**
 * ESCALANDO PREMOLDADOS — ClickUp Status Change Webhook
 * Vercel Serverless Function
 *
 * POST /api/clickup-status-change
 *
 * Configurar no ClickUp:
 *   Settings → Integrations → Webhooks → Add Webhook
 *   URL: https://escalando-premoldados.vercel.app/api/clickup-status-change
 *   Events: taskStatusUpdated
 *
 * Dispara:
 *   Gate A → quando "💰 Confirmar Pagamento — {cliente}" → complete
 *   Gate C → quando "📸 Fotos Recebidas — {cliente}" → complete
 */

import { gateA, gateC } from '../scripts/onboarding-gate.js';
import { gateLp1, gateLp2, gateLp3, gateLp4, gateLp5 } from '../scripts/lp-gate.js';
import { gateMaA, gateMaB, gateMaC, gateMaD, gateMaE, gateMaF, gateMaG } from '../scripts/meta-ads-gate.js';

const CLICKUP_API_KEY = process.env.CLICKUP_API_KEY;
const WEBHOOK_SECRET  = process.env.CLICKUP_WEBHOOK_SECRET || '';
const BASE_URL        = 'https://api.clickup.com/api/v2';

async function cu(method, path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: method.toUpperCase(),
    headers: { Authorization: CLICKUP_API_KEY, 'Content-Type': 'application/json' },
  });
  return res.json();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  try {
    const payload = req.body;

    // Verifica se é evento de status change
    if (payload.event !== 'taskStatusUpdated') {
      return res.status(200).json({ skip: true, reason: 'Evento ignorado' });
    }

    // Só processa se novo status é "complete" ou equivalente
    const novoStatus = (payload.history_items?.[0]?.after?.status || '').toLowerCase();
    const STATUS_DONE = ['complete', 'done', 'concluído', 'concluida'];
    if (!STATUS_DONE.some(s => novoStatus.includes(s))) {
      return res.status(200).json({ skip: true, reason: `Status "${novoStatus}" não é conclusão` });
    }

    // Busca detalhes da task
    const taskId   = payload.task_id;
    const taskData = await cu('get', `/task/${taskId}`);
    const taskName = taskData.name || '';

    console.log(`[status-change] Task: "${taskName}" → ${novoStatus}`);

    // ── Gate A: Confirmar Pagamento ─────────────────────────
    if (taskName.startsWith('💰 Confirmar Pagamento')) {
      const empresa = extrairEmpresa(taskName, '💰 Confirmar Pagamento');
      if (!empresa) return res.status(200).json({ skip: true, reason: 'Empresa não identificada' });

      // Busca WhatsApp do cliente na descrição da task
      const whatsappCliente = extrairWhatsApp(taskData.description || '');

      console.log(`[status-change] Disparando Gate A para: ${empresa}`);
      const result = await gateA(empresa, whatsappCliente);
      return res.status(200).json({ gate: 'A', empresa, ...result });
    }

    // ── Gate C: Fotos Recebidas ─────────────────────────────
    if (taskName.startsWith('📸 Fotos Recebidas')) {
      const empresa = extrairEmpresa(taskName, '📸 Fotos Recebidas');
      if (!empresa) return res.status(200).json({ skip: true, reason: 'Empresa não identificada' });

      console.log(`[status-change] Disparando Gate C para: ${empresa}`);
      const result = await gateC(empresa);
      return res.status(200).json({ gate: 'C', empresa, ...result });
    }

    // ── Gate LP-1: LP Briefing ──────────────────────────────
    if (taskName.startsWith('📝 LP Briefing')) {
      const empresa = extrairEmpresa(taskName, '📝 LP Briefing');
      if (!empresa) return res.status(200).json({ skip: true, reason: 'Empresa não identificada' });
      console.log(`[status-change] Disparando Gate LP-1 para: ${empresa}`);
      const result = await gateLp1(empresa);
      return res.status(200).json({ gate: 'LP-1', empresa, ...result });
    }

    // ── Gate LP-2: Fase 1 — DNA do Cliente ─────────────────
    if (taskName.startsWith('[FASE 1]')) {
      const empresa = extrairEmpresaFase(taskName);
      if (!empresa) return res.status(200).json({ skip: true, reason: 'Empresa não identificada' });
      console.log(`[status-change] Disparando Gate LP-2 para: ${empresa}`);
      const result = await gateLp2(empresa);
      return res.status(200).json({ gate: 'LP-2', empresa, ...result });
    }

    // ── Gate LP-3: Fase 2 — Copy da LP ─────────────────────
    if (taskName.startsWith('[FASE 2]')) {
      const empresa = extrairEmpresaFase(taskName);
      if (!empresa) return res.status(200).json({ skip: true, reason: 'Empresa não identificada' });
      console.log(`[status-change] Disparando Gate LP-3 para: ${empresa}`);
      const result = await gateLp3(empresa);
      return res.status(200).json({ gate: 'LP-3', empresa, ...result });
    }

    // ── Gate LP-4: Fase 3 — Identidade Visual ──────────────
    if (taskName.startsWith('[FASE 3]')) {
      const empresa = extrairEmpresaFase(taskName);
      if (!empresa) return res.status(200).json({ skip: true, reason: 'Empresa não identificada' });
      console.log(`[status-change] Disparando Gate LP-4 para: ${empresa}`);
      const result = await gateLp4(empresa);
      return res.status(200).json({ gate: 'LP-4', empresa, ...result });
    }

    // ── Gate LP-5: Fase 4 — Geração da LP ──────────────────
    if (taskName.startsWith('[FASE 4]')) {
      const empresa = extrairEmpresaFase(taskName);
      if (!empresa) return res.status(200).json({ skip: true, reason: 'Empresa não identificada' });
      console.log(`[status-change] Disparando Gate LP-5 para: ${empresa}`);
      const result = await gateLp5(empresa);
      return res.status(200).json({ gate: 'LP-5', empresa, ...result });
    }

    // ── Gates Meta Ads ──────────────────────────────────────
    // MA-A: Coletar Acessos → Briefing + Benchmarking
    if (taskName.startsWith('🔑 Coletar Acessos')) {
      const empresa = extrairEmpresa(taskName, '🔑 Coletar Acessos');
      if (!empresa) return res.status(200).json({ skip: true, reason: 'Empresa não identificada' });
      console.log(`[status-change] Disparando Gate MA-A para: ${empresa}`);
      const result = await gateMaA(empresa);
      return res.status(200).json({ gate: 'MA-A', empresa, ...result });
    }

    // MA-B: Briefing + Benchmarking → Estratégia + Nomenclatura
    if (taskName.startsWith('📊 Briefing + Benchmarking')) {
      const empresa = extrairEmpresa(taskName, '📊 Briefing + Benchmarking');
      if (!empresa) return res.status(200).json({ skip: true, reason: 'Empresa não identificada' });
      console.log(`[status-change] Disparando Gate MA-B para: ${empresa}`);
      const result = await gateMaB(empresa);
      return res.status(200).json({ gate: 'MA-B', empresa, ...result });
    }

    // MA-C: Estratégia + Nomenclatura → Copy dos Anúncios
    if (taskName.startsWith('📐 Estratégia + Nomenclatura')) {
      const empresa = extrairEmpresa(taskName, '📐 Estratégia + Nomenclatura');
      if (!empresa) return res.status(200).json({ skip: true, reason: 'Empresa não identificada' });
      console.log(`[status-change] Disparando Gate MA-C para: ${empresa}`);
      const result = await gateMaC(empresa);
      return res.status(200).json({ gate: 'MA-C', empresa, ...result });
    }

    // MA-D: Copy dos Anúncios → Criativos
    if (taskName.startsWith('✏️ Copy dos Anúncios')) {
      const empresa = extrairEmpresa(taskName, '✏️ Copy dos Anúncios');
      if (!empresa) return res.status(200).json({ skip: true, reason: 'Empresa não identificada' });
      console.log(`[status-change] Disparando Gate MA-D para: ${empresa}`);
      const result = await gateMaD(empresa);
      return res.status(200).json({ gate: 'MA-D', empresa, ...result });
    }

    // MA-E: Criativos → Go-Live (Fluxo B) ou Sync LP+Pixel (Fluxo A)
    if (taskName.startsWith('🎨 Criativos')) {
      const empresa = extrairEmpresa(taskName, '🎨 Criativos');
      if (!empresa) return res.status(200).json({ skip: true, reason: 'Empresa não identificada' });
      console.log(`[status-change] Disparando Gate MA-E para: ${empresa}`);
      const result = await gateMaE(empresa);
      return res.status(200).json({ gate: 'MA-E', empresa, ...result });
    }

    // MA-F: Sync LP + Pixel → Go-Live (Fluxo A)
    if (taskName.startsWith('🔗 Sync LP + Pixel')) {
      const empresa = extrairEmpresa(taskName, '🔗 Sync LP + Pixel');
      if (!empresa) return res.status(200).json({ skip: true, reason: 'Empresa não identificada' });
      console.log(`[status-change] Disparando Gate MA-F para: ${empresa}`);
      const result = await gateMaF(empresa);
      return res.status(200).json({ gate: 'MA-F', empresa, ...result });
    }

    // MA-G: Go-Live → Monitoramento D+7
    if (taskName.startsWith('🚀 Go-Live')) {
      const empresa = extrairEmpresa(taskName, '🚀 Go-Live');
      if (!empresa) return res.status(200).json({ skip: true, reason: 'Empresa não identificada' });
      console.log(`[status-change] Disparando Gate MA-G para: ${empresa}`);
      const result = await gateMaG(empresa);
      return res.status(200).json({ gate: 'MA-G', empresa, ...result });
    }

    // Task não mapeada para nenhum gate
    return res.status(200).json({ skip: true, reason: 'Task não mapeada para gate de onboarding' });

  } catch (err) {
    console.error('[status-change] Erro:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Extrai nome da empresa a partir do nome da task
// Ex: "💰 Confirmar Pagamento — Concrenor" → "Concrenor"
function extrairEmpresa(taskName, prefixo) {
  const partes = taskName.split(' — ');
  if (partes.length < 2) return null;
  return partes.slice(1).join(' — ').trim();
}

// Extrai empresa do nome de task de fase
// Ex: "[FASE 1] DNA do Cliente — Concrenor" → "Concrenor"
// Ex: "[FASE 1] DNA do Cliente" → null (campanha Geral sem sufixo de empresa)
function extrairEmpresaFase(taskName) {
  const partes = taskName.split(' — ');
  if (partes.length < 2) return null;
  return partes[partes.length - 1].trim();
}

// Tenta extrair número de WhatsApp da descrição da task
function extrairWhatsApp(desc) {
  const match = desc.match(/WhatsApp[:\s]+(\d[\d\s\-()]+\d)/i);
  if (!match) return null;
  return match[1].replace(/\D/g, '');
}
