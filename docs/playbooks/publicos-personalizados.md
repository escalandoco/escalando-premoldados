# Playbook — Públicos Personalizados (Custom Audiences)

**Story:** EP4-S6
**Depende de:** S2 (Pixel instalado) + S5 (nomenclatura definida)
**Tempo estimado:** 1h para criar todos os públicos de um cliente

---

## Visão geral — públicos a criar por cliente

| # | Público | Fonte | Janela | Nomenclatura |
|---|---------|-------|--------|--------------|
| 1 | Visitantes da LP | Pixel — PageView | 30 dias | `CA_{CLI}_VISITANTES-LP_30D` |
| 2 | Clicou no WhatsApp | Pixel — Contact | 60 dias | `CA_{CLI}_CLICOU-WPP_60D` |
| 3 | Enviou formulário | Pixel — Lead | 90 dias | `CA_{CLI}_FORMULARIO_90D` |
| 4 | Engajou no Instagram | IG — Engajamento | 30 dias | `CA_{CLI}_ENGAJOU-IG_30D` |
| 5 | Lista de clientes | CSV upload | — | `CA_{CLI}_LISTA-CLIENTES` |
| 6 | Lista de leads | CSV upload | — | `CA_{CLI}_LISTA-LEADS` |
| 7 | Lookalike 1% clientes | CA_LISTA-CLIENTES | 1% | `LAL_{CLI}_CLIENTES_1PCT_BR` |
| 8 | Lookalike 2% clientes | CA_LISTA-CLIENTES | 2% | `LAL_{CLI}_CLIENTES_2PCT_BR` |

> Públicos 1–4 só existem após Pixel instalado há ao menos 7 dias com tráfego.
> Públicos 5–6 podem ser criados imediatamente com CSV.

---

## Parte 1 — Públicos via Pixel (1 a 4)

### Caminho no Meta Ads Manager

```
Meta Ads Manager > Públicos > Criar Público > Público Personalizado > Site
```

### Público 1 — Visitantes da LP

```
Fonte: Site
Eventos: PageView
Janela: Nos últimos 30 dias
Refinar por URL: contém {url-da-lp-do-cliente}
Nome: CA_{CLI}_VISITANTES-LP_30D
```

### Público 2 — Clicou no WhatsApp

```
Fonte: Site
Eventos: Contact
Janela: Nos últimos 60 dias
Nome: CA_{CLI}_CLICOU-WPP_60D
```

### Público 3 — Enviou formulário

```
Fonte: Site
Eventos: Lead
Janela: Nos últimos 90 dias
Nome: CA_{CLI}_FORMULARIO_90D
```

### Público 4 — Engajou no Instagram

```
Fonte: Instagram Business Profile
Tipo: Todos que engajaram com seu perfil
Janela: Nos últimos 30 dias
Nome: CA_{CLI}_ENGAJOU-IG_30D
```

---

## Parte 2 — Públicos via Lista CSV (5 e 6)

### Exportar leads do CRM

```bash
# Exporta todos os leads
node scripts/exportar-leads-meta.js --cliente=Concrenor

# Exporta apenas clientes fechados
node scripts/exportar-leads-meta.js --cliente=Concrenor --tipo=clientes
```

Gera: `dist/{cliente}/meta-audience-{tipo}-{data}.csv`

### Upload no Meta

```
Meta Ads Manager > Públicos > Criar Público > Público Personalizado > Lista de Clientes
→ Fazer upload do CSV gerado
→ Mapear colunas: phone, fn (nome), ln (sobrenome)
→ Nome: CA_{CLI}_LISTA-CLIENTES ou CA_{CLI}_LISTA-LEADS
→ Aguardar processamento (15–60 min)
→ Verificar: Taxa de correspondência (Match Rate) > 60%
```

---

## Parte 3 — Lookalike Audiences (7 e 8)

> Criar apenas após público base (CA_LISTA-CLIENTES) ter ao menos 100 pessoas.

```
Meta Ads Manager > Públicos > Criar Público > Público Semelhante

Público de origem: CA_{CLI}_LISTA-CLIENTES
País: Brasil
Tamanho: 1% (mais similar)
Nome: LAL_{CLI}_CLIENTES_1PCT_BR

Repetir com 2%:
Nome: LAL_{CLI}_CLIENTES_2PCT_BR
```

---

## Regras de exclusão (configurar em todas as campanhas)

| Campanha | Excluir | Motivo |
|----------|---------|--------|
| DISCOVERY (público frio) | `CA_{CLI}_LISTA-CLIENTES` | Já compraram — não gastar budget |
| DISCOVERY (público frio) | `CA_{CLI}_FORMULARIO_90D` | Já converteram — mover para retargeting |
| SCALE | `CA_{CLI}_LISTA-CLIENTES` | Idem |
| RETARGETING | Nenhuma exclusão | Intencionalmente re-engajando |
| RETENÇÃO/UPSELL | Incluir `CA_{CLI}_LISTA-CLIENTES` | Público-alvo desta campanha |

---

## Checklist por cliente novo

- [ ] Pixel instalado há pelo menos 7 dias com tráfego na LP
- [ ] Públicos 1–4 criados (Pixel-based)
- [ ] CSV de leads exportado: `node scripts/exportar-leads-meta.js --cliente={X}`
- [ ] CSV de clientes exportado: `node scripts/exportar-leads-meta.js --cliente={X} --tipo=clientes`
- [ ] Upload de ambos os CSVs no Meta Ads
- [ ] Match Rate verificado (> 60%)
- [ ] Lookalike 1% criado (após base ≥ 100 pessoas)
- [ ] Lookalike 2% criado
- [ ] Exclusões configuradas nas campanhas de aquisição
- [ ] Todos os públicos nomeados seguindo `docs/playbooks/nomenclatura-ads.md`

---

## Concrenor — status dos públicos

| Público | Criado | Match Rate | Observação |
|---------|--------|------------|------------|
| CA_CONCRENOR_VISITANTES-LP_30D | ☐ | — | Aguarda Pixel |
| CA_CONCRENOR_CLICOU-WPP_60D | ☐ | — | Aguarda Pixel |
| CA_CONCRENOR_FORMULARIO_90D | ☐ | — | Aguarda Pixel |
| CA_CONCRENOR_ENGAJOU-IG_30D | ☐ | — | Aguarda acesso IG |
| CA_CONCRENOR_LISTA-CLIENTES | ☐ | — | Aguarda CSV do cliente |
| CA_CONCRENOR_LISTA-LEADS | ☐ | — | Aguarda CSV do CRM |
| LAL_CONCRENOR_CLIENTES_1PCT_BR | ☐ | — | Aguarda lista ≥ 100 |
| LAL_CONCRENOR_CLIENTES_2PCT_BR | ☐ | — | Aguarda lista ≥ 100 |

---

*Playbook EP4-S6 — Escalando Premoldados — 2026-03-06*
