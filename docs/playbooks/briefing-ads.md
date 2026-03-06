# Playbook — Briefing de Anúncios + Call de Ideias

**Tempo total:** 45 minutos com o cliente
**Quando usar:** Antes de criar qualquer anúncio para um novo cliente
**Output:** `config/briefing-ads-{cliente}.json` preenchido

---

## Por que fazer isso primeiro

Sem briefing + call de ideias, qualquer criativo é chute. Com eles, o primeiro anúncio já chega próximo do que converte porque:
- Você fala a linguagem do avatar, não a sua
- Você sabe o que o cliente já tentou (e evita repetir o erro)
- Você tem referências reais para construir o criativo
- As objeções já estão mapeadas antes de escrever uma linha de copy

---

## Parte 1 — Call de Ideias (15-20 min)

Fazer **antes** do briefing formal. O objetivo é soltar o cliente para falar livremente.

### Roteiro da Call

**Abertura (2 min)**
> "Vou te fazer algumas perguntas rápidas antes de começar a criar os anúncios. Quanto mais você me contar, melhores serão os criativos. Pode ser bem informal."

**Perguntas (13-18 min)**

1. **Referências**
   > "Mostre anúncios que você gosta — de qualquer nicho, qualquer produto. O que te chama atenção?"
   *(Anote: o que ele gosta? Imagem? Texto? CTA? Formato?)*

2. **Histórico**
   > "Já tentou anunciar antes? O que funcionou? O que foi horrível?"
   *(Anote: o que não repetir. O que ele já gastou sem retorno.)*

3. **Melhor cliente**
   > "Quem é seu melhor cliente hoje? Me conta a história dele — como chegou até você, o que comprou, o que disse depois."
   *(Esse é o avatar real. Use essa história no criativo.)*

4. **Objeção principal**
   > "Qual é a objeção que você mais ouve antes de fechar? O que faz o cliente hesitar?"
   *(Essa objeção vai virar argumento no copy.)*

5. **Pitch pessoal**
   > "Se você tivesse que convencer um amigo a comprar seu produto em 1 minuto, o que diria?"
   *(A resposta espontânea dele é melhor que qualquer copy gerado por IA.)*

6. **Materiais**
   > "Tem foto de obra entregue, depoimento de cliente, vídeo mostrando o produto? Qualquer coisa no celular mesmo."
   *(UGC — User Generated Content — converte mais que design polido em 2026.)*

---

## Parte 2 — Briefing Estruturado (25-30 min)

Preencher o arquivo `config/briefing-ads-{cliente}.json` com base na conversa + informações do cliente.

### Campos obrigatórios

| Campo | O que coletar |
|-------|--------------|
| `produto_anunciado` | Produto principal da primeira campanha |
| `objetivo_campanha` | leads / vendas / tráfego |
| `orcamento_mensal_brl` | Budget aprovado pelo cliente |
| `avatar.dor_principal` | O que dói financeira ou emocionalmente |
| `avatar.objecoes` | Min. 3 objeções reais |
| `promessa_principal` | Uma frase que resume o valor entregue |
| `provas_sociais` | Min. 2 casos reais com resultado |
| `cta_principal` | Ação que o cliente quer que o lead tome |
| `acessos_necessarios` | Todos os acessos de plataforma necessários |

### Campos que dependem da call

Estes campos só podem ser preenchidos após a call de ideias:

- `referencias_cliente.anuncios_que_gostou`
- `referencias_cliente.o_que_ja_tentou`
- `referencias_cliente.o_que_nao_funcionou`
- `referencias_cliente.materiais_disponiveis` (fotos, vídeos, depoimentos)

---

## Checklist de conclusão da S1

- [ ] Call de ideias realizada (15-20 min) e anotações salvas
- [ ] `config/briefing-ads-{cliente}.json` criado e preenchido
- [ ] Campos da call preenchidos (referências, histórico, materiais)
- [ ] Acessos solicitados ao cliente (Meta Business Manager, Google Ads)
- [ ] Task "Briefing de Anúncios" marcada como concluída no ClickUp
- [ ] Story EP4-S1 atualizada com checkboxes

---

## Solicitação de acessos (enviar por WhatsApp após a call)

```
Oi [Nome]! Pra começar a configurar as campanhas, preciso de acesso a duas plataformas:

1. Meta Business Manager — você me adiciona como parceiro com o e-mail: [email da agência]
   (Configurações do Negócio > Parceiros > Adicionar Parceiro)

2. Google Ads — se já tiver conta, me passa o ID da conta (10 dígitos)
   Se não tiver, eu crio uma pra você

Qualquer dúvida é só falar!
```

---

## Atalhos úteis

- Template do briefing: `config/briefing-ads-template.json`
- Exemplo preenchido (Concrenor): `config/briefing-ads-concrenor.json`
- Próximo passo após S1: `docs/playbooks/setup-meta-ads.md` (S2)

---

*Playbook EP4-S1 — Escalando Premoldados — 2026-03-06*
