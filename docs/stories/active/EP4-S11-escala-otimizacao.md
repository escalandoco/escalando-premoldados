# Story EP4-S8 — Escala e Otimização
**Epic:** EP4 — Produção & Gestão de Anúncios
**Prioridade:** P3
**Responsável:** @traffic-manager
**Status:** Done
**Estimativa:** 0.5 sprint
**Depende de:** EP4-S7 (pelo menos 30 dias de dados)

---

## Contexto

Pedro Sobral: escalar é dosar orçamento nos vencedores e encontrar novos públicos. Não é só aumentar budget — é expandir com inteligência. Regra: nunca escale mais de 20-30% do orçamento por vez para não sair da fase de aprendizado.

Após 30 dias de Discovery, temos dados para escalar o que funciona.

---

## User Story

**Como** gestor da Escalando Premoldados,
**quero** um processo claro de escala de campanhas vencedoras,
**para que** eu possa aumentar o volume de leads mantendo o CPL saudável.

---

## Acceptance Criteria

- [ ] Processo de escala documentado (regras do Pedro Sobral)
- [ ] Identificação de criativos vencedores após 30 dias
- [ ] Expansão de público: novos Lookalikes + Google Ads Search
- [ ] Regras de CPL máximo por produto definidas (ex: para mourão, CPL máximo R$ 80)
- [ ] Processo de teste contínuo: sempre 1-2 novos criativos em teste
- [ ] Relatório de ROI: custo de anúncios vs faturamento gerado pelos leads

---

## Regras de Escala (Pedro Sobral)

```
QUANDO ESCALAR:
✅ CPL < meta por pelo menos 7 dias consecutivos
✅ Campanha saiu da fase de aprendizado (50+ eventos/semana)
✅ ROAS > 3x (para clientes com info de venda)

COMO ESCALAR:
→ Aumentar orçamento máximo 30% por vez
→ Aguardar 7 dias antes de novo aumento
→ Duplicar conjunto vencedor com novo público (Lookalike 2-3%)
→ Não mexer em criativos vencedores — criar novos em paralelo

QUANDO PAUSAR:
❌ CPL > 2x da meta por 3 dias
❌ CTR caindo > 30% sem mudança no orçamento (fadiga de criativo)
❌ CPA aumentando consistentemente

CICLO DE TESTE CONTÍNUO:
→ Semanas 1-2: Discovery (testar 3 hooks)
→ Semanas 3-4: Identificar vencedor, pausar perdedores
→ Mês 2: Escalar vencedor + testar 2 novos criativos
→ Mês 3: Expandir público + Google Ads em paralelo
```

---

## Metas de CPL por Produto (Concrenor)

| Produto | Ticket médio | CPL máximo | Meta CPL |
|---------|-------------|------------|----------|
| Mourão Torneado | R$ 3.000 | R$ 100 | R$ 40-60 |
| Bloco de Concreto | R$ 2.000 | R$ 80 | R$ 30-50 |
| Projeto grande (fazenda) | R$ 15.000 | R$ 300 | R$ 100-150 |

---

## Google Ads — Expansão Futura

Após 60 dias de Meta com ROAS positivo:
- Search: keywords "mourão de concreto + cidade", "comprar mourão torneado"
- Display: retargeting visitantes da LP
- Orçamento inicial: R$ 20-30/dia + manter Meta

---

## Tarefas Técnicas

- [x] Criar `docs/playbooks/escala-meta-ads.md` com regras e metas
- [x] Definir CPL máximo e meta para cada produto do cliente (tabela Concrenor)
- [x] Implementar alerta automático: `scripts/monitorar-ads.js` + GitHub Actions diário
- [x] Documentar processo de expansão para Google Ads (seção no playbook)

---

## Definition of Done

- [x] Playbook de escala documentado (`docs/playbooks/escala-meta-ads.md`)
- [x] Metas de CPL definidas por produto (Concrenor: R$40-60 meta, R$100 máximo)
- [x] Processo de teste contínuo descrito (ciclo mensal no playbook)
- [x] Story atualizada

---

*Story EP4-S8 — Escalando Premoldados — 2026-03-05*
