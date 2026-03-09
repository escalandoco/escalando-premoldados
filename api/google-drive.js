/**
 * Google Drive — Service Account module
 * Escalando Premoldados
 *
 * Estrutura de pastas por cliente:
 *   Clientes/
 *     {empresa}/
 *       01 - Briefing/
 *       02 - Criativos/
 *       03 - Relatórios/
 *       04 - Contratos/
 *       05 - Fotos/
 *       06 - CRM Leads/
 *         CRM — {empresa} (spreadsheet, se criado)
 *
 * Funções exportadas:
 *   criarPastaCliente(empresa)         → cria/detecta pasta do cliente com as 6 subpastas
 *   registrarLead(empresa, dados)      → adiciona linha na planilha CRM (aba Leads)
 *   registrarOrcamento(empresa, dados) → adiciona linha na planilha CRM (aba Orçamentos)
 */

import { google } from 'googleapis';

// Pasta "Clientes" dentro do Drive "Escalando Premoldados"
const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_CLIENTS_FOLDER_ID || '1MIvzKWOyA875Vvbq3D8P8B0qJb3NseOh';

const SUBFOLDERS = [
  '01 - Briefing',
  '02 - Criativos',
  '03 - Relatórios',
  '04 - Contratos',
  '05 - Fotos',
  '06 - CRM Leads',
];

function getAuth() {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_B64;
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!b64 && !raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_B64 não configurado.');
  const json = b64 ? Buffer.from(b64, 'base64').toString('utf8') : raw;
  const credentials = JSON.parse(json);
  return new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/spreadsheets',
    ],
  });
}

// ── CRIAR PASTA DO CLIENTE ────────────────────────────────────────────────────
export async function criarPastaCliente(empresa) {
  const auth = getAuth();
  const drive = google.drive({ version: 'v3', auth });

  // Verifica se a pasta do cliente já existe
  const existente = await drive.files.list({
    q: `name='${empresa}' and '${ROOT_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
    orderBy: 'createdTime',
  });

  let pastaId;
  if (existente.data.files.length > 0) {
    // Usa a pasta mais antiga (a original, não duplicata) — orderBy createdTime ASC → index 0
    pastaId = existente.data.files[0].id;
  } else {
    const pasta = await drive.files.create({
      requestBody: {
        name: empresa,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [ROOT_FOLDER_ID],
      },
      fields: 'id',
    });
    pastaId = pasta.data.id;
  }

  // Garante que as 6 subpastas existem
  const subIds = {};
  const subExistentes = await drive.files.list({
    q: `'${pastaId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  });
  for (const sub of subExistentes.data.files) subIds[sub.name] = sub.id;

  for (const nome of SUBFOLDERS) {
    if (!subIds[nome]) {
      const sub = await drive.files.create({
        requestBody: { name: nome, mimeType: 'application/vnd.google-apps.folder', parents: [pastaId] },
        fields: 'id',
      });
      subIds[nome] = sub.data.id;
    }
  }

  const fotosId   = subIds['05 - Fotos'];
  const crmFoldId = subIds['06 - CRM Leads'];

  // Planilha CRM dentro de "06 - CRM Leads" — busca qualquer spreadsheet existente
  // (Service Account não pode criar Workspace files — planilha deve ser criada manualmente)
  let planilhaId  = null;
  let planilhaUrl = null;
  try {
    const planilhaRes = await drive.files.list({
      q: `'${crmFoldId}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
      fields: 'files(id)',
      spaces: 'drive',
    });
    if (planilhaRes.data.files.length > 0) {
      planilhaId = planilhaRes.data.files[0].id;
      planilhaUrl = `https://docs.google.com/spreadsheets/d/${planilhaId}`;
    }
  } catch (err) {
    console.warn(`[Drive] Erro ao buscar planilha CRM de ${empresa}:`, err.message);
  }

  return {
    pastaId,
    fotosId,
    crmFolderId: crmFoldId,
    planilhaId,
    pastaUrl:      `https://drive.google.com/drive/folders/${pastaId}`,
    fotosUrl:      `https://drive.google.com/drive/folders/${fotosId}`,
    crmFolderUrl:  `https://drive.google.com/drive/folders/${crmFoldId}`,
    planilhaUrl,
    pastaDriveUrl: `https://drive.google.com/drive/folders/${pastaId}`,
  };
}

// ── HELPER: encontra planilha CRM do cliente ─────────────────────────────────
async function encontrarPlanilhaId(drive, empresa) {
  // Acha pasta do cliente (usa a mais antiga = original)
  const pasta = await drive.files.list({
    q: `name='${empresa}' and '${ROOT_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
    orderBy: 'createdTime',
  });
  if (!pasta.data.files.length) throw new Error(`Pasta do cliente "${empresa}" não encontrada.`);
  const pastaId = pasta.data.files[0].id;

  // Acha "06 - CRM Leads" subfolder
  const crm = await drive.files.list({
    q: `name='06 - CRM Leads' and '${pastaId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
  });
  if (!crm.data.files.length) throw new Error(`Subpasta "06 - CRM Leads" de "${empresa}" não encontrada.`);
  const crmId = crm.data.files[0].id;

  // Acha qualquer spreadsheet dentro de "06 - CRM Leads"
  const planilha = await drive.files.list({
    q: `'${crmId}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
  });
  if (!planilha.data.files.length) throw new Error(`Planilha de leads de "${empresa}" não encontrada em "06 - CRM Leads". Crie manualmente.`);
  return planilha.data.files[0].id;
}

// ── REGISTRAR LEAD ────────────────────────────────────────────────────────────
export async function registrarLead(empresa, d) {
  const auth = getAuth();
  const drive = google.drive({ version: 'v3', auth });
  const sheets = google.sheets({ version: 'v4', auth });

  const planilhaId = await encontrarPlanilhaId(drive, empresa);
  const data = d.data || new Date().toLocaleDateString('pt-BR');

  // Colunas: Data | Canal | Nome | Telefone | Cidade | Produto de Interesse | Valor Orçamento (R$) | Status | Último Contato | Dias sem Contato | Observação
  await sheets.spreadsheets.values.append({
    spreadsheetId: planilhaId,
    range: 'Leads!A:K',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [[
        data,
        d.canal || '',
        d.nome || '',
        d.telefone || '',
        d.cidade || d.regiao || '',
        d.interesse || '',
        d.valor_orcamento || '',
        'Novo',
        '',
        '',
        d.obs || '',
      ]],
    },
  });

  return {
    msg: `Lead registrado na planilha CRM de ${empresa}.`,
    planilhaUrl: `https://docs.google.com/spreadsheets/d/${planilhaId}`,
  };
}

// ── ATUALIZAR STATUS DO LEAD ──────────────────────────────────────────────────
/**
 * Atualiza a coluna Status (H) de um lead na aba Leads pelo telefone.
 * Se novoStatus = "Pagamento Confirmado", preenche também Data Fechamento (J) e Valor (K).
 */
export async function atualizarStatusLead(empresa, telefone, novoStatus, valorVenda) {
  const auth = getAuth();
  const drive = google.drive({ version: 'v3', auth });
  const sheets = google.sheets({ version: 'v4', auth });

  const planilhaId = await encontrarPlanilhaId(drive, empresa);

  // Lê todas as linhas da aba Leads
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: planilhaId,
    range: 'Leads!A:M',
  });

  const rows = response.data.values || [];
  const digitos = telefone.replace(/\D/g, '');

  // Busca linha pelo telefone (coluna D = índice 3)
  // Estrutura da planilha: A=Data | B=Canal | C=Nome | D=Telefone | E=Cidade | F=Produto | G=Valor Orç | H=Status | I=Último Contato | J=Dias sem Contato | K=Obs
  let rowIndex = -1;
  for (let i = 1; i < rows.length; i++) {
    const celula = (rows[i][3] || '').replace(/\D/g, '');
    if (celula && (celula === digitos || celula.endsWith(digitos.slice(-9)) || digitos.endsWith(celula.slice(-9)))) {
      rowIndex = i + 1; // Sheets API usa índice 1-based
      break;
    }
  }

  if (rowIndex === -1) {
    console.warn(`[sheets] Lead ${telefone} não encontrado em ${empresa} — ignorando update de status`);
    return { ok: false, reason: 'lead_not_found' };
  }

  // Monta updates
  const updates = [
    { range: `Leads!H${rowIndex}`, values: [[novoStatus]] },                                    // Status
    { range: `Leads!I${rowIndex}`, values: [[new Date().toLocaleDateString('pt-BR')]] },        // Último Contato
  ];

  if (novoStatus === 'Pagamento Confirmado' && valorVenda) {
    updates.push({ range: `Leads!G${rowIndex}`, values: [[valorVenda]] });                      // Valor Orçamento
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: planilhaId,
    requestBody: { valueInputOption: 'RAW', data: updates },
  });

  console.log(`[sheets] Status do lead ${telefone} → "${novoStatus}" (linha ${rowIndex})`);
  return { ok: true, row: rowIndex, status: novoStatus };
}

// ── REGISTRAR ORÇAMENTO ───────────────────────────────────────────────────────
export async function registrarOrcamento(empresa, d) {
  const auth = getAuth();
  const drive = google.drive({ version: 'v3', auth });
  const sheets = google.sheets({ version: 'v4', auth });

  const planilhaId = await encontrarPlanilhaId(drive, empresa);
  const data = d.data || new Date().toLocaleDateString('pt-BR');

  const itensTexto = (d.itens || []).map(i =>
    `${i.nome || i.produto || '?'}: ${i.qtd || 1}x R$${i.preco || '0'}`
  ).join(' | ');

  const subtotalItens = (d.itens || []).reduce((s, i) =>
    s + ((i.qtd || 1) * (parseFloat(String(i.preco || 0).replace(/[^\d.]/g, '')) || 0)), 0
  );
  const frete = parseFloat(d.frete) || 0;
  const total = (subtotalItens + frete).toFixed(2);

  // Colunas: Data | Canal | Nome | Telefone | Região | Itens | Total (R$) | Prazo | Status | Observação
  await sheets.spreadsheets.values.append({
    spreadsheetId: planilhaId,
    range: 'Orçamentos!A:J',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [[data, d.canal || '', d.nome || '', d.telefone || '', d.regiao || '', itensTexto, total, d.prazo || '', 'Novo', d.obs || '']],
    },
  });

  return {
    msg: `Orçamento registrado na planilha CRM de ${empresa}.`,
    planilhaUrl: `https://docs.google.com/spreadsheets/d/${planilhaId}`,
  };
}
