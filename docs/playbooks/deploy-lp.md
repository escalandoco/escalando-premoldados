# Playbook — Deploy de Landing Page

**Meta:** LP no ar em menos de 5 minutos após aprovação

---

## Opções de Hospedagem

| Opção | Quando usar | Subdomínio |
|-------|-------------|------------|
| **Escalando (padrão)** | Cliente não tem servidor | `{cliente}.escalando.co` |
| **Servidor do cliente** | Cliente tem HostGator/cPanel | Domínio próprio |
| **Vercel (LPs dinâmicas)** | LP com integração API | `{slug}.vercel.app` |

---

## Deploy no Servidor da Escalando (HostGator)

### Pré-requisito

LP gerada: `lp/{cliente}/index.html`

Configuração em `config/deploy-clients.json`:
```json
{
  "concrenor": {
    "nome":     "Concrenor",
    "ftp_host": "sh00204.hostgator.com.br",
    "ftp_user": "jonmat48",
    "ftp_pass": "SENHA",
    "ftp_path": "/concrenor.escalando.co/",
    "url":      "https://concrenor.escalando.co/"
  }
}
```

> ⚠️ `config/deploy-clients.json` está no `.gitignore` — nunca commitar.

### Comando

```bash
# Deploy completo (gera + deploya)
node scripts/gerar-lp.js --empresa="Concrenor" --config=config/lp-concrenor.json
node scripts/deploy-lp.js --cliente=concrenor

# Apenas deploy (LP já gerada)
node scripts/deploy-lp.js --cliente=concrenor

# Dry run (simula sem enviar)
node scripts/deploy-lp.js --cliente=concrenor --dry-run

# Deploy de arquivo específico
node scripts/deploy-lp.js --cliente=concrenor --arquivo=lp/concrenor/v2.html
```

### Saída esperada

```
🚀 Deploy de LP — Escalando Premoldados
──────────────────────────────────────────────────
  Cliente:  concrenor
  Arquivo:  /…/lp/concrenor/index.html
  FTP host: sh00204.hostgator.com.br
  FTP path: /concrenor.escalando.co/index.html
  URL:      https://concrenor.escalando.co/
──────────────────────────────────────────────────
📤 Enviando via FTP...
✅ Deploy concluído!
   Arquivo: /concrenor.escalando.co/index.html
   URL:     https://concrenor.escalando.co/
📋 Smoke test:
   curl -s -o /dev/null -w "%{http_code}" https://concrenor.escalando.co/
```

---

## Adicionar Novo Cliente

### 1. Subdomínio no cPanel (servidor Escalando)

Acesse cPanel → **Subdomain** → criar `{cliente}.escalando.co` apontando para `/public_html/{cliente}.escalando.co/`

### 2. Config de deploy

Adicionar entrada em `config/deploy-clients.json`:
```json
"novo-cliente": {
  "nome":     "Nome do Cliente",
  "ftp_host": "sh00204.hostgator.com.br",
  "ftp_user": "jonmat48",
  "ftp_pass": "SENHA",
  "ftp_path": "/novo-cliente.escalando.co/",
  "url":      "https://novo-cliente.escalando.co/"
}
```

### 3. Primeiro deploy

```bash
node scripts/deploy-lp.js --cliente=novo-cliente
```

---

## Deploy no Servidor do Cliente

Se o cliente tem cPanel/HostGator próprio:

```json
"cliente-proprio": {
  "nome":     "Cliente",
  "ftp_host": "seuftp.hostgator.com.br",
  "ftp_user": "usuario_cpanel",
  "ftp_pass": "SENHA_CLIENTE",
  "ftp_path": "/public_html/lp/",
  "url":      "https://www.clientedominio.com.br/lp/"
}
```

---

## Checklist Pós-Deploy

- [ ] URL abre sem erro (HTTP 200)
  ```bash
  curl -s -o /dev/null -w "%{http_code}" https://concrenor.escalando.co/
  ```
- [ ] Formulário visível e funcional
- [ ] Link WhatsApp abre conversa corretamente
- [ ] Pixel Meta disparando (verificar no Meta Events Manager)
- [ ] UTMs preservados — testar com `?utm_source=meta&utm_medium=paid&utm_campaign=mourão`
  - Enviar formulário e verificar na planilha se coluna UTM foi preenchida
- [ ] HTTPS funcionando (cadeado no browser)
- [ ] Mobile responsivo (abrir no celular)

---

## HTTPS no Servidor Escalando

O certificado SSL é gerenciado pelo cPanel da HostGator via Let's Encrypt.

Para novos subdomínios:
1. Criar subdomínio no cPanel
2. cPanel → **SSL/TLS** → **Manage SSL for your site** → Let's Encrypt
3. Aguardar 5–15 min para propagação

---

## Troubleshooting

| Erro | Causa | Solução |
|------|-------|---------|
| `❌ Cliente não encontrado` | Slug errado no JSON | Verificar `config/deploy-clients.json` |
| `❌ Arquivo não encontrado` | LP não gerada | Rodar `gerar-lp.js` antes do deploy |
| FTP timeout | Firewall/NAT no Mac | Normal — script usa modo passivo; tentar em rede diferente |
| HTTP 403 após deploy | Permissão do arquivo | cPanel → File Manager → chmod 644 no index.html |
| Formulário não envia | URL do webhook errada | Verificar `CONFIG.webhook` no HTML gerado |

---

*Playbook EP3-S9 — Escalando Premoldados — 2026-03-06*
