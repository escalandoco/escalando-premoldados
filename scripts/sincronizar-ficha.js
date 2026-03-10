#!/usr/bin/env node
/**
 * ESCALANDO PREMOLDADOS — Sincronizador Ficha do Cliente -> Config JSON
 *
 * Le a Ficha do Cliente (ClickUp DADOS) e sincroniza com config JSON local.
 * A Ficha eh a fonte de verdade; o config JSON eh derivado.
 *
 * Uso:
 *   node scripts/sincronizar-ficha.js --cliente=Concrenor
 *   node scripts/sincronizar-ficha.js --cliente=Concrenor --campanha="Mourao Torneado"
 *   node scripts/sincronizar-ficha.js --cliente=Concrenor --dry-run
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { lerFicha } from './ficha-cliente.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.join(__dirname, '..');

// ---- Env ----
const CLICKUP_API_KEY = process.env.CLICKUP_API_KEY || 'pk_84613660_MVXFF2FG90QSK6YN1RLF1LBA7C4NXK7J';
const SPACE_CLIENTES  = process.env.CLICKUP_SPACE_ID || '901313553858';
const BASE_URL        = 'https://api.clickup.com/api/v2';

// ============================================================
// SLUG helper
// ============================================================
function toSlug(str) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// ============================================================
// CLICKUP HELPER
// ============================================================
async function cu(method, urlPath, body) {
  const res = await fetch(`${BASE_URL}${urlPath}`, {
    method: method.toUpperCase(),
    headers: { Authorization: CLICKUP_API_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`ClickUp API [${method.toUpperCase()} ${urlPath}]: ${JSON.stringify(json)}`);
  return json;
}

// ============================================================
// MAPEAMENTO Ficha -> Config JSON (por prioridade)
// ============================================================
const MAPA_CAMPOS = {
  // Prioridade 1: Onboarding
  whatsapp:    { configKey: 'whatsapp',    prioridade: 1 },
  responsavel: { configKey: 'responsavel', prioridade: 1 },
  cnpj:        { configKey: 'cnpj',        prioridade: 1 },
  cidade:      { configKey: 'cidade',      prioridade: 1 },
  estado:      { configKey: 'estado',      prioridade: 1 },
  plano:       { configKey: 'plano',       prioridade: 1 },
  valor:       { configKey: 'valor_mensal',prioridade: 1 },

  // Prioridade 2: Trafego
  verbaMensal:  { configKey: 'verba_mensal_ads', prioridade: 2 },
  acessoMeta:   { configKey: 'acesso_meta',      prioridade: 2 },
  acessoGoogle: { configKey: 'acesso_google',    prioridade: 2 },

  // Prioridade 3: LP
  produtos:     { configKey: 'produtos_texto', prioridade: 3 },
  diferenciais: { configKey: 'diferenciais_texto', prioridade: 3 },

  // Prioridade 5: GMB
  areaAtuacao:  { configKey: 'area_atuacao', prioridade: 5 },
  telefone:     { configKey: 'telefone',     prioridade: 5 },
};

// ============================================================
// SINCRONIZAR — funcao principal (exportavel)
// ============================================================
/**
 * Sincroniza a Ficha do Cliente com o config JSON local.
 *
 * @param {string} cliente   - Nome da empresa (ex: "Concrenor")
 * @param {Object} opts      - Opcoes
 * @param {string} opts.campanha - Nome da campanha (opcional)
 * @param {boolean} opts.dryRun  - Se true, nao escreve no disco
 * @returns {Promise<Object>} Relatorio da sincronizacao
 */
export async function sincronizarFicha(cliente, opts = {}) {
  const { campanha = '', dryRun = false } = opts;
  const slug = toSlug(cliente);
  const configPath = path.join(ROOT, 'config', `lp-${slug}.json`);

  const relatorio = {
    cliente,
    configPath,
    fichaLida: false,
    configExistia: false,
    camposSincronizados: [],
    camposNovos: [],
    checklistMarcados: [],
    erros: [],
  };

  // 1. Le Ficha do ClickUp
  let ficha;
  try {
    ficha = await lerFicha(cliente);
    relatorio.fichaLida = true;
  } catch (err) {
    relatorio.erros.push(`Erro ao ler Ficha: ${err.message}`);
    return relatorio;
  }

  // 2. Le config JSON existente (se houver)
  let config = {};
  if (fs.existsSync(configPath)) {
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      relatorio.configExistia = true;
    } catch (err) {
      relatorio.erros.push(`Erro ao ler config JSON: ${err.message}`);
      config = {};
    }
  }

  // 3. Merge: Ficha -> Config (Ficha tem prioridade)
  // Para campos que ja existem no config com valor real, a Ficha sobrescreve
  // Para campos do config que NAO vem da Ficha, preserva
  const configAtualizado = { ...config };

  // Empresa sempre vem da Ficha
  if (ficha.empresa) configAtualizado.empresa = ficha.empresa;

  // WhatsApp
  if (ficha.whatsapp) {
    const whatsappAntes = configAtualizado.whatsapp;
    configAtualizado.whatsapp = ficha.whatsapp;
    if (whatsappAntes !== ficha.whatsapp) {
      relatorio.camposSincronizados.push('whatsapp');
    }
    // Atualiza whatsapp_msg se nao existir
    if (!configAtualizado.whatsapp_msg) {
      configAtualizado.whatsapp_msg = `Ola ${ficha.empresa}! Vim pelo site e gostaria de um orcamento.`;
    }
  }

  // Telefone (pode estar na ficha como whatsapp formatado)
  if (ficha.whatsapp && !configAtualizado.telefone) {
    // Formata whatsapp como telefone visual
    const num = ficha.whatsapp.replace(/\D/g, '');
    if (num.length >= 10) {
      const ddd = num.slice(-10, -8);
      const p1  = num.slice(-8, -4);
      const p2  = num.slice(-4);
      configAtualizado.telefone = `(${ddd}) ${p1}-${p2}`;
      relatorio.camposNovos.push('telefone');
    }
  }

  // Cidade
  if (ficha.cidade) {
    const cidadeFormatada = ficha.estado
      ? `${ficha.cidade} — ${ficha.estado}`
      : ficha.cidade;
    if (configAtualizado.cidade !== cidadeFormatada) {
      configAtualizado.cidade = cidadeFormatada;
      relatorio.camposSincronizados.push('cidade');
    }
  }

  // Estado
  if (ficha.estado && configAtualizado.estado !== ficha.estado) {
    configAtualizado.estado = ficha.estado;
    relatorio.camposSincronizados.push('estado');
  }

  // Verba mensal ads (campo informativo no config)
  if (ficha.verbaMensal) {
    const verba = ficha.verbaMensal.replace(/[^\d.,]/g, '');
    if (verba && configAtualizado.verba_mensal_ads !== verba) {
      configAtualizado.verba_mensal_ads = verba;
      relatorio.camposSincronizados.push('verba_mensal_ads');
    }
  }

  // Area de atuacao -> regioes (se regioes nao existir ou estiver vazio)
  if (ficha.areaAtuacao && (!configAtualizado.regioes || (Array.isArray(configAtualizado.regioes) && configAtualizado.regioes.length === 0))) {
    configAtualizado.regioes = ficha.areaAtuacao.split(/[,;]/).map(r => r.trim()).filter(Boolean);
    relatorio.camposNovos.push('regioes');
  }

  // Campos simples de metadados (nao sobrescreve campos de design do config)
  const camposSimples = {
    responsavel:    'responsavel',
    cnpj:           'cnpj',
    plano:          'plano',
    areaAtuacao:    'area_atuacao',
    perfilClientes: 'perfil_clientes',
    concorrentes:   'concorrentes',
    comoVendem:     'como_vendem',
    ticketMedio:    'ticket_medio',
  };
  for (const [fichaKey, configKey] of Object.entries(camposSimples)) {
    if (ficha[fichaKey] && configAtualizado[configKey] !== ficha[fichaKey]) {
      configAtualizado[configKey] = ficha[fichaKey];
      if (config[configKey]) {
        relatorio.camposSincronizados.push(configKey);
      } else {
        relatorio.camposNovos.push(configKey);
      }
    }
  }

  // Acessos (informativos)
  if (ficha.acessoMeta)   configAtualizado.acesso_meta   = ficha.acessoMeta;
  if (ficha.acessoGoogle) configAtualizado.acesso_google  = ficha.acessoGoogle;
  if (ficha.acessoGmb)    configAtualizado.acesso_gmb     = ficha.acessoGmb;
  if (ficha.acessoSite)   configAtualizado.acesso_site    = ficha.acessoSite;

  // Completude
  configAtualizado._ficha_completo = ficha._completo;
  configAtualizado._ficha_sync     = new Date().toISOString();

  // 4. Salva config atualizado
  if (!dryRun) {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(configAtualizado, null, 2) + '\n', 'utf8');
  }

  // 5. Marca checklist items do [FASE 1] DNA do Cliente como done
  if (!dryRun) {
    try {
      const marcados = await marcarChecklistDNA(cliente, ficha);
      relatorio.checklistMarcados = marcados;
    } catch (err) {
      relatorio.erros.push(`Erro ao marcar checklist: ${err.message}`);
    }
  }

  return relatorio;
}

// ============================================================
// MARCAR CHECKLIST — marca items do [FASE 1] DNA do Cliente
// ============================================================
async function marcarChecklistDNA(cliente, ficha) {
  const marcados = [];

  try {
    // Encontra folder e lista Landing Pages
    const { folders } = await cu('get', `/space/${SPACE_CLIENTES}/folder?archived=false`);
    const folder = folders.find(f => f.name.toLowerCase() === cliente.toLowerCase());
    if (!folder) return marcados;

    const { lists } = await cu('get', `/folder/${folder.id}/list?archived=false`);
    const lpList = lists.find(l => l.name.toLowerCase() === 'landing pages');
    if (!lpList) return marcados;

    const { tasks } = await cu('get', `/list/${lpList.id}/task?archived=false`);
    const fase1 = tasks.find(t => t.name.startsWith('[FASE 1]'));
    if (!fase1) return marcados;

    // Busca task completa com checklists
    const taskFull = await cu('get', `/task/${fase1.id}?include_subtasks=false`);

    for (const checklist of (taskFull.checklists || [])) {
      for (const item of (checklist.items || [])) {
        if (item.resolved) continue; // ja marcado

        const nome = item.name.toLowerCase();
        let deveMark = false;

        // Mapeia item do checklist para campo da ficha
        if (nome.includes('whatsapp') && ficha.whatsapp) deveMark = true;
        if (nome.includes('responsavel') && ficha.responsavel) deveMark = true;
        if (nome.includes('responsável') && ficha.responsavel) deveMark = true;
        if (nome.includes('cnpj') && ficha.cnpj) deveMark = true;
        if (nome.includes('cidade') && ficha.cidade) deveMark = true;
        if (nome.includes('produtos') && ficha.produtos) deveMark = true;
        if (nome.includes('diferencia') && ficha.diferenciais) deveMark = true;
        if (nome.includes('concorrente') && ficha.concorrentes) deveMark = true;
        if (nome.includes('perfil') && ficha.perfilClientes) deveMark = true;
        if (nome.includes('area') && ficha.areaAtuacao) deveMark = true;
        if (nome.includes('área') && ficha.areaAtuacao) deveMark = true;
        if (nome.includes('verba') && ficha.verbaMensal) deveMark = true;
        if (nome.includes('acesso meta') && ficha.acessoMeta === 'coletado') deveMark = true;
        if (nome.includes('acesso google') && ficha.acessoGoogle === 'coletado') deveMark = true;
        if (nome.includes('acesso gmb') && ficha.acessoGmb === 'coletado') deveMark = true;

        if (deveMark) {
          try {
            await cu('put', `/checklist/${checklist.id}/checklist_item/${item.id}`, { resolved: true });
            marcados.push(item.name);
          } catch {
            // Falha silenciosa — nao trava o fluxo
          }
        }
      }
    }
  } catch {
    // Falha silenciosa — checklist eh bonus, nao bloqueia
  }

  return marcados;
}

// ============================================================
// CLI standalone
// ============================================================
const __filename = fileURLToPath(import.meta.url);
const IS_CLI = process.argv[1] === __filename;

if (IS_CLI) {
  const args = {};
  for (const a of process.argv.slice(2)) {
    if (a.startsWith('--no-')) {
      args[a.slice(5)] = false;
    } else {
      const [k, ...v] = a.replace(/^--/, '').split('=');
      args[k] = v.join('=') || true;
    }
  }

  const cliente  = args.cliente;
  const campanha = args.campanha || '';
  const dryRun   = args['dry-run'] === true;

  if (!cliente) {
    console.error('Uso: node scripts/sincronizar-ficha.js --cliente=NomeEmpresa [--campanha=NomeCampanha] [--dry-run]');
    process.exit(1);
  }

  console.log(`\nSincronizando Ficha do Cliente: ${cliente}`);
  if (campanha) console.log(`Campanha: ${campanha}`);
  if (dryRun)   console.log('(modo dry-run — nao salva no disco)');
  console.log('');

  sincronizarFicha(cliente, { campanha, dryRun }).then(rel => {
    if (rel.erros.length > 0) {
      console.log('ERROS:');
      rel.erros.forEach(e => console.log(`  - ${e}`));
      console.log('');
    }

    if (!rel.fichaLida) {
      console.error('Nao foi possivel ler a Ficha do Cliente.');
      process.exit(1);
    }

    console.log(`Config: ${rel.configPath}`);
    console.log(`Config existia: ${rel.configExistia ? 'sim' : 'nao (criado novo)'}`);
    console.log('');

    if (rel.camposSincronizados.length > 0) {
      console.log(`Campos atualizados (${rel.camposSincronizados.length}):`);
      rel.camposSincronizados.forEach(c => console.log(`  + ${c}`));
    } else {
      console.log('Nenhum campo atualizado (config ja estava em dia).');
    }

    if (rel.camposNovos.length > 0) {
      console.log(`\nCampos novos adicionados (${rel.camposNovos.length}):`);
      rel.camposNovos.forEach(c => console.log(`  * ${c}`));
    }

    if (rel.checklistMarcados.length > 0) {
      console.log(`\nChecklist [FASE 1] marcados (${rel.checklistMarcados.length}):`);
      rel.checklistMarcados.forEach(c => console.log(`  [x] ${c}`));
    }

    console.log('\nSincronizacao concluida.\n');
  }).catch(err => {
    console.error(`Erro: ${err.message}`);
    process.exit(1);
  });
}
