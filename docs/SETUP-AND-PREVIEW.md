# Setup, preview and upload

Menu names in Shopify admin move around from time to time. The paths below are the current ones at the time of writing.

> **Nothing here publishes anything.** The theme is uploaded as an unpublished copy. Your live storefront only changes if you press **Publish** yourself.

## 1. Upload the theme (recommended: zip)

1. Shopify admin > **Online Store > Themes**.
2. **Add theme > Upload zip file**, choose `dist/pawora-theme.zip` from this repository.
3. It appears under **Theme library** as an unpublished theme. Leave it unpublished.
4. Open the **...** menu on its card for **Preview**, or press **Customize** to edit it.

If you change anything in the repo, rebuild the zip with `scripts/package-theme.sh` and upload it again as a new theme version.

### Other ways to load it

- **GitHub integration:** Themes > Add theme > **Connect from GitHub**, then choose this repository and the branch `claude/blissful-allen-x75nc0`. Shopify creates a separate theme from the branch.
- **Shopify CLI** (needs a login and has not been run for this project):
  `shopify theme push --unpublished --path . --theme "Pawora"` uploads without publishing, and `shopify theme dev` gives a live local preview.

## 2. Set the product price to $29.99 USD

Your Store Launch connection had no store linked, so the price could not be set for you. Do it in Shopify admin:

1. **Products** > open the brush (create it first if it does not exist: **Add product**).
2. **Title:** `Self-Cleaning Pet Grooming Brush` (the theme shows the product title exactly as typed here).
3. **Pricing > Price:** `29.99`. Leave **Compare-at price** empty. The theme hides compare-at prices by default, so there is one standard price.
4. **Bundles (optional):** add one option, for example `Pack size`, with real variants such as `1 Pack`, `2 Packs`, `3 Packs`, each with its own price and inventory. The product page turns them into selectable cards automatically and adds the chosen variant to the cart. With only one variant, no cards are shown. Set your own bundle prices; the theme never invents a discount. Savings (struck-through price and "Save %") appear only if you set a Compare-at price on a variant **and** turn on Theme settings > Product and pricing > compare-at price.
5. **Save.**
6. Check the currency: **Settings > Store details** (store currency) and **Settings > Markets**. The price displays in USD when the store currency is USD. The theme can append "USD" after prices (Theme settings > Product and pricing).

The price is then shown in the product page, the homepage and closing buttons, the cart drawer, the cart page and the structured data, all read from this one field.

Customers can also choose a quantity of the selected variant on the product page.

## 3. Add the genuine product media

Follow [MEDIA-CHECKLIST.md](MEDIA-CHECKLIST.md). In short:

- Product photos and videos for the gallery go in **Products > the brush > Media**.
- Photos and videos for the other sections go in the theme editor: **Customize > Home page / Product page**, then each section's image or video picker.

## 4. Finish the content

- **Product claims:** read [CONTENT-VERIFICATION.md](CONTENT-VERIFICATION.md) and confirm each one with your supplier.
- **Policies:** **Settings > Policies**. Create Shipping, Refund and Privacy policies and Terms of Service. The footer and the product page link to them.
- **Contact page:** **Online Store > Pages > Add page**, title `Contact`, and under Theme template choose `page.contact`. The footer's Contact link points to `/pages/contact`.
- **Support email:** Customize > footer > Support email.
- **Reviews:** install a reviews app that supports app blocks, then add its block inside the **Reviews** section. Until then shoppers see only the "no reviews yet" text.
- **FAQ:** unanswered questions are hidden. Write the answers once your supplier confirms them: Customize > Product page > FAQ.

## 5. Preview checklist

1. **Product page:** the gallery changes with thumbnails and arrows, videos loop with a pause button, the price reads $29.99.
2. **Quantity and Add to Cart:** choose 3, press Add to Cart. The cart drawer opens with 3 brushes at $29.99 each and a subtotal of $89.97.
3. **Cart:** change quantity, remove, then press **Checkout** and confirm checkout opens with the same price. (Use a test order or cancel at payment.)
4. **Mobile:** open the preview on a phone (or Customize > mobile view). Check the menu, gallery swipe, Add to Cart and the cart drawer.
5. **Homepage:** hero, benefits, demo videos, FAQ link in the menu, footer links.

## 6. Publish

Only after you have reviewed it: on the theme card choose **Publish**. Until you do, nothing changes for customers. To go back, publish your previous theme again.
