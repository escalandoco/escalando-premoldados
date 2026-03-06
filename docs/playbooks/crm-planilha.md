# CRM — Planilha Google Sheets

> Sistema de CRM fase 1 usando Google Sheets + Apps Script. Zero custo, integrado com o formulário da LP e com Tintim.

---

## 1. Setup inicial (uma vez por agência)

### Passo 1 — Criar a planilha

1. Criar uma nova planilha no Google Sheets
2. Nomear: **"CRM — Escalando Premoldados"**
3. Anotar o ID da planilha (URL: `docs.google.com/spreadsheets/d/{SHEET_ID}/`)

### Passo 2 — Instalar o script de setup

1. Na planilha: **Extensões → Apps Script**
2. Criar novo arquivo: `setup-crm.gs`
3. Colar o conteúdo de `scripts/setup-crm.gs`
4. Salvar e executar `setupCRM()`
5. Autorizar as permissões solicitadas

Resultado: 3 abas criadas automaticamente:
- **MESTRE** — consolidado de todos os clientes
- **DASHBOARD** — visão executiva com totais e métricas
- **TEMPLATE_CLIENTE** — duplicar para cada novo cliente

### Passo 3 — Instalar o webhook de leads

1. No mesmo Apps Script, criar novo arquivo: `webhook-leads.gs`
2. Colar o conteúdo de `scripts/webhook-leads.gs`
3. Configurar `WH_CONFIG.NOTIFICAR_EMAIL` com seu email (opcional)
4. **Implantar → Nova implantação:**
   - Tipo: **Web App**
   - Executar como: **Eu (sua conta)**
   - Quem tem acesso: **Qualquer pessoa**
5. Copiar a URL gerada — é o `webhookUrl` da LP

### Passo 4 — Conectar com a LP

Na planilha de config do cliente (`config/lp-{cliente}.json`), adicionar:
```json
{
  "webhook_url": "https://script.google.com/macros/s/SEU_ID/exec"
}
```

O `gerar-lp.js` injeta esse URL automaticamente no formulário.

---

## 2. Adicionar um novo cliente

### Via script (recomendado):
1. Na planilha: **Extensões → Apps Script → adicionarCliente()**
2. Digitar o nome do cliente (ex: `Concrenor`)
3. Script duplica o TEMPLATE_CLIENTE e renomeia automaticamente

### Manual:
1. Clicar com botão direito em **TEMPLATE_CLIENTE** → **Duplicar**
2. Renomear com nome do cliente em maiúsculas: `CONCRENOR`
3. Atualizar célula A1 com o nome do cliente

### Mapear no webhook:
Em `webhook-leads.gs`, adicionar o cliente no `CLIENTES_MAP`:
```js
CLIENTES_MAP: {
  'concrenor': 'CONCRENOR',
  'nome-cliente': 'NOME_ABA',
}
```

Reimplantar a Web App após editar (Implantar → Gerenciar implantações → Editar).

---

## 3. Estrutura das abas

### Aba MESTRE
| Coluna | Campo | Observação |
|--------|-------|-----------|
| A | Data entrada | Preenchida automaticamente pelo webhook |
| B | Cliente (Fábrica) | Nome do cliente da agência |
| C | Canal | Dropdown: Meta Ads / Google Ads / GMB / Indicação / WhatsApp Orgânico |
| D | Nome do Lead | |
| E | Telefone / WhatsApp | Formato (XX) XXXXX-XXXX |
| F | Cidade | |
| G | Estado | |
| H | Produto de interesse | Dropdown: Cerca/Mourão / Laje/Viga / Bloco/Muro |
| I | Status | Dropdown: Novo / Contatado / Em negociação / Fechado / Perdido / Sem qualidade |
| J | Responsável | Quem está atendendo no cliente |
| K | Data último contato | Atualizar a cada interação |
| L | Dias sem contato | **Calculado automaticamente** — alerta visual se > 2 dias |
| M | Valor estimado (R$) | Estimativa do pedido |
| N | Observação | Notas livres |
| O | UTM source | Canal de origem do anúncio |

### Formatação condicional por Status
| Status | Cor da linha |
|--------|-------------|
| Novo | Azul claro |
| Contatado | Amarelo claro |
| Em negociação | Laranja claro |
| Fechado | Verde claro |
| Perdido | Vermelho claro |
| Sem qualidade | Cinza claro |

---

## 4. Fluxo de um lead novo

```
LP (formulário submit)
  ↓
webhook-leads.gs (Apps Script Web App)
  ↓
Insere em MESTRE (linha nova, Status = "Novo")
  ↓
Insere na aba do cliente (ex: CONCRENOR)
  ↓
Email de notificação (se NOTIFICAR_EMAIL configurado)
  ↓
Gestor vê lead → atualiza Status → preenche Data último contato
```

---

## 5. Fluxo de um lead do Tintim (WhatsApp)

Leads do WhatsApp entram pelo Tintim → webhook Vercel → planilha.
Ver: `docs/playbooks/tintim-multicliente.md`

Canal preenchido como `WhatsApp Orgânico` ou `Meta Ads` (se veio de anúncio).

---

## 6. Rotina semanal do gestor (5 min)

1. Filtrar MESTRE por **Status = "Novo"** + **Dias sem contato > 2**
2. Cobrar cliente sobre leads não contatados
3. Atualizar Status dos leads encerrados (Fechado ou Perdido)
4. Verificar se novos leads do formulário entraram corretamente

---

## 7. Permissões por cliente

Compartilhar **somente a aba do cliente** em modo leitura:
1. Clicar com botão direito na aba `CONCRENOR`
2. **Proteger planilha** → definir permissão de edição apenas para o gestor
3. Compartilhar planilha com email do cliente → ele verá todas as abas mas não poderá editar as outras

> Alternativa mais segura: criar planilha separada por cliente e usar `IMPORTRANGE()` para consolidar no MESTRE.

---

## 8. IDs de referência (Concrenor)

| Item | Valor |
|------|-------|
| Planilha CRM | `1ypUuEzLRpXAACLryN530O3yfMicJLqW_FPZM_nlSN-U` |
| Apps Script URL (webhook) | Configurar após implantar |
| Aba Concrenor | `CONCRENOR` |

---

*CRM Planilha — Escalando Premoldados — v1.0 — 2026-03-06*
