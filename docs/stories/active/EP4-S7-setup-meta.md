# Story EP4-S5 — Setup Técnico e Rastreamento
**Epic:** EP4 — Produção & Gestão de Anúncios
**Prioridade:** P3
**Responsável:** @traffic-manager + @dev
**Status:** Pending
**Estimativa:** 1 sprint
**Depende de:** EP3 (LP com UTM) + EP4-S3

---

## Contexto

Sem rastreamento, não existe otimização. Pedro Sobral: "Dados sem rastreamento são achismo." O setup correto exige Pixel Meta + Conversions API (server-side) + Google Tag Manager + UTMs padronizadas em todos os links.

Para pré-moldados: o evento principal é `Contact` (WhatsApp click) + `Lead` (formulário enviado).

---

## User Story

**Como** gestor da Escalando Premoldados,
**quero** rastreamento completo de todas as interações dos anúncios,
**para que** eu saiba exatamente qual criativo, público e plataforma gera mais leads e a que custo.

---

## Acceptance Criteria

- [x] Pixel Meta instalado na LP do cliente (verificado no Pixel Helper)
- [ ] Eventos configurados: `PageView`, `Contact` (click WhatsApp), `Lead` (form submit)
- [ ] Conversions API configurada via Vercel serverless function
- [ ] UTMs padronizados para todos os anúncios: `?utm_source=meta&utm_medium=cpc&utm_campaign={campanha}&utm_content={criativo}`
- [ ] Google Tag Manager instalado (preparado para futura integração Google Ads)
- [ ] Dashboard de eventos no Meta Events Manager funcionando
- [ ] Teste de conversão: clicar no WhatsApp da LP e ver evento aparecer no Events Manager

---

## Estrutura de Rastreamento

```
Usuário clica no anúncio
    ↓
LP carrega com UTMs na URL
    ↓
Pixel Meta dispara: PageView
    ↓
Usuário clica no WhatsApp
    ↓
Pixel dispara: Contact (browser)
Conversions API dispara: Contact (server) ← sem bloqueador de ad
    ↓
Meta Ads recebe evento duplicado → match rate alto
    ↓
Algoritmo otimiza para mais "Contacts"
```

---

## Eventos a Rastrear

| Evento | Trigger | Valor |
|--------|---------|-------|
| PageView | LP carregada | — |
| Contact | Click botão WhatsApp | — |
| Lead | Form submit (orçamento) | — |
| ViewContent | Scroll > 50% da LP | — |

---

## Tarefas Técnicas

- [ ] Criar `api/events.js` no Vercel — endpoint server-side para Conversions API
- [ ] Adicionar script Pixel Meta ao template `lp/template-lp.html` (ativado via config)
- [ ] Adicionar evento `fbq('track', 'Contact')` no click do botão WhatsApp
- [ ] Adicionar evento `fbq('track', 'Lead')` no submit do formulário
- [ ] Criar `docs/playbooks/setup-rastreamento.md`
- [ ] Testar com Pixel Helper no Chrome

---

## Definition of Done

- [ ] Pixel instalado e funcionando na LP da {cliente}
- [x] Evento `Contact` disparando ao clicar no WhatsApp
- [x] Conversions API recebendo eventos — `api/events.js` criado
- [ ] UTMs aparecendo nas sessões da LP
- [x] Playbook escrito — `docs/playbooks/setup-meta-ads.md`
- [x] Story atualizada

---

*Story EP4-S5 — Escalando Premoldados — 2026-03-05*
