# Playbook — Setup Meta Ads (Pixel + Conversions API)

**Story:** EP4-S2
**Tempo estimado:** 1-2h (técnico) + aguarda acesso do cliente
**Output:** Pixel instalado, CAPI funcionando, match rate > 70%

---

## Pré-requisito

- [ ] Cliente adicionou a agência como parceiro no Meta Business Manager
- [ ] Pixel ID obtido (ou criado) no Events Manager
- [ ] `META_CAPI_TOKEN` configurado no Vercel (System User Token)

---

## Passo 1 — Obter o Pixel ID

1. Acesse [Meta Business Manager](https://business.facebook.com) > conta do cliente
2. Menu > **Events Manager** > selecione o Pixel existente (ou crie um novo)
3. Copie o **Pixel ID** (número de 15-16 dígitos)
4. Preencha no JSON do cliente:

```json
// config/lp-{cliente}.json
{
  "pixel_meta": "1234567890123456"
}
```

Ao rodar `node scripts/gerar-lp.js --empresa=NomeCliente`, o Pixel é injetado automaticamente na LP.

---

## Passo 2 — Configurar o System User Token (CAPI)

O token de acesso para a Conversions API é um **System User Token** — não usa token pessoal.

1. **Meta Business Manager** > Configurações > Usuários do Sistema
2. Crie (ou use) um usuário do sistema com papel **Administrador**
3. Gere o token: **Gerar novo token** > selecione o Pixel > permissões: `ads_management` + `business_management`
4. Copie o token (começa com `EAA...`)
5. Adicione no Vercel:

```bash
# Via Vercel Dashboard > escalando-premoldados > Settings > Environment Variables
META_CAPI_TOKEN = EAAxxxx...
```

---

## Passo 3 — Verificar eventos

Após instalar o pixel e configurar o token:

1. **Chrome Extension:** [Meta Pixel Helper](https://chrome.google.com/webstore/detail/meta-pixel-helper)
2. Abra a LP do cliente
3. Verifique: `PageView` dispara ao carregar
4. Clique no botão WhatsApp → `Contact` deve aparecer
5. Preencha e envie o formulário → `Lead` deve aparecer

No **Events Manager**:
- Aguarde 15-20 min após os testes
- Verifique o **Match Rate** (objetivo: > 70%)
- Em **Deduplication**: confirme que eventos browser + server estão sendo deduplicados

---

## Arquitetura de rastreamento

```
Usuário clica no anúncio Meta
    ↓
LP carrega com UTMs na URL
    ↓
gerar-lp.js injeta: fbq('init', PIXEL_ID) + fbq('track', 'PageView')
    ↓
Usuário clica no WhatsApp
    ↓
[Browser]  fbq('track', 'Contact', {}, { eventID: 'contact_1234_abc' })
[Servidor] POST /api/events → Meta Graph API → evento "Contact" com mesmo event_id
    ↓
Meta deduplica pelo event_id → conta 1 evento (não 2)
    ↓
Algoritmo otimiza para mais "Contacts"
```

---

## Eventos rastreados

| Evento | Trigger | Browser | Servidor |
|--------|---------|---------|---------|
| PageView | LP carregada | ✅ automático | ✗ |
| Contact | Click WhatsApp | ✅ fbq + eventID | ✅ CAPI + eventID |
| Lead | Form submit | ✅ fbq + eventID | ✅ CAPI + phone hash |

---

## Variáveis de ambiente Vercel

| Variável | Valor | Onde usar |
|----------|-------|-----------|
| `META_CAPI_TOKEN` | System User Token da Meta | `api/events.js` |

---

## Checklist de conclusão da S2

- [ ] Pixel ID obtido e preenchido em `config/lp-{cliente}.json`
- [ ] `META_CAPI_TOKEN` configurado no Vercel
- [ ] LP gerada com pixel injetado (verificado com Pixel Helper)
- [ ] Evento `Contact` disparando ao clicar no WhatsApp
- [ ] Evento `Lead` disparando ao submeter o formulário
- [ ] CAPI recebendo eventos (verificado no Events Manager)
- [ ] Match rate > 70% no Events Manager
- [ ] Deduplicação funcionando (browser + servidor = 1 evento)
- [ ] Task "Pixel Meta Instalado" marcada no ClickUp

---

*Playbook EP4-S2 — Escalando Premoldados — 2026-03-06*
