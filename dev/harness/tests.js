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
  /* Intended Shopify data: 1 Brush $29.99 (compare-at $49.99), 2 Brushes $49.99 (compare-at $59.98) */
  const DATA = 'scenario=media&variants=2&compareAt=4999&bundlePrice=4999&bundleCompareAt=5998';
  const PB = '[data-product-price]';
  await reset(); await set(DATA);
  {
    const { ctx, page } = await newPage(browser);
    const posts = [];
    page.on('request', (r) => { if (r.url().includes('/cart/add.js')) posts.push((r.postData() || '').replace(/\r/g, '')); });
    await page.goto(BASE + PRODUCT, { waitUntil: 'networkidle' });
    const cards = page.locator('.pw-variant');
    const qty = () => page.inputValue('[data-qty-input]');
    const addPrice = () => txt(page.locator('[data-add-price]'));
    const names = await page.$$eval('.pw-variant__title', (els) => els.map((e) => e.textContent.trim()));
    check('two separate cards named "1 Brush" and "2 Brushes" (never a joined title)', names.join('|') === '1 Brush|2 Brushes', names.join('|'));
    const ids = await page.$$eval('[data-variant-input]', (els) => els.map((e) => e.value));
    check('each card maps to exactly one different Shopify variant (1001, 1002)', ids.join() === '1001,1002', ids.join());
    const c1 = await txt(cards.nth(0)); const c2 = await txt(cards.nth(1));
    check('1 Brush card: $29.99, was $49.99, Save $20.00 (its own compare-at)', /\$29\.99/.test(c1) && /\$49\.99/.test(c1) && /Save \$20\.00/.test(c1) && !/59\.98/.test(c1), c1);
    check('2 Brushes card: $49.99, was $59.98, Save $9.99 (its own compare-at)', /\$49\.99/.test(c2) && /\$59\.98/.test(c2) && /Save \$9\.99/.test(c2) && !/\$29\.99|\$20\.00/.test(c2), c2);
    check('"BEST VALUE" badge on the 2 Brushes only', /BEST VALUE/.test(c2) && !/BEST VALUE/.test(c1));
    check('1 Brush selected on load and marked as selected', await page.locator('[data-variant-input][value="1001"]').isChecked() && (await cards.nth(0).getAttribute('class')).includes('is-selected'));
    check('selected card: orange border and light background; the other keeps the plain style', await page.evaluate(() => {
      const [a, b] = [...document.querySelectorAll('.pw-variant')].map((el) => getComputedStyle(el));
      return a.borderTopColor !== b.borderTopColor && a.backgroundColor !== b.backgroundColor;
    }));
    check('load: main price $29.99 / $49.99 / Save $20.00', (await txt(page.locator(PB))) === '$29.99 $49.99 Save $20.00', await txt(page.locator(PB)));
    check('load: quantity is 1 and the label reads "Quantity (bundles)"', (await qty()) === '1' && (await txt(page.locator('label[for^="Quantity"]'))) === 'Quantity (bundles)');
    check('load: Add to Cart price $29.99', (await addPrice()) === '$29.99');
    check('quantity box is editable (it counts bundles, not a read-only brush count)', await page.locator('[data-qty-input]').evaluate((e) => !e.readOnly && e.name === 'quantity'));

    await cards.nth(1).click();
    check('2 Brushes: main price $49.99 / $59.98 / Save $9.99', (await txt(page.locator(PB))) === '$49.99 $59.98 Save $9.99', await txt(page.locator(PB)));
    check('2 Brushes: quantity stays 1 (not 2)', (await qty()) === '1');
    check('2 Brushes: Add to Cart price $49.99', (await addPrice()) === '$49.99');
    check('2 Brushes card is the selected one, the other is not', (await cards.nth(1).getAttribute('class')).includes('is-selected') && !(await cards.nth(0).getAttribute('class')).includes('is-selected') && (await page.locator('.pw-variant.is-selected').count()) === 1);
    await cards.nth(0).click();
    check('back to 1 Brush: main price, button and quantity all return ($29.99 / $49.99 / Save $20.00, qty 1)', (await txt(page.locator(PB))) === '$29.99 $49.99 Save $20.00' && (await addPrice()) === '$29.99' && (await qty()) === '1');
    check('URL follows the selected variant', /variant=1001/.test(page.url()));

    await cards.nth(1).click();
    await page.click('[data-add-to-cart]'); await page.waitForSelector('cart-drawer.is-open');
    let st = await state();
    check('2 Brushes, quantity 1 adds ONE 2-brush variant (id 1002, quantity 1), not two', st.cart.length === 1 && st.cart[0].variantId === 1002 && st.cart[0].quantity === 1, JSON.stringify(st.cart));
    check('request posted id 1002 and quantity 1', /\n1002\n/.test(posts[0]) && /name="quantity"\n\n1\n/.test(posts[0]), posts[0].replace(/\s+/g, ' ').slice(0, 160));
    const drawer = await txt(page.locator('.pw-drawer__body'));
    check('cart charges $49.99 and the subtotal is $49.99', /\$49\.99/.test(drawer) && /\$49\.99/.test(await txt(page.locator('.pw-drawer__subtotal'))), drawer);
    check('cart line names the "2 Brushes" variant', /2 Brushes/.test(drawer), drawer);
    check('no JS errors', page.errors.length === 0, page.errors.join('|'));
    await ctx.close();
  }
  await reset(); await set(DATA);
  {
    const { ctx, page } = await newPage(browser);
    const posts = [];
    page.on('request', (r) => { if (r.url().includes('/cart/add.js')) posts.push((r.postData() || '').replace(/\r/g, '')); });
    await page.goto(BASE + PRODUCT, { waitUntil: 'networkidle' });
    const qty = () => page.inputValue('[data-qty-input]');
    const addPrice = () => txt(page.locator('[data-add-price]'));
    await page.click('.pw-variant:has([value="1002"])');
    await page.click('[data-qty-plus]');
    check('2 Brushes, quantity 2: Add to Cart price is 2 x $49.99 = $99.98', (await qty()) === '2' && (await addPrice()) === '$99.98', await addPrice());
    check('main price stays the price of ONE selected bundle ($49.99)', (await txt(page.locator(PB))) === '$49.99 $59.98 Save $9.99');
    await page.click('[data-add-to-cart]'); await page.waitForSelector('cart-drawer.is-open');
    let st = await state();
    check('quantity 2 adds two of the 2-brush variant (id 1002, quantity 2)', st.cart.length === 1 && st.cart[0].variantId === 1002 && st.cart[0].quantity === 2 && /name="quantity"\n\n2\n/.test(posts[0]), JSON.stringify(st.cart));
    check('cart subtotal $99.98', /\$99\.98/.test(await txt(page.locator('.pw-drawer__subtotal'))), await txt(page.locator('.pw-drawer__subtotal')));
    await page.keyboard.press('Escape');
    await page.click('.pw-variant:has([value="1001"])');
    check('choosing another bundle starts again at quantity 1', (await qty()) === '1' && (await addPrice()) === '$29.99');
    await page.click('[data-qty-plus]'); await page.click('[data-qty-plus]');
    check('1 Brush, quantity 3: Add to Cart price is 3 x $29.99 = $89.97', (await qty()) === '3' && (await addPrice()) === '$89.97', await addPrice());
    await page.click('[data-add-to-cart]'); await page.waitForTimeout(700);
    st = await state();
    check('1 Brush x3 is its own cart line (variant 1001, quantity 3), the 2 Brushes line is untouched', st.cart.length === 2 && st.cart.some((l) => l.variantId === 1001 && l.quantity === 3) && st.cart.some((l) => l.variantId === 1002 && l.quantity === 2), JSON.stringify(st.cart));
    check('cart subtotal = 2 x $49.99 + 3 x $29.99 = $189.95', /\$189\.95/.test(await txt(page.locator('.pw-drawer__subtotal'))), await txt(page.locator('.pw-drawer__subtotal')));
    await page.keyboard.press('Escape');
    await page.fill('[data-qty-input]', '99'); await page.dispatchEvent('[data-qty-input]', 'change');
    check('typing a huge quantity is clamped to the maximum (10) and the price follows ($299.90)', (await qty()) === '10' && (await addPrice()) === '$299.90', (await qty()) + ' ' + (await addPrice()));
    await page.fill('[data-qty-input]', '0'); await page.dispatchEvent('[data-qty-input]', 'change');
    check('quantity never goes below 1', (await qty()) === '1' && (await page.locator('[data-qty-minus]').isDisabled()));
    check('no JS errors', page.errors.length === 0, page.errors.join('|'));
    await ctx.close();
  }
  await reset(); await set(DATA);
  {
    const { ctx, page } = await newPage(browser);
    await page.goto(BASE + PRODUCT, { waitUntil: 'networkidle' });
    const cards = page.locator('.pw-variant');
    const c1 = await txt(cards.nth(0)); const c2 = await txt(cards.nth(1));
    check('single card: "1 Pawora grooming brush", no bundle copy', /1 Pawora grooming brush\b(?!es)/.test(c1) && !/Keep a spare/.test(c1), c1);
    check('two-brush card: "2 Pawora grooming brushes" and the supporting line', /2 Pawora grooming brushes/.test(c2) && /Keep a spare or groom more than one pet\./.test(c2), c2);
    check('each card has a radio indicator, and only the selected one is filled', (await page.locator('.pw-variant__check').count()) === 2 && (await page.locator('.pw-variant.is-selected').count()) === 1);
    const order = await page.evaluate(() => {
      const pos = (sel) => document.querySelector(sel);
      const before = (a, b) => !!(pos(a).compareDocumentPosition(pos(b)) & Node.DOCUMENT_POSITION_FOLLOWING);
      return { descToCards: before('.pw-product__desc', '.pw-variants'), cardsToQty: before('.pw-variants', '.pw-qty'), qtyToAdd: before('.pw-qty', '[data-add-to-cart]') };
    });
    check('placement: description, then bundle cards, then Quantity, then Add to Cart', order.descToCards && order.cardsToQty && order.qtyToAdd, JSON.stringify(order));
    await ctx.close();
  }
  /* ---- Prices come only from each variant: never borrowed, never calculated ---- */
  await reset(); await set('scenario=media&variants=2&compareAt=4999&bundlePrice=4999');
  {
    const { ctx, page } = await newPage(browser);
    await page.goto(BASE + PRODUCT, { waitUntil: 'networkidle' });
    const cards = page.locator('.pw-variant');
    const c1 = await txt(cards.nth(0)); const c2 = await txt(cards.nth(1));
    check('2 Brushes has no compare-at in Shopify: no strikethrough, no saving, no badge (nothing borrowed or invented)', /\$49\.99/.test(c2) && !/59\.98|49\.98|Save|BEST VALUE/.test(c2) && !/<s>/.test(await cards.nth(1).innerHTML()), c2);
    check('1 Brush still shows its own compare-at', /\$49\.99/.test(c1) && /Save \$20\.00/.test(c1), c1);
    await cards.nth(1).click();
    check('main price for 2 Brushes shows no comparison or saving', (await txt(page.locator(PB))) === '$49.99', await txt(page.locator(PB)));
    await cards.nth(0).click();
    check('main price for 1 Brush shows only its own comparison', (await txt(page.locator(PB))) === '$29.99 $49.99 Save $20.00', await txt(page.locator(PB)));
    await ctx.close();
  }
  await reset(); await set('scenario=media&variants=2&compareAt=4999&bundlePrice=2999&bundleCompareAt=5998');
  {
    const html = await get(PRODUCT);
    const cards = [...html.matchAll(/<label class="pw-variant[ "][\s\S]*?<\/label>/g)].map((m) => m[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' '));
    check('both variants priced $29.99 in Shopify: the page shows exactly that (the theme never alters a price)', cards.length === 2 && /\$29\.99/.test(cards[0]) && /\$29\.99/.test(cards[1]), cards.join(' || '));
    check('such a bundle gets no BEST VALUE badge', !/BEST VALUE/.test(html));
    const ed = await get(PRODUCT + '?design_mode=1');
    check('editor view lists each variant with its Shopify price, compare-at and id', /"1 Brush": price \$29\.99/.test(ed.replace(/\s+/g, ' ')) && /"2 Brushes": price \$29\.99/.test(ed.replace(/\s+/g, ' ')) && /variant id 1002/.test(ed));
    check('editor view flags a 2 Brushes price that is not above the 1 Brush price', /not higher than the 1 Brush price/.test(ed));
    check('shoppers never see the set-up check', !/Bundle set-up check|variant id/.test(html));
  }
  await reset(); await set('scenario=media&variants=2&bundlePrice=5998');
  {
    const html = await get(PRODUCT);
    check('bundle priced at 2 singles: no saving, no badge, no strikethrough (nothing invented)', !/BEST VALUE|pw-variant__save|pw-variant__was/.test(html));
  }
  await reset(); await set('scenario=media&variants=2&price=3499&compareAt=5499&bundlePrice=5999&bundleCompareAt=6998');
  {
    const { ctx, page } = await newPage(browser);
    await page.goto(BASE + PRODUCT, { waitUntil: 'networkidle' });
    check('numbers follow Shopify data when prices change ($34.99 / $54.99 / Save $20.00)', (await txt(page.locator(PB))) === '$34.99 $54.99 Save $20.00', await txt(page.locator(PB)));
    await page.click('.pw-variant:has([value="1002"])');
    check('... and for 2 Brushes ($59.99 / $69.98 / Save $9.99, button $59.99)', (await txt(page.locator(PB))) === '$59.99 $69.98 Save $9.99' && (await txt(page.locator('[data-add-price]'))) === '$59.99', await txt(page.locator(PB)));
    await ctx.close();
  }
  /* ---- Bundle option "Bundle": one card per value ---- */
  await reset(); await set('scenario=media&variants=5&compareAt=4999&bundleCompareAt=5998');
  {
    const html = await get(PRODUCT);
    const n = (html.match(/class="pw-variant[ "]/g) || []).length;
    check('extra option next to Bundle: still one card per Bundle value (2, not 4)', n === 2, String(n));
  }
  await reset(); await set('scenario=media&variants=4');
  {
    const html = await get(PRODUCT);
    const n = (html.match(/class="pw-variant[ "]/g) || []).length;
    check('one variant titled "1 Brush / 2 Brushes" ($22.00): no misleading single card is drawn', !/pw-variant__title/.test(html) && n === 0, String(n));
    const ed = await get(PRODUCT + '?design_mode=1');
    check('editor view explains the fix (Bundle option, 1 Brush / 2 Brushes, one price each)', /Bundle set-up check/.test(ed) && /Options found: Size, Bundle/.test(ed) && /"1 Brush \/ 2 Brushes"/.test(ed));
    check('shoppers never see that set-up note', !/Bundle set-up check/.test(html));
    const { ctx, page } = await newPage(browser);
    await page.goto(BASE + PRODUCT, { waitUntil: 'networkidle' });
    await page.click('[data-add-to-cart]'); await page.waitForSelector('cart-drawer.is-open');
    const st4 = await state();
    check('that product still adds its one real variant to the cart without errors', st4.cart.length === 1 && st4.cart[0].variantId === 1001, JSON.stringify(st4.cart));
    await ctx.close();
  }
  await reset(); await set(DATA);
  for (const [name, vp] of [['mobile', { width: 390, height: 844 }], ['tablet', { width: 820, height: 1100 }]]) {
    const { ctx, page } = await newPage(browser, { viewport: vp, hasTouch: true });
    await page.goto(BASE + PRODUCT, { waitUntil: 'networkidle' });
    const geo = await page.evaluate(() => { const r = [...document.querySelectorAll('.pw-variant')].map((e) => e.getBoundingClientRect()); return { w: r.map((x) => Math.round(x.width)), sameRow: Math.abs(r[0].top - r[1].top) < 4, sw: document.documentElement.scrollWidth }; });
    if (name === 'mobile') check('mobile: the two options stack full width, equal size, no sideways scroll', !geo.sameRow && geo.w[0] >= 340 && Math.abs(geo.w[0] - geo.w[1]) <= 2 && geo.sw <= vp.width, JSON.stringify(geo));
    else check('tablet: both options sit side by side, equal width, no sideways scroll', geo.sameRow && Math.abs(geo.w[0] - geo.w[1]) <= 2 && geo.sw <= vp.width, JSON.stringify(geo));
    await page.tap('.pw-variant:has([value="1002"])'); await page.waitForTimeout(250);
    check(`${name}: tapping 2 Brushes updates the price block and button`, (await txt(page.locator(PB))) === '$49.99 $59.98 Save $9.99' && (await txt(page.locator('[data-add-price]'))) === '$49.99');
    if (name === 'mobile') {
      await page.evaluate(() => window.scrollTo(0, document.querySelector('.pw-details').offsetTop)); await page.waitForTimeout(400);
      check('mobile: sticky bar shows the selected option\'s price', /\$49\.99/.test(await txt(page.locator('[data-sticky-bar]'))));
      await page.click('[data-sticky-button]'); await page.waitForSelector('cart-drawer.is-open');
      const stm = await state();
      check('mobile: sticky Add to Cart adds the selected 2 Brushes, quantity 1', stm.cart.length === 1 && stm.cart[0].variantId === 1002 && stm.cart[0].quantity === 1, JSON.stringify(stm.cart));
    }
    await ctx.close();
  }
  await reset(); await set('scenario=media');

  group('Compact customer review card');
  await reset(); await set('scenario=media&reviews=1&variants=2');
  {
    const { ctx, page } = await newPage(browser);
    await page.goto(BASE + PRODUCT, { waitUntil: 'networkidle' });
    const card = page.locator('.pw-rcard');
    check('exactly one compact review card, no carousel, dots, arrows or section heading', (await card.count()) === 1 && (await page.locator('.pw-rcard h2, .pw-rcard h3, [data-review-dot], [data-review-next], review-rotator').count()) === 0);
    const g = await page.evaluate(() => {
      const c = document.querySelector('.pw-rcard'); const img = c.querySelector('.pw-rcard__photo'); const body = c.querySelector('.pw-rcard__body');
      const cs = getComputedStyle(c); const is = getComputedStyle(img); const r = c.getBoundingClientRect(); const ir = img.getBoundingClientRect(); const br = body.getBoundingClientRect();
      return { h: Math.round(r.height), w: Math.round(ir.width), ih: Math.round(ir.height), fit: is.objectFit, left: ir.right <= br.left + 1, top: Math.abs(ir.top - r.top) < 20, border: cs.borderTopWidth, radius: parseFloat(cs.borderTopLeftRadius), bg: cs.backgroundColor, natural: [img.naturalWidth, img.naturalHeight] };
    });
    check('photo is a 52 x 52 square on the left, cropped with object-fit: cover', g.w === 52 && g.ih === 52 && g.fit === 'cover' && g.left, JSON.stringify(g));
    check('card: subtle 1px border, rounded corners, cream (not white) background', g.border === '1px' && g.radius >= 12 && g.bg === 'rgb(250, 247, 242)', JSON.stringify(g));
    check('card is compact on desktop (under 150 px tall)', g.h < 150, String(g.h));
    const t = (sel) => txt(page.locator('.pw-rcard ' + sel));
    check('five stars, labelled "Rated 5 out of 5 stars"', (await page.locator('.pw-rcard__star:not(.is-empty)').count()) === 5 && /Rated 5 out of 5/.test(await page.locator('.pw-rcard__stars').getAttribute('aria-label')));
    check('title, review and "— name" all shown', /“TEST TITLE ONE”/.test(await t('.pw-rcard__title')) && /TEST REVIEW ONE/.test(await t('.pw-rcard__text')) && (await t('.pw-rcard__name')) === '— Test Person A.');
    check('"Verified purchase" only because the block ticks it', /Verified purchase/.test(await t('.pw-rcard__verified')));
    const order = await page.evaluate(() => { const f = (s) => document.querySelector(s); const before = (a, b) => !!(f(a).compareDocumentPosition(f(b)) & Node.DOCUMENT_POSITION_FOLLOWING); return { cards: before('.pw-variants', '.pw-rcard'), add: before('[data-add-to-cart]', '.pw-rcard'), perks: before('.pw-rcard', '.pw-perks') }; });
    check('placement: under the bundle selector and Add to Cart, above the benefit tiles', order.cards && order.add && order.perks, JSON.stringify(order));
    check('storefront never shows the editor preview label', (await page.locator('[data-review-preview]').count()) === 0);
    await ctx.close();
  }
  await set('reviews=2');
  {
    const { ctx, page } = await newPage(browser);
    await page.goto(BASE + PRODUCT, { waitUntil: 'networkidle' });
    check('review without a photo: no picture at all, no verified badge, 4 stars exactly as entered', (await page.locator('.pw-rcard__photo').count()) === 0 && (await page.locator('.pw-rcard__verified').count()) === 0 && (await page.locator('.pw-rcard__star:not(.is-empty)').count()) === 4);
    check('review without a title: no empty title line', (await page.locator('.pw-rcard__title').count()) === 0);
    await ctx.close();
  }
  await set('reviews=3');
  {
    const html = await get(PRODUCT);
    const n = (html.match(/class="pw-rcard[ "]/g) || []).length;
    check('only one review card is ever drawn (no duplicates)', n === 1 && /TEST REVIEW ONE/.test(html) && !/TEST REVIEW TWO/.test(html), String(n));
  }
  await set('reviews=0');
  {
    const shop = await get(PRODUCT);
    check('no review added: the card is hidden on the live storefront (no text, no placeholder)', !/pw-rcard|Finally, grooming|Customer name/.test(shop));
    const ed = await get(PRODUCT + '?design_mode=1');
    check('theme editor shows a clearly labelled preview with example wording', /data-review-preview/.test(ed) && /Preview only/.test(ed) && /Finally, grooming is easier!/.test(ed) && /Customer name/.test(ed));
    await set('reviews=4');
    const blank = await get(PRODUCT);
    check('a review block with nothing typed in behaves like no review (hidden on the storefront)', !/pw-rcard/.test(blank));
  }
  for (const [name, vp] of [['mobile', { width: 390, height: 844 }], ['small mobile', { width: 320, height: 640 }], ['tablet', { width: 820, height: 1100 }]]) {
    await set('reviews=1');
    const { ctx, page } = await newPage(browser, { viewport: vp });
    await page.goto(BASE + PRODUCT, { waitUntil: 'networkidle' });
    const m = await page.evaluate(() => { const b = document.querySelector('.pw-rcard').getBoundingClientRect(); const i = document.querySelector('.pw-rcard__photo').getBoundingClientRect(); const buy = document.querySelector('.pw-buy').getBoundingClientRect(); const perks = document.querySelector('.pw-perks').getBoundingClientRect(); return { boxH: Math.round(b.height), boxW: Math.round(b.width), photo: Math.round(i.width), gapAbove: Math.round(b.top - buy.bottom), gapBelow: Math.round(perks.top - b.bottom), sw: document.documentElement.scrollWidth }; });
    check(`${name}: compact card, 52px photo, tidy spacing (12-32px above and below), no sideways scroll`, m.photo === 52 && m.boxH < 190 && m.gapAbove >= 12 && m.gapAbove <= 32 && m.gapBelow >= 12 && m.gapBelow <= 32 && m.sw <= vp.width, JSON.stringify(m));
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
