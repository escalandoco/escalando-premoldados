# Playbook Meta Ads — Gates e Fluxo Completo
**Versao:** 5.0
**Atualizado:** 2026-03-14
**Responsavel:** Jon Godeiro + Traffic Masters Squad

---

## Fluxos de Campanha

```
FLUXO B — Direto WhatsApp (PADRAO)     FLUXO A — Com LP (sob demanda)
──────────────────────────────         ────────────────────────────────
Anuncio                                Anuncio
   ↓                                      ↓
WhatsApp direto                        Landing Page
                                          ↓
                                       WhatsApp / Formulario

Objetivo: Mensagens                    Objetivo: Lead / Trafego
Rastreamento: Tintim                   Rastreamento: Pixel + CAPI
Ativado por: padrao                    Ativado por: campo Fluxo = A no card
```

---

## Sequencia de Gates

### Fluxo Padrao (Fluxo B)
```
MA-A → MA-B → MA-C → MA-D → MA-E → MA-G
```

### Fluxo com LP (Fluxo A — quando solicitado)
```
MA-A → MA-B → MA-C → MA-D → MA-E → MA-F → MA-G
```

---

## Gate MA-A — Saude da Conta + Acessos

**Agentes:** `ads-analyst` + `media-buyer`

### Saude da conta
- [ ] Conta de anuncios sem bloqueio ativo
- [ ] BM sem restricoes
- [ ] Maximo 3 anuncios reprovados no mes
- [ ] Reputacao da conta verificada (Qualidade da Conta no Meta)
- [ ] Pagina do Facebook ativa e sem avisos
- [ ] Perfil pessoal do responsavel ativo

> Se conta com problemas → nao avanca. Resolve primeiro.

### Acessos
- [ ] Meta Business Manager com acesso Admin confirmado
- [ ] Conta de anuncios vinculada ao BM da Escalando
- [ ] Pixel ID registrado na ficha do cliente
- [ ] Numero WhatsApp Business confirmado

### Execucoes
- Cria task `🔑 Coletar Acessos — {empresa}` no ClickUp
- `pixel-specialist` inicia configuracao de rastreamento
- Notifica Jon via WhatsApp

---

## Gate MA-B — Briefing + Benchmarking

**Agentes:** `pedro-sobral` + `ads-analyst`

- [ ] Briefing preenchido: avatar, dor, desejo, objecoes, produto, area
- [ ] Call de ideias realizada com cliente (30min)
- [ ] Minimo 5 concorrentes analisados na Meta Ad Library
- [ ] 3 oportunidades de diferenciacao identificadas

> Dados da Ficha do ClickUp alimentam esse gate automaticamente.

### Execucoes
- `traffic-chief` aprova
- Cria task `📐 Estrategia + Nomenclatura — {empresa}` no ClickUp
- Notifica Jon via WhatsApp

---

## Gate MA-C — Estrategia + Nomenclatura

**Agentes:** `pedro-sobral` + `traffic-chief`

- [ ] Angulo principal da campanha definido
- [ ] 3 abordagens criativas mapeadas
- [ ] Fase definida (Discovery ou Scale)
- [ ] Nomenclatura MAT aplicada em todos os niveis

### Nomenclatura MAT

**Campanha:**
```
(TEMPERATURA) | (PRODUTO) | (OBJETIVO) | (OTIMIZACAO) | (AAAA-MM-DD)

Temperaturas: FRIO | ENGAJAMENTO | REMARKETING | BASE
Objetivos: MENSAGENS | GERAÇÃO DE CADASTRO | TRÁFEGO
Otimizacao: CBO | ABO

Ex: FRIO | PISO INTERTRAVADO | MENSAGENS | CBO | 2026-03-14
Ex: REMARKETING | MEIO FIO | MENSAGENS | ABO | 2026-03-14
```

**Conjunto de Anuncios:**
```
(ORIGEM) | (SEXO) | (IDADE) | (ETAPA) | (DURACAO)

Origens: INTERESSE | ABERTO | LAL - {nome} | SITE | CRM
         INSTAGRAM - @{user} | FACEBOOK - @{user}
Sexo: HOMEM | MULHER | H & M
Etapa: TODOS OS VISITANTES | LEAD | ENGAJAMENTO | PAGE VIEW

Ex: INTERESSE | H & M | 30-60 | TODOS OS VISITANTES | 30D
Ex: LAL - LISTA DE CLIENTES | H & M | 30-60 | LEAD | 60D
Ex: INSTAGRAM - @concrenor | H & M | 30-60 | ENGAJAMENTO | 365D
```

**Anuncio:**
```
AD (NUMERO) | (FORMATO) | (HOOK — PRIMEIRA FRASE EM MAIUSCULO)

Formatos: IMG | VID

Ex: AD 01 | IMG | PISO QUE NAO AFUNDA, NAO RACHA E DURA DECADAS
Ex: AD 02 | VID | CONSTRUTORA EM ARACAJU? PISO DA FABRICA, SEM INTERMEDIARIO
```

### Execucoes
- Cria task `✏️ Copy dos Anuncios — {empresa}` no ClickUp
- Notifica Jon via WhatsApp

---

## Gate MA-D — Copy Aprovada

**Agentes:** `pedro-sobral` + `creative-analyst`

- [ ] Minimo 3 hooks por abordagem
- [ ] Copy completa: Hook → Narrativa → Dor/Desejo → Contra-intuitivo → CTA
- [ ] Formatos: feed (curto) e stories (longo)
- [ ] Sem promessas que violem politicas Meta
- [ ] Copy aprovada pelo cliente

### Execucoes
- `traffic-chief` valida alinhamento com estrategia
- Cria task `🎨 Criativos — {empresa}` no ClickUp
- Notifica Jon via WhatsApp

---

## Gate MA-E — Criativos Aprovados

**Agentes:** `ad-midas` + `ux-design-expert`

- [ ] Brief visual gerado a partir da copy aprovada
- [ ] Minimo 2 artes por formato (feed 1:1 e stories 9:16)
- [ ] Texto na imagem: maximo 20% da area (politica Meta)
- [ ] UTMs padronizados em todos os links
- [ ] Nomenclatura MAT aplicada nos arquivos
- [ ] Criativos aprovados pelo cliente

### Execucoes
- Cria task `⚙️ Configurar Campanhas — {empresa}` no ClickUp
- Notifica Jon via WhatsApp

---

## Gate MA-F — Sync LP + Pixel (OPCIONAL — so Fluxo A)

**Agente:** `pixel-specialist`

> Ativado automaticamente quando campo Fluxo = A - Com LP no card.

- [ ] LP publicada em URL definitiva
- [ ] Pixel disparando PageView (verificado no Pixel Helper)
- [ ] Evento Contact no clique WPP
- [ ] Evento Lead no submit do formulario
- [ ] Conversions API ativa (api/events.js)
- [ ] Link WPP com UTM

### Execucoes
- Libera Gate MA-G
- Notifica Jon: "LP + Pixel prontos — campanha pode subir"

---

## Gate MA-G — Go-Live Autorizado

**Agentes:** `media-buyer` + `traffic-chief` + `fiscal`

- [ ] Gate MA-E concluido (+ MA-F se Fluxo A)
- [ ] Reputacao da conta ok (verificacao final)
- [ ] Budget configurado
- [ ] Alertas de custo configurados no Meta
- [ ] Publicos criados (ver secao Publicos)
- [ ] Cliente confirmou disponibilidade para atender lead em ate 2h

### Execucoes
- Liga campanhas
- `performance-analyst` inicia log + checklist diario
- Envia mensagem go-live no grupo WhatsApp do cliente
- Cria task `📊 Monitoramento D+7 — {empresa}` no ClickUp
- Notifica Jon via WhatsApp

---

## Publicos — Nomenclatura MAT

### Engajamento
```
[IG] [ENVOLVIMENTO] [@{perfil}] 7D
[IG] [ENVOLVIMENTO] [@{perfil}] 30D
[IG] [ENVOLVIMENTO] [@{perfil}] 60D
[IG] [ENVOLVIMENTO] [@{perfil}] 90D
[IG] [ENVOLVIMENTO] [@{perfil}] 180D
[IG] [ENVOLVIMENTO] [@{perfil}] 365D

[FB] [ENVOLVIMENTO] [@{perfil}] 7D
[FB] [ENVOLVIMENTO] [@{perfil}] 30D
[FB] [ENVOLVIMENTO] [@{perfil}] 60D
[FB] [ENVOLVIMENTO] [@{perfil}] 90D
[FB] [ENVOLVIMENTO] [@{perfil}] 180D
[FB] [ENVOLVIMENTO] [@{perfil}] 365D
```

### Video View
```
[IG] [FB] [VIDEO VIEW] [3S] 365D - {DD.MM.AA}
```

### Landing Page (so Fluxo A)
```
PIXEL [XXXX] [{TAG}] [VIEW PAGE] 30D
PIXEL [XXXX] [{TAG}] [VIEW PAGE] 60D
PIXEL [XXXX] [{TAG}] [VIEW PAGE] 90D
PIXEL [XXXX] [{TAG}] [VIEW PAGE] 180D

PIXEL [XXXX] [{TAG}] [CONTACT] 30D
PIXEL [XXXX] [{TAG}] [CONTACT] 60D
PIXEL [XXXX] [{TAG}] [CONTACT] 90D
PIXEL [XXXX] [{TAG}] [CONTACT] 180D

PIXEL [XXXX] [{TAG}] [LEAD] 30D
PIXEL [XXXX] [{TAG}] [LEAD] 60D
PIXEL [XXXX] [{TAG}] [LEAD] 90D
PIXEL [XXXX] [{TAG}] [LEAD] 180D
```

### CRM + Lookalike
```
[CRM] [CLIENTES] [{TAG}]
[CRM] [LEADS] [{TAG}]
[LAL] [1%] [CLIENTES] [{TAG}]
[LAL] [2%] [CLIENTES] [{TAG}]
[LAL] [1%] [LEADS] [{TAG}]
```

### Tags por produto — Concrenor
| Produto | Tag |
|---------|-----|
| Piso Intertravado | PISO |
| Meio Fio | MEIO-FIO |
| Bloco de Concreto | BLOCO |

---

## Saude da Conta — Checklist Diario

**Agente:** `media-buyer` + `performance-analyst`

```
[ ] Criativo com baixa qualidade ativo?
[ ] Conta com reputacao negativa?
[ ] Anuncio reprovado? (max 3/mes)
[ ] Conta ou BM bloqueado?
[ ] Criativo com mais de 20% de texto na imagem?
[ ] Copy com promessa que viola politicas?
[ ] Comentarios dos anuncios respondidos?
[ ] Perfil pessoal do responsavel utilizado hoje?
```

### Regras de Emergencia
| Situacao | Acao |
|----------|------|
| Anuncio reprovado | Pausar → verificar politica → pedir aprovacao manual |
| Reputacao negativa | Pausar novos anuncios → sanear criativos |
| BM ou conta bloqueada | Nao recriar → acionar suporte Meta |
| 3 reprovacoes no mes | Parar tudo → auditar todos os criativos |
| Conta parada muito tempo | Aquecimento antes de subir campanha |

---

## Ciclo Pos Go-Live

| Fase | Agente | Acao |
|------|--------|------|
| D+1 a D+7 | `media-buyer` + `performance-analyst` | Checklist diario + monitoramento sem intervir |
| D+7 | `creative-analyst` | Analisa qual hook esta ganhando |
| D+14 | `traffic-chief` | Pausa perdedores, aumenta vencedor |
| D+15 | `performance-analyst` + `fiscal` | Relatorio quinzenal + CPL vs meta |
| D+30 | `scale-optimizer` + `depesh-mandalia` | Escala se ROAS > 3x |
| D+60 | `kasim-aslam` | Expansao para Google Ads Search |

---

## Metas de Performance — Concrenor

| Produto | Ticket medio | Meta CPL | CPL maximo |
|---------|-------------|----------|------------|
| Piso Intertravado | R$5.000 | R$50–80 | R$150 |
| Meio Fio | R$2.000 | R$30–50 | R$80 |
| Projeto grande | R$20.000 | R$100–200 | R$400 |

**Meta 60 dias:** R$50.000/mes em vendas

---

## ClickUp — Comandos via Comentario

| Comentario | Acao |
|------------|------|
| `cria a campanha` | Gera briefing + copy + nomenclatura + publicos + checklist |
| `novo criativo` | Gera nova variacao de copy + brief visual |
| `escalar campanha` | Gera plano de escala baseado nos dados |
| `pausa campanha` | Pausa e registra motivo |
| `monitora ads` | Verifica CPL, CTR, CPM + saude da conta |
| `relatorio` | Gera relatorio de performance |

---

*Playbook Meta Ads v5.0 — Escalando Premoldados — 2026-03-14*
