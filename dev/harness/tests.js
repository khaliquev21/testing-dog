/* Behaviour tests for the Pawora theme, run against the mock-Shopify harness. */
const { chromium } = require('playwright-core');
const fs = require('fs');

const CHROME = process.env.CHROME_PATH || undefined;
const THEME = process.env.THEME_DIR || require('path').resolve(__dirname, '../..');
const BASE = 'http://localhost:4177';
const THEME_DIRS = ['assets', 'config', 'layout', 'locales', 'sections', 'snippets', 'templates'];
const themeFiles = () => THEME_DIRS.flatMap((d) => fs.readdirSync(`${THEME}/${d}`, { recursive: true }).map((f) => `${d}/${f}`)).filter((f) => /\.(css|js|liquid|json)$/.test(f));

const PRODUCT = '/products/self-cleaning-pet-grooming-brush';

const results = [];
let currentGroup = '';
function group(name) { currentGroup = name; console.log(`\n## ${name}`); }
function check(name, ok, detail = '') {
  results.push({ group: currentGroup, name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  -> ' + detail : ''}`);
}
const get = async (p) => (await fetch(BASE + p)).text();
const state = async () => (await fetch(BASE + '/__state')).json();
const set = (q) => fetch(BASE + '/__set?' + q);
const reset = () => fetch(BASE + '/__reset');

async function newPage(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) page.errors.push('console: ' + m.text()); });
  return { ctx, page };
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });

  /* ------------------------------------------------------------------ GALLERY */
  group('Gallery and looping videos');
  await reset(); await set('scenario=media');
  {
    const { ctx, page } = await newPage(browser);
    await page.goto(BASE + PRODUCT, { waitUntil: 'networkidle' });
    const total = await page.locator('[data-gallery-slide]').count();
    check('gallery renders every Shopify media item as a slide', total === 10, `slides=${total}`);
    check('thumbnails render for every media item', (await page.locator('[data-gallery-thumb]').count()) === 10);
    check('first slide active, counter reads 1', (await page.locator('[data-gallery-current]').innerText()) === '1' && (await page.locator('[data-gallery-slide].is-active').getAttribute('data-index')) === '0');

    await page.click('[data-gallery-next]');
    check('next arrow moves to slide 2', (await page.locator('[data-gallery-slide].is-active').getAttribute('data-index')) === '1' && (await page.locator('[data-gallery-current]').innerText()) === '2');
    check('active thumbnail follows (aria-pressed)', (await page.locator('[data-gallery-thumb][aria-pressed="true"]').getAttribute('data-index')) === '1');

    await page.click('[data-gallery-prev]'); await page.click('[data-gallery-prev]');
    check('prev from first wraps to last item', (await page.locator('[data-gallery-slide].is-active').getAttribute('data-index')) === '9');

    await page.click('[data-gallery-thumb][data-index="3"]');
    check('clicking a thumbnail selects that slide', (await page.locator('[data-gallery-slide].is-active').getAttribute('data-index')) === '3');

    await page.keyboard.press('Escape');
    await page.focus('[data-gallery-thumb][data-index="3"]');
    await page.keyboard.press('ArrowRight');
    check('keyboard ArrowRight advances slide', (await page.locator('[data-gallery-slide].is-active').getAttribute('data-index')) === '4');

    // video slide
    await page.click('[data-gallery-thumb][data-index="8"]');
    await page.waitForTimeout(900);
    const vid = page.locator('[data-gallery-slide][data-index="8"] video');
    const props = await vid.evaluate((v) => ({ paused: v.paused, muted: v.muted, loop: v.loop, playsInline: v.playsInline, controls: v.controls, ct: v.currentTime }));
    check('video slide autoplays muted', !props.paused && props.muted, JSON.stringify(props));
    check('video is set to loop, inline, no native controls', props.loop && props.playsInline && !props.controls);
    check('pause control visible while playing, big play hidden and not focusable', (await page.locator('[data-gallery-slide][data-index="8"] [data-loop-toggle]').isVisible()) && (await page.locator('[data-gallery-slide][data-index="8"] [data-loop-play]').evaluate((b) => getComputedStyle(b).visibility === 'hidden')));

    await page.waitForTimeout(4200);
    const loopInfo = await vid.evaluate((v) => ({ paused: v.paused, ended: v.ended, ct: v.currentTime, dur: v.duration }));
    check('video keeps looping past its end (4s clip after ~5s)', !loopInfo.paused && !loopInfo.ended, JSON.stringify(loopInfo));

    await page.click('[data-gallery-slide][data-index="8"] [data-loop-toggle]');
    await page.locator('[data-gallery-slide][data-index="8"] [data-loop-play]').waitFor({ state: 'visible', timeout: 2000 });
    check('pause button pauses the video and shows the big play button', (await vid.evaluate((v) => v.paused)) && (await page.locator('[data-gallery-slide][data-index="8"] [data-loop-play]').isVisible()));
    await page.click('[data-gallery-thumb][data-index="0"]');
    await page.click('[data-gallery-thumb][data-index="8"]');
    await page.waitForTimeout(500);
    check('shopper-paused video stays paused when revisited', await vid.evaluate((v) => v.paused));
    await page.click('[data-gallery-slide][data-index="8"] [data-loop-play]');
    await page.waitForTimeout(500);
    check('big play button resumes playback', !(await vid.evaluate((v) => v.paused)));

    await page.click('[data-gallery-thumb][data-index="9"]');
    await page.waitForTimeout(600);
    check('leaving a video slide pauses it', await vid.evaluate((v) => v.paused));
    check('next video slide plays', !(await page.locator('[data-gallery-slide][data-index="9"] video').evaluate((v) => v.paused)));
    check('no JS errors on product page', page.errors.length === 0, page.errors.join(' | '));
    await ctx.close();
  }

  // reduced motion
  {
    const { ctx, page } = await newPage(browser, { reducedMotion: 'reduce' });
    await page.goto(BASE + PRODUCT, { waitUntil: 'networkidle' });
    await page.click('[data-gallery-thumb][data-index="8"]');
    await page.waitForTimeout(800);
    const vid = page.locator('[data-gallery-slide][data-index="8"] video');
    check('prefers-reduced-motion: video does NOT autoplay, play button shown', (await vid.evaluate((v) => v.paused)) && (await page.locator('[data-gallery-slide][data-index="8"] [data-loop-play]').isVisible()));
    await page.click('[data-gallery-slide][data-index="8"] [data-loop-play]');
    await page.waitForTimeout(500);
    check('prefers-reduced-motion: shopper can still press play', !(await vid.evaluate((v) => v.paused)));
    await ctx.close();
  }

  // homepage demo videos: in view plays, out of view pauses
  {
    const { ctx, page } = await newPage(browser);
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.querySelector('#demo').scrollIntoView());
    await page.waitForTimeout(1000);
    const states = await page.$$eval('#demo video', (vs) => vs.map((v) => ({ paused: v.paused, muted: v.muted, loop: v.loop })));
    check('homepage demo videos autoplay muted + loop when in view', states.length === 2 && states.every((s) => !s.paused && s.muted && s.loop), JSON.stringify(states));
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(800);
    const out = await page.$$eval('#demo video', (vs) => vs.map((v) => v.paused));
    check('demo videos pause when scrolled out of view', out.every(Boolean), JSON.stringify(out));
    await ctx.close();
  }

  /* ------------------------------------------------------------------ QUANTITY */
  group('Quantity selector');
  await reset(); await set('scenario=media');
  {
    const { ctx, page } = await newPage(browser);
    await page.goto(BASE + PRODUCT, { waitUntil: 'networkidle' });
    const q = () => page.inputValue('[data-qty-input]');
    check('starts at 1, decrease disabled', (await q()) === '1' && (await page.locator('[data-qty-minus]').isDisabled()));
    await page.click('[data-qty-plus]'); await page.click('[data-qty-plus]');
    check('increase works (1 -> 3)', (await q()) === '3');
    await page.click('[data-qty-minus]');
    check('decrease works (3 -> 2)', (await q()) === '2');
    for (let i = 0; i < 12; i++) await page.click('[data-qty-plus]', { force: true }).catch(() => {});
    check('stops at max 10 and disables increase', (await q()) === '10' && (await page.locator('[data-qty-plus]').isDisabled()));
    await page.fill('[data-qty-input]', '25'); await page.locator('[data-qty-input]').blur();
    check('typing above max clamps to 10', (await q()) === '10');
    await page.fill('[data-qty-input]', 'abc'); await page.locator('[data-qty-input]').blur();
    check('non-numeric input falls back to 1', (await q()) === '1');
    await ctx.close();
  }
  await set('maxQty=3');
  {
    const { ctx, page } = await newPage(browser);
    await page.goto(BASE + PRODUCT, { waitUntil: 'networkidle' });
    for (let i = 0; i < 6; i++) await page.click('[data-qty-plus]', { force: true }).catch(() => {});
    check('max quantity comes from theme setting (3)', (await page.inputValue('[data-qty-input]')) === '3');
    await ctx.close();
  }
  await set('maxQty=10&stock=2');
  {
    const { ctx, page } = await newPage(browser);
    await page.goto(BASE + PRODUCT, { waitUntil: 'networkidle' });
    for (let i = 0; i < 5; i++) await page.click('[data-qty-plus]', { force: true }).catch(() => {});
    check('max quantity respects tracked inventory (2)', (await page.inputValue('[data-qty-input]')) === '2');
    await ctx.close();
  }

  /* ------------------------------------------------------------------ ADD TO CART + DRAWER */
  group('Add to Cart and cart drawer');
  await reset(); await set('scenario=media');
  {
    const { ctx, page } = await newPage(browser);
    const addReqs = [];
    page.on('request', (r) => { if (r.url().includes('/cart/add.js')) addReqs.push(r); });
    await page.goto(BASE + PRODUCT, { waitUntil: 'networkidle' });
    await page.click('[data-qty-plus]'); await page.click('[data-qty-plus]'); // qty 3
    await page.click('[data-add-to-cart]');
    await page.waitForSelector('cart-drawer.is-open');
    const s1 = await state();
    check('Add to Cart posts the real variant id and chosen quantity', s1.cart.length === 1 && s1.cart[0].variantId === 1001 && s1.cart[0].quantity === 3, JSON.stringify(s1.cart));
    check('request uses Shopify /cart/add.js', addReqs.length === 1);
    check('drawer opens after adding', await page.locator('cart-drawer').evaluate((d) => d.classList.contains('is-open') && d.getAttribute('aria-hidden') === 'false'));
    const line = await page.locator('.pw-line').first().innerText();
    check('drawer line shows quantity 3, unit price $29.99 and line total $89.97', /29\.99/.test(line) && /89\.97/.test(line), line.replace(/\s+/g, ' '));
    check('drawer input shows quantity 3', (await page.inputValue('[data-line-input]')) === '3');
    check('drawer subtotal is $89.97', /\$89\.97/.test(await page.locator('.pw-drawer__subtotal').innerText()));
    check('header cart badge shows 3', (await page.locator('.pw-cart-link [data-cart-count]').innerText()) === '3');
    check('cart link aria-label updates', /3 items/.test(await page.locator('.pw-cart-link').getAttribute('aria-label')));
    check('button label reads "Added to Cart"', (await page.locator('[data-add-label]').innerText()) === 'Added to Cart');
    check('focus moved into the drawer', await page.evaluate(() => document.querySelector('.pw-drawer__panel').contains(document.activeElement)));

    await page.keyboard.press('Escape');
    check('Escape closes drawer', !(await page.locator('cart-drawer').evaluate((d) => d.classList.contains('is-open'))));
    check('focus returns to the Add to Cart button', await page.evaluate(() => document.activeElement && document.activeElement.hasAttribute('data-add-to-cart')));

    // second add accumulates
    await page.click('[data-qty-minus]'); // qty back to 2
    check('label resets when quantity changes', (await page.locator('[data-add-label]').innerText()) === 'Add to Cart');
    await page.click('[data-add-to-cart]');
    await page.waitForSelector('cart-drawer.is-open');
    await page.waitForTimeout(300);
    const s2 = await state();
    check('adding again accumulates quantity (3 + 2 = 5)', s2.cart[0].quantity === 5, JSON.stringify(s2.cart));
    check('subtotal updates to $149.95', /\$149\.95/.test(await page.locator('.pw-drawer__subtotal').innerText()));

    // drawer controls
    await page.click('[data-line-plus]'); await page.waitForTimeout(400);
    check('drawer + increases cart quantity in Shopify cart', (await state()).cart[0].quantity === 6);
    await page.click('[data-line-minus]'); await page.waitForTimeout(400);
    check('drawer - decreases cart quantity', (await state()).cart[0].quantity === 5);
    await page.fill('[data-line-input]', '4'); await page.locator('[data-line-input]').blur(); await page.waitForTimeout(400);
    check('typing a quantity in the drawer updates the cart', (await state()).cart[0].quantity === 4);

    // checkout goes to checkout
    const [nav] = await Promise.all([page.waitForNavigation(), page.click('button[name="checkout"]')]);
    check('Checkout button submits to the checkout flow', /\/checkout$/.test(page.url()) && (await page.locator('#checkout-reached').count()) === 1, page.url());

    await page.goto(BASE + PRODUCT, { waitUntil: 'networkidle' });
    await page.click('[data-cart-open]');
    await page.waitForSelector('cart-drawer.is-open');
    check('header bag icon opens drawer with existing items', (await page.locator('.pw-line').count()) === 1);
    await page.click('[data-line-remove]'); await page.waitForTimeout(500);
    check('Remove empties the cart', (await state()).cart.length === 0);
    check('empty state shown and badge returns to 0', (await page.locator('.pw-drawer__empty').count()) === 1 && (await page.locator('.pw-cart-link [data-cart-count]').innerText()) === '0');
    await page.click('.pw-drawer__overlay', { position: { x: 20, y: 300 } });
    check('clicking the overlay closes the drawer', !(await page.locator('cart-drawer').evaluate((d) => d.classList.contains('is-open'))));
    check('no JS errors during cart flow', page.errors.length === 0, page.errors.join(' | '));
    await ctx.close();
  }

  // error path
  await reset(); await set('scenario=media&stock=2');
  {
    const { ctx, page } = await newPage(browser);
    await page.goto(BASE + PRODUCT, { waitUntil: 'networkidle' });
    await page.fill('[data-qty-input]', '2');
    await page.click('[data-add-to-cart]'); await page.waitForSelector('cart-drawer.is-open');
    await page.keyboard.press('Escape');
    await page.click('[data-add-to-cart]'); // would make 4 > stock 2
    await page.waitForSelector('[data-form-error]:not([hidden])');
    check('over-stock add shows Shopify error message, no drawer reopen', /only add 2/.test(await page.locator('[data-form-error]').innerText()) && (await state()).cart[0].quantity === 2, await page.locator('[data-form-error]').innerText());
    await ctx.close();
  }

  // JS disabled fallback
  await reset(); await set('scenario=media');
  {
    const { ctx, page } = await newPage(browser, { javaScriptEnabled: false });
    await page.goto(BASE + PRODUCT, { waitUntil: 'load' });
    await page.fill('[data-qty-input]', '2');
    await Promise.all([page.waitForNavigation(), page.click('[data-add-to-cart]')]);
    check('without JavaScript the form still adds to the real cart (POST /cart/add -> /cart)', /\/cart$/.test(page.url()) && (await state()).cart[0].quantity === 2, page.url());
    const t = await page.locator('.pw-cartpage').innerText();
    check('cart page lists the item at the Shopify price', /29\.99/.test(t) && /59\.98/.test(t), t.replace(/\s+/g, ' ').slice(0, 160));
    await Promise.all([page.waitForNavigation(), page.click('button[name="checkout"]')]);
    check('cart page checkout button reaches checkout', /\/checkout$/.test(page.url()));
    await ctx.close();
  }

  /* ------------------------------------------------------------------ PRICE CONSISTENCY */
  group('Price comes from Shopify product data (not hardcoded)');
  await reset(); await set('scenario=media');
  {
    const src = themeFiles();
    const hits = src.filter((f) => /29\.99|2999|49\.99|4999|49\.98|4998|59\.98|5998|19\.99|9\.99/.test(fs.readFileSync(THEME + '/' + f, 'utf8')));
    check('"29.99" appears nowhere in theme source files', hits.length === 0, hits.join(', '));
    const pages = ['/', PRODUCT, '/collections/all'];
    for (const price of [2999, 3499]) {
      await set('price=' + price);
      const expected = '$' + (price / 100).toFixed(2);
      for (const p of pages) {
        const html = await get(p);
        const shown = [...html.matchAll(/data-price>\s*([^<\s][^<]*?)\s*</g)].map((m) => m[1]);
        check(`price ${expected} on ${p} everywhere it is displayed (${shown.length}x)`, shown.length > 0 && shown.every((x) => x === expected), shown.join(','));
      }
      const ld = (await get(PRODUCT)).match(/"price":"([\d.]+)"/);
      check(`structured data price matches (${expected})`, ld && ld[1] === (price / 100).toFixed(2), ld && ld[1]);
    }
    await set('price=2999');
    const shopDefault = await get(PRODUCT);
    check('no compare-at configured in Shopify -> hidden (single standard price)', /data-compare-price hidden/.test(shopDefault));
  }

  /* ------------------------------------------------------------------ VARIANTS */
  group('Real variants as bundle cards, stock, gallery fit, sticky bar');
  await reset(); await set('scenario=media&variants=3');
  {
    const { ctx, page } = await newPage(browser);
    await page.goto(BASE + PRODUCT, { waitUntil: 'networkidle' });
    check('option cards appear for multi-variant products (one per real variant)', (await page.locator('[data-variant-input]').count()) === 3);
    check('first available variant is preselected', await page.locator('[data-variant-input][value="1001"]').isChecked());
    check('sold-out variant card is disabled', await page.locator('[data-variant-input][value="1003"]').isDisabled());
    await page.click('.pw-variant:has([value="1002"])');
    await page.waitForTimeout(300);
    check('choosing a card marks it selected and switches the gallery to its media', (await page.locator('.pw-variant.is-selected [value="1002"]').count()) === 1 && (await page.locator('[data-gallery-slide].is-active').getAttribute('data-index')) === '3');
    await page.click('[data-add-to-cart]'); await page.waitForSelector('cart-drawer.is-open');
    check('adds the selected variant id (1002) to the Shopify cart', (await state()).cart[0].variantId === 1002);
    await ctx.close();
  }
  await reset(); await set('scenario=media');
  {
    const html = await get(PRODUCT);
    check('no option cards for single default-variant products', !/data-variant-input/.test(html));
    check('no invented savings or discount text when Shopify has no compare-at price', !/Save \d+%|pw-variant__save/.test(html));
  }
  await reset(); await set('scenario=media&stock=3');
  {
    const { ctx, page } = await newPage(browser);
    await page.goto(BASE + PRODUCT, { waitUntil: 'networkidle' });
    check('low-stock note uses the real inventory count', /Only 3 left/.test(await page.locator('[data-stock-note]').innerText()));
    await ctx.close();
    await set('stock=50');
    const c2 = await newPage(browser);
    await c2.page.goto(BASE + PRODUCT, { waitUntil: 'networkidle' });
    check('no low-stock note when stock is plentiful', await c2.page.locator('[data-stock-note]').isHidden());
    await c2.ctx.close();
  }
  await reset(); await set('scenario=media');
  for (const [name, vp] of [['desktop', { width: 1440, height: 900 }], ['tablet', { width: 820, height: 1100 }], ['mobile', { width: 390, height: 844 }]]) {
    const { ctx, page } = await newPage(browser, { viewport: vp });
    await page.goto(BASE + PRODUCT, { waitUntil: 'networkidle' });
    const m = await page.evaluate(() => {
      const stage = document.querySelector('.pw-gallery__slides').getBoundingClientRect();
      const img = document.querySelector('.pw-gallery__slide.is-active img');
      const nat = img.naturalWidth / img.naturalHeight;
      const boxR = stage.width / stage.height;
      const fill = nat > boxR ? (stage.width / nat) / stage.height : (stage.height * nat) / stage.width;
      const info = document.querySelector('.pw-product__info').getBoundingClientRect();
      const gal = document.querySelector('.pw-gallery').getBoundingClientRect();
      return { fill: Math.round(fill * 100) / 100, galH: Math.round(gal.height), infoH: Math.round(info.height), sideBySide: info.left > gal.right - 5 };
    });
    check(`${name}: gallery picture fills the frame (no large empty bars)`, m.fill >= 0.95, JSON.stringify(m));
    if (name === 'desktop') check('desktop: gallery and info are balanced side by side (height gap under 35%)', m.sideBySide && Math.abs(m.galH - m.infoH) / Math.max(m.galH, m.infoH) < 0.35, JSON.stringify(m));
    if (name !== 'desktop') check(`${name}: gallery stacks above the info`, !m.sideBySide);
    if (name === 'mobile') {
      check('mobile: sticky bar hidden while main Add to Cart is visible', await page.locator('[data-sticky-bar]').isHidden());
      await page.evaluate(() => window.scrollTo(0, document.querySelector('.pw-details').offsetTop));
      await page.waitForTimeout(400);
      check('mobile: sticky Add to Cart bar appears after scrolling past the buy box, with the live price', (await page.locator('[data-sticky-bar]').isVisible()) && /\$29\.99/.test(await page.locator('[data-sticky-bar]').innerText()));
      await page.click('[data-sticky-button]');
      await page.waitForSelector('cart-drawer.is-open');
      check('mobile: sticky button adds to the Shopify cart', (await state()).cart[0].quantity === 1);
    } else {
      check(`${name}: no sticky bar`, await page.locator('[data-sticky-bar]').isHidden());
    }
    await ctx.close();
  }
  await reset(); await set('scenario=media');
  {
    const html = await get(PRODUCT);
    check('no bundle / discount UI on the page unless the product has real variants', !/bundle|multi-?pack|buy 2/i.test(html));
  }

  group('Fallback to the product\'s own Shopify media');
  await reset(); await set('scenario=productmedia');
  {
    const { ctx, page } = await newPage(browser);
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.evaluate(async () => { for (let y = 0; y < 4000; y += 400) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 100)); } });
    const heroSrc = await page.locator('.pw-hero__frame img').getAttribute('src');
    check('hero uses the product\'s first media image when no hero photo is chosen', /fixture-1\.png/.test(heroSrc), heroSrc);
    check('demo section uses the product\'s own video media (2 videos)', (await page.locator('#demo video').count()) === 2);
    check('feature / step / intro slots stay empty (no guessing which photo shows what)', (await page.locator('.pw-intro__main img').count()) === 0 && (await page.locator('.pw-cta__media img').count()) === 0);
    const noAlt = await page.$$eval('main img', (els) => els.filter((i) => !i.hasAttribute('alt')).length);
    check('every image has an alt attribute', noAlt === 0);
    const sizes = await page.$$eval('main img', (els) => els.filter((i) => !i.srcset || !i.sizes).length);
    check('every image is responsive (srcset + sizes)', sizes === 0);
    await ctx.close();
  }
  await reset(); await set('scenario=imagesonly');
  {
    const html = await get('/');
    check('no product video: demo shows a real product image, no play button, no footage claim', /id="demo"/.test(html) && !/pw-loop/.test(html.split('id="demo"')[1].split('</section>')[0]) && !/REAL FOOTAGE|filmed as it is/.test(html));
  }
  await reset(); await set('scenario=empty');
  {
    const html = await get('/');
    check('no media at all: hero media and demo are hidden, nothing fake shown', !/pw-hero__panel/.test(html) && !/id="demo"/.test(html));
  }

  group('Shipping / Returns / Support accordion');
  await reset(); await set('scenario=media');
  {
    const { ctx, page } = await newPage(browser);
    await page.goto(BASE + PRODUCT, { waitUntil: 'networkidle' });
    const trig = page.locator('[data-acc-trigger]');
    check('three accordion rows: Shipping, Returns, Support', (await trig.count()) === 3 && /Shipping/.test(await trig.nth(0).innerText()) && /Returns/.test(await trig.nth(1).innerText()) && /Support/.test(await trig.nth(2).innerText()));
    check('rows are real buttons with aria-expanded=false and aria-controls', (await trig.evaluateAll((els) => els.every((e) => e.tagName === 'BUTTON' && e.getAttribute('aria-expanded') === 'false' && document.getElementById(e.getAttribute('aria-controls'))))));
    check('closed panels are hidden from keyboard and screen readers', await page.locator('[data-acc-panel]').first().evaluate((p) => p.inert && getComputedStyle(p).visibility === 'hidden'));
    // click on the summary text (not the icon) opens the row
    await page.locator('.pw-acc__summary').first().click();
    await page.waitForTimeout(500);
    check('clicking the row text opens it (aria-expanded=true)', (await trig.nth(0).getAttribute('aria-expanded')) === 'true');
    const open = await page.locator('[data-acc-panel]').first().evaluate((p) => ({ h: p.getBoundingClientRect().height, vis: getComputedStyle(p).visibility, inert: p.inert }));
    check('panel animates open to real height and is reachable', open.h > 40 && open.vis === 'visible' && !open.inert, JSON.stringify(open));
    const rot = await page.locator('.pw-acc__chevron').first().evaluate((c) => getComputedStyle(c).transform);
    check('chevron rotates when open', /matrix\(-1/.test(rot), rot);
    await trig.nth(0).click(); await page.waitForTimeout(500);
    check('clicking again collapses it', (await trig.nth(0).getAttribute('aria-expanded')) === 'false' && (await page.locator('[data-acc-panel]').first().evaluate((p) => p.getBoundingClientRect().height)) < 2);
    // keyboard
    await trig.nth(0).focus(); await page.keyboard.press('ArrowDown');
    check('ArrowDown moves focus to the next row', await trig.nth(1).evaluate((e) => document.activeElement === e));
    await page.keyboard.press('Enter'); await page.waitForTimeout(400);
    check('Enter toggles the focused row', (await trig.nth(1).getAttribute('aria-expanded')) === 'true');
    await page.keyboard.press('Space'); await page.waitForTimeout(400);
    check('Space toggles it closed again', (await trig.nth(1).getAttribute('aria-expanded')) === 'false');
    await page.keyboard.press('End');
    check('End jumps to the last row', await trig.nth(2).evaluate((e) => document.activeElement === e));
    await trig.nth(2).click(); await trig.nth(0).click(); await page.waitForTimeout(500);
    check('rows toggle independently (several can be open)', (await trig.nth(2).getAttribute('aria-expanded')) === 'true' && (await trig.nth(0).getAttribute('aria-expanded')) === 'true');
    const support = await page.locator('[data-acc-panel]').nth(2).innerText();
    check('Support panel: order help, product help, email and contact link', /order number/.test(support) && /hello@example\.com/.test(support) && /Contact us/.test(support), support.replace(/\s+/g, ' ').slice(0, 140));
    const ship = await page.locator('[data-acc-panel]').nth(0).innerText();
    check('Shipping panel shows no invented times or fees when none are set', !/\d+\s*(business )?days|\$\d|free shipping/i.test(ship) && /shown at checkout/.test(ship), ship.replace(/\s+/g, ' '));
    check('no horizontal scroll with panels open', (await page.evaluate(() => document.documentElement.scrollWidth)) <= 1440);
    check('no JS errors', page.errors.length === 0, page.errors.join('|'));
    await ctx.close();
  }
  {
    const { ctx, page } = await newPage(browser, { javaScriptEnabled: false });
    await page.goto(BASE + PRODUCT, { waitUntil: 'load' });
    check('without JavaScript every panel is open and readable', await page.locator('[data-acc-panel]').nth(2).isVisible() && /order number/.test(await page.locator('[data-acc-panel]').nth(2).innerText()));
    await ctx.close();
  }
  await set('policies=1');
  {
    const { ctx, page } = await newPage(browser);
    await page.goto(BASE + PRODUCT, { waitUntil: 'networkidle' });
    await page.locator('[data-acc-trigger]').nth(0).click(); await page.locator('[data-acc-trigger]').nth(1).click(); await page.waitForTimeout(500);
    const a = await page.locator('[data-acc-panel]').nth(0).innerText(); const b = await page.locator('[data-acc-panel]').nth(1).innerText();
    check('Shopify shipping and refund policy text is pulled into the panels', /TEST shipping policy text/.test(a) && /TEST refund policy text/.test(b));
    check('links point to the Shopify policy pages', (await page.locator('[data-acc-panel]').nth(0).locator('a.pw-acc__link').getAttribute('href')) === '/policies/shipping-policy' && (await page.locator('[data-acc-panel]').nth(1).locator('a.pw-acc__link').getAttribute('href')) === '/policies/refund-policy');
    await ctx.close();
  }
  await set('policies=0');
  {
    const ed = await get(PRODUCT + '?design_mode=1');
    check('theme editor flags details still to configure; shoppers do not see them', /Not set yet/.test(ed) && !/Not set yet/.test(await get(PRODUCT)));
  }
  {
    const { ctx, page } = await newPage(browser, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    await page.goto(BASE + PRODUCT, { waitUntil: 'networkidle' });
    const h = await page.locator('[data-acc-trigger]').first().evaluate((e) => e.getBoundingClientRect().height);
    check('mobile: rows are at least 56px tall tap targets', h >= 56, String(h));
    await page.locator('[data-acc-trigger]').nth(2).tap(); await page.waitForTimeout(500);
    check('mobile: tap opens a row, no sideways scroll', (await page.locator('[data-acc-trigger]').nth(2).getAttribute('aria-expanded')) === 'true' && (await page.evaluate(() => document.documentElement.scrollWidth)) <= 390);
    await ctx.close();
  }
  await reset(); await set('scenario=media');

  group('Pricing: compare-at, 2-pack bundle, live switching, cart');
  const txt = (loc) => loc.innerText().then((t) => t.replace(/\s+/g, ' ').trim());
  await reset(); await set('scenario=media&compareAt=4998');
  {
    const html = await get(PRODUCT);
    const block = html.split('data-product-price')[1].split('</div>')[0].replace(/<[^>]+>/g, ' ').replace(/^[>\s]+/, '').replace(/\s+/g, ' ').trim();
    check('single brush: struck compare-at $49.98, price $29.99, "Save $19.99" (from Shopify variant data)', block === '$29.99 $49.98 Save $19.99', block);
    check('compare-at is a real strikethrough element', /<s class="pw-price__compare"[^>]*>\s*\$49\.98/.test(html));
    const hero = (await get('/')).split('pw-hero__actions')[1].split('</div>')[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    check('buttons elsewhere show only the selling price (no strikethrough clutter)', /\$29\.99/.test(hero) && !/49\.98/.test(hero), hero.trim());
  }
  await reset(); await set('scenario=media');
  {
    const html = await get(PRODUCT);
    check('no compare-at configured in Shopify -> no strikethrough, no Save label', /data-compare-price hidden/.test(html) && /data-save hidden/.test(html));
    await set('compareAt=2999');
    const h2 = await get(PRODUCT);
    check('compare-at equal to price is not shown (no fake savings)', /data-compare-price hidden/.test(h2));
    await set('compareAt=1999');
    check('compare-at lower than price is not shown', /data-compare-price hidden/.test(await get(PRODUCT)));
  }
  await reset(); await set('scenario=media&variants=2&compareAt=4998');
  {
    const { ctx, page } = await newPage(browser);
    await page.goto(BASE + PRODUCT, { waitUntil: 'networkidle' });
    const cards = page.locator('.pw-variant');
    check('two purchase options: 1 Pack and 2 Pack', (await cards.count()) === 2 && /1 Pack/.test(await cards.nth(0).innerText()) && /2 Pack/.test(await cards.nth(1).innerText()));
    const c1 = await txt(cards.nth(0)); const c2 = await txt(cards.nth(1));
    check('1 Pack card: $29.99, was $49.98, Save $19.99', /\$29\.99/.test(c1) && /\$49\.98/.test(c1) && /Save \$19\.99/.test(c1), c1);
    check('2 Pack card: $49.99, was $59.98 (2 x $29.99), Save $9.99', /\$49\.99/.test(c2) && /\$59\.98/.test(c2) && /Save \$9\.99/.test(c2), c2);
    check('"BEST VALUE" badge on the 2 Pack only', /BEST VALUE/.test(c2) && !/BEST VALUE/.test(c1));
    check('1 Pack selected by default and shown as selected', await page.locator('[data-variant-input][value="1001"]').isChecked() && (await cards.nth(0).getAttribute('class')).includes('is-selected'));
    check('main price block starts at $29.99 / $49.98 / Save $19.99', (await txt(page.locator('[data-product-price]'))) === '$29.99 $49.98 Save $19.99');
    await cards.nth(1).click();
    check('choosing 2 Pack immediately updates price, comparison and savings ($49.99 / $59.98 / Save $9.99)', (await txt(page.locator('[data-product-price]'))) === '$49.99 $59.98 Save $9.99', await txt(page.locator('[data-product-price]')));
    check('selected card is clearly marked, the other is not', (await cards.nth(1).getAttribute('class')).includes('is-selected') && !(await cards.nth(0).getAttribute('class')).includes('is-selected') && (await page.locator('.pw-variant.is-selected .pw-variant__check').count()) === 1);
    await cards.nth(0).click();
    check('switching back restores $29.99 / $49.98 / Save $19.99', (await txt(page.locator('[data-product-price]'))) === '$29.99 $49.98 Save $19.99');
    // quantity + button price follow the selection
    const disp = () => page.inputValue('[data-qty-display]');
    const addPrice = () => txt(page.locator('[data-add-price]'));
    check('1 Pack selected: quantity shows 1 brush, minus disabled, plus enabled, button price $29.99', (await disp()) === '1' && (await page.locator('[data-qty-minus]').isDisabled()) && !(await page.locator('[data-qty-plus]').isDisabled()) && (await addPrice()) === '$29.99');
    check('quantity box is display-only (cannot be typed into)', await page.locator('[data-qty-display]').evaluate((e) => e.readOnly));
    await cards.nth(1).click();
    check('choosing 2 Pack sets quantity to 2, plus disabled, minus enabled', (await disp()) === '2' && (await page.locator('[data-qty-plus]').isDisabled()) && !(await page.locator('[data-qty-minus]').isDisabled()));
    check('price beside Add to Cart updates to $49.99', (await addPrice()) === '$49.99');
    await page.click('[data-qty-minus]');
    check('stepper minus moves to the 1 Pack and everything follows ($29.99 / $49.98 / Save $19.99, qty 1)', (await disp()) === '1' && (await page.locator('[data-variant-input][value="1001"]').isChecked()) && (await txt(page.locator('[data-product-price]'))) === '$29.99 $49.98 Save $19.99' && (await addPrice()) === '$29.99');
    await page.click('[data-qty-plus]');
    check('stepper plus moves to the 2 Pack and everything follows ($49.99 / $59.98 / Save $9.99, qty 2)', (await disp()) === '2' && (await page.locator('[data-variant-input][value="1002"]').isChecked()) && (await txt(page.locator('[data-product-price]'))) === '$49.99 $59.98 Save $9.99');
    let posted = null;
    page.on('request', (r) => { if (r.url().includes('/cart/add.js')) posted = (r.postData() || '').replace(/\r/g, ''); });
    await page.click('[data-add-to-cart]'); await page.waitForSelector('cart-drawer.is-open');
    let st = await state();
    check('2 brushes adds ONE 2-pack variant (id 1002, cart quantity 1), not two', st.cart.length === 1 && st.cart[0].variantId === 1002 && st.cart[0].quantity === 1, JSON.stringify(st.cart));
    check('request posted variant 1002 and quantity 1', /\n1002\n/.test(posted) && /name="quantity"\n\n1\n/.test(posted), posted.replace(/\s+/g, ' ').slice(0, 160));
    const drawer = await txt(page.locator('.pw-drawer__body'));
    check('cart charges $49.99 (Shopify variant price) and subtotal is $49.99', /\$49\.99/.test(drawer) && /\$49\.99/.test(await txt(page.locator('.pw-drawer__subtotal'))), drawer);
    // the cart itself can raise the bundle count; pricing stays consistent
    await page.click('[data-line-plus]'); await page.waitForTimeout(500);
    check('raising the 2-pack line to 2 in the cart = 4 brushes at $99.98, consistent Shopify price', (await state()).cart[0].quantity === 2 && /\$99\.98/.test(await txt(page.locator('.pw-drawer__subtotal'))), await txt(page.locator('.pw-drawer__subtotal')));
    await page.keyboard.press('Escape');
    await cards.nth(0).click();
    check('switching to 1 Pack: quantity 1', (await disp()) === '1');
    await page.click('[data-add-to-cart]'); await page.waitForTimeout(700);
    st = await state();
    check('1 Pack adds variant 1001 x1 as its own line (no price mixing)', st.cart.length === 2 && st.cart.some((l) => l.variantId === 1001 && l.quantity === 1), JSON.stringify(st.cart));
    check('cart subtotal = 2 x $49.99 + $29.99 = $129.97', /\$129\.97/.test(await txt(page.locator('.pw-drawer__subtotal'))), await txt(page.locator('.pw-drawer__subtotal')));
    const body = await page.evaluate(() => 0);
    check('no JS errors', page.errors.length === 0, page.errors.join('|'));
    await ctx.close();
  }
  await reset(); await set('scenario=media&variants=2&compareAt=4998');
  {
    const { ctx, page } = await newPage(browser);
    await page.goto(BASE + PRODUCT, { waitUntil: 'networkidle' });
    const cards = page.locator('.pw-variant');
    const c1 = await txt(cards.nth(0)); const c2 = await txt(cards.nth(1));
    check('single card: "1 Pawora grooming brush", no bundle copy', /1 Pawora grooming brush\b(?!es)/.test(c1) && !/Keep a spare/.test(c1), c1);
    check('two-pack card: "2 Pawora grooming brushes" and the supporting line', /2 Pawora grooming brushes/.test(c2) && /Keep a spare or groom more than one pet\./.test(c2), c2);
    check('each card has a radio indicator, and only the selected one is filled', (await page.locator('.pw-variant__check').count()) === 2 && (await page.locator('.pw-variant.is-selected').count()) === 1);
    const order = await page.evaluate(() => {
      const pos = (sel) => document.querySelector(sel);
      const before = (a, b) => !!(pos(a).compareDocumentPosition(pos(b)) & Node.DOCUMENT_POSITION_FOLLOWING);
      return { descToCards: before('.pw-product__desc', '.pw-variants'), cardsToQty: before('.pw-variants', '.pw-qty'), qtyToAdd: before('.pw-qty', '[data-add-to-cart]') };
    });
    check('placement: description, then bundle cards, then Quantity, then Add to Cart', order.descToCards && order.cardsToQty && order.qtyToAdd, JSON.stringify(order));
    await ctx.close();
  }
  // wrong submit prevention: the posted id/quantity always come from the selected card, quantity is always 1
  await reset(); await set('scenario=media&variants=2');
  {
    const { ctx, page } = await newPage(browser);
    let posted = null;
    page.on('request', (r) => { if (r.url().includes('/cart/add.js')) posted = (r.postData() || '').replace(/\r/g, ''); });
    await page.goto(BASE + PRODUCT, { waitUntil: 'networkidle' });
    await page.click('.pw-variant:has([value="1002"])');
    await page.evaluate(() => { const q = document.querySelector('[data-qty-input]'); q.value = '99'; }); // tamper with the hidden field
    await page.click('[data-add-to-cart]'); await page.waitForSelector('cart-drawer.is-open');
    const st = await state();
    check('tampering with the hidden quantity cannot buy a wrong amount (reset to 1 before sending)', st.cart[0].variantId === 1002 && st.cart[0].quantity === 1, JSON.stringify(st.cart) + ' ' + (posted || '').replace(/\s+/g, ' ').slice(0, 120));
    await ctx.close();
  }
  await reset(); await set('scenario=media&variants=2&bundlePrice=5998');
  {
    const html = await get(PRODUCT);
    check('bundle priced at or above 2 singles: no saving, no badge, no strikethrough (nothing invented)', !/BEST VALUE|pw-variant__save|pw-variant__was/.test(html));
  }
  await reset(); await set('scenario=media&variants=2&price=3499&compareAt=5498&bundlePrice=5999');
  {
    const block = (await get(PRODUCT)).split('data-product-price')[1].split('</div>')[0].replace(/<[^>]+>/g, ' ').replace(/^[>\s]+/, '').replace(/\s+/g, ' ').trim();
    check('numbers follow Shopify data when prices change ($34.99 / $54.98 / Save $19.99)', block === '$34.99 $54.98 Save $19.99', block);
    check('2 Pack compare is 2 x the live single price ($69.98) and saving $9.99', /\$69\.98/.test(await get(PRODUCT)) && /Save \$9\.99/.test(await get(PRODUCT)));
  }
  await reset(); await set('scenario=media&variants=2&compareAt=4998');
  for (const [name, vp] of [['mobile', { width: 390, height: 844 }], ['tablet', { width: 820, height: 1100 }]]) {
    const { ctx, page } = await newPage(browser, { viewport: vp, hasTouch: true });
    await page.goto(BASE + PRODUCT, { waitUntil: 'networkidle' });
    const geo = await page.evaluate(() => { const r = [...document.querySelectorAll('.pw-variant')].map((e) => e.getBoundingClientRect()); return { w: r.map((x) => Math.round(x.width)), sameRow: Math.abs(r[0].top - r[1].top) < 4, sw: document.documentElement.scrollWidth }; });
    if (name === 'mobile') check('mobile: the two options stack full width, equal size, no sideways scroll', !geo.sameRow && geo.w[0] >= 340 && Math.abs(geo.w[0] - geo.w[1]) <= 2 && geo.sw <= vp.width, JSON.stringify(geo));
    else check('tablet: both options sit side by side, equal width, no sideways scroll', geo.sameRow && Math.abs(geo.w[0] - geo.w[1]) <= 2 && geo.sw <= vp.width, JSON.stringify(geo));
    await page.tap('.pw-variant:has([value="1002"])'); await page.waitForTimeout(250);
    check(`${name}: tapping 2 Pack updates the price block`, (await txt(page.locator('[data-product-price]'))) === '$49.99 $59.98 Save $9.99');
    if (name === 'mobile') {
      await page.evaluate(() => window.scrollTo(0, document.querySelector('.pw-details').offsetTop)); await page.waitForTimeout(400);
      check('mobile: sticky bar shows the selected option\'s price', /\$49\.99/.test(await txt(page.locator('[data-sticky-bar]'))));
      await page.click('[data-sticky-button]'); await page.waitForSelector('cart-drawer.is-open');
      check('mobile: sticky Add to Cart adds the selected 2 Pack', (await state()).cart.some((l) => l.variantId === 1002));
    }
    await ctx.close();
  }
  await reset(); await set('scenario=media');

  group('Compact customer review rotator');
  await reset(); await set('scenario=media&reviews=2');
  {
    const { ctx, page } = await newPage(browser);
    await page.clock.install();
    await page.goto(BASE + PRODUCT, { waitUntil: 'networkidle' });
    const active = () => page.locator('.pw-review.is-active [class*="pw-review__text"]').innerText();
    const box = page.locator('.pw-reviewbox');
    check('heading "Pet Parents Love Pawora"', /Pet Parents Love Pawora/.test(await txt(box.locator('.pw-reviewbox__title'))));
    check('exactly one review visible at a time', (await page.locator('.pw-review').evaluateAll((els) => els.filter((e) => getComputedStyle(e).visibility === 'visible' && parseFloat(getComputedStyle(e).opacity) > 0.5).length)) === 1);
    check('two indicator dots, previous and next controls, all labelled', (await page.locator('[data-review-dot]').count()) === 2 && /Previous review/.test(await page.locator('[data-review-prev]').getAttribute('aria-label')) && /Next review/.test(await page.locator('[data-review-next]').getAttribute('aria-label')) && /Show review 1 of 2/.test(await page.locator('[data-review-dot]').first().getAttribute('aria-label')));
    const photo = await page.locator('.pw-review.is-active .pw-review__photo').evaluate((i) => { const r = i.getBoundingClientRect(); const t = i.parentElement.querySelector('.pw-review__body').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), left: r.right <= t.left + 1, radius: getComputedStyle(i).borderRadius }; });
    check('photo is a small rounded square (48-52px) on the left of the text', photo.w >= 48 && photo.w <= 52 && photo.w === photo.h && photo.left && parseInt(photo.radius, 10) > 0, JSON.stringify(photo));
    check('star rating and Verified Buyer shown only where set', /Rated 5 out of 5/.test(await page.locator('.pw-review').nth(0).innerHTML()) && /Verified Buyer/.test(await txt(page.locator('.pw-review').nth(0))) && !/Verified Buyer/.test(await txt(page.locator('.pw-review').nth(1))));
    check('review without a photo shows no picture at all (nothing implied)', (await page.locator('.pw-review').nth(1).locator('img').count()) === 0);
    const trans = await page.locator('.pw-review').first().evaluate((e) => ({ t: getComputedStyle(e).transitionProperty, d: getComputedStyle(e).transitionDuration, tr: getComputedStyle(e).transform }));
    check('crossfade only (opacity, no sliding transform)', /opacity/.test(trans.t) && !/transform/.test(trans.t) && trans.tr === 'none', JSON.stringify(trans));
    const geo0 = await page.evaluate(() => ({ box: document.querySelector('.pw-reviewbox').getBoundingClientRect().height, below: document.querySelector('.pw-perks').getBoundingClientRect().top + window.scrollY }));
    check('first review is shown first', /REVIEW ONE/.test(await active()));
    await page.clock.runFor(8000);
    check('no change before 10 seconds', /REVIEW ONE/.test(await active()));
    await page.clock.runFor(3000);
    check('switches to review 2 at 10 seconds', /REVIEW TWO/.test(await active()));
    const geo1 = await page.evaluate(() => ({ box: document.querySelector('.pw-reviewbox').getBoundingClientRect().height, below: document.querySelector('.pw-perks').getBoundingClientRect().top + window.scrollY }));
    check('no layout shift: box height and everything below stay put', Math.abs(geo0.box - geo1.box) < 0.5 && Math.abs(geo0.below - geo1.below) < 0.5, JSON.stringify([geo0, geo1]));
    check('dots follow the active review', (await page.locator('[data-review-dot].is-active').getAttribute('data-index')) === '1');
    await page.clock.runFor(10000);
    check('loops back to review 1 after another 10 seconds', /REVIEW ONE/.test(await active()));
    check('automatic changes are not announced (aria-live off)', (await page.locator('[data-review-stage]').getAttribute('aria-live')) === 'off');

    // manual control resets the clock
    await page.clock.runFor(7000);
    await page.click('[data-review-next]');
    check('next button changes the review', /REVIEW TWO/.test(await active()));
    check('manual change is announced politely to screen readers', (await page.locator('[data-review-stage]').getAttribute('aria-live')) === 'polite');
    await page.mouse.move(5, 5); await page.evaluate(() => document.activeElement.blur());
    await page.clock.runFor(9000);
    check('after a manual change the 10 s clock restarted (still same review 9 s later)', /REVIEW TWO/.test(await active()));
    await page.clock.runFor(1500);
    check('and it moves on 10 s after the manual change', /REVIEW ONE/.test(await active()));
    await page.click('[data-review-dot][data-index="1"]');
    check('dots switch reviews', /REVIEW TWO/.test(await active()) && (await page.locator('[data-review-dot][aria-current="true"]').getAttribute('data-index')) === '1');
    await page.click('[data-review-prev]');
    check('previous button wraps around', /REVIEW ONE/.test(await active()));

    // keyboard
    await page.locator('[data-review-next]').focus(); await page.keyboard.press('Enter');
    check('Enter on the next button works', /REVIEW TWO/.test(await active()));
    await page.keyboard.press('Space');
    check('Space on the next button works', /REVIEW ONE/.test(await active()));

    // hover pauses
    await page.evaluate(() => document.activeElement.blur());
    await page.hover('.pw-reviewbox');
    const before = await active();
    await page.clock.runFor(35000);
    check('hover pauses rotation', (await active()) === before);
    await page.mouse.move(5, 5);
    await page.clock.runFor(9000);
    check('leaving restarts a full 10 s wait (no instant jump)', (await active()) === before);
    await page.clock.runFor(1500);
    check('then it continues', (await active()) !== before);

    // focus pauses
    await page.locator('[data-review-dot]').first().focus();
    const b2 = await active();
    await page.clock.runFor(35000);
    check('keyboard focus inside pauses rotation', (await active()) === b2);
    await page.evaluate(() => document.activeElement.blur());
    await page.clock.runFor(10500);
    check('blur resumes rotation', (await active()) !== b2);

    // hidden tab
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    const b3 = await active();
    await page.clock.runFor(35000);
    check('no rotation while the tab is hidden', (await active()) === b3);
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.clock.runFor(10500);
    check('rotation resumes when the tab is visible again', (await active()) !== b3);

    // timers: no duplicates after remove / re-add
    const idx = () => page.locator('[data-review-dot].is-active').getAttribute('data-index');
    await page.evaluate(() => { const el = document.querySelector('review-rotator'); window.__rr = el; el.remove(); });
    await page.clock.runFor(30000);
    await page.evaluate(() => { document.querySelector('.pw-product__info').insertBefore(window.__rr, document.querySelector('.pw-perks')); });
    const startIdx = await idx();
    await page.clock.runFor(10500);
    const stepped = ((parseInt(await idx(), 10) - parseInt(startIdx, 10)) + 2) % 2;
    check('removing then re-adding the component leaves exactly one timer (one step per 10 s)', stepped === 1, `${startIdx}->${await idx()}`);
    const i0 = parseInt(await idx(), 10);
    await page.click('[data-review-next]');
    check('after re-adding, one click still moves exactly one review (no duplicate listeners)', (parseInt(await idx(), 10) - i0 + 2) % 2 === 1);
    check('no JS errors', page.errors.length === 0, page.errors.join('|'));

    const order = await page.evaluate(() => { const f = (s) => document.querySelector(s); const after = (a, b) => !!(f(a).compareDocumentPosition(f(b)) & Node.DOCUMENT_POSITION_FOLLOWING); return { addToReviews: after('[data-add-to-cart]', '.pw-reviewbox'), reviewsToPerks: after('.pw-reviewbox', '.pw-perks'), reviewsToInfo: after('.pw-reviewbox', '.pw-inforows') }; });
    check('placement: below Add to Cart, above the benefit cards and policy rows', order.addToReviews && order.reviewsToPerks && order.reviewsToInfo, JSON.stringify(order));
    await ctx.close();
  }
  {
    const { ctx, page } = await newPage(browser, { reducedMotion: 'reduce' });
    await page.clock.install();
    await page.goto(BASE + PRODUCT, { waitUntil: 'networkidle' });
    await page.clock.runFor(35000);
    check('reduced motion: no automatic rotation at all', /REVIEW ONE/.test(await page.locator('.pw-review.is-active .pw-review__text').innerText()));
    const tr = await page.locator('.pw-review.is-active').evaluate((e) => getComputedStyle(e).transitionDuration);
    check('reduced motion: no animated transition', /^0s/.test(tr), tr);
    await page.click('[data-review-next]');
    check('reduced motion: manual controls still work', /REVIEW TWO/.test(await page.locator('.pw-review.is-active .pw-review__text').innerText()));
    await ctx.close();
  }
  await set('reviews=1');
  {
    const html = await get(PRODUCT);
    check('one genuine review: shown without dots, arrows or rotation', /pw-review\b/.test(html) && !/data-review-dot|data-review-next/.test(html));
  }
  await set('reviews=0');
  {
    const html = await get(PRODUCT);
    const block = html.split('pw-reviewbox')[1] || '';
    check('no reviews: only an honest "Be the first to review Pawora" line, no stars, names or counts', /Be the first to review Pawora/.test(html) && !/pw-review__stars|Verified Buyer|pw-review__name/.test(html));
  }
  for (const [name, vp] of [['mobile', { width: 390, height: 844 }], ['small mobile', { width: 320, height: 640 }]]) {
    await set('reviews=2');
    const { ctx, page } = await newPage(browser, { viewport: vp });
    await page.goto(BASE + PRODUCT, { waitUntil: 'networkidle' });
    const m = await page.evaluate(() => { const b = document.querySelector('.pw-reviewbox').getBoundingClientRect(); const i = document.querySelector('.pw-review.is-active .pw-review__photo').getBoundingClientRect(); return { boxW: Math.round(b.width), boxH: Math.round(b.height), photo: Math.round(i.width), sw: document.documentElement.scrollWidth }; });
    check(`${name}: compact box, 52px photo, no sideways scroll`, m.photo <= 52 && m.boxH < 260 && m.sw <= vp.width, JSON.stringify(m));
    await ctx.close();
  }
  await reset(); await set('scenario=media');

  /* ------------------------------------------------------------------ MOBILE NAV + SEARCH + FAQ */
  group('Mobile menu, search and FAQ');
  {
    const { ctx, page } = await newPage(browser, { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    check('desktop nav hidden on mobile, menu button visible', !(await page.locator('.pw-nav--desktop').isVisible()) && (await page.locator('[data-menu-toggle]').isVisible()));
    check('mobile menu closed initially', !(await page.locator('.pw-nav--mobile').isVisible()));
    await page.tap('[data-menu-toggle]');
    check('hamburger opens the menu (aria-expanded true, 5 links)', (await page.locator('.pw-nav--mobile').isVisible()) && (await page.locator('[data-menu-toggle]').getAttribute('aria-expanded')) === 'true' && (await page.locator('.pw-nav--mobile .pw-nav__link').count()) === 5);
    check('menu button label switches to "Close menu"', (await page.locator('[data-menu-toggle]').getAttribute('aria-label')) === 'Close menu');
    await page.tap('[data-menu-toggle]');
    check('second tap closes menu', !(await page.locator('.pw-nav--mobile').isVisible()));
    await page.tap('[data-search-toggle]');
    check('search button reveals the search field and focuses it', (await page.locator('.pw-search').isVisible()) && (await page.evaluate(() => document.activeElement.type === 'search')));
    check('no horizontal scroll at 390px (home)', (await page.evaluate(() => document.documentElement.scrollWidth)) <= 390);
    await page.goto(BASE + PRODUCT, { waitUntil: 'networkidle' });
    check('no horizontal scroll at 390px (product)', (await page.evaluate(() => document.documentElement.scrollWidth)) <= 390);
    // tap targets
    const small = await page.$$eval('button, a.pw-btn, .pw-iconbtn, .pw-thumb, .pw-gallery__arrow', (els) => els.filter((e) => e.offsetParent !== null).map((e) => { const r = e.getBoundingClientRect(); return { cls: e.className.toString().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height) }; }).filter((e) => e.w < 40 || e.h < 40));
    check('interactive controls are at least 40px on mobile', small.length === 0, JSON.stringify(small.slice(0, 5)));
    await ctx.close();
  }
  {
    const { ctx, page } = await newPage(browser);
    await page.goto(BASE + PRODUCT, { waitUntil: 'networkidle' });
    const items = page.locator('.pw-faq__item');
    check('FAQ: first answered question open by default', (await items.nth(0).getAttribute('open')) !== null);
    await items.nth(1).locator('summary').click();
    await page.waitForTimeout(200);
    check('FAQ: opening a second question closes the first (accordion)', (await items.nth(0).getAttribute('open')) === null && (await items.nth(1).getAttribute('open')) !== null);
    check('FAQ: unanswered questions are hidden from shoppers', (await items.count()) === 3, `shown=${await items.count()}`);
    await ctx.close();
  }

  /* ------------------------------------------------------------------ PLACEHOLDERS ONLY IN EDITOR */
  group('No placeholders or invented content for shoppers');
  await reset();
  {
    const shop = [await get('/'), await get(PRODUCT)].join('\n');
    const editor = [await get('/?design_mode=1'), await get(PRODUCT + '?design_mode=1')].join('\n');
    check('storefront (no media uploaded) shows no upload placeholders', !/pw-ph\b|REAL PRODUCT PHOTO|REAL FOOTAGE REQUIRED|TEST FIXTURE/.test(shop));
    check('theme editor shows upload placeholders so you know where media goes', /REAL PRODUCT PHOTO/.test(editor) && /REAL FOOTAGE REQUIRED/.test(editor));
    check('no bracketed "[Add ...]" placeholder text for shoppers', !/\[Add|\[Confirm|\[YOUR|\[Support email/.test(shop));
    check('no fake reviews or star ratings', !/★|star-rating|stars|reviewer|"ratingValue"/i.test(shop));
    check('demo section hidden on storefront until real footage exists', !/id="demo"/.test(shop));
    check('theme editor still shows the demo section with upload slots', /id="demo"/.test(editor));
    check('product vendor field never leaks into pages (brand comes from settings)', !/Not Pawora/.test(shop));
  }

  group('Live saved templates (as edited in the Shopify theme editor)');
  await reset(); await set('scenario=productmedia&templates=live');
  {
    const { ctx, page } = await newPage(browser);
    for (const path of ['/', PRODUCT]) {
      const res = await page.goto(BASE + path, { waitUntil: 'networkidle' });
      check(`live templates render ${path} without errors`, res.status() === 200 && page.errors.length === 0, page.errors.join('|'));
      check(`live templates ${path}: no horizontal scroll`, (await page.evaluate(() => document.documentElement.scrollWidth)) <= 1440);
    }
    await page.click('[data-add-to-cart]'); await page.waitForSelector('cart-drawer.is-open');
    check('live product template: Add to Cart still works', (await state()).cart.length === 1);
    await ctx.close();
  }
  await reset();

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n==== ${results.length - failed.length}/${results.length} passed ====`);
  if (failed.length) { console.log('FAILED:'); failed.forEach((f) => console.log(` - [${f.group}] ${f.name} ${f.detail}`)); }
  fs.writeFileSync(__dirname + '/test-results.json', JSON.stringify(results, null, 2));
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
