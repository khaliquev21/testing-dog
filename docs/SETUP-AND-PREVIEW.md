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
4. **Bundle (1 brush or 2 brushes).** If your product currently has a single price and no options (so the page shows no bundle cards), convert it like this:
   1. Open the product, scroll to **Variants**, and choose **Add options like size or color**.
   2. Option name: `Pack size`. Values: `1 Pack`, then `2 Pack`. The value names must **start with the number** (the theme reads it).
   3. Set the prices in the variant table: `1 Pack` **Price 29.99**, **Compare-at price 49.98**; `2 Pack` **Price 49.99**, Compare-at empty.
   4. Set inventory for both variants (the 2 Pack counts two-packs) and **Save**.
   5. Reload the product page. The cards, the "BEST VALUE" label and the supporting line appear by themselves.

   Why variants and not a discount: Shopify cannot tell a theme about an automatic discount before checkout, so a theme can only *display* a discount price it cannot guarantee. A real variant at $49.99 is charged at $49.99 by Shopify. The card wording, the badge and the line "Keep a spare or groom more than one pet." are editable under Customize > Product page > Product > Bundle / option cards.

   What shoppers see: the 1 Pack shows ~~$49.98~~ $29.99 with "Save $19.99". The 2 Pack shows $49.99 with ~~$59.98~~ and "Save $9.99" and a "BEST VALUE" badge. The $59.98 is always 2 x the live 1 Pack price, and the saving is that minus the 2 Pack price. If you later change a price in Shopify, every number follows. If the 2 Pack ever costs the same as or more than two singles, the saving, badge and strikethrough disappear by themselves. A compare-at price shows only if Shopify has one that is higher than the selling price.

   Because these are variants, **Shopify itself prices the cart and checkout**: the page only sends the chosen variant, always with cart quantity 1, so it cannot send a wrong price. No discount code or app is needed.

   **Quantity box:** when the product has a bundle, the box shows the number of **brushes** in the selected option (1 or 2) and follows the cards. Its minus and plus buttons only move between the real bundle sizes (1 and 2), so price and quantity can never disagree. Shoppers who want more can raise the quantity of the bundle in the cart (2 of the 2 Pack = 4 brushes at $99.98). The selected price also shows inside the Add to Cart button.
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

### Shipping, Returns and Support accordion

The three rows under the buy box open into detail panels. What each panel shows:

- **Your Shopify policies:** the text from **Settings > Policies** (shipping and refund) is pulled in automatically, with a link to the full policy. Write them there once.
- **Details you add yourself:** in **Customize > Product page > Product**, open each *Info accordion row* and fill the detail fields (for Shipping: processing time, delivery time, shipping cost, where you ship; for Returns: who can return, how to start a return, refunds). **Empty details are hidden from shoppers and nothing is invented.** In the theme editor they show a "Not set yet" reminder so you can see what is left.
- **Support:** add an email, phone and hours in the row, or leave the email empty to use your Shopify store email (**Settings > Store details**). Only add hours you actually keep.
- Without JavaScript all panels are simply open and readable.

## 5. Preview checklist

1. **Product page:** the gallery changes with thumbnails and arrows, videos loop with a pause button, the price reads $29.99.
2. **Quantity and Add to Cart:** choose 3, press Add to Cart. The cart drawer opens with 3 brushes at $29.99 each and a subtotal of $89.97.
3. **Cart:** change quantity, remove, then press **Checkout** and confirm checkout opens with the same price. (Use a test order or cancel at payment.)
4. **Mobile:** open the preview on a phone (or Customize > mobile view). Check the menu, gallery swipe, Add to Cart and the cart drawer.
5. **Homepage:** hero, benefits, demo videos, FAQ link in the menu, footer links.

## 6. Publish

Only after you have reviewed it: on the theme card choose **Publish**. Until you do, nothing changes for customers. To go back, publish your previous theme again.
