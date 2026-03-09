/**
 * dossie.js — Módulo para escrita no Dossiê do Cliente (ClickUp Docs)
 *
 * Exporta:
 *   appendSection(cliente, pagina, conteudo) → adiciona entrada datada à página
 *   overwriteSection(cliente, pagina, conteudo) → substitui conteúdo da página
 *
 * Páginas disponíveis: kickoff | briefing | performance | benchmarking | estrategia
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const WS   = '90133050692';
const KEY  = process.env.CLICKUP_API_KEY;

function loadConfig(cliente) {
  const slug = cliente.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const configPath = path.join(ROOT, 'config', `dossie-${slug}.json`);
  if (!fs.existsSync(configPath)) {
    throw new Error(`Dossiê de "${cliente}" não encontrado. Execute criar-dossie.js primeiro.`);
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

async function getPage(docId, pageId) {
  const r = await fetch(`https://api.clickup.com/api/v3/workspaces/${WS}/docs/${docId}/pages/${pageId}`, {
    headers: { Authorization: KEY },
  });
  if (!r.ok) throw new Error(`GET page ${pageId} → ${r.status}: ${await r.text()}`);
  return r.json();
}

async function updatePage(docId, pageId, content) {
  const r = await fetch(`https://api.clickup.com/api/v3/workspaces/${WS}/docs/${docId}/pages/${pageId}`, {
    method: 'PUT',
    headers: { Authorization: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, content_format: 'text/md' }),
  });
  if (!r.ok) throw new Error(`PUT page ${pageId} → ${r.status}: ${await r.text()}`);
  const text = await r.text();
  return text ? JSON.parse(text) : { ok: true };
}

/**
 * Adiciona nova entrada datada ao final da página, preservando conteúdo existente.
 * Ideal para histórico de performance e benchmarking.
 */
export async function appendSection(cliente, pagina, conteudo) {
  if (!KEY) throw new Error('CLICKUP_API_KEY obrigatório.');
  const cfg    = loadConfig(cliente);
  const pageId = cfg.pages[pagina];
  if (!pageId) throw new Error(`Página "${pagina}" não encontrada no Dossiê de ${cliente}.`);

  const page       = await getPage(cfg.doc_id, pageId);
  const atual      = page.content || '';
  const data       = new Date().toLocaleDateString('pt-BR');
  const separador  = `\n\n---\n\n## 📅 ${data}\n\n`;
  const novoConteudo = atual + separador + conteudo;

  await updatePage(cfg.doc_id, pageId, novoConteudo);
  return { ok: true, pagina, doc_id: cfg.doc_id, page_id: pageId };
}

/**
 * Substitui todo o conteúdo da página.
 * Ideal para kickoff e briefing (dados atualizados, não histórico).
 */
export async function overwriteSection(cliente, pagina, conteudo) {
  if (!KEY) throw new Error('CLICKUP_API_KEY obrigatório.');
  const cfg    = loadConfig(cliente);
  const pageId = cfg.pages[pagina];
  if (!pageId) throw new Error(`Página "${pagina}" não encontrada no Dossiê de ${cliente}.`);

  await updatePage(cfg.doc_id, pageId, conteudo);
  return { ok: true, pagina, doc_id: cfg.doc_id, page_id: pageId };
}
