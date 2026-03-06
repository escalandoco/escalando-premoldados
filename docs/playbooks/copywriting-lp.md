# Playbook — Copywriting de Landing Page

**Processo:** Briefing → Copy com IA → Revisão → Aprovação → Desenvolvimento
**Tempo médio:** 30–60 min por LP

---

## Visão Geral

O copy é gerado automaticamente a partir do briefing usando `scripts/gerar-copy.js` + Claude Opus 4.6. O resultado é um JSON com headline, diferenciais, depoimentos e variação A/B, pronto para ser usado com `gerar-lp.js`.

```
config/briefing-{cliente}.json
        ↓ gerar-copy.js
config/lp-{cliente}.json
        ↓ gerar-lp.js
lp/{cliente}/index.html
```

---

## Pré-requisito

`ANTHROPIC_API_KEY` definida no `.env` ou no ambiente:
```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

---

## Passo a Passo

### 1. Preparar o Briefing

O briefing deve estar em `config/briefing-{cliente}.json`. Campos que mais impactam o copy:

| Campo | Impacto no Copy |
|-------|-----------------|
| `proposta_unica` | Base do headline |
| `dor_cliente` | Seção "problema" |
| `resultado_cliente` | Benefícios e depoimentos |
| `diferencial_1..6` | Cards de diferenciais |
| `tom` | `direto-pratico` / `tecnico` / `emocional` |
| `historia_fundacao` | Credibilidade e autenticidade |

### 2. Gerar Copy

```bash
node scripts/gerar-copy.js --briefing=config/briefing-concrenor.json
```

O script:
1. Lê o briefing
2. Monta prompt especializado em copywriting
3. Envia para Claude Opus 4.6 (streaming — saída ao vivo no terminal)
4. Salva `config/lp-{cliente}.json` com copy completo

Saída esperada no terminal:
```
🖊️  Gerando copy para: Concrenor — Mourão Torneado
⏳ Consultando Claude Opus 4.6...
────────────────────────────────────────────────────
{ "headline": "...", ... }
────────────────────────────────────────────────────
✅ Copy gerado com sucesso!
📄 Config salva em: config/lp-concrenor.json
```

### 3. Revisar o JSON gerado

Abrir `config/lp-{cliente}.json` e verificar:

- [ ] **Headline** — direto ao ponto, máx. 10 palavras
- [ ] **Subheadline** — menciona cidade/região, complementa headline
- [ ] **Diferenciais** — 4 cards com ícone, título e descrição concreta
- [ ] **Depoimentos** — 2 depoimentos realistas com nome, local e resultado
- [ ] **Headline A/B** — abordagem diferente do headline principal
- [ ] **Números** — `numeros[]` com valores reais do cliente (anos, obras, prazo)
- [ ] **whatsapp_msg** — mensagem pré-preenchida para o link WPP

### 4. Compartilhar com o Cliente

Opções:
- **Opção A (preferida):** Gerar LP preview e enviar URL
  ```bash
  node scripts/gerar-lp.js --empresa="Concrenor" --config=config/lp-concrenor.json
  # → lp/concrenor/index.html (deploy temporário para review)
  ```
- **Opção B:** Copiar seções do JSON em Google Docs/Notion

### 5. Aplicar Revisões

Editar `config/lp-{cliente}.json` diretamente com as alterações do cliente, depois regenerar:
```bash
node scripts/gerar-lp.js --empresa="Concrenor" --config=config/lp-concrenor.json
```

### 6. Aprovação Final

- [ ] Cliente aprovou headline e subheadline
- [ ] Diferenciais refletem linguagem do cliente (não parecem genéricos)
- [ ] Depoimentos aprovados ou substituídos por reais
- [ ] CTA (botão) com texto correto

---

## Estrutura do Output (lp-{cliente}.json)

```json
{
  "headline":      "Premoldados de concreto entregues em 48h no Nordeste",
  "headline_ab":   "Sua obra sem atraso: premoldados prontos em 48 horas",
  "subheadline":   "Atendemos construtores de Sergipe ao Maranhão com estoque próprio",
  "badge":         "Premoldados de concreto",
  "slogan":        "Concreto que dura gerações",
  "whatsapp_msg":  "Olá Concrenor! Vim pelo site e gostaria de um orçamento.",
  "numeros": [
    { "valor": "15+", "label": "Anos no mercado" },
    { "valor": "800+", "label": "Obras atendidas" },
    { "valor": "48h",  "label": "Prazo de entrega" }
  ],
  "diferenciais": [
    { "icone": "🏭", "titulo": "Fábrica própria", "desc": "..." },
    ...
  ],
  "depoimentos": [
    { "nome": "João Silva", "local": "Aracaju — SE", "texto": "..." },
    ...
  ]
}
```

---

## Quando Regenerar o Copy com IA

| Situação | Ação |
|----------|------|
| Briefing desatualizado (novos diferenciais) | Atualizar `briefing-{cliente}.json` e rodar `gerar-copy.js` novamente |
| Cliente rejeitou headline | Editar `proposta_unica` no briefing e rodar novamente |
| Nova LP (produto diferente) | Novo briefing com `lp_nome` diferente; mesmo `gerar-copy.js` |
| Teste A/B | Usar `headline` vs. `headline_ab` — mudar manualmente no JSON |

---

## Troubleshooting

| Problema | Solução |
|----------|---------|
| `ANTHROPIC_API_KEY não definida` | `export ANTHROPIC_API_KEY=sk-ant-...` |
| JSON inválido na resposta | Checar `config/copy-raw-error.txt`; rodar novamente |
| Copy genérico/sem personalidade | Enriquecer `historia_fundacao`, `maior_orgulho`, `dor_cliente` no briefing |
| Números errados | Editar `numeros[]` diretamente no `lp-{cliente}.json` |

---

*Playbook EP3-S2 — Escalando Premoldados — 2026-03-06*
