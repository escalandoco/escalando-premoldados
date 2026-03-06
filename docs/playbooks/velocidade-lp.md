# Playbook — Otimização de Velocidade (LP)

**Meta:** PageSpeed Insights (mobile) > 90 em todas as LPs ativas
**Core Web Vitals:** LCP < 2.5s | FID < 100ms | CLS < 0.1

---

## Checklist Pré-Deploy

### Imagens

- [ ] **Formato WebP** — converter todas as imagens (fotos de produto, logo)
  ```bash
  # macOS: via cwebp (brew install webp)
  cwebp -q 85 foto.jpg -o foto.webp
  # Online: squoosh.app
  ```
- [ ] **Dimensões corretas** — logo no template: 36px altura; produtos: max 400px wide
- [ ] **`loading="lazy"`** — já no template para imagens abaixo do fold (footer logo, produtos)
- [ ] **`loading="eager"` no header logo** — NÃO usar lazy no logo do header (LCP candidate)
- [ ] **Tamanho máximo por imagem:** logo < 20KB | produto < 60KB | background < 100KB

### CSS e JS

- [ ] **Tudo inline** — o template já embutie todo CSS e JS; não adicionar `<link>` externo
- [ ] **Fontes** — usar `font-display: swap` se usar Google Fonts; preferência: stack nativo (`-apple-system, BlinkMacSystemFont, 'Segoe UI'`)
- [ ] **Scripts externos** — Pixel Meta e GA4 carregam async; não bloquear render
- [ ] **CSS mínimo** — remover estilos de seções que não serão usadas na LP

### HTML

- [ ] **`<title>` e `<meta description>`** populados via JS na inicialização
- [ ] **`<meta viewport>`** correto (`width=device-width, initial-scale=1.0`)
- [ ] **Sem iframes** desnecessários no HTML inicial
- [ ] **WhatsApp float** — não usa imagem externa, usa SVG inline ✅

---

## Como Auditar (PageSpeed Insights)

1. Deploy da LP em URL pública
2. Acessar: `https://pagespeed.web.dev/`
3. Colar URL da LP e clicar em **Analisar**
4. Focar na aba **Mobile** (mais crítica para tráfego pago)

### Métricas-alvo

| Métrica | Alvo | O que impacta |
|---------|------|---------------|
| LCP (Largest Contentful Paint) | < 2.5s | Maior elemento visível (logo, hero image) |
| FID / INP | < 100ms | Tempo de resposta ao primeiro clique |
| CLS (Cumulative Layout Shift) | < 0.1 | Imagens sem dimensão definida causam shift |
| Score geral mobile | > 90 | Combinação de todas as métricas |

---

## Problemas Comuns e Soluções

| Problema | Causa | Solução |
|----------|-------|---------|
| LCP alto | Logo grande ou imagem hero pesada | Converter para WebP, reduzir tamanho |
| CLS alto | Imagem sem `width`/`height` | Definir atributos width/height no `<img>` |
| Score baixo no mobile | Texto pequeno, botões pequenos | Verificar `font-size` min 16px, buttons min 48px |
| JS bloqueando render | Script síncrono no `<head>` | Usar `async` ou `defer` em scripts externos |
| Pixel Meta lento | Script síncrono | Carregar após `DOMContentLoaded` |

---

## Template — Estado Atual

| Item | Status |
|------|--------|
| CSS inline | ✅ 100% inline |
| JS inline | ✅ 100% inline |
| `loading="lazy"` em produtos | ✅ implementado (EP3-S7) |
| `loading="lazy"` no footer logo | ✅ implementado (EP3-S7) |
| Header logo sem lazy (LCP) | ✅ correto — sem loading attr |
| UTM capture | ✅ 5 parâmetros (EP3-S8) |
| Fontes externas | ⚠️ nenhuma (stack nativo) |
| Imagens WebP | ❗ responsabilidade do gestor ao preparar assets |

---

## Script de Verificação Pós-Deploy

Para verificação rápida após deploy (smoke test):

```bash
# Verifica se a LP carregou (HTTP 200)
curl -s -o /dev/null -w "%{http_code}" https://concrenor.escalando.co/

# Verifica se formulário existe na página
curl -s https://concrenor.escalando.co/ | grep -c "btn-form"
```

Para auditoria completa de PageSpeed via API (requer chave):
```bash
curl "https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=https://concrenor.escalando.co/&strategy=mobile&key=SUA_API_KEY" \
  | jq '.lighthouseResult.categories.performance.score'
```

---

*Playbook EP3-S7 — Escalando Premoldados — 2026-03-06*
