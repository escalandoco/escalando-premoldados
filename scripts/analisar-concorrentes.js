#!/usr/bin/env node
/**
 * ESCALANDO PREMOLDADOS — Análise de Concorrentes + Benchmarking
 *
 * Uso:
 *   node scripts/analisar-concorrentes.js --cliente=Concrenor
 *
 * O script:
 *   1. Busca dados do Kickoff da task no ClickUp (concorrentes + empresa)
 *   2. Faz fetch do conteúdo público de cada URL (site, Instagram)
 *   3. Claude analisa cada concorrente + a própria empresa
 *   4. Gera relatório de benchmarking
 *   5. Posta como comentário na task de Kickoff + cria task em Sucesso do Cliente
 */

import { parseArgs } from 'util';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { appendSection } from './dossie.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const QUEUE_FILE = path.join(__dirname, '../data/job-queue.json');

const { values } = parseArgs({
  options: { cliente: { type: 'string', default: 'concrenor' } },
});
const CLIENTE = values.cliente;
const JOB_ID  = `analisar-concorrentes-${CLIENTE.toLowerCase()}`; // ID fixo — reexecuções atualizam o mesmo entry

const CLICKUP_API_KEY  = process.env.CLICKUP_API_KEY;
const ANTHROPIC_KEY    = process.env.ANTHROPIC_API_KEY;
const SPACE_ID         = process.env.CLICKUP_SPACE_ID || '901313553858';
const LIST_SUCESSO     = '901326173213'; // Sucesso do Cliente

// ── Job queue helpers ─────────────────────────────────────────
function readQueue() {
  try {
    if (!fs.existsSync(QUEUE_FILE)) return [];
    return JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
  } catch { return []; }
}

function writeQueueEntry(entry) {
  const queue = readQueue();
  const idx = queue.findIndex(j => j.id === entry.id);
  if (idx >= 0) {
    queue[idx] = { ...queue[idx], ...entry };
  } else {
    queue.unshift({ attempts: 1, ...entry });
  }
  fs.mkdirSync(path.dirname(QUEUE_FILE), { recursive: true });
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue.slice(0, 50), null, 2));
}

function progress(pct, step) {
  writeQueueEntry({ id: JOB_ID, progress: pct, step });
}

// ── Fetch simples de URL pública ──────────────────────────────
function fetchUrl(url, maxMs = 8000) {
  return new Promise((resolve) => {
    try {
      const lib = url.startsWith('https') ? https : http;
      let body = '';
      const req = lib.get(url, { timeout: maxMs, headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        res.setEncoding('utf8');
        res.on('data', c => { body += c; if (body.length > 40000) res.destroy(); });
        res.on('end', () => resolve({ ok: true, status: res.statusCode, body: body.slice(0, 20000) }));
      });
      req.on('error', (e) => resolve({ ok: false, error: e.message }));
      req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'timeout' }); });
    } catch (e) {
      resolve({ ok: false, error: e.message });
    }
  });
}

// Remove HTML tags, mantém texto legível
function limparHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{3,}/g, '\n')
    .trim()
    .slice(0, 8000);
}

// ── Claude: analisa um concorrente ────────────────────────────
async function analisarConcorrente(nome, url, conteudo, contextoCliente) {
  const prompt = `Você é um especialista sênior em marketing digital e benchmarking competitivo, com foco no setor de construção civil e pré-moldados no Brasil.

REGRAS INEGOCIÁVEIS:
- Não generalize. Cada ponto deve ser específico para este concorrente e para o mercado de pré-moldados.
- Se a situação do concorrente é forte, diga. Não suavize ameaças reais.
- Considere dois ângulos: o que isso significa para o cliente (${contextoCliente}) E como a Escalando pode usar este benchmarking para fortalecer sua posição como agência especializada no setor.

CLIENTE QUE ESTÁ SENDO ANALISADO: ${contextoCliente}

CONCORRENTE PARA ANALISAR:
- Nome/URL: ${nome}
- URL: ${url}
- Conteúdo coletado da página:
${conteudo || '(não foi possível coletar conteúdo — analise com base na URL e no que você sabe)'}

Faça uma análise competitiva detalhada deste concorrente. Responda com JSON válido neste formato exato:
{
  "nome": "nome do negócio",
  "posicionamento": "como eles se posicionam no mercado (1-2 frases)",
  "produtos": ["produto 1", "produto 2"],
  "publico_alvo": "quem são os clientes deles",
  "pontos_fortes": ["ponto 1", "ponto 2", "ponto 3"],
  "pontos_fracos": ["fraqueza 1", "fraqueza 2"],
  "tom_comunicacao": "como eles se comunicam (formal/informal/técnico/etc)",
  "presenca_digital": "avaliação da presença online (forte/média/fraca) com justificativa",
  "oportunidade_para_cliente": "como nosso cliente pode se diferenciar deste concorrente em 1-2 frases",
  "nota_ameaca": 7
}

nota_ameaca: de 1 a 10 (quanto este concorrente é uma ameaça direta ao cliente)`;

  let r, tentativas = 0;
  do {
    if (tentativas > 0) await new Promise(res => setTimeout(res, 8000 * tentativas));
    r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    tentativas++;
  } while (r.status === 529 && tentativas < 5);

  if (!r.ok) throw new Error(`Claude ${r.status}`);
  const data = await r.json();
  const text = data.content?.[0]?.text || '{}';

  try {
    const match = text.match(/\{[\s\S]+\}/);
    return match ? JSON.parse(match[0]) : { nome, posicionamento: text.slice(0, 200), nota_ameaca: 5 };
  } catch {
    return { nome, posicionamento: 'Análise indisponível', nota_ameaca: 5 };
  }
}

// ── Claude: analisa a própria empresa ────────────────────────
async function analisarEmpresa(empresa, dados, conteudoSite) {
  const prompt = `Você é um especialista sênior em marketing digital para o setor de construção civil e pré-moldados no Brasil. Esta é uma auditoria real com impacto direto na estratégia de um cliente pagante.

REGRAS INEGOCIÁVEIS:
- Não busque agradar. Se o posicionamento está fraco, diga claramente.
- Zero generalismo — cada ponto precisa ser aplicável especificamente a esta empresa, não a qualquer empresa do setor.
- Considere dois ângulos: o que é melhor para o crescimento do cliente E como a Escalando pode estruturar um serviço de alto valor com base nessa análise.

DADOS DA EMPRESA:
- Nome: ${empresa.nome}
- Produtos: ${empresa.produtos}
- Área de atuação: ${empresa.area}
- Diferenciais declarados: ${empresa.diferenciais}
- Perfil dos clientes: ${empresa.perfil}
- Como vendem hoje: ${empresa.como_vendem}
- Verba de marketing: R$${empresa.verba}/mês

CONTEÚDO DO SITE/INSTAGRAM:
${conteudoSite || '(sem conteúdo coletado)'}

Faça uma análise estratégica completa desta empresa como se fosse uma auditoria de marketing. JSON válido:
{
  "resumo": "1 parágrafo descrevendo a empresa e sua situação atual",
  "posicionamento_atual": "como a empresa está se posicionando hoje",
  "posicionamento_ideal": "como deveria se posicionar para crescer",
  "diferenciais_reais": ["diferencial 1", "diferencial 2"],
  "oportunidades": ["oportunidade 1", "oportunidade 2", "oportunidade 3"],
  "riscos": ["risco 1", "risco 2"],
  "avatar_ideal": "descrição detalhada do cliente ideal",
  "mensagem_principal": "a mensagem de marketing mais poderosa para esta empresa em 1 frase",
  "canais_recomendados": ["canal 1", "canal 2"],
  "nota_maturidade_digital": 4
}

nota_maturidade_digital: de 1 a 10 (maturidade digital atual da empresa)`;

  let r, tentativas = 0;
  do {
    if (tentativas > 0) await new Promise(res => setTimeout(res, 8000 * tentativas));
    r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    tentativas++;
  } while (r.status === 529 && tentativas < 5);

  if (!r.ok) throw new Error(`Claude ${r.status}`);
  const data = await r.json();
  const text = data.content?.[0]?.text || '{}';

  try {
    const match = text.match(/\{[\s\S]+\}/);
    return match ? JSON.parse(match[0]) : { resumo: text.slice(0, 300), nota_maturidade_digital: 5 };
  } catch {
    return { resumo: 'Análise indisponível', nota_maturidade_digital: 5 };
  }
}

// ── Formata relatório de benchmarking como comentário ─────────
function formatarRelatorio(empresa, analiseEmpresa, concorrentes) {
  const hoje = new Date().toLocaleDateString('pt-BR');
  const linhas = [];

  linhas.push(`📊 **Benchmarking Competitivo — ${empresa.nome}**`);
  linhas.push(`_Análise automática gerada em ${hoje}_`);
  linhas.push('');

  // Análise da própria empresa
  linhas.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  linhas.push(`🏢 **A EMPRESA — ${empresa.nome}**`);
  linhas.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  linhas.push('');
  linhas.push(`**Situação atual:** ${analiseEmpresa.resumo || '-'}`);
  linhas.push('');
  linhas.push(`**Posicionamento hoje:** ${analiseEmpresa.posicionamento_atual || '-'}`);
  linhas.push(`**Posicionamento ideal:** ${analiseEmpresa.posicionamento_ideal || '-'}`);
  linhas.push('');
  linhas.push(`**Mensagem principal recomendada:**`);
  linhas.push(`_"${analiseEmpresa.mensagem_principal || '-'}"_`);
  linhas.push('');

  if (analiseEmpresa.oportunidades?.length) {
    linhas.push('**Oportunidades identificadas:**');
    analiseEmpresa.oportunidades.forEach(o => linhas.push(`• ${o}`));
    linhas.push('');
  }

  if (analiseEmpresa.canais_recomendados?.length) {
    linhas.push(`**Canais recomendados:** ${analiseEmpresa.canais_recomendados.join(', ')}`);
  }
  linhas.push(`**Maturidade digital:** ${'⭐'.repeat(Math.round(analiseEmpresa.nota_maturidade_digital || 5))} (${analiseEmpresa.nota_maturidade_digital || 5}/10)`);
  linhas.push('');

  // Concorrentes
  linhas.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  linhas.push(`🔍 **CONCORRENTES (${concorrentes.length} analisados)**`);
  linhas.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  linhas.push('');

  const ordenados = [...concorrentes].sort((a, b) => (b.analise?.nota_ameaca || 0) - (a.analise?.nota_ameaca || 0));

  for (const c of ordenados) {
    const a = c.analise || {};
    const ameaca = a.nota_ameaca || 5;
    const emoji = ameaca >= 8 ? '🔴' : ameaca >= 5 ? '🟡' : '🟢';
    linhas.push(`${emoji} **${a.nome || c.url}** — Ameaça: ${ameaca}/10`);
    linhas.push(`_${c.url}_`);
    linhas.push('');
    linhas.push(`**Posicionamento:** ${a.posicionamento || '-'}`);
    linhas.push(`**Público:** ${a.publico_alvo || '-'}`);
    linhas.push(`**Tom:** ${a.tom_comunicacao || '-'}`);
    linhas.push(`**Presença digital:** ${a.presenca_digital || '-'}`);

    if (a.pontos_fortes?.length) {
      linhas.push(`**Pontos fortes:** ${a.pontos_fortes.join(' · ')}`);
    }
    if (a.pontos_fracos?.length) {
      linhas.push(`**Pontos fracos:** ${a.pontos_fracos.join(' · ')}`);
    }
    if (a.oportunidade_para_cliente) {
      linhas.push(`💡 **Nossa oportunidade:** ${a.oportunidade_para_cliente}`);
    }
    linhas.push('');
  }

  linhas.push('---');
  linhas.push('_Análise gerada automaticamente pelo sistema Escalando Premoldados_');

  return linhas.join('\n');
}

// ── ClickUp helpers ───────────────────────────────────────────
async function clickupGet(path) {
  const r = await fetch(`https://api.clickup.com/api/v2${path}`, {
    headers: { Authorization: CLICKUP_API_KEY },
  });
  if (!r.ok) throw new Error(`ClickUp GET ${path} → ${r.status}`);
  return r.json();
}

async function clickupComment(taskId, text) {
  await fetch(`https://api.clickup.com/api/v2/task/${taskId}/comment`, {
    method: 'POST',
    headers: { Authorization: CLICKUP_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ comment_text: text, notify_all: false }),
  });
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  const ts = new Date().toISOString().slice(0, 19).replace('T', ' ');
  console.log(`[${ts}] Iniciando análise de concorrentes — ${CLIENTE}`);

  // Registra/atualiza job na fila (ID fixo — incrementa tentativas)
  const existing = readQueue().find(j => j.id === JOB_ID);
  writeQueueEntry({
    id: JOB_ID,
    script: 'analisar-concorrentes',
    cliente: CLIENTE,
    status: 'running',
    progress: 0,
    step: 'Iniciando...',
    createdAt: existing?.createdAt || new Date().toISOString(),
    lastAttempt: new Date().toISOString(),
    attempts: (existing?.attempts || 0) + 1,
    error: null,
  });

  if (!CLICKUP_API_KEY || !ANTHROPIC_KEY) {
    console.error('CLICKUP_API_KEY e ANTHROPIC_API_KEY são obrigatórios.');
    process.exit(1);
  }

  // 1. Busca folder e task de Kickoff no ClickUp
  const { folders } = await clickupGet(`/space/${SPACE_ID}/folder?archived=false`);
  const folder = folders.find(f => f.name.toLowerCase().includes(CLIENTE.toLowerCase()));
  if (!folder) throw new Error(`Folder "${CLIENTE}" não encontrado.`);

  const { lists } = await clickupGet(`/folder/${folder.id}/list?archived=false`);
  const onboarding = lists.find(l => l.name === 'Onboarding');
  if (!onboarding) throw new Error('Lista Onboarding não encontrada.');

  const { tasks } = await clickupGet(`/list/${onboarding.id}/task?include_closed=true`);
  const kickoffTask = tasks.find(t => t.name.toLowerCase().includes('kickoff'));
  if (!kickoffTask) throw new Error('Task de Kickoff não encontrada.');
  progress(15, 'Kickoff encontrado');

  // 2. Extrai dados do briefing
  const cf = {};
  for (const f of (kickoffTask.custom_fields || [])) {
    cf[f.name] = f.value;
  }

  // Também busca URLs no comentário de briefing (onde ficam as URLs completas)
  let concorrentesRaw = cf['Concorrentes'] || '';
  try {
    const commentsResp = await clickupGet(`/task/${kickoffTask.id}/comment?limit=20`);
    const briefingComment = (commentsResp.comments || [])
      .find(c => c.comment_text?.includes('Briefing de Kickoff'));
    if (briefingComment) {
      const urlsNoComentario = (briefingComment.comment_text.match(/https?:\/\/[^\s\n]+/g) || [])
        .filter(u => u.includes('instagram') || u.includes('.com'));
      if (urlsNoComentario.length > 0) {
        concorrentesRaw = urlsNoComentario.join(' | ');
      }
    }
  } catch (_) {}

  // Parse URLs — suporta: URL completa, handle @instagram, nome simples
  const urls = concorrentesRaw
    .split(/[\|\n,\s]+/)
    .map(u => u.trim().replace(/[()]/g, ''))
    .filter(u => u.length > 3)
    .map(u => {
      if (u.startsWith('http')) return u;
      if (u.startsWith('@')) return `https://www.instagram.com/${u.slice(1)}/`;
      if (u.includes('instagram.com')) return u.startsWith('http') ? u : `https://${u}`;
      if (u.includes('.com') || u.includes('.br')) return `https://${u}`;
      // Trata como handle do Instagram se não reconhecido
      if (u.length > 3 && !u.includes(' ')) return `https://www.instagram.com/${u}/`;
      return null;
    })
    .filter(Boolean)
    .filter((u, i, arr) => arr.indexOf(u) === i); // deduplicar

  if (urls.length === 0 && !cf['Produtos']) {
    console.log('Nenhum dado de kickoff encontrado. Encerrando.');
    process.exit(0);
  }

  console.log(`  Concorrentes encontrados: ${urls.length}`);
  console.log(`  URLs: ${urls.join(', ')}`);
  progress(25, `${urls.length} concorrentes encontrados`);

  const empresaDados = {
    nome:         CLIENTE,
    produtos:     cf['Produtos']           || '',
    area:         cf['Área de Atuação']    || '',
    diferenciais: cf['Diferenciais']       || '',
    perfil:       cf['Perfil dos Clientes']|| '',
    como_vendem:  cf['Como Vendem Hoje']   || '',
    verba:        cf['Verba Mensal']       || '0',
  };

  // 3. Determina URL principal da empresa (Instagram nos concorrentes → busca o da empresa)
  // Usa a URL do site da empresa se tiver, senão tenta Instagram
  const urlEmpresa = `https://www.instagram.com/${CLIENTE.toLowerCase()}/`;

  // 4. Coleta conteúdo de cada URL
  console.log('\n  Coletando conteúdo das páginas...');

  const [empresaPage, ...concorrentesPages] = await Promise.all([
    fetchUrl(urlEmpresa),
    ...urls.map(u => fetchUrl(u.startsWith('http') ? u : `https://${u}`)),
  ]);

  const conteudoEmpresa = empresaPage.ok ? limparHtml(empresaPage.body) : '';
  progress(40, 'Páginas coletadas');

  // 5. Claude analisa a empresa + cada concorrente
  console.log('  Analisando com Claude...');

  const contextoCliente = `${empresaDados.nome} — ${empresaDados.produtos} — ${empresaDados.area}`;

  // Sequencial para não sobrecarregar a API
  progress(45, 'Analisando empresa...');
  const analiseEmpresa = await analisarEmpresa(empresaDados, cf, conteudoEmpresa);
  progress(55, 'Empresa analisada');

  const analisesConcorrentes = [];
  for (let i = 0; i < urls.length; i++) {
    const conteudo = concorrentesPages[i]?.ok ? limparHtml(concorrentesPages[i].body) : '';
    progress(55 + Math.round((i + 0.5) * 35 / urls.length), `Analisando concorrente ${i + 1}/${urls.length}...`);
    const analise = await analisarConcorrente(urls[i], urls[i], conteudo, contextoCliente);
    analisesConcorrentes.push(analise);
    progress(55 + Math.round((i + 1) * 35 / urls.length), `Concorrente ${i + 1}/${urls.length} analisado`);
  }

  const concorrentes = urls.map((url, i) => ({ url, analise: analisesConcorrentes[i] }));

  console.log('  Análise concluída.');
  console.log(`  Empresa: maturidade digital ${analiseEmpresa.nota_maturidade_digital}/10`);
  concorrentes.forEach(c => console.log(`  ${c.url} → ameaça ${c.analise?.nota_ameaca}/10`));

  // 6. Formata e posta como comentário
  const relatorio = formatarRelatorio(empresaDados, analiseEmpresa, concorrentes);
  await clickupComment(kickoffTask.id, relatorio);
  console.log(`\n  ✅ Relatório postado na task: ${kickoffTask.id}`);

  // 7. Cria task em Sucesso do Cliente
  await fetch(`https://api.clickup.com/api/v2/list/${LIST_SUCESSO}/task`, {
    method: 'POST',
    headers: { Authorization: CLICKUP_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `Benchmarking Competitivo — ${empresaDados.nome}`,
      description: `Análise de ${concorrentes.length} concorrentes gerada automaticamente.\nVeja o comentário completo na task de Kickoff.`,
      tags: ['benchmarking', 'concorrentes'],
    }),
  });

  console.log('  ✅ Task criada em Sucesso do Cliente.');

  // Registra no Dossiê do cliente (página benchmarking)
  try {
    await appendSection(CLIENTE, 'benchmarking', relatorio);
    console.log('  ✅ Dossiê atualizado (benchmarking)');
  } catch (e) {
    console.warn(`  ⚠️  Dossiê não atualizado: ${e.message}`);
  }

  writeQueueEntry({ id: JOB_ID, status: 'done', progress: 100, step: 'Concluído', doneAt: new Date().toISOString() });
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Erro:', err.message);
  try { writeQueueEntry({ id: JOB_ID, status: 'failed', error: err.message, failedAt: new Date().toISOString() }); } catch {}
  process.exit(1);
});
