#!/usr/bin/env node
/**
 * converter-checklists.js
 * Para cada task de onboarding:
 *   1. Extrai itens "- [ ]" da descrição
 *   2. Cria checklist nativo no ClickUp com esses itens
 *   3. Atualiza a descrição: intro limpa + link do playbook
 */

const KEY     = process.env.CLICKUP_API_KEY;
const BOT_KEY = process.env.CLICKUP_BOT_API_KEY || KEY;
const BASE    = 'https://api.clickup.com/api/v2';

// Mapa: task_id → configuração
const TASKS = [
  {
    id: '86afxrf1d',
    playbook: 'onboarding.md',
    intro: '🔑 **Coletar todos os acessos necessários para operar a conta do cliente.**\n\nSem acessos não conseguimos configurar nem monitorar nada. Prioridade máxima na semana 1.',
    acessoTemplate: true, // dispara template de acessos via bot
  },
  {
    id: '86afxrf41',
    playbook: 'setup-meta-ads.md',
    intro: '📘 **Configurar conta e estrutura de Meta Ads da Concrenor.**\n\nPixel: 766713294039278 | Conta: act_704850218556465 | Orçamento: R$30/dia',
  },
  {
    id: '86afxrf34',
    playbook: 'deploy-lp.md',
    intro: '🌐 **Configurar e publicar a Landing Page do cliente.**\n\nA LP é o destino de todos os anúncios. Precisa estar 100% antes do go-live.\n\n**Pré-requisito:** fotos do cliente recebidas.',
  },
  {
    id: '86afxrf3g',
    playbook: 'seo-local.md',
    intro: '📍 **Configurar o perfil do Google Meu Negócio — 15 itens obrigatórios.**\n\nGMB bem configurado aparece no Google Maps e nas pesquisas locais. É tráfego gratuito.\n\n**Acesso:** business.google.com → perfil da Concrenor',
  },
  {
    id: '86afxrf52',
    playbook: 'tintim-multicliente.md',
    intro: '💬 **Conectar Tintim para rastrear leads via WhatsApp da Concrenor.**\n\nO Tintim captura quem manda mensagem no WhatsApp e registra no CRM automaticamente.\n\n**Webhook:** https://escalando-premoldados.vercel.app/api/tintim',
  },
  {
    id: '86afxrf4b',
    playbook: 'crm-planilha.md',
    intro: '📊 **Configurar planilha de CRM e webhook de leads da Concrenor.**\n\nTodo lead da LP e do WhatsApp vai para o Sheets. Precisa funcionar antes do go-live.\n\n**Planilha:** Google Drive → Concrenor → 06 - CRM Leads',
  },
  {
    id: '86afxrf5m',
    playbook: 'briefing-criativos.md',
    intro: '🎨 **Briefing completo para criar os criativos de anúncios da Concrenor.**\n\nOs criativos são a peça mais importante dos anúncios. Briefing ruim = criativos ruins.',
  },
  {
    id: '86afxrf6h',
    playbook: 'go-live-meta-ads.md',
    intro: '🚀 **Checklist final antes de ativar os anúncios da Concrenor.**\n\nNão ligue as campanhas sem confirmar cada item. Erro aqui = dinheiro perdido.',
  },
  {
    id: '86ag09p3c',
    playbook: 'setup-google-ads.md',
    intro: '🔍 **Configurar campanha Search no Google Ads da Concrenor.**\n\nGoogle Ads Search captura quem já está buscando ativamente — intenção de compra alta.',
  },
];

// Extrai grupos de checklist da descrição
function extrairItens(desc) {
  const grupos = [];
  let grupoAtual = { nome: 'Checklist', itens: [] };

  for (const linha of desc.split('\n')) {
    const isHeader = /^\*\*(.+)\*\*\s*$/.test(linha) && !linha.includes('- [');
    const isItem   = /^-\s*\[\s*[xX ]?\s*\]/.test(linha);

    if (isHeader) {
      if (grupoAtual.itens.length) grupos.push(grupoAtual);
      grupoAtual = { nome: linha.replace(/\*\*/g, '').trim(), itens: [] };
    } else if (isItem) {
      const texto = linha.replace(/^-\s*\[\s*[xX ]?\s*\]\s*/, '').trim();
      if (texto) grupoAtual.itens.push(texto);
    }
  }
  if (grupoAtual.itens.length) grupos.push(grupoAtual);
  return grupos;
}

async function api(method, path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  return text ? JSON.parse(text) : { ok: true };
}

async function criarChecklist(taskId, nome) {
  return api('POST', `/task/${taskId}/checklist`, { name: nome });
}

async function adicionarItem(checklistId, nome, ordem) {
  return api('POST', `/checklist/${checklistId}/checklist_item`, { name: nome, orderindex: ordem });
}

async function apagarChecklists(taskId) {
  const task = await api('GET', `/task/${taskId}`);
  for (const cl of (task.checklists || [])) {
    await api('DELETE', `/checklist/${cl.id}`);
    console.log(`    ↳ Checklist antigo "${cl.name}" removido`);
  }
}

async function atualizarDescricao(taskId, intro, playbook) {
  const desc = `${intro}\n\n---\n📚 **Playbook:** \`docs/playbooks/${playbook}\``;
  await api('PUT', `/task/${taskId}`, { description: desc });
}

async function postarTemplateAcessos(taskId) {
  const template = `🔑 **Template de Acessos — preencha e responda nesse comentário**

Para configurar sua conta, precisamos dos seguintes acessos. Preencha abaixo e responda:

---

**META BUSINESS MANAGER**
- E-mail adicionado como admin: jonatas@escalando.co ✅ (já feito) / ❌ (pendente)
- ID da conta de anúncios: act_...
- ID do BM: ...

**GOOGLE MEU NEGÓCIO**
- E-mail do perfil: ...
- Acesso adicionado: ✅ / ❌

**GOOGLE ADS**
- ID da conta: ...
- Acesso adicionado: ✅ / ❌

**SITE (se tiver)**
- URL: ...
- Login painel: ...
- Senha: ...

---
_Responda nesse comentário com os dados preenchidos. O sistema registrará automaticamente no Dossiê._`;

  await fetch(`${BASE}/task/${taskId}/comment`, {
    method: 'POST',
    headers: { Authorization: BOT_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ comment_text: template, notify_all: true }),
  });
  console.log('    ↳ Template de acessos postado como comentário ✅');
}

async function processarTask(cfg) {
  console.log(`\n📋 ${cfg.id} — buscando task...`);
  const task = await api('GET', `/task/${cfg.id}`);
  console.log(`   "${task.name}"`);

  const desc   = task.description || '';
  const grupos = extrairItens(desc);

  if (!grupos.length || grupos.every(g => !g.itens.length)) {
    console.log('   ℹ️  Sem itens de checklist na descrição — pulando');
    return;
  }

  // Remove checklists antigos
  await apagarChecklists(cfg.id);

  // Cria checklists por grupo
  let totalItens = 0;
  for (const grupo of grupos) {
    if (!grupo.itens.length) continue;
    const cl = await criarChecklist(cfg.id, grupo.nome);
    const clId = cl.checklist?.id;
    if (!clId) { console.log(`   ⚠️  Falha ao criar checklist "${grupo.nome}"`); continue; }

    for (let i = 0; i < grupo.itens.length; i++) {
      await adicionarItem(clId, grupo.itens[i], i);
      totalItens++;
    }
    console.log(`   ✅ Checklist "${grupo.nome}" — ${grupo.itens.length} itens`);
  }

  // Atualiza descrição
  await atualizarDescricao(cfg.id, cfg.intro, cfg.playbook);
  console.log(`   📝 Descrição atualizada com playbook: ${cfg.playbook}`);

  // Template de acessos (S1)
  if (cfg.acessoTemplate) await postarTemplateAcessos(cfg.id);

  console.log(`   ✔️  Total: ${totalItens} itens criados`);
}

async function main() {
  if (!KEY) { console.error('❌ CLICKUP_API_KEY não configurado'); process.exit(1); }
  console.log('🔄 Convertendo checklists inline → nativos ClickUp\n');

  for (const cfg of TASKS) {
    await processarTask(cfg);
  }

  console.log('\n✅ Concluído!');
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
