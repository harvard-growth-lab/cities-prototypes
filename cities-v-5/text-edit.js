/* Text editing for the development phase. Off unless the URL has ?edit.

   With ?edit, the headings, ledes and chart readings in each page's text
   column become editable in place. The city name and glossary terms stay
   fixed inside the text, so the city switcher and the term cards keep
   working. Edits are kept in this browser (localStorage) and applied again
   on reload, only while ?edit is on; the page without ?edit is the source
   as committed.

   Static or dynamic: text is static unless marked. Select words and choose
   "Make dynamic" to mark them as text that changes with the data. A dynamic
   part is one of two kinds, both tied to the data manifest
   (data-manifest.js, a snapshot of the sheet made by tools/data-manifest.py):
   - a value: a field of a manifest metric ("348K" = employed,
     place_panel.parquet), or a calculation on several fields
     ("2.4 times" = value_place / value_metro, with how to compute each), and
     the format it is shown in;
   - a condition: every wording the part can take, each with the condition
     on manifest fields under which it is the one shown ("above" when
     wage_nowcast > wage_nowcast_n, "below" otherwise).
   The part is highlighted; a click opens its panel. City names are already
   dynamic (the city switcher sets them) and are underlined to say so.

   Shared editing: when text-edit-config.js names a Firebase project, every
   editor signs in with Google and works on one live copy (text-sync.js).
   Changes show for everyone as they are typed; text someone is in is closed
   to the others until they leave it; every change goes into a history, and
   any can be restored. Without a project, edits stay in this browser and
   travel by "Share link" (?te=…) or a file ("Download", "Import").
   "Copy changes" puts each before/after on the clipboard to carry back into
   index.html.

   Loaded as a plain script after the page markup and before the page
   logic, so saved edits are in place before any chart reads its template. */
(function () {
  "use strict";
  if (!/[?&]edit\b/.test(location.search)) return;

  var KEY = "cities-v5-text-edits";
  var ROOTS = "section.page, .ov-block";
  var TARGETS = ".page-head h2, .page > h2, .subsection-header h3, p.lede, .ask-a, .intro-q";
  var LOCKED = ".city-short, .term, button, svg, .te-dyn";
  var EDITABLE = "[data-te], [data-te-tpl]";

  /* Shared when text-edit-config.js names a Firebase project: the edits
     then live in one copy that every signed-in editor sees change live
     (text-sync.js), and this browser's storage only holds what was made
     before, until it is added to the shared copy. */
  var CFG = window.TE_FIREBASE, SHARED = !!(CFG && CFG.apiKey);
  /* edits: { key: { before, after } }, the element's markup before and after */
  var edits = SHARED ? {} : parse(readStore(), false), stale = {}, orig = {};
  var leftover = SHARED ? parse(readStore(), false) : null;
  function readStore() { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } }
  function store() { if (SHARED) return; try { localStorage.setItem(KEY, JSON.stringify(edits)); } catch (e) {} }
  /* only well-formed entries are kept; markup from a link or a file is made inert first */
  function parse(raw, imported) {
    var out = {};
    if (raw && typeof raw === "object") Object.keys(raw).forEach(function (k) {
      var e = raw[k];
      if (e && typeof e.before === "string" && typeof e.after === "string") out[k] = { before: e.before, after: imported ? inert(e.after) : e.after };
    });
    return out;
  }
  function inert(html) {
    var t = document.createElement("template"); t.innerHTML = html;
    t.content.querySelectorAll("script, style, iframe, object, embed, link, meta, base, form, animate, set").forEach(function (n) { n.remove(); });
    t.content.querySelectorAll("*").forEach(function (n) {
      [].slice.call(n.attributes).forEach(function (a) {
        if (/^on/i.test(a.name) || (/(href|src|action)$/i.test(a.name) && /^\s*(javascript|data|vbscript):/i.test(a.value))) n.removeAttribute(a.name);
      });
    });
    return t.innerHTML;
  }
  /* the editor's own attributes never reach what is saved or compared */
  function clean(html) { return String(html).replace(/\s+contenteditable="false"/g, "").replace(/ te-open\b/g, ""); }
  function norm(html) { return clean(html).replace(/\s+/g, " ").trim(); }
  function frag(html) { var t = document.createElement("template"); t.innerHTML = clean(html); return t.content; }
  function plain(html) { return norm(frag(html).textContent); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /* ---------- Dynamic parts ----------
     The span's text is what shows now (for the city on screen).
     A value:     <span class="te-dyn" data-te-kind="value" data-te-format="number"
                    data-te-field='{"row":6,"metric":"…","level":"Admin","years":"2024",
                                    "column":"employed","file":"place_panel.parquet"}'>348K</span>
     Calculated:  <span class="te-dyn" data-te-kind="value" data-te-format="times"
                    data-te-uses='[{"row":8,…,"column":"value","file":"place_housing.parquet","as":"value_place"},
                                   {"row":8,…,"column":"value","file":"metro_housing.parquet","as":"value_metro"}]'
                    data-te-calc='{"formula":"value_place / value_metro",
                                   "notes":"latest year; national = metros weighted by population"}'>2.4 times</span>
     A condition: <span class="te-dyn" data-te-kind="condition"
                    data-te-uses='[{"row":7,…,"column":"wage_nowcast","file":"…","as":"wage_nowcast"}, …]'
                    data-te-opts='[{"text":"above","when":"wage_nowcast > wage_nowcast_n"},
                                   {"text":"below","when":""}]'>above</span>
     A wording with no condition is the one shown otherwise. Formulas and
     conditions name fields by their "as", which is unique within the part
     (the same column can come from two files). */
  var FORMATS = [["", "As written"], ["number", "Number, short (348K)"], ["percent", "Percent (74%)"], ["times", "Times (2.4 times)"],
    ["money", "Money, short ($717K)"], ["rank", "Rank (10th)"], ["change", "Change (+3.2%)"]];
  function getJ(d, attr, def) { try { var v = JSON.parse(d.getAttribute(attr)); return v == null ? def : v; } catch (e) { return def; } }
  function setJ(d, attr, v) { d.setAttribute(attr, JSON.stringify(v)); }
  function kindOf(d) { return d.getAttribute("data-te-kind") === "value" ? "value" : "condition"; }
  /* the wordings, the one shown always among them (older parts kept plain strings) */
  function opts(d) {
    var o = getJ(d, "data-te-opts", []);
    o = (Array.isArray(o) ? o : []).map(function (x) { return typeof x === "string" ? { text: x, when: "" } : { text: String(x.text || ""), when: String(x.when || "") }; });
    var shown = norm(d.textContent);
    if (!o.some(function (x) { return x.text === shown; })) o.unshift({ text: shown, when: "" });
    return o;
  }
  function fieldName(f) { return f.column + (f.file ? " (" + f.file + ")" : ""); }
  function aliasOf(u) { return u.as || u.column; }
  /* older parts kept the format inside data-te-field */
  function fmtOf(d) { var v = d.getAttribute("data-te-format"); if (v != null) return v; var f = getJ(d, "data-te-field", null); return (f && f.format) || ""; }
  function calcOf(d) { return d.hasAttribute("data-te-calc") ? getJ(d, "data-te-calc", {}) || {} : null; }
  /* a field joins the part under its column name, or column_<file prefix> if that name is taken */
  function addUse(uses, p) {
    if (uses.some(function (u) { return u.column === p.column && u.file === p.file; })) return uses;
    var taken = uses.map(aliasOf), a = p.column;
    if (taken.indexOf(a) >= 0 && p.file) a = p.column + "_" + p.file.split(/[_.]/)[0];
    var base = a, n = 2;
    while (taken.indexOf(a) >= 0) a = base + "_" + n++;
    p.as = a; uses.push(p);
    return uses;
  }
  function usesText(uses) {
    return uses.map(function (u) { return aliasOf(u) + " = " + fieldName(u) + ", " + [u.level, u.years].filter(Boolean).join(" ") + " [manifest row " + u.row + "]"; }).join("; ");
  }
  function formatName(v) { var hit = FORMATS.filter(function (f) { return f[0] === v; })[0]; return hit ? hit[1] : v; }
  /* for Copy changes:
     {value: employed (place_panel.parquet), Admin 2024 [manifest row 6: …], as Number; now "348K"}
     {value calculated as value_place / value_metro where value_place = …; value_metro = …, as Times; how: …; now "2.4 times"}
     {condition where wage_nowcast = …: "above" when …; "below" otherwise} */
  function describe(d) {
    var uses = getJ(d, "data-te-uses", []);
    if (kindOf(d) === "value") {
      var fmt = fmtOf(d), as = fmt ? ", as " + formatName(fmt) : "", now = "; now \"" + norm(d.textContent) + "\"}", c = calcOf(d);
      if (c) return "{value calculated as " + (c.formula || "(no calculation written yet)") + (uses.length ? " where " + usesText(uses) : "") + as + (c.notes ? "; how: " + c.notes.replace(/[.\s]+$/, "") : "") + now;
      var f = getJ(d, "data-te-field", null);
      if (!f || !f.column) return "{value: no field chosen yet" + now;
      return "{value: " + fieldName(f) + ", " + [f.level, f.years].filter(Boolean).join(" ") + " [manifest row " + f.row + ": " + f.metric + "]" + as + now;
    }
    return "{condition" + (uses.length ? " where " + usesText(uses) : "") + ": " + opts(d).map(function (o) {
      return "\"" + o.text + "\" " + (o.when ? "when " + o.when : "otherwise");
    }).join("; ") + "}";
  }
  function readable(html) {
    var f = frag(html);
    f.querySelectorAll(".te-dyn").forEach(function (d) { d.textContent = describe(d); });
    return norm(f.textContent);
  }

  /* ---------- Which text, and its key ----------
     A key is the id of the page or block plus the element's place among the
     editable elements in it ("page-overview:2"). Template readings are keyed
     by their measure ("page-overview-scatter:says:wage"). */
  function rootOf(el) { var r = el.closest(ROOTS); while (r && !r.id) r = r.parentElement && r.parentElement.closest(ROOTS); return r; }
  function targets() {
    var out = [];
    document.querySelectorAll(TARGETS).forEach(function (el) {
      if (el.closest("template, .sc-say, .who-sc-note")) return;
      var r = rootOf(el); if (!r) return;
      out.push(el);
    });
    return out;
  }
  function keyed() {
    var count = {}, list = [];
    targets().forEach(function (el) {
      var r = rootOf(el), n = count[r.id] = (count[r.id] || 0) + 1;
      list.push({ el: el, key: r.id + ":" + n, where: r.id });
    });
    document.querySelectorAll("template.who-sc-says").forEach(function (t) {
      var r = rootOf(t); if (!r) return;
      t.content.querySelectorAll("[data-m]").forEach(function (p) {
        list.push({ el: p, key: r.id + ":says:" + p.dataset.m, where: r.id + " (reading: " + p.dataset.m + ")", tpl: true });
      });
    });
    return list;
  }

  /* ---------- Apply saved edits ----------
     An edit is applied only if the source still reads as it did when the
     edit was made; otherwise it is kept but marked stale. */
  var items = keyed(), byKey = {};
  items.forEach(function (it) {
    byKey[it.key] = it;
    orig[it.key] = clean(it.el.innerHTML);
    var e = edits[it.key];
    if (!e) return;
    if (norm(it.el.innerHTML) === norm(e.before)) it.el.innerHTML = e.after;
    else if (norm(it.el.innerHTML) !== norm(e.after)) stale[it.key] = true;
  });
  Object.keys(edits).forEach(function (k) { if (!byKey[k]) stale[k] = true; });

  /* ---------- Styles ---------- */
  var DYN = "#7b4fc4";
  var css = document.createElement("style");
  css.textContent =
    "body.te-on [data-te]{outline:1px dashed rgba(37,88,98,.45);outline-offset:3px;border-radius:2px;cursor:text;}" +
    "body.te-on [data-te]:hover{outline-color:#255862;}" +
    "body.te-on [data-te]:focus{outline:2px solid #255862;background:rgba(238,243,244,.9);}" +
    "body.te-on [data-te].te-changed{box-shadow:-6px 0 0 -3px #e7a33e;}" +
    "body.te-on .te-say{outline:1px dashed rgba(37,88,98,.45);outline-offset:3px;cursor:text;}" +
    "body.te-on .te-dyn{background:rgba(123,79,196,.14);box-shadow:inset 0 -1.5px 0 " + DYN + ";border-radius:2px;padding:0 1px;cursor:pointer;}" +
    "body.te-on .te-dyn::after{content:'\\25BE';font-size:.7em;color:" + DYN + ";margin-left:2px;}" +
    "body.te-on .te-dyn:hover, body.te-on .te-dyn.te-open{background:rgba(123,79,196,.28);}" +
    "body.te-on [data-te] .city-short, body.te-on .te-say .city-short{box-shadow:inset 0 -1.5px 0 rgba(123,79,196,.45);}" +
    "body.te-clean [data-te], body.te-clean .te-say{outline:none!important;box-shadow:none!important;background:none!important;}" +
    "body.te-clean .te-dyn, body.te-clean .city-short{background:none!important;box-shadow:none!important;padding:0;}" +
    "body.te-clean .te-dyn::after{content:none;}body.te-clean #teSel{display:none;}" +
    "#teBar, #teSel, #teDyn, #teAsk{font:13px/1.3 'Source Sans 3','Source Sans Pro',sans-serif;color:#fff;background:#1a2226;border-radius:8px;box-shadow:0 8px 28px rgba(0,0,0,.25);z-index:10000;}" +
    "#teBar{position:fixed;left:16px;bottom:16px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;max-width:calc(100vw - 32px);padding:8px 10px;}" +
    "#teBar b{font-weight:700;}#teBar .te-n{color:rgba(255,255,255,.78);}" +
    "#teBar button, #teSel, #teDyn button, #teAsk button{font:inherit;font-weight:600;color:#1a2226;background:#fff;border:0;border-radius:5px;padding:5px 9px;cursor:pointer;}" +
    "#teBar button.te-q, #teDyn button.te-q, #teAsk button.te-q{background:transparent;color:#fff;box-shadow:inset 0 0 0 1px rgba(255,255,255,.4);}" +
    "#teBar button:focus-visible, #teSel:focus-visible, #teDyn :focus-visible, #teAsk button:focus-visible{outline:2px solid #e7a33e;outline-offset:2px;}" +
    "#teSel{position:fixed;background:" + DYN + ";color:#fff;box-shadow:0 4px 14px rgba(0,0,0,.25);}" +
    "#teDyn{position:fixed;width:380px;max-width:calc(100vw - 32px);max-height:calc(100vh - 16px);overflow:auto;padding:10px;display:grid;gap:10px;}" +
    "#teDyn .te-f{display:grid;gap:3px;}#teDyn .te-f>span{color:rgba(255,255,255,.72);font-size:12px;}" +
    "#teDyn select, #teDyn textarea, #teDyn input{font:inherit;color:#1a2226;background:#fff;border:0;border-radius:5px;padding:5px 7px;width:100%;box-sizing:border-box;}" +
    "#teDyn input[type=radio]{width:auto;accent-color:" + DYN + ";}" +
    "#teDyn .te-seg{display:flex;gap:0;border-radius:6px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.4);}" +
    "#teDyn .te-seg button{flex:1;background:transparent;color:#fff;border-radius:6px;}#teDyn .te-seg button[aria-pressed=true]{background:" + DYN + ";}" +
    "#teDyn .te-uses{display:flex;flex-wrap:wrap;gap:6px;}#teDyn .te-uses em{color:rgba(255,255,255,.6);}" +
    "#teDyn .te-chip{display:inline-flex;border-radius:5px;background:rgba(123,79,196,.35);}" +
    "#teDyn .te-chip small{font-weight:400;opacity:.7;}#teDyn .te-man:empty{display:none;}" +
    "#teDyn button.te-link{background:none;color:#fff;padding:0;text-decoration:underline;font-weight:600;font-size:inherit;}" +
    "#teDyn .te-chip button{background:transparent;color:#fff;padding:3px 7px;font-weight:600;}#teDyn .te-chip .te-chip-x{padding:3px 6px 3px 0;opacity:.75;}" +
    "#teDyn .te-add{display:grid;grid-template-columns:1fr 1fr auto;gap:6px;}" +
    "#teDyn .te-opts{display:grid;gap:6px;}#teDyn .te-opt{display:grid;grid-template-columns:auto 1fr 1.4fr auto;gap:6px;align-items:center;}" +
    "#teDyn .te-o-add{justify-self:start;margin-top:6px;}" +
    "#teDyn .te-hint{margin:0;color:rgba(255,255,255,.65);font-size:12px;}#teDyn code{font-family:ui-monospace,Menlo,monospace;font-size:11px;color:#fff;}" +
    "#teDyn .te-row, #teAsk .te-row{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;}" +
    "#teAsk{position:fixed;left:50%;top:30%;transform:translateX(-50%);width:360px;max-width:calc(100vw - 32px);padding:14px;display:grid;gap:12px;}" +
    "#teAsk p{margin:0;}#teAsk form{display:grid;gap:12px;}#teAsk .te-f{display:grid;gap:3px;}#teAsk .te-f>span, #teAsk .te-m{color:rgba(255,255,255,.72);font-size:12px;}" +
    "#teAsk input{font:inherit;color:#1a2226;background:#fff;border:0;border-radius:5px;padding:6px 8px;width:100%;box-sizing:border-box;}" +
    "#teAsk button.te-link{background:none;color:#fff;padding:0;text-decoration:underline;font-weight:600;}#teAsk button:disabled{opacity:.6;cursor:default;}" +
    "#teSel[hidden], #teDyn[hidden], #teAsk[hidden], #teHist[hidden]{display:none;}" +
    "body.te-on .te-locked{outline:2px solid #e7a33e!important;position:relative;cursor:not-allowed;}" +
    "body.te-on .te-locked::before{content:attr(data-te-who);position:absolute;left:0;top:-1.7em;z-index:5;white-space:nowrap;padding:1px 6px;border-radius:4px;background:#e7a33e;color:#1a2226;font:600 11px/1.4 'Source Sans 3',sans-serif;}" +
    "#teBar .te-ppl{display:inline-flex;gap:3px;}#teBar .te-ppl i{font-style:normal;font-weight:700;font-size:11px;width:22px;height:22px;border-radius:50%;display:inline-grid;place-items:center;background:#e7a33e;color:#1a2226;}" +
    "#teHist{position:fixed;left:16px;bottom:72px;z-index:10000;width:440px;max-width:calc(100vw - 32px);max-height:60vh;overflow:auto;padding:10px;display:grid;gap:8px;font:13px/1.35 'Source Sans 3','Source Sans Pro',sans-serif;color:#fff;background:#1a2226;border-radius:8px;box-shadow:0 8px 28px rgba(0,0,0,.25);}" +
    "#teHist h3{margin:0;font-size:14px;}#teHist ol{list-style:none;margin:0;padding:0;display:grid;gap:8px;}" +
    "#teHist li{display:grid;grid-template-columns:1fr auto;gap:4px 8px;padding-top:8px;border-top:1px solid rgba(255,255,255,.15);}" +
    "#teHist .te-m{color:rgba(255,255,255,.7);font-size:12px;}#teHist .te-t{grid-column:1;}" +
    "#teHist button{grid-row:1 / span 2;grid-column:2;align-self:start;font:inherit;font-weight:600;color:#fff;background:transparent;border:0;border-radius:5px;padding:4px 8px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.4);cursor:pointer;}" +
    "#teToast{position:fixed;left:16px;bottom:64px;z-index:10001;max-width:calc(100vw - 32px);background:#255862;color:#fff;padding:6px 10px;border-radius:6px;font:13px 'Source Sans 3',sans-serif;opacity:0;transition:opacity .15s;pointer-events:none;}" +
    "#teToast.on{opacity:1;}@media (prefers-reduced-motion:reduce){#teToast{transition:none;}}";
  document.head.appendChild(css);

  /* ---------- Make the text editable ---------- */
  function editable(it) {
    var el = it.el;
    el.setAttribute("data-te", it.key);
    el.setAttribute("contenteditable", "true");
    el.setAttribute("spellcheck", "true");
    el.querySelectorAll(LOCKED).forEach(function (x) { x.setAttribute("contenteditable", "false"); });
    el.classList.toggle("te-changed", !!edits[it.key]);
  }
  /* an edit is always against the source as the page loaded it */
  function record(key, el) {
    var before = orig[key], after = clean(el.innerHTML), prev = edits[key] ? edits[key].after : "";
    if (norm(after) === norm(before)) delete edits[key];
    else edits[key] = { before: before, after: after };
    delete stale[key];
    store(); bar(); push(key, prev);
  }

  /* ---------- Shared copy: sending ----------
     Typing goes out a quarter second after it pauses; a change is written to
     the history once it has settled for three seconds. */
  var sync = null, me = null, canWrite = !SHARED, lockedBy = {}, others = {}, hist = [], putT = {}, logT = {}, logFrom = {};
  function push(key, prev) {
    if (!sync) return;
    if (!(key in logFrom)) logFrom[key] = prev;
    clearTimeout(putT[key]);
    putT[key] = setTimeout(function () { putT[key] = null; sync.put(key, edits[key] || null); }, 250);
    clearTimeout(logT[key]);
    logT[key] = setTimeout(function () {
      var now = edits[key] ? edits[key].after : "";
      if (norm(now) !== norm(logFrom[key])) sync.log(key, orig[key] || "", now);
      delete logFrom[key];
    }, 3000);
  }
  /* a change made here at once (restore, import): shown, sent and logged */
  function setEntry(key, after) {
    if (lockedBy[key]) { toast(lockedBy[key] + " is editing that text right now. Try again in a moment."); return false; }
    if (after != null && norm(after) !== norm(orig[key])) edits[key] = { before: orig[key], after: after }; else delete edits[key];
    delete stale[key];
    applyDom(key, edits[key] ? edits[key].after : orig[key]);
    if (sync) { sync.put(key, edits[key] || null); sync.log(key, orig[key] || "", edits[key] ? edits[key].after : ""); }
    store(); bar();
    return true;
  }
  items.forEach(function (it) { if (!it.tpl) editable(it); });

  /* A reading shown under a chart is a copy of its template entry. Editing
     the copy writes back to the template, so the next time that measure is
     chosen it shows the edit too. The copy is matched to its entry by text. */
  function tplFor(html) {
    var t = plain(html), hit = null;
    items.forEach(function (it) { if (it.tpl && plain(it.el.innerHTML) === t) hit = it; });
    return hit;
  }
  function markSays() {
    var any = false;
    document.querySelectorAll(".sc-say p, .who-sc-note.who-sc-say").forEach(function (p) {
      if (p.dataset.teTpl) return;
      var it = tplFor(p.innerHTML); if (!it) return;
      p.classList.add("te-say"); p.setAttribute("contenteditable", "true"); p.dataset.teTpl = it.key;
      p.querySelectorAll(LOCKED).forEach(function (x) { x.setAttribute("contenteditable", "false"); });
      any = true;
    });
    if (any && SHARED) paintLocks();
  }
  new MutationObserver(markSays).observe(document.documentElement, { childList: true, subtree: true });

  function keyOf(el) { return el.dataset.te || el.dataset.teTpl; }
  function writable(el) { return el && el.getAttribute("contenteditable") === "true"; }
  function changed(el) {
    if (el.dataset.te) { record(el.dataset.te, el); el.classList.toggle("te-changed", !!edits[el.dataset.te]); return; }
    var it = byKey[el.dataset.teTpl]; if (!it) return;
    it.el.innerHTML = clean(el.innerHTML);
    record(it.key, it.el);
  }

  /* ---------- Shared copy: receiving ---------- */
  function clonesOf(key) { return [].slice.call(document.querySelectorAll('[data-te-tpl="' + CSS.escape(key) + '"]')); }
  function applyDom(key, html) {
    var it = byKey[key]; if (!it) return;
    var els = it.tpl ? [it.el].concat(clonesOf(key)) : [it.el];
    if (cur && els.indexOf(cur.host) >= 0) closeDyn();
    els.forEach(function (el) {
      if (norm(el.innerHTML) === norm(html)) return;
      el.innerHTML = html;
      el.querySelectorAll(LOCKED).forEach(function (x) { x.setAttribute("contenteditable", "false"); });
    });
    if (!it.tpl) it.el.classList.toggle("te-changed", !!edits[key]);
  }
  /* text this editor is in the middle of is never overwritten by the copy
     coming back from the database */
  function busy(key) {
    var a = document.activeElement, el = a && a.closest && a.closest(EDITABLE);
    return !!putT[key] || (el && keyOf(el) === key) || (cur && keyOf(cur.host) === key);
  }
  function applyRemote(key, entry) {
    if (busy(key)) return;
    if (entry && typeof entry.after === "string") edits[key] = { before: String(entry.before || ""), after: inert(entry.after), name: entry.name, at: entry.at };
    else delete edits[key];
    if (!byKey[key]) { if (edits[key]) stale[key] = true; else delete stale[key]; bar(); return; }
    if (edits[key] && norm(edits[key].before) !== norm(orig[key])) { stale[key] = true; bar(); return; }
    delete stale[key];
    applyDom(key, edits[key] ? edits[key].after : orig[key]);
    bar();
  }
  /* text someone else is in is closed to everyone else until they leave it */
  function paintLocks() {
    document.querySelectorAll(EDITABLE).forEach(function (el) {
      var who = lockedBy[keyOf(el)], mine = el.contains(document.activeElement) || (cur && cur.host === el);
      el.setAttribute("contenteditable", canWrite && (!who || mine) ? "true" : "false");
      el.classList.toggle("te-locked", !!who && !mine);
      if (who && !mine) el.setAttribute("data-te-who", who + " is editing"); else el.removeAttribute("data-te-who");
    });
  }
  function hereNow() {
    if (!sync) return;
    var a = document.activeElement, el = a && a.closest && a.closest(EDITABLE);
    var k = el ? keyOf(el) : cur ? keyOf(cur.host) : null;
    if (k !== hereNow.last) { hereNow.last = k; sync.here(k); }
    paintLocks();
  }
  document.addEventListener("focusin", hereNow);
  document.addEventListener("focusout", function () { setTimeout(hereNow, 0); });
  document.addEventListener("input", function (e) {
    var el = e.target.closest && e.target.closest(EDITABLE);
    if (el) changed(el);
  }, true);
  /* one paragraph per element: Enter ends the edit; paste comes in as plain text.
     Keys typed in the editor's own panels stay out of the page's shortcuts too. */
  document.addEventListener("keydown", function (e) {
    var t = e.target.closest ? e.target : null;
    if (t && t.closest("#teDyn, #teAsk, #teHist")) { e.stopPropagation(); if (e.key === "Escape") { closeDyn(); closeAsk(); histEl.hidden = true; } return; }
    var el = t && t.closest(EDITABLE);
    if (!el) return;
    e.stopPropagation();
    if (e.key === "Enter" || e.key === "Escape") { e.preventDefault(); el.blur(); }
  }, true);
  document.addEventListener("paste", function (e) {
    var el = e.target.closest && e.target.closest(EDITABLE);
    if (!el) return;
    e.preventDefault();
    document.execCommand("insertText", false, (e.clipboardData || window.clipboardData).getData("text/plain").replace(/\s*\n\s*/g, " "));
  }, true);

  /* ---------- Make dynamic: select words, then the button by them ---------- */
  var selBtn = document.createElement("button");
  selBtn.id = "teSel"; selBtn.type = "button"; selBtn.textContent = "Make dynamic"; selBtn.hidden = true;
  selBtn.addEventListener("mousedown", function (e) { e.preventDefault(); });
  function selInfo() {
    var s = getSelection(); if (!s.rangeCount || s.isCollapsed) return null;
    var r = s.getRangeAt(0), c = r.commonAncestorContainer;
    c = c.nodeType === 1 ? c : c.parentElement;
    var host = c && c.closest(EDITABLE);
    if (!writable(host) || c.closest(".te-dyn") || !r.toString().trim()) return null;
    return { r: r, host: host };
  }
  function lockedIn(r) {
    var ends = [r.startContainer, r.endContainer].some(function (n) { var el = n.nodeType === 1 ? n : n.parentElement; return el && el.closest(LOCKED); });
    return ends || !!r.cloneContents().querySelector(LOCKED);
  }
  document.addEventListener("selectionchange", function () {
    var i = selInfo();
    if (!i) { selBtn.hidden = true; return; }
    var b = i.r.getBoundingClientRect();
    selBtn.hidden = false;
    var top = b.top - selBtn.offsetHeight - 8; if (top < 8) top = b.bottom + 8;
    selBtn.style.top = top + "px";
    selBtn.style.left = Math.max(8, Math.min(b.left + b.width / 2 - selBtn.offsetWidth / 2, innerWidth - selBtn.offsetWidth - 8)) + "px";
  });
  selBtn.addEventListener("click", function () {
    var i = selInfo(); if (!i) return;
    if (lockedIn(i.r)) { toast("City names and terms already change on their own. Select the words around them."); return; }
    var t = i.r.toString(), core = t.trim();
    var span = document.createElement("span");
    span.className = "te-dyn"; span.setAttribute("contenteditable", "false");
    span.textContent = core.replace(/\s+/g, " ");
    /* a figure is most likely a value; words are most likely a condition */
    if (/\d/.test(core)) span.setAttribute("data-te-kind", "value");
    else { span.setAttribute("data-te-kind", "condition"); setJ(span, "data-te-opts", [{ text: span.textContent, when: "" }]); }
    var f = document.createDocumentFragment();
    if (/^\s/.test(t)) f.appendChild(document.createTextNode(" "));
    f.appendChild(span);
    if (/\s$/.test(t)) f.appendChild(document.createTextNode(" "));
    i.r.deleteContents(); i.r.insertNode(f);
    getSelection().removeAllRanges(); selBtn.hidden = true;
    i.host.normalize();
    changed(i.host);
    openDyn(span, true);
  });

  /* ---------- A dynamic part's panel ----------
     Everything is read from and written to the span's attributes, so the
     panel holds no state of its own beyond which span it is open on. */
  var dynEl = document.createElement("div");
  dynEl.id = "teDyn"; dynEl.hidden = true; dynEl.setAttribute("role", "dialog"); dynEl.setAttribute("aria-label", "Dynamic text");
  var cur = null, lastSlot = null;
  function manifest() { return (window.DATA_MANIFEST && window.DATA_MANIFEST.rows) || null; }
  function rowById(id) { var m = manifest() || []; for (var i = 0; i < m.length; i++) if (m[i].row === id) return m[i]; return null; }
  /* the manifest's sections closest to the one on screen come first */
  function words(s) { return String(s).toLowerCase().replace(/[^a-z ]+/g, " ").split(/\s+/).filter(Boolean); }
  function metricOptions(selected) {
    var m = manifest(); if (!m) return '<option value="">Loading the data manifest…</option>';
    var here = words(location.hash.replace(/-/g, " ")), groups = [], byName = {};
    m.forEach(function (r) {
      var g = r.section + " › " + r.module;
      if (!byName[g]) { byName[g] = { name: g, rows: [], score: words(r.section).filter(function (w) { return here.indexOf(w) >= 0; }).length }; groups.push(byName[g]); }
      byName[g].rows.push(r);
    });
    var best = Math.max.apply(null, groups.map(function (g) { return g.score; }));
    groups = groups.map(function (g, i) { return { g: g, i: i }; }).sort(function (a, b) { return (b.g.score - a.g.score) || (a.i - b.i); }).map(function (x) { return x.g; });
    return '<option value="">Choose a metric…</option>' + groups.map(function (g) {
      return '<optgroup label="' + esc((best >= 3 && g.score === best ? "This section: " : "") + g.name) + '">' + g.rows.map(function (r) {
        var label = r.metric.length > 72 ? r.metric.slice(0, 70) + "…" : r.metric;
        return '<option value="' + r.row + '"' + (r.row === selected ? " selected" : "") + ' title="' + esc(r.metric) + '">' + esc(label + " · " + r.level + ", " + r.years) + "</option>";
      }).join("") + "</optgroup>";
    }).join("");
  }
  function fieldOptions(rowId, f) {
    var r = rowById(rowId); if (!r) return '<option value="">Choose a metric first</option>';
    return '<option value="">Choose a field…</option>' + r.fields.map(function (x, i) {
      var on = f && f.column === x.column && f.file === x.file;
      return '<option value="' + i + '"' + (on ? " selected" : "") + (x.note ? ' title="' + esc(x.note) + '"' : "") + ">" + esc(fieldName(x) + (x.note ? " · " + x.note : "")) + "</option>";
    }).join("");
  }
  function picked(rowSel, fieldSel) {
    var r = rowById(+rowSel.value), x = r && r.fields[+fieldSel.value];
    if (!r || !x || fieldSel.value === "") return null;
    return { row: r.row, metric: r.metric, level: r.level, years: r.years, column: x.column, file: x.file };
  }
  /* what the manifest says about computing a metric, under the field */
  function manNote(r) {
    if (!r || !r.compute) return "";
    var how = [r.calculation, r.instruction].filter(Boolean).join(". ");
    return "The manifest says this needs computing" + (how ? ": " + esc(how.length > 320 ? how.slice(0, 318) + "\u2026" : how) : ".") +
      ' <button type="button" class="te-link" data-te-dyn="calc">Make it a calculation</button>';
  }
  /* the fields a calculation or a condition uses, by the names it writes them with */
  function usesHtml(uses, label) {
    return '<div class="te-f"><span>' + label + (uses.length ? " (click a name to put it in)" : "") + '</span><div class="te-uses">' +
      (uses.length ? uses.map(function (u, i) {
        return '<span class="te-chip"><button type="button" class="te-chip-put" data-i="' + i + '" title="' + esc(fieldName(u) + " \u00b7 " + u.metric + " \u00b7 " + u.level + ", " + u.years) + '">' +
          esc(aliasOf(u)) + ' <small>' + esc(u.file || "file not named") + '</small></button><button type="button" class="te-chip-x" data-i="' + i + '" aria-label="Remove ' + esc(aliasOf(u)) + '">×</button></span>';
      }).join("") : "<em>None yet: add one below.</em>") + "</div></div>" +
      '<div class="te-add"><select class="te-row-sel" aria-label="Metric">' + metricOptions(null) + '</select><select class="te-field-sel" aria-label="Field">' + fieldOptions(null) + '</select><button type="button" class="te-q" data-te-dyn="use">Add field</button></div>';
  }
  function renderDyn() {
    var s = cur.span, kind = kindOf(s), h = "";
    h += '<div class="te-seg" role="group" aria-label="Kind of dynamic text">' +
      '<button type="button" data-te-dyn="value" aria-pressed="' + (kind === "value") + '">Value from a metric</button>' +
      '<button type="button" data-te-dyn="condition" aria-pressed="' + (kind === "condition") + '">Wording by condition</button></div>';
    if (kind === "value") {
      var f = getJ(s, "data-te-field", {}) || {}, c = calcOf(s), fmt = fmtOf(s);
      h += '<div class="te-seg" role="group" aria-label="Where the value comes from">' +
        '<button type="button" data-te-dyn="single" aria-pressed="' + !c + '">One field</button>' +
        '<button type="button" data-te-dyn="calc" aria-pressed="' + !!c + '">Calculated</button></div>';
      if (!c) h += '<label class="te-f"><span>Metric</span><select class="te-row-sel">' + metricOptions(f.row) + "</select></label>" +
        '<label class="te-f"><span>Field</span><select class="te-field-sel">' + fieldOptions(f.row, f) + "</select></label>" +
        '<p class="te-hint te-man">' + manNote(rowById(f.row)) + "</p>";
      else h += usesHtml(getJ(s, "data-te-uses", []), "Fields it uses") +
        '<label class="te-f"><span>Calculation</span><input class="te-formula" type="text" placeholder="e.g. value_place / value_metro" value="' + esc(c.formula || "") + '"></label>' +
        '<label class="te-f"><span>How to compute (which year, how a total or average is built)</span><textarea class="te-notes" rows="3" placeholder="e.g. latest year; national = average of metros weighted by population">' + esc(c.notes || "") + "</textarea></label>" +
        '<p class="te-hint">Write the calculation with the names above, e.g. <code>value_place / value_metro</code> or <code>100 * employed / population</code>.</p>';
      h += '<label class="te-f"><span>Shown as</span><select class="te-format">' + FORMATS.map(function (x) { return '<option value="' + x[0] + '"' + (fmt === x[0] ? " selected" : "") + ">" + esc(x[1]) + "</option>"; }).join("") + "</select></label>" +
        '<label class="te-f"><span>Now reads (for the city on screen)</span><input class="te-sample" type="text" value="' + esc(norm(s.textContent)) + '"></label>';
    } else {
      var uses = getJ(s, "data-te-uses", []), o = opts(s), shown = norm(s.textContent);
      h += usesHtml(uses, "Decided by these fields") +
        '<div class="te-f"><span>Every wording it can take, and when each is true</span><div class="te-opts">' +
        o.map(function (x, i) {
          return '<div class="te-opt"><input type="radio" name="teShown" value="' + i + '"' + (x.text === shown ? " checked" : "") + ' aria-label="Show this wording now">' +
            '<input class="te-o-text" data-i="' + i + '" type="text" value="' + esc(x.text) + '" aria-label="Wording">' +
            '<input class="te-o-when" data-i="' + i + '" type="text" value="' + esc(x.when) + '" placeholder="otherwise" aria-label="True when">' +
            (o.length > 1 ? '<button type="button" class="te-q te-o-x" data-i="' + i + '" aria-label="Remove this wording">×</button>' : "") + "</div>";
        }).join("") +
        '</div><button type="button" class="te-q te-o-add" data-te-dyn="add">Add a wording</button></div>' +
        '<p class="te-hint">Write each condition with the names above, e.g. <code>wage_nowcast &gt; wage_nowcast_n</code>. Leave one blank for &ldquo;otherwise&rdquo;. The dot marks the wording shown now.</p>';
    }
    h += '<div class="te-row"><button type="button" class="te-q" data-te-dyn="static">Make static</button><button type="button" data-te-dyn="done">Done</button></div>';
    dynEl.innerHTML = h;
    placeDyn();
  }
  function openDyn(span, fresh) {
    closeDyn();
    var host = span.closest(EDITABLE); if (!host) return;
    cur = { span: span, host: host };
    span.classList.add("te-open");
    dynEl.hidden = false;
    renderDyn();
    hereNow();
    var first = dynEl.querySelector(fresh ? ".te-row-sel" : "[aria-pressed=true]");
    if (first) first.focus();
  }
  function placeDyn() {
    if (!cur || dynEl.hidden) return;
    var b = cur.span.getBoundingClientRect(), h = dynEl.offsetHeight, w = dynEl.offsetWidth;
    var top = b.bottom + 8; if (top + h > innerHeight - 8) top = b.top - h - 8; if (top < 8) top = 8;
    dynEl.style.top = top + "px";
    dynEl.style.left = Math.max(8, Math.min(b.left, innerWidth - w - 8)) + "px";
  }
  function closeDyn() {
    if (!cur) return;
    cur.span.classList.remove("te-open");
    cur = null; lastSlot = null; dynEl.hidden = true;
    setTimeout(hereNow, 0);
  }
  function saveOpts(o) { setJ(cur.span, "data-te-opts", o); changed(cur.host); }
  /* re-render after the manifest arrives, if the panel opened before it */
  addEventListener("te-manifest", function () { if (cur) renderDyn(); });
  dynEl.addEventListener("change", function (e) {
    if (!cur) return;
    var t = e.target, s = cur.span;
    if (t.classList.contains("te-row-sel")) {
      var fs = t.parentElement.parentElement.querySelector(".te-field-sel");
      fs.innerHTML = fieldOptions(+t.value);
      if (rowById(+t.value) && rowById(+t.value).fields.length === 1) fs.value = "0";
      if (t.closest(".te-add")) return;
      var man = dynEl.querySelector(".te-man"); if (man) man.innerHTML = manNote(rowById(+t.value));
      t = fs;
    }
    if (t.classList.contains("te-field-sel") && !t.closest(".te-add")) {
      var p = picked(dynEl.querySelector(".te-row-sel"), t);
      if (p) setJ(s, "data-te-field", p); else s.removeAttribute("data-te-field");
      changed(cur.host); placeDyn();
    } else if (t.classList.contains("te-format")) {
      s.setAttribute("data-te-format", t.value); changed(cur.host);
    } else if (t.name === "teShown") {
      s.textContent = opts(s)[+t.value].text; changed(cur.host);
    }
  });
  dynEl.addEventListener("input", function (e) {
    if (!cur) return;
    var t = e.target, s = cur.span, o;
    if (t.classList.contains("te-sample")) { s.textContent = t.value.replace(/\s+/g, " ").trim() || "…"; changed(cur.host); }
    else if (t.classList.contains("te-o-text")) {
      o = opts(s); var i = +t.dataset.i, was = o[i].text === norm(s.textContent);
      o[i].text = t.value.replace(/\s+/g, " ").trim();
      if (was) s.textContent = o[i].text || "…";
      saveOpts(o);
    } else if (t.classList.contains("te-o-when")) { o = opts(s); o[+t.dataset.i].when = t.value.trim(); saveOpts(o); }
    else if (t.classList.contains("te-formula") || t.classList.contains("te-notes")) {
      var c = calcOf(s) || {};
      c[t.classList.contains("te-formula") ? "formula" : "notes"] = t.value.trim();
      setJ(s, "data-te-calc", c); changed(cur.host);
    }
    else return;
    placeDyn();
  });
  dynEl.addEventListener("focusin", function (e) { if (e.target.matches(".te-o-when, .te-formula")) lastSlot = e.target; });
  dynEl.addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b || !cur) return;
    var s = cur.span, a = b.dataset.teDyn, o, uses;
    if (a === "value" || a === "condition") {
      if (kindOf(s) === a) return;
      s.setAttribute("data-te-kind", a);
      if (a === "condition" && !s.hasAttribute("data-te-opts")) setJ(s, "data-te-opts", [{ text: norm(s.textContent), when: "" }]);
      changed(cur.host); renderDyn();
    } else if (a === "single") {
      if (!calcOf(s)) return;
      s.removeAttribute("data-te-calc");
      uses = getJ(s, "data-te-uses", []);
      if (!s.hasAttribute("data-te-field") && uses[0]) setJ(s, "data-te-field", { row: uses[0].row, metric: uses[0].metric, level: uses[0].level, years: uses[0].years, column: uses[0].column, file: uses[0].file });
      changed(cur.host); renderDyn();
    } else if (a === "calc") {
      if (calcOf(s)) return;
      /* the field chosen so far is the first one the calculation uses, and the
         manifest's instructions for its metric start the notes */
      var f = getJ(s, "data-te-field", null), r = f && rowById(f.row);
      uses = getJ(s, "data-te-uses", []);
      if (f && f.column) addUse(uses, { row: f.row, metric: f.metric, level: f.level, years: f.years, column: f.column, file: f.file });
      setJ(s, "data-te-uses", uses);
      setJ(s, "data-te-calc", { formula: uses.length ? aliasOf(uses[0]) : "", notes: r ? [r.calculation, r.instruction].filter(Boolean).join(". ") : "" });
      changed(cur.host); renderDyn();
      var fm = dynEl.querySelector(".te-formula"); if (fm) fm.focus();
    } else if (a === "use") {
      var p = picked(dynEl.querySelector(".te-add .te-row-sel"), dynEl.querySelector(".te-add .te-field-sel"));
      if (!p) { toast("Choose a metric and a field to add."); return; }
      uses = addUse(getJ(s, "data-te-uses", []), p);
      setJ(s, "data-te-uses", uses);
      var cc = calcOf(s), pr = rowById(p.row);
      if (cc && !cc.notes && pr && (pr.calculation || pr.instruction)) { cc.notes = [pr.calculation, pr.instruction].filter(Boolean).join(". "); setJ(s, "data-te-calc", cc); }
      changed(cur.host); renderDyn();
    } else if (b.classList.contains("te-chip-x")) {
      uses = getJ(s, "data-te-uses", []); uses.splice(+b.dataset.i, 1);
      setJ(s, "data-te-uses", uses); changed(cur.host); renderDyn();
    } else if (b.classList.contains("te-chip-put")) {
      var w = lastSlot && dynEl.contains(lastSlot) ? lastSlot : dynEl.querySelector(".te-formula, .te-o-when");
      if (!w) return;
      var col = aliasOf(getJ(s, "data-te-uses", [])[+b.dataset.i]), at = w.selectionStart == null ? w.value.length : w.selectionStart;
      w.value = w.value.slice(0, at) + col + w.value.slice(w.selectionEnd == null ? at : w.selectionEnd);
      w.focus(); w.setSelectionRange(at + col.length, at + col.length);
      w.dispatchEvent(new Event("input", { bubbles: true }));
    } else if (a === "add") {
      o = opts(s); o.push({ text: "", when: "" }); saveOpts(o); renderDyn();
      var ins = dynEl.querySelectorAll(".te-o-text"); ins[ins.length - 1].focus();
    } else if (b.classList.contains("te-o-x")) {
      o = opts(s); var gone = o.splice(+b.dataset.i, 1)[0];
      if (gone.text === norm(s.textContent)) s.textContent = o[0].text || "…";
      saveOpts(o); renderDyn();
    } else if (a === "static") {
      var host = cur.host, span = cur.span;
      closeDyn();
      span.replaceWith(document.createTextNode(span.textContent));
      host.normalize();
      changed(host);
    } else if (a === "done") closeDyn();
  });

  /* a click on a dynamic part opens its panel; a click elsewhere closes it */
  document.addEventListener("click", function (e) {
    var d = e.target.closest && e.target.closest(".te-dyn");
    if (!d || !writable(d.closest(EDITABLE)) || document.body.classList.contains("te-clean")) return;
    e.preventDefault(); e.stopPropagation();
    openDyn(d, false);
  }, true);
  document.addEventListener("mousedown", function (e) {
    if (!cur || dynEl.contains(e.target) || (e.target.closest && e.target.closest(".te-dyn") === cur.span)) return;
    closeDyn();
  }, true);
  addEventListener("scroll", function () { placeDyn(); selBtn.hidden = true; }, true);
  addEventListener("resize", placeDyn);

  /* ---------- Sharing ----------
     A link carries the changes in ?te=, compressed where the browser can
     ("z" + deflate, else "j" + plain JSON), base64url. */
  function toB64(bytes) {
    var s = "";
    for (var i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function fromB64(str) {
    str = str.replace(/-/g, "+").replace(/_/g, "/");
    while (str.length % 4) str += "=";
    var s = atob(str), b = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return b;
  }
  function pack(obj) {
    var bytes = new TextEncoder().encode(JSON.stringify(obj));
    if (!window.CompressionStream) return Promise.resolve("j" + toB64(bytes));
    return new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"))).arrayBuffer()
      .then(function (b) { return "z" + toB64(new Uint8Array(b)); });
  }
  function unpack(str) {
    return Promise.resolve().then(function () {
      var bytes = fromB64(str.slice(1));
      if (str[0] === "z") return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
      if (str[0] === "j") return new TextDecoder().decode(bytes);
      throw new Error("unknown");
    }).then(JSON.parse);
  }
  function dropParam() {
    var u = new URL(location.href);
    if (!u.searchParams.has("te")) return;
    u.searchParams.delete("te");
    history.replaceState(history.state, "", u);
  }
  function share() {
    if (!Object.keys(edits).length) { toast("No changes to share yet."); return; }
    pack(edits).then(function (z) {
      var u = new URL(location.href); u.searchParams.set("te", z);
      var s = u.toString(), local = /^(localhost|127\.|\[::1\])/.test(location.hostname);
      copy(s, "Share link copied." +
        (s.length > 8000 ? " It is long; if it gets cut off, send the file from Download instead." : "") +
        (local ? " It opens on localhost:" + (location.port || 80) + ", so whoever opens it needs the prototype running there." : ""));
    }, function () { toast("Could not make a link. Use Download instead."); });
  }

  /* changes coming in from a link or a file: use them, combine them with
     this browser's, or ignore them */
  var askEl = document.createElement("div");
  askEl.id = "teAsk"; askEl.hidden = true; askEl.setAttribute("role", "dialog"); askEl.setAttribute("aria-label", "Shared changes");
  function closeAsk() { if (askEl.hidden) return; askEl.hidden = true; dropParam(); }
  function offer(incoming, from) {
    var theirs = Object.keys(incoming).length, mine = Object.keys(edits).length;
    if (!theirs) { dropParam(); if (from !== "browser") toast("The " + from + " has no changes in it."); return; }
    if (sync) { offerShared(incoming, from, theirs); return; }
    if (JSON.stringify(incoming) === JSON.stringify(edits)) { dropParam(); return; }
    if (!mine) { adopt(incoming); return; }
    askEl.innerHTML = "<p><b>The " + from + " has " + theirs + " change" + (theirs > 1 ? "s" : "") + ".</b> This browser has " + mine + " of its own.</p>" +
      '<div class="te-row"><button type="button" class="te-q" data-te-ask="keep">Keep mine</button>' +
      '<button type="button" class="te-q" data-te-ask="merge" title="Where both changed the same text, the ' + from + '\'s wins">Combine</button>' +
      '<button type="button" data-te-ask="use">Use the ' + from + "&rsquo;s</button></div>";
    askEl.hidden = false;
    askEl.querySelector('[data-te-ask="use"]').focus();
    askEl.onclick = function (e) {
      var b = e.target.closest("[data-te-ask]"); if (!b) return;
      var a = b.dataset.teAsk;
      if (a === "keep") closeAsk();
      else if (a === "use") adopt(incoming);
      else { var both = {}; Object.keys(edits).forEach(function (k) { both[k] = edits[k]; }); Object.keys(incoming).forEach(function (k) { both[k] = incoming[k]; }); adopt(both); }
    };
  }
  /* into the shared copy: only edits whose source still reads the same are
     added, and they replace what is there for that text */
  function offerShared(incoming, from, n) {
    askEl.innerHTML = "<p><b>" + (from === "browser" ? "This browser has " + n + " change" + (n > 1 ? "s" : "") + " made before shared editing."
        : "The " + from + " has " + n + " change" + (n > 1 ? "s" : "") + ".") + "</b> Add " + (n > 1 ? "them" : "it") +
      " to the shared copy everyone sees? Where someone has already changed the same text, " + (n > 1 ? "these replace" : "this replaces") + " it.</p>" +
      '<div class="te-row"><button type="button" class="te-q" data-te-ask="keep">Not now</button><button type="button" data-te-ask="add">Add to the shared copy</button></div>';
    askEl.hidden = false;
    askEl.querySelector('[data-te-ask="add"]').focus();
    askEl.onclick = function (e) {
      var b = e.target.closest("[data-te-ask]"); if (!b) return;
      if (b.dataset.teAsk === "add") {
        var added = 0, skipped = 0;
        Object.keys(incoming).forEach(function (k) {
          if (byKey[k] && norm(incoming[k].before) === norm(orig[k]) && setEntry(k, incoming[k].after)) added++; else skipped++;
        });
        if (from === "browser") { try { localStorage.removeItem(KEY); } catch (err) {} leftover = null; }
        toast(added + " added to the shared copy." + (skipped ? " " + skipped + " left out: the text they changed is no longer the same, or someone is in it." : ""));
      }
      closeAsk();
    };
  }
  /* Signing in: a Harvard address gets a one-time link by email; anyone on
     the editors list (set in the Firebase console) can use Google instead */
  var EMAIL_KEY = "cities-v5-signin-email";
  function savedEmail() { try { return localStorage.getItem(EMAIL_KEY) || ""; } catch (e) { return ""; } }
  function signInBox() {
    askEl.innerHTML = '<form class="te-in"><p><b>Sign in to edit together</b></p>' +
      '<label class="te-f"><span>Your Harvard email</span><input type="email" required autocomplete="email" placeholder="name@hks.harvard.edu" value="' + esc(savedEmail()) + '"></label>' +
      '<div class="te-row"><button type="button" class="te-q" data-te-ask="keep">Cancel</button><button type="submit">Email me a sign-in link</button></div></form>' +
      '<p class="te-m">Not a Harvard address? <button type="button" class="te-link" data-te-ask="google">Sign in with Google</button> if you have been added as an editor.</p>';
    askEl.hidden = false;
    var input = askEl.querySelector("input"); input.focus();
    askEl.onclick = function (e) {
      var b = e.target.closest("[data-te-ask]"); if (!b) return;
      if (b.dataset.teAsk === "google") { closeAsk(); sync.signIn(); } else closeAsk();
    };
    askEl.querySelector("form").onsubmit = function (e) {
      e.preventDefault();
      var email = input.value.trim().toLowerCase(), go = askEl.querySelector("[type=submit]");
      go.disabled = true; go.textContent = "Sending\u2026";
      sync.sendLink(email).then(function () {
        try { localStorage.setItem(EMAIL_KEY, email); } catch (err) {}
        askEl.innerHTML = "<p><b>Check your inbox.</b> A sign-in link is on its way to " + esc(email) +
          ". Open it in this browser; it signs you in and brings you back here. If it is not there in a minute, look in junk or quarantine.</p>" +
          '<div class="te-row"><button type="button" data-te-ask="keep">OK</button></div>';
        askEl.querySelector("button").focus();
      }, function (err) {
        go.disabled = false; go.textContent = "Email me a sign-in link";
        toast("Could not send the link: " + (err.code || err.message));
      });
    };
  }
  function adopt(next) { edits = next; store(); dropParam(); location.reload(); }
  var fileIn = document.createElement("input");
  fileIn.type = "file"; fileIn.accept = ".json,application/json"; fileIn.hidden = true;
  fileIn.addEventListener("change", function () {
    var f = fileIn.files[0]; if (!f) return;
    f.text().then(function (t) { offer(parse(JSON.parse(t), true), "file"); }).catch(function () { toast("That file could not be read."); });
    fileIn.value = "";
  });

  /* ---------- The bar ---------- */
  var barEl = document.createElement("div");
  barEl.id = "teBar"; barEl.setAttribute("role", "region"); barEl.setAttribute("aria-label", "Text editing");
  var toastEl = document.createElement("div"); toastEl.id = "teToast"; toastEl.setAttribute("role", "status");
  function toast(m) { toastEl.textContent = m; toastEl.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(function () { toastEl.classList.remove("on"); }, m.length > 60 ? 5000 : 2000); }
  function dynCount() { var n = 0; items.forEach(function (it) { n += it.el.querySelectorAll(".te-dyn").length; }); return n; }
  function initials(n) { return String(n || "?").split("@")[0].split(/[\s._-]+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0].toUpperCase(); }).join(""); }
  function bar() {
    var keys = Object.keys(edits), nStale = keys.filter(function (k) { return stale[k]; }).length, nDyn = dynCount();
    var counts = "<span class=\"te-n\">" + keys.length + " changed" + (nStale ? ", " + nStale + " no longer match the source" : "") +
      " &middot; " + (nDyn ? nDyn + " dynamic" : "select words to make them dynamic") + "</span>";
    var tail = '<button type="button" class="te-q" data-te-act="clean" aria-pressed="' + document.body.classList.contains("te-clean") + '">Hide outlines</button>';
    if (!SHARED) {
      barEl.innerHTML = "<b>Editing text</b>" + counts +
        '<button type="button" data-te-act="copy">Copy changes</button>' +
        '<button type="button" data-te-act="share">Share link</button>' +
        '<button type="button" class="te-q" data-te-act="json">Download</button>' +
        '<button type="button" class="te-q" data-te-act="import">Import</button>' + tail +
        '<button type="button" class="te-q" data-te-act="reset">Undo all</button>' +
        '<button type="button" class="te-q" data-te-act="exit">Exit</button>';
      return;
    }
    if (!me) {
      barEl.innerHTML = "<b>Editing together</b><span class=\"te-n\">" + (sync ? "Sign in to see and make changes with the team." : "Connecting&hellip;") + "</span>" +
        (sync ? '<button type="button" data-te-act="signin">Sign in</button>' : "") +
        '<button type="button" class="te-q" data-te-act="exit">Exit</button>';
      return;
    }
    var ppl = Object.keys(others).map(function (u) { var o = others[u]; return '<i title="' + esc(o.name + (o.key ? ", in " + (byKey[o.key] ? byKey[o.key].where : o.key) : "")) + '">' + esc(initials(o.name)) + "</i>"; });
    barEl.innerHTML = "<b>Editing together</b>" + counts +
      '<span class="te-ppl" aria-label="' + (ppl.length ? ppl.length + " others here" : "No one else here") + '">' + ppl.join("") + "</span>" +
      '<button type="button" data-te-act="copy">Copy changes</button>' +
      '<button type="button" class="te-q" data-te-act="hist" aria-expanded="' + !histEl.hidden + '">History</button>' +
      '<button type="button" class="te-q" data-te-act="link">Copy link</button>' +
      '<button type="button" class="te-q" data-te-act="json">Download</button>' +
      '<button type="button" class="te-q" data-te-act="import">Import</button>' + tail +
      '<button type="button" class="te-q" data-te-act="signout" title="' + esc(me.email) + '">Sign out</button>' +
      '<button type="button" class="te-q" data-te-act="exit">Exit</button>';
  }

  /* ---------- History: every settled change, newest first; any can be put back ---------- */
  var histEl = document.createElement("div");
  histEl.id = "teHist"; histEl.hidden = true; histEl.setAttribute("role", "dialog"); histEl.setAttribute("aria-label", "History");
  function ago(t) {
    var s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return Math.round(s / 60) + " min ago";
    if (s < 86400) return Math.round(s / 3600) + " h ago";
    return new Date(t).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  }
  function renderHist() {
    if (histEl.hidden) return;
    histEl.innerHTML = "<h3>History</h3>" + (hist.length ? "<ol>" + hist.map(function (h, i) {
      var text = h.after ? readable(h.after) : "Back to the original text";
      return "<li><span class=\"te-m\">" + esc((h.name || "Someone") + " \u00b7 " + (h.at ? ago(h.at) : "") + " \u00b7 " + (byKey[h.key] ? byKey[h.key].where : h.key)) + "</span>" +
        '<span class="te-t">' + esc(text.length > 180 ? text.slice(0, 178) + "\u2026" : text) + "</span>" +
        '<button type="button" data-i="' + i + '">Restore</button></li>';
    }).join("") + "</ol>" : '<p class="te-m">No changes yet.</p>');
  }
  histEl.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-i]"); if (!b) return;
    var h = hist[+b.dataset.i]; if (!h) return;
    if (!byKey[h.key]) { toast("That text is no longer on the page."); return; }
    if (setEntry(h.key, h.after || null)) toast("Restored.");
  });

  function changesText() {
    var keys = Object.keys(edits);
    if (!keys.length) return "";
    return "Text changes for cities-v-5/index.html (" + keys.length + ")\nDynamic parts are in braces: {value: field, as format; now \"…\"} or {condition on fields: \"wording\" when …; \"wording\" otherwise}.\n\n" + keys.map(function (k) {
      var e = edits[k];
      return "## " + (byKey[k] ? byKey[k].where : k) + "  [" + k + "]" + (stale[k] ? "  (source has changed since)" : "") + "\nBefore: " + readable(e.before) + "\nAfter:  " + readable(e.after);
    }).join("\n\n") + "\n";
  }
  function copy(text, done) {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { toast(done); }, function () { toast("Copy was blocked. Use Download."); });
    else toast("Copy is not available here. Use Download.");
  }
  var resetAt = 0;
  barEl.addEventListener("click", function (e) {
    var b = e.target.closest("[data-te-act]"); if (!b) return;
    var a = b.dataset.teAct;
    if (a === "copy") { var t = changesText(); if (!t) toast("No changes yet."); else copy(t, "Changes copied."); }
    else if (a === "share") share();
    else if (a === "json") {
      var link = document.createElement("a");
      link.href = URL.createObjectURL(new Blob([JSON.stringify(edits, null, 2)], { type: "application/json" }));
      link.download = "cities-v5-text-edits.json"; document.body.appendChild(link); link.click();
      setTimeout(function () { URL.revokeObjectURL(link.href); link.remove(); }, 0);
    }
    else if (a === "import") fileIn.click();
    else if (a === "clean") { document.body.classList.toggle("te-clean"); closeDyn(); bar(); }
    else if (a === "reset") {
      if (Date.now() - resetAt > 4000) { resetAt = Date.now(); toast("Click Undo all again to drop every change."); return; }
      edits = {}; store(); location.reload();
    }
    else if (a === "signin") signInBox();
    else if (a === "signout") sync.signOut().then(function () { location.reload(); });
    else if (a === "hist") { histEl.hidden = !histEl.hidden; renderHist(); bar(); }
    else if (a === "link") { var l = new URL(location.href); l.searchParams.delete("te"); copy(l.toString(), "Link copied. Anyone with a Harvard email can open it, sign in and edit with you."); }
    else if (a === "exit") { var u = new URL(location.href); u.searchParams.delete("edit"); u.searchParams.delete("te"); location.href = u.toString(); }
  });

  function mount() {
    document.body.classList.add("te-on");
    [barEl, toastEl, selBtn, dynEl, askEl, histEl, fileIn].forEach(function (n) { document.body.appendChild(n); });
    bar(); markSays();
    if (SHARED) { paintLocks(); connectShared(); }
    /* the manifest is only needed here, so only edit mode loads it */
    var m = document.createElement("script");
    m.src = "data-manifest.js?v=2"; m.onload = function () { dispatchEvent(new Event("te-manifest")); };
    m.onerror = function () { toast("The data manifest (data-manifest.js) did not load."); };
    document.head.appendChild(m);
    if (!SHARED) linked();
  }
  /* changes carried in a link (?te=); with shared editing, read once signed in */
  function linked() {
    var shared = new URLSearchParams(location.search).get("te");
    if (shared) unpack(shared).then(function (o) { offer(parse(o, true), "link"); }, function () { dropParam(); toast("This share link could not be read; it may have been cut off."); });
  }
  function connectShared() {
    import("./text-sync.js?v=2").then(function (mod) {
      sync = mod.connect(CFG, {
        onUser: function (u) {
          me = u; canWrite = !!u;
          if (!u) { lockedBy = {}; others = {}; }
          paintLocks(); bar();
          if (u) { if (leftover) offer(leftover, "browser"); linked(); }
        },
        onText: applRemoteSafe,
        /* the address the link was sent to; asked again if the link is opened in another browser */
        linkEmail: function () { return savedEmail() || (window.prompt("To finish signing in, type the email address the link was sent to.") || "").trim().toLowerCase(); },
        onPresence: function (o) {
          others = o; lockedBy = {};
          Object.keys(o).forEach(function (u) { if (o[u] && o[u].key) lockedBy[o[u].key] = o[u].name; });
          paintLocks(); bar();
        },
        onHistory: function (list) { hist = list.filter(function (h) { return h && typeof h.key === "string"; }); renderHist(); },
        onDenied: function (u) {
          canWrite = false; paintLocks();
          toast((u && u.email ? u.email : "This account") + " cannot open the shared copy. Sign in with your Harvard email, or ask to be added to the editors list.");
          sync.signOut();
        },
        onError: toast,
      });
      bar();
    }, function () { toast("Shared editing could not load. Check the connection and reload."); });
  }
  function applRemoteSafe(key, entry) { try { applyRemote(key, entry); } catch (e) { /* one bad entry must not stop the rest */ } }
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);
})();
