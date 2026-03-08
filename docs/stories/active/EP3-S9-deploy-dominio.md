# Story EP3-S7 — Deploy no Domínio do Cliente
**Epic:** EP3 — Sistema de Landing Pages
**Prioridade:** P2
**Responsável:** @devops
**Status:** Done
**Estimativa:** 1 sprint

---

## Contexto

Após aprovação, a LP precisa ir ao ar no domínio/subdomínio do cliente. O processo atual é manual via FTP. Precisamos de um deploy automatizado e documentado.

---

## User Story

**Como** devops da Escalando Premoldados,
**quero** um processo automatizado de deploy no domínio do cliente,
**para que** o go-live seja feito em minutos, não horas.

---

## Acceptance Criteria

- [ ] Script de deploy via FTP ou rsync para o servidor do cliente
- [ ] Suporte a subdomínio próprio do cliente (ex: lps.{cliente}.com.br)
- [ ] Opção de deploy no subdomínio Escalando (ex: {cliente}.escalando.co)
- [ ] HTTPS configurado (Let's Encrypt ou certificado do cliente)
- [ ] Redirecionamentos de UTM preservados após deploy
- [ ] Processo documentado no playbook

---

## Tarefas Técnicas

- [x] Script de deploy FTP (`scripts/deploy-lp.js` — Node.js via Python ftplib)
- [x] Variáveis de configuração por cliente (`config/deploy-clients.json` — no .gitignore)
- [ ] Workflow GitHub Actions para deploy automatizado — backlog (baixa prioridade)
- [x] Verificação pós-deploy (smoke test documentado no playbook)
- [x] Documentar credenciais de acesso por cliente (`config/deploy-clients.json`)

---

## Definition of Done

- [ ] Deploy de LP em menos de 5 minutos após aprovação
- [ ] LP acessível via HTTPS no domínio configurado
- [ ] Processo documentado e replicável

---

*Story EP3-S7 — Escalando Premoldados — 2026-03-05*
