/**
 * clickup-agent-dispatcher.js — Comment → Agent Orchestration
 *
 * Fluxo:
 * 1. Alguém comenta numa task do ClickUp
 * 2. Webhook dispara → POST /api/clickup-agent-dispatcher
 * 3. Claude lê o comentário e entende o que foi pedido
 * 4. Claude retorna: { agent, params, summary }
 * 5. Chamamos o VPS /api/run-worker com o agent correto
 * 6. Resultado postado de volta no ClickUp como comentário
 *
 * Exemplos de comentários que ativam agentes:
 *   "Gera uma copy nova para os anúncios"   → gerar-copy-ads
 *   "Faz o deploy da LP"                    → deploy-lp
 *   "Monitora os ads agora"                 → monitorar-ads
 *   "Gera o relatório de performance"       → relatorio-ads
 *   "Verifica se a LP tá no ar"             → verificar-lp
 *   "Exporta os leads para o Meta"          → exportar-leads-meta
 */

const CLICKUP_KEY   = process.env.CLICKUP_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const VPS_URL       = process.env.VPS_URL       || 'http://129.121.45.61:3030';
const WORKER_SECRET = process.env.WORKER_SECRET  || '';

// ── AGENTES DISPONÍVEIS ───────────────────────────────────────
const AGENTS = {
  'monitorar-ads': {
    desc: 'Monitora performance dos anúncios Meta — verifica CPL, CTR, CPM vs metas',
    agent: 'Theo', handle: '@theo', role: 'Traffic Manager',
    keywords: ['monitora', 'monitorar', 'checar ads', 'verificar ads', 'performance ads', 'como estão os anúncios', 'ads hoje'],
  },
  'relatorio-ads': {
    desc: 'Gera relatório HTML de performance de anúncios com análise quinzenal',
    agent: 'Alex', handle: '@alex', role: 'Analyst',
    keywords: ['relatório', 'relatorio', 'report', 'performance', 'resumo de ads', 'resultados'],
  },
  'gerar-copy-ads': {
    desc: 'Gera copy para anúncios Meta usando 7 Pilares Pedro Sobral',
    agent: 'Theo', handle: '@theo', role: 'Traffic Manager',
    keywords: ['copy', 'copia', 'texto de anúncio', 'copy de ad', 'gera copy', 'novo criativo', 'copy ads'],
  },
  'gerar-lp': {
    desc: 'Gera a landing page HTML da empresa (sem fazer upload)',
    agent: 'Uma', handle: '@uma', role: 'UX Designer',
    keywords: ['gera lp', 'gerar lp', 'landing page', 'página de vendas', 'nova lp', 'criar lp', 'gera a página'],
  },
  'deploy-lp': {
    desc: 'Faz o deploy da LP via FTP para o servidor (coloca a página no ar)',
    agent: 'Uma', handle: '@uma', role: 'UX Designer',
    keywords: ['deploy', 'sobe a lp', 'publica', 'coloca no ar', 'atualiza o site', 'ftp', 'publicar lp'],
  },
  'verificar-lp': {
    desc: 'Verifica se a landing page está online e respondendo (HTTP 200)',
    agent: 'Uma', handle: '@uma', role: 'UX Designer',
    keywords: ['verifica lp', 'site no ar', 'lp online', 'site funcionando', 'checar site', 'verificar site'],
  },
  'exportar-leads': {
    desc: 'Exporta leads do Google Sheets para Custom Audiences do Meta Ads',
    agent: 'Alex', handle: '@alex', role: 'Analyst',
    keywords: ['exporta leads', 'exportar leads', 'audience', 'custom audience', 'leads para meta', 'público personalizado'],
  },
  'gerar-copy': {
    desc: 'Gera copy completo para a landing page usando Claude',
    agent: 'Theo', handle: '@theo', role: 'Traffic Manager',
    keywords: ['copy da lp', 'copy da landing', 'texto da página', 'copy completo'],
  },
};

const AGENTS_LIST = Object.entries(AGENTS)
  .map(([id, a]) => `- ${id}: ${a.desc}`)
  .join('\n');

// ── HELPERS ClickUp ───────────────────────────────────────────
async function clickupGet(path) {
  const r = await fetch(`https://api.clickup.com/api/v2${path}`, {
    headers: { Authorization: CLICKUP_KEY },
  });
  if (!r.ok) throw new Error(`ClickUp GET ${path} → ${r.status}`);
  return r.json();
}

async function clickupComment(taskId, text) {
  const r = await fetch(`https://api.clickup.com/api/v2/task/${taskId}/comment`, {
    method: 'POST',
    headers: { Authorization: CLICKUP_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ comment_text: text, notify_all: false }),
  });
  if (!r.ok) throw new Error(`ClickUp comment ${r.status}: ${await r.text()}`);
}

// ── HELPER: Claude identifica intent ─────────────────────────
async function identifyIntent(commentText, taskName, listName) {
  const prompt = `Você é um dispatcher de agentes de automação de marketing digital.

Agentes disponíveis:
${AGENTS_LIST}

Contexto da task:
- Task: "${taskName}"
- Lista: "${listName}"
- Comentário recebido: "${commentText}"

Sua tarefa: identifique se o comentário está pedindo para executar algum agente.

Responda APENAS com JSON válido, sem markdown, sem explicação:
- Se for um comando: {"agent":"<id-do-agent>","cliente":"concrenor","summary":"<o que foi entendido em 1 frase>"}
- Se NÃO for um comando (só uma pergunta, observação, feedback): {"agent":null}

Regras:
- Seja liberal na interpretação — se parece um pedido de ação, é um comando
- Sempre use cliente "concrenor" a menos que outro seja mencionado
- Escolha o agente mais adequado ao pedido`;

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      system: prompt,
      messages: [{ role: 'user', content: commentText }],
    }),
  });

  if (!r.ok) {
    const err = await r.text();
    throw new Error(`Claude ${r.status}: ${err.slice(0, 200)}`);
  }

  const data = await r.json();
  const text = data.content?.[0]?.text || '{"agent":null}';

  try {
    return JSON.parse(text.trim());
  } catch {
    // Tenta extrair JSON mesmo com texto ao redor
    const match = text.match(/\{[\s\S]+\}/);
    return match ? JSON.parse(match[0]) : { agent: null };
  }
}

// ── HELPER: Executa agente no VPS ────────────────────────────
async function runAgentOnVPS(script, cliente) {
  const r = await fetch(`${VPS_URL}/api/run-worker`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: WORKER_SECRET, script, cliente }),
  });
  if (!r.ok) throw new Error(`VPS run-worker ${r.status}: ${await r.text()}`);
  return r.json();
}

// ── MAIN HANDLER ──────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { event, task_id, history_items } = req.body || {};

  // Só processar comentários novos
  if (event !== 'taskCommentPosted' || !task_id) {
    return res.status(200).json({ skipped: true, reason: event || 'no_event' });
  }

  if (!CLICKUP_KEY || !ANTHROPIC_KEY) {
    return res.status(500).json({ error: 'credentials_missing' });
  }

  try {
    // 1. Pegar o texto do comentário
    // O history_items contém o comentário recém-postado
    const commentData = history_items?.[0];
    const commentText = commentData?.comment?.comment_text
      || commentData?.comment?.text_content
      || commentData?.data
      || '';

    if (!commentText) {
      return res.status(200).json({ skipped: true, reason: 'empty_comment' });
    }

    // Ignorar comentários do próprio bot (múltiplas assinaturas)
    const BOT_SIGNATURES = [
      '_Dispatcher — Escalando Premoldados_',
      '_Gerado automaticamente pelo sistema Escalando',
      '🤖 **Dispatcher**',
      '**Análise Automática',
      'Executando **',
      'Aguarde o resultado.',
      '❌ **Erro ao executar',
      '❌ **Erro interno do Dispatcher',
      'não entendeu o pedido',
      'Pode explicar o que precisa?',
    ];
    if (BOT_SIGNATURES.some(sig => commentText.includes(sig))) {
      return res.status(200).json({ skipped: true, reason: 'bot_comment' });
    }

    // 2. Buscar contexto da task
    const task = await clickupGet(`/task/${task_id}`);
    const taskName = task.name || '';
    const listName = task.list?.name || '';

    console.log(`[dispatcher] Comentário em "${taskName}" (${listName}): "${commentText.slice(0, 80)}"`);

    // 3. Claude identifica o intent
    const intent = await identifyIntent(commentText, taskName, listName);
    console.log(`[dispatcher] Intent:`, JSON.stringify(intent));

    if (!intent.agent) {
      // Não entendeu o comando — pede para explicar melhor
      const agentsList = Object.entries(AGENTS)
        .map(([id, a]) => `${a.handle} **${a.agent}** — ${a.desc}`)
        .join('\n');
      await clickupComment(task_id,
        `👋 Oi! Não entendi bem o que você precisa.\n\nPode reformular? Aqui está o que consigo fazer:\n\n${agentsList}\n\n_Exemplo: "verifica se a LP tá no ar" ou "gera um relatório de performance"_\n\n---\n_Dispatcher — Escalando Premoldados_`
      );
      return res.status(200).json({ skipped: true, reason: 'not_a_command', comment: commentText.slice(0, 100) });
    }

    // 4. Feedback imediato: "entendi, executando..."
    const agentInfo = AGENTS[intent.agent] || {};
    const agentLabel = agentInfo.agent
      ? `**${agentInfo.agent}** (${agentInfo.handle}) — ${agentInfo.role}`
      : intent.agent;
    await clickupComment(task_id,
      `🤖 **Dispatcher** entendeu: _${intent.summary}_\n\nExecutando ${agentLabel} · script \`${intent.agent}\` · cliente **${intent.cliente}**...\n_Aguarde o resultado._`
    );

    // 5. Executar agente no VPS
    let result;
    try {
      result = await runAgentOnVPS(intent.agent, intent.cliente);
    } catch (vpsErr) {
      // NÃO posta no ClickUp — causaria loop de webhook
      console.error(`[dispatcher] VPS error for ${intent.agent}:`, vpsErr.message);
      return res.status(200).json({ ok: false, error: vpsErr.message });
    }

    // 6. Postar resultado
    const statusIcon = result.ok ? '✅' : '⚠️';
    const outputBlock = result.output
      ? `\n\n**Output:**\n\`\`\`\n${result.output.slice(0, 1500)}\n\`\`\``
      : '';

    await clickupComment(task_id,
      `${statusIcon} ${agentLabel} concluiu \`${intent.agent}\` (exit ${result.exitCode})${outputBlock}\n\n---\n_Dispatcher — Escalando Premoldados_`
    );

    return res.status(200).json({ ok: true, agent: intent.agent, exitCode: result.exitCode });

  } catch (err) {
    // NÃO posta erro no ClickUp (causaria loop de webhook)
    // Erro fica no log do Vercel
    console.error('[dispatcher] Erro:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
