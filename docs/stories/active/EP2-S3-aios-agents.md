# Story EP2-S3 — AIOS Agents da Agência
**Epic:** Epic 2 — Sistema de Leads
**Prioridade:** P1
**Responsável:** @architect + @dev
**Status:** Pending
**Estimativa:** 2 sprints
**Depende de:** EP2-S1 (planilha) + EP2-S2 (templates de relatório)

---

## Contexto

O diferencial operacional da Escalando Premoldados é rodar com uma equipe pequena atendendo 15-20 clientes. Isso só é possível se o AIOS executa as tarefas repetitivas. Este story define e implementa os agents internos da agência.

---

## User Story

**Como** fundador da Escalando Premoldados,
**quero** que o AIOS execute automaticamente as tarefas repetitivas de operação,
**para que** eu possa focar no estratégico enquanto o sistema cuida da execução.

---

## Acceptance Criteria

### Agent 1 — Gerador de Relatório Mensal

- [ ] Trigger: dia 28 de cada mês (ou manual)
- [ ] Input: planilha de leads do cliente (dados do mês)
- [ ] Output: rascunho do relatório mensal preenchido com dados reais
- [ ] Ação: notifica o gestor via WhatsApp com link para revisão
- [ ] Tempo estimado salvo: 25–30 min/cliente/mês

### Agent 2 — Gerador de Briefing de Criativos

- [ ] Trigger: toda segunda-feira (semanal)
- [ ] Input: lista de clientes ativos + plano contratado + fotos recebidas na semana
- [ ] Output: briefing formatado para designer (tamanho, texto, CTA, referência de foto)
- [ ] Ação: envia briefing por WhatsApp/email ao designer
- [ ] Tempo estimado salvo: 15 min/cliente/semana

### Agent 3 — Gerador de Pauta de Reunião

- [ ] Trigger: 24h antes de cada reunião agendada
- [ ] Input: histórico de leads do mês + plano do cliente + data da última reunião
- [ ] Output: pauta estruturada (resultados, análise, próximos passos, perguntas)
- [ ] Ação: envia pauta no grupo WhatsApp do cliente
- [ ] Tempo estimado salvo: 10 min/reunião

### Agent 4 — Monitor de Verba (Pro)

- [ ] Trigger: diário (8h)
- [ ] Input: saldo das contas Meta Ads e Google Ads via API
- [ ] Output: alerta se verba < 20% do limite semanal ou próxima de zerar
- [ ] Ação: notificação WhatsApp ao cliente E ao gestor

### Agent 5 — Registro de Lead

- [ ] Trigger: envio do formulário da LP
- [ ] Input: dados do formulário
- [ ] Output: linha nova na planilha + mensagem de notificação
- [ ] Ação: envia WhatsApp ao gestor com dados do lead

### Arquitetura

- [ ] Agents implementados como scripts AIOS em squads/escalando-premoldados/
- [ ] Configuração por cliente em config/clients/{slug}.yaml
- [ ] Logs em logs/agents/{agent-name}/
- [ ] Documentação de cada agent em docs/agents/

---

## Tarefas Técnicas

- [ ] Definir arquitetura de agents (scripts Node.js ou Python)
- [ ] Implementar Agent 1 (Relatório Mensal)
- [ ] Implementar Agent 2 (Briefing Criativos)
- [ ] Implementar Agent 3 (Pauta Reunião)
- [ ] Implementar Agent 4 (Monitor Verba)
- [ ] Implementar Agent 5 (Registro Lead)
- [ ] Criar estrutura de config por cliente
- [ ] Testar cada agent com dados reais ou simulados
- [ ] Documentar como adicionar novo cliente aos agents

---

## Definition of Done

- [ ] 5 agents implementados e testados
- [ ] Agent 5 (Registro Lead) funcionando em produção com LP real
- [ ] Documentação de cada agent disponível
- [ ] Tempo salvo total estimado documentado (meta: > 2h/cliente/mês)

---

*Story EP2-S3 — Escalando Premoldados — 2026-03-04*
