# Plano: LP Gates + Squad
**Versão:** 1.0
**Criado:** 2026-03-11
**Status:** Planejado — aguardando implementação

---

## Visão Geral

O pipeline de criação de LP é dividido em **5 gates automáticos** que disparam via webhook do ClickUp, orquestrados por um **LP Squad** com 10 agentes em 3 tiers.

---

## Arquitetura do LP Squad

```
lp-squad/
├── lp-coordinator       ← Tier 0 — Orquestrador
├── lp-ux                ← Tier 1 — Estrutura e wireframe
├── lp-copywriter        ← Tier 1 — Orquestra copy
│   ├── gary-halbert     ← Tier 2 — Hook emocional + SSS
│   ├── dan-kennedy      ← Tier 2 — PAS + direct response
│   ├── claude-hopkins   ← Tier 2 — Claims específicos
│   └── john-carlton     ← Tier 2 — Headline + benefícios
├── lp-visual            ← Tier 1 — Orquestra visual
│   ├── visual-generator ← Tier 2 — Paleta + prompts AI
│   └── brad-frost       ← Tier 2 — Template + componentes
├── lp-generator         ← Tier 1 — Executa gerar-lp.js
└── lp-deployer          ← Tier 1 — Executa deploy-lp.js
```

**Total:** 10 agentes (1 Tier 0 + 5 Tier 1 + 4 Tier 2)

---

## Dois modos de orquestração

| Modo | Como ativa | Quando usar |
|------|-----------|-------------|
| **Automático** | Webhook ClickUp → `lp-gate.js` | Fluxo normal — task marcada como complete |
| **Interativo** | `@lp-coordinator` | Checar status, forçar fase, revisar output |

---

## Pipeline Completo

```
Gate C (Onboarding) → cria 📝 LP Briefing
         │
         ▼
  ┌─────────────────────────────┐
  │ GATE LP-1                   │
  │ Trigger: LP Briefing → done │
  │ Agentes: coordinator + ux   │
  └────────────┬────────────────┘
               │ cria Fase 1–5 + wireframe
               ▼
     [FASE 1 — DNA do Cliente]
          ✋ manual — Jon valida
               │
  ┌─────────────────────────────┐
  │ GATE LP-2                   │
  │ Trigger: Fase 1 → done      │
  │ Agentes: lp-copywriter      │
  └────────────┬────────────────┘
               │ gera copy sections
               ▼
     [FASE 2 — Copy da LP]
          ✋ manual — Jon aprova textos
               │
  ┌─────────────────────────────┐
  │ GATE LP-3                   │
  │ Trigger: Fase 2 → done      │
  │ Agentes: lp-visual          │
  └────────────┬────────────────┘
               │ gera paleta + prompts + config visual
               ▼
     [FASE 3 — Identidade Visual]
          ✋ manual — Jon aprova visual
               │
  ┌─────────────────────────────┐
  │ GATE LP-4                   │
  │ Trigger: Fase 3 → done      │
  │ Agentes: lp-generator       │
  └────────────┬────────────────┘
               │ roda gerar-lp.js → valida HTML
               ▼
     [FASE 4 — Geração da LP]
          ✅ automático — valida output
               │
  ┌─────────────────────────────┐
  │ GATE LP-5                   │
  │ Trigger: Fase 4 → done      │
  │ Agentes: lp-deployer        │
  └────────────┬────────────────┘
               │ deploy FTP + verifica URL + pixel
               ▼
     [FASE 5 — Deploy]
          ✅ automático → 🚀 LP no ar
```

---

## Detalhamento dos Gates

### Gate LP-1 — LP Briefing recebido
**Trigger:** task `📝 LP Briefing — {empresa}` → complete
**Arquivo:** `scripts/lp-gate.js` → `gateLp1(empresa)`

**Validações:**
- Config JSON existe em `config/lp-{slug}.json`
- Campos obrigatórios preenchidos: `whatsapp`, `cidade`, `produtos`, `headline`

**Execuções:**
- `lp-coordinator` cria tasks Fase 1–5 na lista Landing Pages
- `lp-ux` analisa briefing e posta estrutura de seções na [FASE 1]
- Loga no dashboard: `gate-lp1-pipeline-criado`

**Notifica:** Jon — "Pipeline LP criado para {empresa}"

---

### Gate LP-2 — DNA do Cliente aprovado
**Trigger:** task `[FASE 1] DNA do Cliente — {empresa}` → complete
**Arquivo:** `scripts/lp-gate.js` → `gateLp2(empresa)`

**Validações:**
- Checklist da Fase 1 completo no ClickUp
- Fotos recebidas e salvas no Drive

**Execuções:**
- `lp-copywriter` é ativado com contexto da Ficha + briefing
  - `gary-halbert` → hook emocional + headline SSS
  - `dan-kennedy` → estrutura PAS + CTA + urgência
  - `claude-hopkins` → claims específicos para diferenciais
  - `john-carlton` → headline final "gun to the head"
- Output consolidado em `config/copy-{slug}.json`
- Posta copy gerada como comentário na [FASE 2]
- Loga no dashboard: `gate-lp2-copy-gerada`

**Notifica:** Jon — "Copy gerada para {empresa} — aguarda sua revisão"

---

### Gate LP-3 — Copy aprovada
**Trigger:** task `[FASE 2] Copy da LP — {empresa}` → complete
**Arquivo:** `scripts/lp-gate.js` → `gateLp3(empresa)`

**Validações:**
- Copy aprovada (task Fase 2 = done)
- Ficha tem `Produto Foco` e `Tom de Voz` preenchidos

**Execuções:**
- `lp-visual` é ativado com contexto do briefing + copy aprovada
  - `visual-generator` → sugere paleta de cores + prompts para fotos de produto
  - `brad-frost` → valida estrutura do `template-lp.html`, sugere adaptações
- Output em `config/visual-{slug}.json`
- Posta sugestão visual como comentário na [FASE 3]
- Loga no dashboard: `gate-lp3-visual-gerado`

**Notifica:** Jon — "Identidade visual gerada para {empresa} — aguarda sua aprovação"

---

### Gate LP-4 — Identidade Visual aprovada
**Trigger:** task `[FASE 3] Identidade Visual — {empresa}` → complete
**Arquivo:** `scripts/lp-gate.js` → `gateLp4(empresa)`

**Validações:**
- Fase 2 (copy) concluída
- Fase 3 (visual) concluída
- `config/lp-{slug}.json` sem campos `"A DEFINIR"`
- `quality-gate.js` → Fase 4 liberada

**Execuções:**
- `lp-generator` aciona VPS via `run-worker`: `gerar-lp --cliente={empresa}`
- Valida output: `dist/{slug}/index.html` existe
- Posta checklist de qualidade na [FASE 4]
- Loga no dashboard: `gate-lp4-lp-gerada`

**Notifica:** Jon — "LP gerada para {empresa} — verifique antes de aprovar deploy"

---

### Gate LP-5 — LP gerada e aprovada
**Trigger:** task `[FASE 4] Geração da LP — {empresa}` → complete
**Arquivo:** `scripts/lp-gate.js` → `gateLp5(empresa)`

**Validações:**
- `dist/{slug}/index.html` existe
- `quality-gate.js` → Fase 5 liberada
- Pixel Meta configurado no config

**Execuções:**
- `lp-deployer` aciona VPS via `run-worker`: `deploy-lp --cliente={empresa}`
- Verifica URL em produção (HTTP 200)
- Confirma SSL funcionando
- Loga no dashboard: `gate-lp5-deploy-realizado`

**Notifica:** Jon — "🚀 LP de {empresa} no ar: {url}"

---

## Detalhamento dos Agentes

### Tier 0 — Orquestrador

#### `lp-coordinator` (Leo)
- **Papel:** Orquestra o pipeline completo, monitora progresso, gerencia bloqueios
- **Origem:** Novo agente
- **Comandos principais:**
  - `*status {empresa}` — mostra em qual fase está e o que falta
  - `*force-fase {n} {empresa}` — força execução de um gate manualmente
  - `*review {empresa}` — mostra todos os outputs gerados até agora
  - `*bloqueios` — lista clientes travados em alguma fase
- **Acessa:** ClickUp, `config/`, `data/job-queue.json`

---

### Tier 1 — Especialistas operacionais

#### `lp-ux` (Uma)
- **Papel:** Define estrutura da LP antes de qualquer copy ou visual
- **Origem:** Adaptar UX Designer do design-squad
- **O que entrega:** Estrutura de seções, ordem de blocos, posicionamento de CTAs
- **Formato de output:** Comentário na [FASE 1] com mapa de seções

```
Seções sugeridas para {empresa}:
1. Hero — headline + subheadline + CTA principal
2. Problema — 3 dores do avatar
3. Solução — produtos + diferenciais
4. Prova social — depoimentos
5. Como funciona — 3 passos
6. CTA final — urgência + WhatsApp
```

---

#### `lp-copywriter` (Cora)
- **Papel:** Gera copy completa da LP orquestrando 4 copy experts
- **Origem:** Novo agente (wrapper dos Tier 2)
- **Processo interno:**
  1. Halbert → hook emocional + SSS para o hero
  2. Kennedy → estrutura PAS para seção de problema
  3. Hopkins → claims específicos para diferenciais (números reais)
  4. Carlton → headline final + P.S.
- **Formato de output:** `config/copy-{slug}.json`

```json
{
  "headline": "...",
  "subheadline": "...",
  "problema": ["...", "...", "..."],
  "diferenciais": ["...", "...", "..."],
  "cta_principal": "...",
  "cta_secundario": "...",
  "ps": "..."
}
```

---

#### `lp-visual` (Vera)
- **Papel:** Define identidade visual e gera prompts para imagens
- **Origem:** Novo agente (wrapper dos Tier 2)
- **Processo interno:**
  1. Visual Generator → paleta de cores + prompts AI para fotos
  2. Brad Frost → adaptação do template para o estilo aprovado
- **Formato de output:** `config/visual-{slug}.json`

```json
{
  "cor_primaria": "#...",
  "cor_secundaria": "#...",
  "estilo": "industrial|clean|rustico|bold",
  "prompts_fotos": ["...", "...", "..."],
  "fonte_titulo": "...",
  "fonte_corpo": "..."
}
```

---

#### `lp-generator` (Geno)
- **Papel:** Executa `gerar-lp.js` e valida o output
- **Origem:** Novo agente
- **Script:** `node scripts/gerar-lp.js --empresa={empresa}`
- **Valida após geração:**
  - `dist/{slug}/index.html` existe e não está vazio
  - WhatsApp button presente no HTML
  - Formulário presente
  - Meta pixel presente

---

#### `lp-deployer` (Demi)
- **Papel:** Executa `deploy-lp.js` e verifica URL em produção
- **Origem:** Novo agente
- **Script:** `node scripts/deploy-lp.js --cliente={slug}`
- **Valida após deploy:**
  - URL retorna HTTP 200
  - SSL funcionando (HTTPS)
  - Conteúdo correto na página

---

### Tier 2 — Copy Experts (adaptados para pré-moldados)

#### `gary-halbert`
- **Papel:** Hook emocional + SSS (Star, Story, Solution)
- **Origem:** Copiar/adaptar de `/Downloads/squads/copy-squad/agents/gary-halbert.md`
- **Contexto de uso:** Hero section — primeira impressão da LP
- **Foco:** Audiência prática (pedreiro, proprietário rural) — dor real, linguagem direta

#### `dan-kennedy`
- **Papel:** PAS (Problem, Agitate, Solution) + CTA com urgência
- **Origem:** Copiar/adaptar de `/Downloads/squads/copy-squad/agents/dan-kennedy.md`
- **Contexto de uso:** Seção de problema + CTA final
- **Foco:** Reason-why ("por que comprar da Concrenor e não do vizinho")

#### `claude-hopkins`
- **Papel:** Claims específicos com números e fatos concretos
- **Origem:** Copiar/adaptar de `/Downloads/squads/copy-squad/agents/claude-hopkins.md`
- **Contexto de uso:** Seção de diferenciais
- **Foco:** "mourão que agüenta 30 anos", "entrega em até 5 dias úteis"

#### `john-carlton`
- **Papel:** Headline definitiva + descoberta do benefício real
- **Origem:** Copiar/adaptar de `/Downloads/squads/copy-squad/agents/john-carlton.md`
- **Contexto de uso:** Headline principal da LP
- **Foco:** "gun to the head" — 1 headline que captura o maior benefício

---

### Tier 2 — Design Experts (adaptados para pré-moldados)

#### `visual-generator`
- **Papel:** Gera paleta de cores e prompts para fotos de produto
- **Origem:** Copiar/adaptar de `/Downloads/squads/design-squad/agents/visual-generator.md`
- **Contexto de uso:** Fase 3 — identidade visual por cliente
- **Foco:** Produto industrial + rural + concreto — estilos: industrial, rústico, clean

#### `brad-frost`
- **Papel:** Adapta `template-lp.html` para cada cliente (atomic design)
- **Origem:** Copiar/adaptar de `/Downloads/squads/design-squad/agents/brad-frost.md`
- **Contexto de uso:** Fase 3 — garante que o template seja componentizado
- **Foco:** Consistência entre clientes, variações de tema sem duplicar código

---

## O que já existe (não reescrever)

| Arquivo | Função |
|---------|--------|
| `scripts/gerar-lp.js` | Geração do HTML da LP |
| `scripts/deploy-lp.js` | Deploy via FTP |
| `scripts/gerar-copy-ads.js` | Geração de copy para anúncios |
| `scripts/quality-gate.js` | Validação de fases no ClickUp |
| `config/pipeline-lp-template.json` | Definição das 5 fases |
| `config/lp-concrenor.json` | Config LP do primeiro cliente |
| `lp/template-lp.html` | Template base da LP |
| `docs/dash-local/server.js` | Dashboard + endpoint `/api/log-job` |

---

## O que falta construir (ordem sugerida)

### Fase 1 — Gates (automação)
1. `scripts/lp-gate.js` — engine com `gateLp1` a `gateLp5`
2. Adicionar rotas LP no `api/clickup-status-change.js`
3. Adicionar `gerar-lp` e `deploy-lp` na whitelist do `run-worker` (se ausentes)

### Fase 2 — Agentes Tier 1 e Tier 0
4. `.aios-core/development/agents/squads/lp/lp-coordinator.md`
5. `.aios-core/development/agents/squads/lp/lp-ux.md`
6. `.aios-core/development/agents/squads/lp/lp-copywriter.md`
7. `.aios-core/development/agents/squads/lp/lp-visual.md`
8. `.aios-core/development/agents/squads/lp/lp-generator.md`
9. `.aios-core/development/agents/squads/lp/lp-deployer.md`

### Fase 3 — Agentes Tier 2 (adaptar dos squads externos)
10. `.aios-core/development/agents/squads/lp/gary-halbert.md`
11. `.aios-core/development/agents/squads/lp/dan-kennedy.md`
12. `.aios-core/development/agents/squads/lp/claude-hopkins.md`
13. `.aios-core/development/agents/squads/lp/john-carlton.md`
14. `.aios-core/development/agents/squads/lp/visual-generator.md`
15. `.aios-core/development/agents/squads/lp/brad-frost.md`

### Fase 4 — Integração dashboard
16. Logar execuções LP no `data/job-queue.json` (mesmo padrão dos onboarding gates)

---

## Estrutura de pastas do squad

```
.aios-core/development/agents/squads/lp/
├── squad.yaml              ← Definição do squad
├── lp-coordinator.md       ← Tier 0
├── lp-ux.md                ← Tier 1
├── lp-copywriter.md        ← Tier 1
├── lp-visual.md            ← Tier 1
├── lp-generator.md         ← Tier 1
├── lp-deployer.md          ← Tier 1
├── gary-halbert.md         ← Tier 2
├── dan-kennedy.md          ← Tier 2
├── claude-hopkins.md       ← Tier 2
├── john-carlton.md         ← Tier 2
├── visual-generator.md     ← Tier 2
└── brad-frost.md           ← Tier 2
```

---

## Convenções de nomenclatura das tasks no ClickUp

```
[FASE 1] DNA do Cliente — {Empresa}
[FASE 2] Copy da LP — {Empresa}
[FASE 3] Identidade Visual — {Empresa}
[FASE 4] Geração da LP — {Empresa}
[FASE 5] Deploy — {Empresa}
```

Todos os gates verificam `taskName.startsWith('[FASE N]')` para identificar a fase correta.

---

*Plano v1.0 — Escalando Premoldados — 2026-03-11*
*Próxima ação: implementar `scripts/lp-gate.js` (Fase 1)*
