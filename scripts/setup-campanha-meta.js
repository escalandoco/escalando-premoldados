#!/usr/bin/env node
/**
 * ESCALANDO PREMOLDADOS — Setup de Campanha Meta Ads
 *
 * Uso:
 *   node scripts/setup-campanha-meta.js --task=TASK_ID
 *   node scripts/setup-campanha-meta.js --cliente=Concrenor --produto=PISO --fluxo=B
 *
 * O script:
 *   1. Le campos do card ClickUp (ou CLI args)
 *   2. Busca dados da Ficha do cliente
 *   3. Gera briefing JSON
 *   4. Gera copy (3 hooks, 7 pilares Pedro Sobral)
 *   5. Gera nomenclatura MAT completa
 *   6. Gera lista de publicos a criar
 *   7. Gera checklist de go-live (Fluxo A ou B)
 *   8. Posta resultado no card ClickUp
 */

import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const CLICKUP_KEY   = process.env.CLICKUP_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const LIST_FICHAS   = process.env.CLICKUP_LIST_FICHAS || '901326308338';
const LIST_META_ADS = '901326306627';

// ── CLI args ─────────────────────────────────────────────────
const args = {};
for (const a of process.argv.slice(2)) {
  const [k, ...v] = a.replace(/^--/, '').split('=');
  args[k] = v.join('=') || true;
}

// ── Helpers ClickUp ──────────────────────────────────────────
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
    body: JSON.stringify({ comment_text: text, notify_all: true }),
  });
  if (!r.ok) throw new Error(`ClickUp comment ${r.status}`);
}

async function clickupUpdateStatus(taskId, status) {
  await fetch(`https://api.clickup.com/api/v2/task/${taskId}`, {
    method: 'PUT',
    headers: { Authorization: CLICKUP_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
}

// ── Busca custom fields do card ──────────────────────────────
function extrairCampos(task) {
  const cf = {};
  for (const f of (task.custom_fields || [])) {
    if (f.value !== null && f.value !== undefined && f.value !== '') {
      // Dropdown: pega o label
      if (f.type === 'drop_down' && f.type_config?.options) {
        const opt = f.type_config.options.find(o => o.orderindex === f.value);
        cf[f.name] = opt ? opt.name : f.value;
      } else {
        cf[f.name] = typeof f.value === 'string' ? f.value.trim() : f.value;
      }
    }
  }
  return cf;
}

// ── Busca Ficha do cliente ───────────────────────────────────
async function buscarFicha(clienteNome) {
  try {
    const { tasks } = await clickupGet(`/list/${LIST_FICHAS}/task?archived=false`);
    const ficha = (tasks || []).find(
      t => t.name.toLowerCase().includes(clienteNome.toLowerCase())
    );
    if (!ficha) return {};
    return extrairCampos(ficha);
  } catch {
    return {};
  }
}

// ── Gera nomenclatura MAT ────────────────────────────────────
function gerarNomenclatura({ cliente, produto, fluxo, temperatura, data }) {
  const tag    = produto.toUpperCase().replace(/\s+/g, '-');
  const dataFmt = data || new Date().toISOString().split('T')[0];
  const objetivo = fluxo === 'A' ? 'GERAÇÃO DE CADASTRO' : 'MENSAGENS';
  const otimizacao = 'CBO';

  return {
    campanha: `${temperatura} | ${produto.toUpperCase()} | ${objetivo} | ${otimizacao} | ${dataFmt}`,
    conjuntos: [
      `INTERESSE | H & M | 30-60 | TODOS OS VISITANTES | 30D`,
      `ABERTO | H & M | 30-60 | TODOS OS VISITANTES | 30D`,
      `LAL - LISTA DE CLIENTES | H & M | 30-60 | LEAD | 60D`,
      `[IG] [ENVOLVIMENTO] [@${cliente.toLowerCase()}] | H & M | 30-60 | ENGAJAMENTO | 365D`,
    ],
    anuncios_exemplo: [
      `AD 01 | IMG | [HOOK 1 — gerado pela IA]`,
      `AD 02 | IMG | [HOOK 2 — gerado pela IA]`,
      `AD 03 | VID | [HOOK 3 — gerado pela IA]`,
    ],
  };
}

// ── Gera publicos a criar ────────────────────────────────────
function gerarPublicos({ cliente, tag, fluxo }) {
  const perfil = `@${cliente.toLowerCase()}`;
  const publicos = [
    `[IG] [ENVOLVIMENTO] [${perfil}] 30D`,
    `[IG] [ENVOLVIMENTO] [${perfil}] 60D`,
    `[IG] [ENVOLVIMENTO] [${perfil}] 90D`,
    `[IG] [ENVOLVIMENTO] [${perfil}] 180D`,
    `[IG] [ENVOLVIMENTO] [${perfil}] 365D`,
    `[FB] [ENVOLVIMENTO] [${perfil}] 30D`,
    `[FB] [ENVOLVIMENTO] [${perfil}] 60D`,
    `[FB] [ENVOLVIMENTO] [${perfil}] 365D`,
    `[CRM] [CLIENTES] [${tag}]`,
    `[CRM] [LEADS] [${tag}]`,
    `[LAL] [1%] [CLIENTES] [${tag}]`,
    `[LAL] [1%] [LEADS] [${tag}]`,
  ];

  if (fluxo === 'A') {
    publicos.push(
      `PIXEL [XXXX] [${tag}] [VIEW PAGE] 30D`,
      `PIXEL [XXXX] [${tag}] [VIEW PAGE] 60D`,
      `PIXEL [XXXX] [${tag}] [CONTACT] 30D`,
      `PIXEL [XXXX] [${tag}] [CONTACT] 60D`,
      `PIXEL [XXXX] [${tag}] [LEAD] 30D`,
      `PIXEL [XXXX] [${tag}] [LEAD] 60D`
    );
  }

  return publicos;
}

// ── Checklist go-live por fluxo ──────────────────────────────
function gerarChecklist(fluxo) {
  const base = [
    '[ ] Campanha criada com nomenclatura MAT correta',
    '[ ] Conjuntos configurados (publicos + localizacao + idade)',
    '[ ] Criativos aprovados subidos na campanha',
    '[ ] UTMs configurados em todos os links',
    '[ ] Budget configurado (R$25/dia Discovery)',
    '[ ] Alertas de custo configurados no Meta',
    '[ ] Cliente confirmou disponibilidade para atender lead em ate 2h',
    '[ ] Reputacao da conta ok (Qualidade da Conta)',
    '[ ] Maximo 3 reprovacoes no mes — verificado',
  ];

  if (fluxo === 'B') {
    base.push(
      '[ ] Numero WhatsApp correto no anuncio',
      '[ ] Link WPP com UTM funcionando',
      '[ ] Tintim configurado e rastreando cliques',
      '[ ] Objetivo da campanha = Mensagens'
    );
  } else {
    base.push(
      '[ ] LP publicada em URL definitiva',
      '[ ] Pixel disparando PageView (Pixel Helper)',
      '[ ] Evento Contact disparando no clique WPP',
      '[ ] Conversions API ativa (api/events.js)',
      '[ ] LP carregando em menos de 3s no celular'
    );
  }

  return base;
}

// ── Gera copy via Claude ─────────────────────────────────────
async function gerarCopy({ briefing, nomenclatura }) {
  const client = new Anthropic({ apiKey: ANTHROPIC_KEY });

  const prompt = `Voce e Pedro Sobral, o maior especialista em trafego pago do Brasil.

Gere copy para anuncios Meta Ads seguindo os 7 Pilares:
1. Hook (gancho) — primeiros 3 segundos, para o scroll
2. Narrativa — contexto e identificacao
3. Dor/Desejo — problema ou sonho do avatar
4. Contra-intuitivo — elemento de surpresa/credibilidade
5. CTA — chamada para acao clara

BRIEFING DO CLIENTE:
${JSON.stringify(briefing, null, 2)}

CAMPANHA:
${nomenclatura.campanha}

Gere 3 variacoes completas de copy:
- Uma focada em DOR FINANCEIRA
- Uma focada em RESULTADO/TRANSFORMACAO
- Uma focada em PROVA SOCIAL

Para cada variacao entregue:
- hook: (frase de gancho — 1 linha, MAIUSCULO)
- narrativa: (2-3 frases)
- dor_desejo: (2-3 frases)
- contra_intuitivo: (1-2 frases)
- cta: (1 frase direta)
- copy_curto: (copy completa para feed, ate 5 linhas)
- copy_longo: (copy completa para stories, ate 15 linhas)

Responda em JSON valido:
{ "variacoes": [ { "id": "V1", "abordagem": "Dor Financeira", "hook": "...", "narrativa": "...", "dor_desejo": "...", "contra_intuitivo": "...", "cta": "...", "copy_curto": "...", "copy_longo": "..." }, ... ] }`;

  const response = await client.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = response.content[0].text;
  try {
    const match = text.match(/\{[\s\S]+\}/);
    return match ? JSON.parse(match[0]) : { variacoes: [], raw: text };
  } catch {
    return { variacoes: [], raw: text };
  }
}

// ── Formata output para o ClickUp ────────────────────────────
function formatarOutput({ campos, briefing, nomenclatura, copy, publicos, checklist }) {
  const fluxoLabel = campos.fluxo === 'A' ? 'A — Com LP' : 'B — Direto WhatsApp (padrao)';
  const faseLabel  = campos.fase || 'Discovery';

  let out = `🚀 **Setup de Campanha Meta Ads — ${campos.cliente || briefing.cliente}**\n\n`;
  out += `**Fluxo:** ${fluxoLabel} | **Fase:** ${faseLabel} | **Budget:** R$${campos.budget || 25}/dia\n\n`;

  out += `---\n\n## 📐 Nomenclatura MAT\n\n`;
  out += `**Campanha:**\n\`${nomenclatura.campanha}\`\n\n`;
  out += `**Conjuntos de Anuncios:**\n`;
  nomenclatura.conjuntos.forEach(c => { out += `\`${c}\`\n`; });

  out += `\n---\n\n## ✏️ Copy — 3 Variacoes (7 Pilares Sobral)\n\n`;
  if (copy.variacoes?.length > 0) {
    copy.variacoes.forEach(v => {
      out += `### ${v.id} — ${v.abordagem}\n`;
      out += `**Hook:** ${v.hook}\n`;
      out += `**Narrativa:** ${v.narrativa}\n`;
      out += `**Dor/Desejo:** ${v.dor_desejo}\n`;
      out += `**Contra-intuitivo:** ${v.contra_intuitivo}\n`;
      out += `**CTA:** ${v.cta}\n\n`;
      out += `**Copy Feed:**\n${v.copy_curto}\n\n`;
      out += `**Copy Stories:**\n${v.copy_longo}\n\n`;
      out += `---\n\n`;

      // Nomenclatura dos anuncios
      out += `**Anuncios (nomenclatura MAT):**\n`;
      out += `\`AD ${v.id.replace('V','')} | IMG | ${v.hook.substring(0, 60).toUpperCase()}\`\n`;
      out += `\`AD ${v.id.replace('V','')}b | VID | ${v.hook.substring(0, 60).toUpperCase()}\`\n\n`;
    });
  } else if (copy.raw) {
    out += copy.raw + '\n\n';
  }

  out += `---\n\n## 👥 Publicos a Criar no Meta\n\n`;
  publicos.forEach(p => { out += `• \`${p}\`\n`; });

  out += `\n---\n\n## ✅ Checklist Go-Live\n\n`;
  checklist.forEach(c => { out += `${c}\n`; });

  out += `\n---\n`;
  out += `_Setup gerado automaticamente — Escalando Premoldados — ${new Date().toLocaleDateString('pt-BR')}_`;

  return out;
}

// ── MAIN ─────────────────────────────────────────────────────
async function main() {
  const taskId  = args.task;
  const clienteArg  = args.cliente || 'Concrenor';
  const produtoArg  = args.produto || 'PISO INTERTRAVADO';
  const fluxoArg    = (args.fluxo || 'B').toUpperCase();
  const tempArg     = args.temperatura || 'FRIO';
  const budgetArg   = args.budget || '25';
  const areaArg     = args.area || 'Grande Aracaju, SE';

  let campos = {
    cliente:     clienteArg,
    produto:     produtoArg,
    fluxo:       fluxoArg,
    temperatura: tempArg,
    budget:      budgetArg,
    area:        areaArg,
    fase:        args.fase || 'Discovery',
    cpl_meta:    args.cpl_meta || '60',
    cpl_max:     args.cpl_max || '150',
  };

  // Se tem task ID, busca campos do ClickUp
  if (taskId) {
    console.log(`[setup-campanha] Buscando task ${taskId}...`);
    const task = await clickupGet(`/task/${taskId}`);
    const cf = extrairCampos(task);

    campos = {
      cliente:     task.folder?.name || clienteArg,
      produto:     cf['Produto'] || cf['Produto Foco'] || produtoArg,
      fluxo:       (cf['Fluxo'] || fluxoArg).includes('A') ? 'A' : 'B',
      temperatura: cf['Temperatura'] || tempArg,
      budget:      cf['Budget Diario'] || budgetArg,
      area:        cf['Area de Atuacao'] || areaArg,
      fase:        cf['Fase'] || 'Discovery',
      cpl_meta:    cf['CPL Meta'] || '60',
      cpl_max:     cf['CPL Maximo'] || '150',
      whatsapp:    cf['WhatsApp'] || '',
      link_lp:     cf['Link LP'] || '',
    };

    console.log(`[setup-campanha] Cliente: ${campos.cliente} | Produto: ${campos.produto} | Fluxo: ${campos.fluxo}`);
  }

  // Busca ficha do cliente
  console.log(`[setup-campanha] Buscando ficha de ${campos.cliente}...`);
  const ficha = await buscarFicha(campos.cliente);

  // Monta briefing
  const briefing = {
    cliente:          campos.cliente,
    produto:          campos.produto,
    area:             campos.area,
    objetivo:         ficha['Objetivo Principal'] || 'Gerar vendas pelo WhatsApp',
    sucesso:          ficha['Sucesso em 60 dias'] || '',
    verba_ads:        ficha['Verba Ads'] || campos.budget,
    whatsapp:         campos.whatsapp || ficha['WhatsApp'] || '',
    cpl_meta:         `R$${campos.cpl_meta}`,
    cpl_max:          `R$${campos.cpl_max}`,
    fase:             campos.fase,
    fluxo:            campos.fluxo,
  };

  // Gera nomenclatura MAT
  const tag = campos.produto.toUpperCase().split(' ')[0];
  const nomenclatura = gerarNomenclatura({
    cliente:     campos.cliente,
    produto:     campos.produto,
    fluxo:       campos.fluxo,
    temperatura: campos.temperatura,
    data:        new Date().toISOString().split('T')[0],
  });

  // Gera publicos
  const publicos = gerarPublicos({ cliente: campos.cliente, tag, fluxo: campos.fluxo });

  // Gera checklist
  const checklist = gerarChecklist(campos.fluxo);

  // Salva briefing local
  const briefingPath = path.join(ROOT, 'config', `briefing-ads-${campos.cliente.toLowerCase()}.json`);
  fs.mkdirSync(path.join(ROOT, 'config'), { recursive: true });
  fs.writeFileSync(briefingPath, JSON.stringify({ ...briefing, nomenclatura, publicos }, null, 2));
  console.log(`[setup-campanha] Briefing salvo em ${briefingPath}`);

  // Gera copy via Claude
  console.log(`[setup-campanha] Gerando copy com Claude...`);
  const copy = await gerarCopy({ briefing, nomenclatura });

  // Salva copy local
  const copyPath = path.join(ROOT, 'config', `ads-copy-${campos.cliente.toLowerCase()}-${Date.now()}.json`);
  fs.writeFileSync(copyPath, JSON.stringify(copy, null, 2));
  console.log(`[setup-campanha] Copy salva em ${copyPath}`);

  // Formata output
  const output = formatarOutput({ campos, briefing, nomenclatura, copy, publicos, checklist });

  // Posta no ClickUp se tem task ID
  if (taskId) {
    console.log(`[setup-campanha] Postando resultado no ClickUp task ${taskId}...`);
    await clickupComment(taskId, output);
    await clickupUpdateStatus(taskId, 'in progress');
    console.log(`[setup-campanha] ✅ Comentario postado + status atualizado`);
  } else {
    // Exibe no terminal
    console.log('\n' + output);
  }

  console.log(`[setup-campanha] ✅ Concluido`);
}

main().catch(err => {
  console.error('[setup-campanha] Erro:', err.message);
  process.exit(1);
});
