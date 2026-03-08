# Story EP3-S12 — SEO Local
**Epic:** EP3 — Sistema de Landing Pages
**Prioridade:** P3
**Responsável:** @analyst
**Status:** Done (Search Console e GMB — tarefas humanas)
**Estimativa:** 0.5 sprint
**Depende de:** EP3-S7 (LP no domínio do cliente)

---

## Contexto

LPs no domínio do cliente podem ranquear organicamente para buscas locais como "mourão de concreto sergipe" ou "bloco de concreto itabaiana". Tráfego orgânico = lead gratuito. Para pré-moldados o SEO local é viável pois a concorrência é baixa.

---

## User Story

**Como** gestor da Escalando Premoldados,
**quero** que as LPs dos clientes apareçam no Google para buscas locais relevantes,
**para que** o cliente receba leads orgânicos além dos pagos.

---

## Acceptance Criteria

- [ ] Meta tags otimizadas: `<title>`, `<meta description>`, Open Graph
- [ ] Schema markup LocalBusiness + Product no template
- [ ] Keywords locais integradas ao copy via config (campo `cidade`, `regioes`)
- [ ] Google Search Console verificado para o domínio do cliente
- [ ] Sitemap.xml criado e submetido
- [ ] Pelo menos 1 LP rankeando para 1 keyword local em 60 dias

---

## Tarefas Técnicas

- [x] Adicionar meta tags dinâmicas ao `template-lp.html` (title, description, OG, canonical)
- [x] Adicionar Schema markup JSON-LD (LocalBusiness + Product) via `gerar-lp.js`
- [x] Criar `sitemap.xml` gerado automaticamente pelo `gerar-lp.js`
- [x] Criar `robots.txt` padrão — gerado pelo `gerar-lp.js`, deployado pelo `deploy-lp.js`
- [ ] Conectar domínio ao Google Search Console — tarefa humana
- [x] Documentar estratégia de keywords locais para pré-moldados (`docs/playbooks/seo-local.md`)

---

## Definition of Done

- [x] Meta tags e Schema implementados no template e gerar-lp.js
- [x] Sitemap e robots.txt gerados automaticamente e deployados
- [ ] Search Console verificado para {cliente} — tarefa humana
- [x] Story atualizada

---

*Story EP3-S12 — Escalando Premoldados — 2026-03-05*
