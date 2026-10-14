#!/usr/bin/env bash
# Builds dist/pawora-theme.zip containing ONLY the Shopify theme folders (no docs, scripts or dev tooling).
# Upload that zip in Shopify admin: Online Store > Themes > Add theme > Upload zip file.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p dist
rm -f dist/pawora-theme.zip
zip -r -q -X dist/pawora-theme.zip assets config layout locales sections snippets templates -x '*.DS_Store'
echo "Built dist/pawora-theme.zip ($(du -h dist/pawora-theme.zip | cut -f1), $(unzip -Z1 dist/pawora-theme.zip | grep -vc '/$') files)"
