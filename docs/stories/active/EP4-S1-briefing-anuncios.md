# Story EP4-S1 — Briefing + Call de Ideias com Cliente
**Epic:** EP4 — Produção & Gestão de Anúncios
**Prioridade:** P3
**Responsável:** @traffic-manager + @pm
**Status:** Pending
**Estimativa:** 0.5 sprint

---

## Contexto

Antes de criar qualquer anúncio, precisamos de dois momentos com o cliente: (1) a call de ideias — onde o dono/gerente compartilha referências, criativos que gostou, o que já tentou e o que não funcionou; e (2) o preenchimento do briefing estruturado — avatar, promessa, objeções, histórias reais, orçamento e plataformas.

Sem briefing + call de ideias, qualquer criativo é chute. Com eles, o primeiro anúncio já chega muito mais próximo do que converte.

Metodologia Pedro Sobral: começar sempre pela pesquisa do avatar — entender dor, desejo, linguagem usada, nível de consciência do produto.

---

## User Story

**Como** gestor da Escalando Premoldados,
**quero** um formulário/template de briefing estruturado para anúncios,
**para que** toda campanha comece com informações suficientes para criar copy e criativos certeiros.

---

## Acceptance Criteria

- [ ] Template `config/briefing-ads-{cliente}.json` criado com todos os campos necessários
- [ ] Campos: avatar (nome, idade, profissão, dores, desejos), produto anunciado, promessa principal, prova social, objeções comuns, orçamento mensal, plataformas (Meta/Google), objetivo (leads/vendas/tráfego)
- [ ] Briefing da {cliente} preenchido como caso piloto
- [ ] Call de ideias realizada com o dono/gerente da {cliente} (30-45min)
- [ ] Referências coletadas: anúncios que o cliente gostou, o que já tentou, o que não funcionou
- [ ] Documento de processo: roteiro da call de ideias + briefing (45min total)

---

## Campos do Briefing

```json
{
  "cliente": "{cliente}",
  "produto_anunciado": "Mourão Torneado de Concreto",
  "avatar": {
    "nome": "Antônio, fazendeiro",
    "idade": "40-65 anos",
    "profissao": "Produtor rural / pecuarista",
    "regiao": "Sergipe, Alagoas, Bahia",
    "dor_principal": "Gasta R$8.000/ano repondo mourão de eucalipto que apodrece",
    "desejo": "Cerca durável que não precise de manutenção por décadas",
    "objecoes": ["Preço mais caro que madeira", "Não sei se é resistente", "Como entrega chega até minha fazenda"],
    "linguagem": "direta, sem frescura, fala em hectare, gado, custeio"
  },
  "promessa_principal": "Mourão que dura 50 anos — uma vez colocado, nunca mais troca",
  "provas_sociais": ["Antônio Mendes: 8 anos sem trocar", "300 hectares de Carlos entregues no prazo"],
  "orcamento_mensal": 1500,
  "plataformas": ["Meta Ads"],
  "objetivo": "leads (WhatsApp)",
  "cta": "Peça seu orçamento pelo WhatsApp"
}
```

---

## Roteiro da Call de Ideias (15-20min antes do briefing)

```
1. Mostre anúncios que você gosta (de qualquer nicho) — o que te chama atenção?
2. Já tentou anunciar antes? O que funcionou? O que foi horrível?
3. Quem é seu melhor cliente hoje? Me conta a história dele.
4. Qual é a objeção que você mais ouve antes de fechar?
5. Se você tivesse que convencer um amigo a comprar seu produto, o que diria?
6. Tem algum depoimento de cliente, foto de obra entregue ou caso de sucesso?
```

---

## Tarefas Técnicas

- [x] Criar template JSON `config/briefing-ads-template.json`
- [x] Preencher `config/briefing-ads-{cliente}.json`
- [x] Criar `docs/playbooks/briefing-ads.md` com roteiro completo (call de ideias + briefing)
- [ ] Realizar call de ideias com dono/gerente da {cliente}
- [ ] Adicionar ao checklist de onboarding: "call de ideias + briefing de ads completo"

---

## Definition of Done

- [x] Template criado e documentado
- [ ] Call de ideias realizada com a {cliente}
- [ ] Briefing da {cliente} preenchido (com referências coletadas)
- [x] Playbook de briefing + call de ideias escrito
- [x] Story atualizada com checkboxes

---

*Story EP4-S1 — Escalando Premoldados — 2026-03-05*
