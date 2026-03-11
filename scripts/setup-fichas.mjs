/**
 * Setup: cria custom fields na lista OPERAÇÃO/Fichas
 * node scripts/setup-fichas.mjs
 */

const LIST_ID = '901326308338';
const API_KEY = process.env.CLICKUP_API_KEY || 'pk_84613660_MVXFF2FG90QSK6YN1RLF1LBA7C4NXK7J';
const BASE    = `https://api.clickup.com/api/v2/list/${LIST_ID}/field`;

async function createField(payload) {
  const res  = await fetch(BASE, {
    method:  'POST',
    headers: { Authorization: API_KEY, 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) {
    console.error(`  ❌ ${payload.name}:`, JSON.stringify(json));
    return null;
  }
  console.log(`  ✅ ${json.name} (${json.id})`);
  return json;
}

const campos = [
  { name: 'Responsável',       type: 'text' },
  { name: 'WhatsApp',          type: 'phone' },
  {
    name: 'Plano', type: 'drop_down',
    type_config: { options: [
      { name: 'Starter', color: '#6bc950' },
      { name: 'Growth',  color: '#f9c00c' },
      { name: 'Pro',     color: '#c377e0' },
    ]},
  },
  {
    name: 'Valor Mensal', type: 'currency',
    type_config: { precision: 2, default: 0, currency_type: 'BRL' },
  },
  {
    name: 'Canal de Contato', type: 'drop_down',
    type_config: { options: [
      { name: 'WhatsApp',   color: '#6bc950' },
      { name: 'Indicação',  color: '#f9c00c' },
      { name: 'Instagram',  color: '#c377e0' },
      { name: 'Google',     color: '#4a9af5' },
    ]},
  },
  {
    name: 'B2B ou B2C', type: 'drop_down',
    type_config: { options: [
      { name: 'B2B',    color: '#4a9af5' },
      { name: 'B2C',    color: '#f9c00c' },
      { name: 'Ambos',  color: '#81b1ff' },
    ]},
  },
  { name: 'Produto Foco',       type: 'text' },
  { name: 'Área de Atuação',    type: 'text' },
  {
    name: 'Verba Ads', type: 'currency',
    type_config: { precision: 2, default: 0, currency_type: 'BRL' },
  },
  { name: 'Objetivo Principal', type: 'text' },
  { name: 'Sucesso em 60 dias', type: 'text' },
  {
    name: 'Tom de Voz', type: 'drop_down',
    type_config: { options: [
      { name: 'Técnico e sério',    color: '#4a9af5' },
      { name: 'Direto e confiante', color: '#6bc950' },
      { name: 'Próximo e humano',   color: '#f9c00c' },
    ]},
  },
];

console.log(`\n🛠  Criando ${campos.length} campos na lista Fichas (${LIST_ID})...\n`);

const criados = {};
for (const campo of campos) {
  const field = await createField(campo);
  if (field) criados[campo.name] = field.id;
}

console.log('\n📋 IDs dos campos criados:\n');
for (const [nome, id] of Object.entries(criados)) {
  console.log(`  ${nome}: ${id}`);
}

console.log('\n✅ Pronto! Adicione os IDs ao .env ou Vercel:\n');
console.log(`CLICKUP_LIST_FICHAS=${LIST_ID}`);
