# Multi-page Review Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Board survives internal navigation via sessionStorage; comments scope to their page; toolbar lists other pages with counts and jumps to them.

**Architecture:** All changes client-side in `reviewplz.js` (IIFE, zero deps). Server, schema untouched. Activation: URL param or sessionStorage fallback (top window only). Scoping: client filters fetched list by normalized `path`. Spec: `docs/superpowers/specs/2026-08-10-multipage-design.md`.

**Tech Stack:** Vanilla JS (ES5-style, matches file). Verification: wrangler 4.74 pages dev + local D1 + scripted browser.

## Global Constraints

- `gzip -c reviewplz.js | wc -c` must stay < 10240 (baseline 7787). Check after every widget task.
- Zero runtime dependencies. One drop-in script. No build step.
- Server files (`server/cloudflare/**`) must show no diff.
- Legacy comments (null/empty `path`) render on every page, as today.
- Device board suffix (`-desktop`/`-mobile`) behavior unchanged.
- Code style: match existing `var`-based ES5 IIFE style, `rpz-` prefixes.
- No unit-test harness exists; repo stays zero-dep → acceptance checks are e2e (Task 5-6), defined before implementation.

---

### Task 1: sessionStorage activation + exit button

**Files:**
- Modify: `reviewplz.js:33-38` (activation), `reviewplz.js:72-78` (bar css), `reviewplz.js:246-276` (bar html + handlers)

**Interfaces:**
- Produces: `SKEY = 'rpz-board'` sessionStorage key. `rawBoard` may now come from storage. Exit button id `rpz-exit`.

- [x] **Step 1: Replace activation block** (`reviewplz.js:33-35`)

```js
  var params = new URLSearchParams(location.search);
  var rawBoard = params.get(cfg.param);
  var SKEY = 'rpz-board';
  try {
    if (rawBoard) sessionStorage.setItem(SKEY, rawBoard); // param wins; refresh the stored board
    else if (window.self === window.top) rawBoard = sessionStorage.getItem(SKEY);
  } catch (e) { /* storage blocked → param-only behavior */ }
  if (!rawBoard) return; // inert unless activated by param or stored board
```

Iframe rule: no param + iframe → inert (host-site same-origin iframes must not sprout widgets; the device-preview iframe carries the param in its src).

- [x] **Step 2: Add exit button css** (after `#rpz-bar #rpz-dev` rule, `reviewplz.js:76`)

```js
    '#rpz-bar #rpz-exit{border:0;cursor:pointer;border-radius:999px;padding:8px 10px;font:700 12px ' + FONT + ';background:rgba(255,255,255,.16);color:#fff}',
```

- [x] **Step 3: Add exit button to bar html** (`reviewplz.js:250-255`, after `#rpz-mode` button)

```js
      '<button id="rpz-mode">✏️ Commenting</button>' +
      '<button id="rpz-exit" title="Exit review">✕</button>';
```

- [x] **Step 4: Wire exit handler** (in the `!framed` branch, after `devBtn` wiring)

```js
    bar.querySelector('#rpz-exit').addEventListener('click', function () {
      if (!confirm('Exit review mode?')) return;
      try { sessionStorage.removeItem(SKEY); } catch (e) {}
      params.delete(cfg.param);
      params.delete('framed');
      history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params.toString() : '') + location.hash);
      location.reload();
    });
```

- [x] **Step 5: Size check**

Run: `gzip -c reviewplz.js | wc -c` — expect < 10240. Record number.

- [x] **Step 6: Commit**

```bash
git add reviewplz.js && git commit -m "Board survives navigation: sessionStorage activation + explicit exit (issue #1)"
```

### Task 2: Per-page comment scoping

**Files:**
- Modify: `reviewplz.js:98-107` (state), `reviewplz.js:342-347` (loadBoard)

**Interfaces:**
- Consumes: nothing new.
- Produces: `normPath(p)` → normalized path string; `pagePath` (current page, normalized); `onPage(c)` → bool; `allComments` array (full board list) for Task 3.

- [x] **Step 1: Add path helpers to state block** (after `var board = ...`, `reviewplz.js:101`)

```js
  var normPath = function (p) {
    p = p.replace(/\/index\.html?$/, '/'); // /a/index.html ≡ /a/
    return p.length > 1 ? p.replace(/\/+$/, '') : p; // trailing slash off, root stays '/'
  };
  var pagePath = normPath(location.pathname);
  var onPage = function (c) { return !c.path || normPath(c.path) === pagePath; }; // no path → legacy, every page
  var allComments = [];
```

- [x] **Step 2: Filter in loadBoard** (`reviewplz.js:342-347`)

```js
  function loadBoard() {
    clearPins();
    refreshCount();
    closeComposer();
    fetch(apiUrl()).then(function (r) { return r.json(); }).then(function (list) {
      allComments = list;
      list.filter(onPage).forEach(addPin);
      renumber(); refreshCount(); renderPages(); schedule(false);
    }).catch(function () {});
  }
```

`renderPages` arrives in Task 3; until then stub it right above `loadBoard`: `var renderPages = function () {};` (Task 3 replaces the stub).

- [x] **Step 3: Size check**

Run: `gzip -c reviewplz.js | wc -c` — expect < 10240.

- [x] **Step 4: Commit**

```bash
git add reviewplz.js && git commit -m "Scope comments to their page; legacy null-path renders everywhere (issue #1)"
```

### Task 3: Pages chip + jump popup

**Files:**
- Modify: `reviewplz.js` css block (~line 72-78), bar html (~250), handlers in `!framed` branch, replace Task 2 stub, gate copy (~407-411)

**Interfaces:**
- Consumes: `allComments`, `normPath`, `pagePath` (Task 2).
- Produces: `renderPages()` (real), popup id `rpz-pages`, chip id `rpz-pgs`.

- [x] **Step 1: css** (next to `#rpz-bar #rpz-dev` rule)

```js
    '#rpz-bar #rpz-pgs{border:0;cursor:pointer;border-radius:999px;padding:8px 12px;font:700 12px ' + FONT + ';background:rgba(255,255,255,.16);color:#fff}',
    '#rpz-pages{position:fixed;left:16px;z-index:2147483647;background:#0B0D11;color:#fff;border-radius:12px;padding:6px;font:600 12px ' + FONT + ';box-shadow:0 10px 30px rgba(0,0,0,.4);display:flex;flex-direction:column;gap:2px;max-height:40vh;overflow-y:auto;min-width:200px}',
    '#rpz-pages button{border:0;cursor:pointer;background:none;color:#fff;text-align:left;border-radius:8px;padding:7px 10px;font:600 12px ' + FONT + ';display:flex;gap:12px;justify-content:space-between;align-items:baseline}',
    '#rpz-pages button:hover{background:rgba(255,255,255,.14)}',
    '#rpz-pages button span{color:#9AA0A6;font-weight:600}',
```

- [x] **Step 2: bar html** — insert chip between count chip and name input

```js
      '<span class="chip" id="rpz-count">0</span>' +
      '<button id="rpz-pgs"></button>' +
      '<input id="rpz-name" placeholder="Your name" />' +
```

- [x] **Step 3: Replace Task 2 stub with real implementation + wiring.** Place the block right before `function loadBoard()`; it needs `bar`, so guard on `pagesBtn`. Declare `pagesBtn` with the other toolbar vars (`var nameInput = null, modeBtn = null, countEl = null, devBtn = null, pagesBtn = null, pagesPop = null;`) and set `pagesBtn = bar.querySelector('#rpz-pgs')` in the `!framed` branch with this click wiring:

```js
    pagesBtn = bar.querySelector('#rpz-pgs');
    pagesBtn.addEventListener('click', function (e) { e.stopPropagation(); if (pagesPop) closePages(); else openPages(); });
```

Implementation block (before `loadBoard`):

```js
  var otherPages = function () { // group non-current-page comments by normalized path
    var m = {}, order = [], i, raw, p;
    for (i = 0; i < allComments.length; i++) {
      raw = allComments[i].path;
      if (!raw) continue; // legacy → shown on every page, not listed
      p = normPath(raw);
      if (p === pagePath) continue;
      if (!m[p]) { m[p] = { n: 0, href: raw }; order.push(p); } // navigate with the raw path that worked when commented
      m[p].n++;
    }
    return { m: m, order: order };
  };
  var closePages = function () { if (pagesPop) { pagesPop.remove(); pagesPop = null; } };
  var openPages = function () {
    var o = otherPages();
    if (!o.order.length) return;
    pagesPop = document.createElement('div');
    pagesPop.id = 'rpz-pages';
    pagesPop.className = 'rpz';
    o.order.sort().forEach(function (p) {
      var b = document.createElement('button');
      b.textContent = p;
      var s = document.createElement('span');
      s.textContent = o.m[p].n;
      b.appendChild(s);
      b.addEventListener('click', function () { location.href = o.m[p].href; });
      pagesPop.appendChild(b);
    });
    var barTop = document.getElementById('rpz-bar').getBoundingClientRect().top;
    pagesPop.style.bottom = (window.innerHeight - barTop + 8) + 'px';
    document.body.appendChild(pagesPop);
  };
  var renderPages = function () {
    if (!pagesBtn) return;
    var o = otherPages(), total = 0;
    o.order.forEach(function (p) { total += o.m[p].n; });
    pagesBtn.style.display = o.order.length ? '' : 'none';
    pagesBtn.textContent = '🗂 ' + total + ' on ' + o.order.length + ' page' + (o.order.length === 1 ? '' : 's');
    closePages();
  };
```

(Task 2's `var renderPages = function () {};` stub is deleted here.)

- [x] **Step 4: Close popup on outside click** — in the existing document click handler (`reviewplz.js:436-441`), `closeCards();` line becomes:

```js
    closeCards(); // any click outside the widget closes an open comment card
    closePages();
```

And in the `t.closest('.rpz')` early-return branch keep popup open only for clicks inside bar/popup — no change needed (popup is `.rpz`, clicks inside it are handled by its own listeners).

- [x] **Step 5: Gate copy** — add one list item after the Device line (`reviewplz.js:410`)

```js
      '<li>🗂 <b>Pages</b> — comments stay on the page you drop them; the toolbar lists the rest.</li>' +
```

- [x] **Step 6: Size check**

Run: `gzip -c reviewplz.js | wc -c` — expect < 10240.

- [x] **Step 7: Commit**

```bash
git add reviewplz.js && git commit -m "Toolbar pages chip: per-page counts + jump to commented pages (issue #1)"
```

### Task 4: Example second page

**Files:**
- Modify: `example/index.html` (nav links)
- Create: `example/about.html`

**Interfaces:** none.

- [x] **Step 1: Real nav in index.html** — replace `<nav>Product · Pricing · About</nav>` with

```html
<nav><a href="index.html">Home</a> · <a href="about.html">About</a></nav>
```

- [x] **Step 2: Create about.html** — same skeleton/styles as index (copy head), body:

```html
<body>
  <header><b>Acme</b><nav><a href="index.html">Home</a> · <a href="about.html">About</a></nav></header>
  <section>
    <h1>About page</h1>
    <p class="lead">Navigate here from the home page while reviewing — the board follows you without re-pasting <code>?review=</code>. Comments dropped here stay here.</p>
    <p class="hint">Drop a comment on this page, go back Home, and use the 🗂 pages chip in the toolbar to jump back.</p>
  </section>
  <section>
    <h2>Team</h2>
    <div class="grid">
      <div class="card"><h2 style="font-size:20px">Ada</h2><p>Founder.</p></div>
      <div class="card"><h2 style="font-size:20px">Grace</h2><p>Engineering.</p></div>
    </div>
  </section>
  <footer>Reviewplz demo · MIT</footer>
  <script src="../reviewplz.js" data-api="/api" data-accent="#4F46E5" data-ignore="header"></script>
</body>
```

- [x] **Step 3: Commit**

```bash
git add example/ && git commit -m "Example: second page + nav to exercise multi-page review (issue #1)"
```

### Task 5: Assemble local stack

**Files:** scratchpad only (`$SCRATCH/e2e/`), nothing committed.

**Interfaces:**
- Produces: running stack at `http://localhost:40201/example/?review=demo`, local D1 with schema + one legacy row.

- [x] **Step 1: Assemble dir**

```bash
S=/private/tmp/claude-501/-Users-rafarj-code-reviewplz-worktrees-1-multipage-v1/72b0e3a0-8191-4817-b99f-869134f68614/scratchpad/e2e
R=/Users/rafarj/code/reviewplz-worktrees/1-multipage-v1
rm -rf "$S" && mkdir -p "$S/public/example"
cp "$R/reviewplz.js" "$S/public/"
cp "$R"/example/*.html "$S/public/example/"
cp -R "$R/server/cloudflare/functions" "$S/"
cat > "$S/wrangler.toml" <<'EOF'
name = "reviewplz-e2e"
pages_build_output_dir = "public"
compatibility_date = "2026-01-01"

[[d1_databases]]
binding = "DB"
database_name = "reviewplz"
database_id = "reviewplz-local"
EOF
```

- [x] **Step 2: Schema + legacy seed into local D1**

```bash
cd "$S"
npx wrangler d1 execute reviewplz --local --file="$R/server/cloudflare/schema.sql"
npx wrangler d1 execute reviewplz --local --command "INSERT INTO comments (id,board,x,y,path,text,author,ts) VALUES ('legacy1','demo-desktop',50,8,NULL,'Legacy note, no path','Old Widget',1700000000000)"
```

- [x] **Step 3: Start + verify server**

```bash
cd "$S" && npx wrangler pages dev --port 40201   # background
curl -s http://localhost:40201/api/comments?board=demo-desktop   # expect JSON array with legacy1
curl -s -o /dev/null -w '%{http_code}' http://localhost:40201/example/   # expect 200
```

If `pages dev` does not share the d1 state dir with `d1 execute`, re-run the schema/seed through the running instance's persistence dir (`--persist-to` on both commands, same path).

### Task 6: E2E acceptance checks (browser)

**Files:** none (evidence: screenshots + curl output for PR body).

Checks map 1:1 to issue #1 acceptance criteria. Run in scripted browser (superpowers-chrome). All on `http://localhost:40201`.

- [x] **C1 nav survival:** open `/example/?review=demo`, enter name, click About link → widget bar present on `/example/about.html` without param. Exit ✕ on About → widget gone; reload → still gone (storage cleared).
- [x] **C2 scoping:** re-activate. Comment on Home ("home pin"). Go About: home pin absent. Comment About ("about pin"). Back Home: only home pin + legacy pin. `curl /api/comments?board=demo-desktop` shows both rows with distinct `path`.
- [x] **C3 other-page visibility:** on Home, chip shows `1 on 1 page`; click → popup lists about path; click it → lands on About with about pin rendered.
- [x] **C4 legacy:** `legacy1` (path NULL) pin renders on Home AND About.
- [x] **C5 device split:** in desktop viewport, `curl .../api/comments?board=demo-mobile` → `[]` (desktop comments never leak to mobile board). Toggle device button still opens preview iframe with param in src.
- [x] **C6 size:** `gzip -c reviewplz.js | wc -c` < 10240.
- [x] **C7 server untouched:** `git diff main -- server/` empty.
- [x] Console: no errors on either page.
- [x] Fix anything failing, re-run failed check, then commit fixes.

### Task 7: Review + PR

- [x] **Step 1:** superpowers:requesting-code-review on full branch diff; fix legit findings; re-run affected checks.
- [x] **Step 2:** Push branch, open PR against `main`:

```bash
git push -u origin 1-multipage-v1
gh pr create --repo rafarc21/reviewplz --base main --title "Multi-page review: board survives navigation, comments scope to page (fixes #1)" --body "<criterion→evidence table, size numbers, repro steps>"
```

- [x] **Step 3:** Report to CTO terminal (briefing command), fallback `.context/REPORT.md`.
