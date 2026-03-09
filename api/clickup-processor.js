/**
 * clickup-processor.js — ClickUp → Claude AI Analysis Pipeline
 *
 * 1. ClickUp cria task em qualquer lista monitorada
 * 2. Webhook dispara → POST /api/clickup-processor
 * 3. Buscamos a task completa na API
 * 4. Claude analisa com contexto da lista e do cliente
 * 5. Comentário com análise + ação recomendada é postado na task
 *
 * POST /api/clickup-processor
 */

const CLICKUP_KEY     = process.env.CLICKUP_API_KEY;
const CLICKUP_BOT_KEY = process.env.CLICKUP_BOT_API_KEY || CLICKUP_KEY;
const ANTHROPIC_KEY   = process.env.ANTHROPIC_API_KEY;
const JON_USER_ID     = 84613660;

// ── CONTEXTO BASE — Concrenor ─────────────────────────────────
const CONTEXTO_CONCRENOR = `
Cliente: Concrenor — fabricante de mourão de concreto em Itabaiana/SE.
Produto principal: Mourão Torneado (dura 50+ anos, substitui eucalipto que apodrece em 5-7 anos).
Avatar: Antônio, fazendeiro 40-65 anos, Sergipe/Alagoas, 50-500 hectares de propriedade.
Dor: gasta R$8.000/ano repondo mourão de eucalipto, perde dias de trabalho, risco de gado fugir.
Meta Ads: objetivo leads, orçamento R$50/dia, CPL meta R$50, campanha CONCRENOR_DISCOVERY_MOURAO.
Tom: direto, prático, linguagem rural, sem jargão de cidade grande.
`.trim();

// ── PROMPTS POR LISTA ─────────────────────────────────────────
const LIST_PROMPTS = {
  // Ações do Dia — alertas dos workers
  '901326173208': {
    name: 'Ações do Dia',
    icon: '⚡',
    agent: 'Theo',
    handle: '@theo',
    role: 'Traffic Manager',
    system: `Você é Theo, Traffic Manager especializado em Meta Ads para o setor rural brasileiro.
${CONTEXTO_CONCRENOR}
Analise o alerta gerado automaticamente pelo sistema de monitoramento.
Seja direto: o que está fora do padrão, por que pode estar acontecendo e qual ação concreta tomar.
Formato: 3 seções — 📊 Diagnóstico | 🎯 Causa Provável | ✅ Ação Recomendada`,
  },

  // Relatórios — relatórios de performance
  '901326173211': {
    name: 'Relatórios',
    icon: '📈',
    agent: 'Alex',
    handle: '@alex',
    role: 'Analyst',
    system: `Você é Alex, Analyst de marketing digital especializado em tráfego pago rural.
${CONTEXTO_CONCRENOR}
Analise o relatório de performance e extraia os insights mais importantes.
O que está funcionando bem, o que precisa de atenção e qual a tendência para os próximos dias.
Formato: 3 seções — 🏆 Destaques | ⚠️ Pontos de Atenção | 📅 Próximos 15 dias`,
  },

  // Sucesso do Cliente — marcos e entregas
  '901326173213': {
    name: 'Sucesso do Cliente',
    icon: '🎯',
    agent: 'Morgan',
    handle: '@morgan',
    role: 'Customer Success',
    system: `Você é Morgan, o gerente de produto e sucesso do cliente da agência Escalando.
${CONTEXTO_CONCRENOR}
Analise este marco entregue para a Concrenor.
Avalie o impacto, o que isso habilita no projeto e qual deve ser o próximo passo imediato.
Formato: 2 seções — ✅ Impacto da Entrega | ➡️ Próximo Passo`,
  },

  // Landing Pages — criação e atualizações
  '901326092377': {
    name: 'Landing Pages',
    icon: '🌐',
    agent: 'Uma',
    handle: '@uma',
    role: 'UX Designer',
    system: `Você é Uma, UX Designer especializada em landing pages de alta conversão para o mercado rural.
${CONTEXTO_CONCRENOR}
Analise esta task de landing page com foco em conversão, experiência do fazendeiro e SEO local.
Identifique se há ajustes críticos antes do deploy e sugira otimizações de CRO.
Formato: 2 seções — 🔍 Revisão Crítica | 🚀 Otimizações Sugeridas`,
  },

  // Meta Ads — campanhas e anúncios
  '901326092379': {
    name: 'Meta Ads',
    icon: '📘',
    agent: 'Theo',
    handle: '@theo',
    role: 'Traffic Manager',
    system: `Você é Theo, Traffic Manager especializado em Meta Ads para o agronegócio.
${CONTEXTO_CONCRENOR}
Analise esta task relacionada às campanhas Meta Ads da Concrenor.
Avalie se a estratégia está alinhada com o objetivo de leads rurais a CPL ≤ R$50.
Formato: 2 seções — 💡 Análise Estratégica | ✅ Ação Recomendada`,
  },

  // GMB — Google Meu Negócio
  '901326092376': {
    name: 'GMB',
    icon: '📍',
    agent: 'Alex',
    handle: '@alex',
    role: 'SEO Local',
    system: `Você é Alex, especialista em SEO local e Google Meu Negócio para pequenas empresas B2B.
${CONTEXTO_CONCRENOR}
Analise esta task do Google Meu Negócio da Concrenor.
Avalie o impacto para SEO local em Sergipe/Alagoas e sugira otimizações.
Formato: 2 seções — 🗺️ Impacto Local | ✅ Próxima Ação`,
  },

  // Onboarding — processo de onboarding de cliente
  '901326092375': {
    name: 'Onboarding',
    icon: '🚀',
    agent: 'Morgan',
    handle: '@morgan',
    role: 'Project Manager',
    system: `Você é Morgan, gerente de projeto especializado em onboarding de clientes de agência.
${CONTEXTO_CONCRENOR}
Analise esta etapa do onboarding da Concrenor.
Identifique se há bloqueios, dependências críticas e qual ação desbloquearia o maior avanço.
Formato: 2 seções — 📋 Status da Etapa | ➡️ Desbloqueio Prioritário`,
  },
};

// ── HELPER: Fetch ClickUp ─────────────────────────────────────
async function clickupGet(path) {
  const r = await fetch(`https://api.clickup.com/api/v2${path}`, {
    headers: { Authorization: CLICKUP_KEY },
  });
  if (!r.ok) throw new Error(`ClickUp GET ${path} → ${r.status}`);
  return r.json();
}

async function clickupAddWatcher(taskId) {
  // Garante Jon como watcher para receber push notification
  await fetch(`https://api.clickup.com/api/v2/task/${taskId}`, {
    method: 'PUT',
    headers: { Authorization: CLICKUP_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ watchers: { add: [JON_USER_ID] } }),
  }).catch(() => {}); // silencia erro se já for watcher
}

async function clickupComment(taskId, text) {
  await clickupAddWatcher(taskId);
  const r = await fetch(`https://api.clickup.com/api/v2/task/${taskId}/comment`, {
    method: 'POST',
    headers: { Authorization: CLICKUP_BOT_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ comment_text: text, notify_all: true }),
  });
  if (!r.ok) throw new Error(`ClickUp comment → ${r.status}: ${await r.text()}`);
  return r.json();
}

// ── HELPER: Claude Analysis ───────────────────────────────────
async function analyzeWithClaude(systemPrompt, taskName, taskDescription) {
  const userMsg = `Task: "${taskName}"
${taskDescription ? `\nConteúdo:\n${taskDescription}` : '(sem descrição adicional)'}`;

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMsg }],
    }),
  });
  if (!r.ok) {
    const errBody = await r.text();
    throw new Error(`Claude API ${r.status}: ${errBody.slice(0, 200)}`);
  }
  const data = await r.json();
  return data.content?.[0]?.text || '';
}

// ── MAIN HANDLER ──────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { event, task_id } = req.body || {};

  // Só processar criação de tasks (evita loop em updates/comentários)
  if (event !== 'taskCreated' || !task_id) {
    return res.status(200).json({ skipped: true, reason: event || 'no_event' });
  }

  // Validar chaves
  if (!CLICKUP_KEY || !ANTHROPIC_KEY) {
    console.error('[processor] Credenciais não configuradas');
    return res.status(500).json({ error: 'credentials_missing' });
  }

  try {
    // 1. Buscar task completa
    const task = await clickupGet(`/task/${task_id}`);
    const listId = String(task.list?.id || '');
    const taskName = task.name || '';
    const taskDesc = task.description || task.markdown_description || '';

    console.log(`[processor] Task "${taskName}" em lista ${listId}`);

    // 2. Checar se lista tem prompt configurado
    const listCfg = LIST_PROMPTS[listId];
    if (!listCfg) {
      return res.status(200).json({ skipped: true, reason: 'list_not_monitored', listId });
    }

    // 3. Evitar processar tasks criadas pelo próprio bot
    const BOT_SIGS = ['_Dispatcher — Escalando Premoldados_', 'Análise Automática —', '_Gerado automaticamente'];
    const desc = task.description || task.markdown_description || '';
    if (taskName.startsWith('🤖') || BOT_SIGS.some(s => (taskName + desc).includes(s)) || (task.tags || []).some(t => t.name === 'bot-analyzed')) {
      return res.status(200).json({ skipped: true, reason: 'bot_task' });
    }

    // 4. Analisar com Claude
    const analysis = await analyzeWithClaude(listCfg.system, taskName, taskDesc);
    if (!analysis) throw new Error('Claude retornou análise vazia');

    // 5. Postar comentário na task
    const agentLine = listCfg.agent
      ? `**${listCfg.agent}** (${listCfg.handle}) — ${listCfg.role}`
      : listCfg.name;
    const comment = `${listCfg.icon} **Análise Automática — ${listCfg.name}**\n_por ${agentLine}_\n\n${analysis}\n\n---\n_Gerado automaticamente pelo sistema Escalando Premoldados_`;
    await clickupComment(task_id, comment);

    console.log(`[processor] ✓ Comentário postado na task "${taskName}"`);
    return res.status(200).json({ ok: true, task: taskName, list: listCfg.name });

  } catch (err) {
    console.error('[processor] Erro:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
