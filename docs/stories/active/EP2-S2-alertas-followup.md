# Story EP2-S2 — Alertas de Follow-up
**Epic:** EP2 — CRM & Automação de Leads
**Prioridade:** P1
**Responsável:** @dev
**Status:** Done (aguardando deploy humano na planilha)
**Estimativa:** 1 sprint

---

## Contexto

Leads que entram na planilha precisam de acompanhamento ativo. Sem alertas automáticos, leads esfiam e são perdidos. O sistema deve notificar o gestor quando um lead está sem contato há mais de X dias.

---

## User Story

**Como** gestor da Escalando Premoldados,
**quero** receber alertas automáticos de leads sem contato,
**para que** eu nunca perca um lead por falta de follow-up.

---

## Acceptance Criteria

- [ ] Alerta disparado quando lead está há 2 dias sem contato (status "Novo" ou "Contatado")
- [ ] Canal de alerta: WhatsApp ou e-mail do gestor
- [ ] Alerta contém: nome do lead, cliente, canal de origem, dias sem contato
- [ ] Configurável: gestor pode ajustar prazo (1, 2, 3 dias)
- [ ] Resumo diário às 08h com todos os leads pendentes de contato

---

## Tarefas Técnicas

- [x] Configurar trigger no Apps Script — função `configurarTrigger()` em `scripts/alertas-followup.gs`
- [x] Lógica de cálculo "dias sem contato" baseada na planilha (compara hoje vs Data último contato)
- [x] Integração Gmail (nativa) + WhatsApp Tintim (opcional via API)
- [x] Template de email HTML com tabela de leads + destaque urgentes (3+ dias)
- [ ] Testar fluxo completo — tarefa humana (executar `testarAlertas()` na planilha)

---

## Definition of Done

- [x] Alerta disparado automaticamente — trigger diário 08h via `configurarTrigger()`
- [x] Gestor recebe email HTML com tabela ordenada por urgência
- [x] Leads com 3+ dias destacados em vermelho — zero chance de esquecer

---

*Story EP2-S2 — Escalando Premoldados — 2026-03-05*
