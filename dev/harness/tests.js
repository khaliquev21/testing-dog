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
    const hits = src.filter((f) => /29\.99|2999/.test(fs.readFileSync(THEME + '/' + f, 'utf8')));
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
    check('compare-at price is hidden by default (single standard price)', !/pw-price__compare/.test(shopDefault));
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
  await reset(); await set('scenario=media&variants=3&compareAt=4999&price=2999');
  {
    const html = await get('/products/self-cleaning-pet-grooming-brush');
    check('savings only shown when the theme setting is on (off by default)', !/pw-variant__save/.test(html));
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

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n==== ${results.length - failed.length}/${results.length} passed ====`);
  if (failed.length) { console.log('FAILED:'); failed.forEach((f) => console.log(` - [${f.group}] ${f.name} ${f.detail}`)); }
  fs.writeFileSync(__dirname + '/test-results.json', JSON.stringify(results, null, 2));
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('HARNESS ERROR', e); process.exit(2); });
