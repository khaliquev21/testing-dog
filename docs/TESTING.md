# Testing notes

## What was run

All of this ran against the real theme files in this repository.

| Check | Result |
| --- | --- |
| Shopify `theme-check` (Liquid syntax, schema, templates) | 43 theme files, **0 offenses** (preload-style hints disabled in `.theme-check.yml`) |
| Behaviour tests in headless Chromium (`dev/harness/tests.js`) | **225 of 225 passed** |
| Extra checks (`extra-checks.js`) | Cart-as-page mode, fonts, no third-party requests, class coverage: all passed |
| Responsive sweep (`sweep.js`) | **No horizontal scrolling** in 180 page/width combinations (320 px to 1920 px, 5 page types, with and without media, and with a 1 Pack / 2 Pack product) |
| Colour audit (`audit.js`) | 26 distinct colour values, all warm hues. **0 green** in the source and **0 green in 22,737 computed colour values** across 20 page/viewport combinations |
| Wording audit | The word "GIF" appears nowhere in the theme or in any rendered page (storefront or editor view) |
| Accessibility (axe-core, WCAG 2.0/2.1 A and AA) | **0 violations** on 10 page/viewport combinations |
| Loop script (`scripts/make-loop.sh`) | Exact loop length, no audio track, 4:5 crop correct, seam as smooth as consecutive source frames |

### What the behaviour tests cover

- **Gallery:** every Shopify media item becomes a slide and a thumbnail. Arrows (with wrap-around), thumbnails, keyboard arrows and variant-linked images all work. Videos autoplay muted, loop past their end, show a pause button, pause when you leave the slide or scroll away, and stay paused if the shopper paused them. With reduced motion on, nothing autoplays and the play button still works.
- **Product page layout:** the gallery frame follows the photo's real shape (picture fills it), balanced two-column layout on desktop, stacked on tablet and mobile, mobile sticky Add to Cart bar, bundle cards from real variants, real-inventory low-stock note.
- **Shipping / Returns / Support accordion:** real buttons with `aria-expanded` and `aria-controls`, closed panels not focusable, whole row clickable, animated open and close, chevron rotation, Arrow/Home/End/Enter/Space keys, independent rows, Shopify policy text pulled in, nothing invented when unset, editor-only reminders, open and readable without JavaScript, mobile tap size.
- **Pricing and bundle:** compare-at from Shopify data shown struck through with "Save $X" and never shown when invalid; 1 Pack and 2 Pack cards ($29.99; $49.99 vs $59.98, Save $9.99, BEST VALUE); live price/comparison/savings switching; the 2 Pack variant, quantity and Shopify price reaching the cart and drawer totals; no saving when the bundle is not cheaper; numbers following Shopify when prices change; mobile and tablet layouts.
- **Bundle quantity:** the quantity box shows 1 or 2 brushes and follows the selected card, plus/minus only move between real bundle sizes, the price beside Add to Cart updates, the cart always receives one of the selected variant at Shopify's price (also when the hidden field is tampered with), and the cart can raise the bundle count consistently.
- **Review rotator (with a controllable clock):** one visible review at a time, 10 s timing and looping, crossfade only, no layout shift, dots, arrows, keyboard, manual change restarts the clock, pause on hover/focus/hidden tab, reduced motion, no duplicate timers or listeners after remove and re-add, single-review and no-review states, placement under Add to Cart, mobile.
- **Quantity:** 1 to 10 by default, never below 1, typing is clamped, the maximum comes from the theme setting and from tracked inventory.
- **Add to Cart:** posts the real variant id and quantity to `/cart/add.js`, opens the cart drawer, shows the right unit price, line total and subtotal, updates the header count, accumulates repeat adds, and reports Shopify's own error when stock runs out. The drawer's plus, minus, typed quantity, Remove and Checkout all work. Escape and the overlay close it and focus returns to the button.
- **Without JavaScript:** the product form still posts to `/cart/add`, and the cart page lists the item and reaches checkout.
- **Price:** rendered at $29.99 and then at $34.99 on the homepage, product page, collection page and structured data, to prove it follows the product and is not typed into templates. The string "29.99" appears nowhere in the theme source.
- **Content rules:** no placeholders for shoppers, no fake reviews or ratings, no bundle UI unless the product has real variants, the product's vendor field never shows (the brand comes from theme settings).
- **Mobile:** menu, search, tap-target sizes (40 px minimum) and no sideways scrolling.

### Default content versus your saved editor content

Default-state tests ("nothing set means nothing shown") run against a pristine snapshot of the shipped templates in `dev/harness/pristine-templates/`, because the Shopify theme editor rewrites `templates/*.json` with your own content. A final group renders your **live saved templates** and checks they load without errors, do not scroll sideways and still add to cart.

## Limits: what these tests do not prove

Be clear-eyed about these before you rely on the results.

1. **No real Shopify store was involved.** No store was connected, so the theme was rendered by a mock built on the open-source `liquidjs` engine with Shopify-shaped data and a mock cart API. It follows Shopify's documented behaviour, and Shopify's own linter passes, but a real store can still differ. The first upload is the real test. Preview the product page, add to cart and checkout before publishing.
2. **Fixtures are synthetic.** Every image in the screenshots is labelled "TEST FIXTURE" and every clip "TEST CLIP". They exist only to exercise layout and behaviour. No product imagery was produced.
3. **Browser coverage is Chromium only.** I did not test real iPhone Safari or Android devices. Autoplay with `muted` and `playsinline` is the standard approach for mobile browsers, but check on a real phone.
4. **Test videos are WebM.** Chromium here has no H.264 decoder, so the mock serves WebM bytes labelled as video. Real Shopify videos are MP4 (H.264), which every current browser plays.
5. **Not covered:** the theme editor's live interactions, Shopify's real Section Rendering API, real checkout, Markets / multi-currency, customer accounts, and third-party review apps.
6. **Looping footage:** the loop tool was proven on synthetic footage only. Check each real loop by eye.

## Re-running everything

```bash
cd dev/harness
npm install                # liquidjs, playwright-core, theme-check, axe-core, busboy
sh make-fixtures.sh        # synthetic fixtures (needs ImageMagick and ffmpeg)
./restart.sh               # starts the mock Shopify on http://localhost:4177
npm run lint               # Shopify theme-check
npm test                   # 225 behaviour checks
npm run audit              # green, wording and accessibility audits
npm run extra
npm run sweep              # responsive overflow sweep
npm run shots              # screenshots into dev/harness/shots
```

Needs Node 20 or newer. Set `CHROME_PATH` if Playwright cannot find a Chromium. Open `http://localhost:4177/?scenario=media` to browse the theme with fixtures, add `&design_mode=1` to see the editor-only upload reminders, and use `/__set?price=3499` to change the mock product price.
