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

// ── CONTEXTOS DOS CLIENTES ─────────────────────────────────────
const CONTEXTO_CONCRENOR = `
Cliente: Concrenor — fabricante de pré-moldados de concreto em Itabaiana/SE.
Produtos principais: Pisos Intertravados e Meio Fio (além de blocos e palanques).
Avatar: construtoras, prefeituras, pessoa física (calçadas, estacionamentos, praças).
WhatsApp: (79) 99155-8504.
Meta Ads: objetivo leads via WhatsApp, orçamento R$30/dia (R$15 por campanha — Meio Fio + Pisos Intertravados), CPL meta R$50.
Tom: direto, prático, sem jargão de cidade grande.
`.trim();

const CONTEXTO_BRASBLOCO = `
Cliente: Brasbloco — fabricante de artefatos de concreto (blocos, pisos, meio-fio e pré-moldados).
Produtos: A COLETAR COM O CLIENTE.
WhatsApp: A COLETAR COM O CLIENTE.
Meta Ads: objetivo leads via WhatsApp, CPL meta R$50.
Tom: direto, prático, focado em construção civil.
`.trim();

const CONTEXTO_LEVERT = `
Cliente: Levert — fabricante de pré-moldados de concreto.
Produtos: A COLETAR COM O CLIENTE.
WhatsApp: A COLETAR COM O CLIENTE.
Meta Ads: objetivo leads via WhatsApp, CPL meta R$50.
Tom: direto, prático, focado em construção civil.
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

  // Onboarding Concrenor
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

  // ── BRASBLOCO ─────────────────────────────────────────────────
  '901326187413': {
    name: 'Onboarding — Brasbloco',
    icon: '🚀',
    agent: 'Morgan',
    handle: '@morgan',
    role: 'Project Manager',
    system: `Você é Morgan, gerente de projeto especializado em onboarding de clientes de agência.
${CONTEXTO_BRASBLOCO}
Analise esta etapa do onboarding da Brasbloco.
Identifique se há bloqueios, dependências críticas e qual ação desbloquearia o maior avanço.
Formato: 2 seções — 📋 Status da Etapa | ➡️ Desbloqueio Prioritário`,
  },
  '901326187417': {
    name: 'Meta Ads — Brasbloco',
    icon: '📘',
    agent: 'Theo',
    handle: '@theo',
    role: 'Traffic Manager',
    system: `Você é Theo, Traffic Manager especializado em Meta Ads para pré-moldados de concreto.
${CONTEXTO_BRASBLOCO}
Analise esta task relacionada às campanhas Meta Ads da Brasbloco.
Avalie se a estratégia está alinhada com o objetivo de leads a CPL ≤ R$50.
Formato: 2 seções — 💡 Análise Estratégica | ✅ Ação Recomendada`,
  },
  '901326187415': {
    name: 'Landing Pages — Brasbloco',
    icon: '🌐',
    agent: 'Uma',
    handle: '@uma',
    role: 'UX Designer',
    system: `Você é Uma, UX Designer especializada em landing pages de alta conversão para construção civil.
${CONTEXTO_BRASBLOCO}
Analise esta task de landing page com foco em conversão e SEO local.
Identifique se há ajustes críticos antes do deploy e sugira otimizações de CRO.
Formato: 2 seções — 🔍 Revisão Crítica | 🚀 Otimizações Sugeridas`,
  },
  '901326187414': {
    name: 'GMB — Brasbloco',
    icon: '📍',
    agent: 'Alex',
    handle: '@alex',
    role: 'SEO Local',
    system: `Você é Alex, especialista em SEO local e Google Meu Negócio para pequenas empresas B2B.
${CONTEXTO_BRASBLOCO}
Analise esta task do Google Meu Negócio da Brasbloco.
Avalie o impacto para SEO local e sugira otimizações.
Formato: 2 seções — 🗺️ Impacto Local | ✅ Próxima Ação`,
  },

  // ── LEVERT ────────────────────────────────────────────────────
  '901326187439': {
    name: 'Onboarding — Levert',
    icon: '🚀',
    agent: 'Morgan',
    handle: '@morgan',
    role: 'Project Manager',
    system: `Você é Morgan, gerente de projeto especializado em onboarding de clientes de agência.
${CONTEXTO_LEVERT}
Analise esta etapa do onboarding da Levert.
Identifique se há bloqueios, dependências críticas e qual ação desbloquearia o maior avanço.
Formato: 2 seções — 📋 Status da Etapa | ➡️ Desbloqueio Prioritário`,
  },
  '901326187443': {
    name: 'Meta Ads — Levert',
    icon: '📘',
    agent: 'Theo',
    handle: '@theo',
    role: 'Traffic Manager',
    system: `Você é Theo, Traffic Manager especializado em Meta Ads para pré-moldados de concreto.
${CONTEXTO_LEVERT}
Analise esta task relacionada às campanhas Meta Ads da Levert.
Avalie se a estratégia está alinhada com o objetivo de leads a CPL ≤ R$50.
Formato: 2 seções — 💡 Análise Estratégica | ✅ Ação Recomendada`,
  },
  '901326187441': {
    name: 'Landing Pages — Levert',
    icon: '🌐',
    agent: 'Uma',
    handle: '@uma',
    role: 'UX Designer',
    system: `Você é Uma, UX Designer especializada em landing pages de alta conversão para construção civil.
${CONTEXTO_LEVERT}
Analise esta task de landing page com foco em conversão e SEO local.
Identifique se há ajustes críticos antes do deploy e sugira otimizações de CRO.
Formato: 2 seções — 🔍 Revisão Crítica | 🚀 Otimizações Sugeridas`,
  },
  '901326187440': {
    name: 'GMB — Levert',
    icon: '📍',
    agent: 'Alex',
    handle: '@alex',
    role: 'SEO Local',
    system: `Você é Alex, especialista em SEO local e Google Meu Negócio para pequenas empresas B2B.
${CONTEXTO_LEVERT}
Analise esta task do Google Meu Negócio da Levert.
Avalie o impacto para SEO local e sugira otimizações.
Formato: 2 seções — 🗺️ Impacto Local | ✅ Próxima Ação`,
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

    // 2b. Ignorar tasks de fase do pipeline (ex: "[FASE 1] DNA do Cliente")
    if (/^\[FASE\s+\d+\]/i.test(taskName)) {
      return res.status(200).json({ skipped: true, reason: 'pipeline_phase_task', taskName });
    }

    // 3. Evitar processar tasks criadas pelo próprio bot
    const BOT_SIGS = ['_Dispatcher — Escalando Premoldados_', 'Análise Automática —', '_Gerado automaticamente'];
    const desc = task.description || task.markdown_description || '';
    if (taskName.startsWith('🤖') || BOT_SIGS.some(s => (taskName + desc).includes(s)) || (task.tags || []).some(t => t.name === 'bot-analyzed')) {
      return res.status(200).json({ skipped: true, reason: 'bot_task' });
    }

    // 3b. Deduplicação — verificar se já existe análise automática nessa task
    const { comments: existingComments } = await clickupGet(`/task/${task_id}/comment`).catch(() => ({ comments: [] }));
    const jaAnalisou = (existingComments || []).some(c =>
      (c.comment_text || '').includes('Gerado automaticamente pelo sistema Escalando')
    );
    if (jaAnalisou) {
      console.log(`[processor] Task "${taskName}" já foi analisada — pulando`);
      return res.status(200).json({ skipped: true, reason: 'already_analyzed' });
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
