#!/usr/bin/env bash
# Deploy the Reviewplz API (+ a copy of the widget) to Cloudflare Pages.
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f wrangler.toml ]; then
  echo "✘ No wrangler.toml. Copy wrangler.toml.example → wrangler.toml and set database_id."
  exit 1
fi

mkdir -p public
cp ../../reviewplz.js public/reviewplz.js   # serve the widget from this deployment too
if [ ! -f public/index.html ]; then
  printf '%s' '<!doctype html><meta charset="utf-8"><title>Reviewplz</title><p>Reviewplz API is live. Widget at <a href="/reviewplz.js">/reviewplz.js</a>.</p>' > public/index.html
fi

npx wrangler pages deploy
