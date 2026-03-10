#!/usr/bin/env node
/**
 * ESCALANDO PREMOLDADOS — Criar Pipeline de LP no ClickUp
 *
 * Cria as 5 tasks de fase dentro da lista "Landing Pages" do cliente.
 *
 * Uso:
 *   node scripts/criar-pipeline-lp.js --cliente=Concrenor
 *   node scripts/criar-pipeline-lp.js --cliente=Concrenor --campanha="Mourao Torneado"
 *   node scripts/criar-pipeline-lp.js --cliente=Concrenor --dry-run
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// ---- Env ----
const CLICKUP_API_KEY = process.env.CLICKUP_API_KEY || 'pk_84613660_MVXFF2FG90QSK6YN1RLF1LBA7C4NXK7J';
const SPACE_CLIENTES  = process.env.CLICKUP_SPACE_ID || '901313553858';
const BASE_URL        = 'https://api.clickup.com/api/v2';

// ---- CLI args ----
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
const campanha = args.campanha || 'Geral';
const dryRun   = args['dry-run'] === true;

if (!cliente) {
  console.error('Uso: node scripts/criar-pipeline-lp.js --cliente=NomeCliente [--campanha=NomeCampanha] [--dry-run]');
  process.exit(1);
}

// ---- Carrega template ----
const templatePath = path.join(ROOT, 'config', 'pipeline-lp-template.json');
const { fases } = JSON.parse(fs.readFileSync(templatePath, 'utf8'));

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log(`\n🔧 Criando pipeline de LP`);
  console.log(`   Cliente:  ${cliente}`);
  console.log(`   Campanha: ${campanha}`);
  if (dryRun) console.log(`   Modo:     DRY RUN (nenhuma task será criada)\n`);
  else        console.log('');

  // 1. Encontra folder do cliente
  const folderId = await encontrarFolder(cliente);

  // 2. Encontra lista "Landing Pages"
  const listaId = await encontrarListaLandingPages(folderId, cliente);

  // 3. Verifica se já existe pipeline para essa campanha
  await verificarDuplicata(listaId, campanha);

  // 4. Cria as 5 tasks de fase
  console.log(`📋 Criando ${fases.length} tasks de fase...\n`);
  const tasksIds = [];

  for (const fase of fases) {
    const nomTask = `[FASE ${fase.numero}] ${fase.nome}${campanha !== 'Geral' ? ` — ${campanha}` : ''}`;

    if (dryRun) {
      console.log(`  [DRY RUN] Criaria task: "${nomTask}"`);
      console.log(`            Checklist: ${fase.checklist.length} items`);
      console.log(`            Aprovação: ${fase.aprovacao}`);
      console.log('');
      continue;
    }

    // Cria a task
    const task = await cu('post', `/list/${listaId}/task`, {
      name:        nomTask,
      description: fase.descricao,
      status:      'to do',
    });

    // Adiciona checklist
    const checklist = await cu('post', `/task/${task.id}/checklist`, {
      name: `Checklist — Fase ${fase.numero}`,
    });

    for (const item of fase.checklist) {
      await cu('post', `/checklist/${checklist.checklist.id}/checklist_item`, {
        name: item,
      });
    }

    tasksIds.push({ fase: fase.numero, id: task.id, nome: nomTask });
    console.log(`  ✅ Fase ${fase.numero}: "${nomTask}" (ID: ${task.id})`);
  }

  // 5. Define dependências sequenciais (Fase N depende de Fase N-1)
  if (!dryRun && tasksIds.length > 1) {
    console.log('\n🔗 Configurando dependências sequenciais...');
    for (let i = 1; i < tasksIds.length; i++) {
      const atual    = tasksIds[i];
      const anterior = tasksIds[i - 1];
      await cu('post', `/task/${atual.id}/dependency`, {
        depends_on: anterior.id,
      });
      console.log(`  ✅ Fase ${atual.fase} depende de Fase ${anterior.fase}`);
    }
  }

  if (dryRun) {
    console.log('\n✅ DRY RUN concluído. Nenhuma task foi criada.');
    console.log('   Remova --dry-run para criar de verdade.\n');
  } else {
    console.log(`\n🎉 Pipeline criado com sucesso!`);
    console.log(`   ${fases.length} tasks criadas na lista "Landing Pages" — ${cliente}`);
    console.log(`   Campanha: ${campanha}\n`);
    console.log('📋 IDs criados:');
    tasksIds.forEach(t => console.log(`   Fase ${t.fase}: ${t.id}  →  ${t.nome}`));
    console.log('');
  }
}

// ============================================================
// Encontra o Folder do cliente no Space
// ============================================================
async function encontrarFolder(nomeCliente) {
  const { folders } = await cu('get', `/space/${SPACE_CLIENTES}/folder?archived=false`);
  const folder = folders.find(f => f.name.toLowerCase() === nomeCliente.toLowerCase());
  if (!folder) {
    throw new Error(`Folder "${nomeCliente}" não encontrado no ClickUp.\nClientes disponíveis: ${folders.map(f => f.name).join(', ')}`);
  }
  console.log(`✅ Folder encontrado: "${folder.name}" (ID: ${folder.id})`);
  return folder.id;
}

// ============================================================
// Encontra a lista "Landing Pages" dentro do folder
// ============================================================
async function encontrarListaLandingPages(folderId, nomeCliente) {
  const { lists } = await cu('get', `/folder/${folderId}/list?archived=false`);
  const lista = lists.find(l => l.name.toLowerCase() === 'landing pages');
  if (!lista) {
    const disponiveis = lists.map(l => l.name).join(', ');
    throw new Error(`Lista "Landing Pages" não encontrada no folder "${nomeCliente}".\nListas disponíveis: ${disponiveis}`);
  }
  console.log(`✅ Lista encontrada: "${lista.name}" (ID: ${lista.id})`);
  return lista.id;
}

// ============================================================
// Verifica se já existe pipeline para essa campanha (evita duplicata)
// ============================================================
async function verificarDuplicata(listaId, campanha) {
  const { tasks } = await cu('get', `/list/${listaId}/task?archived=false`);
  const sufixo = campanha !== 'Geral' ? ` — ${campanha}` : '';
  const prefixo = `[FASE 1] DNA do Cliente${sufixo}`;
  const existe = tasks.find(t => t.name.toLowerCase() === prefixo.toLowerCase());
  if (existe) {
    throw new Error(`Pipeline para campanha "${campanha}" já existe nessa lista.\nTask encontrada: "${existe.name}" (ID: ${existe.id})\nUse uma campanha diferente ou delete as tasks existentes antes de recriar.`);
  }
}

// ============================================================
// ClickUp helper
// ============================================================
async function cu(method, urlPath, body) {
  const res = await fetch(`${BASE_URL}${urlPath}`, {
    method:  method.toUpperCase(),
    headers: { Authorization: CLICKUP_API_KEY, 'Content-Type': 'application/json' },
    body:    body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`ClickUp API error [${method.toUpperCase()} ${urlPath}]: ${JSON.stringify(json)}`);
  return json;
}

main().catch(err => {
  console.error(`\n❌ Erro: ${err.message}\n`);
  process.exit(1);
});
