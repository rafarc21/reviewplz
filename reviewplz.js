/*!
 * Reviewplz — a self-hosted, Figma-style review/comment overlay for any website.
 * One drop-in <script>. Activates only when the URL has ?review=<board>.
 * https://github.com/rafarc21/reviewplz  •  MIT
 *
 * Usage:
 *   <script src="reviewplz.js"
 *           data-api="/api"            // base path for the comments/replies API
 *           data-param="review"        // activation query param
 *           data-accent="#E5484D"      // brand colour
 *           data-ignore="#site-header, .cookie-bar"  // selectors that never take a comment
 *   ></script>
 *
 * Then open any page as  https://yoursite.com/?review=<board-name>
 */
(function () {
  'use strict';

  // ── config: data-* attributes on the <script>, or a window.REVIEWPLZ object ──
  var s = document.currentScript || document.querySelector('script[data-reviewplz]');
  var d = (s && s.dataset) || {};
  var g = window.REVIEWPLZ || {};
  var cfg = {
    param: d.param || g.param || 'review',
    api: String(d.api || g.api || '/api').replace(/\/+$/, ''),
    accent: d.accent || g.accent || '#E5484D',
    ink: d.ink || g.ink || '#16181D',
    font: d.font || g.font || 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    ignore: d.ignore || g.ignore || '', // extra selectors that should never receive a comment
    breakpoint: parseInt(d.breakpoint || g.breakpoint || 860, 10),
  };

  var params = new URLSearchParams(location.search);
  var rawBoard = params.get(cfg.param);
  var SKEY = 'rpz-board';
  var inPreview = false; // navigated inside our own device-preview iframe (param lost, frame identity kept)
  try { inPreview = !!(window.frameElement && window.frameElement.closest('#rpz-preview')); } catch (e) {}
  try {
    if (rawBoard) {
      sessionStorage.setItem(SKEY, rawBoard); // param wins; refresh the stored board
    } else if (window.self === window.top || inPreview) { // other iframes need the explicit param
      rawBoard = sessionStorage.getItem(SKEY);
      if (rawBoard && window.self === window.top) { // re-sync URL so a copied link re-activates the board
        params.set(cfg.param, rawBoard);
        history.replaceState(null, '', location.pathname + '?' + params.toString() + location.hash);
      }
    }
  } catch (e) { /* storage blocked → param-only behavior */ }
  if (!rawBoard) return; // inert unless activated by param or stored board

  var reviewId = rawBoard;
  var framed = params.has('framed') || inPreview; // running inside the device-preview iframe
  var ACCENT = cfg.accent, INK = cfg.ink, FONT = cfg.font;
  var tint = function (pct) { return 'color-mix(in srgb, ' + ACCENT + ' ' + pct + '%, #fff)'; };

  // ── styles (scoped to the rpz- prefix; uses your accent/ink/font) ──
  var css = [
    '.rpz{box-sizing:border-box}',
    '.rpz-pin{position:absolute;transform:translate(-50%,-100%);width:30px;height:30px;border-radius:50% 50% 50% 2px;background:' + ACCENT + ';color:#fff;font:700 13px/30px ' + FONT + ';text-align:center;box-shadow:0 4px 14px rgba(0,0,0,.35);cursor:pointer;pointer-events:auto}',
    '.rpz-card{position:absolute;transform:translate(-50%,8px);width:262px;max-height:62vh;overflow-y:auto;background:#fff;color:' + INK + ';border-radius:12px;box-shadow:0 18px 50px rgba(0,0,0,.3);padding:12px 14px;font:400 14px/1.5 ' + FONT + ';pointer-events:auto}',
    '.rpz-card .who{font-weight:700;font-size:12px}',
    '.rpz-card .when{color:#6B7078;font-size:11px;margin-bottom:6px}',
    '.rpz-card .tx{font-size:14px}',
    '.rpz-thread{display:flex;flex-direction:column;gap:9px;margin-top:10px}',
    '.rpz-thread .rep-item{border-left:2px solid ' + tint(30) + ';padding-left:9px}',
    '.rpz-thread .rh{display:flex;gap:6px;align-items:baseline}',
    '.rpz-thread .ra{font-weight:700;font-size:11px}',
    '.rpz-thread .rw{color:#9AA0A6;font-size:10px}',
    '.rpz-thread .rt{font-size:13px;line-height:1.45}',
    '.rpz-card .rep{width:100%;height:52px;resize:none;border:1.5px solid #E3E3E5;border-radius:8px;padding:8px;font:400 13px ' + FONT + ';outline:none;margin-top:10px}',
    '.rpz-card .rep:focus{border-color:' + ACCENT + '}',
    '.rpz-card .row{display:flex;gap:8px;margin-top:8px}',
    '.rpz-card .row button{flex:1;border:0;cursor:pointer;border-radius:7px;padding:8px;font:700 12px ' + FONT + '}',
    '.rpz-card .row .reply{background:' + ACCENT + ';color:#fff}',
    '.rpz-card .row .del{background:' + tint(12) + ';color:' + ACCENT + '}',
    '#rpz-gate{position:fixed;inset:0;z-index:2147483647;background:rgba(11,13,17,.82);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:24px;font-family:' + FONT + '}',
    '#rpz-gate .g{width:384px;max-width:92vw;background:#fff;color:' + INK + ';border-radius:18px;padding:26px 26px 22px;box-shadow:0 40px 100px rgba(0,0,0,.5)}',
    '#rpz-gate h3{margin:0 0 6px;font:800 20px/1.2 ' + FONT + '}',
    '#rpz-gate p{margin:0 0 16px;font-size:14px;color:#5B6168;line-height:1.5}',
    '#rpz-gate ul{list-style:none;margin:0 0 18px;padding:0;display:flex;flex-direction:column;gap:9px}',
    '#rpz-gate li{font-size:13px;color:#33373C;line-height:1.4}',
    '#rpz-gate input{width:100%;border:1.5px solid #E3E3E5;border-radius:10px;padding:12px 14px;font:600 15px ' + FONT + ';outline:none}',
    '#rpz-gate input:focus{border-color:' + ACCENT + '}',
    '#rpz-gate button{width:100%;margin-top:12px;border:0;cursor:pointer;border-radius:10px;padding:13px;background:' + ACCENT + ';color:#fff;font:700 14px ' + FONT + '}',
    '#rpz-gate button:disabled{opacity:.5;cursor:not-allowed}',
    '#rpz-bar{position:fixed;left:16px;bottom:16px;z-index:2147483647;display:flex;align-items:center;gap:9px;background:#0B0D11;color:#fff;border-radius:14px;padding:9px 9px 9px 14px;font:600 13px ' + FONT + ';box-shadow:0 10px 30px rgba(0,0,0,.4);flex-wrap:wrap;max-width:calc(100vw - 32px)}',
    '#rpz-bar .chip{background:rgba(255,255,255,.12);border-radius:7px;padding:4px 8px;font-size:12px}',
    '#rpz-bar .chip b{color:#fff}',
    '#rpz-bar input{background:rgba(255,255,255,.12);border:0;color:#fff;border-radius:8px;padding:6px 9px;font:600 13px ' + FONT + ';width:100px}',
    '#rpz-bar #rpz-dev{border:0;cursor:pointer;border-radius:999px;padding:8px 12px;font:700 12px ' + FONT + ';background:rgba(255,255,255,.16);color:#fff}',
    '#rpz-bar #rpz-exit{border:0;cursor:pointer;border-radius:999px;padding:8px 10px;font:700 12px ' + FONT + ';background:rgba(255,255,255,.16);color:#fff}',
    '#rpz-bar #rpz-pgs{border:0;cursor:pointer;border-radius:999px;padding:8px 12px;font:700 12px ' + FONT + ';background:rgba(255,255,255,.16);color:#fff}',
    '#rpz-pages{position:fixed;left:16px;z-index:2147483647;background:#0B0D11;color:#fff;border-radius:12px;padding:6px;font:600 12px ' + FONT + ';box-shadow:0 10px 30px rgba(0,0,0,.4);display:flex;flex-direction:column;gap:2px;max-height:40vh;overflow-y:auto;min-width:200px}',
    '#rpz-pages button{border:0;cursor:pointer;background:none;color:#fff;text-align:left;border-radius:8px;padding:7px 10px;font:600 12px ' + FONT + ';display:flex;gap:12px;justify-content:space-between;align-items:baseline}',
    '#rpz-pages button:hover{background:rgba(255,255,255,.14)}',
    '#rpz-pages button span{color:#9AA0A6;font-weight:600}',
    '#rpz-bar #rpz-mode{border:0;cursor:pointer;border-radius:999px;padding:8px 14px;font:700 12px ' + FONT + ';background:' + ACCENT + ';color:#fff}',
    '#rpz-bar #rpz-mode.off{background:rgba(255,255,255,.16)}',
    '#rpz-composer{position:fixed;z-index:2147483000;width:250px;background:#fff;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.4);padding:12px}',
    '#rpz-composer textarea{width:100%;height:76px;resize:none;border:1.5px solid #E3E3E5;border-radius:8px;padding:9px;font:400 14px ' + FONT + ';outline:none}',
    '#rpz-composer textarea:focus{border-color:' + ACCENT + '}',
    '#rpz-composer .row{display:flex;gap:8px;margin-top:8px}',
    '#rpz-composer .row button{flex:1;border:0;cursor:pointer;border-radius:8px;padding:9px;font:700 13px ' + FONT + '}',
    '#rpz-composer .save{background:' + ACCENT + ';color:#fff}',
    '#rpz-composer .cancel{background:#F2F2F4;color:' + INK + '}',
    '#rpz-preview{position:fixed;inset:0;z-index:2147483640;background:rgba(8,9,12,.95);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:16px}',
    '#rpz-preview .frame{background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 30px 90px rgba(0,0,0,.55);display:flex;flex-direction:column;max-width:96vw;max-height:92vh}',
    '#rpz-preview .bar2{font:700 13px ' + FONT + ';color:' + INK + ';padding:10px 14px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #ECECEC;flex:0 0 auto}',
    '#rpz-preview .bar2 .x2{margin-left:auto;border:0;background:#F2F2F4;border-radius:7px;padding:6px 12px;font:700 12px ' + FONT + ';cursor:pointer}',
    '#rpz-preview .scroll{overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;max-width:100%}',
    '#rpz-preview iframe{border:0;display:block;background:#fff;height:84vh}',
  ].join('');
  var styleEl = document.createElement('style');
  styleEl.id = 'rpz-style';
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // ── state ──
  var naturalDev = function () { return window.innerWidth < cfg.breakpoint ? 'mobile' : 'desktop'; };
  var device = naturalDev();
  var board = rawBoard + '-' + device;
  var apiUrl = function () { return cfg.api + '/comments?board=' + encodeURIComponent(board); };
  var normPath = function (p) {
    p = p.replace(/\/index\.html?$/, '/'); // /a/index.html ≡ /a/
    return p.length > 1 ? p.replace(/\/+$/, '') : p; // trailing slash off, root stays '/'
  };
  var pagePath = normPath(location.pathname);
  var onPage = function (c) { return !c.path || normPath(c.path) === pagePath; }; // no path → legacy, every page
  var allComments = [];
  var name = localStorage.getItem('rpz-name') || '';
  var adding = true;
  var composer = null;
  var count = 0;
  var closeComposer = function () { if (composer) { composer.remove(); composer = null; } };

  // ── element anchoring helpers ──
  var PIN_Z = 2147483000;
  var cssEsc = function (str) { return window.CSS && CSS.escape ? CSS.escape(str) : str.replace(/[^a-zA-Z0-9_-]/g, '\\$&'); };
  var cssPath = function (el) {
    if (!el || el.nodeType !== 1) return '';
    if (el.id && document.querySelectorAll('#' + cssEsc(el.id)).length === 1) return '#' + cssEsc(el.id);
    var parts = [];
    var n = el;
    while (n && n.nodeType === 1 && n !== document.body && parts.length < 7) {
      if (n.id) { parts.unshift('#' + cssEsc(n.id)); break; }
      var sel = n.tagName.toLowerCase();
      var p = n.parentElement;
      if (p) {
        var same = Array.prototype.filter.call(p.children, function (c) { return c.tagName === n.tagName; });
        if (same.length > 1) sel += ':nth-of-type(' + (same.indexOf(n) + 1) + ')';
      }
      parts.unshift(sel);
      n = n.parentElement;
    }
    return parts.join('>');
  };
  var findEl = function (sel) { if (!sel) return null; try { return document.querySelector(sel); } catch (e) { return null; } };
  var isVisible = function (el) {
    var st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden') return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  // walk ancestors: is el in a fixed context, and is that a full-screen overlay?
  var overlayInfo = function (el) {
    var n = el, z = 0, fixed = false;
    while (n && n !== document.body) {
      var st = getComputedStyle(n);
      if (st.position === 'fixed') {
        fixed = true;
        var r = n.getBoundingClientRect();
        if (r.width >= window.innerWidth * 0.5 && r.height >= window.innerHeight * 0.3) {
          var zz = parseInt(st.zIndex, 10);
          z = Math.max(z, Number.isFinite(zz) ? zz : 1);
        }
      }
      n = n.parentElement;
    }
    return { z: z, fixed: fixed };
  };
  var isOurs = function (el) { return !!(el.id && el.id.indexOf('rpz-') === 0) || !!(el.closest && el.closest('.rpz')); };
  var topOverlayZ = function () {
    var max = 0, all = document.body.getElementsByTagName('*');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (isOurs(el)) continue;
      var st = getComputedStyle(el);
      if (st.position !== 'fixed') continue;
      if (st.display === 'none' || st.visibility === 'hidden' || st.opacity === '0') continue;
      var r = el.getBoundingClientRect();
      if (r.width < window.innerWidth * 0.5 || r.height < window.innerHeight * 0.3) continue;
      var z = parseInt(st.zIndex, 10);
      if (Number.isFinite(z) && z > max) max = z;
    }
    return max;
  };
  var computeZ = function () { var o = topOverlayZ(); return o > 0 ? Math.max(1, o - 1) : PIN_Z; };

  // ── notes registry + positioning ──
  var recs = [];
  var clearPins = function () { recs.forEach(function (r) { r.pin.remove(); if (r.card) r.card.remove(); }); recs = []; };
  var renumber = function () { recs.forEach(function (r, i) { r.pin.textContent = String(i + 1); }); };
  var closeCards = function () { recs.forEach(function (r) { if (r.card) { r.card.remove(); r.card = null; } }); };

  var placeNode = function (node, pos, left, top, z) {
    node.style.position = pos; node.style.left = left + 'px'; node.style.top = top + 'px'; node.style.zIndex = z; node.style.display = '';
  };

  function positionAll(scrolling) {
    var pageZ = String(computeZ());
    for (var i = 0; i < recs.length; i++) {
      var rec = recs[i], c = rec.c;
      var el = findEl(c.sel);
      var fx = c.fx == null ? 0.5 : c.fx;
      var fy = c.fy == null ? 0 : c.fy;
      if (el && isVisible(el)) {
        var r = el.getBoundingClientRect();
        var ov = overlayInfo(el);
        var z = ov.z > 0 ? String(ov.z + 1) : pageZ;
        if (ov.fixed) {
          placeNode(rec.pin, 'fixed', r.left + fx * r.width, r.top + fy * r.height, z);
        } else {
          if (scrolling) continue; // page notes are absolute; the browser handles scroll
          placeNode(rec.pin, 'absolute', r.left + scrollX + fx * r.width, r.top + scrollY + fy * r.height, z);
        }
      } else if (c.sel) {
        rec.pin.style.display = 'none'; // anchored element gone/hidden (e.g. modal closed)
      } else {
        if (scrolling) continue; // legacy note (no anchor) → percent-of-document fallback
        var de = document.documentElement;
        placeNode(rec.pin, 'absolute', ((c.x || 0) / 100) * de.scrollWidth, ((c.y || 0) / 100) * de.scrollHeight, pageZ);
      }
      if (rec.card) {
        rec.card.style.position = rec.pin.style.position;
        rec.card.style.left = rec.pin.style.left;
        rec.card.style.top = rec.pin.style.top;
        rec.card.style.zIndex = rec.pin.style.zIndex;
        rec.card.style.display = rec.pin.style.display;
      }
    }
    if (composer) composer.style.zIndex = composer.dataset.az || pageZ;
  }

  var raf = 0;
  var schedule = function (scrolling) {
    if (raf) return;
    raf = requestAnimationFrame(function () { raf = 0; positionAll(scrolling); });
  };
  window.addEventListener('scroll', function () { schedule(true); }, { passive: true });
  window.addEventListener('resize', function () { schedule(false); });
  new MutationObserver(function () { schedule(false); }).observe(document.body, {
    subtree: true, childList: true, attributes: true,
    attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'open'],
  });
  setInterval(function () { schedule(false); }, 700); // safety: late media/layout shifts

  // ── single toolbar (top window only) ──
  var nameInput = null, modeBtn = null, countEl = null, devBtn = null, pagesBtn = null, pagesPop = null;

  var setCount = function () {
    if (countEl) countEl.textContent = count + (count === 1 ? ' comment' : ' comments');
    if (framed) parent.postMessage({ rpz: 'count', v: count }, '*');
  };
  var refreshCount = function () { count = recs.length; setCount(); };

  var preview = null, previewDev = null, previewFrame = null;
  var viewedDev = function () { return previewDev || naturalDev(); };
  // label shows the device you'll switch TO (opposite of what you're viewing)
  var renderDev = function () { if (devBtn) devBtn.textContent = viewedDev() === 'mobile' ? '🖥 Desktop' : '📱 Mobile'; };
  var relayName = function () { if (previewFrame && previewFrame.contentWindow) previewFrame.contentWindow.postMessage({ rpz: 'name', v: name }, '*'); };
  var relayMode = function () { if (previewFrame && previewFrame.contentWindow) previewFrame.contentWindow.postMessage({ rpz: 'mode', v: adding }, '*'); };

  if (!framed) {
    var bar = document.createElement('div');
    bar.id = 'rpz-bar';
    bar.className = 'rpz';
    bar.innerHTML =
      '<span class="chip">Review <b></b></span>' +
      '<button id="rpz-dev"></button>' +
      '<span class="chip" id="rpz-count">0</span>' +
      '<button id="rpz-pgs"></button>' +
      '<input id="rpz-name" placeholder="Your name" />' +
      '<button id="rpz-mode">✏️ Commenting</button>' +
      '<button id="rpz-exit" title="Exit review">✕</button>';
    document.body.appendChild(bar);
    bar.querySelector('.chip b').textContent = rawBoard;

    nameInput = bar.querySelector('#rpz-name');
    nameInput.value = name;
    nameInput.addEventListener('input', function () { name = nameInput.value; localStorage.setItem('rpz-name', name); relayName(); });
    modeBtn = bar.querySelector('#rpz-mode');
    modeBtn.addEventListener('click', function () {
      adding = !adding;
      modeBtn.textContent = adding ? '✏️ Commenting' : '👆 Browsing';
      modeBtn.classList.toggle('off', !adding);
      relayMode();
    });
    countEl = bar.querySelector('#rpz-count');
    devBtn = bar.querySelector('#rpz-dev');
    devBtn.addEventListener('click', toggleDevice);
    renderDev();
    bar.querySelector('#rpz-exit').addEventListener('click', function () {
      if (!confirm('Exit review mode?')) return;
      try { sessionStorage.removeItem(SKEY); } catch (e) {}
      params.delete(cfg.param);
      params.delete('framed');
      history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params.toString() : '') + location.hash);
      location.reload();
    });
    pagesBtn = bar.querySelector('#rpz-pgs');
    pagesBtn.style.display = 'none'; // shown by renderPages when other pages hold comments
    pagesBtn.addEventListener('click', function (e) { e.stopPropagation(); if (pagesPop) closePages(); else openPages(); });

    window.addEventListener('message', function (e) {
      if (e && e.data && e.data.rpz === 'count' && typeof e.data.v === 'number') { count = e.data.v; setCount(); }
    });
  } else {
    window.addEventListener('message', function (e) {
      var dd = e && e.data; if (!dd || dd.rpz == null) return;
      if (dd.rpz === 'name') name = dd.v || '';
      else if (dd.rpz === 'mode') adding = !!dd.v;
    });
  }

  function addPin(c) {
    var pin = document.createElement('div');
    pin.className = 'rpz-pin rpz';
    pin.style.display = 'none'; // positioned on next frame; numbered by renumber()
    var rec = { c: c, pin: pin, card: null };
    pin.addEventListener('click', function (e) {
      e.stopPropagation();
      if (rec.card) { rec.card.remove(); rec.card = null; return; }
      var card = document.createElement('div');
      card.className = 'rpz-card rpz';
      card.innerHTML =
        '<div class="who"></div><div class="when"></div><div class="tx"></div>' +
        '<div class="rpz-thread"></div>' +
        '<textarea class="rep" placeholder="Reply…"></textarea>' +
        '<div class="row"><button class="del">Delete</button><button class="reply">Reply</button></div>';
      card.querySelector('.who').textContent = c.author;
      card.querySelector('.when').textContent = new Date(c.ts).toLocaleString();
      card.querySelector('.tx').textContent = c.text;
      var thread = card.querySelector('.rpz-thread');
      var addReply = function (rp) {
        var it = document.createElement('div');
        it.className = 'rep-item';
        it.innerHTML = '<div class="rh"><span class="ra"></span><span class="rw"></span></div><div class="rt"></div>';
        it.querySelector('.ra').textContent = rp.author;
        it.querySelector('.rw').textContent = new Date(rp.ts).toLocaleString();
        it.querySelector('.rt').textContent = rp.text;
        thread.appendChild(it);
      };
      fetch(cfg.api + '/replies?comment=' + encodeURIComponent(c.id)).then(function (r) { return r.json(); }).then(function (list) { list.forEach(addReply); schedule(false); }).catch(function () {});
      var repTa = card.querySelector('.rep');
      card.querySelector('.reply').addEventListener('click', function () {
        var text = repTa.value.trim();
        if (!text) return;
        fetch(cfg.api + '/replies', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ comment_id: c.id, board: board, text: text, author: name || 'Guest' }) })
          .then(function (r) { return r.json(); })
          .then(function (rp) { addReply(rp); repTa.value = ''; schedule(false); })
          .catch(function () {});
      });
      card.querySelector('.del').addEventListener('click', function (ev) {
        ev.stopPropagation();
        if (!confirm('Delete this comment and its replies?')) return;
        fetch(cfg.api + '/comments', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ board: board, id: c.id }) }).catch(function () {});
        if (rec.card) rec.card.remove();
        pin.remove();
        recs = recs.filter(function (x) { return x !== rec; });
        renumber(); refreshCount();
      });
      card.style.position = pin.style.position || 'absolute';
      card.style.left = pin.style.left; card.style.top = pin.style.top; card.style.zIndex = pin.style.zIndex;
      document.body.appendChild(card);
      rec.card = card;
      schedule(false);
    });
    document.body.appendChild(pin);
    recs.push(rec);
  }

  // ── pages chip: comments living on other pages, grouped by normalized path ──
  var otherPages = function () {
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
      b.addEventListener('click', function () { location.href = o.m[p].href + '?' + encodeURIComponent(cfg.param) + '=' + encodeURIComponent(rawBoard); });
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

  // ── device toggle / preview (top window only) ──
  function fitFrame() {
    if (!preview) return;
    var frameW = previewDev === 'mobile' ? 390 : 1280;
    preview.querySelector('.frame').style.width = Math.min(frameW, Math.floor(window.innerWidth * 0.96)) + 'px';
  }
  function closePreview() {
    if (preview) preview.remove();
    preview = null; previewFrame = null; previewDev = null;
    renderDev();
    loadBoard();
  }
  function openPreview(dev) {
    if (preview) preview.remove();
    previewDev = dev;
    var frameW = dev === 'mobile' ? 390 : 1280;
    var displayW = Math.min(frameW, Math.floor(window.innerWidth * 0.96));
    preview = document.createElement('div');
    preview.id = 'rpz-preview';
    preview.className = 'rpz';
    preview.innerHTML =
      '<div class="frame" style="width:' + displayW + 'px"><div class="bar2">' +
      (dev === 'mobile' ? '📱 Mobile' : '🖥 Desktop') +
      ' — comment directly inside<button class="x2">Close</button></div>' +
      '<div class="scroll"><iframe style="width:' + frameW + 'px" src="' +
      location.pathname + '?' + encodeURIComponent(cfg.param) + '=' + encodeURIComponent(reviewId) + '&framed=1"></iframe></div></div>';
    preview.querySelector('.x2').addEventListener('click', closePreview);
    preview.addEventListener('click', function (e) { if (e.target === preview) closePreview(); });
    document.body.appendChild(preview);
    previewFrame = preview.querySelector('iframe');
    previewFrame.addEventListener('load', function () { relayName(); relayMode(); });
    renderDev();
  }
  function toggleDevice() {
    var target = viewedDev() === 'desktop' ? 'mobile' : 'desktop';
    if (target === naturalDev()) closePreview();
    else openPreview(target);
    renderDev();
  }

  window.addEventListener('resize', function () {
    if (framed) return;
    if (preview) { fitFrame(); return; }
    var nd = naturalDev();
    if (nd !== device) { device = nd; board = rawBoard + '-' + device; loadBoard(); }
    renderDev();
  });

  // first-open identity gate — forces a name so every comment/reply is attributed
  function showGate() {
    var gate = document.createElement('div');
    gate.id = 'rpz-gate';
    gate.className = 'rpz';
    gate.innerHTML =
      '<div class="g">' +
      '<h3></h3>' +
      '<p>Add your name so the team knows who left each comment and reply.</p>' +
      '<ul>' +
      '<li>✏️ <b>Commenting</b> — click anywhere on the page to drop a comment.</li>' +
      '<li>💬 <b>Reply</b> — open any pin to reply to a teammate.</li>' +
      '<li>👆 <b>Browsing</b> — switch off commenting to click through the site normally.</li>' +
      '<li>🖥 / 📱 <b>Device</b> — review desktop and mobile separately.</li>' +
      '<li>🗂 <b>Pages</b> — comments stay on the page you drop them; the toolbar lists the rest.</li>' +
      '</ul>' +
      '<input id="rpz-gname" placeholder="Your name" autocomplete="name" />' +
      '<button id="rpz-go" disabled>Start reviewing</button></div>';
    document.body.appendChild(gate);
    gate.querySelector('h3').textContent = 'Reviewing: ' + rawBoard;
    var gi = gate.querySelector('#rpz-gname');
    var go = gate.querySelector('#rpz-go');
    var sync = function () { go.disabled = !gi.value.trim(); };
    gi.addEventListener('input', sync);
    gi.focus();
    var submit = function () {
      var v = gi.value.trim();
      if (!v) return;
      name = v;
      localStorage.setItem('rpz-name', name);
      if (nameInput) nameInput.value = name;
      gate.remove();
    };
    go.addEventListener('click', submit);
    gi.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
  }

  loadBoard();
  if (!framed && !name) showGate();

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t.closest('.rpz')) { schedule(false); return; } // our own UI handles itself
    closeCards(); // any click outside the widget closes an open comment card
    closePages();
    var ignore = 'a, button, input, textarea, select, summary, label, [data-close]' + (cfg.ignore ? ', ' + cfg.ignore : '');
    if (!adding || t.closest(ignore)) { schedule(false); return; }
    e.preventDefault();
    e.stopPropagation();
    closeComposer();

    var target = t; // anchor to the clicked element (already filtered above)
    var tr = target.getBoundingClientRect();
    var sel = cssPath(target);
    var fx = tr.width ? Math.max(0, Math.min(1, (e.clientX - tr.left) / tr.width)) : 0.5;
    var fy = tr.height ? Math.max(0, Math.min(1, (e.clientY - tr.top) / tr.height)) : 0;
    var x = (e.pageX / document.documentElement.scrollWidth) * 100; // fallback
    var y = (e.pageY / document.documentElement.scrollHeight) * 100; // fallback
    var ov = overlayInfo(target);

    composer = document.createElement('div');
    composer.id = 'rpz-composer';
    composer.className = 'rpz';
    if (ov.z > 0) composer.dataset.az = String(ov.z + 1); // commenting on a modal → keep composer above it
    composer.style.left = Math.min(e.clientX, window.innerWidth - 266) + 'px';
    composer.style.top = Math.min(e.clientY, window.innerHeight - 160) + 'px';
    composer.innerHTML = '<textarea placeholder="Leave a comment…"></textarea><div class="row"><button class="cancel">Cancel</button><button class="save">Comment</button></div>';
    document.body.appendChild(composer);
    composer.style.zIndex = composer.dataset.az || String(computeZ());
    var ta = composer.querySelector('textarea');
    ta.focus();
    composer.querySelector('.cancel').addEventListener('click', closeComposer);
    composer.querySelector('.save').addEventListener('click', function () {
      var text = ta.value.trim();
      if (!text) return;
      fetch(cfg.api + '/comments', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ board: board, x: x, y: y, sel: sel, fx: fx, fy: fy, text: text, author: name || 'Guest', path: location.pathname }),
      })
        .then(function (r) { return r.json(); })
        .then(function (c) { addPin(c); renumber(); refreshCount(); schedule(false); })
        .catch(function () {});
      closeComposer();
    });
  }, true);

  window.addEventListener('load', function () { schedule(false); });
  setTimeout(function () { schedule(false); }, 1500);
})();
