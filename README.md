# Pawora Shopify theme

A Shopify Online Store 2.0 theme for the **Pawora self-cleaning pet grooming brush**, built from the approved Claude Design boards (homepage and product page, desktop and mobile).

**Status**

- Built, linted and tested in a local mock of Shopify (see [docs/TESTING.md](docs/TESTING.md)).
- **Not uploaded and not published.** Nothing in your Shopify store has been changed.
- **Genuine product photos and video are not included yet.** The Amazon listing could not be reached from the build environment, and no stand-in imagery was made. The theme is ready for your real media: see [docs/MEDIA-CHECKLIST.md](docs/MEDIA-CHECKLIST.md).

## Quick start

1. Upload `dist/pawora-theme.zip` in Shopify admin: **Online Store > Themes > Add theme > Upload zip file**. It is added as an **unpublished** theme. Do not click Publish.
2. Set the product price to **$29.99** and add the product media: [docs/SETUP-AND-PREVIEW.md](docs/SETUP-AND-PREVIEW.md).
3. Preview it (**Customize** or **Preview**) and upload your genuine media into the slots listed in the media checklist.
4. Confirm the product claims in [docs/CONTENT-VERIFICATION.md](docs/CONTENT-VERIFICATION.md) against your supplier listing.
5. Publish only when you are happy.

## What is in the theme

| Area | Files |
| --- | --- |
| Homepage | `templates/index.json` with sections `hero`, `benefits`, `video-showcase`, `intro`, `reviews`, `final-cta` |
| Product page | `templates/product.json` with sections `main-product` (gallery, price, quantity, Add to Cart), `feature-details`, `how-it-works`, `reviews`, `faq` |
| Header and footer | `sections/header.liquid`, `sections/footer.liquid` (editable section groups), responsive menu, search |
| Cart | `sections/cart-drawer.liquid` (slide-out), `sections/main-cart.liquid` (cart page); switch in Theme settings > Cart |
| Utility pages | collection, search, page, contact form, 404, password |
| Looping videos | `snippets/loop-video.liquid` plus `<loop-video>` in `assets/theme.js` (muted, looping, play / pause button) |
| Look and feel | `assets/theme.css`, bundled Bricolage Grotesque and Figtree fonts (SIL Open Font License), approved palette only |

## How it behaves

- **Price** is always read from the Shopify product (`product.price`). It is not typed into any template. Change it in Shopify admin and every place that shows it follows.
- **Add to Cart** posts the real variant and quantity to Shopify's cart. No fake products, variants, bundles or demo checkout.
- **Media** is shown only if you have uploaded it. Empty slots show nothing to shoppers. Inside the theme editor they show a dashed reminder of what belongs there.
- **Videos** are muted loops with a play / pause button, start only when on screen, and stay paused for shoppers who prefer reduced motion. Nothing is drawn over your footage.
- **No reviews or ratings** are shown until you connect a reviews app. Questions in the FAQ without an answer are hidden from shoppers.

## Tools in this repository

| Path | Purpose |
| --- | --- |
| `scripts/make-loop.sh` | Turns real footage into a seamless, muted, web-optimised loop (MP4, WebM and poster). Needs ffmpeg. |
| `scripts/package-theme.sh` | Rebuilds `dist/pawora-theme.zip` (theme folders only). |
| `dev/harness/` | Local mock-Shopify test harness (not part of the theme, never uploaded). |
| `docs/` | Setup, media checklist, content verification, testing notes. |

## Licences

Bricolage Grotesque and Figtree are bundled under the SIL Open Font License 1.1 (see [docs/THIRD-PARTY.md](docs/THIRD-PARTY.md)).
