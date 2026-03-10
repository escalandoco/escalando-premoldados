# Plano de Implementacao: Quality Gates para LPs

**Data:** 2026-03-10
**Autor:** Morgan (PM)
**Projeto:** escalando-premoldados
**Estimativa total:** 5-7 dias de desenvolvimento

---

## Analise do Estado Atual

### O que ja existe e funciona

| Componente | Arquivo | Status |
|---|---|---|
| Gerador de LP | `scripts/gerar-lp.js` | Funcional - le config JSON, renderiza template, upload FTP, notifica ClickUp |
| Deploy FTP separado | `scripts/deploy-lp.js` | Funcional - deploy por cliente via config/deploy-clients.json |
| Config por cliente | `config/lp-concrenor.json` | Funcional - cores, copy, produtos, tracking |
| Template HTML | `lp/template-lp.html` | Funcional - template SPA renderizado via CONFIG |
| Webhook taskCreated | `api/clickup-processor.js` | Funcional - analise automatica por lista |
| Webhook comentario | `api/clickup-agent-dispatcher.js` | Funcional - comment -> identifica intent -> executa script no VPS |
| Agents no dispatcher | `gerar-lp`, `deploy-lp`, `gerar-copy`, etc. | Registrados no AGENTS map |

### Gaps identificados para Quality Gates

1. **Nao ha conceito de "fases" no ClickUp** - Hoje tudo esta em lista "Onboarding" ou "Landing Pages" sem workflow sequencial
2. **Nao ha validacao de pre-requisitos** - `gerar-lp` roda independente do status de copy ou design
3. **Nao ha script para criar estrutura de tasks** - Tasks sao criadas manualmente
4. **Nao ha verificacao de status** antes de executar agentes (quality gate)
5. **Config JSON tem campos "A DEFINIR"** - Nao ha validacao de completude

---

## Arquitetura do Quality Gate System

```
                    CLI (scripts/)
                         |
    +--------------------+--------------------+
    |                    |                    |
criar-pipeline-lp.js  quality-gate.js    gerar-lp.js (modificado)
    |                    |                    |
    v                    v                    v
 Cria 5 tasks      Valida fase N-1      Executa se gate OK
 no ClickUp        antes de avancar
    |                    |                    |
    +--------------------+--------------------+
                         |
                  clickup-agent-dispatcher.js (modificado)
                  Intercepta "@dev gerar LP" → valida gate → executa
```

---

## EPIC 1: Estrutura Base do Pipeline de LPs

**Objetivo:** Criar o script CLI que monta a arvore de tasks no ClickUp para cada novo cliente/campanha.

**Complexidade:** Media
**Estimativa:** 1.5 dias
**Dependencias:** Nenhuma

### Story 1.1: Script criar-pipeline-lp.js

**Descricao:** Script CLI que cria automaticamente a estrutura de 5 fases no ClickUp para uma nova LP.

**Comando:**
```bash
node scripts/criar-pipeline-lp.js --cliente=Concrenor --campanha="Mourao Torneado"
```

**O que o script faz:**
1. Verifica se ja existe Folder do cliente no ClickUp (cria se nao existir)
2. Cria Lista "LP -- {NomeCampanha}" dentro do Folder
3. Cria 5 tasks com nomes padronizados, checklists e descricoes
4. Configura custom fields: `fase`, `status_gate` (Pendente/Aprovado/Reprovado)
5. Define dependencias entre tasks (Fase N depende de Fase N-1)

**Arquivos a criar:**
- `/Users/jongodeiro/escalando-premoldados/scripts/criar-pipeline-lp.js`
- `/Users/jongodeiro/escalando-premoldados/config/pipeline-lp-template.json`

**Arquivo a modificar:**
- Nenhum

**Criterios de aceite:**
- [ ] Ao rodar com --cliente e --campanha, cria Folder (se inexistente) + Lista + 5 tasks
- [ ] Cada task tem checklist pre-definido por fase (ver detalhamento abaixo)
- [ ] Tasks tem dependencias sequenciais (Fase 2 depende de Fase 1, etc.)
- [ ] Se a estrutura ja existe (mesmo nome de lista), aborta com mensagem clara
- [ ] Funciona com --dry-run para preview sem criar nada
- [ ] Log de tudo que foi criado com IDs do ClickUp

**Detalhamento das 5 tasks criadas:**

```
[FASE 1] DNA do Cliente
  Checklist:
  - [ ] Kickoff preenchido (produtos, avatar, tom)
  - [ ] WhatsApp validado
  - [ ] Regioes de entrega definidas
  - [ ] Concorrentes mapeados
  - [ ] Fotos dos produtos recebidas

[FASE 2] Copy da LP
  Checklist:
  - [ ] Headline principal definida
  - [ ] Subheadline escrita
  - [ ] Copy dos diferenciais aprovado
  - [ ] Depoimentos coletados (min 2)
  - [ ] CTA definido

[FASE 3] Identidade Visual
  Checklist:
  - [ ] Cor primaria e secundaria definidas
  - [ ] Logo recebido (PNG fundo transparente)
  - [ ] Fonte escolhida
  - [ ] Fotos dos produtos tratadas
  - [ ] Estilo visual aprovado (clean/bold/minimal)

[FASE 4] Geracao da LP
  Checklist:
  - [ ] Config JSON completo (sem campos "A DEFINIR")
  - [ ] LP gerada sem erros
  - [ ] Mobile responsivo verificado
  - [ ] Formulario testado
  - [ ] WhatsApp link testado
  - [ ] Velocidade aceitavel (< 3s)

[FASE 5] Deploy
  Checklist:
  - [ ] LP aprovada pelo cliente
  - [ ] Pixel Meta configurado
  - [ ] GA4/GTM configurado
  - [ ] Deploy realizado
  - [ ] URL final verificada (HTTP 200)
  - [ ] DNS/SSL funcionando
```

---

### Story 1.2: Template de Config do Pipeline

**Descricao:** Arquivo JSON que define a estrutura padrao do pipeline -- tasks, checklists, descricoes, dependencias.

**Arquivo a criar:**
- `/Users/jongodeiro/escalando-premoldados/config/pipeline-lp-template.json`

**Criterios de aceite:**
- [ ] Define as 5 fases com nome, descricao, checklist items e campo de status
- [ ] Facilmente extensivel (adicionar fase 6 = adicionar objeto ao array)
- [ ] Inclui mapeamento fase -> agente responsavel (quem executa)

---

## EPIC 2: Quality Gate Engine

**Objetivo:** Modulo que valida se uma fase pode ser iniciada verificando o status da fase anterior.

**Complexidade:** Media
**Estimativa:** 1.5 dias
**Dependencias:** EPIC 1 (precisa da estrutura de tasks para validar)

### Story 2.1: Modulo quality-gate.js

**Descricao:** Modulo reutilizavel que verifica se os pre-requisitos de uma fase estao cumpridos.

**Logica:**
```
qualityGate(cliente, campanha, faseAlvo)
  1. Busca Lista "LP -- {campanha}" no Folder {cliente}
  2. Encontra task da fase anterior (faseAlvo - 1)
  3. Verifica:
     a) Status da task anterior = "Aprovado" (custom field ou status nativo)
     b) Todos os checklist items marcados como done
  4. Retorna { ok: true/false, motivo: string, faltando: [] }
```

**Arquivo a criar:**
- `/Users/jongodeiro/escalando-premoldados/scripts/quality-gate.js`

**Criterios de aceite:**
- [ ] Exporta funcao `verificarGate(cliente, campanha, fase)` retornando `{ ok, motivo, faltando }`
- [ ] Fase 1 sempre retorna `ok: true` (nao tem pre-requisito)
- [ ] Se fase anterior nao existe, retorna erro claro
- [ ] Se checklist items pendentes, lista quais faltam no campo `faltando`
- [ ] Funciona como modulo importavel E como CLI standalone

**Uso standalone:**
```bash
node scripts/quality-gate.js --cliente=Concrenor --campanha="Geral" --fase=4
# Saida: OK - Fase 3 aprovada, pode avancar para Fase 4
# OU:    BLOQUEADO - Fase 3 pendente: [Logo recebido, Fotos tratadas]
```

---

### Story 2.2: Validacao de Config JSON

**Descricao:** Funcao que valida se o config JSON do cliente esta completo (sem campos "A DEFINIR", sem vazios obrigatorios).

**Arquivo a criar:**
- `/Users/jongodeiro/escalando-premoldados/scripts/validar-config-lp.js`

**Criterios de aceite:**
- [ ] Recebe path do JSON ou objeto
- [ ] Lista todos os campos obrigatorios que estao vazios ou com "A DEFINIR"
- [ ] Campos obrigatorios: empresa, headline, subheadline, whatsapp, cor_primaria, cor_secundaria, produtos (min 1)
- [ ] Retorna `{ valido: boolean, erros: string[] }`
- [ ] Funciona como modulo importavel E como CLI

**Uso CLI:**
```bash
node scripts/validar-config-lp.js --config=config/lp-concrenor.json
# Saida: INVALIDO - headline contém "A DEFINIR", depoimentos[0].texto contém "A COLETAR"
```

---

## EPIC 3: Integracao com Dispatcher (Automacao via ClickUp)

**Objetivo:** Conectar o quality gate ao dispatcher existente para que comandos via comentario respeitem as fases.

**Complexidade:** Media-Alta
**Estimativa:** 2 dias
**Dependencias:** EPIC 1 + EPIC 2

### Story 3.1: Gate no Dispatcher antes de gerar-lp

**Descricao:** Quando alguem comenta "@dev gerar LP" numa task do ClickUp, o dispatcher deve verificar o quality gate antes de executar.

**Arquivo a modificar:**
- `/Users/jongodeiro/escalando-premoldados/api/clickup-agent-dispatcher.js`

**Mudancas:**
1. Adicionar mapeamento `agente -> fase` (ex: `gerar-lp` = Fase 4, `deploy-lp` = Fase 5)
2. Antes de chamar `runAgentOnVPS()`, verificar quality gate
3. Se gate bloqueado: postar comentario explicando o que falta e NAO executar
4. Se gate OK: executar normalmente

**Criterios de aceite:**
- [ ] `gerar-lp` so executa se Fase 3 (Identidade Visual) estiver aprovada
- [ ] `deploy-lp` so executa se Fase 4 (Geracao) estiver aprovada
- [ ] `gerar-copy` so executa se Fase 1 (DNA) estiver aprovada
- [ ] Comentario de bloqueio lista exatamente o que falta (ex: "Fase 3 pendente: Logo recebido")
- [ ] Agentes que NAO tem fase mapeada (monitorar-ads, relatorio-ads) continuam funcionando sem gate
- [ ] Flag `--force` ou `--skip-gate` no comentario permite bypass (para emergencias)

---

### Story 3.2: Atualizacao automatica de status apos execucao

**Descricao:** Quando um agente conclui com sucesso, o sistema atualiza automaticamente o status da task correspondente.

**Arquivo a modificar:**
- `/Users/jongodeiro/escalando-premoldados/api/clickup-agent-dispatcher.js`
- `/Users/jongodeiro/escalando-premoldados/scripts/gerar-lp.js`

**Mudancas:**
1. Apos `gerar-lp` concluir com sucesso: task Fase 4 recebe status "Completo" + checklist "LP gerada" marcado
2. Apos `deploy-lp` concluir com sucesso: task Fase 5 recebe status "No ar" + link da LP no comentario
3. Apos `gerar-copy` concluir: task Fase 2 recebe checklist items marcados

**Criterios de aceite:**
- [ ] Status da task atualizado automaticamente via ClickUp API apos execucao bem-sucedida
- [ ] Se execucao falhar, status NAO muda (mantem estado anterior)
- [ ] Comentario de conclusao inclui resumo do que foi feito

---

### Story 3.3: Novo agente "aprovar-fase" no dispatcher

**Descricao:** Adicionar agente que permite aprovar uma fase via comentario no ClickUp.

**Arquivo a modificar:**
- `/Users/jongodeiro/escalando-premoldados/api/clickup-agent-dispatcher.js`

**Novo agente:**
```javascript
'aprovar-fase': {
  desc: 'Marca a fase atual como Aprovada (avanca o pipeline)',
  agent: 'Morgan', handle: '@morgan', role: 'PM',
  keywords: ['aprovar', 'aprovado', 'aprova fase', 'gate ok', 'liberado'],
}
```

**Criterios de aceite:**
- [ ] Comentar "aprovado" ou "fase aprovada" numa task de fase marca como Aprovado
- [ ] Posta comentario confirmando aprovacao e informando proxima fase
- [ ] Se todos os checklist items nao estiverem marcados, avisa mas permite aprovacao (warning, nao bloqueio)

---

## EPIC 4: Melhorias no Gerador de LP

**Objetivo:** Adaptar o gerador existente para funcionar integrado ao pipeline de quality gates.

**Complexidade:** Baixa-Media
**Estimativa:** 1 dia
**Dependencias:** EPIC 2 (precisa do validar-config)

### Story 4.1: Integracao do gerar-lp.js com quality gate

**Descricao:** O script gerar-lp.js deve verificar o quality gate antes de gerar, mesmo quando rodado via CLI direta.

**Arquivo a modificar:**
- `/Users/jongodeiro/escalando-premoldados/scripts/gerar-lp.js`

**Mudancas:**
1. Importar modulo quality-gate.js
2. Antes de gerar, chamar `verificarGate(empresa, campanha, 4)`
3. Se bloqueado, mostrar mensagem e abortar (a menos que --force)
4. Chamar `validarConfig()` para alertar sobre campos incompletos

**Criterios de aceite:**
- [ ] `node scripts/gerar-lp.js --empresa=Concrenor` verifica gate antes de gerar
- [ ] `--force` ignora gate e gera mesmo assim (para debug/emergencia)
- [ ] `--skip-gate` equivalente a --force (alias)
- [ ] Campos "A DEFINIR" geram warning (nao bloqueio, mas lista os problemas)

---

### Story 4.2: Buscar config do ClickUp pela estrutura do pipeline

**Descricao:** Adaptar `fetchConfigFromClickUp` para buscar config na nova estrutura de lista "LP -- {campanha}" em vez de lista "Onboarding".

**Arquivo a modificar:**
- `/Users/jongodeiro/escalando-premoldados/scripts/gerar-lp.js`

**Criterios de aceite:**
- [ ] Busca primeiro na lista "LP -- {campanha}" (nova estrutura)
- [ ] Fallback para lista "Onboarding" (compatibilidade com estrutura antiga)
- [ ] Log claro indicando de onde o config foi encontrado

---

## Ordem de Implementacao e Dependencias

```
Semana 1 (Dias 1-3):
  EPIC 1 (Story 1.1 + 1.2)     [sem dependencia]
     |
     v
  EPIC 2 (Story 2.1 + 2.2)     [depende de EPIC 1 para testar]

Semana 1-2 (Dias 3-5):
  EPIC 4 (Story 4.1 + 4.2)     [depende de EPIC 2]
     |
     v
  EPIC 3 (Story 3.1 + 3.2 + 3.3)  [depende de EPIC 2 + EPIC 4]
```

**Caminho critico:** EPIC 1 -> EPIC 2 -> EPIC 3

**Paralelismo possivel:**
- EPIC 4 (Story 4.2) pode comecar em paralelo com EPIC 2
- Story 3.3 pode ser feita em paralelo com Story 3.1

---

## Mapa de Arquivos

### Arquivos a CRIAR (4 novos)

| Arquivo | Epic/Story | Descricao |
|---|---|---|
| `scripts/criar-pipeline-lp.js` | 1.1 | CLI para criar estrutura de tasks no ClickUp |
| `config/pipeline-lp-template.json` | 1.2 | Template das 5 fases com checklists |
| `scripts/quality-gate.js` | 2.1 | Motor de validacao de quality gates |
| `scripts/validar-config-lp.js` | 2.2 | Validador de config JSON |

### Arquivos a MODIFICAR (3 existentes)

| Arquivo | Epic/Story | Mudanca |
|---|---|---|
| `api/clickup-agent-dispatcher.js` | 3.1, 3.2, 3.3 | Gate check antes de executar + novo agente "aprovar-fase" |
| `scripts/gerar-lp.js` | 4.1, 4.2 | Gate check + validacao + busca na nova estrutura |
| `config/deploy-clients.json` | -- | Sem mudanca, mas usado como referencia |

### Arquivos que NAO mudam

| Arquivo | Motivo |
|---|---|
| `api/clickup-processor.js` | Continua processando taskCreated normalmente |
| `lp/template-lp.html` | Template nao muda, e o config que muda |
| `config/lp-concrenor.json` | Formato nao muda, mas sera validado |
| `scripts/deploy-lp.js` | Sera chamado pelo dispatcher, nao precisa de mudanca interna |

---

## Estimativa de Complexidade por Story

| Story | Complexidade | Estimativa | Risco |
|---|---|---|---|
| 1.1 criar-pipeline-lp.js | Media | 6-8h | Baixo - API ClickUp ja conhecida |
| 1.2 pipeline-lp-template.json | Baixa | 1h | Nenhum |
| 2.1 quality-gate.js | Media | 4-6h | Medio - logica de busca de tasks por fase |
| 2.2 validar-config-lp.js | Baixa | 2h | Nenhum |
| 3.1 Gate no dispatcher | Media-Alta | 4-6h | Medio - integracao com flow existente |
| 3.2 Status automatico | Media | 3-4h | Baixo |
| 3.3 Agente aprovar-fase | Baixa | 2-3h | Nenhum |
| 4.1 gerar-lp + gate | Baixa | 2h | Nenhum |
| 4.2 Busca nova estrutura | Baixa | 2h | Baixo |
| **TOTAL** | | **26-34h** | |

---

## Riscos e Mitigacoes

| Risco | Probabilidade | Impacto | Mitigacao |
|---|---|---|---|
| API ClickUp nao suporta custom fields facilmente | Media | Alto | Usar status nativo da task ("Aprovado", "Em andamento") em vez de custom fields. Testar antes da Story 1.1. |
| Webhook loop ao atualizar status | Alta | Alto | Manter as BOT_SIGNATURES no dispatcher. Adicionar assinatura para atualizacoes de gate. |
| Estrutura antiga de clientes (Onboarding) incompativel | Media | Medio | Manter fallback para estrutura antiga (Story 4.2) |
| Performance das chamadas ClickUp (muitas requests por gate check) | Baixa | Baixo | Cachear resposta de tasks por 60s. Buscar todas as tasks da lista em 1 request. |

---

## Decisoes de Design

### [AUTO-DECISION] Custom fields vs Status nativo do ClickUp

**Decisao:** Usar STATUS NATIVO da task do ClickUp (Pendente, Em andamento, Aprovado, Reprovado, No ar) em vez de custom fields.

**Razao:** Custom fields requerem setup manual no ClickUp por Space e tem API mais complexa. Status nativo ja funciona com o flow existente e e mais simples de consultar via API.

### [AUTO-DECISION] Gate como modulo vs servico

**Decisao:** Implementar como modulo Node.js importavel (nao como API separada).

**Razao:** O gate e chamado tanto pelo CLI (gerar-lp.js) quanto pelo dispatcher (Vercel function). Um modulo importavel atende os dois cenarios sem adicionar infraestrutura.

### [AUTO-DECISION] Aprovacao manual vs automatica

**Decisao:** Fases 1-3 requerem aprovacao MANUAL (comentario "aprovar" no ClickUp). Fases 4-5 tem aprovacao AUTOMATICA apos execucao bem-sucedida do script.

**Razao:** Fases 1-3 envolvem julgamento humano (copy esta bom? design esta bom?). Fases 4-5 sao tecnicas e verificaveis por codigo (LP gerou? HTTP 200?).

---

## Como testar o sistema completo

### Cenario de teste end-to-end

```bash
# 1. Criar pipeline para novo cliente
node scripts/criar-pipeline-lp.js --cliente=TesteGate --campanha=Teste

# 2. Verificar que gate bloqueia Fase 4
node scripts/quality-gate.js --cliente=TesteGate --campanha=Teste --fase=4
# Esperado: BLOQUEADO - Fase 3 nao aprovada

# 3. Aprovar fases 1-3 manualmente no ClickUp (ou via script)

# 4. Verificar que gate libera Fase 4
node scripts/quality-gate.js --cliente=TesteGate --campanha=Teste --fase=4
# Esperado: OK - Fase 3 aprovada

# 5. Gerar LP (deve passar pelo gate)
node scripts/gerar-lp.js --empresa=TesteGate --lp=Teste --config=config/lp-teste.json

# 6. Via ClickUp: comentar "@dev gerar LP" na task Fase 4
# Esperado: dispatcher verifica gate -> executa -> atualiza status
```

---

*Planejado por Morgan (PM) -- escalando-premoldados*
*CLI First: todos os quality gates funcionam 100% via CLI antes de qualquer integracao*
