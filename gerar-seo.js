'use strict';
const fs   = require('fs');
const path = require('path');

// ── CONFIG ──────────────────────────────────────────────────────────────────
const ROOT      = __dirname;
const BASE_URL  = 'https://pscont.com.br';
const TEMPLATE  = path.join(ROOT, 'seo', '_template-cidade.html');
const TODAY     = new Date().toISOString().split('T')[0];

const cidades  = require('./data/cidades.json');
const servicos = require('./data/servicos.json');

// ── HELPERS ─────────────────────────────────────────────────────────────────
function replaceAll(str, map) {
  let out = str;
  for (const [key, value] of Object.entries(map)) {
    out = out.split(key).join(value);
  }
  return out;
}

function buildCitiesGrid(servico, cidadeAtual) {
  const outras = cidades.filter(c => c.slug !== cidadeAtual.slug).slice(0, 10);
  const chips = outras
    .map(c => `        <a href="/${servico.slug}-em-${c.slug}-${c.estadoSlug}" class="city-chip">${c.nome}</a>`)
    .join('\n');
  return `<div class="cities-grid">\n${chips}\n      </div>`;
}

// ── GERAÇÃO ─────────────────────────────────────────────────────────────────
const templateRaw = fs.readFileSync(TEMPLATE, 'utf8')
  .replace(/<!--[\s\S]*?ANO[\s\S]*?-->\s*/, ''); // remove comentário de instruções de uso do template
const sitemapUrls = [];
let total = 0;

for (const servico of servicos) {
  for (const cidade of cidades) {
    const slug = `${servico.slug}-em-${cidade.slug}-${cidade.estadoSlug}`;

    const map = {
      '{{SERVICO_SLUG}}': servico.slug,
      '{{SERVICO}}':      servico.nome,
      '{{CIDADE_SLUG}}':  cidade.slug,
      '{{CIDADE}}':       cidade.nome,
      '{{ESTADO_SLUG}}':  cidade.estadoSlug,
      '{{ESTADO}}':       cidade.estado,
    };

    let html = replaceAll(templateRaw, map);
    html = html.replace(/<div class="cities-grid">[\s\S]*?<\/div>/, buildCitiesGrid(servico, cidade));

    const outDir = path.join(ROOT, slug);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');

    sitemapUrls.push({ loc: `${BASE_URL}/${slug}`, priority: servico.prioridade });
    total++;
  }
}

// ── SITEMAP-SEO.XML ─────────────────────────────────────────────────────────
const urlsXml = sitemapUrls
  .map(u => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${TODAY}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`)
  .join('\n\n');

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<!-- PS Contabilidade — Sitemap SEO Programático (gerado por gerar-seo.js em ${TODAY}) -->\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n\n${urlsXml}\n\n</urlset>\n`;

fs.writeFileSync(path.join(ROOT, 'sitemap-seo.xml'), sitemapXml, 'utf8');

console.log(`OK: ${total} páginas geradas (${servicos.length} serviços x ${cidades.length} cidades).`);
console.log(`Sitemap: sitemap-seo.xml (${sitemapUrls.length} URLs).`);
