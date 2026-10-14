const { chromium } = require('playwright-core');
const CHROME = process.env.CHROME_PATH || undefined;
const BASE = 'http://localhost:4177';
require('fs').mkdirSync('shots', { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const jobs = [
    // [name, path, viewport]
    ['home-media-desktop', '/?scenario=media', { width: 1440, height: 900 }],
    ['home-media-mobile', '/?scenario=media', { width: 390, height: 844 }],
    ['product-media-desktop', '/products/self-cleaning-pet-grooming-brush?scenario=media', { width: 1440, height: 900 }],
    ['product-media-mobile', '/products/self-cleaning-pet-grooming-brush?scenario=media', { width: 390, height: 844 }],
  ];
  for (const [name, p, vp] of jobs) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error') console.log(`[${name}] console error:`, m.text()); });
    page.on('pageerror', e => console.log(`[${name}] page error:`, e.message));
    await page.goto(BASE + p, { waitUntil: 'networkidle' });
    page.on('response', r => { if (r.status() >= 400) console.log(`[${name}] HTTP ${r.status()} ${r.url()}`); });
    // scroll through so lazy images load and in-view videos start, then return to top
    await page.evaluate(async () => { const h = document.documentElement.scrollHeight; for (let y = 0; y < h; y += 500) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } window.scrollTo(0, 0); });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `shots/${name}.png`, fullPage: true });
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    console.log(name, 'height', h, 'scrollWidth', sw, 'viewport', vp.width);
    await ctx.close();
  }
  await browser.close();
})();
