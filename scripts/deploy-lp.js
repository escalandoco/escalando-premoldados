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

import { execSync } from 'child_process';
import fs from 'fs';
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

// Arquivo a ser deployado
const arquivoLocal = args.arquivo
  ? path.resolve(ROOT, args.arquivo)
  : path.join(ROOT, 'lp', args.cliente, 'index.html');

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

// ---- Deploy via Python ftplib ----
const htmlContent = fs.readFileSync(arquivoLocal, 'utf8');

const pythonScript = `
import ftplib, io, sys

host     = ${JSON.stringify(ftpHost)}
user     = ${JSON.stringify(ftpUser)}
password = ${JSON.stringify(ftpPass)}
ftp_path = ${JSON.stringify(ftpPath)}
filename = ${JSON.stringify(nomeArquivo)}
content  = ${JSON.stringify(htmlContent)}

try:
    ftp = ftplib.FTP()
    ftp.connect(host, 21, timeout=30)
    ftp.login(user, password)
    ftp.set_pasv(True)

    # Navega para o diretório
    parts = [p for p in ftp_path.split('/') if p]
    for part in parts:
        try:
            ftp.cwd(part)
        except ftplib.error_perm:
            ftp.mkd(part)
            ftp.cwd(part)

    # Envia arquivo
    bio = io.BytesIO(content.encode('utf-8'))
    ftp.storbinary(f'STOR {filename}', bio)
    ftp.quit()
    print(f'OK:{ftp_path}{filename}')
except Exception as e:
    print(f'ERROR:{e}', file=sys.stderr)
    sys.exit(1)
`;

console.log('\n📤 Enviando via FTP...');

try {
  const result = execSync(`python3 -c ${JSON.stringify(pythonScript)}`, {
    encoding: 'utf8',
    timeout: 60000,
  }).trim();

  if (result.startsWith('OK:')) {
    console.log(`\n✅ index.html deployado!`);
    console.log(`   Arquivo: ${result.replace('OK:', '')}`);
  } else {
    throw new Error(result);
  }
} catch (err) {
  console.error(`\n❌ Erro no deploy:`);
  console.error(`   ${err.stderr || err.message}`);
  process.exit(1);
}

// ---- Deploy de sitemap.xml e robots.txt (SEO) ----
const distDir = path.join(path.dirname(arquivoLocal));
for (const seoFile of ['sitemap.xml', 'robots.txt']) {
  const seoPath = path.join(distDir, seoFile);
  if (!fs.existsSync(seoPath)) continue;

  const seoContent = fs.readFileSync(seoPath, 'utf8');
  const seoPython = `
import ftplib, io, sys
ftp = ftplib.FTP()
ftp.connect(${JSON.stringify(ftpHost)}, 21, timeout=30)
ftp.login(${JSON.stringify(ftpUser)}, ${JSON.stringify(ftpPass)})
ftp.set_pasv(True)
parts = [p for p in ${JSON.stringify(ftpPath)}.split('/') if p]
for part in parts:
    try: ftp.cwd(part)
    except: ftp.mkd(part); ftp.cwd(part)
bio = io.BytesIO(${JSON.stringify(seoContent)}.encode('utf-8'))
ftp.storbinary('STOR ${seoFile}', bio)
ftp.quit()
print('OK')
`;
  try {
    execSync(`python3 -c ${JSON.stringify(seoPython)}`, { encoding: 'utf8', timeout: 30000 });
    console.log(`✅ ${seoFile} deployado`);
  } catch (e) {
    console.warn(`⚠️  ${seoFile}: ${e.message}`);
  }
}

console.log(`\n   URL:     ${urlFinal}`);
console.log(`\n📋 Smoke test:`);
console.log(`   curl -s -o /dev/null -w "%{http_code}" ${urlFinal}`);
