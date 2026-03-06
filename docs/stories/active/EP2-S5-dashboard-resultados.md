# Story EP2-S5 — Dashboard de Resultados
**Epic:** EP2 — CRM & Automação de Leads
**Prioridade:** P1
**Responsável:** @dev
**Status:** Done (aguardando deploy em app.escalando.co)
**Estimativa:** 1 sprint

---

## Contexto

Além do relatório PDF mensal, o gestor precisa de uma visão em tempo real dos resultados por cliente. Um dashboard web simples baseado nos dados da planilha Google Sheets.

---

## User Story

**Como** gestor da Escalando Premoldados,
**quero** um dashboard web com métricas em tempo real por cliente,
**para que** eu possa tomar decisões rápidas sem precisar abrir a planilha.

---

## Acceptance Criteria

- [ ] Dashboard acessível via URL (app.escalando.co/dashboard ou similar)
- [ ] Autenticação simples (senha ou Google OAuth)
- [ ] Métricas por cliente: leads do mês, CPL, taxa de conversão, leads por canal
- [ ] Visão geral: todos os clientes em uma tela
- [ ] Atualização automática a cada 24h (ou sob demanda)
- [ ] Responsivo (funciona em celular)

---

## Tarefas Técnicas

- [x] Fonte: Google Sheets gviz/tq API pública (sem credenciais)
- [x] Página HTML/JS com KPIs, tabela por cliente, barras por canal (`docs/dashboard.html`)
- [x] Autenticação por senha (sessionStorage — suficiente para uso interno)
- [ ] Deploy em app.escalando.co — tarefa humana (FTP via Python)
- [x] Atualização sob demanda (botão ↻) + ao trocar filtros

---

## Definition of Done

- [x] Dashboard funcional com login, filtros de mês/cliente, KPIs e canais
- [x] Todos os clientes da aba MESTRE visíveis automaticamente
- [x] Dados puxados direto do Sheets — sempre sincronizados

---

*Story EP2-S5 — Escalando Premoldados — 2026-03-05*
