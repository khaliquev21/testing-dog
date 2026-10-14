const { chromium } = require('playwright-core');
const fs = require('fs');
const axeSrc = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const THEME = process.env.THEME_DIR || require('path').resolve(__dirname, '../..');
const BASE = 'http://localhost:4177';
const THEME_DIRS = ['assets', 'config', 'layout', 'locales', 'sections', 'snippets', 'templates'];
const themeFiles = () => THEME_DIRS.flatMap((d) => fs.readdirSync(`${THEME}/${d}`, { recursive: true }).map((f) => `${d}/${f}`)).filter((f) => /\.(css|js|liquid|json)$/.test(f));

const PRODUCT = '/products/self-cleaning-pet-grooming-brush';

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b); let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min; s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) { case r: h = (g - b) / d + (g < b ? 6 : 0); break; case g: h = (b - r) / d + 2; break; default: h = (r - g) / d + 4; }
    h *= 60;
  }
  return { h, s, l };
}
const isGreen = ({ h, s, l }) => s > 0.12 && l > 0.08 && l < 0.97 && h >= 65 && h <= 175;

(async () => {
  let failures = 0;
  const fail = (m) => { failures++; console.log('FAIL', m); };

  /* ---- 1. Static colour scan of every colour literal in CSS/JS/Liquid/JSON ---- */
  const files = themeFiles();
  const colours = new Map();
  for (const f of files) {
    const src = fs.readFileSync(`${THEME}/${f}`, 'utf8');
    for (const m of src.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)) {
      let hex = m[1]; if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
      const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
      const key = '#' + hex.toUpperCase();
      if (!colours.has(key)) colours.set(key, { hsl: rgbToHsl(r, g, b), files: new Set() });
      colours.get(key).files.add(f);
    }
    for (const m of src.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)) {
      const key = `rgb(${m[1]},${m[2]},${m[3]})`;
      if (!colours.has(key)) colours.set(key, { hsl: rgbToHsl(+m[1], +m[2], +m[3]), files: new Set() });
      colours.get(key).files.add(f);
    }
    if (/\b(green|lime|sage|olive|emerald|mint|teal)\b/i.test(src.replace(/Greenwich/g, ''))) fail(`colour word in ${f}`);
  }
  const greens = [...colours].filter(([, v]) => isGreen(v.hsl));
  console.log(`Static scan: ${colours.size} distinct colour values across ${files.length} files`);
  console.log([...colours].map(([k, v]) => `${k} (h${Math.round(v.hsl.h)})`).join('  '));
  if (greens.length) fail('green-hued colour literals: ' + greens.map(([k]) => k).join(', '));
  else console.log('PASS  no green-hued colour literal anywhere in the theme source');

  /* ---- 2. Computed-colour scan in a real browser ---- */
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
  const targets = [
    ['home/media', '/?scenario=media'], ['product/media', PRODUCT + '?scenario=media'],
    ['home/empty', '/?scenario=empty'], ['product/empty', PRODUCT + '?scenario=empty'],
    ['home/editor', '/?scenario=empty&design_mode=1'], ['product/editor', PRODUCT + '?scenario=empty&design_mode=1'],
    ['collection', '/collections/all'], ['cart', '/cart'], ['contact', '/pages/contact'], ['404', '/nothing-here'],
  ];
  let greenEls = 0, checked = 0;
  for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    for (const [name, path] of targets) {
      const ctx = await browser.newContext({ viewport: vp });
      const page = await ctx.newPage();
      await page.goto(BASE + path, { waitUntil: 'networkidle' });
      const found = await page.evaluate(() => {
        const out = [];
        const parse = (c) => { const m = c.match(/rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:[, /]+([\d.]+))?/); return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null; };
        document.querySelectorAll('body, body *').forEach((el) => {
          const cs = getComputedStyle(el);
          for (const prop of ['color', 'backgroundColor', 'borderTopColor', 'borderBottomColor', 'fill', 'stroke', 'outlineColor']) {
            const v = cs[prop]; if (!v || v === 'none') continue; const c = parse(v); if (!c || c.a < 0.05) continue;
            out.push({ prop, c, el: el.tagName.toLowerCase() + '.' + (el.getAttribute('class') || '').toString().split(' ')[0] });
          }
        });
        return out;
      });
      for (const f of found) {
        checked++;
        if (isGreen(rgbToHsl(f.c.r, f.c.g, f.c.b))) { greenEls++; if (greenEls < 6) console.log('  green computed:', JSON.stringify(f)); }
      }
      await ctx.close();
    }
  }
  console.log(`Computed-style scan: ${checked} colour values on ${targets.length * 2} page/viewport combos`);
  if (greenEls) fail(`${greenEls} computed green colours`); else console.log('PASS  zero green colours in rendered pages (computed styles)');

  /* ---- 3. The word GIF must not appear anywhere customers can see it ---- */
  const gifRe = /\bgifs?\b/i;
  const srcHits = [];
  for (const f of files) {
    const src = fs.readFileSync(`${THEME}/${f}`, 'utf8').split('\n');
    src.forEach((line, i) => { if (gifRe.test(line) || /\.gif\b/i.test(line)) srcHits.push(`${f}:${i + 1}`); });
  }
  if (srcHits.length) fail('"GIF" in theme source: ' + srcHits.join(', ')); else console.log('PASS  the word "GIF" appears nowhere in the theme (storefront or editor labels)');
  let renderedHits = 0;
  for (const scenario of ['empty', 'media']) for (const design of ['', '&design_mode=1']) for (const [, path] of targets) {
    const html = await (await fetch(BASE + path + (path.includes('?') ? '&' : '?') + 'scenario=' + scenario + design)).text();
    const text = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
    if (gifRe.test(text) || /\.gif/i.test(text)) renderedHits++;
  }
  if (renderedHits) fail(`GIF found in ${renderedHits} rendered pages`); else console.log('PASS  no "GIF" in any rendered page (all templates, with and without media, editor view)');

  /* ---- 4. axe-core accessibility scan ---- */
  console.log('\nAccessibility (axe-core, WCAG 2 A/AA):');
  for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    for (const [name, path] of [['home', '/?scenario=media'], ['product', PRODUCT + '?scenario=media'], ['cart', '/cart'], ['home-empty', '/?scenario=empty'], ['product-empty', PRODUCT + '?scenario=empty']]) {
      const ctx = await browser.newContext({ viewport: vp });
      const page = await ctx.newPage();
      await page.goto(BASE + path, { waitUntil: 'networkidle' });
      await page.evaluate(axeSrc);
      const res = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } }));
      const v = res.violations.map((x) => `${x.id}(${x.nodes.length}): ${x.nodes.slice(0, 2).map((n) => n.target.join(' ')).join(' | ')}`);
      console.log(`${v.length ? 'WARN' : 'PASS'}  ${name} @${vp.width}: ${v.length ? v.join(' ;; ') : 'no violations'}`);
      if (v.length) failures++;
      await ctx.close();
    }
  }
  await browser.close();
  console.log(failures ? `\n${failures} audit problem(s)` : '\nAll audits clean');
  process.exit(failures ? 1 : 0);
})();
