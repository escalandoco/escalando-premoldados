/**
 * ficha.js — Helper para ler dados da Ficha do Cliente (OPERAÇÃO/Fichas)
 *
 * Exporta:
 *   lerDadosCliente(cliente) → { cf, desc } com todos os campos do cliente
 *
 * cf = custom fields normalizados
 * desc = campos extraídos da description (plain text "CAMPO: valor")
 */

const BASE_URL       = 'https://api.clickup.com/api/v2';
const SPACE_OPERACAO = process.env.CLICKUP_SPACE_OPERACAO || '901313601522';
const LIST_FICHAS    = process.env.CLICKUP_LIST_FICHAS    || '901326308338';

async function cuGet(path) {
  const KEY = process.env.CLICKUP_API_KEY;
  const r = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: KEY },
  });
  if (!r.ok) throw new Error(`ClickUp GET ${path} → ${r.status}`);
  return r.json();
}

/**
 * Extrai campos do formato "CAMPO: valor\n" da description da Ficha
 */
function parseDesc(description = '') {
  const result = {};
  for (const line of description.split('\n')) {
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (key && val && val !== '—') result[key] = val;
  }
  return result;
}

/**
 * Normaliza custom fields da Ficha para nomes usados pelos scripts.
 * Mapeia nomes dos CFs da Ficha → nomes esperados pelos agentes.
 */
function normalizarCF(customFields = []) {
  const raw = {};
  for (const f of customFields) {
    if (f.value !== null && f.value !== undefined && f.value !== '') {
      // Dropdown: pega o nome da opção selecionada
      if (f.type === 'drop_down' && f.type_config?.options) {
        const opt = f.type_config.options.find(o => o.orderindex === f.value);
        raw[f.name] = opt ? opt.name : f.value;
      } else {
        raw[f.name] = f.value;
      }
    }
  }

  // Mapeamento: nomes dos CFs → aliases usados pelos scripts
  return {
    'Responsável':       raw['Responsável']       || null,
    'WhatsApp':          raw['WhatsApp']           || null,
    'Plano':             raw['Plano']              || null,
    'Valor Mensal':      raw['Valor Mensal']       || null,
    'Canal de Contato':  raw['Canal de Contato']   || null,
    'B2B ou B2C':        raw['B2B ou B2C']         || null,
    'Produto Foco':      raw['Produto Foco']       || null,
    'Produtos':          raw['Produto Foco']       || null,  // alias
    'Área de Atuação':   raw['Área de Atuação']    || null,
    'Verba Ads':         raw['Verba Ads']          || null,
    'Verba Mensal':      raw['Verba Ads']          || null,  // alias
    'Objetivo Principal':raw['Objetivo Principal'] || null,
    'Sucesso em 60 dias':raw['Sucesso em 60 dias'] || null,
    'Tom de Voz':        raw['Tom de Voz']         || null,
  };
}

/**
 * Lê todos os dados do cliente a partir da Ficha em OPERAÇÃO/Fichas.
 * Retorna objeto combinando custom fields + campos da description.
 */
export async function lerDadosCliente(cliente) {
  const { tasks } = await cuGet(`/list/${LIST_FICHAS}/task?archived=false`);
  const ficha = (tasks || []).find(
    t => t.name.toLowerCase() === `ficha — ${cliente.toLowerCase()}`
  );
  if (!ficha) throw new Error(`Ficha de "${cliente}" não encontrada em OPERAÇÃO/Fichas.`);

  const cf   = normalizarCF(ficha.custom_fields || []);
  const desc = parseDesc(ficha.description || '');

  // Mescla: campos da description sobrescrevem CFs ausentes
  const dados = {
    ...cf,
    'CNPJ':               desc['CNPJ']               || null,
    'Localidade':         desc['Localidade']         || null,
    'Data Início':        desc['Data Início']        || null,
    'Produtos':           cf['Produto Foco'] || desc['Produtos'] || null,
    'Diferenciais':       desc['Diferenciais']       || null,
    'Perfil dos Clientes':desc['Perfil dos Clientes']|| null,
    'Como Vendem Hoje':   desc['Como Vendem Hoje']   || null,
    'Concorrentes':       desc['Concorrentes']       || null,
    'Observações':        desc['Observações']        || null,
  };

  return { cf: dados, fichaId: ficha.id };
}
