# Story EP4-S3 — Estratégia Criativa + Nomenclatura Padrão
**Epic:** EP4 — Produção & Gestão de Anúncios
**Prioridade:** P3
**Responsável:** @traffic-manager
**Status:** Pending
**Estimativa:** 0.5 sprint
**Depende de:** EP4-S1, EP4-S2

---

## Contexto

Com briefing e benchmarking em mãos, é hora de definir a estratégia criativa inicial e o padrão de nomenclatura para todos os elementos dentro do Meta Ads e Google Ads. Nomenclatura padronizada é fundamental para gestão multi-cliente: permite filtrar, analisar e comparar campanhas sem confusão.

Pedro Sobral: "Estrutura antes de criativo. Quem não organiza a campanha direito, não consegue ler os dados depois."

---

## User Story

**Como** gestor da Escalando Premoldados,
**quero** uma estratégia criativa definida e um padrão de nomenclatura para todos os elementos de campanha,
**para que** qualquer membro da equipe possa criar, identificar e analisar anúncios sem ambiguidade.

---

## Acceptance Criteria

- [ ] Estratégia criativa da Concrenor documentada (ideia central, ângulo principal, 3 variações de abordagem)
- [ ] Nomenclatura padrão definida para todos os níveis: Campanha, Conjunto, Anúncio, Público, Criativo
- [ ] Padrão válido para Meta Ads E Google Ads
- [ ] Documento `docs/playbooks/nomenclatura-ads.md` criado
- [ ] Template `config/estrutura-campanha-{cliente}.yaml` criado
- [ ] Estrutura da campanha Discovery da Concrenor documentada
- [ ] Fase Discovery vs Fase Scale definidas com orçamentos

---

## Estratégia Criativa

### Definição da Estratégia (preencher por cliente)

```yaml
cliente: Concrenor
angulo_principal: "Economia de longo prazo vs mourão de madeira"
ideia_central: "O mourão de concreto parece mais caro — mas custa 10x menos ao longo da vida"
abordagens:
  - id: A1
    nome: "Dor financeira"
    descricao: "Quanto você gasta por ano repondo mourão podre?"
  - id: A2
    nome: "Geração"
    descricao: "Cerca que seu filho vai herdar. Sem manutenção."
  - id: A3
    nome: "Prova social"
    descricao: "Antônio Mendes: 8 anos de cerca sem trocar um mourão"
fase_inicial: Discovery
orcamento_discovery: "R$ 30-50/dia"
duracao_discovery: "14-21 dias"
```

---

## Nomenclatura Padrão

### Estrutura: `{Cliente}_{Produto}_{Fase}_{Variável}_{Data}`

#### Campanhas
```
Formato: {CLIENTE}_{PRODUTO}_{FASE}_{OBJETIVO}_{AAAAMM}
Exemplo: CONCRENOR_MOURAO_DISCOVERY_LEADS_202603
Exemplo: CONCRENOR_BLOCO_SCALE_LEADS_202604
```

#### Conjuntos de Anúncios (Adsets)
```
Formato: {CLIENTE}_{FASE}_{PUBLICO}_{LOCALIZACAO}
Exemplo: CONCRENOR_DISC_INTERESSES-PECUARIA_SE-AL-BA
Exemplo: CONCRENOR_DISC_RETARGETING-LP30D_SE
Exemplo: CONCRENOR_DISC_LAL1PCT-LEADS_SE-AL-BA
```

#### Anúncios
```
Formato: {CLIENTE}_{ABORDAGEM}_{FORMATO}_{VERSAO}
Exemplo: CONCRENOR_DORFINANCEIRA_FEED_V1
Exemplo: CONCRENOR_GERACAO_STORIES_V2
Exemplo: CONCRENOR_PROVASOCIAL_FEED_V1
```

#### Públicos Personalizados (Custom Audiences)
```
Formato: CA_{CLIENTE}_{TIPO}_{JANELA}
Exemplo: CA_CONCRENOR_VISITANTES-LP_30D
Exemplo: CA_CONCRENOR_CLICOU-WPP_60D
Exemplo: CA_CONCRENOR_LISTA-CLIENTES
```

#### Lookalike Audiences
```
Formato: LAL_{CLIENTE}_{BASE}_{PCT}_{PAIS}
Exemplo: LAL_CONCRENOR_LEADS_1PCT_BR
Exemplo: LAL_CONCRENOR_CLIENTES_2PCT_BR
```

#### Criativos (arquivos)
```
Formato: {cliente}_{abordagem}_{formato}_{versao}.{ext}
Exemplo: concrenor_dorfinanceira_feed_v1.jpg
Exemplo: concrenor_comparativo_stories_v2.mp4
```

#### Google Ads
```
Campanha:  {CLIENTE}_{TIPO}_{PRODUTO}_{AAAAMM}
           CONCRENOR_SEARCH_MOURAO_202603
Grupo:     {CLIENTE}_{KEYWORD-TEMA}
           CONCRENOR_MOURAO-CONCRETO-SE
```

---

## Estrutura de Campanha Discovery — Concrenor

```
📁 CONCRENOR_MOURAO_DISCOVERY_LEADS_202603
   Objetivo: Leads (WhatsApp)
   Orçamento: R$ 50/dia (nível campanha)
   Período: 21 dias

   📂 CONCRENOR_DISC_INTERESSES-PECUARIA_SE-AL-BA
      Localização: Sergipe + Alagoas + Sul Bahia
      Idade: 30-65 | Gênero: Todos
      Interesses: Agropecuária, Pecuária, Cerca rural, Fazenda
      ├── CONCRENOR_DORFINANCEIRA_FEED_V1
      ├── CONCRENOR_GERACAO_FEED_V2
      └── CONCRENOR_PROVASOCIAL_FEED_V3

   📂 CONCRENOR_DISC_RETARGETING-LP30D_SE
      Audiência: CA_CONCRENOR_VISITANTES-LP_30D
      ├── CONCRENOR_DORFINANCEIRA_STORIES_V1
      ├── CONCRENOR_GERACAO_STORIES_V2
      └── CONCRENOR_PROVASOCIAL_STORIES_V3

   📂 CONCRENOR_DISC_LAL1PCT-LEADS_SE-AL-BA
      Base: CA_CONCRENOR_LISTA-CLIENTES
      Expansão: 1% Lookalike → filtro SE+AL+BA
      ├── CONCRENOR_DORFINANCEIRA_FEED_V1
      ├── CONCRENOR_GERACAO_FEED_V2
      └── CONCRENOR_PROVASOCIAL_FEED_V3
```

---

## Tarefas Técnicas

- [x] Definir estratégia criativa da Concrenor (preencher YAML)
- [x] Criar `docs/playbooks/nomenclatura-ads.md` com todos os padrões
- [x] Criar `config/estrutura-campanha-concrenor.yaml`
- [ ] Revisar nomenclatura com o cliente (call de 15min)
- [ ] Criar checklist de configuração no Gerenciador Meta (20 pontos antes de publicar)

---

## Definition of Done

- [x] Estratégia criativa da Concrenor definida e documentada
- [x] Nomenclatura padrão criada para todos os níveis (Meta + Google)
- [x] `config/estrutura-campanha-concrenor.yaml` criado
- [x] Playbook de nomenclatura escrito
- [x] Story atualizada

---

*Story EP4-S3 — Escalando Premoldados — 2026-03-05*
