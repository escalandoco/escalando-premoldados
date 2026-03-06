# Story EP3-S10 — Heatmap e Gravação de Sessão
**Epic:** EP3 — Sistema de Landing Pages
**Prioridade:** P3
**Responsável:** @ux-design-expert + @analyst
**Status:** Pending
**Estimativa:** 0.5 sprint
**Depende de:** EP3-S4 (LP no ar)

---

## Contexto

Heatmap mostra onde os visitantes clicam, onde param de scrollar e o que ignoram. Com isso identificamos problemas de UX antes de qualquer teste — CTA invisível, seção ignorada, botão confuso.

Ferramenta recomendada: Microsoft Clarity (gratuito, sem limite de sessões).

---

## User Story

**Como** gestor da Escalando Premoldados,
**quero** ver o comportamento real dos visitantes nas LPs dos clientes,
**para que** eu possa melhorar elementos que não estão convertendo.

---

## Acceptance Criteria

- [ ] Microsoft Clarity instalado em todas as LPs ativas
- [ ] Script do Clarity adicionado ao config do cliente (campo `clarity_id`)
- [ ] Gravações de sessão visíveis no painel Clarity
- [ ] Relatório quinzenal: scroll depth, top clicks, rage clicks
- [ ] Pelo menos 1 insight de UX identificado e implementado na LP da Concrenor

---

## Tarefas Técnicas

- [ ] Adicionar campo `clarity_id` ao config JSON e aos defaults
- [ ] Adicionar script Clarity ao `template-lp.html` (condicional, só se `clarity_id` estiver preenchido)
- [ ] Criar conta Clarity e conectar à LP da Concrenor
- [ ] Documentar como interpretar heatmaps para pré-moldados

---

## Definition of Done

- [ ] Clarity funcionando na LP da Concrenor
- [ ] Pelo menos 50 sessões gravadas
- [ ] Story atualizada

---

*Story EP3-S10 — Escalando Premoldados — 2026-03-05*
