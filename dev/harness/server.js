/*
 * Mock-Shopify render harness (test tooling only; never shipped with the theme).
 *
 * Renders the REAL theme files in /home/user/testing-dog with liquidjs, using Shopify-shaped
 * objects, and provides a mock cart API (/cart/add.js, /cart/change.js, /cart.js, section rendering).
 *
 * Fixtures are synthetic and clearly labelled "TEST FIXTURE". They exist only to exercise layout
 * and behaviour, and are never used as product imagery.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { Liquid, Tag } = require('liquidjs');
const Busboy = require('busboy');

const THEME = process.env.THEME_DIR || path.resolve(__dirname, '../..');
const FIX = path.join(__dirname, 'fixtures');
const HARNESS_PARTIALS = path.join(__dirname, 'partials');
const PORT = parseInt(process.env.PORT || '4177', 10);

/* ------------------------------------------------------------------ locales */
const parseJson = (t) => JSON.parse(t.replace(/^\s*\/\*[\s\S]*?\*\//, ''));
const locale = JSON.parse(fs.readFileSync(path.join(THEME, 'locales/en.default.json'), 'utf8'));
function translate(key, vars) {
  let node = key.split('.').reduce((o, k) => (o == null ? o : o[k]), locale);
  if (node === undefined) return `translation missing: en.${key}`;
  if (typeof node === 'object') node = vars && vars.count === 1 ? node.one : node.other;
  return String(node).replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (vars && vars[k] != null ? vars[k] : ''));
}

/* ------------------------------------------------------------------ engine */
const engine = new Liquid({
  root: [path.join(THEME, 'snippets')],
  partials: [path.join(THEME, 'snippets'), HARNESS_PARTIALS],
  extname: '.liquid',
  jsTruthy: false,
  strictVariables: false,
  strictFilters: true,
  greedy: false
});

const kw = (args) => Object.fromEntries(args.filter(Array.isArray).map(([k, v]) => [k, v]));
const money = (cents) => {
  if (cents == null || cents === '') return '';
  const n = (Number(cents) / 100).toFixed(2);
  return '$' + n.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

engine.registerFilter('money', (v) => money(v));
engine.registerFilter('money_with_currency', (v) => money(v) + ' USD');
engine.registerFilter('asset_url', (v) => `/assets/${v}?v=1`);
engine.registerFilter('stylesheet_tag', (v) => `<link href="${v}" rel="stylesheet" type="text/css" media="all">`);
engine.registerFilter('json', (v) => (v === undefined || v === null ? 'null' : JSON.stringify(v)));
engine.registerFilter('handleize', (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
engine.registerFilter('t', (key, ...args) => translate(key, kw(args)));
engine.registerFilter('default_errors', () => '');
engine.registerFilter('external_video_tag', () => '');
engine.registerFilter('media_tag', () => '');
engine.registerFilter('structured_data', (p) =>
  JSON.stringify({
    '@context': 'http://schema.org/',
    '@type': 'Product',
    name: p.title,
    offers: [{ '@type': 'Offer', price: (p.price / 100).toFixed(2), priceCurrency: 'USD', availability: 'http://schema.org/InStock' }]
  })
);
engine.registerFilter('image_url', (img, ...args) => {
  if (!img || !img.src) return '';
  const o = kw(args);
  const q = [];
  if (o.width) q.push('width=' + o.width);
  if (o.height) q.push('height=' + o.height);
  return img.src + (q.length ? '?' + q.join('&') : '');
});
engine.registerFilter('image_tag', (url, ...args) => {
  if (!url) return '';
  const o = kw(args);
  const base = String(url).split('?')[0];
  const qs = new URLSearchParams(String(url).split('?')[1] || '');
  const widths = o.widths ? String(o.widths).split(',').map((w) => parseInt(w, 10)).filter(Boolean) : [];
  const attrs = [`src="${url}"`];
  if (widths.length) {
    attrs.push(`srcset="${widths.map((w) => `${base}?width=${w} ${w}w`).join(', ')}"`);
    if (o.sizes) attrs.push(`sizes="${o.sizes}"`);
  }
  attrs.push(`alt="${String(o.alt == null ? '' : o.alt).replace(/"/g, '&quot;')}"`);
  if (o.class) attrs.push(`class="${o.class}"`);
  if (o.loading) attrs.push(`loading="${o.loading}"`);
  if (o.fetchpriority) attrs.push(`fetchpriority="${o.fetchpriority}"`);
  attrs.push(`width="${o.width || qs.get('width') || 1200}"`);
  attrs.push(`height="${o.height || qs.get('height') || 1200}"`);
  return `<img ${attrs.join(' ')}>`;
});

/* ------------------------------------------------------------------ source preprocessing */
function extractSchema(src) {
  let schema = null;
  const stripped = src.replace(/\{%-?\s*schema\s*-?%\}([\s\S]*?)\{%-?\s*endschema\s*-?%\}/, (_, json) => {
    schema = JSON.parse(json);
    return '';
  });
  return { stripped, schema };
}

function splitTopLevel(str) {
  const out = [];
  let depth = 0, quote = null, cur = '';
  for (const ch of str) {
    if (quote) { cur += ch; if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function preprocess(src) {
  // {% form 'type', obj, key: value %}  ->  render of a harness partial
  src = src.replace(/\{%(-?)\s*form\s+([^%]*?)\s*(-?)%\}/g, (_, l, args, r) => {
    const parts = splitTopLevel(args);
    const type = parts.shift();
    let objectArg = '';
    if (parts.length && !/^[\w-]+\s*:/.test(parts[0])) objectArg = `object: ${parts.shift()}`;
    const rest = parts.map((p) => p.replace(/^([\w-]+)\s*:/, (m, k) => k.replace(/-/g, '_') + ':'));
    const all = [`type: ${type}`, objectArg, ...rest].filter(Boolean).join(', ');
    return `{%${l} render '__form_open', ${all} ${r}%}`;
  });
  src = src.replace(/\{%(-?)\s*endform\s*(-?)%\}/g, (_, l, r) => `{%${l} echo '</form>' ${r}%}`);
  // {% paginate x by n %} ... {% endpaginate %}
  src = src.replace(/\{%(-?)\s*paginate\s+[^%]*?(-?)%\}/g, (_, l, r) => `{%${l} assign paginate = __paginate ${r}%}`);
  src = src.replace(/\{%(-?)\s*endpaginate\s*(-?)%\}/g, '');
  return src;
}

/* ------------------------------------------------------------------ settings and fixtures */
function settingDefault(s) {
  if (s.default !== undefined) return s.default;
  switch (s.type) {
    case 'checkbox': return false;
    case 'select': case 'radio': return s.options && s.options[0] ? s.options[0].value : '';
    case 'text': case 'textarea': case 'richtext': case 'inline_richtext': return '';
    case 'range': case 'number': return s.min !== undefined ? s.min : null;
    default: return null;
  }
}
const NON_VALUE = new Set(['header', 'paragraph']);

function resolveSettings(defs, given) {
  const out = {};
  const asImage = (v) => (typeof v === 'string' && v.startsWith('shopify://files/videos/') ? videoObj('clip-a.webm', 1280, 720) : typeof v === 'string' && v.startsWith('shopify://') ? { src: '/fixtures/fixture-wide.png', width: 1200, height: 900, alt: '', aspect_ratio: 1.33 } : v);
  for (const s of defs || []) {
    if (!s.id || NON_VALUE.has(s.type)) continue;
    out[s.id] = asImage(given && given[s.id] !== undefined ? given[s.id] : settingDefault(s));
  }
  return out;
}

const img = (n, alt = '') => ({ src: `/fixtures/fixture-${n}.png`, width: 1200, height: 1200, alt, aspect_ratio: 1 });
const wide = (alt = '') => ({ src: '/fixtures/fixture-wide.png', width: 1200, height: 900, alt, aspect_ratio: 1.33 });
const videoObj = (file, w, h, mimeType = 'video/webm') => ({
  media_type: 'video',
  alt: '',
  sources: [
    { url: `/fixtures/${file}`, format: 'mp4', height: h, width: w, mime_type: mimeType },
    { url: `/fixtures/${file}.m3u8`, format: 'm3u8', height: h, width: w, mime_type: 'application/x-mpegURL' }
  ],
  preview_image: img(1)
});

const state = { cartType: null, cart: [], price: 2999, compareAt: null, stock: 50, scenario: 'empty', maxQty: 10, variants: 1, comment: '', policies: false, bundlePrice: 4999, templates: 'pristine' };

function makeProduct() {
  const mk = (id, title, options = {}) => ({
    id, title, price: state.price, compare_at_price: state.compareAt, available: options.available !== false,
    inventory_management: 'shopify', inventory_policy: 'deny', inventory_quantity: state.stock,
    featured_media: null, url: '/products/self-cleaning-pet-grooming-brush', image: null
  });
  let variants;
  if (state.variants === 1) variants = [mk(1001, 'Default Title')];
  else if (state.variants === 2) { variants = [mk(1001, '1 Pack'), mk(1002, '2 Pack')]; variants[1].price = state.bundlePrice; variants[1].compare_at_price = null; }
  else variants = [mk(1001, 'Option A'), mk(1002, 'Option B'), mk(1003, 'Option C', { available: false })];

  let media = [];
  if (['media', 'productmedia', 'imagesonly'].includes(state.scenario)) {
    media = [1, 2, 3, 4, 5, 6, 7, 8].map((n, i) => ({
      id: 7000 + n, media_type: 'image', alt: `Test fixture ${n}`, src: `/fixtures/fixture-${n}.png`, width: 1200, height: 1200,
      preview_image: img(n)
    }));
    const v = { id: 7100, ...videoObj('clip-a.webm', 1280, 720), alt: 'Test clip A' };
    const v2 = { id: 7101, ...videoObj('clip-b.webm', 720, 900), alt: 'Test clip B' };
    if (state.scenario !== 'imagesonly') media.push(v, v2);
  }
  variants[0].featured_media = media[0] || null;
  if (state.variants > 1 && media.length > 3) variants[1].featured_media = media[3];
  const product = {
    id: 9001, title: 'Self-Cleaning Pet Grooming Brush', handle: 'self-cleaning-pet-grooming-brush',
    url: '/products/self-cleaning-pet-grooming-brush', vendor: 'Not Pawora (should never show)',
    price: state.price, compare_at_price: state.compareAt, description: '<p>Description from Shopify.</p>',
    variants, selected_or_first_available_variant: variants[0], has_only_default_variant: variants.length === 1,
    options_with_values: [{ name: 'Style', values: variants.map((v) => v.title) }],
    media, featured_media: media[0] || null, available: true, type: 'Pet grooming'
  };
  variants.forEach((v) => (v.product = product));
  return product;
}

/* Per-section setting overrides used when scenario === "media" (synthetic fixtures only). */
function scenarioOverrides(type, blockType) {
  if (state.scenario !== 'media') return null;
  const S = {
    hero: { image: img(1, 'Hero test fixture') },
    'video-showcase': {
      video_1: videoObj('clip-a.webm', 1280, 720), video_1_caption: 'The brush in use',
      video_2: videoObj('clip-b.webm', 720, 900), video_2_caption: 'The self-cleaning mechanism'
    },
    intro: { image: img(2, 'Intro test fixture'), image_2: img(7, 'Inset test fixture') },
    'final-cta': { image: img(6, 'Box test fixture') },
    'feature-details': {
      video: videoObj('clip-a.webm', 1280, 720), video_caption: 'The self-cleaning mechanism'
    }
  };
  const B = {
    feature: [{ image: img(3, 'f1') }, { image: img(4, 'f2') }, { image: img(5, 'f3') }],
    step: [{ image: img(7, 'dog') }, { video: videoObj('clip-b.webm', 720, 900), image: img(3) }, { image: img(8, 'cat') }]
  };
  return { settings: S[type] || null, blocks: B };
}

/* ------------------------------------------------------------------ section rendering */
const schemaCache = {};
function loadSectionFile(type) {
  if (true) {
    const file = path.join(THEME, 'sections', type + '.liquid');
    const { stripped, schema } = extractSchema(fs.readFileSync(file, 'utf8'));
    return { tpls: engine.parse(preprocess(stripped)), schema };
  }
}

async function renderSection(globals, id, type, data = {}) {
  const { tpls, schema } = loadSectionFile(type);
  const ov = scenarioOverrides(type);
  const settings = resolveSettings(schema && schema.settings, { ...(data.settings || {}), ...((ov && ov.settings) || {}) });
  const blockOrder = data.block_order || Object.keys(data.blocks || {});
  const counters = {};
  const blocks = blockOrder.map((bid) => {
    const b = data.blocks[bid];
    const def = (schema.blocks || []).find((x) => x.type === b.type) || {};
    counters[b.type] = (counters[b.type] || 0);
    const bov = ov && ov.blocks && ov.blocks[b.type] ? ov.blocks[b.type][counters[b.type]] : null;
    counters[b.type]++;
    return { id: bid, type: b.type, settings: resolveSettings(def.settings, { ...(b.settings || {}), ...(bov || {}) }), shopify_attributes: '' };
  });
  const section = { id, settings, blocks, block_order: blockOrder, type };
  const html = await engine.render(tpls, { section }, { globals });
  const tag = schema && schema.tag === 'div' ? 'div' : 'div';
  return `<${tag} id="shopify-section-${id}" class="shopify-section">${html}</${tag}>`;
}

engine.registerTag('section', class extends Tag {
  constructor(token, remain, liquid) { super(token, remain, liquid); this.name = token.args.trim().replace(/^['"]|['"]$/g, ''); }
  * render(ctx, emitter) {
    emitter.write(yield renderSection(ctx.globals.__globals, this.name, this.name, {}));
  }
});
engine.registerTag('sections', class extends Tag {
  constructor(token, remain, liquid) { super(token, remain, liquid); this.name = token.args.trim().replace(/^['"]|['"]$/g, ''); }
  * render(ctx, emitter) {
    const globals = ctx.globals;
    const group = parseJson(fs.readFileSync(path.join(THEME, 'sections', this.name + '.json'), 'utf8'));
    let out = '';
    for (const key of group.order) {
      const s = group.sections[key];
      out += yield renderSection(globals.__globals, key, s.type, s);
    }
    emitter.write(out);
  }
});

/* ------------------------------------------------------------------ page globals */
function cartObject() {
  const items = state.cart.map((line, i) => {
    const p = line.product;
    const v = p.variants.find((x) => x.id === line.variantId);
    return {
      key: `${line.variantId}:key`, id: line.variantId, quantity: line.quantity, url: p.url,
      image: p.featured_media ? { src: p.featured_media.src || p.featured_media.preview_image.src, alt: p.featured_media.alt || '' } : null,
      product: p, variant: v, final_price: v.price, final_line_price: v.price * line.quantity,
      url_to_remove: `/cart/change?line=${i + 1}&quantity=0`
    };
  });
  return {
    items, item_count: items.reduce((n, i) => n + i.quantity, 0),
    total_price: items.reduce((n, i) => n + i.final_line_price, 0)
  };
}

function buildGlobals({ templateName, pageType, designMode, product }) {
  const themeSchema = JSON.parse(fs.readFileSync(path.join(THEME, 'config/settings_schema.json'), 'utf8'));
  const data = parseJson(fs.readFileSync(path.join(THEME, 'config/settings_data.json'), 'utf8')).current;
  const defs = themeSchema.flatMap((g) => g.settings || []);
  const settings = resolveSettings(defs, { ...data, max_quantity: state.maxQty, ...(state.cartType ? { cart_type: state.cartType } : {}) });
  const prod = product || makeProduct();
  const globals = {
    settings, product: prod,
    collections: { all: { products: [makeProduct()] } },
    collection: { title: 'Products', handle: 'all', products: [makeProduct()] },
    cart: cartObject(),
    shop: { name: 'Pawora Test Store', email: 'hello@example.com',
      shipping_policy: state.policies ? { body: '<p>TEST shipping policy text.</p>', url: '/policies/shipping-policy' } : null,
      refund_policy: state.policies ? { body: '<p>TEST refund policy text.</p>', url: '/policies/refund-policy' } : null },
    request: { design_mode: !!designMode, page_type: pageType, locale: { iso_code: 'en' } },
    routes: {
      root_url: '/', cart_url: '/cart', cart_add_url: '/cart/add', cart_change_url: '/cart/change',
      search_url: '/search', all_products_collection_url: '/collections/all'
    },
    template: { name: templateName }, page_title: 'Pawora', page_description: 'Test page',
    canonical_url: 'http://localhost/', current_page: 1, current_tags: null, page_image: null,
    content_for_header: '', form: { errors: null, 'posted_successfully?': false },
    search: { terms: '', performed: false, results: [], results_count: 0 },
    page: { title: 'Contact', content: '<p>Page body</p>' },
    __paginate: { pages: 1, current_page: 1, previous: null, next: null }
  };
  globals.__globals = globals;
  return globals;
}

async function renderTemplate(name, opts) {
  const tplDir = state.templates === 'live' ? path.join(THEME, 'templates') : path.join(__dirname, 'pristine-templates');
  const tplJson = parseJson(fs.readFileSync(path.join(tplDir, name + '.json'), 'utf8'));
  const globals = buildGlobals({ ...opts, templateName: name.split('.')[0] });
  let content = '';
  for (const key of tplJson.order) {
    content += await renderSection(globals, key, tplJson.sections[key].type, tplJson.sections[key]);
  }
  return renderLayout(globals, content, opts.layout || 'theme');
}

async function renderLayout(globals, content, layout = 'theme') {
  const { stripped } = extractSchema(fs.readFileSync(path.join(THEME, 'layout', layout + '.liquid'), 'utf8'));
  const tpls = engine.parse(preprocess(stripped));
  return engine.render(tpls, { content_for_layout: content }, { globals });
}

/* ------------------------------------------------------------------ HTTP */
const MIME = { '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.webm': 'video/webm', '.woff2': 'font/woff2', '.json': 'application/json', '.svg': 'image/svg+xml' };
const send = (res, code, body, type = 'text/html; charset=utf-8', headers = {}) => { res.writeHead(code, { 'Content-Type': type, ...headers }); res.end(body); };
const redirect = (res, loc) => { res.writeHead(302, { Location: loc }); res.end(); };

function parseBody(req) {
  return new Promise((resolve) => {
    const ct = req.headers['content-type'] || '';
    if (req.method !== 'POST') return resolve({});
    if (ct.startsWith('multipart/form-data')) {
      const bb = Busboy({ headers: req.headers });
      const fields = {};
      bb.on('field', (n, v) => { fields[n] = v; });
      bb.on('close', () => resolve(fields));
      req.pipe(bb);
      return;
    }
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      if (ct.includes('json')) { try { return resolve(JSON.parse(raw)); } catch (e) { return resolve({}); } }
      const fields = {};
      for (const [k, v] of new URLSearchParams(raw)) {
        if (k.endsWith('[]')) (fields[k] = fields[k] || []).push(v); else fields[k] = v;
      }
      resolve(fields);
    });
  });
}

function addToCart(variantId, qty) {
  const product = makeProduct();
  const v = product.variants.find((x) => x.id === Number(variantId));
  if (!v) return { status: 404, message: 'Cart Error', description: 'Cannot find variant' };
  if (!v.available) return { status: 422, message: 'Cart Error', description: 'This item is sold out.' };
  const existing = state.cart.find((l) => l.variantId === v.id);
  const total = (existing ? existing.quantity : 0) + qty;
  if (total > state.stock) return { status: 422, message: 'Cart Error', description: `You can only add ${state.stock} of this item to your cart.` };
  if (existing) existing.quantity = total; else state.cart.push({ variantId: v.id, quantity: qty, product });
  return { ok: true, line: { id: v.id, quantity: total, title: product.title, price: v.price } };
}

async function drawerSections(req, wanted) {
  const jar = Object.fromEntries((req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).filter((x) => x[0]));
  const globals = buildGlobals({ templateName: 'product', pageType: 'product', designMode: false });
  const sections = {};
  for (const id of String(wanted).split(',')) {
    if (id === 'cart-drawer') sections[id] = await renderSection(globals, 'cart-drawer', 'cart-drawer', {});
  }
  return sections;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const p = url.pathname;
    const jar = Object.fromEntries((req.headers.cookie || '').split(';').map((c) => c.trim().split('=')).filter((x) => x[0]));
    const designMode = url.searchParams.get('design_mode') === '1' || jar.design === '1';
    if (url.searchParams.has('scenario')) state.scenario = url.searchParams.get('scenario');

    if (p.startsWith('/assets/')) {
      const f = path.join(THEME, 'assets', path.basename(p));
      return fs.existsSync(f) ? send(res, 200, fs.readFileSync(f), MIME[path.extname(f)] || 'application/octet-stream', { 'Cache-Control': 'no-store' }) : send(res, 404, 'nf');
    }
    if (p.startsWith('/fixtures/')) {
      const f = path.join(FIX, path.basename(p));
      if (!fs.existsSync(f)) return send(res, 404, 'nf');
      const buf = fs.readFileSync(f);
      const type = MIME[path.extname(f)] || 'application/octet-stream';
      const range = req.headers.range;
      if (range) {
        const m = /bytes=(\d*)-(\d*)/.exec(range);
        const start = m[1] ? parseInt(m[1], 10) : 0;
        const end = m[2] ? parseInt(m[2], 10) : buf.length - 1;
        res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${buf.length}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
        return res.end(buf.subarray(start, end + 1));
      }
      return send(res, 200, buf, type, { 'Accept-Ranges': 'bytes' });
    }

    /* test controls */
    if (p === '/__reset') { Object.assign(state, { templates: 'pristine', bundlePrice: 4999, policies: false, cartType: null, cart: [], price: 2999, compareAt: null, stock: 50, scenario: 'empty', maxQty: 10, variants: 1 }); return send(res, 200, 'reset', 'text/plain'); }
    if (p === '/__set') {
      for (const [k, v] of url.searchParams) {
        if (['price', 'stock', 'maxQty', 'variants', 'bundlePrice'].includes(k)) state[k] = parseInt(v, 10);
        else if (k === 'policies') state.policies = v === '1';
        else if (k === 'templates') state.templates = v;
        else if (k === 'compareAt') state.compareAt = v ? parseInt(v, 10) : null;
        else if (k === 'scenario') state.scenario = v;
        else if (k === 'cartType') state.cartType = v || null;
      }
      return send(res, 200, JSON.stringify(state), 'application/json');
    }
    if (p === '/__state') return send(res, 200, JSON.stringify({ ...state, cart: state.cart.map((l) => ({ variantId: l.variantId, quantity: l.quantity })) }), 'application/json');

    /* cart API */
    if (p === '/cart.js') {
      const c = cartObject();
      return send(res, 200, JSON.stringify({ item_count: c.item_count, total_price: c.total_price, items: c.items.map((i) => ({ id: i.id, quantity: i.quantity, final_price: i.final_price, final_line_price: i.final_line_price, title: i.product.title })) }), 'application/json');
    }
    if (p === '/cart/add.js') {
      const body = await parseBody(req);
      const r = addToCart(body.id, parseInt(body.quantity || '1', 10));
      if (!r.ok) return send(res, r.status, JSON.stringify(r), 'application/json');
      const out = { ...r.line };
      if (body.sections) out.sections = await drawerSections(req, body.sections);
      return send(res, 200, JSON.stringify(out), 'application/json');
    }
    if (p === '/cart/change.js') {
      const body = await parseBody(req);
      const idx = Number(body.line) - 1;
      const line = state.cart[idx];
      if (!line) return send(res, 422, JSON.stringify({ status: 422, message: 'Cart Error', description: 'Cannot find line item' }), 'application/json');
      const q = Number(body.quantity);
      if (q > state.stock) return send(res, 422, JSON.stringify({ status: 422, message: 'Cart Error', description: `You can only add ${state.stock} of this item to your cart.` }), 'application/json');
      if (q <= 0) state.cart.splice(idx, 1); else line.quantity = q;
      const c = cartObject();
      const out = { item_count: c.item_count, total_price: c.total_price };
      if (body.sections) out.sections = await drawerSections(req, body.sections);
      return send(res, 200, JSON.stringify(out), 'application/json');
    }
    if (p === '/cart/add' && req.method === 'POST') {
      const body = await parseBody(req);
      const r = addToCart(body.id, parseInt(body.quantity || '1', 10));
      return redirect(res, '/cart');
    }
    if (p === '/cart/change') {
      const idx = Number(url.searchParams.get('line')) - 1;
      if (state.cart[idx]) state.cart.splice(idx, 1);
      return redirect(res, '/cart');
    }
    if (p === '/cart' && req.method === 'POST') {
      const body = await parseBody(req);
      if (body.checkout !== undefined) return redirect(res, '/checkout');
      (body['updates[]'] || []).forEach((q, i) => { if (state.cart[i]) { if (Number(q) <= 0) state.cart[i] = null; else state.cart[i].quantity = Number(q); } });
      state.cart = state.cart.filter(Boolean);
      return redirect(res, '/cart');
    }
    if (p === '/checkout') return send(res, 200, '<!doctype html><title>Checkout</title><h1 id="checkout-reached">CHECKOUT REACHED (mock)</h1>');
    if (p === '/' && url.searchParams.has('sections')) {
      return send(res, 200, JSON.stringify(await drawerSections(req, url.searchParams.get('sections'))), 'application/json');
    }

    /* pages */
    const opts = { designMode, pageType: 'index' };
    let html;
    if (p === '/') html = await renderTemplate('index', { ...opts, pageType: 'index' });
    else if (p.startsWith('/products/')) html = await renderTemplate('product', { ...opts, pageType: 'product' });
    else if (p === '/collections/all') html = await renderTemplate('collection', { ...opts, pageType: 'collection' });
    else if (p === '/cart') html = await renderTemplate('cart', { ...opts, pageType: 'cart' });
    else if (p === '/search') html = await renderTemplate('search', { ...opts, pageType: 'search' });
    else if (p === '/pages/contact') html = await renderTemplate('page.contact', { ...opts, pageType: 'page' });
    else if (p === '/password') html = await renderTemplate('password', { ...opts, pageType: 'password', layout: 'password' });
    else if (p.startsWith('/pages/') || p.startsWith('/policies/')) html = await renderTemplate('page', { ...opts, pageType: 'page' });
    else html = await renderTemplate('404', { ...opts, pageType: '404' });
    return send(res, p === '/' || p.startsWith('/products/') || p === '/collections/all' || p === '/cart' || p === '/search' || p.startsWith('/pages/') || p.startsWith('/policies/') || p === '/password' ? 200 : 404, html);
  } catch (err) {
    console.error(err);
    send(res, 500, `<pre>${String(err && err.stack || err).replace(/</g, '&lt;')}</pre>`);
  }
});

server.listen(PORT, () => console.log(`harness listening on http://localhost:${PORT}`));
