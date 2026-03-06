# Playbook — SEO Local para Pré-moldados

**Objetivo:** LP de cada cliente ranqueando em buscas locais em 60–90 dias
**Potencial:** Tráfego orgânico gratuito, CPL = R$0

---

## Por que SEO Local funciona para pré-moldados

- Concorrência digital baixa (maioria não tem presença online)
- Buscas com alta intenção de compra: "mourão concreto sergipe", "bloco de vedação aracaju"
- Google prioriza negócios locais com endereço e GMB verificado
- Uma LP bem estruturada ranqueia em 60–90 dias sem link building

---

## Keywords-alvo por cliente

### Estrutura de keyword
```
[produto] + [cidade/estado]
[fabricante/fábrica] + [produto] + [cidade]
[produto] + [uso] + [cidade]
```

### Exemplos Concrenor (Itabaiana — SE)

| Intenção | Keyword | Volume estimado |
|----------|---------|-----------------|
| Produto + cidade | mourão de concreto itabaiana | Baixo (< 100/mês) |
| Produto + estado | mourão torneado sergipe | Médio (100–500) |
| Fábrica | fábrica premoldados se | Baixo |
| Produto + uso | mourão concreto cerca divisa | Baixo |
| Produto + aplicação | bloco de concreto construção sergipe | Médio |

> **Tática:** Cidades de baixa concorrência ranqueiam mais rápido. Priorizar estado (SE, BA) antes de cidade específica.

---

## Implementação técnica (automática via gerar-lp.js)

O gerador já produz automaticamente:

### 1. `<title>` com keyword local
```html
<title>Concrenor — Pré-moldados de concreto em Itabaiana — SE</title>
```

### 2. `<meta description>` estática
```html
<meta name="description" content="Concrenor fornece pré-moldados de concreto com entrega em Sergipe, Bahia. Solicite orçamento grátis.">
```

### 3. Open Graph
```html
<meta property="og:title" content="Concrenor — Pré-moldados de concreto em Itabaiana — SE">
<meta property="og:description" content="...">
<meta property="og:url" content="https://concrenor.escalando.co/">
```

### 4. Schema JSON-LD — LocalBusiness
```json
{
  "@type": "LocalBusiness",
  "name": "Concrenor",
  "address": {
    "addressLocality": "Itabaiana",
    "addressRegion": "SE",
    "addressCountry": "BR"
  },
  "areaServed": [{"@type": "State", "name": "Sergipe"}, ...]
}
```

### 5. Schema JSON-LD — Product (por produto na config)
```json
{
  "@type": "Product",
  "name": "Mourão Torneado",
  "brand": {"@type": "Brand", "name": "Concrenor"},
  "offers": {"@type": "Offer", "priceCurrency": "BRL", "availability": "InStock"}
}
```

### 6. sitemap.xml
```xml
<urlset>
  <url>
    <loc>https://concrenor.escalando.co/</loc>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
```

### 7. robots.txt
```
User-agent: *
Allow: /
Sitemap: https://concrenor.escalando.co/sitemap.xml
```

---

## Configuração necessária por cliente

No `config/lp-{cliente}.json`, adicionar:

```json
{
  "url":     "https://concrenor.escalando.co/",
  "estado":  "SE",
  "gmb_url": "https://g.page/concrenor"
}
```

O campo `regioes` (array) define o `areaServed` no Schema:
```json
"regioes": ["Sergipe", "Bahia", "Alagoas"]
```

---

## Google Search Console (tarefa humana)

1. Acessar [search.google.com/search-console](https://search.google.com/search-console)
2. Adicionar propriedade → tipo **URL** (ex: `https://concrenor.escalando.co/`)
3. Verificar via **meta tag** ou **arquivo HTML** (mais simples para HostGator)
4. Submeter sitemap: `https://concrenor.escalando.co/sitemap.xml`
5. Solicitar indexação manual da URL principal

### Timeline esperada
| Período | O que acontece |
|---------|----------------|
| Dia 1–3 | Google rastreia a URL (Search Console mostra "indexado") |
| Semana 1–2 | Página aparece para buscas exatas de marca |
| Mês 1–2 | Keywords secundárias começam a aparecer (posição 30–50) |
| Mês 2–3 | Keywords locais de cauda longa chegam à posição 10–20 |
| Mês 3–6 | Com GMB verificado, aparece no Local Pack do Google Maps |

---

## Google Business Profile (GMB)

O GMB é o maior impulsionador de SEO local — aparece no "Local Pack" (mapa + 3 resultados).

**Para cada cliente:**
1. Verificar ou criar perfil em [business.google.com](https://business.google.com)
2. Preencher: endereço, horário, produtos, fotos, categoria (Fábrica de Materiais de Construção)
3. Adicionar URL da LP como site oficial
4. Preencher `gmb_url` no `config/lp-{cliente}.json`

---

## Checklist SEO pós-deploy

- [ ] Search Console: URL verificada e sitemap submetido
- [ ] Google rastreou a página (aguardar 3–7 dias)
- [ ] `<title>` contém keyword + cidade (verificar no "Inspecionar URL")
- [ ] Schema válido: testar em [schema.org/SchemaValidator](https://validator.schema.org/)
- [ ] GMB: perfil vinculado à URL da LP
- [ ] robots.txt acessível: `https://{cliente}.escalando.co/robots.txt`
- [ ] sitemap.xml acessível: `https://{cliente}.escalando.co/sitemap.xml`

---

## Monitoramento (mensal)

- Google Search Console → Performance → Filtrar por URL da LP
- Verificar queries (keywords que estão trazendo cliques)
- Verificar impressões × CTR × posição média
- Em 90 dias: se posição média > 20 para keyword principal, considerar:
  - Melhorar copy/conteúdo da LP
  - Conseguir citações (NAP) em diretórios locais
  - Aumentar reviews no GMB

---

*Playbook EP3-S12 — Escalando Premoldados — 2026-03-06*
