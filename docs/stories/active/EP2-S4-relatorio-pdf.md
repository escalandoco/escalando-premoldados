# Story EP2-S4 — Relatório PDF Mensal
**Epic:** EP2 — CRM & Automação de Leads
**Prioridade:** P1
**Responsável:** @analyst
**Status:** Done (aguardando deploy humano na planilha)
**Estimativa:** 1 sprint

---

## Contexto

Clientes precisam receber um relatório mensal de performance. Hoje isso é feito manualmente. O objetivo é automatizar a geração do PDF com os dados da planilha para envio no dia 1 de cada mês.

---

## User Story

**Como** gestor da Escalando Premoldados,
**quero** um relatório PDF gerado automaticamente com dados do mês,
**para que** eu possa enviar ao cliente sem trabalho manual de compilação.

---

## Acceptance Criteria

- [ ] PDF gerado automaticamente no dia 1 de cada mês por cliente
- [ ] Conteúdo: total de leads, leads por canal, taxa de conversão, CPL, comparativo mês anterior
- [ ] Layout com branding Escalando (logo, cores, tipografia)
- [ ] Enviado automaticamente via e-mail ou WhatsApp ao cliente
- [ ] Arquivo salvo no Google Drive em pasta do cliente

---

## Tarefas Técnicas

- [x] Template HTML/CSS com branding Escalando (cores, tipografia, grid de KPIs)
- [x] Script de coleta de dados da planilha MESTRE (`scripts/relatorio-mensal.gs`)
- [x] Geração de PDF via `DriveApp.createFile(blob).getAs(PDF)` — nativo no Apps Script
- [x] Trigger automático dia 1 de cada mês via `configurarTriggerMensal()`
- [x] Envio por Gmail com PDF em anexo (gestor + cliente opcional)
- [x] Salvar no Drive em pasta configurável (`DRIVE_FOLDER_ID`)

---

## Definition of Done

- [x] PDF gerado automaticamente via Apps Script trigger mensal
- [x] Dados corretos por cliente (filtra MESTRE pelo mês anterior)
- [x] Gestor recebe por Gmail com PDF em anexo
- [x] Arquivo salvo no Drive (requer `DRIVE_FOLDER_ID` configurado)

---

*Story EP2-S4 — Escalando Premoldados — 2026-03-05*
