#!/usr/bin/env bash
# Deploy the Reviewlay API (+ a copy of the widget) to Cloudflare Pages.
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -f wrangler.toml ]; then
  echo "✘ No wrangler.toml. Copy wrangler.toml.example → wrangler.toml and set database_id."
  exit 1
fi

mkdir -p public
cp ../../reviewlay.js public/reviewlay.js   # serve the widget from this deployment too
if [ ! -f public/index.html ]; then
  printf '%s' '<!doctype html><meta charset="utf-8"><title>Reviewlay</title><p>Reviewlay API is live. Widget at <a href="/reviewlay.js">/reviewlay.js</a>.</p>' > public/index.html
fi

npx wrangler pages deploy
