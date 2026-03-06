# Story EP3-S4 — Gerador de LP (Staging)
**Epic:** EP3 — Sistema de Landing Pages
**Prioridade:** P2
**Responsável:** @dev
**Status:** Done
**Estimativa:** 1 sprint

---

## Contexto

Script que gera a LP final a partir do template base + dados de configuração do cliente, fazendo deploy em ambiente de staging para revisão antes do go-live.

---

## User Story

**Como** desenvolvedor da Escalando,
**quero** um script que gere a LP automaticamente a partir das configs do cliente,
**para que** eu não precise editar HTML manualmente para cada cliente.

---

## Acceptance Criteria

- [x] Script `scripts/gerar-lp.js` aceita arquivo de config do cliente
- [x] Gera HTML final em `dist/{cliente}/{produto}/index.html`
- [x] Deploy automático em staging (Vercel ou FTP)
- [x] URL de preview gerada e compartilhável com cliente
- [x] Processo documentado

---

## Definition of Done

- [x] Script funcionando para pelo menos 1 cliente real
- [x] LP acessível em URL de staging
- [x] Processo documentado no playbook

---

*Story EP3-S4 — Escalando Premoldados — 2026-03-05*
