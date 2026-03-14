#!/usr/bin/env node
/**
 * ESCALANDO PREMOLDADOS — Gerador de Copy para Anúncios
 *
 * Uso:
 *   node scripts/gerar-copy-ads.js --cliente=Concrenor
 *   node scripts/gerar-copy-ads.js --cliente=Concrenor --abordagens=A1,A2
 *   node scripts/gerar-copy-ads.js --cliente=Concrenor --formatos=feed,stories
 *
 * Modos:
 *   ESPECIALISTA  — briefing.nicho === 'premoldados'
 *                   Abordagens hardcoded (mourão/fazendeiro), linguagem rural
 *   ADAPTATIVO    — qualquer outro nicho
 *                   Claude gera 3 abordagens customizadas a partir do briefing
 *
 * O script:
 *   1. Lê config/briefing-ads-{cliente}.json
 *   2. Detecta o modo pelo campo "nicho"
 *   3. Usa Claude Opus 4.6 para gerar copy pelos 7 Pilares (Pedro Sobral)
 *   4. Gera variações por abordagem × formato
 *   5. Salva em config/ads-copy-{cliente}.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.join(__dirname, '..');

// ---- CLI args ----
const args = {};
for (const a of process.argv.slice(2)) {
  const [k, ...v] = a.replace(/^--/, '').split('=');
  args[k] = v.join('=') || true;
}

const clienteRaw = args.cliente || args.c;
if (!clienteRaw) {
  console.error('Uso: node scripts/gerar-copy-ads.js --cliente=NomeCliente');
  process.exit(1);
}

function toSlug(str) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const clienteSlug = toSlug(clienteRaw);
const abordagensFiltro = args.abordagens ? args.abordagens.split(',') : null;
const formatosFiltro   = args.formatos   ? args.formatos.split(',')   : null;

// ---- Abordagens ESPECIALISTA (pré-moldados / mourão / fazendeiro) ----
const ABORDAGENS_PREMOLDADOS = [
  {
    id: 'A1',
    nome: 'Dor financeira',
    instrucao: 'Foco na dor de gastar dinheiro todo ano repondo mourão que apodrece. Compare o custo real ao longo de 10-20 anos. Use números concretos.',
  },
  {
    id: 'A2',
    nome: 'Geração / legado',
    instrucao: 'Foco emocional: a cerca que o filho vai herdar, o investimento que dura para sempre. Apelo ao orgulho do fazendeiro em deixar algo de valor.',
  },
  {
    id: 'A3',
    nome: 'Prova social',
    instrucao: 'Foco em depoimento real ou case de cliente. Use os dados de prova social do briefing. Mostre resultado concreto com nome, tempo, resultado.',
  },
];

// ---- Formatos de anúncio ----
const FORMATOS = [
  {
    id: 'feed',
    nome: 'Feed (imagem)',
    instrucao: 'Copy para post de feed no Facebook/Instagram. Hook visual forte + copy de 3-5 linhas + CTA. Máximo 125 caracteres no primeiro parágrafo (corte do "ver mais").',
  },
  {
    id: 'stories',
    nome: 'Stories / Reels',
    instrucao: 'Copy para vídeo curto (15-30 segundos). Hook nos primeiros 3 segundos. Máximo 3 frases no corpo. CTA falado + escrito. Linguagem informal e direta.',
  },
  {
    id: 'retargeting',
    nome: 'Retargeting',
    instrucao: 'Copy para quem já visitou a LP mas não converteu. Mais direto, assume que já conhece o produto. Foco em urgência, garantia ou depoimento. Sem re-apresentação da marca.',
  },
];

// ============================================================
// MODO ADAPTATIVO — Claude gera abordagens para qualquer nicho
// ============================================================
async function gerarAbordagensAdaptativas(briefing, anthropic) {
  console.log('  🤖 Gerando abordagens para nicho:', briefing.nicho || 'genérico');

  const avatar = briefing.avatar || {};
  const diferenciais = (briefing.diferenciais || []).join(', ') || 'não informado';
  const objecoes = (avatar.objecoes || briefing.objecoes || []).join(' / ') || 'não informado';

  const prompt = `Você é um estrategista de anúncios pagos (Meta Ads). Dado o briefing abaixo, gere exatamente 3 abordagens criativas para os anúncios do cliente.

## BRIEFING
- Nicho: ${briefing.nicho || 'não especificado'}
- Produto: ${briefing.produto_anunciado}
- Promessa principal: ${briefing.promessa_principal || 'não informada'}
- Público-alvo: ${avatar.profissao || briefing.publico || 'não informado'}
- Dor principal: ${avatar.dor_principal || briefing.dor_principal || 'não informada'}
- Desejo principal: ${avatar.desejo_principal || briefing.desejo_principal || 'não informado'}
- Diferenciais: ${diferenciais}
- Objeções: ${objecoes}
- Como converte: ${briefing.como_converte || 'WhatsApp'}
- Ticket médio: ${briefing.ticket_medio || 'não informado'}

## REGRAS
1. Cada abordagem deve atacar um ângulo DIFERENTE (ex: dor financeira, transformação, prova social, urgência, medo de ficar para trás, etc.)
2. As abordagens devem ser específicas para o nicho — não genéricas
3. Nomes curtos e descritivos (máximo 3 palavras)

## FORMATO DE RESPOSTA (JSON puro, sem markdown)

[
  {
    "id": "A1",
    "nome": "Nome da abordagem",
    "instrucao": "Instrução detalhada para o copywriter: qual ângulo explorar, que linguagem usar, que emoção acionar, que prova usar"
  },
  {
    "id": "A2",
    "nome": "Nome da abordagem",
    "instrucao": "..."
  },
  {
    "id": "A3",
    "nome": "Nome da abordagem",
    "instrucao": "..."
  }
]`;

  const msg = await anthropic.messages.create({
    model:      'claude-opus-4-6',
    max_tokens: 800,
    messages:   [{ role: 'user', content: prompt }],
  });

  const raw = msg.content[0].text;
  try {
    const clean = raw.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
    const abordagens = JSON.parse(clean);
    console.log(`  ✅ ${abordagens.length} abordagens geradas: ${abordagens.map(a => a.nome).join(', ')}`);
    return abordagens;
  } catch {
    console.warn('  ⚠️  Falha ao parsear abordagens adaptativas — usando fallback genérico');
    return [
      { id: 'A1', nome: 'Dor principal', instrucao: `Foco na dor principal do avatar: ${avatar.dor_principal || 'problema central do cliente'}. Use linguagem direta e mostre que você entende o problema.` },
      { id: 'A2', nome: 'Transformação', instrucao: `Mostre o antes e depois. Foco no desejo: ${avatar.desejo_principal || 'resultado desejado'}. O produto é o caminho.` },
      { id: 'A3', nome: 'Prova social', instrucao: 'Depoimento ou case real. Números concretos. Resultado específico de um cliente real. Zero abstração.' },
    ];
  }
}

// ============================================================
// MODO ESPECIALISTA — regras linguísticas para pré-moldados
// ============================================================
function regrasPremoldados() {
  return `1. Linguagem direta, sem frescura — fale como fazendeiro fala para fazendeiro
2. Não use: "inovação", "sustentável", "ecossistema", "disruptivo"
3. Use números reais (anos, reais, hectares)
4. O hook deve funcionar nos primeiros 3 segundos
5. Gere 3 variações (V1, V2, V3)`;
}

// ============================================================
// MODO ADAPTATIVO — regras genéricas para qualquer nicho
// ============================================================
function regrasAdaptativas(briefing) {
  const avatar = briefing.avatar || {};
  const linguagem = avatar.linguagem || briefing.linguagem_tom || 'direta e objetiva';
  const proibidos = (briefing.tom_proibido || []).join(', ') || 'jargões corporativos, promessas vagas';
  return `1. Linguagem: ${linguagem}
2. Não use: ${proibidos}, "inovação", "disruptivo", "ecossistema"
3. Use números reais quando disponíveis
4. O hook deve funcionar nos primeiros 3 segundos
5. Gere 3 variações (V1, V2, V3)`;
}

// ---- Monta o prompt ----
function buildPrompt(briefing, abordagem, formato, modoEspecialista) {
  const avatar = briefing.avatar || {};
  const provas = (briefing.provas_sociais || []).join('\n- ');
  const regras = modoEspecialista ? regrasPremoldados() : regrasAdaptativas(briefing);

  return `Você é um copywriter sênior especializado em anúncios pagos no Brasil. Você aplica os 7 Pilares de Pedro Sobral com domínio real, não como checklist.

REGRAS INEGOCIÁVEIS:
- Zero generalismo. Cada variação deve ser específica para ${briefing.cliente} — se o copy puder servir para qualquer empresa do setor, está errado.
- Não suavize fraquezas do produto. Se o produto tem restrições, o copy deve contorná-las com honestidade, não escondê-las.
- Pense em dois ângulos: o que faz o avatar clicar E o que demonstra que o anunciante entende o problema dele de verdade.

Escreva copy para anúncio seguindo os 7 Pilares de Pedro Sobral.

## BRIEFING DO CLIENTE

**Produto:** ${briefing.produto_anunciado}
**Nicho:** ${briefing.nicho || 'não especificado'}
**Cliente:** ${briefing.cliente}
**Promessa principal:** ${briefing.promessa_principal || 'não informada'}
**CTA:** ${briefing.cta_principal}

**Avatar:**
- Nome/perfil: ${avatar.nome_ficticio || ''}
- Profissão: ${avatar.profissao || briefing.publico || ''}
- Região: ${avatar.regiao || ''}
- Dor principal: ${avatar.dor_principal || ''}
- Desejo: ${avatar.desejo_principal || ''}
- Objeções: ${(avatar.objecoes || briefing.objecoes || []).join(' / ')}
- Linguagem: ${avatar.linguagem || briefing.linguagem_tom || ''}

**Provas sociais disponíveis:**
- ${provas || 'Não informado'}

## ABORDAGEM

**${abordagem.id} — ${abordagem.nome}**
${abordagem.instrucao}

## FORMATO

**${formato.nome}**
${formato.instrucao}

## REGRAS OBRIGATÓRIAS

${regras}

## FORMATO DE RESPOSTA (JSON)

Responda APENAS com JSON válido, sem markdown, sem explicação:

{
  "v1": {
    "hook": "...",
    "copy": "...",
    "cta": "..."
  },
  "v2": {
    "hook": "...",
    "copy": "...",
    "cta": "..."
  },
  "v3": {
    "hook": "...",
    "copy": "...",
    "cta": "..."
  }
}`;
}

// ---- Parseia resposta ----
function parseResposta(raw, formatoId, abordagem, cliente) {
  let variacoes;
  try {
    const clean = raw.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
    variacoes = JSON.parse(clean);
  } catch {
    variacoes = { v1: { hook: raw, copy: '', cta: '' } };
  }

  // Normaliza nome da abordagem para código (remove espaços/acentos)
  const abordCodigo = abordagem.id + '_' + toSlug(abordagem.nome).replace(/-/g, '').toUpperCase().slice(0, 12);
  const formatoCodigo = formatoId.toUpperCase();
  const clienteUpper = cliente.toUpperCase().replace(/[^A-Z0-9]/g, '');

  return {
    abordagem:       abordagem.id,
    abordagem_nome:  abordagem.nome,
    formato:         formatoId,
    variacoes: Object.entries(variacoes).map(([versao, dados]) => ({
      nome: `${clienteUpper}_${abordCodigo}_${formatoCodigo}_${versao.toUpperCase()}`,
      ...dados,
    })),
  };
}

// ---- Main ----
async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('❌ ANTHROPIC_API_KEY não encontrada. Configure no .env ou variável de ambiente.');
    process.exit(1);
  }

  const briefingPath = path.join(ROOT, 'config', `briefing-ads-${clienteSlug}.json`);
  if (!fs.existsSync(briefingPath)) {
    console.error(`❌ Briefing não encontrado: ${briefingPath}`);
    console.error(`   Crie o arquivo config/briefing-ads-${clienteSlug}.json`);
    console.error(`   Modelo: config/briefing-ads-template.json`);
    process.exit(1);
  }

  const briefing = JSON.parse(fs.readFileSync(briefingPath, 'utf8'));
  const anthropic = new Anthropic({ apiKey });

  // ---- Detecta modo ----
  const nicho = (briefing.nicho || '').toLowerCase();
  const modoEspecialista = nicho === 'premoldados';

  console.log(`\n✍️  Gerando copy de anúncios para ${clienteRaw}`);
  console.log(`   Modo: ${modoEspecialista ? '🔨 ESPECIALISTA (pré-moldados)' : `🌐 ADAPTATIVO (${nicho || 'nicho genérico'})`}`);

  // ---- Obtém abordagens ----
  let abordagens;
  if (modoEspecialista) {
    abordagens = ABORDAGENS_PREMOLDADOS;
  } else {
    abordagens = await gerarAbordagensAdaptativas(briefing, anthropic);
  }

  // Aplica filtro se passado via CLI
  if (abordagensFiltro) {
    abordagens = abordagens.filter(a => abordagensFiltro.includes(a.id));
  }

  const formatos = formatosFiltro
    ? FORMATOS.filter(f => formatosFiltro.includes(f.id))
    : FORMATOS;

  console.log(`   Abordagens: ${abordagens.map(a => `${a.id} (${a.nome})`).join(', ')}`);
  console.log(`   Formatos: ${formatos.map(f => f.id).join(', ')}\n`);

  const resultado = {
    cliente:         clienteRaw,
    nicho:           briefing.nicho || 'genérico',
    modo:            modoEspecialista ? 'especialista' : 'adaptativo',
    gerado_em:       new Date().toISOString().slice(0, 10),
    modelo:          'claude-opus-4-6',
    briefing_fonte:  `config/briefing-ads-${clienteSlug}.json`,
    abordagens_usadas: abordagens.map(a => ({ id: a.id, nome: a.nome })),
    anuncios:        [],
  };

  for (const abordagem of abordagens) {
    for (const formato of formatos) {
      const label = `${abordagem.id} (${abordagem.nome}) × ${formato.id}`;
      process.stdout.write(`  Gerando ${label}...`);

      const prompt = buildPrompt(briefing, abordagem, formato, modoEspecialista);

      try {
        const msg = await anthropic.messages.create({
          model:      'claude-opus-4-6',
          max_tokens: 1024,
          messages:   [{ role: 'user', content: prompt }],
        });

        const raw = msg.content[0].text;
        const parsed = parseResposta(raw, formato.id, abordagem, clienteRaw);

        resultado.anuncios.push(parsed);
        process.stdout.write(' ✅\n');

      } catch (err) {
        process.stdout.write(` ❌ ${err.message}\n`);
      }
    }
  }

  // Salva output
  const outPath = path.join(ROOT, 'config', `ads-copy-${clienteSlug}.json`);
  fs.writeFileSync(outPath, JSON.stringify(resultado, null, 2), 'utf8');

  console.log(`\n✅ Copy gerado: config/ads-copy-${clienteSlug}.json`);
  console.log(`   ${resultado.anuncios.length} variações criadas.`);
  console.log(`\n📋 Próximo passo: revisar e aprovar no ClickUp antes de passar para criativos.\n`);
}

main().catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
