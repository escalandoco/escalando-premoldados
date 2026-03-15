#!/usr/bin/env node
/**
 * ESCALANDO PREMOLDADOS — Criador de Dossiê do Cliente
 *
 * Cria um ClickUp Doc com todas as seções do Dossiê,
 * pré-populado com dados existentes do kickoff.
 *
 * Uso:
 *   node scripts/criar-dossie.js --cliente=concrenor
 *
 * O script:
 *   1. Busca a pasta e dados de kickoff do cliente no ClickUp
 *   2. Cria um Doc "Dossiê — [Cliente]" dentro da pasta
 *   3. Cria 5 páginas estruturadas com conteúdo inicial
 *   4. Salva os IDs em config/dossie-{cliente}.json para uso dos agentes
 */

import { parseArgs } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { lerDadosCliente } from './ficha.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const { values } = parseArgs({
  options: { cliente: { type: 'string', default: 'concrenor' } },
});
const CLIENTE = values.cliente;
const CLIENTE_NOME = CLIENTE.charAt(0).toUpperCase() + CLIENTE.slice(1);

const CLICKUP_KEY = process.env.CLICKUP_API_KEY;
const WS          = '90133050692';
const SPACE_ID    = process.env.CLICKUP_SPACE_ID || '901313678809';

// ── ClickUp helpers ───────────────────────────────────────────
async function cuGet(path) {
  const r = await fetch(`https://api.clickup.com/api/v2${path}`, {
    headers: { Authorization: CLICKUP_KEY },
  });
  if (!r.ok) throw new Error(`GET ${path} → ${r.status}`);
  return r.json();
}

async function cuV3Post(path, body) {
  const r = await fetch(`https://api.clickup.com/api/v3${path}`, {
    method: 'POST',
    headers: { Authorization: CLICKUP_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

async function cuV3Delete(path) {
  await fetch(`https://api.clickup.com/api/v3${path}`, {
    method: 'DELETE',
    headers: { Authorization: CLICKUP_KEY },
  });
}

// ── Monta conteúdo markdown das páginas ──────────────────────
function paginaKickoff(cf, nome) {
  const hoje = new Date().toLocaleDateString('pt-BR');
  return `# 📋 Kickoff — ${nome}

> Dados capturados no onboarding inicial. Atualize se o cliente revisar informações.
> _Criado em ${hoje}_

---

## 🎯 Objetivo Principal

${cf['Objetivo Principal'] || '_Não informado — preencher após kickoff_'}

## 🎯 Objetivos Secundários

${cf['Objetivos Secundários'] || '_Não informado_'}

---

## 🏢 Negócio

**Produtos/Serviços:** ${cf['Produtos'] || '_Não informado_'}

**Como Vendem Hoje:** ${cf['Como Vendem Hoje'] || '_Não informado_'}

**Diferenciais Declarados:** ${cf['Diferenciais'] || '_Não informado_'}

**Verba Mensal:** ${cf['Verba Mensal'] ? `R$${cf['Verba Mensal']}` : '_Não informado_'}

---

## 👥 Clientes

**Perfil dos Clientes:** ${cf['Perfil dos Clientes'] || '_Não informado_'}

**Área de Atuação:** ${cf['Área de Atuação'] || '_Não informado_'}

---

## 🏁 Concorrentes

${cf['Concorrentes'] || '_Não informado — preencher após análise_'}

---

## 📝 Observações do Onboarding

${cf['Observações'] || '_Sem observações registradas_'}

---

## 📬 Contato Comercial

**Responsável pelos leads:** _Preencher_
**WhatsApp:** _Preencher_

---

## 🏆 O que define sucesso em 60 dias

_Preencher após alinhamento com o cliente_
`;
}

function paginaBriefing(cf, nome) {
  return `# 🎯 Briefing Criativo — ${nome}

> Interpretação estratégica da agência sobre os dados do cliente.
> Usada pelos agentes para gerar copy, anúncios e landing pages.
> _Atualize sempre que mudar a estratégia criativa._

---

## 👤 Avatar — Cliente Ideal

**Perfil:** ${cf['Perfil dos Clientes'] || '_Descrever o cliente ideal_'}

**Como nos encontra:** _Indicação, WhatsApp, Instagram — detalhar_

**Faixa de idade:** _Preencher_

**Onde está:** _Cidade, região, zona rural?_

---

## 💥 Dores, Desejos e Dúvidas

### Dores (o que ele sofre hoje)
- _Preencher_
- _Preencher_
- _Preencher_

### Desejos (o que ele quer alcançar)
- _Preencher_
- _Preencher_
- _Preencher_

### Dúvidas (o que trava a compra)
- _Preencher_
- _Preencher_
- _Preencher_

---

## ✍️ Direção de Copy

**Tom de comunicação:** _Direto, técnico, regional?_

**Promessa principal:** _A frase central que gera conversão_

**Principal objeção a superar:** _O que o cliente hesita antes de fechar_

**O que o cliente fala ao escolher a empresa:** ${cf['Diferenciais'] || '_Preencher_'}

---

## 🏷️ Produto Principal

**Nome:** ${cf['Produtos']?.split(',')[0]?.trim() || '_Preencher_'}

**Benefícios-chave:**
- _Preencher_
- _Preencher_

**Preço médio:** _Preencher_

**Prazo de entrega:** _Preencher_

**Raio de entrega:** _Preencher_
`;
}

function paginaPerformance(nome) {
  return `# 📊 Histórico de Performance — ${nome}

> Alimentado automaticamente pelo agente **relatorio-ads** após cada relatório quinzenal.
> Não edite manualmente — use o campo "Decisões Estratégicas" para notas.

---

## 📈 Baseline (início)

_Sem dados ainda. Primeiro relatório será gerado em breve._

| Período | Investimento | Leads | CPL | CTR | Status |
|---------|-------------|-------|-----|-----|--------|
| — | — | — | — | — | Aguardando |

---

## 🔄 Atualizações

_Os relatórios quinzenais serão adicionados aqui automaticamente._
`;
}

function paginaBenchmarking(nome) {
  return `# 🔍 Benchmarking Competitivo — ${nome}

> Alimentado automaticamente pelo agente **analisar-concorrentes**.
> A primeira análise é gerada automaticamente no onboarding.

---

## 📅 Última Análise

_Análise pendente ou em processamento._

---

## 🏆 Ranking de Ameaças

_Será preenchido após a análise._

---

## 💡 Oportunidades Identificadas

_Será preenchido após a análise._
`;
}

function paginaEstrategia(nome) {
  const hoje = new Date().toLocaleDateString('pt-BR');
  return `# 💡 Decisões Estratégicas — ${nome}

> Espaço para notas manuais, decisões tomadas e próximos passos.
> **Este é o único doc onde você escreve livremente.**

---

## 🎯 Metas Acordadas

_Preencher após reunião de kickoff com o cliente._

**Em 30 dias:**
- [ ] _Preencher_

**Em 60 dias:**
- [ ] _Preencher_

**Em 90 dias:**
- [ ] _Preencher_

---

## 📌 Próximos Passos

- [ ] LP no ar
- [ ] Primeira campanha rodando
- [ ] Primeiro relatório entregue

---

## 📓 Registro de Decisões

> _Use este espaço para documentar o que foi decidido, quando e por quê._

**${hoje} — Onboarding iniciado**
- Cliente adicionado ao sistema Escalando Premoldados
- Dossiê criado com dados do kickoff

---

## 💬 Histórico de Alinhamentos com o Cliente

_Registre reuniões, feedbacks e ajustes de rota aqui._
`;
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  if (!CLICKUP_KEY) {
    console.error('CLICKUP_API_KEY obrigatório.');
    process.exit(1);
  }

  const configPath = path.join(ROOT, 'config', `dossie-${CLIENTE}.json`);
  if (fs.existsSync(configPath)) {
    console.log(`ℹ️  Dossiê já existe: ${configPath}`);
    console.log('   Para recriar, delete o arquivo e rode novamente.');
    process.exit(0);
  }

  console.log(`\n📂 Criando Dossiê — ${CLIENTE_NOME}`);

  // 1. Encontra pasta do cliente
  const { folders } = await cuGet(`/space/${SPACE_ID}/folder?archived=false`);
  const folder = folders.find(f => f.name.toLowerCase().includes(CLIENTE.toLowerCase()));
  if (!folder) throw new Error(`Pasta "${CLIENTE}" não encontrada no ClickUp.`);
  console.log(`   Pasta: ${folder.name} (${folder.id})`);

  // 2. Busca dados da Ficha em OPERAÇÃO/Fichas
  let cf = {};
  try {
    const dados = await lerDadosCliente(CLIENTE);
    cf = dados.cf;
    console.log(`   Ficha encontrada: ${Object.keys(cf).filter(k => cf[k]).length} campos`);
  } catch (e) {
    console.warn(`   ⚠️  Ficha não encontrada: ${e.message} — criando Dossiê sem dados`);
  }

  // 3. Cria o Doc
  process.stdout.write('   Criando Doc no ClickUp...');
  const doc = await cuV3Post(`/workspaces/${WS}/docs`, {
    name: `Dossiê — ${CLIENTE_NOME}`,
    parent: { id: folder.id, type: 5 },
  });
  if (!doc.id) throw new Error(`Falha ao criar Doc: ${JSON.stringify(doc)}`);
  console.log(` ✅ (${doc.id})`);

  // 4. Cria as 5 páginas
  const paginas = [
    { key: 'kickoff',       nome: '📋 Kickoff',                  content: paginaKickoff(cf, CLIENTE_NOME) },
    { key: 'briefing',      nome: '🎯 Briefing',                  content: paginaBriefing(cf, CLIENTE_NOME) },
    { key: 'performance',   nome: '📊 Histórico de Performance',  content: paginaPerformance(CLIENTE_NOME) },
    { key: 'benchmarking',  nome: '🔍 Benchmarking',              content: paginaBenchmarking(CLIENTE_NOME) },
    { key: 'estrategia',    nome: '💡 Decisões Estratégicas',     content: paginaEstrategia(CLIENTE_NOME) },
  ];

  const pageIds = {};
  for (const p of paginas) {
    process.stdout.write(`   Criando "${p.nome}"...`);
    const page = await cuV3Post(`/workspaces/${WS}/docs/${doc.id}/pages`, {
      name: p.nome,
      content: p.content,
      content_format: 'text/md',
    });
    if (!page.id) {
      console.log(` ❌ ${JSON.stringify(page)}`);
    } else {
      pageIds[p.key] = page.id;
      console.log(` ✅ (${page.id})`);
    }
  }

  // 5. Salva config
  const config = {
    cliente: CLIENTE,
    doc_id: doc.id,
    folder_id: folder.id,
    criado_em: new Date().toISOString(),
    pages: pageIds,
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  console.log(`\n✅ Dossiê criado com sucesso!`);
  console.log(`   Doc: ${doc.id}`);
  console.log(`   Config: config/dossie-${CLIENTE}.json`);
  console.log(`   Acesse no ClickUp → pasta ${folder.name} → Docs\n`);
}

main().catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
