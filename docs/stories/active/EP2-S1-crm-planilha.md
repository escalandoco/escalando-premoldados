# Story EP2-S1 — Planilha Mestre de Leads
**Epic:** EP2 — CRM & Automação de Leads
**Prioridade:** P1
**Responsável:** @data-engineer
**Status:** Done (aguardando deploy humano da planilha)
**Estimativa:** 1 sprint

---

## Contexto

Antes de adotar um CRM pago, a Escalando Premoldados precisa de uma planilha Google Sheets estruturada que funcione como CRM fase 1. Deve ser simples para o cliente visualizar, rica para o gestor analisar, e integrada com o Tintim para rastreio de leads via WhatsApp.

---

## User Story

**Como** gestor da Escalando Premoldados,
**quero** uma planilha mestre de leads por cliente,
**para que** eu possa registrar, qualificar e acompanhar cada lead com dados suficientes para gerar relatório e tomar decisões de otimização.

---

## Acceptance Criteria

### Estrutura da planilha

- [ ] **Aba Mestre** — consolidado de todos os clientes com filtros:
  - Colunas: Data, Cliente, Canal (Meta/Google/GMB/Indicação), Nome Lead, Telefone, Cidade, Produto de interesse, Status, Observação, Responsável pelo atendimento
  - Status possíveis: Novo, Contatado, Em negociação, Fechado, Perdido, Sem qualidade
  - Filtros por cliente, canal, status, período

- [ ] **Aba por Cliente** (uma aba para cada cliente ativo):
  - Mesmas colunas da Mestre
  - Fórmulas automáticas: total de leads, leads por canal, taxa de fechamento, CPL (custo por lead)
  - Gráfico simples: leads por semana (linha do tempo)

- [ ] **Aba Dashboard** (visão executiva):
  - Total de leads no mês por cliente
  - Custo por lead por cliente e canal
  - Taxa de conversão por cliente
  - Comparativo mês anterior vs. atual

### Integrações

- [ ] Webhook do formulário da LP → linha nova na planilha automaticamente (Zapier/Make/Apps Script)
- [ ] Tintim → identificação de leads que vieram via WhatsApp
- [ ] Permissões: cliente tem acesso somente leitura à sua aba

### Qualidade dos dados

- [ ] Validação de campos (telefone com DDD, status via dropdown)
- [ ] Formatação condicional: Novo = azul, Fechado = verde, Perdido = vermelho
- [ ] Coluna de "dias sem contato" calculada automaticamente

---

## Tarefas Técnicas

- [x] Criar estrutura da planilha no Google Sheets (`scripts/setup-crm.gs`)
- [x] Configurar validações e formatações condicionais (dropdown + cores por status)
- [x] Configurar Apps Script para receber leads do formulário LP (`scripts/webhook-leads.gs`)
- [ ] Integrar com Tintim — ver EP2-S3
- [x] Criar template de aba por cliente (duplicável via `adicionarCliente()`)
- [ ] Testar fluxo completo — tarefa humana (requer planilha no ar)
- [x] Documentar como adicionar novo cliente (`docs/playbooks/crm-planilha.md`)

---

## Definition of Done

- [ ] Planilha criada e compartilhada — tarefa humana (rodar `setupCRM()` no Sheets)
- [ ] Webhook do formulário funcionando — tarefa humana (implantar Web App + testar)
- [x] Aba de template de cliente funcionando (`adicionarCliente()` no script)
- [x] Dashboard com fórmulas corretas (MESTRE + por canal + por status)
- [x] Documentação de uso disponível (`docs/playbooks/crm-planilha.md`)

---

*Story EP2-S1 — Escalando Premoldados — 2026-03-04*
