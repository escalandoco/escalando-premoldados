# Story EP3-S9 — A/B Testing de LPs
**Epic:** EP3 — Sistema de Landing Pages
**Prioridade:** P3
**Responsável:** @ux-design-expert + @dev
**Status:** Pending
**Estimativa:** 1 sprint
**Depende de:** EP3-S8 (UTM configurado)

---

## Contexto

Com UTMs e rastreamento no lugar, podemos testar variações da LP para descobrir qual headline, CTA ou layout converte mais. O campo `headline_ab` já existe no config JSON — basta ativar a lógica de split no template.

---

## User Story

**Como** gestor da Escalando Premoldados,
**quero** testar variações de elementos da LP (headline, CTA, layout) automaticamente,
**para que** eu possa identificar qual versão gera mais leads sem depender de achismo.

---

## Acceptance Criteria

- [ ] Parâmetro `?v=a` ou `?v=b` na URL ativa versão alternativa da LP
- [ ] `headline_ab` do config usado na versão B
- [ ] Registro da versão no evento do Pixel Meta (custom parameter)
- [ ] Relatório simples: taxa de conversão por versão A vs B
- [ ] Pelo menos 1 teste A/B rodando na LP da Concrenor

---

## Tarefas Técnicas

- [ ] Adicionar lógica de variação no `template-lp.html` via query param
- [ ] Implementar custom parameter no Pixel para rastrear versão
- [ ] Criar script de relatório A/B a partir dos dados do Meta Ads
- [ ] Documentar processo de criação de teste A/B

---

## Definition of Done

- [ ] Versão A e B funcionando na LP da Concrenor
- [ ] Conversões por versão rastreadas no Meta Events Manager
- [ ] Story atualizada

---

*Story EP3-S9 — Escalando Premoldados — 2026-03-05*
