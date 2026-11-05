/* Spec view for frontend developers. Off unless the URL has ?spec; loaded
   by text-edit.js only then. Read-only: nothing is saved and no one signs in.

   Every text in the text column (and each chart reading) gets a label with
   its data-text-id, its role and its type at the current window width.
   Clicking one opens its full spec. The page is also measured at 375, 768
   and 1280 px, each in a hidden frame of that width, so values set with vw
   or clamp() come out as they render there. For each property the spec
   gives the computed value and, where the winning CSS rule sets it with a
   custom property, the token (--t-h2) and that rule's selector.
   "Download CSV" and "Copy JSON" export the whole table. */
(function () {
  "use strict";
  var ROOTS = "section.page, .ov-block";
  var TARGETS = ".page-head h2, .page > h2, .subsection-header h3, p.lede, .ask-a, .intro-q";
  var WIDTHS = [375, 768, 1280];
  var PROPS = [["font-family", "Family"], ["font-weight", "Weight"], ["font-size", "Size"], ["line-height", "Line height"],
    ["letter-spacing", "Letter spacing"], ["text-transform", "Case"], ["color", "Colour"], ["max-width", "Max width"],
    ["margin-top", "Margin top"], ["margin-bottom", "Margin bottom"]];
  /* a longhand set inside a shorthand with var() reads empty; its shorthand then tells */
  var SHORT = { "font-family": "font", "font-weight": "font", "font-size": "font", "line-height": "font", "margin-top": "margin", "margin-bottom": "margin" };

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function squash(s) { return String(s || "").replace(/\s+/g, " ").trim(); }
  function rootOf(el) { var r = el.closest(ROOTS); while (r && !r.id) r = r.parentElement && r.parentElement.closest(ROOTS); return r; }
  function role(el) {
    if (el.matches(".page-head h2, .page > h2")) return "Section title";
    if (el.matches(".subsection-header h3")) return "Subhead";
    if (el.matches("p.lede")) return "Lede";
    if (el.matches(".ask-a")) return "Answer";
    if (el.matches(".intro-q")) return "Question";
    return "Text";
  }

  /* ---------- Which CSS rule sets a property ----------
     The cascade, approximated: among the rules (in media queries that apply
     at this width) whose selector matches, !important first, then the most
     specific selector, then the last in source order. */
  function specificity(sel) {
    sel = sel.replace(/::?(before|after|first-line|first-letter|placeholder|marker|selection)\b/g, "");
    var a = (sel.match(/#[\w-]+/g) || []).length;
    var b = (sel.match(/\.[\w-]+|\[[^\]]+\]|:(?!not\(|is\(|where\()[\w-]+(\([^)]*\))?/g) || []).length;
    var c = (sel.replace(/#[\w-]+|\.[\w-]+|\[[^\]]+\]|:[\w-]+(\([^)]*\))?/g, " ").match(/(^|[\s>+~(])[a-zA-Z][\w-]*/g) || []).length;
    return a * 10000 + b * 100 + c;
  }
  function declared(el, win) {
    var best = {}, order = 0;
    function take(prop, v, imp, sp, sel) {
      var score = [imp, sp, order], b = best[prop];
      if (!b || score[0] > b.score[0] || (score[0] === b.score[0] && (score[1] > b.score[1] || (score[1] === b.score[1] && score[2] >= b.score[2])))) best[prop] = { score: score, value: squash(v), selector: sel };
    }
    function walk(rules) {
      for (var i = 0; i < rules.length; i++) {
        var r = rules[i]; order++;
        if (r.media && r.cssRules) { if (win.matchMedia(r.media.mediaText).matches) walk(r.cssRules); continue; }
        if (r.cssRules && !r.selectorText) { if (r.conditionText && win.CSS.supports(r.conditionText)) walk(r.cssRules); continue; }
        if (!r.selectorText || !r.style) continue;
        var sp = -1;
        r.selectorText.split(",").forEach(function (s) { try { if (el.matches(s)) sp = Math.max(sp, specificity(s)); } catch (e) {} });
        if (sp < 0) continue;
        PROPS.forEach(function (p) {
          var prop = p[0], v = r.style.getPropertyValue(prop), pr = prop;
          if (!v && SHORT[prop] && /var\(/.test(r.style.getPropertyValue(SHORT[prop]))) { pr = SHORT[prop]; v = r.style.getPropertyValue(pr); }
          if (v) take(prop, v, r.style.getPropertyPriority(pr) === "important" ? 1 : 0, sp, r.selectorText);
        });
      }
    }
    [].forEach.call(win.document.styleSheets, function (sh) { try { walk(sh.cssRules); } catch (e) { /* a stylesheet from another site cannot be read */ } });
    PROPS.forEach(function (p) { var v = el.style.getPropertyValue(p[0]); if (v) best[p[0]] = { value: squash(v), selector: "inline style" }; });
    return best;
  }
  function hex(c) {
    var m = String(c).match(/rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)(?:[ ,/]+([\d.]+))?/);
    if (!m) return c;
    var h = "#" + [m[1], m[2], m[3]].map(function (n) { return (+n).toString(16).padStart(2, "0"); }).join("");
    return m[4] != null && +m[4] < 1 ? h + " at " + Math.round(m[4] * 100) + "%" : h;
  }
  function spec(el, win) {
    var cs = win.getComputedStyle(el), dec = declared(el, win), out = {};
    PROPS.forEach(function (p) {
      var prop = p[0], v = cs.getPropertyValue(prop), d = dec[prop], tok = d && d.value.match(/var\((--[\w-]+)/);
      if (prop === "color") v = hex(v);
      if (prop === "font-family") v = v.split(",")[0].replace(/["']/g, "").trim();
      v = String(v).replace(/(-?\d+\.\d{3,})px/g, function (m, n) { return +(+n).toFixed(2) + "px"; });
      out[prop] = { value: squash(v), token: tok ? tok[1] : "", rule: d ? d.selector : "", set: d ? d.value : "" };
    });
    return out;
  }

  /* ---------- The texts: the same ones the editor edits ---------- */
  function collect(doc) {
    var out = [], count = {};
    doc.querySelectorAll(TARGETS).forEach(function (el) {
      if (el.closest("template, .sc-say, .who-sc-note")) return;
      var r = rootOf(el); if (!r) return;
      var n = count[r.id] = (count[r.id] || 0) + 1;
      out.push({ id: el.getAttribute("data-text-id") || r.id + ":" + n, el: el, section: r.id, role: role(el), tag: el.tagName.toLowerCase(), text: squash(el.textContent) });
    });
    /* a chart reading is shown in its block's note, which sets its type */
    doc.querySelectorAll("template.who-sc-says").forEach(function (t) {
      var r = rootOf(t); if (!r) return;
      var note = r.querySelector(".who-sc-note");
      t.content.querySelectorAll("[data-m]").forEach(function (q) {
        out.push({ id: q.getAttribute("data-text-id") || r.id + ":says:" + q.dataset.m, el: note, section: r.id, role: "Chart reading", tag: "p", text: squash(q.textContent), reading: true });
      });
    });
    return out;
  }
  function words(t) { return t ? t.split(/\s+/).length : 0; }

  var list = [], at = {}, measuring = false;
  function measureAt(w) {
    return new Promise(function (done) {
      var f = document.createElement("iframe"), u = new URL(location.href);
      u.searchParams.delete("spec"); u.searchParams.delete("edit");
      f.src = u.toString(); f.tabIndex = -1; f.setAttribute("aria-hidden", "true"); f.title = "Measuring at " + w + " px";
      f.style.cssText = "position:fixed;left:-30000px;top:0;width:" + w + "px;height:900px;border:0;visibility:hidden;";
      var timer = setTimeout(function () { f.remove(); done(null); }, 30000);
      f.onload = function () {
        setTimeout(function () {
          var got = null;
          try {
            got = {};
            collect(f.contentDocument).forEach(function (x) { got[x.id] = x.el ? spec(x.el, f.contentWindow) : null; });
          } catch (e) { got = null; }
          clearTimeout(timer); f.remove(); done(got);
        }, 2500);
      };
      document.body.appendChild(f);
    });
  }
  function measureAll() {
    if (measuring) return;
    measuring = true; bar();
    WIDTHS.reduce(function (p, w) {
      return p.then(function () { bar("Measuring at " + w + " px…"); return measureAt(w).then(function (got) { at[w] = got; }); });
    }, Promise.resolve()).then(function () { measuring = false; bar(); if (open) details(open); });
  }

  /* ---------- Labels on the page ---------- */
  var css = document.createElement("style");
  css.textContent =
    "body.ts-on [data-ts]{outline:1px dashed rgba(123,79,196,.55);outline-offset:2px;position:relative;cursor:help;}" +
    "body.ts-on [data-ts]::before{content:attr(data-ts);position:absolute;left:0;bottom:100%;margin-bottom:3px;z-index:30;pointer-events:none;white-space:nowrap;" +
    "font:600 10.5px/1.35 ui-monospace,Menlo,monospace;letter-spacing:0;text-transform:none;color:#fff;background:#7b4fc4;padding:1px 5px;border-radius:3px;}" +
    "body.ts-on [data-ts].ts-open{outline:2px solid #7b4fc4;}" +
    "body.ts-bare [data-ts]{outline:none;}body.ts-bare [data-ts]::before{content:none;}" +
    "#tsBar, #tsPanel{font:13px/1.35 'Source Sans 3','Source Sans Pro',sans-serif;color:#fff;background:#1a2226;border-radius:8px;box-shadow:0 8px 28px rgba(0,0,0,.25);z-index:10000;}" +
    "#tsBar{position:fixed;left:16px;bottom:16px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;max-width:calc(100vw - 32px);padding:8px 10px;}" +
    "#tsBar .ts-n{color:rgba(255,255,255,.78);}" +
    "#tsBar button, #tsPanel button{font:inherit;font-weight:600;color:#1a2226;background:#fff;border:0;border-radius:5px;padding:5px 9px;cursor:pointer;}" +
    "#tsBar button.ts-q, #tsPanel button.ts-q{background:transparent;color:#fff;box-shadow:inset 0 0 0 1px rgba(255,255,255,.4);}" +
    "#tsBar button:disabled{opacity:.6;cursor:default;}#tsBar button:focus-visible, #tsPanel button:focus-visible{outline:2px solid #e7a33e;outline-offset:2px;}" +
    "#tsPanel{position:fixed;right:16px;bottom:72px;width:620px;max-width:calc(100vw - 32px);max-height:calc(100vh - 160px);overflow:auto;padding:12px;display:grid;gap:10px;}" +
    "#tsPanel[hidden]{display:none;}#tsPanel h3{margin:0;font-size:15px;}#tsPanel p{margin:0;color:rgba(255,255,255,.75);}" +
    "#tsPanel table{border-collapse:collapse;width:100%;font-size:12px;}#tsPanel th, #tsPanel td{text-align:left;vertical-align:top;padding:4px 6px;border-top:1px solid rgba(255,255,255,.12);}" +
    "#tsPanel th{color:rgba(255,255,255,.7);font-weight:600;}#tsPanel code{font:11px ui-monospace,Menlo,monospace;color:#d9c9ff;}" +
    "#tsPanel .ts-rule{display:block;color:rgba(255,255,255,.5);font-size:11px;}#tsPanel .ts-row{display:flex;gap:8px;justify-content:flex-end;}" +
    "#tsToast{position:fixed;left:16px;bottom:64px;z-index:10001;background:#255862;color:#fff;padding:6px 10px;border-radius:6px;font:13px 'Source Sans 3',sans-serif;opacity:0;transition:opacity .15s;pointer-events:none;}" +
    "#tsToast.on{opacity:1;}@media (prefers-reduced-motion:reduce){#tsToast{transition:none;}}";
  document.head.appendChild(css);

  function short(sp) {
    if (!sp) return "";
    var size = sp["font-size"], lh = sp["line-height"];
    return sp["font-family"].value + " " + sp["font-weight"].value + " · " + size.value.replace(/px$/, "") + "/" + lh.value.replace(/px$/, "") + "px" +
      (size.token ? " (" + size.token + ")" : "") + (sp["max-width"].value !== "none" ? " · max " + sp["max-width"].value : "");
  }
  function label() {
    list = collect(document);
    list.forEach(function (x) {
      if (!x.el || x.reading) return;
      x.el.setAttribute("data-ts", x.id + " · " + x.role + " · " + short(spec(x.el, window)));
    });
    /* the reading on screen, labelled with the block's type */
    document.querySelectorAll(".who-sc-note").forEach(function (n) {
      var r = rootOf(n); if (!r) return;
      n.setAttribute("data-ts", (r.id.replace(/^page-/, "") + "-reading-…") + " · Chart reading · " + short(spec(n, window)));
    });
    bar();
  }

  /* ---------- One text's full spec ---------- */
  var panel = document.createElement("div");
  panel.id = "tsPanel"; panel.hidden = true; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "Text spec");
  var open = null;
  function cell(v) {
    if (!v) return "<td>&ndash;</td>";
    return "<td>" + esc(v.value) + (v.token ? " <code>" + esc(v.token) + "</code>" : "") + "</td>";
  }
  function details(x) {
    open = x;
    document.querySelectorAll(".ts-open").forEach(function (e) { e.classList.remove("ts-open"); });
    if (x.el) x.el.classList.add("ts-open");
    var now = x.el ? spec(x.el, window) : null, cols = WIDTHS.filter(function (w) { return at[w]; });
    panel.innerHTML = "<h3>" + esc(x.id) + "</h3><p>" + esc(x.role + " · <" + x.tag + "> · section " + x.section + " · " + words(x.text) + " words, " + x.text.length + " characters") + "</p>" +
      "<table><thead><tr><th>Property</th><th>Now (" + innerWidth + " px)</th>" + cols.map(function (w) { return "<th>" + w + " px</th>"; }).join("") + "</tr></thead><tbody>" +
      PROPS.map(function (p) {
        var rule = now && now[p[0]].rule ? '<span class="ts-rule">' + esc(now[p[0]].rule + " { " + p[0] + ": " + now[p[0]].set + " }") + "</span>" : "";
        return "<tr><th>" + esc(p[1]) + rule + "</th>" + cell(now && now[p[0]]) + cols.map(function (w) { var s = at[w][x.id]; return cell(s && s[p[0]]); }).join("") + "</tr>";
      }).join("") + "</tbody></table>" +
      (cols.length ? "" : "<p>The 375, 768 and 1280 px columns appear once the page has been measured at those widths.</p>") +
      '<div class="ts-row"><button type="button" class="ts-q" data-ts-act="copy-one">Copy as JSON</button><button type="button" data-ts-act="close">Close</button></div>';
    panel.hidden = false;
  }
  document.addEventListener("click", function (e) {
    if (document.body.classList.contains("ts-bare")) return;
    if (panel.contains(e.target) || barEl.contains(e.target)) return;
    var el = e.target.closest && e.target.closest("[data-ts]"); if (!el) return;
    e.preventDefault(); e.stopPropagation();
    var x = list.filter(function (y) { return y.el === el && !y.reading; })[0];
    if (!x && el.classList.contains("who-sc-note")) {
      var t = squash(el.textContent);
      x = list.filter(function (y) { return y.reading && y.text === t; })[0] || list.filter(function (y) { return y.reading && y.el === el; })[0];
    }
    if (x) details(x);
  }, true);

  /* ---------- Export ---------- */
  function row(x) {
    var o = { id: x.id, section: x.section, role: x.role, element: x.tag, words: words(x.text), characters: x.text.length, text: x.text, widths: {} };
    WIDTHS.forEach(function (w) { if (at[w]) o.widths[w] = at[w][x.id] || null; });
    return o;
  }
  function csv() {
    var head = ["id", "section", "role", "element", "words", "characters", "text"];
    WIDTHS.forEach(function (w) { PROPS.forEach(function (p) { head.push(w + " " + p[1]); head.push(w + " " + p[1] + " token"); }); });
    var q = function (v) { v = v == null ? "" : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    return [head].concat(list.map(function (x) {
      var r = [x.id, x.section, x.role, x.tag, words(x.text), x.text.length, x.text];
      WIDTHS.forEach(function (w) { var s = at[w] && at[w][x.id]; PROPS.forEach(function (p) { r.push(s ? s[p[0]].value : ""); r.push(s ? s[p[0]].token : ""); }); });
      return r;
    })).map(function (r) { return r.map(q).join(","); }).join("\n") + "\n";
  }
  function download(name, text, type) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: type })); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }
  var toastEl = document.createElement("div"); toastEl.id = "tsToast"; toastEl.setAttribute("role", "status");
  function toast(m) { toastEl.textContent = m; toastEl.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(function () { toastEl.classList.remove("on"); }, 2500); }
  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { toast("Copied."); }, function () { toast("Copy was blocked. Use Download CSV."); });
  }

  /* ---------- The bar ---------- */
  var barEl = document.createElement("div");
  barEl.id = "tsBar"; barEl.setAttribute("role", "region"); barEl.setAttribute("aria-label", "Spec view");
  var FOLDER = (function () { var seg = location.pathname.split("/").filter(Boolean); if (seg.length && /\./.test(seg[seg.length - 1])) seg.pop(); return seg[seg.length - 1] || "page"; })();
  function bar(status) {
    var done = WIDTHS.filter(function (w) { return at[w]; }).length;
    barEl.innerHTML = "<b>Spec view</b><span class=\"ts-n\">" + (status || list.length + " texts · window " + innerWidth + " px" + (done ? " · measured at " + WIDTHS.join(", ") + " px" : "")) + "</span>" +
      '<button type="button" data-ts-act="measure"' + (measuring ? " disabled" : "") + ">" + (done ? "Measure again" : "Measure at 375 / 768 / 1280") + "</button>" +
      '<button type="button" class="ts-q" data-ts-act="csv">Download CSV</button>' +
      '<button type="button" class="ts-q" data-ts-act="json">Copy JSON</button>' +
      '<button type="button" class="ts-q" data-ts-act="bare" aria-pressed="' + document.body.classList.contains("ts-bare") + '">Hide labels</button>' +
      '<button type="button" class="ts-q" data-ts-act="exit">Exit</button>';
  }
  function act(a) {
    if (a === "measure") measureAll();
    else if (a === "csv") download(FOLDER + "-text-spec.csv", csv(), "text/csv");
    else if (a === "json") copy(JSON.stringify({ page: FOLDER, widths: WIDTHS, texts: list.map(row) }, null, 2));
    else if (a === "bare") { document.body.classList.toggle("ts-bare"); bar(); }
    else if (a === "copy-one" && open) copy(JSON.stringify(row(open), null, 2));
    else if (a === "close") { panel.hidden = true; open = null; document.querySelectorAll(".ts-open").forEach(function (e) { e.classList.remove("ts-open"); }); }
    else if (a === "exit") { var u = new URL(location.href); u.searchParams.delete("spec"); location.href = u.toString(); }
  }
  barEl.addEventListener("click", function (e) { var b = e.target.closest("[data-ts-act]"); if (b) act(b.dataset.tsAct); });
  panel.addEventListener("click", function (e) { var b = e.target.closest("[data-ts-act]"); if (b) act(b.dataset.tsAct); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.hidden) act("close"); });
  var rt;
  addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(label, 200); });

  function start() {
    document.body.classList.add("ts-on");
    [barEl, panel, toastEl].forEach(function (n) { document.body.appendChild(n); });
    label();
    /* the page's own script sets some text and the reading notes after load */
    setTimeout(label, 1500);
    measureAll();
  }
  if (document.readyState === "complete") start(); else addEventListener("load", start);
})();
