# Reviewplz

**A self-hosted, Figma-style review & comment overlay for any website — in one drop-in `<script>`.**

Send a teammate or client a link like `https://yoursite.com/?review=homepage` and they can drop pinned comments directly on the live page, reply to each other, and review desktop and mobile separately. No SaaS, no per-seat pricing, no third-party scripts watching your users. You own the data (Cloudflare D1 by default).

```html
<script src="https://cdn.jsdelivr.net/npm/reviewplz" data-api="/api"></script>
```

The widget is **inert** until a URL carries `?review=<board>` — so you can ship it on production and it stays invisible to normal visitors.

---

## Why

Tools like this exist (Markup, BugHerd, Pastel…) but they're paid SaaS that inject their own runtime and store your feedback on their servers. Reviewplz is ~600 lines of dependency-free vanilla JS plus a tiny Cloudflare Functions + D1 backend you deploy yourself. Fork it, theme it, host it, keep the data.

## Features

- 📌 **Pinned comments** anchored to the *element* they're dropped on — they stay glued through scrolling, lazy-loaded media, and reveal animations (not brittle x/y percentages).
- 💬 **Threaded replies** — multiple reviewers, one conversation per pin.
- ✏️ **Editable comments** — fix a typo or rephrase after posting; the pin updates in place.
- 🙋 **Identity gate** — first-time reviewers enter a name, so every comment and reply is attributed.
- 🖥 / 📱 **Device review** — one toggle flips between desktop and mobile; comments are kept per device. On a phone, "desktop" loads the real desktop layout in a scrollable frame (like Chrome's *Request desktop site*).
- 🧭 **Multi-page review** — once activated, the board follows the reviewer through internal navigation (per tab, via `sessionStorage`) until they hit ✕ in the toolbar. Comments stick to the page they were made on; a 🗂 chip lists the other pages that have comments and jumps to them. Comments from before v0.2 (no recorded path) render on every page.
- 🪟 **Respects your UI** — comments dropped on a modal/popup track it and sit above it; page comments sit below open overlays. You can comment *on* modals.
- 🔢 **Clean numbering** — pins renumber as one continuous series; no duplicates after deletes.
- 🎨 **Themeable** — set your accent colour, font, and which elements never take a comment.
- 🪶 **Zero dependencies**, ~15 KB, no build step.

## Quick start

### 1. Add the widget

```html
<!-- from a CDN -->
<script src="https://cdn.jsdelivr.net/npm/reviewplz" data-api="/api"></script>

<!-- or self-host the single file -->
<script src="/reviewplz.js" data-api="/api"></script>
```

### 2. Stand up the backend

The reference backend is Cloudflare Pages Functions + D1 (free tier). See
[`server/cloudflare`](server/cloudflare) — it's four commands. If the API lives
on the same origin as your site, you're done. To host it once and share it
across sites, point the widget at it: `data-api="https://reviewplz.you.pages.dev/api"`.

### 3. Review

Open any page with `?review=<board-name>` (e.g. `?review=acme-homepage`). Enter
your name, click anywhere to leave a comment, open a pin to reply. From there the
board sticks for the whole tab — click through the site normally and comment on
any page; leave with the toolbar's ✕ (or by closing the tab).

## Configuration

Set options as `data-*` attributes on the script tag, or via a `window.REVIEWPLZ` object before the script loads.

| Attribute | Default | Description |
|-----------|---------|-------------|
| `data-param` | `review` | Query param that activates the widget |
| `data-api` | `/api` | Base path/URL for the comments + replies API |
| `data-accent` | `#E5484D` | Accent colour (pins, buttons) |
| `data-ink` | `#16181D` | Primary text colour |
| `data-font` | system stack | `font-family` for the widget UI |
| `data-ignore` | `""` | Extra CSS selectors that should never receive a comment (e.g. `#site-header, .cookie-bar`) |
| `data-breakpoint` | `860` | Width (px) below which the page counts as "mobile" |

```html
<script src="/reviewplz.js"
        data-api="/api"
        data-accent="#4F46E5"
        data-ignore="#site-header, .sticky-cta"></script>
```

Interactive elements (`a, button, input, textarea, select, label, summary`, anything `[data-close]`) are always click-through so the page stays usable while commenting.

## How it works

- **Anchoring.** On click, Reviewplz records a CSS path to the target element plus the fractional offset within it. On render it positions each pin from that element's live rect every frame — so pins follow content through scroll and layout shifts. Comments on `position: fixed` overlays (modals) are tracked in viewport space and hidden when the overlay closes.
- **Device split.** Boards are stored as `<board>-desktop` and `<board>-mobile`. The device toggle opens a same-origin iframe (`?...&framed=1`) at the target width so the *real* responsive layout renders; the iframe has no toolbar — the single toolbar drives it via `postMessage`.
- **Pages.** Each comment records `location.pathname`; the widget fetches the whole board and renders only the pins whose (normalized) path matches the current page — `/pricing/`, `/pricing` and `/pricing/index.html` are the same page. The 🗂 chip is built from the same list, so seeing other pages' counts costs no extra request. Activation state is one `sessionStorage` key; nothing is rewritten in your links or history except re-appending `?review=` so copied URLs keep working.
- **Storage.** Comments and replies live in two D1 tables (`comments`, `replies`). Deleting a comment cascades to its replies.

## Self-hosting elsewhere

Any backend that implements the seven endpoints in [`server/cloudflare/README.md`](server/cloudflare/README.md) works — point `data-api` at it. The Cloudflare version is just the reference.

## License

MIT © 2026 — see [LICENSE](LICENSE).
