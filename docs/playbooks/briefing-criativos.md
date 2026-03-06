# Briefing de Criativos — Escalando Premoldados

> Processo completo para produção de criativos de anúncios em até 48h após recebimento das fotos.

---

## 1. Checklist de Fotos para o Cliente

Arquivo de referência: `config/checklist-fotos-{cliente}.json`

### Fotos Obrigatórias

| ID | Descrição | Qtd | Uso |
|----|-----------|-----|-----|
| F01 | Mourão instalado no campo — perspectiva diagonal mostrando continuidade da cerca | 3 | feed_v1, carrossel_slide1 |
| F02 | Produto na fábrica — pilha de mourões mostrando quantidade e escala | 2 | feed_v2, stories |
| F03 | Comparação visual — mourão de madeira velho/podre ao lado do concreto novo | 2 | carrossel_comparativo, feed_v3 |
| F04 | Entrega em andamento — caminhão com produto sendo descarregado na propriedade | 1 | feed_prova_entrega |
| F05 | Rosto humano — dono, equipe ou cliente satisfeito | 1 | testimonial_feed, ugc |
| F06 | Laudo técnico ou certificado ABNT — prova visual de qualidade | 1 | feed_credibilidade, stories_objecao |

> Rosto humano (F05) aumenta CTR em ~30%. Priorizar.

### Vídeos Bônus

| ID | Descrição | Uso | Prioridade |
|----|-----------|-----|------------|
| V01 | Vídeo 15-30s do mourão sendo instalado no campo | reels, stories | Alta |
| V02 | Depoimento em vídeo — cliente falando naturalmente para a câmera (UGC) | testimonial_reels | MÁXIMA — converte melhor que qualquer criativo produzido |

### Mensagem WhatsApp para Solicitar Fotos

```
Oi [nome]! Para criar os anúncios da [empresa], preciso de algumas fotos.
Pode tirar pelo celular mesmo, qualidade não precisa ser de câmera profissional:

📸 *Fotos obrigatórias:*
✅ 3x mourão instalado no campo (perspectiva diagonal mostrando a cerca)
✅ 2x produto na fábrica (pilha de mourões, mostrando quantidade)
✅ 2x comparação mourão madeira podre ao lado do concreto novo
✅ 1x entrega sendo feita (caminhão, produto sendo descarregado)
✅ 1x rosto do dono ou da equipe
✅ 1x laudo técnico ou certificado

🎥 *Bônus (se tiver)* — converte muito mais:
⭐ Vídeo 30s do mourão sendo instalado
⭐ Depoimento em vídeo de algum cliente satisfeito falando naturalmente

Qualquer dúvida me chama! Com essas fotos já consigo montar os primeiros anúncios em 48h.
```

---

## 2. Organização de Assets

```
assets/
└── {cliente}/
    ├── fotos/          ← fotos recebidas do cliente (originais)
    ├── videos/         ← vídeos recebidos do cliente (originais)
    └── aprovados/      ← criativos finais aprovados prontos para subir
```

### Nomenclatura de Arquivos

**Criativos produzidos (pasta `aprovados/`):**
```
{CLIENTE}_{ABORDAGEM}_{FORMATO}_{V1|V2|V3}_{YYYYMMDD}.{ext}
```

Exemplos:
- `CONCRENOR_DORFINANCEIRA_FEED_V1_20260310.jpg`
- `CONCRENOR_GERACAO_STORIES_V2_20260310.mp4`
- `CONCRENOR_PROVASOCIAL_CARROSSEL_V1_20260310.jpg` (slides: _01, _02, _03)

**Fotos originais do cliente (pasta `fotos/`):**
```
{CLIENTE}_F{01-06}_{descricao-curta}.{ext}
```

Exemplos:
- `CONCRENOR_F01_campo-diagonal.jpg`
- `CONCRENOR_F03_comparativo-madeira-concreto.jpg`

---

## 3. Templates de Criativos

### Template 1 — Feed Problema/Solução (1:1 — 1080×1080px)

```
┌─────────────────────────────┐
│                             │
│   [FOTO: Mourão no campo]   │
│                             │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │
│  ▓  "Mourão que dura      ▓ │
│  ▓   50 anos."            ▓ │
│  ▓                        ▓ │
│  ▓  Concrenor — Itabaiana ▓ │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │
└─────────────────────────────┘
```

**Especificações:**
- Tamanho: 1080×1080px
- Foto: ocupa 70% superior
- Overlay escuro (60% opacidade) na faixa inferior
- Texto: branco, negrito, 48-52pt
- Logo: canto inferior direito
- Hook da copy integrado ao visual

---

### Template 2 — Feed Comparativo (1:1 — 1080×1080px)

```
┌────────────────────────────┐
│ MADEIRA        │  CONCRETO │
│ [foto podre]   │ [foto ok] │
│                │           │
│ ❌ 5-7 anos    │ ✅ 50 anos │
│ ❌ R$8k/ano    │ ✅ R$400/ano│
│ ❌ Manutenção  │ ✅ Zero    │
│ ❌ Apodrece    │ ✅ Durável │
│                │           │
│     [Logo Concrenor]       │
└────────────────────────────┘
```

**Especificações:**
- Divisão vertical 50/50
- Lado esquerdo: tons quentes/vermelhos, foto madeira podre
- Lado direito: tons verdes/azuis, foto concreto novo
- Ícones ❌ e ✅ grandes e legíveis
- Usa foto F03 do checklist

---

### Template 3 — Stories com Hook (9:16 — 1080×1920px)

```
┌───────────────────┐
│                   │
│  [FOTO ou vídeo   │
│   de fundo]       │
│                   │
│  ┌─────────────┐  │
│  │ "Você gasta │  │
│  │  R$8.000/ano│  │
│  │  com mourão │  │
│  │  de madeira?"│ │
│  └─────────────┘  │
│                   │
│  ↑ Deslize para   │
│    saber como     │
│    parar          │
│                   │
│  [Logo]           │
└───────────────────┘
```

**Especificações:**
- Tamanho: 1080×1920px
- Fundo: foto ou vídeo do produto
- Texto centralizado, área segura: 15% margens laterais
- Hook no terço médio da tela (zona de maior atenção)
- CTA "Deslize" no terço inferior
- Máx. 3 linhas de texto

---

### Template 4 — Carrossel Comparativo (até 5 slides)

**Slide 1 — Hook** (usa F01):
```
"Você sabia que mourão de madeira
custa R$8.000 por ano?
→ Deslize para ver a conta"
```

**Slide 2 — Problema** (usa F03 — madeira):
```
Madeira de eucalipto:
• Dura 5-7 anos
• Precisa de manutenção anual
• Apodrece, cede, vira despesa
```

**Slide 3 — Solução** (usa F01 ou F02 — concreto):
```
Mourão de concreto Concrenor:
• Dura 50+ anos
• Zero manutenção
• Instala uma vez, esquece
```

**Slide 4 — Prova** (usa F05 ou depoimento):
```
"8 anos. 300 hectares. Zero reposição."
— Antônio Mendes, produtor, SE
500+ clientes em 38 cidades
```

**Slide 5 — CTA** (logo + produto):
```
Pede orçamento agora.
Entrega em 48h para todo Sergipe.
[WhatsApp: (79) XXXX-XXXX]
```

---

## 4. Processo de Produção em 48h

### Dia 0 — Recebimento de Fotos

- [ ] Receber fotos via WhatsApp
- [ ] Salvar em `assets/{cliente}/fotos/` com nomenclatura padronizada
- [ ] Verificar qualidade (mínimo 1080px de largura)
- [ ] Confirmar recebimento dos itens do checklist
- [ ] Se faltou alguma foto crítica → solicitar antes de continuar

### Dia 1 — Produção (até 4h de trabalho)

- [ ] Abrir template no Canva/Figma
- [ ] Inserir foto F01 no Template 1 (Feed Problema/Solução)
- [ ] Inserir foto F03 no Template 2 (Feed Comparativo)
- [ ] Inserir hook da copy selecionada (de `config/ads-copy-{cliente}.json`)
- [ ] Produzir Template 3 (Stories) com 3 variações de hook
- [ ] Produzir Carrossel (5 slides)
- [ ] Export: JPG 1080px para feed, PNG para stories

### Dia 2 — Revisão e Aprovação

- [ ] Enviar criativos ao cliente via WhatsApp (PDF ou galeria)
- [ ] Registrar feedback
- [ ] Aplicar ajustes (máx. 1 rodada)
- [ ] Salvar versão final em `assets/{cliente}/aprovados/`
- [ ] Nomear conforme nomenclatura padrão

---

## 5. Critérios de Qualidade do Criativo

### Visual
- [ ] Texto legível em tela de celular (testar em 375px de largura)
- [ ] Contraste adequado (texto sobre imagem: overlay escuro obrigatório)
- [ ] Logo visível mas não dominante
- [ ] Área segura respeitada (mínimo 150px de margem no Stories)

### Copy no Criativo
- [ ] Hook integrado ao visual (não apenas na legenda)
- [ ] Máximo 125 caracteres visíveis no feed (resto fica no "ver mais")
- [ ] CTA claro e específico ("Chama no WhatsApp" > "Saiba mais")
- [ ] Sem excesso de emojis (nicho rural é conservador)

### Técnico
- [ ] Resolução mínima: 1080×1080px (feed) / 1080×1920px (stories)
- [ ] Tamanho do arquivo: máx. 30MB por criativo
- [ ] Texto não ocupa mais de 20% da área (regra Meta)
- [ ] Formato: JPG para imagens estáticas, MP4 para vídeos

---

## 6. Checklist por Cliente — Concrenor

Ver checklist completo: `config/checklist-fotos-concrenor.json`

**Status atual:** Aguardando envio pelo cliente

**Criativos prioritários para subir primeiro:**
1. `CONCRENOR_DORFINANCEIRA_FEED_V1` — Hook financeiro + foto campo (F01)
2. `CONCRENOR_DORFINANCEIRA_STORIES_V1` — "R$8.000/ano jogado fora"
3. `CONCRENOR_PROVASOCIAL_FEED_V1` — Depoimento + números reais

---

*Briefing de Criativos — Escalando Premoldados — v1.0 — 2026-03-06*
