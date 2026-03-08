# Story EP4-S6 — Go-Live e Monitoramento Inicial
**Epic:** EP4 — Produção & Gestão de Anúncios
**Prioridade:** P3
**Responsável:** @traffic-manager
**Status:** In Progress (aguardando campanha publicar)
**Estimativa:** 0.5 sprint
**Depende de:** EP4-S4, EP4-S5

---

## Contexto

Pedro Sobral: as primeiras 72h de campanha são críticas. O algoritmo está em fase de aprendizado — qualquer mudança nesse período prejudica a otimização. Monitorar sem interferir, só pausar se CPL estiver absurdamente alto (>3x do esperado).

Regra de ouro: não pause anúncio em menos de 48h e menos de R$ 50 gastos.

---

## User Story

**Como** gestor da Escalando Premoldados,
**quero** um processo claro de go-live e monitoramento das primeiras 72h,
**para que** a campanha entre no ar corretamente e eu saiba quando e como intervir.

---

## Acceptance Criteria

- [ ] Checklist de go-live completo (20+ itens) documentado
- [ ] Processo de monitoramento diário das primeiras 72h definido
- [ ] Regras de intervenção documentadas (quando pausar, quando aumentar orçamento)
- [ ] Alertas configurados no Meta Ads (custo por resultado > limite)
- [ ] Log de acompanhamento: planilha ou template ClickUp para registrar métricas diárias
- [ ] Primeira campanha da {cliente} publicada após checklist

---

## Checklist de Go-Live (executar na ordem)

```
PRÉ-PUBLICAÇÃO:
[ ] Pixel disparando corretamente (Pixel Helper)
[ ] Evento Contact funcionando (click WhatsApp)
[ ] LP carregando em < 3s no mobile
[ ] Botão WhatsApp abrindo no número correto
[ ] UTMs no link do WhatsApp
[ ] Criativos aprovados pelo Meta (sem violação de política)
[ ] Orçamento configurado (Discovery: R$ 30-50/dia)
[ ] Datas de início corretas (sem limite de fim na Discovery)
[ ] Público configurado (localização, idade, interesses)
[ ] Pixel associado à conta de anúncios

PUBLICAÇÃO:
[ ] Publicar com status "Ativo"
[ ] Confirmar que todos os conjuntos estão ativos
[ ] Confirmar que todos os anúncios estão ativos
[ ] Screenshot do Gerenciador (registro)

PÓS-PUBLICAÇÃO (24h depois):
[ ] Verificar alcance (campanha deve ter > 0 impressões)
[ ] Verificar se eventos estão sendo registrados
[ ] Verificar CPM inicial
[ ] Alertas de custo configurados no Meta
```

---

## Regras de Intervenção

| Situação | Ação | Quando |
|----------|------|--------|
| CPL > 3x da meta | Pausar conjunto (não o anúncio) | Após R$ 100 gastos |
| 0 impressões após 24h | Verificar aprovação e público | 24h após publicar |
| CTR < 0.5% | Revisar criativo (hook fraco) | Após 500 impressões |
| CTR > 3% | Aumentar orçamento 20% | Após 7 dias |
| 1 conjunto claramente melhor | Pausar os piores, aumentar o vencedor | Após 14 dias |

---

## Tarefas Técnicas

- [x] Criar `docs/playbooks/go-live-meta-ads.md` com checklist e regras
- [x] Criar template de log diário (`config/log-ads-{cliente}.json`)
- [ ] Configurar alertas no Meta Ads Manager — tarefa humana (ver playbook)
- [ ] Publicar primeira campanha {cliente} — tarefa humana (aguardando criativos)

---

## Definition of Done

- [x] Checklist documentado (20+ itens em 3 fases)
- [x] Regras de intervenção escritas e revisadas
- [x] Template de log criado (`config/log-ads-{cliente}.json`)
- [ ] Campanha {cliente} no ar — aguardando criativos aprovados
- [x] Story atualizada

---

*Story EP4-S6 — Escalando Premoldados — 2026-03-05*
