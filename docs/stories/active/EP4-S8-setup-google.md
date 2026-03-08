# Story EP4-S8 — Setup Google Ads + GTM + Conversões
**Epic:** EP4 — Produção & Gestão de Anúncios
**Prioridade:** P3
**Responsável:** @traffic-manager + @dev
**Status:** Pending
**Estimativa:** 1 sprint
**Depende de:** EP4-S3, EP4-S7 (Meta setup concluído)

---

## Contexto

Google Ads Search captura demanda ativa: pessoas que já estão pesquisando "mourão de concreto Sergipe" têm intenção de compra muito maior que qualquer público de interesse no Meta. É o complemento perfeito após a Discovery do Meta — enquanto o Meta cria demanda, o Google captura quem já quer comprar.

O Google Tag Manager centraliza todos os tags (Meta Pixel, GA4, Google Ads) em um único lugar, facilitando gestão e evitando conflito de scripts na LP.

---

## User Story

**Como** gestor da Escalando Premoldados,
**quero** o Google Ads, GTM e conversões configurados corretamente para os clientes,
**para que** eu possa rodar campanhas Search no Google e ter rastreamento centralizado de todas as plataformas via GTM.

---

## Acceptance Criteria

- [ ] Conta Google Ads criada/configurada para a agência (MCC — My Client Center)
- [ ] Sub-conta do cliente ({cliente}) criada dentro do MCC
- [ ] Google Tag Manager instalado na LP via código (container snippet no `<head>` e `<body>`)
- [ ] GA4 Property criada e tag publicada via GTM
- [ ] Conversão Google Ads configurada: `Contact` (click WhatsApp) + `Lead` (formulário)
- [ ] Conversões importadas do GA4 para o Google Ads
- [ ] Primeira campanha Search criada: keywords "mourão de concreto + cidade"
- [ ] Nomenclatura seguindo padrão de EP4-S3
- [ ] Extensões de anúncio configuradas: Chamada, Sitelinks, Structured Snippets
- [ ] Teste de conversão validado (clicar no WhatsApp e ver conversão no Google Ads)

---

## Estrutura GTM

```
GTM Container: GTM-XXXXXXX (uma por cliente)

Tags a publicar via GTM:
├── Meta Pixel — PageView (dispara em todas as páginas)
├── Meta Pixel — Contact (dispara no click do botão WhatsApp)
├── Meta Pixel — Lead (dispara no submit do formulário)
├── GA4 — Configuration Tag (todas as páginas)
├── GA4 — Event: click_whatsapp
├── GA4 — Event: form_submit
└── Google Ads — Conversion Tracking

Gatilhos:
├── All Pages (para Pixel PageView + GA4 Config)
├── Click URL contains "wa.me" (para Contact/click_whatsapp)
└── Form Submission (para Lead/form_submit)
```

---

## Campanha Google Ads Search — {cliente}

```
📁 CONCRENOR_SEARCH_MOURAO_202603
   Tipo: Search
   Objetivo: Leads (Formulário / Chamada)
   Orçamento: R$ 20-30/dia
   Período: Contínuo após Meta discovery

   📂 CONCRENOR_MOURAO-CONCRETO-SE
      Keywords (correspondência de frase):
      - "mourão de concreto sergipe"
      - "mourão torneado sergipe"
      - "comprar mourão de concreto"
      - "fábrica de premoldados sergipe"
      - "mourão de concreto itabaiana"

      Anúncios Responsivos:
      Headlines (15 opções):
      - Mourão Torneado de Concreto
      - Entrega 48h — Todo Sergipe
      - Direto da Fábrica em Itabaiana
      - Mourão que Dura 50 Anos
      - Peça Orçamento pelo WhatsApp
      - Fábrica de Pré-moldados SE
      - Preço Direto — Sem Intermediários
      - Laudo Técnico em Cada Lote

      Descriptions (4 opções):
      - Mourão de concreto com 50 anos de durabilidade. Fábrica própria. Entrega para Sergipe, Alagoas e Bahia. Peça orçamento.
      - Pare de repor mourão todo ano. Concreto dura 10x mais que eucalipto. 300+ obras entregues. Peça orçamento agora.

   Extensões:
   - Chamada: (79) XXXX-XXXX
   - Sitelinks: Mourão Torneado | Bloco de Concreto | Palanque | Sobre a {cliente}
   - Structured Snippets: Produtos: Mourão, Bloco, Palanque, Pré-laje
```

---

## Configuração de Conversões no Google Ads

```
Conversão 1: WhatsApp Click
- Categoria: Lead
- Método: Importar do GA4 (evento: click_whatsapp)
- Janela: 30 dias
- Valor: Não definido

Conversão 2: Form Submit
- Categoria: Lead
- Método: Importar do GA4 (evento: form_submit)
- Janela: 30 dias
- Valor: Não definido

Conversão 3: Chamada (para anúncios com extensão de chamada)
- Categoria: Lead
- Duração mínima: 30 segundos
```

---

## Tarefas Técnicas

- [ ] Criar MCC (Google Ads Manager Account) para a agência
- [ ] Criar sub-conta {cliente} dentro do MCC
- [x] Instalar container GTM na LP (snippets head + noscript body via `gtm_id` no config)
- [ ] Configurar tags no GTM: Pixel Meta, GA4, Conversões Google Ads
- [ ] Criar GA4 Property e conectar ao GTM
- [ ] Importar conversões do GA4 no Google Ads
- [ ] Criar campanha Search da {cliente} com keywords e anúncios responsivos
- [x] Criar `docs/playbooks/setup-google-ads.md` com processo de configuração
- [ ] Testar conversões com Google Tag Assistant

---

## Definition of Done

- [ ] MCC criado com sub-conta {cliente}
- [ ] GTM instalado e publicado (GA4 + conversões funcionando)
- [ ] Conversões aparecendo no Google Ads (verificado com Tag Assistant)
- [ ] Campanha Search criada e com status "Apto"
- [x] Playbook de setup escrito — `docs/playbooks/setup-google-ads.md`
- [x] Story atualizada

---

*Story EP4-S8 — Escalando Premoldados — 2026-03-05*
