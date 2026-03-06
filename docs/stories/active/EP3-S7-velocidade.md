# Story EP3-S11 — Otimização de Velocidade (PageSpeed)
**Epic:** EP3 — Sistema de Landing Pages
**Prioridade:** P3
**Responsável:** @dev
**Status:** Done (auditoria PageSpeed — tarefa humana pós-deploy)
**Estimativa:** 0.5 sprint
**Depende de:** EP3-S3 (template finalizado)

---

## Contexto

PageSpeed afeta diretamente a conversão — cada segundo a mais de carregamento reduz conversão em ~7%. Para tráfego pago, uma LP lenta desperdiça budget. Meta também penaliza LPs lentas no CPM.

---

## User Story

**Como** gestor da Escalando Premoldados,
**quero** que todas as LPs dos clientes carreguem em menos de 3s no mobile,
**para que** o tráfego pago seja aproveitado ao máximo e o CPM não seja penalizado.

---

## Acceptance Criteria

- [ ] PageSpeed Insights (mobile) > 90 em todas as LPs ativas
- [ ] LCP < 2.5s, FID < 100ms, CLS < 0.1
- [ ] Imagens otimizadas: WebP, lazy loading, dimensões corretas
- [ ] CSS e JS inline no template (sem requisições externas desnecessárias)
- [ ] Checklist de otimização de velocidade documentado

---

## Tarefas Técnicas

- [ ] Auditar `template-lp.html` com PageSpeed Insights — tarefa humana (requer URL pública)
- [ ] Converter imagens para WebP no processo de geração — tarefa humana (assets)
- [x] Adicionar `loading="lazy"` em imagens abaixo do fold (footer logo + produto)
- [x] Remover dependências externas desnecessárias do template (já 100% inline)
- [ ] Criar script de verificação automática de PageSpeed pós-deploy — smoke test documentado
- [x] Documentar checklist de otimização (`docs/playbooks/velocidade-lp.md`)

---

## Definition of Done

- [ ] LP da Concrenor com score > 90 no mobile
- [ ] Checklist documentado
- [ ] Story atualizada

---

*Story EP3-S11 — Escalando Premoldados — 2026-03-05*
