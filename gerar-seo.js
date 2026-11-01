'use strict';
const fs   = require('fs');
const path = require('path');

// ── CONFIG ──────────────────────────────────────────────────────────────────
const ROOT          = __dirname;
const BASE_URL      = 'https://pscontabilidadebh.com.br';
const TEMPLATE      = path.join(ROOT, 'seo', '_template-cidade.html');
const TEMPLATE_HUB  = path.join(ROOT, 'seo', '_template-hub.html');
const HUB_SLUG      = 'cidades-atendidas';
const WHATSAPP      = '5531996764159';
const MAX_CIDADES   = 8; // links para outras cidades em cada página
const TODAY         = new Date().toISOString().split('T')[0];

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

function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// "a, b e c"
function listaPt(itens) {
  if (itens.length <= 1) return itens.join('');
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`;
}

function pageSlug(servico, cidade) {
  return `${servico.slug}-em-${cidade.slug}-${cidade.estadoSlug}`;
}

function stripTemplateComment(html) {
  return html.replace(/<!--[\s\S]*?TEMPLATE SEO PROGRAMÁTICO[\s\S]*?-->\s*/, '');
}

// Título dos posts lido do <h1> de cada arquivo do blog
function tituloPost(slug) {
  const file = path.join(ROOT, 'blog', `${slug}.html`);
  if (!fs.existsSync(file)) throw new Error(`Post não encontrado: blog/${slug}.html`);
  const m = fs.readFileSync(file, 'utf8').match(/<h1[^>]*>([^<]+)<\/h1>/);
  return m ? m[1].trim() : slug;
}

// Vizinhas definidas no JSON primeiro; completa com as demais cidades
function cidadesRelacionadas(cidadeAtual) {
  const porSlug = new Map(cidades.map(c => [c.slug, c]));
  const vizinhas = (cidadeAtual.vizinhas || []).map(s => porSlug.get(s)).filter(Boolean);
  const resto = cidades.filter(c => c.slug !== cidadeAtual.slug && !vizinhas.includes(c));
  return [...vizinhas, ...resto].slice(0, MAX_CIDADES);
}

// ── BLOCOS HTML ─────────────────────────────────────────────────────────────
const ICONES = [
  '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  '<path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>',
  '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
];

function beneficiosHtml(servico) {
  return servico.beneficios.map((b, i) => `        <div class="card">
          <svg class="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            ${ICONES[i % ICONES.length]}
          </svg>
          <h3 class="card-title">${esc(b.titulo)}</h3>
          <div class="card-divider"></div>
          <p>${esc(b.texto)}</p>
        </div>`).join('\n');
}

function fatosHtml(cidade) {
  const fatos = [
    ['Localização', cidade.distancia
      ? `${cidade.regiao[0].toUpperCase()}${cidade.regiao.slice(1)}, ${cidade.distancia} do centro de BH`
      : `${cidade.regiao[0].toUpperCase()}${cidade.regiao.slice(1)} — sede da PS Contabilidade`],
    ['Principais setores', `${cidade.setores[0][0].toUpperCase()}${listaPt(cidade.setores).slice(1)}`],
    ['Como atendemos', cidade.distancia
      ? 'Online por WhatsApp, e-mail e videochamada, com reuniões presenciais em BH quando preferir'
      : 'Online ou presencialmente, no nosso escritório em Belo Horizonte'],
  ];
  return fatos.map(([t, v]) => `          <li><strong>${esc(t)}</strong>${esc(v)}</li>`).join('\n');
}

function passosHtml(servico) {
  return servico.passos.map((p, i) => `        <div class="process-step">
          <div class="process-num">${i + 1}</div>
          <h3 class="process-title">${esc(p.titulo)}</h3>
          <p class="process-desc">${esc(p.texto)}</p>
        </div>`).join('\n');
}

function faqHtml(faq) {
  return faq.map(f => `        <div class="faq-item">
          <button class="faq-question">
            ${esc(f.p)}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          <div class="faq-answer">${esc(f.r)}</div>
        </div>`).join('\n');
}

function outrosServicosHtml(servicoAtual, cidade) {
  return servicos
    .filter(s => s.slug !== servicoAtual.slug)
    .map(s => `        <a href="/${pageSlug(s, cidade)}/" class="city-chip">${esc(s.nome)} em ${esc(cidade.nome)}</a>`)
    .join('\n');
}

function cidadesHtml(servico, cidade) {
  return cidadesRelacionadas(cidade)
    .map(c => `        <a href="/${pageSlug(servico, c)}/" class="city-chip">${esc(c.nome)}</a>`)
    .join('\n');
}

function postsHtml(servico) {
  return servico.posts.map(slug => `        <a href="/blog/${slug}" class="post-link"><span>Artigo</span>${esc(tituloPost(slug))}</a>`).join('\n');
}

function schemaJson(servico, cidade, url, faq) {
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'AccountingService',
        '@id': `${BASE_URL}/#organization`,
        name: 'PS Contabilidade',
        url: BASE_URL,
        logo: `${BASE_URL}/assets/img/logomarca.png`,
        telephone: '+55-31-99676-4159',
        email: 'contato@pscont.com.br',
        foundingDate: '2003',
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Belo Horizonte',
          addressRegion: 'MG',
          addressCountry: 'BR',
        },
        areaServed: 'Brasil',
        description: 'Escritório de contabilidade e consultoria empresarial em Belo Horizonte, atendimento digital em todo o Brasil.',
      },
      {
        '@type': 'Service',
        '@id': `${url}#servico`,
        name: `${servico.nome} em ${cidade.nome}, ${cidade.estado}`,
        serviceType: servico.nome,
        url,
        provider: { '@id': `${BASE_URL}/#organization` },
        areaServed: {
          '@type': 'City',
          name: cidade.nome,
          containedInPlace: { '@type': 'State', name: 'Minas Gerais' },
        },
        description: servico.intro,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Início', item: `${BASE_URL}/` },
          { '@type': 'ListItem', position: 2, name: 'Cidades atendidas', item: `${BASE_URL}/${HUB_SLUG}/` },
          { '@type': 'ListItem', position: 3, name: `${servico.nome} em ${cidade.nome}`, item: url },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: faq.map(f => ({
          '@type': 'Question',
          name: f.p,
          acceptedAnswer: { '@type': 'Answer', text: f.r },
        })),
      },
    ],
  };
  // escapa "</" para não fechar o <script> por acidente
  return JSON.stringify(schema, null, 2).replace(/<\//g, '<\\/').replace(/^/gm, '  ');
}

// ── LIMPEZA DE PÁGINAS ANTIGAS ──────────────────────────────────────────────
// Remove pastas de combinações que não existem mais nos JSONs
const slugsAtuais = new Set();
for (const s of servicos) for (const c of cidades) slugsAtuais.add(pageSlug(s, c));
const prefixos = servicos.map(s => `${s.slug}-em-`);
for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const ehGerada = prefixos.some(p => entry.name.startsWith(p)) &&
    fs.existsSync(path.join(ROOT, entry.name, 'index.html'));
  if (ehGerada && !slugsAtuais.has(entry.name)) {
    fs.rmSync(path.join(ROOT, entry.name), { recursive: true });
    console.log(`Removida página obsoleta: /${entry.name}`);
  }
}

// ── GERAÇÃO ─────────────────────────────────────────────────────────────────
const templateRaw = stripTemplateComment(fs.readFileSync(TEMPLATE, 'utf8'));
const sitemapUrls = [];
let total = 0;

for (const servico of servicos) {
  for (const cidade of cidades) {
    const slug = pageSlug(servico, cidade);
    const url  = `${BASE_URL}/${slug}/`;

    const vars = {
      '{{SETORES}}':      listaPt(cidade.setores.slice(0, 3)),
      '{{SERVICO_SLUG}}': servico.slug,
      '{{SERVICO}}':      servico.nome,
      '{{CIDADE_SLUG}}':  cidade.slug,
      '{{CIDADE}}':       cidade.nome,
      '{{ESTADO_SLUG}}':  cidade.estadoSlug,
      '{{ESTADO}}':       cidade.estado,
    };
    const txt = s => replaceAll(s, vars);
    const faq = servico.faq.map(f => ({ p: txt(f.p), r: txt(f.r) }));
    const whatsappUrl = `https://wa.me/${WHATSAPP}?text=` +
      encodeURIComponent(`Olá, preciso de ${servico.nome} em ${cidade.nome}`);

    // Blocos primeiro (podem conter variáveis simples), depois as variáveis
    const blocos = {
      '{{SCHEMA_JSON}}':          schemaJson(servico, cidade, url, faq),
      '{{TITULO}}':               esc(servico.titulo),
      '{{DESCRICAO}}':            esc(servico.descricao),
      '{{INTRO}}':                esc(servico.intro),
      '{{PERFIL}}':               esc(cidade.perfil),
      '{{GANCHO_LOCAL}}':         esc(servico.ganchoLocal),
      '{{BENEFICIOS_HTML}}':      beneficiosHtml(servico),
      '{{FATOS_HTML}}':           fatosHtml(cidade),
      '{{PASSOS_HTML}}':          passosHtml(servico),
      '{{FAQ_HTML}}':             faqHtml(faq),
      '{{OUTROS_SERVICOS_HTML}}': outrosServicosHtml(servico, cidade),
      '{{CIDADES_HTML}}':         cidadesHtml(servico, cidade),
      '{{POSTS_HTML}}':           postsHtml(servico),
      '{{CTA_TITULO}}':           esc(servico.ctaTitulo),
      '{{CTA_TEXTO}}':            esc(servico.ctaTexto),
      '{{WHATSAPP_URL}}':         esc(whatsappUrl),
      '{{URL}}':                  url,
    };

    const html = txt(replaceAll(templateRaw, blocos));
    const sobrou = html.match(/\{\{[A-Z_]+\}\}/);
    if (sobrou) throw new Error(`Placeholder não substituído em /${slug}: ${sobrou[0]}`);

    const outDir = path.join(ROOT, slug);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');

    sitemapUrls.push({ loc: url, priority: servico.prioridade });
    total++;
  }
}

// ── HUB /cidades-atendidas ──────────────────────────────────────────────────
const hubUrl = `${BASE_URL}/${HUB_SLUG}/`;
const hubLista = cidades.map(c => `        <div class="hub-city">
          <h2>${esc(c.nome)}</h2>
          <small>${esc(c.distancia ? `${c.regiao} · ${c.distancia} de BH` : c.regiao)}</small>
          <ul>
${servicos.map(s => `            <li><a href="/${pageSlug(s, c)}/">${esc(s.nome)} em ${esc(c.nome)}</a></li>`).join('\n')}
          </ul>
        </div>`).join('\n');

const hubSchema = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'CollectionPage',
      name: 'Cidades atendidas pela PS Contabilidade',
      url: hubUrl,
      about: { '@id': `${BASE_URL}/#organization` },
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Início', item: `${BASE_URL}/` },
        { '@type': 'ListItem', position: 2, name: 'Cidades atendidas', item: hubUrl },
      ],
    },
  ],
};

const hubHtml = replaceAll(stripTemplateComment(fs.readFileSync(TEMPLATE_HUB, 'utf8')), {
  '{{SCHEMA_JSON}}':   JSON.stringify(hubSchema, null, 2).replace(/^/gm, '  '),
  '{{LISTA_HTML}}':    hubLista,
  '{{CIDADES_TEXTO}}': esc(listaPt(cidades.map(c => c.nome))),
});
fs.mkdirSync(path.join(ROOT, HUB_SLUG), { recursive: true });
fs.writeFileSync(path.join(ROOT, HUB_SLUG, 'index.html'), hubHtml, 'utf8');

// ── SITEMAP-SEO.XML ─────────────────────────────────────────────────────────
sitemapUrls.unshift({ loc: hubUrl, priority: '0.8' });
const urlsXml = sitemapUrls
  .map(u => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${TODAY}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`)
  .join('\n\n');

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<!-- PS Contabilidade — Sitemap SEO Programático (gerado por gerar-seo.js em ${TODAY}) -->\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n\n${urlsXml}\n\n</urlset>\n`;

fs.writeFileSync(path.join(ROOT, 'sitemap-seo.xml'), sitemapXml, 'utf8');

console.log(`OK: ${total} páginas geradas (${servicos.length} serviços x ${cidades.length} cidades) + hub /${HUB_SLUG}.`);
console.log(`Sitemap: sitemap-seo.xml (${sitemapUrls.length} URLs).`);
