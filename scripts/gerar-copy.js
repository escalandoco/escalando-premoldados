#!/usr/bin/env node
/**
 * ESCALANDO PREMOLDADOS — Gerador de Copy para LP via Claude AI
 *
 * Uso:
 *   node scripts/gerar-copy.js --briefing=config/briefing-concrenor.json
 *   node scripts/gerar-copy.js --briefing=config/briefing-concrenor.json --output=config/lp-concrenor.json
 *
 * O script:
 *   1. Lê o briefing JSON do cliente
 *   2. Envia para Claude Opus 4.6 com prompt especializado em copywriting
 *   3. Gera headline, subheadline, diferenciais, depoimentos, etc.
 *   4. Salva config/lp-{cliente}.json pronto para usar com gerar-lp.js
 *
 * Variável de ambiente necessária:
 *   ANTHROPIC_API_KEY=sk-ant-...
 */

import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// ---- CLI args ----
const args = {};
for (const a of process.argv.slice(2)) {
  const [k, ...v] = a.replace(/^--/, '').split('=');
  args[k] = v.join('=') || true;
}

if (!args.briefing) {
  console.error('Uso: node scripts/gerar-copy.js --briefing=config/briefing-{cliente}.json');
  console.error('Exemplo: node scripts/gerar-copy.js --briefing=config/briefing-concrenor.json');
  process.exit(1);
}

const briefingPath = path.resolve(ROOT, args.briefing);
if (!fs.existsSync(briefingPath)) {
  console.error(`❌ Briefing não encontrado: ${briefingPath}`);
  process.exit(1);
}

const briefing = JSON.parse(fs.readFileSync(briefingPath, 'utf8'));

function toSlug(str) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const slug = toSlug(briefing.empresa);
const outputPath = args.output
  ? path.resolve(ROOT, args.output)
  : path.join(ROOT, 'config', `lp-${slug}.json`);

// ---- Monta prompt ----
const diferenciais = [];
for (let i = 1; i <= 6; i++) {
  if (briefing[`diferencial_${i}`]) diferenciais.push(briefing[`diferencial_${i}`]);
}

const prompt = `Você é um especialista em copywriting para landing pages de pequenas empresas brasileiras, focado em conversão e vendas diretas.

Sua missão: transformar as informações do briefing abaixo em copy persuasivo e pronto para uso em landing page.

## BRIEFING DA EMPRESA

**Empresa:** ${briefing.empresa}
**Campanha/LP:** ${briefing.lp_nome || 'Geral'}
**Segmento:** ${briefing.segmento}
**Cidade:** ${briefing.cidade}
**Regiões atendidas:** ${briefing.regioes}

**Tom de comunicação:** ${briefing.tom || 'direto-pratico'}
**Proposta única de valor:** ${briefing.proposta_unica || ''}

**História do fundador:** ${briefing.historia_fundacao || ''}
**Maior orgulho:** ${briefing.maior_orgulho || ''}

**Cliente ideal:** ${briefing.cliente_ideal || ''}
**Principal dor do cliente:** ${briefing.dor_cliente || ''}
**Resultado que o cliente obtém:** ${briefing.resultado_cliente || ''}

**Diferenciais mencionados pelo dono:**
${diferenciais.map((d, i) => `${i + 1}. ${d}`).join('\n')}

**Números da empresa:**
- Fundada em: ${briefing.ano_fundacao || ''}
- Clientes atendidos: ${briefing.num_clientes || ''}
- Cidades: ${briefing.num_cidades || ''}
- Produção: ${briefing.producao || ''}
- Prazo de entrega: ${briefing.prazo_entrega || ''}

**Certificações/qualidade:** ${briefing.certificacoes || ''}
**Nome do fundador:** ${briefing.nome_dono || ''}

## INSTRUÇÕES DE COPYWRITING

- Use linguagem direta e regional (nordeste brasileiro quando aplicável)
- Foco em benefício concreto, não em feature técnica
- CTA sempre voltado para orçamento via WhatsApp
- Depoimentos devem parecer reais e específicos (baseados nos resultados mencionados)
- Headline: problema → solução, ou benefício principal
- Evite clichês como "qualidade incomparável" ou "melhor do mercado"

## OUTPUT ESPERADO

Responda APENAS com JSON válido, sem markdown, sem explicações. Siga exatamente esta estrutura:

{
  "headline": "Título principal — impactante, direto, focado no benefício. Máx 10 palavras.",
  "subheadline": "Subtítulo que complementa o headline, menciona cidade/região. Máx 20 palavras.",
  "badge": "Categoria curta da empresa — 2 a 4 palavras",
  "slogan": "Slogan memorável da empresa — máx 8 palavras",
  "whatsapp_msg": "Olá ${briefing.empresa}! Vim pelo site e gostaria de um orçamento.",
  "numeros": [
    { "valor": "10+", "label": "Anos de experiência" },
    { "valor": "500+", "label": "Obras atendidas" },
    { "valor": "48h", "label": "Prazo de entrega" }
  ],
  "diferenciais": [
    { "icone": "🏭", "titulo": "Fábrica própria", "desc": "Uma frase mostrando o diferencial real com benefício concreto." },
    { "icone": "🚚", "titulo": "Entrega rápida", "desc": "Uma frase com prazo específico e região." },
    { "icone": "⏳", "titulo": "Dura 50 anos", "desc": "Uma frase sobre durabilidade vs. concorrente." },
    { "icone": "📋", "titulo": "Laudo técnico", "desc": "Uma frase sobre garantia e certificação." }
  ],
  "depoimentos": [
    { "nome": "Nome Sobrenome", "local": "Cidade — UF", "texto": "Depoimento realista e específico, 2 frases, baseado nos resultados do briefing." },
    { "nome": "Nome Sobrenome", "local": "Cidade — UF", "texto": "Segundo depoimento com abordagem diferente." }
  ],
  "headline_ab": "Variação alternativa do headline para teste A/B — abordagem diferente."
}`;

// ---- Main ----
async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('❌ ANTHROPIC_API_KEY não definida.');
    console.error('   Adicione no .env: ANTHROPIC_API_KEY=sk-ant-...');
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });

  console.log(`\n🖊️  Gerando copy para: ${briefing.empresa} — ${briefing.lp_nome || 'Geral'}`);
  console.log('⏳ Consultando Claude Opus 4.6...\n');
  console.log('─'.repeat(60));

  const stream = client.messages.stream({
    model: 'claude-opus-4-6',
    max_tokens: 4096,
    thinking: { type: 'adaptive' },
    messages: [{ role: 'user', content: prompt }],
  });

  let fullText = '';
  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      process.stdout.write(event.delta.text);
      fullText += event.delta.text;
    }
  }

  console.log('\n' + '─'.repeat(60));

  // Extrai e parseia o JSON da resposta
  let copyData;
  try {
    const jsonMatch = fullText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Nenhum JSON encontrado na resposta');
    copyData = JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error(`\n❌ Erro ao parsear JSON: ${err.message}`);
    console.error('Resposta bruta salva em: config/copy-raw-error.txt');
    fs.writeFileSync(path.join(ROOT, 'config', 'copy-raw-error.txt'), fullText);
    process.exit(1);
  }

  // Monta config completo (copy gerado + dados do briefing)
  const config = {
    empresa: briefing.empresa,
    slogan: copyData.slogan || briefing.slogan || '',
    cor_primaria: briefing.cor_primaria || '#C4B470',
    cor_secundaria: briefing.cor_secundaria || '#0D1117',
    estilo: briefing.estilo || 'clean',
    whatsapp: briefing.whatsapp || '',
    whatsapp_msg: copyData.whatsapp_msg,
    telefone: briefing.telefone || '',
    cidade: briefing.cidade || '',
    regioes: typeof briefing.regioes === 'string'
      ? briefing.regioes.split(',').map(r => r.trim())
      : briefing.regioes || [],
    headline: copyData.headline,
    headline_ab: copyData.headline_ab || '',
    subheadline: copyData.subheadline,
    badge: copyData.badge,
    numeros: copyData.numeros,
    produtos: briefing.produtos || [],
    diferenciais: copyData.diferenciais,
    depoimentos: copyData.depoimentos,
    pixel_meta: briefing.pixel_meta || '',
    ga4: briefing.ga4 || '',
  };

  // Salva
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(config, null, 2));

  console.log(`\n✅ Copy gerado com sucesso!`);
  console.log(`📄 Config salva em: ${outputPath}`);
  console.log(`\n📋 Próximos passos:`);
  console.log(`   1. Revise o copy em: ${outputPath}`);
  console.log(`   2. Compartilhe com o cliente para aprovação`);
  console.log(`   3. Após aprovação, gere a LP:`);
  console.log(`      node scripts/gerar-lp.js --empresa="${briefing.empresa}" --config=${outputPath}`);
}

main().catch(err => {
  console.error(`\n❌ Erro inesperado: ${err.message}`);
  process.exit(1);
});
