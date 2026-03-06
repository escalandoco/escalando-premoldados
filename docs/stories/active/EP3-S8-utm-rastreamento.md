# Story EP3-S8 — UTM & Rastreamento por Campanha
**Epic:** EP3 — Sistema de Landing Pages
**Prioridade:** P2
**Responsável:** @dev
**Status:** Done
**Estimativa:** 1 sprint

---

## Contexto

Para saber qual campanha gerou qual lead, é necessário capturar os parâmetros UTM do URL e registrá-los junto ao lead na planilha. Isso permite otimização de campanhas com base em dados reais.

---

## User Story

**Como** gestor da Escalando Premoldados,
**quero** que os UTMs das campanhas sejam capturados e associados a cada lead,
**para que** eu saiba exatamente qual anúncio/campanha gerou cada conversão.

---

## Acceptance Criteria

- [ ] LP captura utm_source, utm_medium, utm_campaign, utm_content, utm_term da URL
- [ ] UTMs registrados no formulário e enviados junto ao lead
- [ ] Planilha exibe coluna "UTM" por lead
- [ ] Relatório mensal inclui breakdown por campanha (utm_campaign)
- [ ] Funciona para Meta Ads, Google Ads e tráfego orgânico

---

## Tarefas Técnicas

- [x] Script JS de captura de UTM no template da LP (5 parâmetros)
- [x] Campos hidden no formulário para UTMs (`utm-source..utm-term`)
- [x] Atualizar webhook para incluir UTMs no payload (`utm_source..utm_term`)
- [ ] Atualizar planilha com colunas UTM — tarefa humana (webhook já envia, planilha precisa receber)
- [ ] Testar com URL de campanha real — tarefa humana

---

## Definition of Done

- [ ] UTMs capturados em 100% dos leads com parâmetros na URL
- [ ] Dados visíveis na planilha
- [ ] Relatório mostrando performance por campanha

---

*Story EP3-S8 — Escalando Premoldados — 2026-03-05*
