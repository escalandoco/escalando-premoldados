# Story EP4-S2 — Copy dos Anúncios (7 Pilares)
**Epic:** EP4 — Produção & Gestão de Anúncios
**Prioridade:** P3
**Responsável:** @traffic-manager
**Status:** Pending
**Estimativa:** 1 sprint
**Depende de:** EP4-S1

---

## Contexto

Com o briefing em mãos, geramos copy para anúncios seguindo os 7 pilares de Pedro Sobral via Claude API (mesmo padrão do `gerar-copy.js`). Cada variação de anúncio deve ter pelo menos 3 hooks diferentes para teste.

Pedro Sobral: "O hook é responsável por 80% do resultado. Se o gancho não parar o scroll, nada mais importa."

---

## User Story

**Como** gestor da Escalando Premoldados,
**quero** um script CLI que gere copy de anúncios estruturado (7 pilares) a partir do briefing,
**para que** eu tenha textos prontos para Meta Ads sem depender de agência ou freelancer.

---

## Acceptance Criteria

- [ ] Script `scripts/gerar-copy-ads.js` criado
- [ ] Usa Claude Opus 4.6 com adaptive thinking
- [ ] Gera pelo menos 3 variações de Hook para cada anúncio
- [ ] Estrutura gerada: hook, narrativa, dor/desejo, contra-intuitivo, CTA, copy curto (feed), copy longo (stories/reels)
- [ ] Output salvo em `config/ads-copy-{cliente}.json`
- [ ] Versão para Meta Ads (feed + stories) e Google Ads (search: headline + description)

---

## Estrutura de Output

```json
{
  "cliente": "{cliente}",
  "produto": "Mourão Torneado",
  "variacoes": [
    {
      "id": "v1",
      "hook": "Cansou de gastar R$ 8.000 por ano com mourão que apodrece?",
      "narrativa": "Antônio Mendes tinha o mesmo problema. Todo ano, cerca caindo, gado escapando, dinheiro indo embora em madeira podre.",
      "dor_desejo": "Uma cerca que dura uma geração. Sem manutenção, sem reposição, sem dor de cabeça.",
      "contra_intuitivo": "O mourão de concreto parece mais caro na compra — mas divide pelo tempo de vida: sai a R$ 0,36/ano por mourão. O de eucalipto? R$ 3,60/ano.",
      "cta": "Peça seu orçamento agora — entrega em 48h para Sergipe, Alagoas e Bahia.",
      "copy_curto": "Mourão que dura 50 anos. Da {cliente}, direto da fábrica em Itabaiana. Peça pelo WhatsApp ↓",
      "copy_longo": "...",
      "formato": "feed"
    },
    {
      "id": "v2",
      "hook": "R$ 8.000 por ano em mourão podre — acabe com isso.",
      "formato": "stories"
    },
    {
      "id": "v3",
      "hook": "Mourão que passa de geração em geração. {cliente}.",
      "formato": "search"
    }
  ],
  "google_ads": {
    "headlines": [
      "Mourão Torneado de Concreto",
      "Entrega 48h — Sergipe e Alagoas",
      "Direto da Fábrica — Preço Justo"
    ],
    "descriptions": [
      "Mourão que dura 50 anos. Fábrica própria em Itabaiana-SE. Laudo técnico em cada lote. Peça orçamento.",
      "Pare de repor mourão todo ano. Concreto dura 10x mais que eucalipto. Entrega rápida."
    ]
  }
}
```

---

## Tarefas Técnicas

- [x] Criar `scripts/gerar-copy-ads.js` com prompt estruturado (7 pilares)
- [x] Adicionar script ao `package.json`: `"gerar-copy-ads": "node --env-file=.env scripts/gerar-copy-ads.js"`
- [x] Gerar rascunho de copy da {cliente} em `config/ads-copy-{cliente}.json`
- [ ] Gerar versão via IA e revisar output (requer ANTHROPIC_API_KEY)

---

## Definition of Done

- [x] Script funcionando: `npm run gerar-copy-ads -- --cliente={cliente}`
- [x] Output com 3+ variações por abordagem × formato (feed, stories, search, retargeting)
- [x] Rascunho da {cliente} gerado — `config/ads-copy-{cliente}.json`
- [ ] Revisar e aprovar copy com o cliente
- [x] Story atualizada

---

*Story EP4-S2 — Escalando Premoldados — 2026-03-05*
