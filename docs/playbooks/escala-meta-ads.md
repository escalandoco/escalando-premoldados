# Escala e Otimização — Meta Ads

> Pedro Sobral: "Escalar não é só aumentar budget. É dosar orçamento nos vencedores e expandir com inteligência."
> Nunca aumente mais de 30% do orçamento por vez para não reiniciar a fase de aprendizado.

---

## 1. Quando Escalar

**Todos os critérios abaixo precisam ser verdadeiros:**

| Critério | Como verificar |
|----------|---------------|
| CPL < meta por 7 dias consecutivos | Log diário: `config/log-ads-{cliente}.json` |
| 50+ eventos de conversão/semana | Meta Events Manager |
| Campanha fora da fase de aprendizado | Gerenciador: status "Ativo" (sem "Aprendizado") |
| Mínimo 30 dias de dados | Contar desde `inicio_campanha` no log |

**Para clientes com dado de venda (CRM integrado):**
- ROAS > 3x antes de escalar orçamento acima de R$100/dia

---

## 2. Como Escalar (Passo a Passo)

### Fase 1 — Consolidação (dias 1-21)
- Rodar Discovery com R$30-50/dia
- 3 conjuntos ativos (Interesses, Retargeting, LAL)
- **Não mexer em nada** — deixar o algoritmo aprender

### Fase 2 — Identificação (dias 22-30)
- Identificar o conjunto com menor CPL e maior volume
- Identificar o criativo (hook) com maior CTR
- Pausar conjuntos com CPL > 2x da meta
- Pausar criativos com CTR < 0.5% e CPL > 3x da meta

### Fase 3 — Escala Vertical (mês 2)

```
Semana 1: +20% do orçamento no conjunto vencedor → aguardar 7 dias
Semana 2: se CPL mantido → +20% novamente
Semana 3: se CPL mantido → +30%
Máximo: dobrar o orçamento original em 1 mês
```

**Regra de ouro:** nunca edite o conjunto vencedor. Duplique e edite a cópia.

### Fase 4 — Escala Horizontal (mês 2-3)

1. **Duplicar conjunto vencedor** com:
   - LAL 2% (expandir de 1% para 2%)
   - LAL 3% (mais amplo, CPL tende a subir)
   - Broad (sem interesse — deixar o Meta otimizar livremente)

2. **Novo ciclo de criativos:**
   - Criar 2 novos criativos baseados no hook vencedor
   - Testar variação: mesma estrutura, imagem diferente
   - Testar variação: mesmo hook, formato diferente (vídeo vs imagem)

3. **Expansão geográfica:**
   - Adicionar cidades vizinhas se o produto entrega nelas
   - Criar conjunto específico por região se volumes justificarem

### Fase 5 — Google Ads em Paralelo (mês 3+)

Iniciar Search quando:
- Meta com ROAS positivo por 60+ dias
- Pelo menos 100 leads históricos (para importar como conversão)
- Orçamento disponível para +R$20-30/dia

Ver playbook: `setup-google-ads.md`

---

## 3. Metas de CPL por Produto (Concrenor)

| Produto | Ticket Médio | CPL Máximo | Meta CPL | ROI Break-even |
|---------|-------------|------------|----------|----------------|
| Mourão Torneado (100 un.) | R$ 3.000 | R$ 100 | R$ 40-60 | taxa conversão > 3.3% |
| Bloco de Concreto | R$ 2.000 | R$ 80 | R$ 30-50 | taxa conversão > 4% |
| Projeto fazenda (grande) | R$ 15.000 | R$ 300 | R$ 100-150 | taxa conversão > 2% |

**Interpretação:** Se o CPL está em R$50 e a taxa de fechamento é 10%, o custo por cliente é R$500 em uma venda de R$3.000 — ROAS = 6x. Excelente.

---

## 4. Processo de Teste Contínuo

```
SEMPRE manter 2 criativos em teste ativo.
Nunca parar de testar — o algoritmo sempre encontra novas oportunidades.

Mês 1, semanas 1-2: Discovery (3 hooks × 2 formatos)
Mês 1, semanas 3-4: Identificar vencedor, pausar perdedores
Mês 2, semanas 1-2: Escalar vencedor + testar 2 novos criativos
Mês 2, semanas 3-4: Teste novo público (LAL 2% ou Broad)
Mês 3+: Ciclo contínuo — 1 vencedor escalando, 2 novos em teste
```

**Regra:** nunca mexa no anúncio vencedor. Crie variações ao lado.

---

## 5. Quando Pausar

| Situação | Critério | Ação |
|----------|----------|------|
| Criativo com CTR baixo | CTR < 0.5% após 500 impressões | Pausar anúncio |
| Conjunto com CPL alto | CPL > 2x da meta por 3 dias consecutivos | Pausar conjunto |
| Fadiga de criativo | Frequência > 4.0 e CTR caindo > 30% | Trocar criativo |
| Conta com problema | Gasto zerado sem motivo aparente | Verificar método de pagamento e status |

---

## 6. Ciclo de Revisão Semanal (15 minutos/semana)

**Toda segunda-feira:**
1. Abrir Gerenciador de Anúncios → visão semanal
2. Registrar CPL, CTR, gasto no log (`config/log-ads-{cliente}.json`)
3. Verificar se algum conjunto atingiu limites de pausa
4. Confirmar que novos criativos em teste estão com impressões

**A cada 15 dias:**
1. Rodar `npm run relatorio-ads -- --cliente=Concrenor`
2. Analisar interpretação automática gerada
3. Enviar relatório ao cliente via WhatsApp
4. Decidir próxima ação de otimização

---

## 7. Regra de ROI — Cálculo Rápido

```
ROAS = Faturamento gerado pelos leads / Investimento em ads

Exemplo Concrenor:
  30 leads × 10% fechamento × R$3.000 ticket = R$9.000
  Investimento: R$1.500
  ROAS = 9.000 / 1.500 = 6x ✅ (meta: > 3x)

Se não tem dado de venda → usar CPL como proxy:
  CPL < 33% do ticket médio = campanha saudável
  CPL < 20% do ticket médio = campanha excelente
```

---

*Escala Meta Ads — Escalando Premoldados — v1.0 — 2026-03-06*
