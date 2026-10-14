const { chromium } = require('playwright-core');
const fs = require('fs');
const THEME = process.env.THEME_DIR || require('path').resolve(__dirname, '../..');
const THEME_DIRS = ['assets', 'config', 'layout', 'locales', 'sections', 'snippets', 'templates'];
const BASE = 'http://localhost:4177'; const PRODUCT = '/products/self-cleaning-pet-grooming-brush';
let bad = 0; const ok = (n, c, d = '') => { if (!c) bad++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}${d ? '  -> ' + d : ''}`); };
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
  // cart as page
  await fetch(BASE + '/__reset'); await fetch(BASE + '/__set?scenario=media&cartType=page');
  let ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); let page = await ctx.newPage();
  await page.goto(BASE + PRODUCT, { waitUntil: 'networkidle' });
  ok('cart style "page": no drawer element rendered', (await page.locator('cart-drawer').count()) === 0);
  await page.fill('[data-qty-input]', '2');
  await Promise.all([page.waitForURL('**/cart'), page.click('[data-add-to-cart]')]);
  ok('cart style "page": Add to Cart lands on the cart page with the item', /\/cart$/.test(page.url()) && /59\.98/.test(await page.locator('.pw-cartpage').innerText()));
  await ctx.close();
  await fetch(BASE + '/__reset'); await fetch(BASE + '/__set?scenario=media');

  // fonts from theme assets
  ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); page = await ctx.newPage();
  const fontReqs = []; page.on('response', (r) => { if (/\.woff2/.test(r.url())) fontReqs.push(r.url().split('/').pop().split('?')[0] + ':' + r.status()); });
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  const fonts = await page.evaluate(async () => { await document.fonts.ready; return [...document.fonts].map((f) => `${f.family}:${f.status}`); });
  ok('bundled Bricolage Grotesque + Figtree load from the theme (no Google Fonts request)', fonts.some((f) => /Bricolage.*loaded/.test(f)) && fonts.some((f) => /Figtree.*loaded/.test(f)), fonts.join(', ') + ' | ' + fontReqs.join(','));
  const fam = await page.evaluate(() => ({ h1: getComputedStyle(document.querySelector('h1')).fontFamily.split(',')[0], body: getComputedStyle(document.body).fontFamily.split(',')[0], h1w: getComputedStyle(document.querySelector('h1')).fontWeight }));
  ok('headline uses Bricolage Grotesque 700, body uses Figtree', /Bricolage/.test(fam.h1) && /Figtree/.test(fam.body) && fam.h1w === '700', JSON.stringify(fam));
  const ext = await page.evaluate(() => performance.getEntriesByType('resource').map((e) => new URL(e.name).host).filter((h) => h !== location.host));
  ok('no third-party network requests on the homepage', ext.length === 0, [...new Set(ext)].join(','));
  await ctx.close();

  // class coverage
  const css = fs.readFileSync(THEME + '/assets/theme.css', 'utf8');
  const defined = new Set([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]));
  const used = new Set();
  for (const f of THEME_DIRS.flatMap((d) => fs.readdirSync(`${THEME}/${d}`, { recursive: true }).map((x) => `${d}/${x}`)).filter((f) => /\.liquid$/.test(f))) {
    const src = fs.readFileSync(THEME + '/' + f, 'utf8');
    for (const m of src.matchAll(/class="([^"]*)"/g)) for (const c of m[1].replace(/\{[%{][\s\S]*?[%}]\}/g, ' ').split(/\s+/)) if (/^pw-/.test(c)) used.add(c);
    for (const m of src.matchAll(/class:\s*'([^']*)'/g)) for (const c of m[1].split(/\s+/)) if (/^pw-/.test(c)) used.add(c);
    for (const m of src.matchAll(/'(pw-[\w-]+(?: pw-[\w-]+)*)'/g)) for (const c of m[1].split(/\s+/)) used.add(c);
  }
  // Wrapper / JavaScript-hook classes that intentionally have no rule of their own.
  const HOOKS = new Set(['pw-template-password', 'pw-faq', 'pw-btn__arrow', 'pw-nav', 'pw-cart-link', 'pw-steps', 'pw-page', 'pw-cartpage', 'pw-cartpage__form', 'pw-collection', 'pw-card__mark', 'pw-product', 'pw-buy', 'pw-search-page', 'pw-price__current']);
  const missing = [...used].filter((c) => !defined.has(c) && !/--$|-$/.test(c) && !HOOKS.has(c));
  ok('every styled pw- class used in Liquid has a CSS rule (hook-only classes excluded)', missing.length === 0, missing.join(', '));
  const jsSrc = fs.readFileSync(THEME + '/assets/theme.js', 'utf8');
  console.log('unused-in-Liquid CSS classes (informational):', [...defined].filter((c) => /^pw-/.test(c) && !used.has(c) && !jsSrc.includes(c)).join(', ') || 'none');
  await browser.close();
  process.exit(bad ? 1 : 0);
})();
