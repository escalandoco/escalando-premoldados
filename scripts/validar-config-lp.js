#!/usr/bin/env node
/**
 * ESCALANDO PREMOLDADOS — Validador de Config JSON de LP
 *
 * Detecta campos obrigatórios vazios ou com "A DEFINIR" / "A COLETAR".
 *
 * Uso como CLI:
 *   node scripts/validar-config-lp.js --config=config/lp-concrenor.json
 *
 * Uso como módulo:
 *   import { validarConfig } from './validar-config-lp.js';
 *   const result = validarConfig(configObj);
 *   // { valido: boolean, erros: string[], avisos: string[] }
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const IS_CLI = process.argv[1] === __filename;

// Padrões que indicam campo não preenchido
const PADROES_INDEFINIDO = [
  /a definir/i,
  /a coletar/i,
  /a preencher/i,
  /aguardando/i,
  /pendente/i,
  /todo/i,
  /placeholder/i,
  /^$/, // string vazia
];

// Campos obrigatórios — bloqueiam geração se ausentes
const CAMPOS_OBRIGATORIOS = [
  { campo: 'empresa',      label: 'Nome da empresa' },
  { campo: 'whatsapp',     label: 'WhatsApp' },
  { campo: 'cor_primaria', label: 'Cor primária' },
];

// Campos recomendados — geram aviso mas não bloqueiam
const CAMPOS_RECOMENDADOS = [
  { campo: 'headline',    label: 'Headline principal' },
  { campo: 'subheadline', label: 'Subheadline' },
  { campo: 'slogan',      label: 'Slogan' },
  { campo: 'cidade',      label: 'Cidade' },
  { campo: 'logo',        label: 'Logo' },
];

// ============================================================
// FUNÇÃO PRINCIPAL (exportável)
// ============================================================
/**
 * Valida um config JSON de LP.
 * @param {object} config - Objeto de configuração da LP
 * @returns {{ valido: boolean, erros: string[], avisos: string[] }}
 */
export function validarConfig(config) {
  const erros  = [];
  const avisos = [];

  // 1. Campos obrigatórios
  for (const { campo, label } of CAMPOS_OBRIGATORIOS) {
    const valor = config[campo];
    if (!valor || estaIndefinido(String(valor))) {
      erros.push(`${label} (${campo}) está vazio ou indefinido.`);
    }
  }

  // 2. Campos recomendados
  for (const { campo, label } of CAMPOS_RECOMENDADOS) {
    const valor = config[campo];
    if (!valor || estaIndefinido(String(valor))) {
      avisos.push(`${label} (${campo}) não preenchido.`);
    }
  }

  // 3. Produtos — pelo menos 1
  if (!Array.isArray(config.produtos) || config.produtos.length === 0) {
    erros.push('produtos: nenhum produto cadastrado (mínimo 1).');
  } else {
    config.produtos.forEach((p, i) => {
      if (!p.nome || estaIndefinido(p.nome)) {
        erros.push(`produtos[${i}].nome está vazio ou indefinido.`);
      }
    });
  }

  // 4. Headline — detecta "A DEFINIR" especificamente (muito comum)
  if (config.headline && estaIndefinido(config.headline)) {
    erros.push(`headline contém "${config.headline}" — precisa ser definida antes de gerar a LP.`);
  }

  // 5. Depoimentos — avisa se vazio ou com texto padrão
  if (!Array.isArray(config.depoimentos) || config.depoimentos.length === 0) {
    avisos.push('depoimentos: nenhum depoimento cadastrado.');
  } else {
    config.depoimentos.forEach((d, i) => {
      if (d.texto && estaIndefinido(d.texto)) {
        avisos.push(`depoimentos[${i}].texto parece não preenchido: "${d.texto.slice(0, 50)}..."`);
      }
    });
  }

  // 6. WhatsApp — verifica formato mínimo (deve ter pelo menos 12 dígitos com DDI)
  if (config.whatsapp) {
    const digits = String(config.whatsapp).replace(/\D/g, '');
    if (digits.length < 12) {
      erros.push(`whatsapp "${config.whatsapp}" parece inválido — deve incluir DDI+DDD+número (mín. 12 dígitos).`);
    }
  }

  return {
    valido: erros.length === 0,
    erros,
    avisos,
  };
}

// ============================================================
// Verifica se um valor está "indefinido" (placeholder)
// ============================================================
function estaIndefinido(valor) {
  return PADROES_INDEFINIDO.some(p => p.test(valor.trim()));
}

// ============================================================
// CLI standalone
// ============================================================
if (IS_CLI) {
  const args = {};
  for (const a of process.argv.slice(2)) {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    args[k] = v.join('=') || true;
  }

  const configPath = args.config;

  if (!configPath) {
    console.error('Uso: node scripts/validar-config-lp.js --config=config/lp-concrenor.json');
    process.exit(1);
  }

  const fullPath = path.resolve(configPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Arquivo não encontrado: ${fullPath}`);
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  const { valido, erros, avisos } = validarConfig(config);

  console.log(`\n🔍 Validando config: ${configPath}\n`);

  if (erros.length > 0) {
    console.log(`❌ INVÁLIDO — ${erros.length} erro(s) encontrado(s):\n`);
    erros.forEach(e => console.log(`   ✗ ${e}`));
  } else {
    console.log('✅ Config válido — todos os campos obrigatórios preenchidos.');
  }

  if (avisos.length > 0) {
    console.log(`\n⚠️  ${avisos.length} aviso(s):\n`);
    avisos.forEach(a => console.log(`   ⚠  ${a}`));
  }

  console.log('');
  process.exit(valido ? 0 : 1);
}
