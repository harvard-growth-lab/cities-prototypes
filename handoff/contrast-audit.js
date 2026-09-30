/* WCAG 1.4.3 auditor, injected into the page. window.__audit() -> list of text runs
   with their displayed foreground / background, ratio, size and verdict.
   Text: every non-empty text node (plus input/select/textarea values and ::placeholder).
   Foreground: computed color (or SVG fill) with its own alpha and the opacity of the whole
   ancestor chain. Background: HTML ancestors' background colours composited root -> leaf
   (each with the cumulative opacity of its own subtree), then, for SVG text, every filled
   shape in the same svg that lies under the text's centre and is painted before it. */
(() => {
  if (window.__audit) return 1;
  const cv = document.createElement("canvas"); cv.width = cv.height = 1;
  const cx = cv.getContext("2d", { willReadFrequently: true });
  const cache = new Map();
  const parse = str => {
    if (cache.has(str)) return cache.get(str);
    let out;
    if (!str || str === "none" || str === "transparent") out = [0, 0, 0, 0];
    else {
      cx.clearRect(0, 0, 1, 1); cx.fillStyle = "#000"; cx.fillStyle = str; cx.fillRect(0, 0, 1, 1);
      const d = cx.getImageData(0, 0, 1, 1).data; out = [d[0], d[1], d[2], d[3] / 255];
    }
    cache.set(str, out); return out;
  };
  const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const ratio = (a, b) => { const la = lum(a), lb = lum(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
  const over = (fg, a, bg) => [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a)];
  const hex = c => "#" + c.map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
  const cs = el => getComputedStyle(el);
  const chainOf = el => { const a = []; for (let e = el; e && e.nodeType === 1; e = e.parentElement) a.unshift(e); return a; };
  const sig = el => {
    if (!el || !el.tagName) return "";
    const cl = (typeof el.className === "string" ? el.className : (el.className && el.className.baseVal) || "").split(/\s+/).filter(Boolean).slice(0, 2).join(".");
    return el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (cl ? "." + cl : "");
  };
  const pathOf = el => chainOf(el).slice(-4).map(sig).join(" > ");

  /* the HTML backdrop under an element: canvas white, then each ancestor's background */
  function backdrop(el, flags){
    let bg = [255, 255, 255], cum = 1;
    const chain = chainOf(el);
    for (const e of chain){
      const s = cs(e);
      const op = parseFloat(s.opacity); cum *= isNaN(op) ? 1 : op;
      if (s.backgroundImage && s.backgroundImage !== "none") flags.image = true;
      const c = parse(s.backgroundColor);
      if (c[3] > 0) bg = over(c, c[3] * cum, bg);
    }
    return { bg, cum };
  }
  /* SVG shapes painted under a point before `text` */
  let shapeCache = new Map();          /* one audit call only: cells move between states */
  function svgShapes(svg){
    if (shapeCache.has(svg)) return shapeCache.get(svg);
    const list = [...svg.querySelectorAll("rect,path,circle,ellipse,polygon")].map(e => ({ e, r: e.getBoundingClientRect() }))
      .filter(o => o.r.width > 0 && o.r.height > 0);
    shapeCache.set(svg, list); return list;
  }
  function svgBackdrop(textEl, base, flags){
    const svg = textEl.ownerSVGElement; if (!svg) return base;
    const r = textEl.getBoundingClientRect(), px = r.left + r.width / 2, py = r.top + r.height / 2;
    let bg = base;
    for (const o of svgShapes(svg)){
      if (o.r.left > px || o.r.right < px || o.r.top > py || o.r.bottom < py) continue;
      if (o.e.contains(textEl) || textEl.contains(o.e)) continue;
      /* the bounding box is a hint; the shape itself decides (an arc's box holds its hollow middle) */
      if (typeof o.e.isPointInFill === "function"){
        const m = o.e.getScreenCTM(); if (!m) continue;
        const pt = new DOMPoint(px, py).matrixTransform(m.inverse());
        if (!o.e.isPointInFill(pt)) continue;
      }
      if (!(o.e.compareDocumentPosition(textEl) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;   /* shape after text: painted over it */
      const s = cs(o.e);
      const c = parse(s.fill); if (c[3] <= 0 || s.fill === "none") continue;
      let cum = 1; for (let e = o.e; e && e.nodeType === 1; e = e.parentElement){ const op = parseFloat(cs(e).opacity); cum *= isNaN(op) ? 1 : op; }
      const fo = parseFloat(s.fillOpacity); const a = c[3] * (isNaN(fo) ? 1 : fo) * cum;
      if (a > 0.02) bg = over(c, a, bg);
    }
    return bg;
  }
  const clippedAway = el => {
    for (let e = el; e && e.nodeType === 1; e = e.parentElement){
      const r = e.getBoundingClientRect();
      if ((r.width <= 1.5 || r.height <= 1.5) && cs(e).overflow !== "visible" && e.tagName !== "svg") return true;
    }
    return false;
  };
  function measure(el, fgStr, fgAlphaExtra, sizeScale, sample, kind){
    const s = cs(el);
    const flags = {};
    const isSvg = !!el.ownerSVGElement || el.tagName.toLowerCase() === "text" || el.tagName.toLowerCase() === "tspan";
    const html = isSvg ? (el.ownerSVGElement.parentElement || el.ownerSVGElement) : el;
    const { bg: baseBg } = backdrop(isSvg ? el.ownerSVGElement : el, flags);
    let bg = isSvg ? svgBackdrop(el, baseBg, flags) : baseBg;
    /* cumulative opacity over the whole chain, for the text itself */
    let cum = 1; for (const e of chainOf(el)){ const op = parseFloat(cs(e).opacity); cum *= isNaN(op) ? 1 : op; }
    const fg = parse(fgStr);
    const fo = isSvg ? parseFloat(s.fillOpacity) : 1;
    const a = fg[3] * (isNaN(fo) ? 1 : fo) * cum * (fgAlphaExtra == null ? 1 : fgAlphaExtra);
    if (cum < 0.04) return null;
    const shown = over(fg, a, bg);
    const size = parseFloat(s.fontSize) * (sizeScale || 1);
    const weight = parseInt(s.fontWeight, 10) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = large ? 3 : 4.5;
    const r = ratio(shown, bg);
    return { r: +r.toFixed(2), need, pass: r >= need, fg: hex(shown), bg: hex(bg), size: +size.toFixed(1), weight, sample: sample.replace(/\s+/g, " ").trim().slice(0, 50),
      path: pathOf(el), cum: +cum.toFixed(2), image: !!flags.image, kind: kind || "text" };
  }
  window.__audit = () => {
    shapeCache = new Map();
    const out = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: n => !n.nodeValue.trim() ? NodeFilter.FILTER_REJECT :
        /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|OPTION|TITLE)$/.test(n.parentElement.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    let n;
    while ((n = w.nextNode())){
      const el = n.parentElement;
      if (el.closest("[hidden]") || el.closest(".leaflet-tile-pane")) continue;
      const rng = document.createRange(); rng.selectNodeContents(n);
      const rects = [...rng.getClientRects()].filter(r => r.width > 1 && r.height > 1);
      if (!rects.length) continue;
      const s = cs(el);
      if (s.visibility === "hidden" || s.display === "none") continue;
      if (el.closest(":disabled")) continue;
      if (clippedAway(el)) continue;
      const isSvg = !!el.ownerSVGElement;
      let scale = 1;
      if (isSvg){ const m = el.getScreenCTM && el.getScreenCTM(); if (m) scale = Math.hypot(m.a, m.b); }
      const m = measure(el, isSvg ? s.fill : s.color, 1, scale, n.nodeValue, "text");
      if (m) out.push(m);
    }
    /* form controls draw their own value and placeholder */
    document.querySelectorAll("input,textarea,select").forEach(el => {
      if (el.disabled || el.type === "hidden" || el.closest("[hidden]")) return;
      const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || cs(el).visibility === "hidden") return;
      const txt = el.tagName === "SELECT" ? (el.selectedOptions[0] ? el.selectedOptions[0].text : "") : el.value;
      if (txt) { const m = measure(el, cs(el).color, 1, 1, txt, "control"); if (m) out.push(m); }
      if (el.placeholder && !el.value){
        const ph = getComputedStyle(el, "::placeholder"); const m = measure(el, ph.color, 1, 1, el.placeholder, "placeholder");
        if (m) out.push(m);
      }
    });
    return out;
  };
  /* the edge of a field, a select: 1.4.11 wants 3:1 where the edge is what says "a control is here" */
  window.__controls = () => {
    const out = [];
    document.querySelectorAll("input:not([type=hidden]):not([type=checkbox]):not([type=radio]),textarea,select").forEach(el => {
      if (el.closest("[hidden]") || el.disabled) return;
      const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return;
      const s = cs(el); if (s.visibility === "hidden") return;
      let cum = 1; for (const e of chainOf(el)){ const op = parseFloat(cs(e).opacity); cum *= isNaN(op) ? 1 : op; } if (cum < 0.1) return;
      const flags = {}; const { bg } = backdrop(el.parentElement || el, flags);
      const own = parse(s.backgroundColor), fill = own[3] > 0 ? over(own, own[3], bg) : bg;
      const bw = Math.max(parseFloat(s.borderTopWidth) || 0, parseFloat(s.borderBottomWidth) || 0);
      const bcol = parseFloat(s.borderTopWidth) >= 1 ? s.borderTopColor : s.borderBottomColor, bc = parse(bcol);
      const edge = bw >= 1 && bc[3] > 0 ? ratio(over(bc, bc[3], bg), bg) : 0;
      out.push({ path: pathOf(el), border: bw, edge: +edge.toFixed(2), fill: +ratio(fill, bg).toFixed(2), id: el.id || "" });
    });
    return out;
  };
  return 1;
})()
