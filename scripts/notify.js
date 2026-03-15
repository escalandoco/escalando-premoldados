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
        assignees: [JON_USER_ID],
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
    descricao: `Briefing registrado com sucesso.\n\nEm andamento automaticamente:\n• Dossiê criado no ClickUp Docs\n• Análise de concorrentes sendo gerada\n\nPróximo passo: aguardar fotos do cliente para liberar produção.`,
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

  // ── LP Gates ──────────────────────────────────────────────

  gateLp1Jon: (empresa) => ({
    titulo: `📋 Pipeline LP criado — ${empresa}`,
    descricao: `As 5 fases foram criadas na lista Landing Pages.\n\nPróximo passo: preencha o checklist da Fase 1 (DNA do Cliente) e marque como concluída para liberar a geração de copy.`,
    prioridade: 'high',
  }),

  gateLp2Jon: (empresa) => ({
    titulo: `✍️ Copy em geração — ${empresa}`,
    descricao: `Fase 1 (DNA) aprovada.\n\nA copy da LP está sendo gerada agora pelo squad de copywriting (Kennedy + Halbert + Hopkins + Carlton).\n\nAcompanhe na aba Execuções do dashboard.`,
    prioridade: 'normal',
  }),

  gateLp3Jon: (empresa) => ({
    titulo: `🎨 Identidade visual gerada — ${empresa}`,
    descricao: `Fase 2 (Copy) aprovada.\n\nSugestão de identidade visual postada como comentário na Fase 3 (Identidade Visual).\n\nRevise no ClickUp e marque como concluída para liberar a geração da LP.`,
    prioridade: 'high',
  }),

  gateLp4Jon: (empresa) => ({
    titulo: `⚙️ LP em geração — ${empresa}`,
    descricao: `Fase 3 (Visual) aprovada.\n\nA landing page está sendo gerada agora (gerar-lp.js).\n\nAcompanhe na aba Execuções do dashboard. Após geração, revise e marque a Fase 4 como concluída para liberar o deploy.`,
    prioridade: 'normal',
  }),

  gateLp4Falha: (empresa, itens) => ({
    titulo: `⚠️ Gate LP-4 bloqueado — ${empresa}`,
    descricao: `Fases pendentes antes de gerar a LP:\n${itens.map(i => `• ${i}`).join('\n')}`,
    prioridade: 'urgent',
  }),

  gateLp5Jon: (empresa) => ({
    titulo: `🚀 Deploy LP disparado — ${empresa}`,
    descricao: `Fase 4 (Geração) aprovada.\n\nDeploy em andamento (deploy-lp.js).\n\nAcompanhe na aba Execuções. Em minutos a LP estará no ar.`,
    prioridade: 'high',
  }),

  // ── Meta Ads Gates ────────────────────────────────────────

  gateMaA: (empresa) => ({
    titulo: `🔑 Acessos confirmados — ${empresa}`,
    descricao: `Gate MA-A passou.\n\nSetup de campanha iniciado automaticamente.\n\nPróximo: Briefing + Benchmarking criado no ClickUp.\nRealize a call de ideias com o cliente (30min) e analise concorrentes.`,
    prioridade: 'high',
  }),

  gateMaB: (empresa) => ({
    titulo: `📊 Briefing aprovado — ${empresa}`,
    descricao: `Gate MA-B passou.\n\nPróximo: Estratégia + Nomenclatura MAT.\n\nDefina ângulo principal, 3 abordagens criativas e aplique a nomenclatura em campanhas e conjuntos.`,
    prioridade: 'normal',
  }),

  gateMaC: (empresa) => ({
    titulo: `📐 Estratégia aprovada — ${empresa}`,
    descricao: `Gate MA-C passou.\n\nScript gerar-copy-ads disparado automaticamente.\n\nResultado será postado na task Copy dos Anúncios no ClickUp.`,
    prioridade: 'normal',
  }),

  gateMaD: (empresa) => ({
    titulo: `✏️ Copy aprovada — ${empresa}`,
    descricao: `Gate MA-D passou.\n\nPróximo: Criativos.\n\nCrie as artes nos formatos feed 1:1 e stories 9:16 seguindo a nomenclatura MAT.`,
    prioridade: 'normal',
  }),

  gateMaEFluxoA: (empresa) => ({
    titulo: `🎨 Criativos aprovados — ${empresa} (Fluxo A)`,
    descricao: `Gate MA-E passou.\n\nFluxo A detectado.\n\nPróximo: Sync LP + Pixel — configure o Pixel, CAPI e eventos antes do Go-Live.`,
    prioridade: 'high',
  }),

  gateMaEFluxoB: (empresa) => ({
    titulo: `🎨 Criativos aprovados — ${empresa} (Fluxo B)`,
    descricao: `Gate MA-E passou.\n\nFluxo B (direto WhatsApp).\n\nPróximo: Go-Live — verifique a checklist e autorize a subida das campanhas.`,
    prioridade: 'high',
  }),

  gateMaF: (empresa) => ({
    titulo: `🔗 LP + Pixel prontos — ${empresa}`,
    descricao: `Gate MA-F passou.\n\nPixel, CAPI e eventos validados.\n\nPróximo: Go-Live liberado — autorize a subida das campanhas no ClickUp.`,
    prioridade: 'high',
  }),

  gateMaG: (empresa) => ({
    titulo: `🚀 ${empresa} está NO AR!`,
    descricao: `Gate MA-G passou — campanhas ativadas!\n\nGo-Live registrado no sistema.\nMonitoramento D+7 criado no ClickUp.\n\nAcompanhe a performance no painel e responda leads em até 2h.`,
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
