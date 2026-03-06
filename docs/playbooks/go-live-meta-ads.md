# Go-Live e Monitoramento — Meta Ads

> Pedro Sobral: "As primeiras 72h são sagradas. O algoritmo aprende. Não mexa."
> Regra de ouro: nunca pause um anúncio com menos de 48h e menos de R$50 gastos.

---

## Checklist de Go-Live (executar nessa ordem)

### Fase 1 — Pré-Publicação (D-1)

**Rastreamento:**
- [ ] Pixel Helper confirmando PageView na LP
- [ ] Evento `Contact` disparando ao clicar no WhatsApp
- [ ] Evento `Lead` disparando ao enviar formulário (se houver)
- [ ] CAPI recebendo os mesmos eventos (verificar em Events Manager > Test Events)
- [ ] `event_id` igual no browser e no servidor (deduplicação funcionando)

**Landing Page:**
- [ ] LP carregando em < 3s no mobile (Google PageSpeed > 70)
- [ ] Botão WhatsApp abrindo no número correto
- [ ] UTMs presentes no link do WhatsApp: `?utm_source=meta&utm_medium=paid&utm_campaign=discovery&utm_content={adset}`
- [ ] LP sem erros de console (abrir DevTools no mobile)
- [ ] Formulário enviando e registrando lead

**Criativos:**
- [ ] Todos aprovados pelo Meta (status "Ativo" em cada anúncio)
- [ ] Texto não ocupa > 20% da área do criativo
- [ ] Miniatura atraente (thumbnail do vídeo se for Reels)
- [ ] Sem URL na imagem (bloqueado pelo Meta)

**Configuração da Campanha:**
- [ ] Objetivo: `Leads` ou `Mensagens` (não "Alcance")
- [ ] Pixel associado à conta de anúncios
- [ ] Orçamento: R$30-50/dia na Discovery (nunca iniciar com mais)
- [ ] Data de início: hoje ou amanhã (nunca deixar "sem data")
- [ ] Sem data de término na fase Discovery
- [ ] CBO desativado na Discovery (orçamento por conjunto, não por campanha)

**Públicos:**
- [ ] Conjunto 1 (Interesses): localização correta, idade 35-65, interesses pecuária/agronegócio
- [ ] Conjunto 2 (Retargeting): pixel audience LP 30 dias configurado
- [ ] Conjunto 3 (LAL): LAL 1% de clientes uploadada
- [ ] Sem sobreposição crítica entre conjuntos (verificar Audience Overlap)

**Conta:**
- [ ] Método de pagamento ativo e com saldo/limite suficiente
- [ ] Limite de gastos da conta configurado (proteção)
- [ ] Conta sem restrições de política ativa

---

### Fase 2 — Publicação (Dia 0)

- [ ] Publicar campanha com status **Ativo**
- [ ] Confirmar que os 3 conjuntos estão ativos
- [ ] Confirmar que todos os anúncios em cada conjunto estão ativos
- [ ] Tirar screenshot do Gerenciador de Anúncios (registro inicial)
- [ ] Registrar horário de publicação no log diário
- [ ] Avisar cliente: "Campanha no ar — primeiros resultados em 24-48h"

---

### Fase 3 — Pós-Publicação (D+1, D+2, D+3)

**D+1 (24h depois):**
- [ ] Campanha com impressões > 0
- [ ] Nenhum conjunto em status "Fora de programação" ou "Sem entrega"
- [ ] CPM inicial registrado no log
- [ ] Verificar aprovação de todos os anúncios
- [ ] Configurar alerta de custo por resultado no Meta

**D+2 (48h depois):**
- [ ] Primeiro CTR disponível — registrar no log
- [ ] Primeiros leads/contatos registrados?
- [ ] Comparar CPM entre conjuntos (diferença > 3x = sinal de problema no público)

**D+3 (72h depois):**
- [ ] Fase de aprendizado concluída?
- [ ] CPL estimado (custo total ÷ nº de leads)
- [ ] Qual conjunto performa melhor? Não agir ainda — só registrar.

---

## Regras de Intervenção

### Nunca faça isso nas primeiras 72h:
- Alterar criativos
- Mudar orçamento (nem para mais)
- Pausar conjuntos
- Editar público
- Trocar objetivo

### Quando agir — tabela de decisão:

| Situação | Quando verificar | Ação |
|----------|-----------------|------|
| 0 impressões após 24h | D+1 | Verificar aprovação + status da conta |
| CPL > 3x da meta após R$100 | Qualquer dia | Pausar o **conjunto** (não o anúncio) |
| CTR < 0.5% após 500 impressões | D+7 | Trocar criativo (hook fraco) |
| CTR > 3% por 7 dias | D+7 | Aumentar orçamento 20% |
| 1 conjunto claramente melhor | D+14 | Pausar os piores, dobrar o vencedor |
| Custo por lead estável < meta | D+21 | Escalar: aumentar orçamento 30%/semana |
| ROAS > 3x ou CPL < R$30 | D+21 | Iniciar fase de Escala (ver S11) |

### Metas da Concrenor (Discovery)

| Métrica | Meta | Alerta se |
|---------|------|-----------|
| CPL (custo por lead) | R$30-50 | > R$90 |
| CTR | > 1.5% | < 0.5% |
| CPM | R$15-40 | > R$80 |
| Taxa de conversão LP | > 3% | < 1% |
| Frequência | < 2.5 | > 4.0 (fadiga) |

---

## Configurar Alertas no Meta Ads Manager

**Caminho:** Gerenciador de Anúncios → Ferramentas → Regras Automatizadas → Nova Regra

### Alerta 1 — CPL alto:
```
Nome: ALERTA — CPL alto Concrenor
Quando: Custo por resultado > R$ 90
Frequência: Uma vez por dia
Ação: Notificar por email
Aplicar a: Todos os conjuntos de anúncios ativos
```

### Alerta 2 — Frequência alta (fadiga):
```
Nome: ALERTA — Frequência alta Concrenor
Quando: Frequência > 4.0
Frequência: Uma vez por dia
Ação: Notificar por email
Aplicar a: Todos os conjuntos de anúncios ativos
```

### Alerta 3 — Gasto zerado (conta suspensa):
```
Nome: ALERTA — Campanha sem gasto
Quando: Valor gasto hoje = R$ 0 após 12h do dia
Frequência: Diário às 14h
Ação: Notificar por email
Aplicar a: Campanha inteira
```

---

## Template de Log Diário

Salvar em `config/log-ads-{cliente}.json` ou usar a planilha do cliente.

```json
{
  "data": "YYYY-MM-DD",
  "dia_campanha": 1,
  "gasto_total_brl": 0,
  "impressoes": 0,
  "alcance": 0,
  "cliques": 0,
  "ctr_pct": 0,
  "cpm_brl": 0,
  "leads": 0,
  "contatos_whatsapp": 0,
  "cpl_brl": 0,
  "frequencia": 0,
  "observacoes": "",
  "acoes_tomadas": ""
}
```

**Planilha Google Sheets (Concrenor):** adicionar aba "Log Ads" na planilha `Leads — Concrenor`.
Colunas: Data | Dia | Gasto | Impressões | Cliques | CTR% | CPM | Leads | WPP | CPL | Freq. | Obs

---

## Processo de Escalonamento Pós-Discovery

Após 21 dias ou ROAS > 3x:

1. **Duplicar conjunto vencedor** com orçamento 2x
2. **Pausar conjuntos perdedores** (CPL > 2x da meta)
3. **Novo teste criativo:** trocar apenas o hook (A/B)
4. **Expandir alcance:** LAL 2-3% ou remover interesses (broad)
5. **Google Ads:** iniciar campanha Search (ver story S8)

Ver story EP4-S11 para regras completas de escala.

---

*Go-Live Meta Ads — Escalando Premoldados — v1.0 — 2026-03-06*
