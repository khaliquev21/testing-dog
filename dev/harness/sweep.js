// Responsive sweep: no horizontal scrolling and no clipped content at common device widths.
const { chromium } = require('playwright-core');
const BASE = 'http://localhost:4177';
const PAGES = [['home', '/'], ['product', '/products/self-cleaning-pet-grooming-brush'], ['cart', '/cart'], ['collection', '/collections/all'], ['contact', '/pages/contact']];
const WIDTHS = [320, 360, 390, 414, 600, 768, 820, 1024, 1100, 1280, 1440, 1920];
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
  let bad = 0, n = 0;
  for (const scenario of ['media', 'empty']) {
    await fetch(BASE + '/__reset'); await fetch(BASE + '/__set?scenario=' + scenario);
    for (const w of WIDTHS) {
      const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
      const page = await ctx.newPage();
      for (const [name, path] of PAGES) {
        await page.goto(BASE + path, { waitUntil: 'networkidle' });
        const sw = await page.evaluate(() => document.documentElement.scrollWidth);
        n++;
        if (sw > w) {
          bad++;
          const culprit = await page.evaluate((vw) => { const o = []; document.querySelectorAll('body *').forEach((e) => { const r = e.getBoundingClientRect(); if (r.right > vw + 1 && r.width > 0) o.push(e.tagName.toLowerCase() + '.' + (e.getAttribute('class') || '').split(' ')[0] + ' right=' + Math.round(r.right)); }); return o.slice(0, 4).join(' | '); }, w);
          console.log(`OVERFLOW ${scenario} ${name} @${w}: scrollWidth=${sw}  ${culprit}`);
        }
      }
      await ctx.close();
    }
  }
  await browser.close();
  console.log(bad ? `${bad} of ${n} page/width combinations overflow` : `PASS  no horizontal overflow in ${n} page/width combinations (${WIDTHS[0]}px to ${WIDTHS[WIDTHS.length - 1]}px)`);
  process.exit(bad ? 1 : 0);
})();
