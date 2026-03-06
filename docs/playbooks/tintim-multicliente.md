# Tintim Multi-Cliente — Configuração

> Cada cliente tem um número de WhatsApp. O webhook identifica o cliente pelo número de destino e roteia o lead para a aba correta da planilha.

---

## Arquitetura

```
Lead envia mensagem no WhatsApp do cliente
  ↓
Tintim recebe → dispara webhook POST
  ↓
Vercel: api/tintim.js
  → identifica cliente pelo número de WhatsApp
  ↓
Apps Script: webhook-leads.gs
  → insere na aba MESTRE
  → insere na aba do cliente (ex: CONCRENOR)
```

---

## Adicionar um novo cliente

### Passo 1 — Registrar o número no webhook Vercel

Em `api/tintim.js`, adicionar o número do WhatsApp do cliente no `CLIENTES_MAP`:

```js
const CLIENTES_MAP = {
  '5579999999999': {
    slug:       'concrenor',
    nome:       'Concrenor',
    abaSheets:  'CONCRENOR',   // nome exato da aba na planilha
  },
  '5571888888888': {
    slug:       'outro-cliente',
    nome:       'Outro Cliente',
    abaSheets:  'OUTRO_CLIENTE',
  },
};
```

> O número deve incluir o DDI (55) e o DDD, sem espaços ou símbolos.

### Passo 2 — Fazer deploy no Vercel

```bash
# Na pasta escalando-premoldados
vercel --prod
```

Ou push para o repositório GitHub (se CI/CD configurado).

### Passo 3 — Registrar webhook no Tintim

No painel Tintim → **Integrações → Webhooks → Adicionar:**

- URL: `https://escalando-premoldados.vercel.app/api/tintim`
- Eventos: `new_conversation`, `new_message`, `contact_created`
- Método: POST

> Se cada cliente tem workspace Tintim separado, registrar o webhook em cada workspace apontando para a mesma URL.

### Passo 4 — Criar aba na planilha CRM

Na planilha Google Sheets:
1. Executar `adicionarCliente()` no Apps Script
2. Digitar o nome exato: `OUTRO_CLIENTE`
3. Aba criada e pronta para receber leads

### Passo 5 — Atualizar `CLIENTES_MAP` no webhook-leads.gs

Em `scripts/webhook-leads.gs`, adicionar no `CLIENTES_MAP`:

```js
CLIENTES_MAP: {
  'concrenor':       'CONCRENOR',
  'outro-cliente':   'OUTRO_CLIENTE',
}
```

Reimplantar a Web App no Apps Script após editar.

---

## Testar a integração

### Teste manual via curl:

```bash
curl -X POST https://escalando-premoldados.vercel.app/api/tintim \
  -H "Content-Type: application/json" \
  -d '{
    "event": "new_conversation",
    "contact": {
      "name": "João Teste",
      "phone": "5579988887777",
      "to": "5579999999999"
    }
  }'
```

Resposta esperada:
```json
{ "ok": true, "cliente": "Concrenor", "lead": "João Teste" }
```

### Verificar na planilha:
- Aba MESTRE → nova linha com canal "WhatsApp Orgânico"
- Aba CONCRENOR → mesma linha duplicada

---

## Identificação do cliente — fallback

Se o número de destino não estiver mapeado no `CLIENTES_MAP`:
- Lead cai apenas na aba MESTRE
- Cliente registrado como "Desconhecido"
- Canal: "WhatsApp Orgânico"

Isso evita perder o lead — revisar diariamente no MESTRE leads sem cliente associado.

---

## Estado atual (2026-03-06)

| Cliente | Número WPP | Mapeado | Aba |
|---------|-----------|---------|-----|
| Concrenor | a configurar | ❌ | CONCRENOR |

**Próximo passo:** obter número WhatsApp Business da Concrenor e atualizar `api/tintim.js`.

---

*Tintim Multi-Cliente — Escalando Premoldados — v1.0 — 2026-03-06*
