# Story EP4-S4 — Criativos (Textos + Visuais)
**Epic:** EP4 — Produção & Gestão de Anúncios
**Prioridade:** P3
**Responsável:** @traffic-manager + @ux-design-expert
**Status:** In Progress (aguardando fotos do cliente)
**Estimativa:** 1 sprint
**Depende de:** EP4-S2, EP4-S3

---

## Contexto

O criativo é o carrier da copy. Pedro Sobral recomenda começar com UGC (conteúdo gerado pelo usuário/cliente) e imagens reais antes de templates sofisticados — realidade converte mais que design bonito para nicho rural.

Formatos prioritários para pré-moldados:
- Feed quadrado (1:1) — imagem do produto in situ
- Stories vertical (9:16) — vídeo curto ou imagem com texto
- Carrossel — comparativo madeira vs concreto + catálogo de produtos

---

## User Story

**Como** gestor da Escalando Premoldados,
**quero** um processo padronizado para produção de criativos de anúncios,
**para que** cada cliente tenha materiais visuais prontos para rodar campanha em até 48h após o briefing.

---

## Acceptance Criteria

- [ ] Template de briefing visual criado (`docs/playbooks/briefing-criativos.md`)
- [ ] Pasta de assets organizada: `assets/{cliente}/fotos/`, `assets/{cliente}/videos/`, `assets/{cliente}/aprovados/`
- [ ] Checklist de fotos necessárias enviado ao cliente (10 fotos mínimas)
- [ ] Templates Canva/Figma para feed 1:1 e stories 9:16 criados
- [ ] Pelo menos 3 criativos (imagem estática) aprovados para Concrenor
- [ ] Criativo com copy do hook integrado ao visual (texto sobreposto)

---

## Checklist de Fotos para o Cliente

```
FOTOS OBRIGATÓRIAS (enviar pelo WhatsApp em boa qualidade):
[ ] 3x Mourão instalado no campo (perspectiva diagonal, mostrando continuidade da cerca)
[ ] 2x Produto na fábrica (pilha de mourões, mostrar quantidade/escala)
[ ] 2x Comparação visual (madeira velha/podre ao lado do concreto novo)
[ ] 1x Entrega sendo feita (caminhão, produto sendo descarregado)
[ ] 1x Equipe ou dono (rosto humano aumenta CTR)
[ ] 1x Laudo técnico ou certificado (prova de qualidade)

BÔNUS (se tiver):
[ ] Vídeo 30s do mourão sendo instalado
[ ] Depoimento em vídeo de cliente satisfeito (ouro puro)
```

---

## Estrutura de Templates

```
Template 1 — Feed Problema/Solução:
┌─────────────────────┐
│  FOTO: Cerca nova   │
│  em campo aberto    │
│                     │
│ "Mourão que dura    │
│  50 anos."          │
│                     │
│ [Logo Concrenor]    │
└─────────────────────┘

Template 2 — Feed Comparativo:
┌──────────┬──────────┐
│ Madeira  │ Concreto │
│ 5 anos   │ 50 anos  │
│ R$8k/ano │ R$400/ano│
└──────────┴──────────┘

Template 3 — Stories com Hook:
┌─────────────────────┐
│                     │
│  "Você gasta        │
│   R$ 8.000/ano      │
│   com mourão?"      │
│                     │
│  [Deslize p/ saber  │
│   como parar]       │
└─────────────────────┘
```

---

## Tarefas Técnicas

- [x] Criar `docs/playbooks/briefing-criativos.md` com checklist de fotos
- [x] Criar estrutura de pastas `assets/concrenor/`
- [ ] Criar 3 templates no Canva (link compartilhável) — tarefa humana
- [ ] Produzir criativos da Concrenor assim que fotos chegarem — aguardando F01-F06
- [x] Criar pasta `assets/concrenor/aprovados/` com criativos finais

---

## Definition of Done

- [x] Briefing visual documentado (`docs/playbooks/briefing-criativos.md`)
- [x] Checklist de fotos gerado (`config/checklist-fotos-concrenor.json`)
- [ ] Templates criados no Canva — tarefa humana (aguardando fotos)
- [x] Processo documentado: como produzir criativo em 48h
- [x] Story atualizada

---

*Story EP4-S4 — Escalando Premoldados — 2026-03-05*
