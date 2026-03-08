# Story EP4-S7 — Relatório de Performance de Anúncios
**Epic:** EP4 — Produção & Gestão de Anúncios
**Prioridade:** P3
**Responsável:** @dev + @traffic-manager
**Status:** Done
**Estimativa:** 1 sprint
**Depende de:** EP4-S6

---

## Contexto

Pedro Sobral: relatório não é para impressionar cliente — é para tomar decisão. KPIs que importam para pré-moldados: CPL (custo por lead), CTR, CPM, quantidade de leads e, quando possível, CPV (custo por venda/fechamento).

O relatório deve ser gerado quinzenalmente e enviado ao cliente com interpretação, não só números.

---

## User Story

**Como** gestor da Escalando Premoldados,
**quero** um relatório quinzenal automático de performance de anúncios,
**para que** eu possa apresentar resultados ao cliente e tomar decisões de otimização baseadas em dados.

---

## Acceptance Criteria

- [ ] Script `scripts/relatorio-ads.js` ou integração com Agent 03 (Traffic Reporter)
- [ ] Métricas coletadas: Investimento, Alcance, Impressões, Cliques, CTR, CPM, Leads, CPL
- [ ] Relatório em PDF ou HTML com gráficos simples (evolução semanal)
- [ ] Interpretação automática: "CTR abaixo de 1% indica hook fraco — recomendamos testar variação V3"
- [ ] Comparativo com período anterior (quinzena passada)
- [ ] Enviado automaticamente para ClickUp (task em Sucesso do Cliente) + WhatsApp do cliente
- [ ] Tom: direto, sem jargão, focado em resultado para o cliente

---

## Estrutura do Relatório

```
RELATÓRIO DE ANÚNCIOS — CONCRENOR
Período: 01/03 a 15/03/2026

RESUMO EXECUTIVO:
💰 Investimento: R$ 750
📊 Leads gerados: 23
💡 Custo por lead: R$ 32,60
📱 WhatsApp cliques: 31

DETALHE POR CRIATIVO:
┌──────────────────┬──────┬──────┬──────┬──────┐
│ Criativo         │ Inv. │ Impr │ CTR  │ Leads│
├──────────────────┼──────┼──────┼──────┼──────┤
│ V1 - Hook R$8k   │ R$280│ 8.2k │ 2.1% │  12  │ ← MELHOR
│ V2 - Hook 50anos │ R$250│ 9.1k │ 1.3% │   7  │
│ V3 - Geração     │ R$220│ 7.8k │ 0.9% │   4  │ ← PAUSAR
└──────────────────┴──────┴──────┴──────┴──────┘

INTERPRETAÇÃO:
✅ V1 (Hook R$8k) está performando 3x melhor. Recomendamos:
   → Aumentar orçamento do V1 em 50%
   → Pausar V3 (CTR < 1% + CPL alto)
   → Criar V4 baseado no mesmo hook do V1

PRÓXIMOS 15 DIAS:
→ Testar variação de público: fazendeiros + Google Ads Search
→ Produzir depoimento em vídeo do Antônio Mendes (oportunidade)
```

---

## Tarefas Técnicas

- [x] Criar `scripts/relatorio-ads.js` integrado com Meta Marketing API (fallback: log manual)
- [x] Criar template HTML do relatório com KPIs, tabela por anúncio, interpretação automática
- [x] Adicionar geração automática ao GitHub Actions (dias 1 e 16 de cada mês)
- [ ] Integrar com Agent 03 (Traffic Reporter) — pendente para EP4-S11
- [ ] Criar tarefa automática no ClickUp após geração — tarefa humana

---

## Definition of Done

- [x] Script de relatório funcionando: `npm run relatorio-ads -- --cliente={cliente}`
- [x] Template HTML criado (KPIs com cores, tabela, interpretação automática)
- [ ] Primeiro relatório gerado para {cliente} — aguardando campanha no ar
- [x] Story atualizada

---

*Story EP4-S7 — Escalando Premoldados — 2026-03-05*
