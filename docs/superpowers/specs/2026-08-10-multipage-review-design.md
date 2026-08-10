# Multi-page review — design

Issue #1. Board must survive internal navigation. Comments must scope to their page. Reviewer must see + reach other pages' comments.

## Constraints

- One drop-in `<script>`. Zero dependencies. Gzip < 10 KB (baseline 7664 B).
- Backward compatible. Old comments without usable `path` render as today (everywhere). Deployed old widget must keep working against Worker. Production consumer: thesummerhunter.com (vendored).
- Device split (`-desktop` / `-mobile`) unchanged.
- Server: prefer reading existing `path` column over changes.

## Decision 1 — activation persistence: sessionStorage + URL re-sync

Chosen: on activation via `?review=<board>`, write raw board name (no device suffix — suffix is appended at runtime) to `sessionStorage['rpz-board']`. On load without param, read store. Param present → param wins, overwrites store. After activation, `history.replaceState` re-appends `?review=<board>` to URL, preserving all other query params and hash. Keeps URL shareable. Keeps "URL is the switch" model.

Exit: new ✕ button in toolbar. Clears store. Strips param via `replaceState`. Reloads page. Reload guarantees clean teardown, 1 line.

Rejected:
- Link rewriting: mutates reviewed page. Misses pushState, `window.location`, form posts. Misses middle-click/copy-link at click-intercept variant. MutationObserver churn.
- Cookie: shared across tabs (accidental activation elsewhere). Sent with every request. Needs expiry policy.
- localStorage: persists forever → widget resurrects days later = accidental activation. sessionStorage dies with tab; share link re-activates.

Lifecycle: reload keeps board (store). Back/forward keeps board. Tab close ends session. Deactivation only via ✕. Matches "explicit action, not by accident".

## Decision 2 — page scoping: client-side filter, zero server changes

Server GET already returns `path` per comment. Client fetches board once, splits:

- `norm(p)`: strip trailing `/index.html`/`/index.htm`, strip trailing slashes, empty → `/`.
- usable path = non-null, non-empty after String cast.
- usable + `norm(path) === norm(location.pathname)` → render pin here.
- usable + different page → count toward that page's row in panel.
- no usable path (NULL/`''`, legacy rows) → render everywhere, as today.

POST unchanged — widget already sends `location.pathname`.

Rejected: server-side `?path=` filter + counts endpoint. Needs Worker changes, two fetches or new response shape, risks deployed widgets. Payload saving worthless at review scale (tens of comments).

Consequence: zero server diff → backward compat proven by absence. Worker involvement proven by live integration e2e (wrangler pages dev + D1) instead of new server code tests.

## Decision 3 — cross-page visibility: count chip opens page list

Count chip keeps per-page count text (`N comments`). Other pages have comments → chip gains ` · +M` suffix and becomes toggle. Click → small popup above bar:

- Row per page: `path (count)`. Current page marked, inert.
- Legacy everywhere-comments > 0 → extra row `Everywhere (n)`, inert.
- Row click → `location.href = path + '?<param>=<rawBoard>'` (raw name, no device suffix). Explicit param = belt and braces on top of store.

Rejected: always-visible per-page chips (toolbar overflow on many pages), separate pages button (more bytes, same function).

Numbering stays per-page 1..n (numbers are visual indices, not stored).

## Forced extras

- `framed` detection: `params.has('framed') || self !== top`. In-iframe navigation loses `&framed=1`; store re-activates widget inside preview iframe; without this fix toolbar would render inside frame. Same-origin iframe shares tab sessionStorage → preview navigation works free.
- Pathname watcher: existing 700 ms safety interval also compares `location.pathname` to last seen. Change → reload board. Covers SPA pushState/hash routers cheaply.
- Gate copy: one bullet noting review stays on while browsing, ✕ exits.

## Compat matrix

| Old/new | Old server | New server |
|---|---|---|
| Old widget | today | no server diff → identical |
| New widget | GET already returns `path` → works | works |

Old rows with NULL path: render everywhere (today's behavior). Rows with path (all current writes): scope to page — the issue's requested change.

## Non-goals

- No SPA router integration beyond pathname watcher.
- No per-page filtering server-side. No schema change. No migration.
- No cross-page pin previews; counts + jump only (issue: "per-page count is enough").
- thesummerhunter.com vendored copy untouched.

## Testing

- Unit/behavior: `node:test` + `jsdom` (devDependency only — ships nothing; widget stays zero-dep). Widget file evaluated in jsdom window with stubbed `fetch`. Cover: activation via param, via store, param>store precedence, exit clears+strips, URL re-sync, path scoping incl. legacy NULL/'' rows, norm() edge cases, panel counts+rows, framed detection, pathname watcher.
- Integration/acceptance: `wrangler pages dev` serving example/ + functions + local D1. Real browser walk: activate → navigate → comment on page 2 → scope check both pages → panel jump → exit. Screenshots as PR evidence.
- Size: `gzip -c reviewplz.js | wc -c` < 10240 pre-merge.

## Budget estimate

~3 KB raw added (store+exit ~0.5, scoping ~0.5, panel+CSS ~1.8, watcher+framed ~0.2) ≈ ~1 KB gz. Projected ~8.7 KB gz. Cap 10 KB.
