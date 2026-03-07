/**
 * migrar-ficha-cliente.mjs
 *
 * Migração one-time: cria lista DADOS + Ficha do Cliente em cada pasta de cliente.
 * Para Concrenor: migra dados do Kickoff task para a Ficha.
 * Deleta os 13 campos de perfil da lista Onboarding da Concrenor.
 *
 * Uso: node scripts/migrar-ficha-cliente.mjs
 */

const KEY        = 'pk_84613660_MVXFF2FG90QSK6YN1RLF1LBA7C4NXK7J';
const SPACE      = '901313553858';
const BASE       = 'https://api.clickup.com/api/v2';

// Campos de perfil a DELETAR da lista Onboarding (só ficam os 6 de ação)
const CAMPOS_PERFIL_DELETE = [
  '06986839-de08-44d7-b9d3-edb37c93aed8', // Verba Mensal
  '2198aba2-bf7d-4f33-b74d-fae51053744f', // Produtos
  '229fd762-bde0-4c81-859f-1338e303ae1e', // Diferenciais
  '49fdbb26-04d6-4ed9-83bc-6477d455600f', // Acesso GMB
  '836718ae-38fb-466b-9106-aa4e884a4536', // Acesso Meta
  '888b4e68-1afd-4643-9ae5-12db57f37b97', // Perfil dos Clientes
  '98f4dc2b-9092-4c22-90b0-ba68d3b98c44', // Como Vendem Hoje
  '9a775a51-e3b7-45f1-b1d0-3abc74b5a23a', // Acesso Google
  'a66f8163-a649-4b4a-abd1-8226a47314d2', // Acesso Site
  'a7f39530-56ae-44a8-827e-5fe43b02f295', // Área de Atuação
  'b78b2405-78a2-4570-9de0-78fa317ac69e', // Concorrentes
  'b79ba030-9eaf-4f1f-a5c5-ebc69b9cf245', // Observações
  'b9bcacfa-fa82-458d-a075-3cd0804d2098', // Ticket Médio
];

async function cu(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: method.toUpperCase(),
    headers: { Authorization: KEY, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${JSON.stringify(json)}`);
  return json;
}

function acessoLabel(val) {
  if (val === 0) return '✅ Coletado';
  if (val === 1) return '⏳ Pendente';
  return '—';
}

function buildFichaDesc(d) {
  return `## 📋 Ficha do Cliente — ${d.empresa}

---

### 🏢 Dados Comerciais
| Campo | Valor |
|-------|-------|
| **Responsável** | ${d.responsavel || '—'} |
| **WhatsApp** | ${d.whatsapp || '—'} |
| **CNPJ** | ${d.cnpj || '—'} |
| **Plano** | ${d.plano || '—'} |
| **Valor Mensal** | ${d.valor ? `R$ ${d.valor}` : '—'} |
| **Data Início** | ${d.dataInicio || '—'} |

---

### 🔑 Acessos
| Canal | Status |
|-------|--------|
| **Meta Ads** | ${acessoLabel(d.acessoMeta)} |
| **Google Ads** | ${acessoLabel(d.acessoGoogle)} |
| **GMB** | ${acessoLabel(d.acessoGmb)} |
| **Site** | ${acessoLabel(d.acessoSite)} |

---

### 📦 Negócio
**Produtos/Serviços:** ${d.produtos || '—'}

**Área de Atuação:** ${d.areaAtuacao || '—'}

**Ticket Médio:** ${d.ticketMedio ? `R$ ${d.ticketMedio}` : '—'}

**Verba Mensal (Ads):** ${d.verbaMensal ? `R$ ${d.verbaMensal}` : '—'}

**Diferenciais:** ${d.diferenciais || '—'}

---

### 👥 Mercado
**Perfil dos Clientes:** ${d.perfilClientes || '—'}

**Como Vendem Hoje:** ${d.comoVendem || '—'}

**Concorrentes:** ${d.concorrentes || '—'}

---

### 📝 Observações
${d.obs || '—'}

---
_Atualizado automaticamente pelo sistema Escalando Premoldados_`;
}

async function criarFichaCliente(folderId, empresa, dados) {
  // 1. Cria lista DADOS
  console.log(`  → Criando lista DADOS...`);
  const dadosList = await cu('post', `/folder/${folderId}/list`, { name: 'DADOS' });

  // 2. Cria task Ficha do Cliente
  console.log(`  → Criando Ficha do Cliente...`);
  const ficha = await cu('post', `/list/${dadosList.id}/task`, {
    name: `Ficha do Cliente — ${empresa}`,
    description: buildFichaDesc({ empresa, ...dados }),
    priority: 1,
  });

  console.log(`  ✅ DADOS list: ${dadosList.id} | Ficha task: ${ficha.id}`);
  return { dadosList, ficha };
}

async function deletarCamposPerfil(listId) {
  console.log(`  → Deletando ${CAMPOS_PERFIL_DELETE.length} campos de perfil da lista ${listId}...`);
  let ok = 0, fail = 0;
  for (const fieldId of CAMPOS_PERFIL_DELETE) {
    try {
      await cu('delete', `/list/${listId}/field/${fieldId}`);
      ok++;
    } catch (e) {
      console.warn(`    ⚠️  ${fieldId}: ${e.message.slice(0, 60)}`);
      fail++;
    }
  }
  console.log(`  ✅ Deletados: ${ok} | Falhas: ${fail}`);
}

// ── MAIN ──────────────────────────────────────────────────────

const { folders } = await cu('get', `/space/${SPACE}/folder?archived=false`);

for (const folder of folders) {
  const empresa = folder.name;
  console.log(`\n📁 ${empresa} (folder: ${folder.id})`);

  // Busca lista Onboarding
  const { lists } = await cu('get', `/folder/${folder.id}/list?archived=false`);
  const onboarding = lists.find(l => l.name === 'Onboarding');
  if (!onboarding) { console.log('  ⚠️  Sem lista Onboarding — pulando'); continue; }

  // Verifica se já existe lista DADOS
  const dadosExistente = lists.find(l => l.name === 'DADOS');
  if (dadosExistente) { console.log('  ⏭️  Lista DADOS já existe — pulando criação'); }

  // Para Concrenor: lê dados existentes do Kickoff
  let dadosMigrar = {};
  if (empresa.toLowerCase() === 'concrenor') {
    const { tasks } = await cu('get', `/list/${onboarding.id}/task?archived=false&include_closed=true`);
    const kickoff = tasks.find(t => t.name.toLowerCase().includes('kickoff'));
    if (kickoff) {
      const cf = {};
      for (const f of (kickoff.custom_fields || [])) cf[f.name] = f.value;
      dadosMigrar = {
        produtos:       cf['Produtos']           || '',
        areaAtuacao:    cf['Área de Atuação']     || '',
        ticketMedio:    cf['Ticket Médio']        || 0,
        verbaMensal:    cf['Verba Mensal']        || 0,
        acessoMeta:     cf['Acesso Meta']         ?? 2,
        acessoGoogle:   cf['Acesso Google']       ?? 2,
        acessoGmb:      cf['Acesso GMB']          ?? 2,
        acessoSite:     cf['Acesso Site']         ?? 2,
        diferenciais:   cf['Diferenciais']        || '',
        perfilClientes: cf['Perfil dos Clientes'] || '',
        comoVendem:     cf['Como Vendem Hoje']    || '',
        concorrentes:   cf['Concorrentes']        || '',
        obs:            cf['Observações']         || '',
        responsavel:    cf['Responsável']         || '',
        whatsapp:       cf['WhatsApp']            || '',
        cnpj:           cf['CNPJ']                || '',
        plano:          ['Starter','Growth','Pro'][cf['Plano']] || '—',
        valor:          cf['Valor Mensal']        || 0,
        dataInicio:     cf['Data Início'] ? new Date(cf['Data Início']).toLocaleDateString('pt-BR') : '',
      };
      console.log('  📊 Dados do Kickoff lidos:', Object.keys(dadosMigrar).filter(k => dadosMigrar[k]).join(', '));
    }
  }

  // Cria DADOS + Ficha (se não existir)
  if (!dadosExistente) {
    await criarFichaCliente(folder.id, empresa, dadosMigrar);
  }

  // Deleta campos de perfil da lista Onboarding da Concrenor
  if (empresa.toLowerCase() === 'concrenor') {
    await deletarCamposPerfil(onboarding.id);
  }
}

console.log('\n✅ Migração concluída!');
console.log('\nPróximos passos:');
console.log('  1. Verificar no ClickUp se as listas DADOS e Fichas foram criadas');
console.log('  2. Confirmar que campos de perfil sumiram das tasks Onboarding da Concrenor');
console.log('  3. Fazer git push + git pull no VPS');
