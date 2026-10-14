# Third-party assets

| Asset | Licence | Notes |
| --- | --- | --- |
| Bricolage Grotesque (variable, Latin subset) `assets/bricolage-grotesque-latin.woff2` | SIL Open Font License 1.1, Copyright 2022 The Bricolage Grotesque Project Authors (https://github.com/ateliertriay/bricolage) | Used for headings, prices and the logo wordmark. |
| Figtree (variable, Latin subset) `assets/figtree-latin.woff2` | SIL Open Font License 1.1, Copyright 2022 The Figtree Project Authors (https://github.com/erikdkennedy/figtree) | Used for body text. |

Both font files were taken from the approved design export (Google Fonts builds). They are bundled in the theme so the storefront makes no request to Google Fonts. The Latin subset covers English and most Western European text. Other scripts fall back to Helvetica Neue / Arial.

The OFL permits bundling and redistribution with the fonts' reserved names intact and does not allow selling the fonts on their own.

Test-only dependencies in `dev/harness` (liquidjs, playwright-core, @shopify/theme-check-node, axe-core, busboy) are not shipped with the theme.
