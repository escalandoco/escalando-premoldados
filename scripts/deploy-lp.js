#!/usr/bin/env node
/**
 * ESCALANDO PREMOLDADOS — Deploy de LP via FTP
 *
 * Uso:
 *   node scripts/deploy-lp.js --cliente=concrenor
 *   node scripts/deploy-lp.js --cliente=concrenor --arquivo=lp/concrenor/index.html
 *   node scripts/deploy-lp.js --cliente=concrenor --dry-run
 *
 * Configuração por cliente em config/deploy-clients.json
 *
 * Variáveis de ambiente (opcionais — substituem config):
 *   FTP_HOST, FTP_USER, FTP_PASS
 */

import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// ---- CLI args ----
const args = {};
for (const a of process.argv.slice(2)) {
  const [k, ...v] = a.replace(/^--/, '').split('=');
  args[k] = v.join('=') || true;
}

if (!args.cliente) {
  console.error('Uso: node scripts/deploy-lp.js --cliente=SLUG');
  console.error('     node scripts/deploy-lp.js --cliente=concrenor');
  console.error('     node scripts/deploy-lp.js --cliente=concrenor --dry-run');
  process.exit(1);
}

// ---- Carrega config de clientes ----
const configPath = path.join(ROOT, 'config', 'deploy-clients.json');
if (!fs.existsSync(configPath)) {
  console.error(`❌ config/deploy-clients.json não encontrado.`);
  console.error('   Crie o arquivo com as credenciais FTP por cliente.');
  console.error('   Veja docs/playbooks/deploy-lp.md para o formato.');
  process.exit(1);
}

const deployClients = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const cliente = deployClients[args.cliente];

if (!cliente) {
  const disponiveis = Object.keys(deployClients).join(', ');
  console.error(`❌ Cliente "${args.cliente}" não encontrado em config/deploy-clients.json`);
  console.error(`   Clientes disponíveis: ${disponiveis}`);
  process.exit(1);
}

// Credenciais: variáveis de ambiente têm prioridade
const ftpHost = process.env.FTP_HOST || cliente.ftp_host;
const ftpUser = process.env.FTP_USER || cliente.ftp_user;
const ftpPass = process.env.FTP_PASS || cliente.ftp_pass;
const ftpPath = cliente.ftp_path;  // ex: /concrenor.escalando.co/

if (!ftpHost || !ftpUser || !ftpPass || !ftpPath) {
  console.error('❌ Credenciais FTP incompletas. Verifique config/deploy-clients.json');
  process.exit(1);
}

// Arquivo a ser deployado — tenta dist/ primeiro, depois lp/
let arquivoLocal;
if (args.arquivo) {
  arquivoLocal = path.resolve(ROOT, args.arquivo);
} else {
  const distPath = path.join(ROOT, 'dist', args.cliente, 'index.html');
  const lpPath   = path.join(ROOT, 'lp', args.cliente, 'index.html');
  arquivoLocal = fs.existsSync(distPath) ? distPath : lpPath;
}

if (!fs.existsSync(arquivoLocal)) {
  console.error(`❌ Arquivo não encontrado: ${arquivoLocal}`);
  console.error(`   Gere a LP primeiro: node scripts/gerar-lp.js --empresa="${cliente.nome || args.cliente}"`);
  process.exit(1);
}

const nomeArquivo = path.basename(arquivoLocal);
const urlFinal    = cliente.url || `https://${args.cliente}.escalando.co/`;

console.log('\n🚀 Deploy de LP — Escalando Premoldados');
console.log('─'.repeat(50));
console.log(`  Cliente:  ${args.cliente}`);
console.log(`  Arquivo:  ${arquivoLocal}`);
console.log(`  FTP host: ${ftpHost}`);
console.log(`  FTP path: ${ftpPath}${nomeArquivo}`);
console.log(`  URL:      ${urlFinal}`);
console.log('─'.repeat(50));

if (args['dry-run']) {
  console.log('\n⚠️  DRY RUN — nenhum arquivo enviado.');
  process.exit(0);
}

// ---- Deploy via Python ftplib (usa temp files para evitar shell interpolation) ----
const tmpHtml = path.join(os.tmpdir(), `esc-lp-${Date.now()}.html`);
const tmpPy   = path.join(os.tmpdir(), `esc-ftp-${Date.now()}.py`);

fs.copyFileSync(arquivoLocal, tmpHtml);

const pythonScript = `
import ftplib, sys

host     = ${JSON.stringify(ftpHost)}
user     = ${JSON.stringify(ftpUser)}
password = ${JSON.stringify(ftpPass)}
ftp_path = ${JSON.stringify(ftpPath)}
filename = ${JSON.stringify(nomeArquivo)}
local_file = ${JSON.stringify(tmpHtml)}

try:
    ftp = ftplib.FTP()
    ftp.connect(host, 21, timeout=30)
    ftp.login(user, password)
    ftp.set_pasv(True)

    parts = [p for p in ftp_path.split('/') if p]
    for part in parts:
        try:
            ftp.cwd(part)
        except ftplib.error_perm:
            ftp.mkd(part)
            ftp.cwd(part)

    with open(local_file, 'rb') as f:
        ftp.storbinary(f'STOR {filename}', f)
    ftp.quit()
    print(f'OK:{ftp_path}{filename}')
except Exception as e:
    print(f'ERROR:{e}', file=sys.stderr)
    sys.exit(1)
`;

fs.writeFileSync(tmpPy, pythonScript, 'utf8');
console.log('\n📤 Enviando via FTP...');

try {
  const r = spawnSync('python3', [tmpPy], { encoding: 'utf8', timeout: 60000 });
  const result = (r.stdout || '').trim();
  const errOut = (r.stderr || '').trim();

  if (r.status !== 0 || !result.startsWith('OK:')) {
    throw new Error(errOut || result || 'FTP falhou sem mensagem de erro');
  }

  console.log(`\n✅ index.html deployado!`);
  console.log(`   Arquivo: ${result.replace('OK:', '')}`);
} catch (err) {
  console.error(`\n❌ Erro no deploy:`);
  console.error(`   ${err.message}`);
  process.exit(1);
} finally {
  try { fs.unlinkSync(tmpHtml); } catch {}
  try { fs.unlinkSync(tmpPy); } catch {}
}

// ---- Deploy de sitemap.xml e robots.txt (SEO) ----
const distDir = path.join(path.dirname(arquivoLocal));
for (const seoFile of ['sitemap.xml', 'robots.txt']) {
  const seoPath = path.join(distDir, seoFile);
  if (!fs.existsSync(seoPath)) continue;

  const tmpSeo   = path.join(os.tmpdir(), `esc-seo-${Date.now()}.tmp`);
  const tmpSeoPy = path.join(os.tmpdir(), `esc-seo-${Date.now()}.py`);
  fs.copyFileSync(seoPath, tmpSeo);

  const seoPython = `
import ftplib, sys
ftp = ftplib.FTP()
ftp.connect(${JSON.stringify(ftpHost)}, 21, timeout=30)
ftp.login(${JSON.stringify(ftpUser)}, ${JSON.stringify(ftpPass)})
ftp.set_pasv(True)
parts = [p for p in ${JSON.stringify(ftpPath)}.split('/') if p]
for part in parts:
    try: ftp.cwd(part)
    except: ftp.mkd(part); ftp.cwd(part)
with open(${JSON.stringify(tmpSeo)}, 'rb') as f:
    ftp.storbinary('STOR ${seoFile}', f)
ftp.quit()
print('OK')
`;
  fs.writeFileSync(tmpSeoPy, seoPython, 'utf8');
  try {
    const r = spawnSync('python3', [tmpSeoPy], { encoding: 'utf8', timeout: 30000 });
    if (r.status === 0) console.log(`✅ ${seoFile} deployado`);
    else console.warn(`⚠️  ${seoFile}: ${r.stderr}`);
  } catch (e) {
    console.warn(`⚠️  ${seoFile}: ${e.message}`);
  } finally {
    try { fs.unlinkSync(tmpSeo); } catch {}
    try { fs.unlinkSync(tmpSeoPy); } catch {}
  }
}

console.log(`\n   URL:     ${urlFinal}`);
console.log(`\n📋 Smoke test:`);
console.log(`   curl -s -o /dev/null -w "%{http_code}" ${urlFinal}`);
