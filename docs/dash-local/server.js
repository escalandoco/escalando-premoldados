#!/usr/bin/env node
/**
 * ESCALANDO PREMOLDADOS — Dashboard Local v2
 * npm run dash → http://localhost:3030
 */

import http     from 'http';
import fs       from 'fs';
import path     from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const ROOT       = path.join(__dirname, '../..');
const QUEUE_FILE = path.join(ROOT, 'data/job-queue.json');
const PORT          = process.env.DASH_PORT ? parseInt(process.env.DASH_PORT) : 3030;
const DASH_USER     = process.env.DASH_USER     || '';
const DASH_PASS     = process.env.DASH_PASS     || '';
const WORKER_SECRET = process.env.WORKER_SECRET || '';

// ── AGENTS ──────────────────────────────────────────────────
const AGENTS = [
  { id: 'dev',              name: 'Dex',    role: 'Developer',       color: '#58A6FF', initials: 'DX', executorType: 'Agente',   scope: 'Implementação de código',  desc: 'Escreve os scripts Node.js (gerar-lp, deploy, monitorar-ads), o template da landing page e toda a automação do sistema' },
  { id: 'qa',               name: 'Quinn',  role: 'QA Engineer',     color: '#3FB950', initials: 'QN', executorType: 'Agente',   scope: 'Testes e qualidade',        desc: 'Testa os scripts, valida entregáveis das stories e garante que nada quebra antes do deploy' },
  { id: 'architect',        name: 'Aria',   role: 'Architect',       color: '#D2A8FF', initials: 'AR', executorType: 'Agente',   scope: 'Arquitetura e design',      desc: 'Define a arquitetura do sistema: fluxo de scripts, estrutura de configs JSON e estratégia de integrações' },
  { id: 'pm',               name: 'Morgan', role: 'Product Manager', color: '#FFA657', initials: 'MG', executorType: 'Agente',   scope: 'Product Management',        desc: 'Gerencia roadmap, define prioridades dos epics e garante que o projeto avança conforme planejado' },
  { id: 'po',               name: 'Pax',    role: 'Product Owner',   color: '#FF7B72', initials: 'PX', executorType: 'Agente',   scope: 'Stories e epics',           desc: 'Define stories, acceptance criteria e backlog — decide o que entra em cada sprint e em que ordem' },
  { id: 'sm',               name: 'River',  role: 'Scrum Master',    color: '#79C0FF', initials: 'RV', executorType: 'Agente',   scope: 'Processos e sprints',       desc: 'Facilita os sprints, remove blockers, atualiza checkboxes das stories e mantém o processo funcionando' },
  { id: 'analyst',          name: 'Alex',   role: 'Analyst',         color: '#A5D6FF', initials: 'AX', executorType: 'Analyst',  scope: 'Pesquisa e análise',        desc: 'Pesquisa keywords de SEO local, analisa mercado de pré-moldados e documenta estratégia de conteúdo e anúncios' },
  { id: 'data-engineer',    name: 'Dara',   role: 'Data Engineer',   color: '#56D364', initials: 'DR', executorType: 'Analyst',  scope: 'Database e dados',          desc: 'Estrutura o Google Sheets de CRM, define schemas de dados de leads, integrações com Apps Script e Google Drive' },
  { id: 'ux-design-expert', name: 'Uma',    role: 'UX Designer',     color: '#FF9BDD', initials: 'UM', executorType: 'Analyst',  scope: 'UX/UI Design',              desc: 'Cuida do design da landing page, experiência do usuário, hierarquia visual e identidade da marca Escalando' },
  { id: 'devops',           name: 'Gage',   role: 'DevOps',          color: '#F0883E', initials: 'GG', executorType: 'Worker',   scope: 'CI/CD e deploy',            desc: 'Faz o deploy via FTP para HostGator, configura GitHub Actions e gerencia toda a infraestrutura do projeto' },
  { id: 'traffic-manager',  name: 'Theo',   role: 'Traffic Manager', color: '#E85110', initials: 'TH', executorType: 'Agente',   scope: 'Tráfego pago',              desc: 'Estratégia e gestão de Meta Ads e Google Ads — públicos, copy, criativos, budget e otimização de CPL' },
  { id: 'jon',              name: 'Jon',    role: 'Fundador',        color: '#E85110', initials: 'JG', executorType: 'Humano',   scope: 'Decisão e operação',        desc: 'Toma decisões estratégicas, aprova entregas, executa tarefas que exigem presença humana e orienta o time' },
];

// ── PARSE STORIES ───────────────────────────────────────────
function parseStories() {
  const dir   = path.join(ROOT, 'docs/stories/active');
  const files = fs.readdirSync(dir).filter(f => /^EP\d+-S\d+/.test(f));

  return files.map(f => {
    const raw  = fs.readFileSync(path.join(dir, f), 'utf8');
    const lines = raw.split('\n');

    const title       = (lines[0] || '').replace(/^#\s*/, '').replace(/^Story\s+EP\d+-S\d+\s+[—-]\s*/i, '').trim();
    const status      = (raw.match(/\*\*Status:\*\*\s*([^\n]+)/)      || [])[1]?.trim() || 'Pending';
    const responsavel = (raw.match(/\*\*Responsável:\*\*\s*([^\n]+)/) || [])[1]?.trim() || '';
    const estimativa  = (raw.match(/\*\*Estimativa:\*\*\s*([^\n]+)/)  || [])[1]?.trim() || '';
    const date        = (raw.match(/(\d{4}-\d{2}-\d{2})$/)            || [])[1] || '';
    const context     = (raw.match(/## Contexto\n\n([^\n]+)/)         || [])[1]?.trim() || '';

    // Tarefas Técnicas section
    const taskSection  = (raw.match(/## Tarefas Técnicas\n([\s\S]*?)(?=##|$)/) || [])[1] || '';
    const tasksDone    = (taskSection.match(/- \[x\]/gi) || []).length;
    const tasksTotal   = (taskSection.match(/- \[.\]/gi) || []).length;
    const taskLines    = taskSection.split('\n')
      .filter(l => /- \[.\]/.test(l))
      .map(l => ({ done: /- \[x\]/i.test(l), text: l.replace(/- \[.\]\s*/, '').trim() }));

    // DoD section
    const dodSection = (raw.match(/## Definition of Done\n([\s\S]*?)(?=##|$)/) || [])[1] || '';
    const dodDone    = (dodSection.match(/- \[x\]/gi) || []).length;
    const dodTotal   = (dodSection.match(/- \[.\]/gi) || []).length;

    const m         = f.match(/^(EP(\d+))-(S(\d+))/);
    const epicId    = m ? m[1] : '';
    const storyId   = m ? m[3] : '';
    const epicNum   = m ? parseInt(m[2]) : 0;
    const storyNum  = m ? parseInt(m[4]) : 0;

    return {
      file: f, epicId, storyId, epicNum, storyNum,
      title, status, responsavel, estimativa, date, context,
      tasksDone, tasksTotal, taskLines,
      dodDone, dodTotal,
    };
  }).sort((a, b) => a.epicNum - b.epicNum || a.storyNum - b.storyNum);
}

// ── EPICS WITH STORIES ──────────────────────────────────────
const EPIC_DEFS = [
  { id: 'EP1', name: 'Fundação',             total: 2,  done: 2,  locked: 0, status: 'done'     },
  { id: 'EP2', name: 'CRM & Leads',          total: 5,  done: 5,  locked: 0, status: 'done'     },
  { id: 'EP3', name: 'Landing Pages',        total: 12, done: 10, locked: 2, status: 'progress' },
  { id: 'EP4', name: 'Anúncios Meta',        total: 11, done: 11, locked: 0, status: 'done'     },
  { id: 'EP5', name: 'Escala Multi-cliente', total: 4,  done: 0,  locked: 4, status: 'locked'   },
];

function buildEpicsWithStories(stories) {
  return EPIC_DEFS.map(ep => ({
    ...ep,
    stories: stories.filter(s => s.epicId === ep.id),
  }));
}

// ── AGENTS WITH STORIES ─────────────────────────────────────
function buildAgents(stories) {
  return AGENTS.map(agent => {
    const handle       = '@' + agent.id;
    const agentStories = stories
      .filter(s => s.responsavel.includes(handle))
      .sort((a, b) => b.epicNum - a.epicNum || b.storyNum - a.storyNum);

    const done     = agentStories.filter(s => s.status.toLowerCase().startsWith('done'));
    const lastDone = done[0] || agentStories[0] || null;

    return {
      ...agent,
      storiesTotal: agentStories.length,
      storiesDone:  done.length,
      stories:      agentStories.map(s => ({
        id:     `${s.epicId}-${s.storyId}`,
        title:  s.title.split('—').pop()?.trim() || s.title,
        status: s.status,
        epicId: s.epicId,
      })),
      lastStory: lastDone ? {
        id:     `${lastDone.epicId}-${lastDone.storyId}`,
        title:  lastDone.title.split('—').pop()?.trim() || lastDone.title,
        status: lastDone.status,
      } : null,
    };
  });
}

// ── PARSE ENV ───────────────────────────────────────────────
function parseEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return {};
  const env = {};
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  });
  return env;
}

// ── INTEGRATIONS ─────────────────────────────────────────────
function buildIntegrations(env) {
  let lp = {};
  try { lp = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/lp-concrenor.json'), 'utf8')); } catch {}
  const ok   = (v, bad = '') => !!(v && v !== bad && v.length > 3);
  const mask = v => v ? '••••' + v.slice(-4) : '—';
  return [
    // ── Nossas ferramentas (agência) ──
    { group: 'agency', name: 'Anthropic / Claude', icon: '🤖', connected: ok(env.ANTHROPIC_API_KEY),             detail: env.ANTHROPIC_API_KEY ? 'Conectado' : '—',   action: 'API Key da Anthropic — usada para gerar copy e LPs',   edit: { source:'env', key:'ANTHROPIC_API_KEY',     label:'Anthropic API Key',    placeholder:'sk-ant-...' } },
    { group: 'agency', name: 'ClickUp',             icon: '✅', connected: ok(env.CLICKUP_API_KEY),              detail: env.CLICKUP_API_KEY ? 'Conectado' : '—',     action: 'API Key do ClickUp — gestão de tasks e onboarding',    edit: { source:'env', key:'CLICKUP_API_KEY',       label:'ClickUp API Key',      placeholder:'pk_...' } },
    { group: 'agency', name: 'Vercel (Webhooks)',   icon: '▲',  connected: ok(env.VERCEL_TOKEN),                  detail: env.VERCEL_TOKEN ? 'Conectado' : '—',        action: 'Token do Vercel — hospeda webhooks da agência',        edit: { source:'env', key:'VERCEL_TOKEN',          label:'Vercel Token',         placeholder:'vcp_...' } },
    { group: 'agency', name: 'FTP / HostGator',     icon: '🌐', connected: ok(env.FTP_HOST) && ok(env.FTP_USER), detail: env.FTP_HOST || '—',                         action: 'Host, usuário e senha — deploy de LPs no servidor',    edit: { source:'ftp', key:'FTP',                   label:'FTP',                  placeholder:'' } },
    // ── Por cliente (Concrenor) ──
    { group: 'client', name: 'Meta Pixel',          icon: '📘', connected: ok(lp.pixel_meta),                    detail: lp.pixel_meta || '—',                        action: 'Pixel ID do cliente no Meta Business',                 edit: { source:'lp',  key:'pixel_meta',            label:'Pixel ID',             placeholder:'ex: 1234567890123456' } },
    { group: 'client', name: 'Conversions API',     icon: '🔗', connected: ok(env.META_CAPI_TOKEN),              detail: env.META_CAPI_TOKEN ? mask(env.META_CAPI_TOKEN) : '—', action: 'Token CAPI do cliente (Meta server-side)',    edit: { source:'env', key:'META_CAPI_TOKEN',       label:'Token CAPI',           placeholder:'EAAxxxxxx...' } },
    { group: 'client', name: 'Google Analytics',    icon: '📊', connected: ok(lp.ga4),                           detail: lp.ga4 || '—',                               action: 'Measurement ID do GA4 do cliente',                     edit: { source:'lp',  key:'ga4',                   label:'GA4 Measurement ID',   placeholder:'G-XXXXXXXXXX' } },
    { group: 'client', name: 'WhatsApp / Tintim',   icon: '💬', connected: ok(lp.whatsapp, '5579999999999'),     detail: lp.whatsapp || '—',                          action: 'Número WPP do cliente com DDI+DDD',                    edit: { source:'lp',  key:'whatsapp',              label:'Número WPP (DDI+DDD)', placeholder:'5579912345678' } },
    { group: 'client', name: 'Sheets CRM',          icon: '📋', connected: ok(env.GOOGLE_WORKSPACE_URL),         detail: env.GOOGLE_WORKSPACE_URL ? 'URL OK' : '—',   action: 'URL do Apps Script Web App do cliente',                edit: { source:'env', key:'GOOGLE_WORKSPACE_URL',  label:'URL do Web App',       placeholder:'https://script.google.com/macros/s/...' } },
    { group: 'client', name: 'Google Drive PDF',    icon: '📁', connected: ok(env.DRIVE_FOLDER_ID),              detail: env.DRIVE_FOLDER_ID || '—',                  action: 'ID da pasta no Drive para relatórios do cliente',      edit: { source:'env', key:'DRIVE_FOLDER_ID',       label:'Drive Folder ID',      placeholder:'1ABC...XYZ' } },
  ];
}

// ── SAVE INTEGRATION ─────────────────────────────────────────
function saveIntegration(source, key, value) {
  if (source === 'lp') {
    const lpPath = path.join(ROOT, 'config/lp-concrenor.json');
    const lp = JSON.parse(fs.readFileSync(lpPath, 'utf8'));
    lp[key] = value;
    fs.writeFileSync(lpPath, JSON.stringify(lp, null, 2));
    return { ok: true, msg: `${key} salvo em config/lp-concrenor.json` };
  }

  if (source === 'env') {
    const envPath = path.join(ROOT, '.env');
    let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content += `\n${key}=${value}`;
    }
    fs.writeFileSync(envPath, content);
    return { ok: true, msg: `${key} salvo no .env` };
  }

  if (source === 'ftp') {
    // value is JSON: { host, user, pass }
    const envPath = path.join(ROOT, '.env');
    let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    const parsed = JSON.parse(value);
    for (const [k, v] of Object.entries(parsed)) {
      const regex = new RegExp(`^${k}=.*$`, 'm');
      if (regex.test(content)) content = content.replace(regex, `${k}=${v}`);
      else content += `\n${k}=${v}`;
    }
    fs.writeFileSync(envPath, content);
    return { ok: true, msg: 'Credenciais FTP salvas no .env' };
  }

  return { ok: false, msg: 'Source desconhecida' };
}

// ── PENDING TASKS ────────────────────────────────────────────
const PENDING_TASKS = [
  { priority: 'high',   story: 'EP2-S1', task: 'Instalar Apps Script CRM na planilha — rodar setupCRM()' },
  { priority: 'high',   story: 'EP3-S9', task: 'Deploy LP Concrenor — node scripts/deploy-lp.js --cliente=concrenor' },
  { priority: 'high',   story: 'EP2-S3', task: 'Obter número WhatsApp real da Concrenor e mapear no Tintim' },
  { priority: 'high',   story: 'EP4',    task: 'Subir primeira campanha Meta Ads para Concrenor' },
  { priority: 'medium', story: 'EP2-S4', task: 'Criar pasta Google Drive e configurar DRIVE_FOLDER_ID' },
  { priority: 'medium', story: 'EP3-S8', task: 'Adicionar colunas UTM na planilha Google Sheets' },
  { priority: 'medium', story: 'LP',     task: 'Preencher pixel_meta e ga4 em config/lp-concrenor.json' },
  { priority: 'low',    story: 'EP3-S12',task: 'Verificar concrenor.escalando.co no Google Search Console' },
  { priority: 'low',    story: 'EP3-S12',task: 'Criar/verificar perfil GMB da Concrenor' },
];

// ── COMMANDS ─────────────────────────────────────────────────
const COMMANDS = [
  { label: 'Gerar Copy',     safe: false, cmd: 'node scripts/gerar-copy.js --briefing=config/briefing-concrenor.json',                      desc: 'Gera copy com Claude Opus 4.6' },
  { label: 'Gerar LP',       safe: true,  cmd: 'node scripts/gerar-lp.js --empresa=Concrenor --config=config/lp-concrenor.json --no-upload', desc: 'Renderiza LP localmente em dist/' },
  { label: 'Deploy LP',      safe: false, cmd: 'node scripts/deploy-lp.js --cliente=concrenor',                                             desc: 'Sobe LP para concrenor.escalando.co' },
  { label: 'Monitorar Ads',  safe: true,  cmd: 'node scripts/monitorar-ads.js --cliente=concrenor',                                         desc: 'Verifica CPL/CTR vs limites' },
  { label: 'Relatório Ads',  safe: true,  cmd: 'node scripts/relatorio-ads.js --cliente=concrenor',                                         desc: 'Gera relatório de performance HTML' },
  { label: 'Copy de Ads',    safe: false, cmd: 'node scripts/gerar-copy-ads.js --briefing=config/briefing-concrenor.json',                  desc: 'Gera copy de anúncios Meta' },
  { label: 'Deploy Status',  safe: false, cmd: 'node scripts/deploy-lp.js --cliente=concrenor --dry-run',                                   desc: 'Dry run do deploy' },
];

// ── WORKERS 24/7 CONFIG ──────────────────────────────────────
const WORKERS = [
  {
    id: 'monitorar-ads',
    name: 'Monitorar Ads',
    desc: 'Verifica CPL/CTR/CPM vs limites e cria alerta no ClickUp se fora do padrão',
    icon: '📊',
    cron: '0 11 * * *',
    cronHuman: 'Diário · 08h BRT',
    logFile: '/var/log/escalando-monitorar.log',
    script: 'monitorar-ads',
    cliente: 'concrenor',
  },
  {
    id: 'relatorio-ads',
    name: 'Relatório Ads',
    desc: 'Gera relatório de performance HTML dos anúncios e notifica no ClickUp',
    icon: '📈',
    cron: '0 11 1,15 * *',
    cronHuman: 'Dias 1 e 15 · 08h BRT',
    logFile: '/var/log/escalando-relatorio.log',
    script: 'relatorio-ads',
    cliente: 'concrenor',
  },
  {
    id: 'exportar-leads',
    name: 'Exportar Leads Meta',
    desc: 'Exporta lista de leads do Google Sheets para Custom Audiences do Meta Ads',
    icon: '📤',
    cron: '0 11 * * 1',
    cronHuman: 'Toda 2ª feira · 08h BRT',
    logFile: '/var/log/escalando-leads.log',
    script: 'exportar-leads-meta',
    cliente: 'concrenor',
  },
  {
    id: 'verificar-lp',
    name: 'Verificar LP',
    desc: 'Testa se a landing page está online (HTTP 200) e alerta se cair',
    icon: '🌐',
    cron: '0 */4 * * *',
    cronHuman: 'A cada 4 horas',
    logFile: '/var/log/escalando-verificar-lp.log',
    script: 'verificar-lp',
    cliente: 'concrenor',
  },
];

// ── PARSE WORKER LOGS ─────────────────────────────────────────
function parseWorkerLog(logFile, limit = 20) {
  try {
    if (!fs.existsSync(logFile)) return [];
    const lines = fs.readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean);
    const runs = [];
    let current = null;
    for (const line of lines) {
      const mStart = line.match(/\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] Iniciando (.+)/);
      const mEnd   = line.match(/\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] Concluído .+\(code (\d+)\)/);
      if (mStart) {
        current = { startedAt: mStart[1], script: mStart[2], exitCode: null, endedAt: null, log: [line] };
      } else if (mEnd && current) {
        current.endedAt  = mEnd[1];
        current.exitCode = parseInt(mEnd[2]);
        current.log.push(line);
        current.ok = current.exitCode === 0;
        runs.push(current);
        current = null;
      } else if (current) {
        current.log.push(line);
      }
    }
    if (current) { current.exitCode = null; current.ok = null; runs.push(current); }
    return runs.slice(-limit).reverse();
  } catch { return []; }
}

// ── CALC NEXT CRON RUN ────────────────────────────────────────
function nextCronRun(cronExpr) {
  const [min, hour, dom, month, dow] = cronExpr.split(' ');
  const now = new Date();
  const next = new Date(now);
  next.setSeconds(0);
  next.setMilliseconds(0);

  // Support for common patterns only (*/N and lists)
  const parseField = (f, max, min0 = 0) => {
    if (f === '*') return null; // any
    if (f.startsWith('*/')) {
      const step = parseInt(f.slice(2));
      return Array.from({ length: Math.floor((max - min0) / step) + 1 }, (_, i) => min0 + i * step);
    }
    return f.split(',').map(Number);
  };

  const mins   = parseField(min, 59, 0);
  const hours  = parseField(hour, 23, 0);
  const days   = parseField(dom, 31, 1);
  const dows   = parseField(dow, 6, 0);

  for (let i = 0; i < 60 * 24 * 31; i++) {
    next.setMinutes(next.getMinutes() + 1);
    const m = next.getMinutes();
    const h = next.getHours();
    const d = next.getDate();
    const w = next.getDay();

    const mOk  = !mins   || mins.includes(m);
    const hOk  = !hours  || hours.includes(h);
    const dOk  = !days   || days.includes(d);
    const wOk  = !dows   || dows.includes(w);

    if (mOk && hOk && dOk && wOk) return next.toISOString();
  }
  return null;
}

// ── JOB QUEUE ────────────────────────────────────────────────
function readJobQueue() {
  try {
    if (!fs.existsSync(QUEUE_FILE)) return [];
    const queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
    // Auto-expirar jobs "running" com mais de 15 min sem atualização
    const now = Date.now();
    let changed = false;
    for (const job of queue) {
      if (job.status === 'running') {
        const age = now - new Date(job.lastAttempt || job.createdAt).getTime();
        if (age > 15 * 60 * 1000) {
          job.status = 'failed';
          job.error = 'Timeout — script não respondeu em 15 minutos';
          changed = true;
        }
      }
    }
    if (changed) fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
    return queue;
  } catch { return []; }
}

function updateJob(id, updates) {
  const queue = readJobQueue();
  const idx = queue.findIndex(j => j.id === id);
  if (idx >= 0) {
    queue[idx] = { ...queue[idx], ...updates };
    fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2));
  }
}

// ── SAFE COMMAND WHITELIST ───────────────────────────────────
const SAFE_PATTERNS = [
  /^node scripts\/gerar-lp\.js.*--no-upload/,
  /^node scripts\/monitorar-ads\.js/,
  /^node scripts\/relatorio-ads\.js/,
];

// ── AUTH HELPER ──────────────────────────────────────────────
function checkAuth(req, res) {
  if (!DASH_USER || !DASH_PASS) return true;
  const authHeader = req.headers['authorization'] || '';
  const expected = 'Basic ' + Buffer.from(`${DASH_USER}:${DASH_PASS}`).toString('base64');
  if (authHeader !== expected) {
    res.writeHead(401, {
      'WWW-Authenticate': 'Basic realm="Escalando Dashboard"',
      'Content-Type': 'text/plain; charset=utf-8',
    });
    res.end('Acesso restrito. Use usuário e senha.');
    return false;
  }
  return true;
}

// ── HTTP SERVER ──────────────────────────────────────────────
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  // /api/run-worker tem autenticação própria (WORKER_SECRET) — exclui do Basic Auth
  if (req.url !== '/api/run-worker' && !checkAuth(req, res)) return;

  // ── GET /api/data ──
  if (req.method === 'GET' && req.url === '/api/data') {
    try {
      const stories = parseStories();
      const data = {
        epics:        buildEpicsWithStories(stories),
        agents:       buildAgents(stories),
        integrations: buildIntegrations(parseEnv()),
        pendingTasks: PENDING_TASKS,
        commands:     COMMANDS,
        lastUpdated:  new Date().toISOString(),
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // ── POST /api/save ──
  if (req.method === 'POST' && req.url === '/api/save') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const { source, key, value } = JSON.parse(body || '{}');
        const result = saveIntegration(source, key, value);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, msg: e.message }));
      }
    });
    return;
  }

  // ── POST /api/run ──
  if (req.method === 'POST' && req.url === '/api/run') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      const { cmd } = JSON.parse(body || '{}');
      if (!cmd || !SAFE_PATTERNS.some(p => p.test(cmd))) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Comando não permitido via dashboard.' }));
        return;
      }
      exec(cmd, { cwd: ROOT, timeout: 60000 }, (err, stdout, stderr) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ stdout: stdout || '', stderr: stderr || '', code: err?.code ?? 0 }));
      });
    });
    return;
  }

  // ── POST /api/run-worker (chamado pelo Vercel dispatcher) ──
  if (req.method === 'POST' && req.url === '/api/run-worker') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const { secret, script, cliente = 'concrenor' } = JSON.parse(body || '{}');

        // Auth por token secreto
        if (!WORKER_SECRET || secret !== WORKER_SECRET) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'unauthorized' }));
          return;
        }

        // Whitelist de scripts permitidos
        const ALLOWED = ['monitorar-ads','relatorio-ads','exportar-leads-meta','verificar-lp','gerar-lp','deploy-lp','gerar-copy-ads','gerar-copy','analisar-concorrentes'];
        if (!ALLOWED.includes(script)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Script não permitido: ${script}` }));
          return;
        }

        const cmd = `node scripts/${script}.js --cliente=${cliente}`;
        const ts  = new Date().toISOString().replace('T',' ').slice(0,19);
        console.log(`[${ts}] run-worker: ${cmd}`);

        exec(cmd, { cwd: ROOT, timeout: 120000, env: { ...process.env } }, (err, stdout, stderr) => {
          const output = (stdout || '') + (stderr ? `\nSTDERR: ${stderr}` : '');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            ok:       !err,
            script,
            cliente,
            exitCode: err?.code ?? 0,
            output:   output.slice(0, 3000),
          }));
        });
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // ── GET /api/job-queue ──
  if (req.method === 'GET' && req.url === '/api/job-queue') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(readJobQueue()));
    return;
  }

  // ── POST /api/retry-job ──
  if (req.method === 'POST' && req.url === '/api/retry-job') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const { id } = JSON.parse(body || '{}');
        const queue = readJobQueue();
        const job = queue.find(j => j.id === id);
        if (!job) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Job não encontrado' }));
          return;
        }

        const attempts = (job.attempts || 0) + 1;
        updateJob(id, { status: 'running', lastAttempt: new Date().toISOString(), attempts, error: null });

        // Responde imediatamente e roda em background
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, id, script: job.script, cliente: job.cliente, message: 'Executando...' }));

        const cmd = `node scripts/${job.script}.js --cliente=${job.cliente}`;
        const ts  = new Date().toISOString().replace('T',' ').slice(0,19);
        console.log(`[${ts}] retry-job: ${cmd}`);

        exec(cmd, { cwd: ROOT, timeout: 180000, env: { ...process.env } }, (err, stdout, stderr) => {
          const status = err ? 'failed' : 'done';
          const error  = err ? ((stderr || err.message || '').slice(0, 500)) : null;
          updateJob(id, { status, error, doneAt: new Date().toISOString() });
          console.log(`[retry-job] ${job.script} → ${status}`);
        });
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // ── GET /api/workers ──
  if (req.method === 'GET' && req.url === '/api/workers') {
    try {
      const data = WORKERS.map(w => {
        const runs = parseWorkerLog(w.logFile, 30);
        const last = runs[0] || null;
        return {
          id:        w.id,
          name:      w.name,
          desc:      w.desc,
          icon:      w.icon,
          cronHuman: w.cronHuman,
          nextRun:   nextCronRun(w.cron),
          lastRun:   last ? { startedAt: last.startedAt, endedAt: last.endedAt, ok: last.ok, exitCode: last.exitCode } : null,
          history:   runs.slice(0, 10).map(r => ({
            startedAt: r.startedAt,
            endedAt:   r.endedAt,
            ok:        r.ok,
            exitCode:  r.exitCode,
            snippet:   r.log.slice(-3).join('\n'),
          })),
        };
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // ── GET /prd → prd.html ──
  if (req.method === 'GET' && req.url === '/prd') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(path.join(__dirname, 'prd.html'), 'utf8'));
    return;
  }

  // ── GET / → index.html ──
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8'));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Escalando Premoldados — Dashboard v2`);
  console.log(`  http://0.0.0.0:${PORT}`);
  if (DASH_USER) console.log(`  Auth: ${DASH_USER} / ****`);
  console.log('  Ctrl+C para encerrar\n');
});
