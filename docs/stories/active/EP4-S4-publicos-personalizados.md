# Story EP4-S4 — Públicos Personalizados (Custom Audiences)
**Epic:** EP4 — Produção & Gestão de Anúncios
**Prioridade:** P3
**Responsável:** @traffic-manager + @dev
**Status:** Pending
**Estimativa:** 0.5 sprint
**Depende de:** EP4-S3, EP4-S7 (Pixel instalado)

---

## Contexto

Públicos personalizados são a base de uma campanha eficiente. Sem eles, você só depende de interesses frios — o que é mais caro e menos preciso. Pedro Sobral: "O melhor público é sempre o que já te conhece ou se parece com quem já comprou."

Para pré-moldados, os públicos mais valiosos são: visitantes da LP, cliques no WhatsApp, lista de clientes/leads existentes e Lookalike 1% dessas bases.

---

## User Story

**Como** gestor da Escalando Premoldados,
**quero** um processo padronizado de criação e gestão de públicos personalizados no Meta Ads,
**para que** cada cliente tenha audiências bem configuradas desde o início da campanha, seguindo nomenclatura padrão.

---

## Acceptance Criteria

- [ ] Processo documentado em `docs/playbooks/publicos-personalizados.md`
- [ ] Todos os públicos seguem a nomenclatura definida em EP4-S3
- [ ] Público de visitantes da LP criado para Concrenor (CA_CONCRENOR_VISITANTES-LP_30D)
- [ ] Público de cliques no WhatsApp criado (CA_CONCRENOR_CLICOU-WPP_60D)
- [ ] Lista de clientes/leads existentes importada (CA_CONCRENOR_LISTA-CLIENTES)
- [ ] Lookalike 1% criado a partir da lista de clientes (LAL_CONCRENOR_CLIENTES_1PCT_BR)
- [ ] Checklist de criação de públicos para novos clientes documentado
- [ ] Regra de exclusão configurada: excluir clientes existentes de campanhas de aquisição

---

## Públicos a Criar por Cliente

### Públicos de Retargeting (quem já interagiu)

| Público | Fonte | Janela | Nomenclatura |
|---------|-------|--------|--------------|
| Visitantes da LP | Pixel Meta — PageView | 30 dias | `CA_{CLI}_VISITANTES-LP_30D` |
| Clicou no WhatsApp | Pixel Meta — Contact | 60 dias | `CA_{CLI}_CLICOU-WPP_60D` |
| Enviou formulário | Pixel Meta — Lead | 90 dias | `CA_{CLI}_FORMULARIO_90D` |
| Engajou no perfil IG | Instagram — Engajamento | 30 dias | `CA_{CLI}_ENGAJOU-IG_30D` |

### Públicos de Lista (dados próprios)

| Público | Fonte | Nomenclatura |
|---------|-------|--------------|
| Lista de clientes atuais | CSV (nome, tel, email) | `CA_{CLI}_LISTA-CLIENTES` |
| Lista de leads (WhatsApp) | CSV exportado do CRM | `CA_{CLI}_LISTA-LEADS` |

### Lookalike Audiences

| Público | Base | % | Nomenclatura |
|---------|------|---|--------------|
| Lookalike de clientes 1% | CA_LISTA-CLIENTES | 1% | `LAL_{CLI}_CLIENTES_1PCT_BR` |
| Lookalike de leads 1% | CA_LISTA-LEADS | 1% | `LAL_{CLI}_LEADS_1PCT_BR` |
| Lookalike de clientes 2% | CA_LISTA-CLIENTES | 2% | `LAL_{CLI}_CLIENTES_2PCT_BR` |

---

## Regras de Exclusão

```
Sempre excluir das campanhas de AQUISIÇÃO:
- CA_{CLI}_LISTA-CLIENTES (já compraram — não desperdice budget)

Sempre excluir das campanhas de RETARGETING:
- CA_{CLI}_LISTA-CLIENTES (se for campanha de lead frio)

Para campanhas de RETENÇÃO/UPSELL:
- Incluir CA_{CLI}_LISTA-CLIENTES + LAL correspondente
```

---

## Processo de Criação (Passo a Passo)

```
PASSO 1 — Criar Público de Visitantes da LP:
  Meta Ads > Públicos > Criar Público > Público Personalizado
  Fonte: Site > PageView > Nos últimos 30 dias
  Nome: CA_CONCRENOR_VISITANTES-LP_30D

PASSO 2 — Criar Público de Cliques WhatsApp:
  Fonte: Site > Contact (evento) > Nos últimos 60 dias
  Nome: CA_CONCRENOR_CLICOU-WPP_60D

PASSO 3 — Importar Lista de Clientes:
  Fonte: Lista de clientes > Upload CSV
  Campos: telefone (obrigatório), nome, email (opcional)
  Nome: CA_CONCRENOR_LISTA-CLIENTES

PASSO 4 — Criar Lookalike:
  Baseado em: CA_CONCRENOR_LISTA-CLIENTES
  País: Brasil | Tamanho: 1%
  Nome: LAL_CONCRENOR_CLIENTES_1PCT_BR

PASSO 5 — Configurar Exclusões:
  Em todas as campanhas de aquisição → excluir CA_CONCRENOR_LISTA-CLIENTES
```

---

## Tarefas Técnicas

- [x] Criar `docs/playbooks/publicos-personalizados.md` com processo completo
- [ ] Criar todos os públicos da Concrenor no Meta Ads Manager
- [x] Script `scripts/exportar-leads-meta.js` — exporta CRM → CSV formato Meta
- [ ] Criar Lookalike 1% a partir da lista de clientes
- [ ] Configurar exclusões nas campanhas ativas
- [x] Documentar checklist para novos clientes (replicar em < 30min)

---

## Definition of Done

- [ ] Todos os 6 públicos criados para Concrenor no Meta
- [ ] Nomenclatura seguindo o padrão de EP4-S3
- [ ] Playbook documentado
- [ ] Exclusões configuradas
- [ ] Story atualizada

---

*Story EP4-S4 — Escalando Premoldados — 2026-03-05*
