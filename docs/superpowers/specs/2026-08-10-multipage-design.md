# Multi-page review support — design

Issue: rafarc21/reviewplz#1. Branch: `1-multipage-v1`.

## Problem

Widget activates only on `?review=<board>`. Internal link click drops query string. Widget dies.
Client fetches by board alone. Every comment renders on every page. Selectors mis-match across pages.
D1 already stores `path` per comment. Client already sends `location.pathname`. Nothing reads it.

## Decisions

### 1. Persistence: sessionStorage. Not link rewriting.

Considered:

- **Link rewriting** — append `?review=` to every internal `<a>`. Rejected. Mutates host DOM.
  Needs MutationObserver for dynamic links. Misses `location.href=` JS navigation, form posts,
  back/forward to clean URLs. Pollutes copied/canonical URLs. Heavy code.
- **sessionStorage** — chosen. Key `rpz-board` stores raw board name at activation.
  Tab-scoped: survives all same-tab navigation (links, JS, forms, back/forward).
  Dies with tab. Zero host-DOM interference. ~15 lines.

Rules:

- URL param present → activate, write board to sessionStorage. Param wins over stored value.
- No param, top window, sessionStorage has board → activate from storage.
- No param, iframe (`window.self !== window.top`) → stay inert. Prevents host-site iframes
  (same-origin embeds) from sprouting widgets; preview iframe carries param in its `src` anyway.
- Explicit exit: ✕ button on toolbar. Clears sessionStorage, strips param via
  `history.replaceState`, reloads. Satisfies "deactivates by explicit action, not by accident".

### 2. Page scoping: client-side filter. Zero server changes.

Server keeps returning all board comments (old widgets in prod depend on that shape).
Client fetches all (as today), splits by path:

- `norm(p)`: strip `index.html`/`index.htm` suffix, strip trailing slash except root.
  `/about/` ≡ `/about`, `/example/index.html` ≡ `/example`.
- Pin renders when `norm(c.path) === norm(location.pathname)`.
- Legacy comment (`path` null/empty) → renders on every page. Exactly today's behavior.
- Full list needed anyway for other-page counts → one fetch serves both. No extra requests.

### 3. Other-page visibility: pages chip + popup.

Toolbar gains chip when other pages hold comments: `N on M pages` style.
Click → popup lists each other path + count. Click path → `location.href = path`
(plain navigation; board survives via sessionStorage). Current-page count chip unchanged
(counts rendered pins, legacy included).

### 4. Untouched

- Server functions, schema, middleware: no diff.
- Device split: board suffix `-desktop`/`-mobile` logic unchanged. Filter orthogonal.
- Framed preview: unchanged; count relay stays per-page.

## Backward compat

- Old comments: `path` null/empty → render everywhere (unchanged behavior). Rows with real
  path now render only there — that is the issue's requested behavior change.
- Old deployed widget + new worker: worker has no diff → trivially compatible.
- Single-page boards: all comments share one path → identical UX to today, plus persistence.

## Testing

- Server: no changes → no worker harness needed.
- Widget: zero-dep repo, IIFE, DOM-bound → e2e via real stack.
  `wrangler pages dev example --d1` style local run (wrangler 4.74 present), schema applied to
  local D1, scripted browser checks (superpowers-chrome): nav survival, scoping, jump,
  exit, legacy row via direct SQL insert, device split.
- Size: `gzip -c reviewplz.js | wc -c` < 10240. Baseline 7.6 KB.

## Example

`example/about.html` added. Cross links both directions. Exercises multi-page flow.
