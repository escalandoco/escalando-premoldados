# Story EP2-S3 — Tintim Multi-Cliente
**Epic:** EP2 — CRM & Automação de Leads
**Prioridade:** P1
**Responsável:** @dev
**Status:** Done (aguardando número WPP da {cliente} para mapear)
**Estimativa:** 1 sprint

---

## Contexto

A integração atual do Tintim está configurada para o {cliente}. Com a expansão multi-cliente, cada cliente precisa ter seus leads do WhatsApp rastreados separadamente na planilha mestre.

---

## User Story

**Como** gestor da Escalando Premoldados,
**quero** que leads de diferentes clientes via WhatsApp (Tintim) sejam registrados separadamente,
**para que** eu possa atribuir e analisar performance por cliente.

---

## Acceptance Criteria

- [ ] Webhook Tintim configurado para identificar cliente de origem
- [ ] Lead do Tintim cai na aba correta da planilha (por cliente)
- [ ] Coluna "Canal" preenchida automaticamente como "WhatsApp/Tintim"
- [ ] Suporte a múltiplos números de WhatsApp (um por cliente)
- [ ] Configuração documentada em docs/playbooks/ para adicionar novo cliente

---

## Tarefas Técnicas

- [x] Revisar configuração atual do webhook Tintim
- [x] Criar estrutura multi-tenant: `api/tintim.js` com `CLIENTES_MAP` por número WPP
- [x] Apps Script `webhook-leads.gs` já roteia por `CLIENTES_MAP` (slug → aba)
- [ ] Testar com 2 clientes — tarefa humana (requer números WPP reais)
- [x] Documentar adição de novo cliente (`docs/playbooks/tintim-multicliente.md`)

---

## Definition of Done

- [x] Arquitetura multi-cliente implementada (número WPP → cliente → aba)
- [x] Canal identificado como "WhatsApp Orgânico" automaticamente
- [x] Documentação de configuração atualizada

---

*Story EP2-S3 — Escalando Premoldados — 2026-03-05*
