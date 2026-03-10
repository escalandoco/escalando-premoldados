#!/usr/bin/env node
/**
 * ESCALANDO PREMOLDADOS — Gerador de Landing Page
 *
 * Uso:
 *   node scripts/gerar-lp.js --empresa=Concrenor
 *   node scripts/gerar-lp.js --empresa=Concrenor --config=config/lp-concrenor.json
 *   node scripts/gerar-lp.js --empresa=Concrenor --no-upload
 *   node scripts/gerar-lp.js --empresa=Concrenor --sync-ficha
 *
 * O script:
 *   1. Lê config JSON (local ou do ClickUp)
 *   2. Renderiza template-lp.html com os dados reais
 *   3. Salva em dist/{slug}/index.html
 *   4. Faz upload para lp.escalando.co/{slug}/
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { verificarGate } from './quality-gate.js';
import { validarConfig } from './validar-config-lp.js';
import { sincronizarFicha } from './sincronizar-ficha.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.join(__dirname, '..');

// ---- Env ----
const CLICKUP_API_KEY  = process.env.CLICKUP_API_KEY  || 'pk_84613660_MVXFF2FG90QSK6YN1RLF1LBA7C4NXK7J';
const SPACE_CLIENTES   = process.env.CLICKUP_SPACE_ID || '901313553858';
const BASE_URL         = 'https://api.clickup.com/api/v2';

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

const empresa  = args.empresa;
const lpNome   = args.lp || '';          // nome da campanha/LP (opcional)
const noUpload = args.upload === false;
const force     = args.force === true || args['skip-gate'] === true;
const syncFicha = args['sync-ficha'] === true;

if (!empresa) {
  console.error('Uso: node scripts/gerar-lp.js --empresa=NomeEmpresa [--lp=NomeCampanha] [--config=arquivo.json] [--no-upload] [--sync-ficha]');
  process.exit(1);
}

function toSlug(str) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const slugCliente   = toSlug(empresa);
const slugCampanha  = lpNome ? toSlug(lpNome) : 'geral';
const slug          = `${slugCliente}/${slugCampanha}`;

// ============================================================
// MAIN
// ============================================================
async function main() {
  const lpLabel = lpNome ? ` — ${lpNome}` : '';
  console.log(`\n🔧 Gerando LP: ${empresa}${lpLabel} → lp.escalando.co/${slug}/\n`);

  // 0. Sync Ficha do Cliente (se --sync-ficha)
  if (syncFicha) {
    console.log('Sincronizando Ficha do Cliente antes de gerar...');
    try {
      const rel = await sincronizarFicha(empresa, { campanha: lpNome });
      if (rel.fichaLida) {
        const total = rel.camposSincronizados.length + rel.camposNovos.length;
        if (total > 0) {
          console.log(`Ficha sincronizada: ${total} campo(s) atualizado(s) no config JSON.`);
        } else {
          console.log('Ficha sincronizada: config ja estava em dia.');
        }
        if (rel.checklistMarcados.length > 0) {
          console.log(`Checklist [FASE 1]: ${rel.checklistMarcados.length} item(s) marcado(s).`);
        }
      } else {
        console.warn('Ficha nao encontrada — continuando com config existente.');
      }
      if (rel.erros.length > 0) {
        rel.erros.forEach(e => console.warn(`  ${e}`));
      }
    } catch (err) {
      console.warn(`Erro ao sincronizar Ficha: ${err.message} — continuando com config existente.`);
    }
    console.log('');
  }

  // 1. Lê config
  let config;
  if (args.config) {
    console.log(`📂 Lendo config local: ${args.config}`);
    config = JSON.parse(fs.readFileSync(path.resolve(args.config), 'utf8'));
  } else {
    console.log('🔗 Buscando config no ClickUp...');
    config = await fetchConfigFromClickUp(empresa);
  }

  // 2. Garante campos obrigatórios
  config = preencherDefaults(config, empresa);

  // 2b. Valida config — campos "A DEFINIR" e obrigatórios
  const validacao = validarConfig(config);
  if (validacao.avisos.length > 0) {
    console.log(`⚠️  ${validacao.avisos.length} aviso(s) no config:`);
    validacao.avisos.forEach(a => console.log(`   ⚠  ${a}`));
    console.log('');
  }
  if (!validacao.valido) {
    console.log(`❌ Config inválido — ${validacao.erros.length} erro(s):`);
    validacao.erros.forEach(e => console.log(`   ✗ ${e}`));
    if (!force) {
      console.log('\n💡 Use --force para gerar mesmo assim (não recomendado para produção).\n');
      process.exit(1);
    }
    console.log('\n⚠️  --force ativo: gerando mesmo com erros no config.\n');
  }

  // 2c. Quality Gate — verifica se Fase 3 (Identidade Visual) está aprovada
  if (!force) {
    console.log('🔍 Verificando Quality Gate (Fase 4)...');
    const campanha = lpNome || 'Geral';
    const gate = await verificarGate(empresa, campanha, 4);
    if (!gate.ok) {
      console.log(`\n🚫 BLOQUEADO — ${gate.motivo}`);
      if (gate.faltando.length > 0) {
        console.log('\n   Pendências:');
        gate.faltando.forEach(f => console.log(`   • ${f}`));
      }
      console.log('\n💡 Use --force para gerar sem verificar o gate.\n');
      process.exit(1);
    }
    console.log(`✅ Gate OK — ${gate.motivo}\n`);
  } else {
    console.log('⚠️  --force ativo: Quality Gate ignorado.\n');
  }

  // 3. Renderiza HTML
  console.log('🖨️  Renderizando template...');
  const html = renderTemplate(config);

  // 4. Salva localmente
  const distDir = path.join(ROOT, 'dist', slug);
  fs.mkdirSync(distDir, { recursive: true });
  const outFile = path.join(distDir, 'index.html');
  fs.writeFileSync(outFile, html, 'utf8');
  console.log(`✅ Salvo em: dist/${slug}/index.html`);

  // 4b. Sitemap.xml + robots.txt (SEO)
  const lpUrl = config.url || `https://${slugCliente}.escalando.co/`;
  const hoje  = new Date().toISOString().split('T')[0];

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${lpUrl}</loc>
    <lastmod>${hoje}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`;
  fs.writeFileSync(path.join(distDir, 'sitemap.xml'), sitemap, 'utf8');

  const robots = `User-agent: *\nAllow: /\nSitemap: ${lpUrl}sitemap.xml\n`;
  fs.writeFileSync(path.join(distDir, 'robots.txt'), robots, 'utf8');
  console.log(`✅ sitemap.xml e robots.txt gerados`);

  // 5. Upload FTP
  if (noUpload) {
    console.log('⏭️  Upload pulado (--no-upload)');
  } else {
    console.log(`🚀 Fazendo upload para lp.escalando.co/${slug}/...`);
    uploadFTP(outFile, slug);
    const lpUrl = `https://lp.escalando.co/${slug}/`;
    console.log(`✅ LP no ar: ${lpUrl}`);

    // 6. Notifica ClickUp — status "LP Pronta para Review" + comentário com link
    await notificarReview(empresa, lpNome, lpUrl);
  }

  console.log('\n🎉 Concluído!\n');
}

// ============================================================
// CLICKUP — busca task "Gerar LP — {empresa}" e extrai JSON
// ============================================================
async function fetchConfigFromClickUp(empresa) {
  const { folders } = await cu('get', `/space/${SPACE_CLIENTES}/folder?archived=false`);
  const folder = folders.find(f => f.name.toLowerCase() === empresa.toLowerCase());
  if (!folder) throw new Error(`Folder "${empresa}" não encontrado no ClickUp.`);

  const { lists } = await cu('get', `/folder/${folder.id}/list?archived=false`);

  // Busca primeiro na lista "Landing Pages" (nova estrutura do pipeline)
  // Fallback para "Onboarding" (estrutura legada)
  const landingPages = lists.find(l => l.name.toLowerCase() === 'landing pages');
  const onboardingList = lists.find(l => l.name === 'Onboarding');

  let onboarding = landingPages || onboardingList;
  if (!onboarding) throw new Error('Lista "Landing Pages" ou "Onboarding" não encontrada.');

  console.log(`📋 Buscando config na lista: "${onboarding.name}"`);

  const { tasks } = await cu('get', `/list/${onboarding.id}/task?archived=false`);
  // Busca pela empresa + campanha se fornecida, senão pega a primeira "Gerar LP"
  const prefixo = lpNome
    ? `gerar lp — ${empresa.toLowerCase()} — ${lpNome.toLowerCase()}`
    : `gerar lp — ${empresa.toLowerCase()}`;
  const lpTask = tasks.find(t => t.name.toLowerCase().startsWith(prefixo))
    || tasks.find(t => t.name.toLowerCase().startsWith('gerar lp'));
  if (!lpTask) throw new Error(`Task "Gerar LP" para "${empresa}" não encontrada.`);

  // Busca comentários — procura bloco JSON
  const { comments } = await cu('get', `/task/${lpTask.id}/comment`);
  for (const c of (comments || [])) {
    const match = c.comment_text?.match(/```json\n([\s\S]+?)\n```/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch {}
    }
  }

  // Fallback: tenta parsear da descrição
  console.warn('⚠️  JSON não encontrado nos comentários. Usando defaults.');
  return parseDescricao(lpTask.description || '', empresa);
}

// ============================================================
// PARSER de fallback (descrição markdown)
// ============================================================
function parseDescricao(desc, empresa) {
  const linha = (campo) => {
    const m = desc.match(new RegExp(`\\*\\*${campo}:\\*\\*\\s*(.+)`));
    return m ? m[1].trim() : '';
  };
  return {
    empresa,
    slogan:        linha('Slogan'),
    estilo:        linha('Estilo visual') || 'clean',
    cor_primaria:  linha('Cor principal') || '#C4B470',
    cor_secundaria:linha('Cor secundária') || '#0D1117',
    whatsapp:      linha('WhatsApp'),
    cidade:        linha('Cidade sede'),
    regioes:       linha('Regiões de entrega'),
    headline:      linha('Headline sugerida'),
    produtos:      [],
    diferenciais:  [],
    depoimentos:   [],
  };
}

// ============================================================
// DEFAULTS para campos não preenchidos
// ============================================================
function preencherDefaults(c, empresa) {
  return {
    empresa:          c.empresa          || empresa,
    slogan:           c.slogan           || 'Qualidade em concreto pré-moldado',
    logo:             c.logo             || '/logo.png',
    cor_primaria:     c.cor_primaria     || '#C4B470',
    cor_secundaria:   c.cor_secundaria   || '#0D1117',
    estilo:           c.estilo           || 'clean',
    cor_texto:        c.cor_texto        || '#111827',
    cor_fundo:        c.cor_fundo        || '#F9FAFB',
    cor_borda:        c.cor_borda        || '#E5E7EB',
    cor_primaria_hover: c.cor_primaria_hover || '',
    fonte:            c.fonte            || 'system',
    fonte_peso_titulo: c.fonte_peso_titulo || '800',
    fonte_peso_texto:  c.fonte_peso_texto  || '400',
    raio_borda:       c.raio_borda       || '12px',
    whatsapp:       c.whatsapp       || '5500000000000',
    whatsapp_msg:   c.whatsapp_msg   || 'Olá! Vim pelo site e gostaria de um orçamento.',
    telefone:       c.telefone       || '',
    cidade:         c.cidade         || '',
    endereco:       c.endereco       || '',
    headline:       c.headline       || `Pré-moldados de qualidade para ${empresa}`,
    subheadline:    c.subheadline    || 'Fábrica própria, entrega rápida e preço justo para construtoras, fazendeiros e prefeituras.',
    badge:          c.badge          || 'Fábrica de Pré-moldados',
    numeros:        c.numeros        || [
      { valor: '10+',  label: 'Anos de experiência' },
      { valor: '500+', label: 'Obras atendidas' },
      { valor: '48h',  label: 'Prazo de entrega' },
    ],
    produtos:    c.produtos    || [],
    diferenciais:c.diferenciais || [
      { icone: '🏭', titulo: 'Fábrica própria',       desc: 'Produção própria garante qualidade controlada e preço direto.' },
      { icone: '🚚', titulo: 'Entrega rápida',         desc: 'Entregamos com agilidade para as principais regiões.' },
      { icone: '📐', titulo: 'Medidas personalizadas', desc: 'Produzimos sob medida conforme a necessidade do projeto.' },
      { icone: '🤝', titulo: 'Atendimento direto',     desc: 'Fale direto com quem produz, sem intermediários.' },
    ],
    depoimentos: c.depoimentos || [],
    regioes:     c.regioes     || [],
    pixel_meta:  c.pixel_meta  || '',
    ga4:         c.ga4         || '',
    gtm_id:      c.gtm_id      || '',
    webhook:     'https://escalando-premoldados.vercel.app/api/onboarding',
  };
}

// ============================================================
// RENDER — substitui o bloco CONFIG no template
// ============================================================
function renderTemplate(config) {
  const templatePath = path.join(ROOT, 'lp', 'template-lp.html');
  let html = fs.readFileSync(templatePath, 'utf8');

  const configStr = `const CONFIG = ${JSON.stringify(config, null, 2)};`;

  // Substitui o bloco "const CONFIG = { ... };"
  html = html.replace(/const CONFIG = \{[\s\S]*?\};/, configStr);

  // Injeta Google Fonts no <head> para SSR/SEO
  if (config.fonte && config.fonte !== 'system') {
    const fontUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(config.fonte)}:wght@${config.fonte_peso_texto||400};600;${config.fonte_peso_titulo||800}&display=swap`;
    html = html.replace(
      '<link id="google-font" rel="stylesheet" href="">',
      `<link id="google-font" rel="stylesheet" href="${fontUrl}">`
    );
  }

  // Atualiza o <title>
  html = html.replace('<title id="page-title">LP</title>', `<title id="page-title">${config.empresa} — Pré-moldados</title>`);

  // Ativa Pixel Meta se configurado
  if (config.pixel_meta) {
    const pixelCode = `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${config.pixel_meta}');fbq('track','PageView');`;
    html = html.replace(
      /\/\/ !function\(f,b,e,v,n,t,s\).*?fbq\('track','PageView'\);/s,
      pixelCode
    );
  }

  // Ativa GA4 se configurado (sem GTM)
  if (config.ga4 && !config.gtm_id) {
    const ga4Code = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtag/js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${config.ga4}');window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${config.ga4}');`;
    html = html.replace(
      /\/\/ \(function\(w,d,s,l,i\).*?\('GA4_ID'\)/s,
      ga4Code
    );
  }

  // Ativa GTM se configurado (gerencia GA4 + Google Ads Conversion)
  if (config.gtm_id) {
    const gtmHead = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${config.gtm_id}');window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}`;
    html = html.replace(
      /\/\/ \(function\(w,d,s,l,i\)\{w\[l\]=w\[l\]\|\|\[\].*?\('GTM-XXXXXXX'\)/s,
      gtmHead
    );
    const gtmNoscript = `<iframe src="https://www.googletagmanager.com/ns.html?id=${config.gtm_id}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
    html = html.replace(
      '<noscript id="gtm-noscript"></noscript>',
      `<noscript id="gtm-noscript">${gtmNoscript}</noscript>`
    );
  }

  // ---- SEO: title com keyword local ----
  const cidade = config.cidade || '';
  const titleSEO = cidade
    ? `${config.empresa} — Pré-moldados de concreto em ${cidade}`
    : `${config.empresa} — Pré-moldados de concreto`;

  html = html.replace(
    /<title id="page-title">.*?<\/title>/,
    `<title id="page-title">${titleSEO}</title>`
  );

  // ---- SEO: meta description estática ----
  const regioesList = Array.isArray(config.regioes)
    ? config.regioes.join(', ')
    : (config.regioes || cidade);
  const descSEO = config.subheadline
    || `${config.empresa} fornece pré-moldados de concreto com entrega em ${regioesList || cidade}. Solicite orçamento grátis.`;

  html = html.replace(
    'id="page-desc" content=""',
    `id="page-desc" content="${descSEO.replace(/"/g, '&quot;')}"`
  );

  // ---- SEO: canonical + Open Graph ----
  const urlCanonica = config.url || '';
  if (urlCanonica) {
    html = html.replace('id="canonical" href=""', `id="canonical" href="${urlCanonica}"`);
    html = html.replace('id="og-url"         content=""', `id="og-url"         content="${urlCanonica}"`);
  }
  html = html.replace('id="og-title"       content=""', `id="og-title"       content="${titleSEO.replace(/"/g, '&quot;')}"`);
  html = html.replace('id="og-description" content=""', `id="og-description" content="${descSEO.replace(/"/g, '&quot;')}"`);

  // ---- SEO: Schema JSON-LD (LocalBusiness + Products) ----
  const schema = _buildSchema(config, titleSEO, urlCanonica);
  html = html.replace(
    '<script id="schema-markup" type="application/ld+json"></script>',
    `<script id="schema-markup" type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`
  );

  return html;
}

// ============================================================
// SCHEMA JSON-LD builder
// ============================================================
function _buildSchema(config, titleSEO, url) {
  const graph = [];

  // LocalBusiness
  const localBusiness = {
    '@type':       'LocalBusiness',
    '@id':          url || undefined,
    'name':         config.empresa,
    'description':  config.subheadline || titleSEO,
    'url':          url || undefined,
    'telephone':    config.telefone   || undefined,
    'image':        config.logo       || undefined,
    'address': {
      '@type':           'PostalAddress',
      'addressLocality':  config.cidade        || undefined,
      'addressRegion':    config.estado        || undefined,
      'addressCountry':  'BR',
    },
    'areaServed': Array.isArray(config.regioes) && config.regioes.length
      ? config.regioes.map(r => ({ '@type': 'State', 'name': r }))
      : undefined,
    'priceRange': '$$',
    'sameAs': config.gmb_url ? [config.gmb_url] : undefined,
  };

  // Remove keys with undefined values (nested)
  graph.push(JSON.parse(JSON.stringify(localBusiness)));

  // Products (um por produto no config)
  if (Array.isArray(config.produtos) && config.produtos.length) {
    config.produtos.forEach(p => {
      if (!p.nome) return;
      graph.push({
        '@type':       'Product',
        'name':         p.nome,
        'description':  p.desc || undefined,
        'image':        p.foto || undefined,
        'brand': { '@type': 'Brand', 'name': config.empresa },
        'offers': {
          '@type':           'Offer',
          'priceCurrency':   'BRL',
          'availability':    'https://schema.org/InStock',
          'seller': { '@type': 'Organization', 'name': config.empresa },
        },
      });
    });
  }

  return { '@context': 'https://schema.org', '@graph': graph };
}

// ============================================================
// FTP UPLOAD via Python
// ============================================================
function uploadFTP(localFile, slug) {
  // slug pode ser "concrenor/mourao-torneado"
  const parts = slug.split('/');
  const pyScript = `
import ftplib

ftp = ftplib.FTP('sh00204.hostgator.com.br')
ftp.login('jonmat48', '14@41959-Jg')
ftp.set_pasv(True)

base = '/lp.escalando.co'
parts = ${JSON.stringify(parts)}
for i in range(len(parts)):
    d = base + '/' + '/'.join(parts[:i+1])
    try: ftp.mkd(d)
    except: pass

remote_dir = base + '/' + '/'.join(parts)
with open('${localFile.replace(/\\/g, '\\\\')}', 'rb') as f:
    ftp.storbinary(f'STOR {remote_dir}/index.html', f)

logo_src = '/lp.escalando.co/logo.png'
try:
    with open('/Users/jongodeiro/Downloads/logo-escalando-icone-para-fundo-escuro.png', 'rb') as f:
        ftp.storbinary(f'STOR {remote_dir}/logo.png', f)
except:
    pass

ftp.quit()
print('OK')
`;

  const result = spawnSync('python3', ['-c', pyScript], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`FTP error: ${result.stderr}`);
  }
  return result.stdout.trim();
}

// ============================================================
// CLICKUP — notifica review após upload
// ============================================================
async function notificarReview(empresa, lpNome, lpUrl) {
  try {
    console.log('📋 Atualizando ClickUp...');

    // Encontra folder do cliente
    const { folders } = await cu('get', `/space/${SPACE_CLIENTES}/folder?archived=false`);
    const folder = folders.find(f => f.name.toLowerCase() === empresa.toLowerCase());
    if (!folder) { console.warn(`⚠️  Folder "${empresa}" não encontrado — ClickUp não atualizado.`); return; }

    // Encontra lista Onboarding
    const { lists } = await cu('get', `/folder/${folder.id}/list?archived=false`);
    const onboarding = lists.find(l => l.name === 'Onboarding');
    if (!onboarding) { console.warn('⚠️  Lista Onboarding não encontrada — ClickUp não atualizado.'); return; }

    // Encontra task da LP — busca por variações de nome
    const { tasks } = await cu('get', `/list/${onboarding.id}/task?archived=false`);
    const lpTask = tasks.find(t => {
      const n = t.name.toLowerCase();
      return n.includes('configurar lp') || n.includes('gerar lp') || n.includes('landing page');
    });
    if (!lpTask) { console.warn('⚠️  Task LP não encontrada — ClickUp não atualizado.'); return; }

    // Adiciona comentário com link e checklist
    const campaignLabel = lpNome ? ` — ${lpNome}` : '';
    const comentario = [
      `🚀 **LP gerada e no ar!**`,
      ``,
      `**Preview:** ${lpUrl}`,
      ``,
      `**Checklist antes de enviar ao cliente:**`,
      `- [ ] Mobile responsivo ok`,
      `- [ ] Formulário enviando corretamente`,
      `- [ ] Copy revisado`,
      `- [ ] WhatsApp funcionando`,
      `- [ ] Velocidade aceitável`,
      ``,
      `Após aprovação do cliente: mover para **Aprovado** para iniciar o deploy no domínio.`,
    ].join('\n');

    await cu('post', `/task/${lpTask.id}/comment`, { comment_text: comentario });

    console.log(`✅ ClickUp atualizado → status "review" + link adicionado`);
  } catch (err) {
    console.warn(`⚠️  ClickUp não atualizado: ${err.message}`);
  }
}

// ============================================================
// CLICKUP helper
// ============================================================
async function cu(method, urlPath, body) {
  const res = await fetch(`${BASE_URL}${urlPath}`, {
    method: method.toUpperCase(),
    headers: { Authorization: CLICKUP_API_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json));
  return json;
}

main().catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
