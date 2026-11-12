'use strict';
const fs   = require('fs');
const path = require('path');

// ── CONFIG ──────────────────────────────────────────────────────────────────
const ROOT          = __dirname;
const BASE_URL      = 'https://pscontabilidadebh.com.br';
const SEO_DIR       = path.join(ROOT, 'seo');
const HUB_SLUG      = 'cidades-atendidas';
const WHATSAPP      = '5531991960352';
const MAX_RELACIONADOS = 8;   // links para outros locais em cada página
const MAX_TITULO    = 65;     // acima disso, o título sai sem "| PS Contabilidade"
const MARCADOR      = '<meta name="generator" content="gerar-seo.js">';
const TODAY         = new Date().toISOString().split('T')[0];

const servicos = require('./data/servicos.json');
const cidadesData = require('./data/cidades.json');
const bairrosData = require('./data/bairros-bh.json');
const ibge = Object.fromEntries(require('./data/ibge-mg.json').municipios.map(m => [m.slug, m]));

const read = f => fs.readFileSync(path.join(SEO_DIR, f), 'utf8');
const TPL_PAGINA = stripTemplateComment(read('_template-cidade.html'));
const TPL_HUB    = stripTemplateComment(read('_template-hub.html'));
const NAV_HTML   = read('_nav.html').trimEnd();
const FOOTER_HTML = read('_footer.html').trimEnd();

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

// Maiúscula inicial, preservando termos como "eSocial"
const cap = s => /^[a-z][A-Z]/.test(s) ? s : s[0].toUpperCase() + s.slice(1);

// Primeira frase, cortada em ~110 caracteres sem quebrar palavra
function resumo(texto, max = 110) {
  const frase = texto.trim().split(/(?<=\.)\s/)[0];
  if (frase.length <= max) return cap(frase);
  return cap(frase.slice(0, frase.lastIndexOf(' ', max)).replace(/[,;:]$/, '')) + '…';
}
const num = n => n.toLocaleString('pt-BR');

function stripTemplateComment(html) {
  return html.replace(/<!--[\s\S]*?TEMPLATE SEO PROGRAMÁTICO[\s\S]*?-->\s*/, '');
}

function distanciaKm(a, b) {
  const rad = x => x * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

function whatsappUrl(texto) {
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(texto)}`;
}

function titulo(texto) {
  return texto.length > MAX_TITULO ? texto.replace(/ \| PS Contabilidade$/, '') : texto;
}

function jsonLd(obj) {
  // escapa "</" para não fechar o <script> por acidente
  return JSON.stringify(obj, null, 2).replace(/<\//g, '<\\/').replace(/^/gm, '  ');
}

function breadcrumbHtml(itens) {
  return itens.map((it, i) => i === itens.length - 1
    ? `      ${esc(it.nome)}`
    : `      <a href="${it.href}">${esc(it.nome)}</a><span>›</span>`).join('\n');
}

function breadcrumbSchema(itens) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: itens.map((it, i) => ({
      '@type': 'ListItem', position: i + 1, name: it.nome, item: `${BASE_URL}${it.href}`,
    })),
  };
}

const ORGANIZACAO = {
  '@type': 'AccountingService',
  '@id': `${BASE_URL}/#organization`,
  name: 'PS Contabilidade',
  url: BASE_URL,
  logo: `${BASE_URL}/assets/img/logomarca.png`,
  telephone: '+55-31-99196-0352',
  email: 'contato@pscont.com.br',
  foundingDate: '2003',
  address: { '@type': 'PostalAddress', addressLocality: 'Belo Horizonte', addressRegion: 'MG', addressCountry: 'BR' },
  areaServed: 'Brasil',
  description: 'Escritório de contabilidade e consultoria empresarial em Belo Horizonte, atendimento digital em todo o Brasil.',
};

// Título dos posts lido do <h1> de cada arquivo do blog
const postsCache = {};
function tituloPost(slug) {
  if (postsCache[slug]) return postsCache[slug];
  const file = path.join(ROOT, 'blog', `${slug}.html`);
  if (!fs.existsSync(file)) throw new Error(`Post não encontrado: blog/${slug}.html`);
  const m = fs.readFileSync(file, 'utf8').match(/<h1[^>]*>([^<]+)<\/h1>/);
  return (postsCache[slug] = m ? m[1].trim() : slug);
}

// ── LOCAIS (cidades e bairros de BH) ────────────────────────────────────────
const BH = ibge['belo-horizonte'];

const cidades = cidadesData.map(c => {
  const m = ibge[c.slug];
  if (!m) throw new Error(`Cidade sem dados do IBGE: ${c.slug}`);
  const km = Math.round(distanciaKm(BH, m) / 5) * 5;
  const regiao = c.regiao || (m.regiaoIntermediaria === 'Belo Horizonte'
    ? 'região intermediária de Belo Horizonte'
    : `região de ${m.regiaoIntermediaria}`);
  const distancia = c.slug === 'belo-horizonte' ? '' : (c.distancia || `cerca de ${km} km`);
  return {
    tipo: 'cidade', nome: c.nome, slug: c.slug, ibge: m,
    chave: `em-${c.slug}-mg`,
    emLocal: `em ${c.nome}`, deLocal: `de ${c.nome}`,
    emLocalTitulo: `em ${c.nome}, MG`, badge: `${c.nome}, MG`,
    municipio: c.nome, perfil: c.perfil, setores: c.setores,
    regiao, distancia, distanciaReta: !c.distancia,
  };
});

const PREP_DE = { na: 'da', no: 'do', em: 'de' };
const bairros = bairrosData.map(b => {
  const emLocal = b.emLocal || `${b.prep} ${b.nome}`;
  return {
    tipo: 'bairro', nome: b.nome, slug: b.slug, regional: b.regional,
    chave: `${b.prep}-${b.slug}-bh`,
    emLocal, deLocal: emLocal.replace(/^(na|no|em) /, (_, p) => `${PREP_DE[p]} `),
    emLocalTitulo: b.emLocal ? emLocal : `${emLocal}, BH`, badge: `${b.nome} · Belo Horizonte`,
    municipio: 'Belo Horizonte', perfil: b.perfil, setores: b.setores,
  };
});

const cidadeBH = cidades.find(c => c.slug === 'belo-horizonte');

const urlLocalHub = l => `/contabilidade-${l.chave}/`;
const urlPagina   = (s, l) => `/${s.slug}-${l.chave}/`;
const urlServico  = s => `/${s.slug}/`;
const atende      = (s, l) => s.escopo.includes(l.tipo === 'cidade' ? 'cidades' : 'bairros');

// Locais mais próximos: cidades por distância; bairros da mesma regional primeiro
function relacionados(local) {
  if (local.tipo === 'cidade') {
    return cidades.filter(c => c !== local)
      .sort((a, b) => distanciaKm(local.ibge, a.ibge) - distanciaKm(local.ibge, b.ibge))
      .slice(0, MAX_RELACIONADOS);
  }
  const mesma = bairros.filter(b => b !== local && b.regional === local.regional);
  const outras = bairros.filter(b => b !== local && b.regional !== local.regional);
  return [...mesma, ...outras].slice(0, MAX_RELACIONADOS);
}

function fatos(local) {
  if (local.tipo === 'bairro') {
    return [
      ['Localização', `Regional ${local.regional}, em Belo Horizonte`],
      ['Perfil dos negócios', cap(listaPt(local.setores))],
      ['Como atendemos', 'Online ou presencialmente, no nosso escritório em Belo Horizonte'],
    ];
  }
  const m = local.ibge;
  const vab = [['serviços', m.vab.servicos], ['indústria', m.vab.industria], ['agropecuária', m.vab.agro]];
  const total = m.vab.servicos + m.vab.industria + m.vab.agro + m.vab.adm;
  const [setorTop, valorTop] = vab.sort((a, b) => b[1] - a[1])[0];
  const out = [
    ['Localização', local.distancia
      ? `${cap(local.regiao)}, ${local.distancia} de BH${local.distanciaReta ? ' (em linha reta)' : ''}`
      : `${cap(local.regiao)} — sede da PS Contabilidade`],
    ['População', `${num(m.populacao)} habitantes (Censo IBGE 2022)`],
    ['Economia', `${cap(setorTop)} responde por ${Math.round(valorTop / total * 100)}% do valor adicionado (IBGE, 2021). Destaques: ${listaPt(local.setores.slice(0, 3))}`],
    ['Como atendemos', local.distancia
      ? 'Online por WhatsApp, e-mail e videochamada, com toda a rotina digital'
      : 'Online ou presencialmente, no nosso escritório em Belo Horizonte'],
  ];
  return out;
}

const fatosHtml = local => fatos(local)
  .map(([t, v]) => `          <li><strong>${esc(t)}</strong>${esc(v)}</li>`).join('\n');

// Variáveis de texto dos JSONs
function varsLocal(local, servico) {
  return {
    '{{EM_LOCAL_CAP}}':  cap(local.emLocal),
    '{{EM_LOCAL}}':      local.emLocal,
    '{{DE_LOCAL}}':      local.deLocal,
    '{{LOCAL}}':         local.nome,
    '{{MUNICIPIO}}':     local.municipio,
    '{{SETORES}}':       listaPt(local.setores.slice(0, 3)),
    '{{SERVICO}}':       servico ? servico.nome : '',
  };
}

// ── BLOCOS DAS PÁGINAS DE SERVIÇO × LOCAL ──────────────────────────────────
const ICONES = [
  '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  '<path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>',
  '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
];

const PASSOS_PADRAO = [
  { titulo: 'Diagnóstico', texto: 'Análise gratuita da situação fiscal e contábil do seu negócio' },
  { titulo: 'Proposta', texto: 'Plano sob medida para o seu porte e segmento' },
  { titulo: 'Migração', texto: 'Buscamos tudo com o contador anterior, sem perder prazos' },
  { titulo: 'Parceria', texto: 'Rotina mensal, relatórios e reuniões para crescer' },
];

function beneficiosHtml(servico, txt) {
  return servico.beneficios.map((b, i) => `        <div class="card">
          <svg class="card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            ${ICONES[i % ICONES.length]}
          </svg>
          <h3 class="card-title">${esc(txt(b.titulo))}</h3>
          <div class="card-divider"></div>
          <p>${esc(txt(b.texto))}</p>
        </div>`).join('\n');
}

function passosHtml(servico) {
  return (servico.passos || PASSOS_PADRAO).map((p, i) => `        <div class="process-step">
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

const nomeMinusculo = s => s.nome.toLowerCase().replace(/\bmei\b/, 'MEI');

// Perguntas comuns a todos os serviços, acrescentadas às específicas
function faqComum(servico, local) {
  const atendimento = local.municipio === 'Belo Horizonte'
    ? `Sim. Nosso escritório fica em Belo Horizonte e você pode ser atendido presencialmente ou de forma 100% digital, por WhatsApp, e-mail e videochamada.`
    : `Sim. O atendimento é 100% digital — por WhatsApp, e-mail e videochamada —, com a mesma qualidade de quem está ao lado do escritório. Você envia documentos pelo celular e recebe tudo pronto.`;
  return [
    { p: `Quanto custa ${nomeMinusculo(servico)} ${local.emLocal}?`,
      r: 'O valor depende do porte, do regime tributário e do volume de operações. O diagnóstico inicial é gratuito e sem compromisso — fale com a gente e receba uma proposta personalizada.' },
    { p: `A PS Contabilidade atende ${local.emLocal}?`, r: atendimento },
  ];
}

function paginaServicoLocal(servico, local) {
  const url = `${BASE_URL}${urlPagina(servico, local)}`;
  const vars = varsLocal(local, servico);
  const txt = s => replaceAll(s, vars);
  const txtTitulo = s => replaceAll(s, { ...vars, '{{EM_LOCAL}}': local.emLocalTitulo });
  const faq = [...servico.faq.map(f => ({ p: txt(f.p), r: txt(f.r) })), ...faqComum(servico, local)];

  const trilha = [
    { nome: 'Início', href: '/' },
    { nome: 'Cidades atendidas', href: `/${HUB_SLUG}/` },
    ...(local.tipo === 'bairro' ? [{ nome: 'Belo Horizonte', href: urlLocalHub(cidadeBH) }] : []),
    { nome: local.nome, href: urlLocalHub(local) },
    { nome: servico.nome, href: urlPagina(servico, local) },
  ];

  const outros = servicos.filter(s => s !== servico && atende(s, local))
    .map(s => `        <a href="${urlPagina(s, local)}" class="city-chip">${esc(s.nome)}</a>`);
  outros.push(`        <a href="${urlLocalHub(local)}" class="city-chip">Todos os serviços ${esc(local.emLocal)}</a>`);
  if (local.tipo === 'bairro' && atende(servico, cidadeBH)) {
    outros.push(`        <a href="${urlPagina(servico, cidadeBH)}" class="city-chip">${esc(servico.nome)} em Belo Horizonte</a>`);
  }

  const vizinhos = relacionados(local).filter(l => atende(servico, l))
    .map(l => `        <a href="${urlPagina(servico, l)}" class="city-chip">${esc(l.nome)}</a>`);
  vizinhos.push(`        <a href="${urlServico(servico)}" class="city-chip">Ver todas as cidades</a>`);

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      ORGANIZACAO,
      {
        '@type': 'Service',
        '@id': `${url}#servico`,
        name: `${servico.nome} ${local.emLocalTitulo}`,
        serviceType: servico.nome,
        url,
        provider: { '@id': `${BASE_URL}/#organization` },
        areaServed: local.tipo === 'cidade'
          ? { '@type': 'City', name: local.nome, containedInPlace: { '@type': 'State', name: 'Minas Gerais' } }
          : { '@type': 'Place', name: `${local.nome}, Belo Horizonte`, containedInPlace: { '@type': 'City', name: 'Belo Horizonte' } },
        description: txt(servico.intro),
      },
      breadcrumbSchema(trilha),
      {
        '@type': 'FAQPage',
        mainEntity: faq.map(f => ({ '@type': 'Question', name: f.p, acceptedAnswer: { '@type': 'Answer', text: f.r } })),
      },
    ],
  };

  return replaceAll(TPL_PAGINA, {
    '{{SCHEMA_JSON}}':          jsonLd(schema),
    '{{NAV_HTML}}':             NAV_HTML,
    '{{FOOTER_HTML}}':          FOOTER_HTML,
    '{{BREADCRUMB_HTML}}':      breadcrumbHtml(trilha),
    '{{TITULO}}':               esc(titulo(txtTitulo(servico.titulo))),
    '{{DESCRICAO}}':            esc(txt(servico.descricao)),
    '{{INTRO}}':                esc(txt(servico.intro)),
    '{{PERFIL}}':               esc(local.perfil),
    '{{GANCHO_LOCAL}}':         esc(txt(servico.ganchoLocal)),
    '{{BENEFICIOS_HTML}}':      beneficiosHtml(servico, txt),
    '{{FATOS_HTML}}':           fatosHtml(local),
    '{{PASSOS_HTML}}':          passosHtml(servico),
    '{{FAQ_HTML}}':             faqHtml(faq),
    '{{OUTROS_SERVICOS_HTML}}': outros.join('\n'),
    '{{RELACIONADOS_TITULO}}':  esc(local.tipo === 'cidade'
      ? `${servico.nome} em cidades próximas`
      : `${servico.nome} em outros bairros de BH`),
    '{{CIDADES_HTML}}':         vizinhos.join('\n'),
    '{{POSTS_HTML}}':           servico.posts.map(slug =>
      `        <a href="/blog/${slug}" class="post-link"><span>Artigo</span>${esc(tituloPost(slug))}</a>`).join('\n'),
    '{{CTA_TITULO}}':           esc(txt(servico.ctaTitulo)),
    '{{CTA_TEXTO}}':            esc(txt(servico.ctaTexto)),
    '{{WHATSAPP_URL}}':         esc(whatsappUrl(`Olá, preciso de ${servico.nome} ${local.emLocal}`)),
    '{{LOCAL_BADGE}}':          esc(local.badge),
    '{{EM_LOCAL_TITULO}}':      esc(local.emLocalTitulo),
    '{{EM_LOCAL}}':             esc(local.emLocal),
    '{{SERVICO}}':              esc(servico.nome),
    '{{URL}}':                  url,
  });
}

// ── HUBS ────────────────────────────────────────────────────────────────────
function paginaHub({ url, tituloPagina, descricao, h1, intro, trilha, conteudo, schemaExtra = [], whatsapp }) {
  const schema = {
    '@context': 'https://schema.org',
    '@graph': [ORGANIZACAO, { '@type': 'CollectionPage', name: h1, url: `${BASE_URL}${url}`, about: { '@id': `${BASE_URL}/#organization` } },
      breadcrumbSchema(trilha), ...schemaExtra],
  };
  return replaceAll(TPL_HUB, {
    '{{SCHEMA_JSON}}':     jsonLd(schema),
    '{{NAV_HTML}}':        NAV_HTML,
    '{{FOOTER_HTML}}':     FOOTER_HTML,
    '{{BREADCRUMB_HTML}}': breadcrumbHtml(trilha),
    '{{TITULO}}':          esc(titulo(tituloPagina)),
    '{{DESCRICAO}}':       esc(descricao),
    '{{H1}}':              esc(h1),
    '{{INTRO}}':           esc(intro),
    '{{CONTEUDO_HTML}}':   conteudo,
    '{{WHATSAPP_URL}}':    esc(whatsappUrl(whatsapp)),
    '{{URL}}':             `${BASE_URL}${url}`,
  });
}

const card = (href, titulo, sub) =>
  `          <a href="${href}" class="hub-card"><strong>${esc(titulo)}</strong>${sub ? `<span>${esc(sub)}</span>` : ''}</a>`;

function secao(tituloSecao, sub, cards, alt = false) {
  return `  <section class="hub-section${alt ? ' alt' : ''}">
    <div class="container">
      <h2>${esc(tituloSecao)}</h2>
      ${sub ? `<p class="hub-sub">${esc(sub)}</p>` : ''}
      <div class="hub-grid">
${cards.join('\n')}
      </div>
    </div>
  </section>`;
}

function secaoAgrupada(tituloSecao, sub, grupos, alt = false) {
  const corpo = grupos.map(([nome, cards]) => `      <div class="hub-group">
        <h3>${esc(nome)}</h3>
        <div class="hub-grid">
${cards.join('\n')}
        </div>
      </div>`).join('\n');
  return `  <section class="hub-section${alt ? ' alt' : ''}">
    <div class="container">
      <h2>${esc(tituloSecao)}</h2>
      ${sub ? `<p class="hub-sub">${esc(sub)}</p>` : ''}
${corpo}
    </div>
  </section>`;
}

function agrupar(itens, chave) {
  const mapa = new Map();
  for (const it of itens) {
    const k = chave(it);
    if (!mapa.has(k)) mapa.set(k, []);
    mapa.get(k).push(it);
  }
  return [...mapa.entries()];
}

// /contabilidade-em-{cidade}-mg/ e /contabilidade-{prep}-{bairro}-bh/
function hubLocal(local) {
  const trilha = [
    { nome: 'Início', href: '/' },
    { nome: 'Cidades atendidas', href: `/${HUB_SLUG}/` },
    ...(local.tipo === 'bairro' ? [{ nome: 'Belo Horizonte', href: urlLocalHub(cidadeBH) }] : []),
    { nome: local.nome, href: urlLocalHub(local) },
  ];
  const disponiveis = servicos.filter(s => atende(s, local));
  const cardsServ = g => disponiveis.filter(s => s.grupo === g)
    .map(s => card(urlPagina(s, local), s.nome, resumo(replaceAll(s.descricao, varsLocal(local, s)).split(':').pop())));

  const faq = [
    { p: `A PS Contabilidade atende empresas ${local.emLocal}?`,
      r: local.municipio === 'Belo Horizonte'
        ? 'Sim. Nosso escritório fica em Belo Horizonte e atendemos presencialmente ou de forma 100% digital.'
        : 'Sim. Atendemos de forma 100% digital, por WhatsApp, e-mail e videochamada, com contador dedicado e documentos enviados pelo celular.' },
    { p: `Como trocar de contador ${local.emLocal}?`,
      r: 'Fazemos toda a transição: solicitamos os arquivos ao contador anterior, conferimos pendências e assumimos a rotina sem que sua empresa perca nenhum prazo.' },
    { p: 'O diagnóstico é mesmo gratuito?',
      r: 'Sim. Analisamos a situação fiscal e contábil da sua empresa e mostramos onde é possível economizar, sem custo e sem compromisso.' },
  ];

  const blocos = [
    `  <section class="local-context" style="padding-top:64px">
    <div class="container">
      <div class="local-context-box">
        <div>
          <span class="section-tag">Atendimento local</span>
          <h2 class="section-title" style="font-size:1.6rem">Empresas ${esc(local.emLocal)}</h2>
          <p>${esc(local.perfil)}</p>
        </div>
        <ul class="local-facts">
${fatosHtml(local)}
        </ul>
      </div>
    </div>
  </section>`,
    secao(`Serviços contábeis ${local.emLocal}`, null, cardsServ('servicos'), true),
  ];
  const seg = cardsServ('segmentos');
  if (seg.length) blocos.push(secao(`Contabilidade por segmento ${local.emLocal}`, 'Atendimento especializado para cada tipo de negócio', seg));
  if (local === cidadeBH) {
    blocos.push(secaoAgrupada('Atendimento por bairro em BH', 'Contabilidade perto de você, em todas as regionais de Belo Horizonte',
      agrupar(bairros, b => `Regional ${b.regional}`).map(([g, bs]) => [g, bs.map(b => card(urlLocalHub(b), b.nome))]), true));
  }
  blocos.push(`  <section class="faq-section">
    <div class="container">
      <div style="text-align:center">
        <span class="section-tag">Perguntas frequentes</span>
        <h2 class="section-title">Contabilidade ${esc(local.emLocal)}</h2>
      </div>
      <div class="faq-list">
${faqHtml(faq)}
      </div>
    </div>
  </section>`);
  blocos.push(secao(local.tipo === 'cidade' ? 'Cidades próximas' : 'Bairros próximos', null,
    relacionados(local).map(l => card(urlLocalHub(l), l.nome))));

  return paginaHub({
    url: urlLocalHub(local),
    tituloPagina: `Escritório de Contabilidade ${local.emLocalTitulo} | PS Contabilidade`,
    descricao: `Escritório de contabilidade ${local.emLocal}: abertura de empresa e CNPJ, MEI, planejamento tributário e contabilidade por segmento. Atendimento digital e diagnóstico gratuito.`,
    h1: `Escritório de Contabilidade ${local.emLocalTitulo}`,
    intro: `Procurando contabilidade ${local.emLocal}? A PS Contabilidade é um escritório de contabilidade com mais de 20 anos de experiência, atendimento humanizado e rotina 100% digital. Escolha o serviço de que você precisa.`,
    trilha, conteudo: blocos.join('\n\n'), whatsapp: `Olá, preciso de contabilidade ${local.emLocal}`,
    schemaExtra: [{ '@type': 'FAQPage', mainEntity: faq.map(f => ({ '@type': 'Question', name: f.p, acceptedAnswer: { '@type': 'Answer', text: f.r } })) }],
  });
}

// /{servico}/
function hubServico(servico) {
  const geral = { emLocal: 'em BH e em Minas Gerais', deLocal: 'de BH e de Minas Gerais', nome: 'Minas Gerais', municipio: 'Belo Horizonte', setores: ['comércio', 'serviços', 'indústria'] };
  const vars = varsLocal(geral, servico);
  const txt = s => replaceAll(s, vars);
  const trilha = [
    { nome: 'Início', href: '/' },
    { nome: 'Serviços', href: '/servicos' },
    { nome: servico.nome, href: urlServico(servico) },
  ];
  const blocos = [`  <section class="benefits-section">
    <div class="container">
      <span class="section-tag">Por que a PS Contabilidade</span>
      <h2 class="section-title">${esc(servico.nome)}<br>com quem entende do negócio</h2>
      <div class="benefits-grid">
${beneficiosHtml(servico, txt)}
      </div>
    </div>
  </section>`];
  blocos.push(secaoAgrupada(`${servico.nome} por cidade`, 'Escolha sua cidade para ver como atendemos a sua região',
    agrupar(cidades.filter(c => atende(servico, c)), c => c.slug === 'belo-horizonte' || c.ibge.regiaoIntermediaria === 'Belo Horizonte'
      ? 'Belo Horizonte e região' : `Região de ${c.ibge.regiaoIntermediaria}`)
      .map(([g, cs]) => [g, cs.map(c => card(urlPagina(servico, c), c.nome))]), true));
  const bs = bairros.filter(b => atende(servico, b));
  if (bs.length) {
    blocos.push(secaoAgrupada(`${servico.nome} por bairro de BH`, null,
      agrupar(bs, b => `Regional ${b.regional}`).map(([g, items]) => [g, items.map(b => card(urlPagina(servico, b), b.nome))])));
  }
  return paginaHub({
    url: urlServico(servico),
    tituloPagina: `${servico.nome} em BH e Minas Gerais | PS Contabilidade`,
    descricao: txt(servico.descricao),
    h1: servico.nome,
    intro: txt(servico.intro),
    trilha, conteudo: blocos.join('\n\n'), whatsapp: `Olá, preciso de ${servico.nome}`,
  });
}

// /cidades-atendidas/
function hubGeral() {
  const trilha = [{ nome: 'Início', href: '/' }, { nome: 'Cidades atendidas', href: `/${HUB_SLUG}/` }];
  const grupos = agrupar(cidades, c => c.slug === 'belo-horizonte' || c.ibge.regiaoIntermediaria === 'Belo Horizonte'
    ? 'Belo Horizonte e região' : `Região de ${c.ibge.regiaoIntermediaria}`)
    .map(([g, cs]) => [g, cs.map(c => card(urlLocalHub(c), c.nome, `${num(c.ibge.populacao)} habitantes`))]);
  const blocos = [
    secaoAgrupada('Cidades de Minas Gerais', 'Atendimento 100% digital para empresas de todo o estado', grupos),
    secaoAgrupada('Bairros de Belo Horizonte', 'Atendimento presencial ou online em todas as regionais da capital',
      agrupar(bairros, b => `Regional ${b.regional}`).map(([g, bs]) => [g, bs.map(b => card(urlLocalHub(b), b.nome))]), true),
    secao('Serviços e segmentos', null, servicos.map(s => card(urlServico(s), s.nome))),
  ];
  return paginaHub({
    url: `/${HUB_SLUG}/`,
    tituloPagina: 'Cidades Atendidas em Minas Gerais | PS Contabilidade',
    descricao: `A PS Contabilidade atende empresas em ${cidades.length} cidades de Minas Gerais e em ${bairros.length} bairros de Belo Horizonte, com atendimento digital e diagnóstico gratuito.`,
    h1: 'Cidades atendidas em Minas Gerais',
    intro: 'Com sede em Belo Horizonte e atendimento 100% digital, a PS Contabilidade cuida de empresas em todo o estado. Escolha sua cidade ou bairro.',
    trilha, conteudo: blocos.join('\n\n'), whatsapp: 'Olá, gostaria de falar com um contador',
  });
}

// ── GERAÇÃO ─────────────────────────────────────────────────────────────────
const paginas = []; // { url, prioridade, html }

for (const servico of servicos) {
  for (const local of [...cidades, ...bairros]) {
    if (!atende(servico, local)) continue;
    paginas.push({ url: urlPagina(servico, local), prioridade: local.tipo === 'cidade' ? servico.prioridade : '0.6',
      html: paginaServicoLocal(servico, local) });
  }
  paginas.push({ url: urlServico(servico), prioridade: '0.8', html: hubServico(servico) });
}
for (const local of [...cidades, ...bairros]) {
  paginas.push({ url: urlLocalHub(local), prioridade: local.tipo === 'cidade' ? '0.8' : '0.6', html: hubLocal(local) });
}
paginas.push({ url: `/${HUB_SLUG}/`, prioridade: '0.8', html: hubGeral() });

// Validações antes de gravar
const urls = new Set();
for (const p of paginas) {
  if (urls.has(p.url)) throw new Error(`URL duplicada: ${p.url}`);
  urls.add(p.url);
  const sobrou = p.html.match(/\{\{[A-Z_]+\}\}/);
  if (sobrou) throw new Error(`Placeholder não substituído em ${p.url}: ${sobrou[0]}`);
}

// Remove páginas geradas antes que não existem mais
const pastasAtuais = new Set(paginas.map(p => p.url.replace(/^\/|\/$/g, '')));
for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
  if (!entry.isDirectory() || pastasAtuais.has(entry.name)) continue;
  const index = path.join(ROOT, entry.name, 'index.html');
  if (fs.existsSync(index) && fs.readFileSync(index, 'utf8').includes(MARCADOR)) {
    fs.rmSync(path.join(ROOT, entry.name), { recursive: true });
    console.log(`Removida página obsoleta: /${entry.name}/`);
  }
}

for (const p of paginas) {
  const dir = path.join(ROOT, p.url.replace(/^\/|\/$/g, ''));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), p.html, 'utf8');
}

// ── SERVICOS.HTML: bloco "Onde atendemos" ───────────────────────────────────
const servicosHtmlPath = path.join(ROOT, 'servicos.html');
const INICIO = '<!-- gerar-seo:inicio -->', FIM = '<!-- gerar-seo:fim -->';
let servicosHtml = fs.readFileSync(servicosHtmlPath, 'utf8');
const chip = (href, t) => `        <a href="${href}" class="city-chip">${esc(t)}</a>`;
const bloco = `${INICIO}
  <section class="cities-section">
    <div class="container">
      <span class="section-tag">Por segmento</span>
      <h2 class="section-title">Contabilidade especializada</h2>
      <div class="cities-grid">
${servicos.map(s => chip(urlServico(s), s.nome)).join('\n')}
      </div>
      <span class="section-tag" style="margin-top:32px">Onde atendemos</span>
      <h2 class="section-title">Contabilidade em BH e em Minas Gerais</h2>
      <p class="section-sub" style="margin:0 auto">Atendimento 100% digital para empresas de todo o estado</p>
      <div class="cities-grid">
${cidades.slice(0, 24).map(c => chip(urlLocalHub(c), c.nome)).join('\n')}
      </div>
      <a href="/${HUB_SLUG}/" class="cities-more">Ver todas as ${cidades.length} cidades e ${bairros.length} bairros de BH →</a>
    </div>
  </section>
  ${FIM}`;
if (servicosHtml.includes(INICIO)) {
  servicosHtml = servicosHtml.replace(new RegExp(`${INICIO}[\\s\\S]*?${FIM}`), bloco);
} else {
  // primeira execução: substitui a seção antiga "ONDE ATENDEMOS"
  servicosHtml = servicosHtml.replace(/<!-- ONDE ATENDEMOS -->[\s\S]*?<\/section>/, bloco);
}
fs.writeFileSync(servicosHtmlPath, servicosHtml, 'utf8');

// ── SITEMAP-SEO.XML ─────────────────────────────────────────────────────────
const urlsXml = paginas
  .map(p => `  <url>\n    <loc>${BASE_URL}${p.url}</loc>\n    <lastmod>${TODAY}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>${p.prioridade}</priority>\n  </url>`)
  .join('\n');

fs.writeFileSync(path.join(ROOT, 'sitemap-seo.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<!-- PS Contabilidade — Sitemap SEO Programático (gerado por gerar-seo.js em ${TODAY}) -->\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlsXml}\n</urlset>\n`, 'utf8');

const conta = t => paginas.filter(t).length;
console.log(`OK: ${paginas.length} páginas`);
console.log(`  serviço × cidade: ${conta(p => /-mg\/$/.test(p.url) && !p.url.startsWith('/contabilidade-em-'))}`);
console.log(`  serviço × bairro: ${conta(p => /-bh\/$/.test(p.url) && !/^\/contabilidade-(na|no|em)-/.test(p.url))}`);
console.log(`  hubs de local: ${cidades.length + bairros.length} · hubs de serviço: ${servicos.length} · hub geral: 1`);
