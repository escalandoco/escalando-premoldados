/**
 * ESCALANDO PREMOLDADOS — Sistema de Notificações
 *
 * Cria tasks na lista "🔔 Notificações" no ClickUp.
 * Jon recebe push notification no celular e marca como concluído.
 *
 * Lista: 🔔 Notificações (ID: 901326304836)
 * Space: OPERAÇÃO (ID: 901313601522)
 */

// Usa a key do BOT como criador → Jon recebe push notification de assignee
const CLICKUP_API_KEY  = process.env.CLICKUP_BOT_API_KEY || process.env.CLICKUP_API_KEY;
const LISTA_NOTIF_ID   = process.env.CLICKUP_LIST_NOTIF || '901326304836';
const JON_USER_ID      = 84613660;
const BASE_URL         = 'https://api.clickup.com/api/v2';

// Prioridade: 1=urgent 2=high 3=normal 4=low
const PRIORIDADE = { urgent: 1, high: 2, normal: 3, low: 4 };

/**
 * Cria uma task de notificação no ClickUp.
 * @param {string} titulo   Título da task
 * @param {string} descricao Descrição detalhada
 * @param {'urgent'|'high'|'normal'|'low'} prioridade
 * @returns {Promise<{ok: boolean, taskId?: string, error?: string}>}
 */
export async function notify(titulo, descricao = '', prioridade = 'normal') {
  if (!CLICKUP_API_KEY) {
    console.warn('[Notify] CLICKUP_API_KEY não configurada.');
    return { ok: false, error: 'CLICKUP_API_KEY ausente' };
  }

  try {
    const res = await fetch(`${BASE_URL}/list/${LISTA_NOTIF_ID}/task`, {
      method: 'POST',
      headers: {
        Authorization: CLICKUP_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: titulo,
        description: descricao,
        priority: PRIORIDADE[prioridade] ?? 3,
        notify_all: true,
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      console.error('[Notify] Erro ao criar task:', JSON.stringify(json));
      return { ok: false, error: JSON.stringify(json) };
    }

    // Posta comentário com @menção para garantir push notification no celular
    await fetch(`${BASE_URL}/task/${json.id}/comment`, {
      method: 'POST',
      headers: { Authorization: CLICKUP_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        comment_text: `@Jon Godeiro — ${titulo}. Marque como concluído ao conferir.`,
        assignee: JON_USER_ID,
        notify_all: true,
      }),
    }).catch(() => {});

    console.log(`[Notify] ✅ Task criada: "${titulo}" (${json.id})`);
    return { ok: true, taskId: json.id };

  } catch (err) {
    console.error('[Notify] Falha:', err.message);
    return { ok: false, error: err.message };
  }
}

// ── NOTIFICAÇÕES PRONTAS ──────────────────────────────────────────────────────

export const MSG = {
  // Gate A passou
  gateAJon: (empresa) => ({
    titulo: `✅ Kickoff liberado — ${empresa}`,
    descricao: `Pagamento confirmado.\n\nTask de Kickoff criada no ClickUp com o link do formulário.\nAgende a reunião com o cliente.`,
    prioridade: 'high',
  }),

  // Gate A falhou
  gateAFalha: (empresa, campos) => ({
    titulo: `⚠️ Gate A falhou — ${empresa}`,
    descricao: `Ficha do cliente incompleta. Campos faltando:\n${campos.map(c => `• ${c}`).join('\n')}`,
    prioridade: 'urgent',
  }),

  // Gate B passou
  gateBJon: (empresa) => ({
    titulo: `📋 Kickoff concluído — ${empresa}`,
    descricao: `Briefing registrado com sucesso.\nAguardando recebimento das fotos do cliente para liberar a produção.`,
    prioridade: 'normal',
  }),

  // Gate B falhou
  gateBFalha: (empresa, campos) => ({
    titulo: `⚠️ Gate B falhou — ${empresa}`,
    descricao: `Briefing incompleto. Campos faltando:\n${campos.map(c => `• ${c}`).join('\n')}`,
    prioridade: 'urgent',
  }),

  // Gate C passou
  gateCJon: (empresa) => ({
    titulo: `🚀 ${empresa} pronto para produção!`,
    descricao: `Todos os gates de onboarding passaram:\n✅ Kickoff concluído\n✅ Fotos recebidas\n\nTasks criadas nos squads de LP e Tráfego.`,
    prioridade: 'high',
  }),

  // Gate C falhou
  gateCFalha: (empresa, itens) => ({
    titulo: `⚠️ Gate C falhou — ${empresa}`,
    descricao: `Falta para liberar produção:\n${itens.map(i => `• ${i}`).join('\n')}`,
    prioridade: 'urgent',
  }),

  // Cliente parado > 48h
  alertaParado: (empresa, gate, horas) => ({
    titulo: `⏰ Cliente parado — ${empresa}`,
    descricao: `Parado no ${gate} há ${horas}h sem avanço.\n\nVerifique o ClickUp e entre em contato com o cliente.`,
    prioridade: 'high',
  }),

  // Erro inesperado
  erroSistema: (empresa, gate, mensagem) => ({
    titulo: `❌ Erro no ${gate} — ${empresa}`,
    descricao: `Erro inesperado:\n${mensagem}`,
    prioridade: 'urgent',
  }),
};

/**
 * Atalho: cria notificação a partir de um objeto MSG
 * Uso: await notifyMsg(MSG.gateCJon('Concrenor'))
 */
export async function notifyMsg({ titulo, descricao, prioridade }) {
  return notify(titulo, descricao, prioridade);
}
