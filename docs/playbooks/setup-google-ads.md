# Playbook — Setup Google Ads + GTM + Conversões

**Story:** EP4-S3
**Tempo estimado:** 2-3h (configuração técnica)
**Output:** GTM instalado, GA4 funcionando, campanha Search criada e apta

---

## Visão geral

```
GTM Container (por cliente)
  ├── Tag: Meta Pixel (substitui injeção direta)
  ├── Tag: GA4 Configuration
  ├── Tag: GA4 Event — click_whatsapp
  ├── Tag: GA4 Event — form_submit
  └── Tag: Google Ads Conversion Tracking
       ├── Conversão: WhatsApp Click
       └── Conversão: Form Submit
```

---

## Passo 1 — Criar MCC (Google Ads Manager Account)

O MCC é a conta "mãe" da agência que gerencia todas as sub-contas dos clientes.

1. Acesse [ads.google.com/intl/pt-BR/home/tools/manager-accounts](https://ads.google.com/intl/pt-BR/home/tools/manager-accounts)
2. Crie a conta MCC da **Escalando Premoldados Agência**
3. Para cada cliente: **Criar nova conta de cliente** dentro do MCC
4. Anote o **ID da conta** (10 dígitos com hífens: XXX-XXX-XXXX)

---

## Passo 2 — Criar container GTM

1. Acesse [tagmanager.google.com](https://tagmanager.google.com)
2. **Criar conta** > nome: "Escalando — {Cliente}" > container: URL da LP
3. Anote o **Container ID** (formato: GTM-XXXXXXX)
4. Preencha no JSON do cliente:

```json
// config/lp-{cliente}.json
{
  "gtm_id": "GTM-XXXXXXX"
}
```

Ao rodar `node scripts/gerar-lp.js --empresa=NomeCliente`, o GTM é injetado automaticamente na LP (head + noscript body).

---

## Passo 3 — Configurar tags no GTM

### 3.1 — GA4 Configuration Tag

1. **Tags** > Nova tag > **Configuração do Google Analytics: GA4**
2. ID de medição: G-XXXXXXXXXX (da property GA4)
3. Gatilho: **All Pages**
4. Nome: `GA4 — Config`

### 3.2 — GA4 Event: click_whatsapp

1. Nova tag > **Evento do Google Analytics: GA4**
2. Tag de configuração: `GA4 — Config`
3. Nome do evento: `click_whatsapp`
4. Gatilho: **Clique — Apenas Links** > URL do link contém `wa.me`
5. Nome: `GA4 — click_whatsapp`

### 3.3 — GA4 Event: form_submit

1. Nova tag > **Evento do Google Analytics: GA4**
2. Nome do evento: `form_submit`
3. Gatilho: **Envio de formulário** (ou clique no botão `#btn-form`)
4. Nome: `GA4 — form_submit`

### 3.4 — Google Ads Conversion Tracking

1. Nova tag > **Acompanhamento de conversões do Google Ads**
2. ID de conversão: (da conta Google Ads do cliente)
3. Rótulo: (gerado ao criar a conversão no Google Ads)
4. Gatilho: mesmo que `click_whatsapp` e `form_submit` (criar 2 tags separadas)

---

## Passo 4 — Criar conversões no Google Ads

1. **Google Ads** > Metas > Conversões > Nova ação de conversão
2. Tipo: **Site**
3. Categoria: **Lead**
4. Método: **Importar do Google Analytics 4** (vincula GA4 → Google Ads)
5. Importe os eventos:
   - `click_whatsapp` → conversão "WhatsApp Click" (janela 30 dias)
   - `form_submit` → conversão "Form Submit" (janela 30 dias)

---

## Passo 5 — Criar campanha Search (Concrenor)

### Estrutura da campanha

```
📁 CONCRENOR_SEARCH_MOURAO_202603
   Tipo: Search
   Objetivo: Leads
   Orçamento: R$ 30/dia
   Estratégia de lance: Maximizar conversões

   📂 CONCRENOR_MOURAO-CONCRETO-SE
      Correspondência de frase:
      "mourão de concreto sergipe"
      "mourão torneado sergipe"
      "comprar mourão de concreto"
      "fábrica de premoldados sergipe"
      "mourão de concreto itabaiana"
      "mourão torneado itabaiana"
      "premoldados sergipe"
      "cerca de concreto sergipe"
```

### Anúncios responsivos (headlines)

```
Mourão Torneado de Concreto
Entrega 48h — Todo Sergipe
Direto da Fábrica em Itabaiana
Mourão que Dura 50 Anos
Peça Orçamento pelo WhatsApp
Fábrica de Pré-moldados SE
Preço Direto — Sem Intermediários
Laudo Técnico em Cada Lote
Cerca Durável para Sua Fazenda
500+ Clientes em SE e AL
```

### Descriptions

```
Mourão de concreto com 50 anos de durabilidade. Fábrica própria em Itabaiana. Entrega para Sergipe, Alagoas e Bahia. Peça orçamento agora.

Pare de repor mourão todo ano. Concreto dura 10x mais que eucalipto. 300+ obras entregues. Laudo técnico por lote. Peça orçamento.
```

### Extensões de anúncio

- **Chamada:** (79) XXXX-XXXX
- **Sitelinks:** Mourão Torneado | Bloco de Concreto | Palanque | Sobre a Concrenor
- **Snippets estruturados:** Tipo: Produtos — Mourão, Bloco, Palanque, Pré-laje

### Negative keywords

Aplicar lista `config/google-ads-negativos.txt` em nível de campanha.

---

## Passo 6 — Verificar tudo

1. **Google Tag Assistant** (Chrome Extension) — confirme que GTM está instalado
2. **GTM Preview Mode** — teste todas as tags antes de publicar
3. **GA4 DebugView** — confirme eventos `click_whatsapp` e `form_submit`
4. **Google Ads** > Conversões > aguarde 24h para ver dados fluindo

---

## Variáveis a preencher por cliente

| Campo | Onde | Exemplo |
|-------|------|---------|
| `gtm_id` | `config/lp-{cliente}.json` | `GTM-XXXXXXX` |
| `ga4` | `config/lp-{cliente}.json` | `G-XXXXXXXXXX` |
| Google Ads Account ID | MCC | `123-456-7890` |

---

## Checklist de conclusão da S3

- [ ] MCC criado com sub-conta do cliente
- [ ] Container GTM criado e ID preenchido em `config/lp-{cliente}.json`
- [ ] LP gerada com GTM injetado (head + noscript)
- [ ] Todas as tags publicadas no GTM
- [ ] GA4 property criada e recebendo dados
- [ ] Conversões configuradas no Google Ads
- [ ] Campanha Search criada com status "Apto"
- [ ] Negative keywords aplicadas (`config/google-ads-negativos.txt`)
- [ ] Extensões de anúncio configuradas
- [ ] Task "Setup Google Concluído" marcada no ClickUp

---

*Playbook EP4-S3 — Escalando Premoldados — 2026-03-06*
