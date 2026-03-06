#!/usr/bin/env node
/**
 * ESCALANDO PREMOLDADOS — Exportar leads do CRM para CSV (Meta Ads Custom Audience)
 *
 * Uso:
 *   node scripts/exportar-leads-meta.js --cliente=Concrenor
 *   node scripts/exportar-leads-meta.js --cliente=Concrenor --tipo=clientes
 *
 * Tipos:
 *   leads    → todos os leads do CRM (padrão)
 *   clientes → apenas leads com status "Fechado" ou "Cliente"
 *
 * Output:
 *   dist/{cliente}/meta-audience-{tipo}-{data}.csv
 *   Pronto para upload no Meta Ads Manager > Públicos > Criar Público > Lista de Clientes
 *
 * Formato Meta (colunas obrigatórias):
 *   phone, fn (first name), ln (last name)
 *   Normalização: DDI 55 + remove não-dígitos
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// IDs das planilhas do CRM por cliente
const SHEETS_IDS = {
  concrenor: '1ypUuEzLRpXAACLryN530O3yfMicJLqW_FPZM_nlSN-U',
};

// Status que indicam "cliente fechado"
const STATUS_CLIENTE = ['Fechado', 'Cliente', 'Ativo', 'fechado', 'cliente'];

// ---- CLI args ----
const args = {};
for (const a of process.argv.slice(2)) {
  const [k, ...v] = a.replace(/^--/, '').split('=');
  args[k] = v.join('=') || true;
}

const clienteRaw = args.cliente || args.c;
const tipo = (args.tipo || 'leads').toLowerCase();

if (!clienteRaw) {
  console.error('Uso: node scripts/exportar-leads-meta.js --cliente=NomeCliente [--tipo=leads|clientes]');
  process.exit(1);
}

const clienteSlug = clienteRaw.toLowerCase().replace(/\s+/g, '-');
const sheetsId = SHEETS_IDS[clienteSlug];

if (!sheetsId) {
  console.error(`❌ Sheets ID não encontrado para "${clienteRaw}". Adicione em SHEETS_IDS no script.`);
  process.exit(1);
}

function normalizePhone(phone) {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if (digits.length === 11) digits = '55' + digits;
  if (digits.length === 10) digits = '55' + digits;
  return digits.startsWith('55') ? digits : '55' + digits;
}

function parseName(fullName) {
  const parts = (fullName || '').trim().split(/\s+/);
  return {
    fn: parts[0] || '',
    ln: parts.slice(1).join(' ') || '',
  };
}

async function main() {
  console.log(`\n📋 Exportando ${tipo} de ${clienteRaw} para Meta Ads...\n`);

  // Busca dados da planilha via Google Sheets API (público — sem autenticação)
  const url = `https://docs.google.com/spreadsheets/d/${sheetsId}/gviz/tq?tqx=out:json`;

  let rows;
  try {
    const res = await fetch(url);
    const text = await res.text();
    // Google retorna JSONP: /*O_o*/ google.visualization.Query.setResponse({...});
    const json = JSON.parse(text.replace(/^[^{]+/, '').replace(/[^}]+$/, ''));
    const cols = json.table.cols.map(c => c.label?.toLowerCase() || '');
    rows = json.table.rows.map(r =>
      Object.fromEntries(cols.map((col, i) => [col, r.c?.[i]?.v ?? '']))
    );
  } catch (err) {
    console.error('❌ Erro ao buscar planilha:', err.message);
    console.error('   Verifique se a planilha está pública (Compartilhar > Qualquer pessoa com o link).');
    process.exit(1);
  }

  console.log(`✅ ${rows.length} registros encontrados na planilha.`);

  // Filtra por tipo
  let filtrados = rows;
  if (tipo === 'clientes') {
    filtrados = rows.filter(r => STATUS_CLIENTE.includes(r.status || r['status'] || ''));
    console.log(`🔍 Filtro "clientes fechados": ${filtrados.length} registros.`);
  }

  // Remove entradas sem telefone
  filtrados = filtrados.filter(r => {
    const tel = r.whatsapp || r.telefone || r.phone || r.tel || '';
    return normalizePhone(tel).length >= 12;
  });

  console.log(`📞 Com telefone válido: ${filtrados.length} registros.`);

  if (filtrados.length === 0) {
    console.warn('⚠️  Nenhum registro válido para exportar.');
    process.exit(0);
  }

  // Monta CSV no formato Meta
  const header = 'phone,fn,ln';
  const csvRows = filtrados.map(r => {
    const tel = r.whatsapp || r.telefone || r.phone || r.tel || '';
    const phone = normalizePhone(tel);
    const { fn, ln } = parseName(r.nome || r.name || '');
    return `${phone},${fn},${ln}`;
  });

  const csv = [header, ...csvRows].join('\n');

  // Salva arquivo
  const date = new Date().toISOString().slice(0, 10);
  const outDir = path.join(ROOT, 'dist', clienteSlug);
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `meta-audience-${tipo}-${date}.csv`);
  fs.writeFileSync(outFile, csv, 'utf8');

  console.log(`\n✅ Arquivo gerado: dist/${clienteSlug}/meta-audience-${tipo}-${date}.csv`);
  console.log(`   ${csvRows.length} registros exportados.`);
  console.log(`\n📤 Próximo passo:`);
  console.log(`   Meta Ads Manager > Públicos > Criar Público > Lista de Clientes`);
  console.log(`   Fazer upload do arquivo: ${outFile}`);
  console.log(`   Nome do público: CA_${clienteRaw.toUpperCase()}_LISTA-${tipo.toUpperCase()}\n`);
}

main().catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
