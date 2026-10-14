const { chromium } = require('playwright-core');
const BASE = 'http://localhost:4177'; const PRODUCT = '/products/self-cleaning-pet-grooming-brush';
require('fs').mkdirSync('shots', { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ['--no-sandbox'] });
  const scroll = (page) => page.evaluate(async () => { const h = document.documentElement.scrollHeight; for (let y = 0; y < h; y += 500) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 100)); } window.scrollTo(0, 0); });
  // cart drawer open, desktop + mobile
  for (const [tag, vp] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    await fetch(BASE + '/__reset'); await fetch(BASE + '/__set?scenario=media');
    const ctx = await browser.newContext({ viewport: vp }); const page = await ctx.newPage();
    await page.goto(BASE + PRODUCT, { waitUntil: 'networkidle' });
    await page.click('[data-qty-plus]'); await page.click('[data-add-to-cart]');
    await page.waitForSelector('cart-drawer.is-open'); await page.waitForTimeout(600);
    await page.screenshot({ path: `shots/drawer-${tag}.png` });
    await ctx.close();
  }
  // mobile menu open
  { await fetch(BASE + '/__reset'); await fetch(BASE + '/__set?scenario=media');
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); const page = await ctx.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle' }); await page.click('[data-menu-toggle]'); await page.waitForTimeout(200);
    await page.screenshot({ path: 'shots/mobile-menu.png', clip: { x: 0, y: 0, width: 390, height: 520 } }); await ctx.close(); }
  // first-preview state (no media uploaded yet), storefront and editor
  for (const [tag, q] of [['empty-storefront', ''], ['empty-editor', '&design_mode=1']]) {
    await fetch(BASE + '/__reset');
    for (const [pn, path] of [['home', '/'], ['product', PRODUCT]]) {
      const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const page = await ctx.newPage();
      await page.goto(BASE + path + '?scenario=empty' + q, { waitUntil: 'networkidle' }); await scroll(page); await page.waitForTimeout(300);
      await page.screenshot({ path: `shots/${pn}-${tag}.png`, fullPage: true }); await ctx.close();
    }
  }
  await browser.close();
})();
