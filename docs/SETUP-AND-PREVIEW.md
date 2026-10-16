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
3. **Pricing > Price:** `29.99` (with the bundle option below, each variant gets its own price instead).
4. **Bundle (1 brush or 2 brushes).** The two bundle cards come from **one** product option named exactly `Bundle`:
   1. Open the product, scroll to **Variants** (or **Options**), and choose **Add options like size or color**.
   2. Option name: `Bundle`. Values: `1 Brush`, then `2 Brushes`. Each value must **start with the number** (the theme reads it). Use only this one option. Do not add a second option for the same thing: a variant called `1 Brush / 2 Brushes` is a **single** variant that joins two options, and it shows up as one card with one price.
   3. Set the prices in the variant table. Each variant holds its **own** price and compare-at price, and the page never borrows one variant's numbers for another: `1 Brush` **Price 29.99**, **Compare-at price 49.99**; `2 Brushes` **Price 49.99**, **Compare-at price 59.98**. (If you leave a Compare-at empty, that card simply shows no crossed-out price and no saving.)
   4. Set inventory for both variants (the `2 Brushes` variant counts two-packs) and **Save**.
   5. Reload the product page. Two cards appear, each mapped to exactly one variant, with its own price. "BEST VALUE" and the supporting line appear by themselves.

   **If the page shows one card named "1 Brush / 2 Brushes" with one price:** that is the product set-up above, not the page. The product has one variant whose name joins two options, so there is only one thing to sell. Fix it in Shopify admin as in the steps above (one `Bundle` option, two values, two variants). In the theme editor the product page prints a "Bundle set-up check" note listing the options and variants the theme found, so you can see exactly what Shopify is sending. Shoppers never see that note.

   Why variants and not a discount: Shopify cannot tell a theme about an automatic discount before checkout, so a theme can only *display* a discount price it cannot guarantee. A real variant at $49.99 is charged at $49.99 by Shopify. The card wording, the badge and the line "Keep a spare or groom more than one pet." are editable under Customize > Product page > Product > Bundle / option cards.

   What shoppers see: the 1 Brush shows ~~$49.99~~ $29.99 with "Save $20.00". The 2 Brushes shows $49.99 with ~~$59.98~~ and "Save $9.99" and a "BEST VALUE" badge. Every number is that variant's own price and compare-at price from Shopify (the saving is compare-at minus price, so $59.98 − $49.99 = $9.99). If you later change a price in Shopify, every number follows. The badge only appears on a bundle that costs more than one brush but less than the same number of single brushes.

   Because these are variants, **Shopify itself prices the cart and checkout**: the page sends the chosen variant ID and the quantity, so it cannot send a wrong price. No discount code or app is needed.

   **Quantity (bundles):** the quantity counts how many of the *selected bundle* the customer buys. It starts at 1 and goes back to 1 when a different bundle is chosen. `2 Brushes` with quantity 1 adds one 2 Brushes variant; quantity 2 adds two of them (four brushes). The price inside the Add to Cart button is the selected variant's price times the quantity, formatted by Shopify (for example $99.98 for two of the 2 Brushes variant).
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

### Customer review card (under Add to Cart)

One small review card sits directly under the bundle cards and Add to Cart. **It shows only what you type in, and nothing is invented.** There is no carousel and no heading.

**To add your review and photo:**

1. Shopify admin > **Online Store > Themes > Customize** (on the Pawora theme), then open the **Product page** template.
2. In the left panel click **Product** (the main product section), scroll to the list of blocks and press **Add block > Customer review**. Only one is allowed.
3. Fill in the block:
   - **Customer or pet photo:** press **Select image** and upload or pick the photo. It is cropped from the centre into a small square (about 52 px), so any shape works. Use a real photo this customer sent you, with their permission. Add a short **Photo description** for screen readers.
   - **Star rating the customer gave:** move the slider to what they actually gave (for example 5). 0 hides the stars.
   - **Review title**, **Review** (one or two sentences) and **Name to display** (first name and last initial, for example "Sam R.").
   - **Show "Verified purchase" badge:** leave it off unless you have checked in Shopify admin that this person bought the product. The theme cannot check orders by itself.
4. Press **Save**. To remove the card, delete the block.

**Until you add a real review:** the card is hidden on your live store. In the theme editor only, you see a dashed, clearly labelled preview with example wording ("Finally, grooming is easier!") so you can see where the card goes. That example text is never shown to shoppers.

**Review apps:** no review app is installed, so nothing is read automatically and no review form is added.

## 5. Preview checklist

1. **Product page:** the gallery changes with thumbnails and arrows, videos loop with a pause button, the price reads $29.99.
2. **Quantity and Add to Cart:** choose 3, press Add to Cart. The cart drawer opens with 3 brushes at $29.99 each and a subtotal of $89.97.
3. **Cart:** change quantity, remove, then press **Checkout** and confirm checkout opens with the same price. (Use a test order or cancel at payment.)
4. **Mobile:** open the preview on a phone (or Customize > mobile view). Check the menu, gallery swipe, Add to Cart and the cart drawer.
5. **Homepage:** hero, benefits, demo videos, FAQ link in the menu, footer links.

## 6. Publish

Only after you have reviewed it: on the theme card choose **Publish**. Until you do, nothing changes for customers. To go back, publish your previous theme again.
