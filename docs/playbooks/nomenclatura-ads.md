# Playbook — Nomenclatura Padrão de Anúncios

**Story:** EP4-S5
**Aplica-se a:** Meta Ads + Google Ads — todos os clientes
**Princípio:** Nomenclatura consistente = dados legíveis = decisões mais rápidas

---

## Por que nomenclatura importa

Sem padrão:
- "campanha1", "teste3", "nova_versao_final_v2" — impossível filtrar ou comparar
- Gestão multi-cliente vira caos em 30 dias

Com padrão:
- Qualquer membro da equipe entende o que é cada campanha só pelo nome
- Filtros no Meta Ads Manager funcionam
- Relatórios automáticos identificam corretamente cada elemento

---

## META ADS

### Campanhas

```
Formato: {CLIENTE}_{PRODUTO}_{FASE}_{OBJETIVO}_{AAAAMM}

CLIENTE  → sigla ou nome curto do cliente (ex: CONCRENOR)
PRODUTO  → produto anunciado (ex: MOURAO, BLOCO, PALANQUE)
FASE     → DISCOVERY | SCALE | RETENCAO
OBJETIVO → LEADS | VENDAS | TRAFEGO | ENGAJAMENTO
AAAAMM   → ano e mês de início (ex: 202603)

Exemplos:
CONCRENOR_MOURAO_DISCOVERY_LEADS_202603
CONCRENOR_MOURAO_SCALE_LEADS_202604
CONCRENOR_BLOCO_DISCOVERY_LEADS_202605
```

### Conjuntos de Anúncios (Adsets)

```
Formato: {CLIENTE}_{FASE-ABREV}_{PUBLICO}_{LOCALIZACAO}

FASE-ABREV → DISC | SCALE | RET
PUBLICO    → INTERESSES-{tema} | RETARGETING-LP{janela}D | LAL{pct}PCT-{base}
LOCALIZACAO → siglas dos estados (ex: SE-AL-BA, SE, ALL)

Exemplos:
CONCRENOR_DISC_INTERESSES-PECUARIA_SE-AL-BA
CONCRENOR_DISC_RETARGETING-LP30D_SE
CONCRENOR_DISC_LAL1PCT-CLIENTES_SE-AL-BA
CONCRENOR_SCALE_LAL2PCT-LEADS_SE-AL-BA
```

### Anúncios

```
Formato: {CLIENTE}_{ABORDAGEM}_{FORMATO}_{VERSAO}

ABORDAGEM → DORFINANCEIRA | GERACAO | PROVASOCIAL | COMPARATIVO | URGENCIA
FORMATO   → FEED | STORIES | REELS | CARROSSEL
VERSAO    → V1, V2, V3...

Exemplos:
CONCRENOR_DORFINANCEIRA_FEED_V1
CONCRENOR_GERACAO_STORIES_V2
CONCRENOR_PROVASOCIAL_CARROSSEL_V1
CONCRENOR_COMPARATIVO_REELS_V1
```

### Públicos Personalizados (Custom Audiences)

```
Formato: CA_{CLI}_{TIPO}_{JANELA}

CLI  → sigla do cliente (ex: CONCRENOR)
TIPO → VISITANTES-LP | CLICOU-WPP | FORMULARIO | ENGAJOU-IG | LISTA-CLIENTES | LISTA-LEADS
JANELA → 7D, 14D, 30D, 60D, 90D (ou sem janela para listas)

Exemplos:
CA_CONCRENOR_VISITANTES-LP_30D
CA_CONCRENOR_CLICOU-WPP_60D
CA_CONCRENOR_FORMULARIO_90D
CA_CONCRENOR_ENGAJOU-IG_30D
CA_CONCRENOR_LISTA-CLIENTES
CA_CONCRENOR_LISTA-LEADS
```

### Lookalike Audiences

```
Formato: LAL_{CLI}_{BASE}_{PCT}_{PAIS}

BASE → CLIENTES | LEADS | VISITANTES
PCT  → 1PCT, 2PCT, 3PCT
PAIS → BR

Exemplos:
LAL_CONCRENOR_CLIENTES_1PCT_BR
LAL_CONCRENOR_LEADS_1PCT_BR
LAL_CONCRENOR_CLIENTES_2PCT_BR
```

### Arquivos de criativos

```
Formato: {cliente}_{abordagem}_{formato}_{versao}.{ext}

Exemplos:
concrenor_dorfinanceira_feed_v1.jpg
concrenor_geracao_stories_v2.mp4
concrenor_comparativo_carrossel_v1.jpg
concrenor_provasocial_reels_v1.mp4
```

Salvar em: `assets/{cliente}/criativos/aprovados/`

---

## GOOGLE ADS

### Campanhas

```
Formato: {CLIENTE}_{TIPO}_{PRODUTO}_{AAAAMM}

TIPO → SEARCH | DISPLAY | PMAX

Exemplos:
CONCRENOR_SEARCH_MOURAO_202603
CONCRENOR_SEARCH_BLOCO_202605
CONCRENOR_PMAX_MOURAO_202607
```

### Grupos de Anúncios

```
Formato: {CLIENTE}_{KEYWORD-TEMA}

Exemplos:
CONCRENOR_MOURAO-CONCRETO-SE
CONCRENOR_MOURAO-TORNEADO-AL
CONCRENOR_PREMOLDADOS-NORDESTE
CONCRENOR_CERCA-CONCRETO-FAZENDA
```

---

## Abordagens disponíveis

| Código | Descrição | Quando usar |
|--------|-----------|-------------|
| `DORFINANCEIRA` | "Quanto você gasta por ano com mourão podre?" | Público frio — nível consciência: com problema |
| `GERACAO` | "Cerca que seu filho vai herdar" | Público frio — apelo emocional/legado |
| `PROVASOCIAL` | Depoimento de cliente real com resultado | Público morno — já viu a marca antes |
| `COMPARATIVO` | Madeira vs. concreto com números | Público frio — nível consciência: comparando |
| `URGENCIA` | Entrega em 48h, estoque limitado | Público quente — retargeting |

---

## Checklist antes de criar qualquer elemento

- [ ] Nome segue o padrão exato acima?
- [ ] Arquivo de criativo tem nomenclatura correta?
- [ ] Exclusões configuradas (clientes existentes fora de campanhas de aquisição)?
- [ ] Estrutura documentada em `config/estrutura-campanha-{cliente}.yaml`?

---

*Playbook EP4-S5 — Escalando Premoldados — 2026-03-06*
