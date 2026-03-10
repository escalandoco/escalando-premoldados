#!/usr/bin/env node
/**
 * ESCALANDO PREMOLDADOS — Ficha do Cliente (fonte de verdade central)
 *
 * Modulo exportavel que le e atualiza a Ficha do Cliente no ClickUp (lista DADOS).
 *
 * Uso como modulo:
 *   import { lerFicha, atualizarFicha } from './ficha-cliente.js';
 *   const ficha = await lerFicha('Concrenor');
 *   await atualizarFicha('Concrenor', { verbaMensal: 3000 });
 *
 * Uso como CLI:
 *   node scripts/ficha-cliente.js --cliente=Concrenor
 *   node scripts/ficha-cliente.js --cliente=Concrenor --json
 */

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const IS_CLI = process.argv[1] === __filename;

// ---- Env ----
const CLICKUP_API_KEY = process.env.CLICKUP_API_KEY || 'pk_84613660_MVXFF2FG90QSK6YN1RLF1LBA7C4NXK7J';
const SPACE_CLIENTES  = process.env.CLICKUP_SPACE_ID || '901313553858';
const BASE_URL        = 'https://api.clickup.com/api/v2';

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
// ENCONTRAR FICHA — busca task na lista DADOS
// ============================================================
async function encontrarFichaTask(cliente) {
  const { folders } = await cu('get', `/space/${SPACE_CLIENTES}/folder?archived=false`);
  const folder = folders.find(f => f.name.toLowerCase() === cliente.toLowerCase());
  if (!folder) throw new Error(`Folder "${cliente}" nao encontrado no ClickUp.`);

  const { lists } = await cu('get', `/folder/${folder.id}/list?archived=false`);
  const dadosList = lists.find(l => l.name === 'DADOS');
  if (!dadosList) throw new Error(`Lista "DADOS" nao encontrada para "${cliente}".`);

  const { tasks } = await cu('get', `/list/${dadosList.id}/task?archived=false`);
  const ficha = tasks.find(t => t.name.toLowerCase().includes('ficha do cliente'));
  if (!ficha) throw new Error(`Task "Ficha do Cliente" nao encontrada na lista DADOS de "${cliente}".`);

  return ficha;
}

// ============================================================
// PARSE — extrai dados estruturados da description markdown
// ============================================================
function parseFichaDescription(desc) {
  if (!desc) return _fichaVazia();

  const result = _fichaVazia();

  // Extrai empresa do titulo
  const tituloMatch = desc.match(/## .*Ficha do Cliente\s*[-—]\s*(.+)/);
  if (tituloMatch) result.empresa = tituloMatch[1].trim();

  // ---- Tabela Dados Comerciais ----
  result.responsavel = _extrairCampoTabela(desc, 'Respons[aá]vel');
  result.whatsapp    = _extrairCampoTabela(desc, 'WhatsApp');
  result.cnpj        = _extrairCampoTabela(desc, 'CNPJ');
  result.plano       = _extrairCampoTabela(desc, 'Plano');
  result.valor       = _extrairCampoTabela(desc, 'Valor Mensal');

  // Localidade pode ser "Cidade — Estado" ou campos separados
  const localidade = _extrairCampoTabela(desc, 'Localidade');
  if (localidade && localidade !== '—') {
    const partes = localidade.split(/\s*[-—]\s*/);
    result.cidade = partes[0]?.trim() || null;
    result.estado = partes[1]?.trim() || null;
  }

  // Data Inicio
  const dataInicio = _extrairCampoTabela(desc, 'Data In[ií]cio');
  if (dataInicio && dataInicio !== '—') result.dataInicio = dataInicio;

  // Canal de Captacao
  const canal = _extrairCampoTabela(desc, 'Canal de Capta[cç][aã]o');
  if (canal && canal !== '—') result.canal = canal;

  // ---- Tabela Acessos ----
  result.acessoMeta   = _parseAcesso(_extrairCampoTabela(desc, 'Meta Ads'));
  result.acessoGoogle = _parseAcesso(_extrairCampoTabela(desc, 'Google Ads'));
  result.acessoGmb    = _parseAcesso(_extrairCampoTabela(desc, 'GMB'));
  result.acessoSite   = _parseAcesso(_extrairCampoTabela(desc, 'Site'));

  // ---- Secao Negocio (campos em bold) ----
  result.produtos       = _extrairCampoBold(desc, 'Produtos\\/Servi[cç]os');
  result.areaAtuacao    = _extrairCampoBold(desc, '[AÁ]rea de Atua[cç][aã]o');
  result.ticketMedio    = _extrairCampoBold(desc, 'Ticket M[eé]dio');
  result.verbaMensal    = _extrairCampoBold(desc, 'Verba Mensal \\(Ads\\)');
  result.diferenciais   = _extrairCampoBold(desc, 'Diferenciais');

  // ---- Secao Mercado ----
  result.perfilClientes = _extrairCampoBold(desc, 'Perfil dos Clientes');
  result.comoVendem     = _extrairCampoBold(desc, 'Como Vendem Hoje');
  result.concorrentes   = _extrairCampoBold(desc, 'Concorrentes');

  // ---- Secao Observacoes ----
  const obsMatch = desc.match(/###\s*.*Observa[cç][oõ]es\s*\n([\s\S]*?)(?=\n---|\n###|$)/);
  if (obsMatch) {
    const obs = obsMatch[1].trim();
    if (obs && obs !== '—') result.obs = obs;
  }

  // ---- Flags de completude ----
  result._completo = {
    onboarding: !!(result.whatsapp && result.responsavel && result.plano),
    trafego:    !!(result.verbaMensal && (result.acessoMeta !== null || result.acessoGoogle !== null)),
    lp:         !!(result.produtos && result.diferenciais),
  };

  return result;
}

// ============================================================
// HELPERS de parse
// ============================================================
function _fichaVazia() {
  return {
    empresa: null, responsavel: null, whatsapp: null, cnpj: null,
    cidade: null, estado: null, plano: null, valor: null,
    dataInicio: null, canal: null,
    produtos: null, diferenciais: null, concorrentes: null,
    perfilClientes: null, areaAtuacao: null, verbaMensal: null,
    ticketMedio: null, comoVendem: null, obs: null,
    acessoMeta: null, acessoGoogle: null, acessoGmb: null, acessoSite: null,
    _completo: { onboarding: false, trafego: false, lp: false },
  };
}

/**
 * Extrai valor de uma linha de tabela markdown: | **Campo** | Valor |
 * Tolerante a bold, espacos e emojis.
 */
function _extrairCampoTabela(desc, campoRegex) {
  const re = new RegExp(`\\|\\s*\\*?\\*?${campoRegex}\\*?\\*?\\s*\\|\\s*(.+?)\\s*\\|`, 'i');
  const m = desc.match(re);
  if (!m) return null;
  const val = m[1].trim();
  return (val === '—' || val === '-' || val === '' || val.toLowerCase() === 'undefined') ? null : val;
}

/**
 * Extrai valor de campo bold: **Campo:** Valor
 */
function _extrairCampoBold(desc, campoRegex) {
  const re = new RegExp(`\\*\\*${campoRegex}:\\*\\*\\s*(.+)`, 'i');
  const m = desc.match(re);
  if (!m) return null;
  const val = m[1].trim();
  return (val === '—' || val === '-' || val === '') ? null : val;
}

/**
 * Converte texto de acesso para valor normalizado.
 */
function _parseAcesso(val) {
  if (!val) return null;
  const v = val.toLowerCase();
  if (v.includes('coletado') || v.includes('sim') || v.includes('yes')) return 'coletado';
  if (v.includes('pendente')) return 'pendente';
  return null;
}

// ============================================================
// lerFicha — FUNCAO PRINCIPAL DE LEITURA
// ============================================================
/**
 * Busca a task "Ficha do Cliente" na lista DADOS do ClickUp
 * e retorna objeto estruturado com todos os campos.
 *
 * @param {string} cliente - Nome da empresa (ex: "Concrenor")
 * @returns {Promise<Object>} Objeto com campos da ficha
 */
export async function lerFicha(cliente) {
  const task = await encontrarFichaTask(cliente);
  const dados = parseFichaDescription(task.description || '');
  dados._taskId = task.id;
  dados._taskUrl = task.url || null;
  return dados;
}

// ============================================================
// atualizarFicha — ATUALIZA DESCRIPTION COM NOVOS DADOS
// ============================================================
/**
 * Atualiza a Ficha do Cliente com novos dados (merge com existentes).
 *
 * @param {string} cliente - Nome da empresa
 * @param {Object} novosDados - Campos a atualizar (merge com existentes)
 * @returns {Promise<Object>} Resultado { ok, taskId, camposAtualizados }
 */
export async function atualizarFicha(cliente, novosDados) {
  const task = await encontrarFichaTask(cliente);
  const atuais = parseFichaDescription(task.description || '');

  // Merge: novos dados sobrescrevem apenas campos nao-null
  const merged = { ...atuais };
  for (const [k, v] of Object.entries(novosDados)) {
    if (k.startsWith('_')) continue; // ignora campos internos
    if (v !== null && v !== undefined && v !== '') {
      merged[k] = v;
    }
  }

  // Reconstroi description no formato original
  const novaDesc = _buildFichaDesc(merged);

  await cu('put', `/task/${task.id}`, { description: novaDesc });

  // Lista campos que mudaram
  const camposAtualizados = [];
  for (const [k, v] of Object.entries(novosDados)) {
    if (k.startsWith('_')) continue;
    if (v !== null && v !== undefined && v !== '' && v !== atuais[k]) {
      camposAtualizados.push(k);
    }
  }

  return { ok: true, taskId: task.id, camposAtualizados };
}

// ============================================================
// REBUILD — reconstroi description no formato do buildFichaDesc
// ============================================================
function _buildFichaDesc(d) {
  const acesso = v => {
    if (v === 'coletado' || v === 0) return 'Coletado';
    if (v === 'pendente' || v === 1) return 'Pendente';
    return '—';
  };
  const localidade = [d.cidade, d.estado].filter(Boolean).join(' — ') || '—';
  const canalTexto = d.canal || '—';

  return `## Ficha do Cliente — ${d.empresa || '?'}

---

### Dados Comerciais
| Campo | Valor |
|-------|-------|
| **Responsavel** | ${d.responsavel || '—'} |
| **WhatsApp** | ${d.whatsapp || '—'} |
| **CNPJ** | ${d.cnpj || '—'} |
| **Localidade** | ${localidade} |
| **Plano** | ${d.plano || '—'} |
| **Valor Mensal** | ${d.valor || '—'} |
| **Data Inicio** | ${d.dataInicio || '—'} |
| **Canal de Captacao** | ${canalTexto} |

---

### Acessos
| Canal | Status |
|-------|--------|
| **Meta Ads** | ${acesso(d.acessoMeta)} |
| **Google Ads** | ${acesso(d.acessoGoogle)} |
| **GMB** | ${acesso(d.acessoGmb)} |
| **Site** | ${acesso(d.acessoSite)} |

---

### Negocio
**Produtos/Servicos:** ${d.produtos || '—'}

**Area de Atuacao:** ${d.areaAtuacao || '—'}

**Ticket Medio:** ${d.ticketMedio || '—'}

**Verba Mensal (Ads):** ${d.verbaMensal || '—'}

**Diferenciais:** ${d.diferenciais || '—'}

---

### Mercado
**Perfil dos Clientes:** ${d.perfilClientes || '—'}

**Como Vendem Hoje:** ${d.comoVendem || '—'}

**Concorrentes:** ${d.concorrentes || '—'}

---

### Observacoes
${d.obs || '—'}

---
_Atualizado automaticamente pelo sistema Escalando Premoldados_`;
}

// ============================================================
// EXPORT — parseFichaDescription para uso em testes/debug
// ============================================================
export { parseFichaDescription, encontrarFichaTask };

// ============================================================
// CLI standalone
// ============================================================
if (IS_CLI) {
  const args = {};
  for (const a of process.argv.slice(2)) {
    const [k, ...v] = a.replace(/^--/, '').split('=');
    args[k] = v.join('=') || true;
  }

  const cliente = args.cliente;
  const asJson  = args.json === true;

  if (!cliente) {
    console.error('Uso: node scripts/ficha-cliente.js --cliente=NomeEmpresa [--json]');
    process.exit(1);
  }

  console.log(`\nLendo Ficha do Cliente: ${cliente}\n`);

  lerFicha(cliente).then(ficha => {
    if (asJson) {
      console.log(JSON.stringify(ficha, null, 2));
    } else {
      console.log(`Empresa:      ${ficha.empresa || '?'}`);
      console.log(`Responsavel:  ${ficha.responsavel || '—'}`);
      console.log(`WhatsApp:     ${ficha.whatsapp || '—'}`);
      console.log(`CNPJ:         ${ficha.cnpj || '—'}`);
      console.log(`Cidade:       ${ficha.cidade || '—'}`);
      console.log(`Estado:       ${ficha.estado || '—'}`);
      console.log(`Plano:        ${ficha.plano || '—'}`);
      console.log(`Valor:        ${ficha.valor || '—'}`);
      console.log(`Produtos:     ${ficha.produtos || '—'}`);
      console.log(`Diferenciais: ${ficha.diferenciais || '—'}`);
      console.log(`Verba Mensal: ${ficha.verbaMensal || '—'}`);
      console.log(`Area Atuacao: ${ficha.areaAtuacao || '—'}`);
      console.log(`---`);
      console.log(`Acessos: Meta=${ficha.acessoMeta || '—'} | Google=${ficha.acessoGoogle || '—'} | GMB=${ficha.acessoGmb || '—'} | Site=${ficha.acessoSite || '—'}`);
      console.log(`---`);
      console.log(`Completude: onboarding=${ficha._completo.onboarding} | trafego=${ficha._completo.trafego} | lp=${ficha._completo.lp}`);
      console.log(`Task ID:    ${ficha._taskId}`);
    }
    console.log('');
  }).catch(err => {
    console.error(`Erro: ${err.message}`);
    process.exit(1);
  });
}
