# Story EP1-S1 — Landing Page da Escalando Premoldados
**Epic:** EP1 — Presença Digital Base
**Prioridade:** P0
**Responsável:** @dev
**Status:** Done
**Estimativa:** 1 sprint

---

## Contexto

A Escalando Premoldados precisa de uma landing page própria para captar leads de fábricas de pré-moldados interessadas em contratar os serviços. É o principal canal de aquisição da agência — sem ela, o funil não existe.

O posicionamento é claro: não é agência criativa, é estrutura de crescimento. A LP deve comunicar isso com o tom filosófico/brutal descrito no PRD.

---

## User Story

**Como** dono de fábrica de pré-moldados que está cansado de depender de indicação,
**quero** acessar uma página da Escalando Premoldados que entenda meu problema,
**para que** eu possa solicitar um diagnóstico gratuito e entender se faz sentido contratar.

---

## Acceptance Criteria

### Estrutura da página (seções obrigatórias)

- [ ] **Hero** — Headline impactante alinhada ao posicionamento ("A estrutura que coloca pré-moldado no mercado"), subheadline com tese de vulnerabilidade, CTA principal ("Quero meu diagnóstico")
- [ ] **Problema** — Seção que articula a vulnerabilidade estrutural (dependência de indicação, oscilação de faturamento, guerra de preço) — sem oferecer solução ainda
- [ ] **Quem somos** — Jon Godeiro como diferencial: Levert Premoldados + Concrenor + Escalando. Tom: "A autoridade nasce da operação, não da teoria"
- [ ] **Planos** — Cards dos 3 planos (Starter R$997, Growth R$1.497, Pro R$2.500) com entregáveis principais e verba inclusa
- [ ] **Como funciona** — Processo simplificado: Diagnóstico → Proposta → Kickoff → Operação
- [ ] **Prova social** — Placeholder para cases futuros (1 case real assim que disponível)
- [ ] **CTA final** — Formulário de diagnóstico com campos: Nome, Empresa, Cidade, Produto principal, WhatsApp

### Formulário de diagnóstico

- [ ] Campos: Nome completo, Nome da empresa, Cidade/Estado, Produto principal (select: cerca/mourão, laje/viga, bloco/muro, outro), WhatsApp, Como nos encontrou
- [ ] Confirmação após envio com mensagem de prazo de retorno (até 24h úteis)
- [ ] Notificação interna ao enviar (webhook ou email)

### Técnico

- [ ] Responsivo (mobile-first — dono de fábrica acessa pelo celular)
- [ ] Tempo de carregamento < 3s
- [ ] SEO básico: title, meta description, OG tags
- [ ] Google Analytics / Pixel Meta instalado
- [ ] URL definida (escalando.co/premoldados ou subdomínio)

### Tom e estilo

- [ ] Linguagem do setor: faturamento, pedido, portão, licitação — nunca "engajamento" ou "curtida"
- [ ] Sem stock photos — usar fotos reais de obras/fábricas (cliente envia)
- [ ] Paleta e identidade visual da Escalando aplicada

---

## Tarefas Técnicas

- [x] Definir tecnologia (HTML estático — `lp/index.html`)
- [x] Escrever copy de cada seção (tom: direto, filosófico, brutal)
- [x] Criar wireframe → aprovação → desenvolvimento (LP HTML completa criada)
- [x] Integrar formulário (nativo com fetch para webhook configurável)
- [ ] Configurar notificação de lead (webhook URL em `CONFIG.webhookUrl` no script)
- [ ] Deploy e teste em dispositivos
- [ ] Configurar analytics (placeholders GA4 e Meta Pixel prontos — descomentar e preencher IDs)

---

## Dependências

- Identidade visual da Escalando Premoldados (logo, paleta, tipografia)
- Fotos reais de obra/produto para hero e seções (ou placeholders aprovados)
- Definição da URL/hospedagem

---

## Definition of Done

- [ ] LP publicada em URL definitiva
- [ ] Formulário enviando e notificando corretamente
- [ ] Testada em mobile (iOS e Android) e desktop
- [ ] Analytics instalado e registrando visitas
- [ ] Aprovada pelo fundador

---

*Story EP1-S1 — Escalando Premoldados — 2026-03-04*
