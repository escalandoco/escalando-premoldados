#!/usr/bin/env node
/**
 * ESCALANDO PREMOLDADOS — Gerador de Copy para Anúncios
 *
 * Uso:
 *   node scripts/gerar-copy-ads.js --cliente=Concrenor
 *   node scripts/gerar-copy-ads.js --cliente=Concrenor --abordagens=A1,A2
 *   node scripts/gerar-copy-ads.js --cliente=Concrenor --formatos=feed,stories
 *
 * O script:
 *   1. Lê config/briefing-ads-{cliente}.json
 *   2. Usa Claude Opus 4.6 para gerar copy pelos 7 Pilares (Pedro Sobral)
 *   3. Gera variações por abordagem × formato × temperatura
 *   4. Salva em config/ads-copy-{cliente}.json
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

const ABORDAGENS = [
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
    id: 'search',
    nome: 'Google Ads Search',
    instrucao: 'Gere 5 headlines (máximo 30 caracteres cada) e 2 descriptions (máximo 90 caracteres cada). Foco em quem já está pesquisando o produto.',
  },
  {
    id: 'retargeting',
    nome: 'Retargeting',
    instrucao: 'Copy para quem já visitou a LP mas não converteu. Mais direto, assume que já conhece o produto. Foco em urgência, garantia ou depoimento. Sem re-apresentação da marca.',
  },
];

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
    console.error(`   Execute primeiro: preencha config/briefing-ads-${clienteSlug}.json`);
    process.exit(1);
  }

  const briefing = JSON.parse(fs.readFileSync(briefingPath, 'utf8'));
  const anthropic = new Anthropic({ apiKey });

  const abordagens = abordagensFiltro
    ? ABORDAGENS.filter(a => abordagensFiltro.includes(a.id))
    : ABORDAGENS;

  const formatos = formatosFiltro
    ? FORMATOS.filter(f => formatosFiltro.includes(f.id))
    : FORMATOS;

  console.log(`\n✍️  Gerando copy de anúncios para ${clienteRaw}`);
  console.log(`   Abordagens: ${abordagens.map(a => a.id).join(', ')}`);
  console.log(`   Formatos: ${formatos.map(f => f.id).join(', ')}\n`);

  const resultado = {
    cliente:         clienteRaw,
    gerado_em:       new Date().toISOString().slice(0, 10),
    modelo:          'claude-opus-4-6',
    briefing_fonte:  `config/briefing-ads-${clienteSlug}.json`,
    anuncios:        [],
  };

  for (const abordagem of abordagens) {
    for (const formato of formatos) {
      const label = `${abordagem.id} × ${formato.id}`;
      process.stdout.write(`  Gerando ${label}...`);

      const prompt = buildPrompt(briefing, abordagem, formato);

      try {
        const msg = await anthropic.messages.create({
          model:      'claude-opus-4-6',
          max_tokens: 1024,
          messages:   [{ role: 'user', content: prompt }],
        });

        const raw = msg.content[0].text;
        const parsed = parseResposta(raw, formato.id, abordagem.id, clienteRaw);

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

// ---- Monta o prompt ----
function buildPrompt(briefing, abordagem, formato) {
  const avatar = briefing.avatar || {};
  const provas = (briefing.provas_sociais || []).join('\n- ');

  return `Você é um copywriter sênior especializado em anúncios pagos para o mercado de construção civil e pré-moldados no Brasil. Você aplica os 7 Pilares de Pedro Sobral com domínio real, não como checklist.

REGRAS INEGOCIÁVEIS:
- Zero generalismo. Cada variação deve ser específica para ${briefing.cliente} — se o copy puder servir para qualquer empresa do setor, está errado.
- Não suavize fraquezas do produto. Se o produto tem restrições, o copy deve contorná-las com honestidade, não escondê-las.
- Pense em dois ângulos: o que faz o avatar clicar E o que demonstra que o anunciante entende o problema dele de verdade.

Escreva copy para anúncio seguindo os 7 Pilares de Pedro Sobral.

## BRIEFING DO CLIENTE

**Produto:** ${briefing.produto_anunciado}
**Cliente:** ${briefing.cliente}
**Promessa principal:** ${briefing.promessa_principal}
**CTA:** ${briefing.cta_principal}

**Avatar:**
- Nome/perfil: ${avatar.nome_ficticio || ''}
- Profissão: ${avatar.profissao || ''}
- Região: ${avatar.regiao || ''}
- Dor principal: ${avatar.dor_principal || ''}
- Desejo: ${avatar.desejo_principal || ''}
- Objeções: ${(avatar.objecoes || []).join(' / ')}
- Linguagem: ${avatar.linguagem || ''}

**Provas sociais disponíveis:**
- ${provas || 'Não informado'}

## ABORDAGEM

**${abordagem.id} — ${abordagem.nome}**
${abordagem.instrucao}

## FORMATO

**${formato.nome}**
${formato.instrucao}

## REGRAS OBRIGATÓRIAS

1. Linguagem direta, sem frescura — fale como fazendeiro fala para fazendeiro
2. Não use: "inovação", "sustentável", "ecossistema", "disruptivo"
3. Use números reais (anos, reais, hectares)
4. O hook deve funcionar nos primeiros 3 segundos
5. Gere 3 variações (V1, V2, V3)

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
}

${formato.id === 'search' ? `Para Google Ads Search, use este formato:
{
  "v1": { "headlines": ["h1","h2","h3","h4","h5"], "descriptions": ["d1","d2"] },
  "v2": { "headlines": ["h1","h2","h3","h4","h5"], "descriptions": ["d1","d2"] },
  "v3": { "headlines": ["h1","h2","h3","h4","h5"], "descriptions": ["d1","d2"] }
}` : ''}`;
}

// ---- Parseia resposta ----
function parseResposta(raw, formatoId, abordagemId, cliente) {
  let variacoes;
  try {
    // Remove possível markdown ```json ... ```
    const clean = raw.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
    variacoes = JSON.parse(clean);
  } catch {
    variacoes = { v1: { hook: raw, copy: '', cta: '' } };
  }

  // Monta nomenclatura de anúncios
  const abordCodigoMap = { A1: 'DORFINANCEIRA', A2: 'GERACAO', A3: 'PROVASOCIAL' };
  const formatoCodigoMap = { feed: 'FEED', stories: 'STORIES', search: 'SEARCH', retargeting: 'RETARGETING' };

  const abordCodigo = abordCodigoMap[abordagemId] || abordagemId;
  const formatoCodigo = formatoCodigoMap[formatoId] || formatoId.toUpperCase();
  const clienteUpper = cliente.toUpperCase();

  return {
    abordagem: abordagemId,
    formato:   formatoId,
    variacoes: Object.entries(variacoes).map(([versao, dados], idx) => ({
      nome: `${clienteUpper}_${abordCodigo}_${formatoCodigo}_${versao.toUpperCase()}`,
      ...dados,
    })),
  };
}

main().catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
