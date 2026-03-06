# Story EP4-S2 — Benchmarking de Concorrentes (Meta Ad Library)
**Epic:** EP4 — Produção & Gestão de Anúncios
**Prioridade:** P3
**Responsável:** @traffic-manager
**Status:** Pending
**Estimativa:** 0.5 sprint
**Depende de:** EP4-S1

---

## Contexto

Antes de criar qualquer criativo, é obrigatório pesquisar o que os concorrentes estão fazendo. A Meta Ad Library mostra todos os anúncios ativos de qualquer página — é uma mina de ouro gratuita. Pedro Sobral: "Não reinvente a roda. Estude o que já funciona no seu nicho e melhore."

Para pré-moldados, os concorrentes são regionais (Sergipe, Alagoas, Bahia) e geralmente não anunciam bem — isso é vantagem competitiva para quem chegar primeiro com um criativo profissional.

---

## User Story

**Como** gestor da Escalando Premoldados,
**quero** uma análise de concorrentes e benchmarking de criativos do segmento de pré-moldados,
**para que** os anúncios dos clientes sejam criados com base no que já funciona no mercado, e não no achismo.

---

## Acceptance Criteria

- [ ] Pesquisa na Meta Ad Library realizada para ao menos 5 concorrentes do nicho (pré-moldados, mourão de concreto, bloco de concreto)
- [ ] Documento `docs/playbooks/benchmarking-ads.md` com análise dos concorrentes
- [ ] Identificação dos hooks, formatos e abordagens mais usados no segmento
- [ ] Identificação de lacunas: o que nenhum concorrente está fazendo (oportunidade)
- [ ] Análise de criativos benchmarks de outros nichos rurais (fencing, construção civil)
- [ ] Briefing de benchmarking da Concrenor preenchido como caso piloto
- [ ] Screenshot/registro dos melhores e piores anúncios encontrados (para referência)

---

## Como Usar a Meta Ad Library

```
1. Acesse: https://www.facebook.com/ads/library/
2. País: Brasil
3. Tipo de anúncio: Todos os anúncios
4. Busque: "mourão de concreto", "bloco de concreto", "premoldados", "pré-moldados"
5. Filtre por: Ativos (para ver o que está rodando agora)
6. Anote: hook visual, copy, CTA, formato, há quanto tempo está ativo (duração = está funcionando)
```

---

## Estrutura da Análise

```markdown
## Concorrente: [Nome da Página]
- **Localização:** SE / AL / BA
- **Produto anunciado:** Mourão torneado
- **Tempo ativo:** 3 semanas (provavelmente funcionando)
- **Hook visual:** Foto de cerca no campo, perspectiva diagonal
- **Hook copy:** "Mourão que dura 50 anos..."
- **CTA:** "Peça orçamento pelo WhatsApp"
- **Formato:** Feed quadrado 1:1
- **O que funciona:** imagem real, copy direto, sem frescura
- **O que falta:** sem prova social, sem preço, sem entrega

## Oportunidade Identificada:
→ Nenhum concorrente usa depoimento em vídeo
→ Nenhum faz comparativo madeira vs concreto com custo/ano
→ Poucos usam urgência ou prova social real
```

---

## Tarefas Técnicas

- [ ] Pesquisar Meta Ad Library: "mourão de concreto" + "bloco de concreto" + "premoldados"
- [ ] Pesquisar páginas de concorrentes conhecidos da Concrenor (perguntar ao cliente)
- [x] Documentar estrutura de análise em `docs/playbooks/benchmarking-ads.md`
- [x] Criar pasta `assets/benchmarking/` com README de nomenclatura
- [x] Identificar 3 oportunidades de diferenciação (via pesquisa de mercado)
- [ ] Preencher análise de concorrentes diretos (requer Ad Library manual)

---

## Definition of Done

- [ ] Pesquisa na Ad Library realizada e documentada
- [ ] Pelo menos 5 anúncios de concorrentes analisados
- [ ] 3 oportunidades de diferenciação identificadas
- [ ] Screenshots salvos em `assets/benchmarking/`
- [ ] Story atualizada

---

*Story EP4-S2 — Escalando Premoldados — 2026-03-05*
