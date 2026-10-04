/* =========================================================================
   Boston MSA industry treemaps (d3)

   Renders two views off one dataset:
     1. #exportTreemapSvg     - static initial map, industries grouped by sector
     2. #tradableAnimatedSvg  - same map, then split into
                                Tradable (left, still sector-grouped/coloured)
                                Non-tradable (right, greyed)

   Both use a 1000x480 viewBox so they share the prototype's proportions.
   ========================================================================= */
(function(){
  "use strict";

  const WIDTH  = 880;    /* the figure measure: just proud of the 760 text measure, fonts 1:1 */
  const HEIGHT = 450;    /* wide-and-short (2:1) so the full map fits one view */
  const GREY   = "#9ca3af";

  /* "Color by" modes. Complexity and change are dummy values for the prototype,
     but held stable per industry so a cell keeps its shade across replays. */
  /* One seeded PRNG for every generated data value, so each figure reads
     the same on every load. Visual-only jitter may stay random. */
  let _prng = 20260826;
  function srand(){
    _prng = (_prng * 1664525 + 1013904223) >>> 0;
    return _prng / 4294967296;
  }

  const SECTOR     = "Sector";
  const COMPLEXITY = "Product complexity";
  const TRADABILITY = "Tradability";

  /* sampled from the reference build's complexity scale (cities.taimur.sh),
     which runs a diverging orange -> pale -> teal from least to most complex.
     The legend's gradient under the figure uses the same five stops. */
  const complexityPalette = ["#e4a368","#efc9a5","#f8e7d7","#89ccc7","#008379"];
  const complexityByName = new Map();

  /* Tradability 0 -> 1: how much of an industry's output is sold outside
     the region. A diverging ramp — russet (locally consumed) through a
     neutral gray to the theme teal (widely traded) — because the midpoint
     means "neither". Poles are lightness-matched (OKLab L .45/.43) and sit
     on opposite sides of the blue–yellow axis, so the direction survives
     red-green colourblindness (poles ΔE 9.9 protan, target ≥8); the russet
     pole keeps ΔE 24 from the complexity ramp's terracotta. */
  function token(name, fallback){
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue(name).trim();
    return v || fallback;
  }

  let _tradScale = null;
  function tradabilityScale(v){
    if (!_tradScale) {
      _tradScale = d3.scaleLinear()
        .domain([0, 0.25, 0.5, 0.75, 1])
        .range(["#7f451e", "#b97f4e", "#efeeec",
                "#67929f", token("--teal", "#255862")])
        .interpolate(d3.interpolateLab)
        .clamp(true);
    }
    return _tradScale(v);
  }

  /* tradability, RCA, PCI and the tier per industry are read from the rows
     below, once they exist; see after rawData */
  /* Dummy admin share of each sector's metro jobs — downtown-weighted
     sectors run high, land-hungry ones low. Authored as relative
     propensities and scaled, once the rows exist, so their jobs-weighted
     mean is the 687,736 jobs LEHD counts inside the city: 30% of the
     metro's real 2,318,250. One table to swap for real place-level
     (2-digit) employment when it arrives. */
  const ADMIN_SHARE = {
    "Construction": 0.13, "Education & Health": 0.32,
    "Financial Activities": 0.38, "Leisure & Hospitality": 0.25,
    "Manufacturing": 0.08, "Natural Resources": 0.03,
    "Other": 0.19, "Professional & Business": 0.34,
    "Trade & Transportation": 0.16
  };
  function tradabilityOf(name){ return tradByName.has(name) ? tradByName.get(name) : 0; }
  /* the tier the source assigns, 0 traded, 1 partly traded, 2 local */
  function tierOf(name){ return tierByName.has(name) ? tierByName.get(name) : 2; }

  const colorMode  = { exportTreemapSvg:SECTOR, tradableAnimatedSvg:SECTOR,
                       complexityTreemapSvg:COMPLEXITY };

  /* Which cells are currently on the grey (non-tradable) side, per svg, so a
     later "Color by" change can recolour without losing the split. */
  const splitState = { exportTreemapSvg:null, tradableAnimatedSvg:null };

  /* the five bins are the metro's own quintiles of PCI in 2024; the one
     industry with no PCI in the source sits in the middle bin */
  const PCI_CUTS = [-0.72, -0.4, 0.08, 0.65];
  function complexityColor(name){
    if(!complexityByName.has(name)){
      const v = pciByName.get(name);
      let bin = 2;
      if (v != null){ bin = 0; while (bin < PCI_CUTS.length && v >= PCI_CUTS[bin]) bin++; }
      complexityByName.set(name, complexityPalette[bin]);
    }
    return complexityByName.get(name);
  }

  function tradabilityColor(name){ return tradabilityScale(tradabilityOf(name)); }

  /* Fill for one industry cell. Non-tradable cells stay grey in every mode —
     grey encodes "non-tradable", not a sector. */
  function cellFill(svgId, d, grey){
    if (grey) return GREY;
    const mode = colorMode[svgId];
    if (mode === COMPLEXITY) return complexityColor(d.data.name);
    if (mode === TRADABILITY) return tradabilityColor(d.data.name);
    return sectorColors[d.parent.data.name];
  }

  /* The nine sector colours, made for this page (sector-palette-sketches.html
     has the working). The reference's set put three warm reds on the three
     biggest blocks, and for a red-green colour-blind reader manufacturing,
     construction and other were one colour. Here the three big blocks are
     three families - navy, coral, mint - and the rest step down a lightness
     ladder (OKLab L .86 to .40) so that without red-green vision, where
     only lightness and blue-yellow survive, every pair still clears an
     OKLab distance of 8, bar professional/other for a protanope at 7.7.
     Chroma stays where the page's own colours sit, and teal, which already
     means the brand, the traded tier and the complex end of the ramp, is
     left alone. Natural resources is the one compromise: the ladder's free
     rung was a forest green too dark for a key, so it takes a grass green
     that reads plainly in normal vision (distance 17) and, having no area on
     the map, is only ever met in the key and the table, where its name
     carries it. */
  const sectorColors = {
    "Construction": "#a25d37",
    "Education & Health": "#dc8271",
    "Financial Activities": "#e5c95e",
    "Leisure & Hospitality": "#9adfe7",
    "Manufacturing": "#7f3c6b",
    "Natural Resources": "#5d9850",
    "Other": "#896885",
    "Professional & Business": "#485fa2",
    "Trade & Transportation": "#86c8ab"
  };
  /* the sets the sector-colour study offers: the house set as shipped, and
     a set of another character altogether - Paul Tol's muted scheme (SRON,
     2021), the one published nine-colour set rated colour-blind safe, with
     its teal given up to the brand and a grey on Other in its place, and
     its rose a shade lighter so the labels on it read 4.5 to 1. Wine,
     rose and sand on the three big blocks; every pair clears an OKLab
     distance of 8 in normal, protan and deutan vision (9.5 / 9.2 / 8.0;
     the scoring is on sector-palette-sketches.html). sectorColors is
     written over in place, since the map, the cells, the bars and the
     cards all read it at paint. */
  const SECTOR_PALETTES = {
    house: Object.assign({}, sectorColors),
    tol: {
      "Construction": "#aa4499",
      "Education & Health": "#cf6b7b",
      "Financial Activities": "#999933",
      "Leisure & Hospitality": "#88ccee",
      "Manufacturing": "#332288",
      "Natural Resources": "#117733",
      "Other": "#b3b3b3",
      "Professional & Business": "#882255",
      "Trade & Transportation": "#ddcc77"
    }
  };

  /* Boston-Cambridge-Newton (metro 14460), 2024, 6-digit NAICS, as the
     reference build's "What We Produce" page carries it, from
     industries-2024.js: name, short name, code, jobs, the group and
     subsector it belongs to, the Growth Lab sector, the RCA against the
     national mix and the peer metros', the PCI, the tradability score 0 to
     1 and the tier the source assigns (0 traded, 1 partly traded, 2 local).
     877 industries, 2,318,249 jobs. "Tradable at all" is the traded tier. */
  const SRC = window.BOSTON_INDUSTRIES_2024 || { fields: [], rows: [], sectors: [], total: 0 };
  const SECTOR_KEYS = SRC.sectors || [];
  const sectorLabelOf = Object.fromEntries(SECTOR_KEYS.map(s => [s.key, s.label]));
  /* the rows of one year's file, as objects */
  function rowsFrom(src){
    if (!src) return [];
    return src.rows.map(a => {
      const o = {};
      src.fields.forEach((f, i) => { o[f] = a[i]; });
      o.sector = sectorLabelOf[o.sectorKey] || o.sectorKey;
      o.tradable = o.tier === 0;
      return o;
    });
  }
  /* the years the industry figure can show, the latest first; 2014 is the
     source's group totals split at 2024's grain (see industries-2014.js) */
  const YEARS = { 2024: window.BOSTON_INDUSTRIES_2024, 2014: window.BOSTON_INDUSTRIES_2014 };
  const rawData = rowsFrom(SRC);
  const rowByName = new Map(rawData.map(r => [r.name, r]));
  const peerRcaByName = new Map(rawData.filter(r => r.peerRca != null).map(r => [r.name, r.peerRca]));

  /* Tradability, RCA, PCI and the tier per industry, as the source gives
     them; nothing here is generated any more */
  const tradByName = new Map(rawData.map(r => [r.name, r.trad]));
  const tierByName = new Map(rawData.map(r => [r.name, r.tier]));
  const rcaReal    = new Map(rawData.map(r => [r.name, Math.round(r.rca * 100) / 100]));
  const pciByName  = new Map(rawData.map(r => [r.name, r.pci]));
  const tradableByName = new Map(rawData.map(r => [r.name, r.tradable]));

  /* every industry, at its real 2024 employment: 2,318,250 jobs over 292
     industries. The commuting section's LEHD figures (687,736 jobs inside
     the admin city) were told against a drawn total of 2.82M; against the
     real total they are 30% of the metro's jobs, not 24%. */
  const industryData = [...rawData].sort((a, b) => b.employ - a.employ);
  const ADMIN_JOBS = 687736;
  {
    const w = industryData.reduce((a, d) => a + d.employ * (ADMIN_SHARE[d.sector] ?? 0.15), 0);
    const k = ADMIN_JOBS / w;
    Object.keys(ADMIN_SHARE).forEach(sec => { ADMIN_SHARE[sec] = Math.round(ADMIN_SHARE[sec] * k * 1000) / 1000; });
  }

  /* Build the sector -> industries hierarchy for a given set of rows. */
  function hierarchyFor(rows, label){
    const bySector = {};
    rows.forEach(d => {
      (bySector[d.sector] = bySector[d.sector] || []).push({ name: d.name, value: d.employ });
    });
    return {
      name: label,
      children: Object.entries(bySector).map(([sector, children]) => ({ name: sector, children }))
    };
  }

  /* Lay out a sector-grouped treemap into a box of the given width. */
  function layout(rows, label, boxWidth){
    const node = d3.hierarchy(hierarchyFor(rows, label)).sum(d => d.value);
    d3.treemap().size([boxWidth, HEIGHT])
      .paddingTop(1).paddingRight(1).paddingBottom(1).paddingLeft(1)(node);
    return node;
  }

  /* Truncate a label to what actually fits, or drop it when the cell is tiny. */
  /* The cell labels are drawn in the figure's own 880-unit box, so on a
     phone an 11-unit label renders at under 5px. The stylesheet raises the
     unit size at narrow widths; this reads that back, because the budget
     fitLabel spends — 8 units a character, a 20-unit floor under the cell,
     a baseline 11 units down — was written for 11-unit type and has to
     scale with it or the names overrun the cells they name.
     At 11 the arithmetic is exactly what it always was. */
  const LAB_BASE = 11;
  function labUnit(){
    const el = document.getElementById("miTreemapSvg");
    if (!el) return LAB_BASE;
    const v = parseFloat(getComputedStyle(el).getPropertyValue("--mi-lab"));
    return v > 0 ? v : LAB_BASE;
  }
  function fitLabel(name, box, unit){
    const u = unit || LAB_BASE;
    if (box.width < 40 || box.height < 20 * (u / LAB_BASE)) return "";
    const chars = Math.floor((box.width - 8) / (8 * (u / LAB_BASE)));
    if (chars <= 3) return "";
    return name.length > chars ? name.slice(0, chars - 3) + "…" : name;
  }

  /* The cells of the industry figure are labelled as Metroverse labels its
     composition map: the full name at the top left, wrapped by whole words
     and set as large as the cell allows, and the industry's share of all
     jobs centred along the bottom in larger, lighter numerals. A name is
     never cut: if it cannot be set whole at the smallest size, the cell
     carries no text at all, rather than a stub like "X...". Widths come
     from a canvas, which measures the same whether or not the figure is on
     screen - the cells are built while their page is still hidden. */
  const _labCtx = (function(){
    try { return document.createElement("canvas").getContext("2d"); } catch (e){ return null; }
  })();
  const LAB_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  /* measured at the size it will be set at, never scaled from another: the
     system face tracks tighter as it grows, so 8px type runs wider than a
     twelfth of the same words at 100px - which is how names came to overrun
     the smallest cells */
  const _textW = new Map();
  function textW(str, f, weight){
    const key = weight + "|" + f + "|" + str;
    if (_textW.has(key)) return _textW.get(key);
    let w;
    if (_labCtx){ _labCtx.font = weight + " " + f + "px " + LAB_STACK; w = _labCtx.measureText(str).width * 1.03; }
    else w = str.length * f * 0.58;
    _textW.set(key, w);
    return w;
  }
  function wrapWords(name, maxW, f){
    const lines = [];
    let line = "";
    for (const w of name.split(/\s+/)){
      if (textW(w, f, 400) > maxW) return null;        /* a word that will not fit: no cutting */
      const next = line ? line + " " + w : w;
      if (line && textW(next, f, 400) > maxW){ lines.push(line); line = w; }
      else line = next;
    }
    if (line) lines.push(line);
    return lines;
  }
  const _labSpec = new Map();
  /* k is the unit scale the stylesheet asks for at this width (1 on desktop) */
  function cellLabelSpec(name, w, h, k, pctText){
    const key = name + "|" + Math.round(w) + "|" + Math.round(h) + "|" + k + "|" + pctText;
    if (_labSpec.has(key)) return _labSpec.get(key);
    let out = null;
    if (w >= 26 * k && h >= 14 * k){
      const pad = Math.max(3, Math.min(7, Math.min(w, h) * 0.05)) * Math.min(k, 1.4);
      const minF = 8 * k, maxF = Math.max(minF, Math.min(18 * k, Math.min(w, h) * 0.16));
      const availW = w - 2 * pad, LH = 1.14;
      const sizes = [];
      for (let f = Math.floor(maxF); f > minF; f -= 1) sizes.push(f);
      sizes.push(minF);
      const tryFit = withPct => {
        for (const f of sizes){
          const lines = wrapWords(name, availW, f);
          if (!lines) continue;
          let pf = 0, need = pad + lines.length * f * LH + pad;
          if (withPct){
            pf = Math.round(Math.min(26 * k, Math.max(9 * k, f * 1.5), h * 0.24));
            while (pf > 9 * k && textW(pctText, pf, 300) > availW) pf -= 1;
            if (textW(pctText, pf, 300) > availW) continue;
            need += pf * 1.05 + pad * 0.5;
          }
          if (need <= h) return { f: f, lines: lines, pf: pf, pad: pad, lh: LH };
        }
        return null;
      };
      out = (h >= 30 * k && w >= 36 * k ? tryFit(true) : null) || tryFit(false);
    }
    _labSpec.set(key, out);
    return out;
  }
  /* White on the deeper fills, ink on the light ones - chosen on the
     contrast each one actually has with the fill, not on a brightness
     score. The perceived-lightness test this used to run put white on four
     of the nine sector fills that read far better in ink: the two largest
     blocks on the map, education & health and trade & transportation, were
     carrying their names at 2.7:1 and 2.4:1 where ink gives 6.1 and 6.7.
     Three fills used to clear 4.5:1 with neither ink - manufacturing,
     other, and the ramp's darkest green. Each has since been taken down
     about five points of L*, the smallest move that carries white text at
     4.6:1, so every fill in the figure now reads. */
  const CELL_INK = "#1a2226";
  const relLum = c => {
    const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const LUM_INK = relLum({ r: 26, g: 34, b: 38 });
  function cellInk(fill){
    const c = d3.color(fill); if (!c) return "#fff";
    const L = relLum(c.rgb());
    const onWhite = 1.05 / (L + 0.05);
    const onInk = (L + 0.05) / (LUM_INK + 0.05);
    return onInk >= onWhite ? CELL_INK : "#fff";
  }

  /* Draw the sector-grouped map into an <svg>, returning its pieces. */
  function draw(svgEl){
    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();

    const root = layout(industryData, "root", WIDTH);
    root.children.forEach(s => { s.key = "L:" + s.data.name; });

    // Separate layers keep sector blocks behind the industry cells.
    const sectorLayer   = svg.append("g").attr("class", "sector-layer");
    const industryLayer = svg.append("g").attr("class", "industry-layer");

    sectorLayer.selectAll("rect")
      .data(root.children, d => d.key)
      .join("rect")
      .attr("class", "sector-rect")
      .attr("x", d => d.x0).attr("y", d => d.y0)
      .attr("width", d => d.x1 - d.x0).attr("height", d => d.y1 - d.y0)
      .attr("fill", d => sectorColors[d.data.name]);

    const cells = industryLayer.selectAll("g")
      .data(root.leaves())
      .join("g")
      .attr("class", "industry");

    // rect.cell so the "Color by" control can target these.
    // Fully opaque: the sector blocks sit behind these cells, and a translucent
    // cell would composite over them and muddy the complexity palette.
    cells.append("rect")
      .attr("class", "cell industry-rect")
      .attr("x", d => d.x0).attr("y", d => d.y0)
      .attr("width", d => d.x1 - d.x0).attr("height", d => d.y1 - d.y0)
      .attr("fill", d => cellFill(svgEl.id, d, false));

    cells.append("text")
      .attr("class", "industry-text")
      .attr("x", d => d.x0 + 4).attr("y", d => d.y0 + 11)
      .style("font-size", "8px")
      .text(d => fitLabel(d.data.name, { width: d.x1 - d.x0, height: d.y1 - d.y0 }));

    return { svg, root, sectorLayer, cells };
  }

  /* ---------- 1. static map ---------- */
  function renderStaticTreemap(){
    const el = document.getElementById("exportTreemapSvg");
    if (el) draw(el);
  }

  /* the complexity beat: the same mix drawn again, shaded by how much
     knowledge each industry takes rather than which sector it sits in */
  function renderComplexityTreemap(){
    const el = document.getElementById("complexityTreemapSvg");
    if (el) draw(el);
  }
  function initComplexityTooltip(){
    const svgEl = document.getElementById("complexityTreemapSvg");
    const tip = document.getElementById("complexityTip");
    const wrap = svgEl && svgEl.closest(".tradable-viz-wrapper");
    if (!svgEl || !tip || !wrap) return;
    attachCellTip(svgEl, wrap, tip);
  }

  /* ---------- 2. animated split ---------- */
  /* ---------- 3. the tradable split ----------
     Ported from v-2: the metro's mix parts into two halves, the industries
     that sell outward keeping their sector colours on the left and the ones
     serving the people already here going grey on the right. Which side an
     industry lands on follows its own tradability score, so the split is the
     same one the beat's donut and the tooltips report. */
  function initTradableAnimation(){
    const el = document.getElementById("tradableAnimatedSvg");
    if (!el) return;

    const { svg, root, sectorLayer, cells } = draw(el);
    const allLeaves = root.leaves();

    function reset(){
      sectorLayer.selectAll(".sector-rect").interrupt();
      sectorLayer.selectAll(".sector-rect")
        .data(root.children, d => d.key)
        .join("rect")
        .attr("class", "sector-rect")
        .attr("x", d => d.x0).attr("y", d => d.y0)
        .attr("width", d => d.x1 - d.x0).attr("height", d => d.y1 - d.y0)
        .attr("fill", d => sectorColors[d.data.name])
        .style("opacity", 1);

      cells.select(".cell").interrupt()
        .attr("x", d => d.x0).attr("y", d => d.y0)
        .attr("width", d => d.x1 - d.x0).attr("height", d => d.y1 - d.y0)
        .attr("fill", d => cellFill(el.id, d, false));

      cells.select(".industry-text").interrupt()
        .style("opacity", 1)
        .attr("x", d => d.x0 + 4).attr("y", d => d.y0 + 11)
        .text(d => fitLabel(d.data.name, { width: d.x1 - d.x0, height: d.y1 - d.y0 }));

      el.classList.remove("animated");
      document.querySelectorAll(".tradable-split-header")
        .forEach(h => h.classList.remove("is-on"));
    }

    function run(){
      reset();

      /* which side an industry lands on is its own tradability score, not a
         random draw as in v-2 — the halves then agree with the donut above
         the chart and with every tooltip */
      const nonTradableNames = new Set(
        allLeaves.filter(d => !isTradable(d.data.name)).map(d => d.data.name));

      const tradable    = allLeaves.filter(d => !nonTradableNames.has(d.data.name));
      const nonTradable = allLeaves.filter(d =>  nonTradableNames.has(d.data.name));

      // Equal-width halves, both using the full height.
      const gap = 6;
      const half = (WIDTH - gap) / 2;
      const rightX = half + gap;

      // Left keeps the sector grouping; right is a flat grey treemap.
      const left = layout(
        tradable.map(d => ({ name: d.data.name, employ: d.value, sector: d.parent.data.name })),
        "L", half
      );
      const right = d3.hierarchy({
        name: "R",
        children: nonTradable.map(d => ({ name: d.data.name, value: d.value }))
      }).sum(d => d.value);
      d3.treemap().size([half, HEIGHT])
        .paddingTop(1).paddingRight(1).paddingBottom(1).paddingLeft(1)(right);

      const box = new Map();
      left.leaves().forEach(n => box.set(n.data.name,
        { x: n.x0, y: n.y0, width: n.x1 - n.x0, height: n.y1 - n.y0, grey: false }));
      right.leaves().forEach(n => box.set(n.data.name,
        { x: rightX + n.x0, y: n.y0, width: n.x1 - n.x0, height: n.y1 - n.y0, grey: true }));

      // Sector blocks now describe the left half only.
      left.children.forEach(s => { s.key = "L:" + s.data.name; });
      const blocks = sectorLayer.selectAll(".sector-rect").data(left.children, d => d.key);

      blocks.exit().transition().duration(500).style("opacity", 0).remove();

      blocks.enter().append("rect")
        .attr("class", "sector-rect")
        .attr("x", d => d.x0).attr("y", d => d.y0)
        .attr("width", d => d.x1 - d.x0).attr("height", d => d.y1 - d.y0)
        .attr("fill", d => sectorColors[d.data.name])
        .style("opacity", 0)
        .transition().delay(700).duration(700).style("opacity", 1);

      blocks.transition().duration(1200).ease(d3.easeCubicInOut)
        .attr("x", d => d.x0).attr("y", d => d.y0)
        .attr("width", d => d.x1 - d.x0).attr("height", d => d.y1 - d.y0);

      cells.select(".industry-text").transition().duration(300).style("opacity", 0);

      cells.select(".cell")
        .transition().duration(1200).ease(d3.easeCubicInOut)
        .attr("x", d => box.get(d.data.name).x)
        .attr("y", d => box.get(d.data.name).y)
        .attr("width", d => box.get(d.data.name).width)
        .attr("height", d => box.get(d.data.name).height)
        .attr("fill", d => cellFill(el.id, d, box.get(d.data.name).grey))
        .on("end", function(d, i){
          if (i !== cells.size() - 1) return;   // run the follow-up once
          cells.select(".industry-text")
            .attr("x", d => box.get(d.data.name).x + 4)
            .attr("y", d => box.get(d.data.name).y + 11)
            .text(d => fitLabel(d.data.name, box.get(d.data.name)))
            .transition().duration(400).style("opacity", 1);
        });

      splitState[el.id] = box;
      if (tradableClearHover) tradableClearHover();
      el.classList.add("animated");
      /* the scrolly lifts both the chart and its split headers out of the
         subsection, so the reveal is set on the headers themselves rather
         than on an ancestor the two no longer share */
      const section = el.closest(".export-subsection");
      if (section) section.classList.add("animated");
      document.querySelectorAll(".tradable-split-header")
        .forEach(h => h.classList.add("is-on"));
    }

    const btn = document.getElementById("replayBtn");
    if (btn) btn.addEventListener("click", run);

    // Play once when the section first scrolls into view.
    new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        setTimeout(run, 300);
        obs.disconnect();
      });
    }, { threshold: 0.35 }).observe(el);
  }

  /* Repaint one treemap for the given "Color by" mode, preserving any
     tradable/non-tradable split already on screen. `legends` maps a mode to the
     id of the legend that explains it. */
  function setColorBy(svgId, mode, legends){
    colorMode[svgId] = mode;
    const split = splitState[svgId];
    d3.select("#" + svgId).selectAll(".cell")
      .attr("fill", d => cellFill(svgId, d, split ? !!(split.get(d.data.name) || {}).grey : false));

    if (svgId === "exportTreemapSvg"){
      refreshExportOption();
      updateExportHeadStat();
    }

    if (legends) {
      const show = (id, on) => {
        const el = id && document.getElementById(id);
        if (el) el.classList.toggle("show", on);
      };
      show(legends.complexity, mode === COMPLEXITY);
      show(legends.change,     mode === TRADABILITY);
    }
  }

  /* =====================================================================
     3 · Specialization (RCA)

     RCA = the industry's share of local jobs divided by its share of jobs
     across US metros (the benchmark). Above 1.0 means the industry is more
     concentrated here than it is nationally.

     Dummy values for the prototype, held stable per industry. A handful of
     plausible Boston strengths are seeded by hand; the rest are random with
     most sitting below 1.0.
     ===================================================================== */
  const RCA_TOP_N = 10;

  /* The RCA values below are no longer read - the source carries the real
     ones - but the short names are, matched on the name with its
     punctuation removed, since the source spells "Colleges, Universities,
     and Professional Schools" with commas. */
  const rcaSeed = {
    /* short names for the rows the real ranking brings up */
    "Seafood Product Preparation and Packaging":                                  { rca: 0, short: "Seafood preparation" },
    "Computer and Peripheral Equipment Manufacturing":                            { rca: 0, short: "Computer equipment makers" },
    "Textile and Fabric Finishing and Fabric Coating Mills":                      { rca: 0, short: "Textile finishing mills" },
    "Industrial Machinery Manufacturing":                                         { rca: 0, short: "Industrial machinery" },
    "Web Search Portals, Libraries, Archives, and Other Information Services":    { rca: 0, short: "Information services" },
    "School and Employee Bus Transportation":                                     { rca: 0, short: "School and employee buses" },
    "Colleges Universities and Professional Schools":                             { rca: 5.4, short: "Colleges and universities" },
    "Scientific Research and Development Services":                               { rca: 4.1, short: "Scientific R&D services" },
    "Other Financial Investment Activities":                                      { rca: 3.6, short: "Other financial investment" },
    "Pharmaceutical and Medicine Manufacturing":                                  { rca: 3.2, short: "Pharmaceutical manufacturing" },
    "Junior Colleges":                                                            { rca: 2.9, short: "Junior colleges" },
    "General Medical and Surgical Hospitals":                                     { rca: 2.7, short: "General medical hospitals" },
    "Management Scientific and Technical Consulting Services":                    { rca: 2.4, short: "Management consulting" },
    "Computer Systems Design and Related Services":                               { rca: 2.2, short: "Computer systems design" },
    "Medical and Diagnostic Laboratories":                                        { rca: 2.0, short: "Medical and diagnostic labs" },
    "Navigational Measuring Electromedical and Control Instruments Manufacturing":{ rca: 1.9, short: "Navigational instruments" },
    "Medical Equipment and Supplies Manufacturing":                               { rca: 1.7, short: "Medical equipment manufacturing" },
    "Securities and Commodity Contracts Intermediation and Brokerage":            { rca: 1.5, short: "Securities brokerage" },
    "Other Information Services":                                                 { rca: 1.42, short: "Other information services" },
    "Architectural Engineering and Related Services":                             { rca: 1.3, short: "Architectural and engineering" },
    "Insurance Carriers":                                                         { rca: 1.24, short: "Insurance carriers" },
    "Software Publishers":                                                        { rca: 1.15, short: "Software publishers" },
    "Legal Services":                                                             { rca: 1.08, short: "Legal services" }
  };
  const normName = n => String(n).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const shortByNorm = new Map(Object.entries(rcaSeed).map(([n, v]) => [normName(n), v.short]));
  /* the source's own short name where the row carries one, the older
     hand-written one otherwise */
  const shortLabel = name => {
    const r = rowByName.get(name);
    return (r && r.short) || shortByNorm.get(normName(name));
  };

  /* tradable at all, for the figures that split two ways and for the
     specialisation list, is the source's own flag: the traded tier and the
     more outward part of the partly traded one */
  function isTradable(name){ return tradableByName.get(name) === true; }

  function rcaOf(name){ return rcaReal.has(name) ? rcaReal.get(name) : 0; }

  const totalCityJobs = industryData.reduce((s, d) => s + d.employ, 0);

  function specialized(rows){
    const set = rows || industryData;
    const total = set.reduce((a, d) => a + d.employ, 0) || 1;
    return set
      .filter(d => isTradable(d.name) && rcaOf(d.name) > 1)
      .map(d => {
        const rca = rcaOf(d.name);
        // Shares behind the ratio, so a tooltip can show numbers that
        // actually divide out to the multiplier rather than asserting it.
        const localPct = d.employ / total * 100;
        return {
          name: d.name,
          sector: d.sector,
          employ: d.employ,
          rca: rca,
          localPct: localPct,
          worldPct: localPct / rca,
          label: shortLabel(d.name) ||
                 (d.name.length > 40 ? d.name.slice(0, 37) + "…" : d.name)
        };
      })
      .sort((a, b) => b.rca - a.rca);
  }

  const cityName = (document.querySelector(".city-short") || {}).textContent || "Your city";
  const fmtJobs = n => Math.round(n).toLocaleString();
  /* One decimal, except near the benchmark: 1.02 rounded to "1×" would read as
     sitting on the line, contradicting a chart filtered to everything above it. */
  const fmtX = v => {
    const one = Math.round(v * 10) / 10;
    return (one <= 1 ? v.toFixed(2) : one) + "×";
  };

  let rcaShowAll = false;
  /* "bar" (live design) or "dot" — the alternative, reachable from the viz bar.
     Bars read the excess over the benchmark as a length, which is the quantity
     the chart is actually about; the dot form encodes employment in its radius
     as well, which the row tooltip now carries either way. */
  let rcaDesign = "bar";

  /* Shared axis header for both RCA charts, so they read identically.
     "RCA = 1" sits at the head of the benchmark line and reads rightwards from
     it; the axis title shares that baseline and is centred over the scale —
     nudged right only if it would otherwise run into the marker. */
  const RCA_LABEL_ZONE = 84;   // width reserved for the "RCA = 1" marker

  function drawAxisHeader(svg, x, plotR, MT, gridBottom, plainLabel){
    const baseline = MT - 40;

    svg.append("line").attr("class", "rca-benchmark")
      .attr("x1", x(1)).attr("y1", MT - 12).attr("x2", x(1)).attr("y2", gridBottom);

    // Centred on the scale *after* the marker's zone. Measuring the rendered
    // text would be exact, but getComputedTextLength returns 0 while the page
    // is hidden at init, so the clamp would silently never fire.
    svg.append("text").attr("class", "rca-axis-title")
      .attr("x", (x(1) + RCA_LABEL_ZONE + plotR) / 2).attr("y", baseline)
      .attr("text-anchor", "middle")
      .text("Times more concentrated in this metro than in the US metros");

    const bench = svg.append("g").attr("class", "rca-bench-hit");
    bench.append("rect")
      .attr("x", x(1) - 6).attr("y", MT - 29)
      .attr("width", 74).attr("height", 16);
    /* the marker sits just above the line it names, dressed like a tick —
       an axis annotation, not a second title */
    bench.append("text")
      .attr("class", "rca-benchmark-label" + (plainLabel ? " rca-benchmark-label--plain" : ""))
      .attr("x", x(1) + 7).attr("y", MT - 17).attr("text-anchor", "start")
      .text("RCA = 1");

    return bench;
  }

  /* Sits above the band's top-left corner, reading left to right across it —
     a title over the three rows rather than a note against any one of them. */
  function topTag(svg, rows, x0, y, versusPeers){
    if (rows.length < 3) return;
    let text = "Most concentrated tradable industries";
    if (versusPeers) {
      const ahead = rows.slice(0, 3).filter(d => d.ahead).length;
      text = ahead === 3 ? "All three beat their peers"
           : ahead === 0 ? "All three trail their peers"
           : "Mixed against peers";
    }
    svg.append("text").attr("class", "rca-top-tag")
      .attr("x", x0).attr("y", y).attr("text-anchor", "start").text(text);
  }

  function renderRcaChart(){
    const el = document.getElementById("rcaChartSvg");
    if (!el) return;

    const all  = specialized();
    const rows = rcaShowAll ? all : all.slice(0, RCA_TOP_N);

    // Employment now lives in the row tooltip, so the plot takes that width.
    const W = 880, ML = 300, MT = 76, MB = 26, RH = 34;
    const PLOT_R = 800;
    const H = MT + rows.length * RH + MB;

    const svg = d3.select(el)
      .attr("viewBox", "0 0 " + W + " " + H)
      .attr("height", H);
    svg.selectAll("*").remove();

    // Axis starts at 1, not 0. Nothing is ever drawn below the benchmark on a
    // chart filtered to RCA > 1, so a 0–1 stretch would be dead space between
    // the labels and the line. Stems measure excess over 1.0, so 1 is the
    // meaningful origin here.
    const x = d3.scaleLinear()
      .domain([1, d3.max(all, d => d.rca) * 1.05])
      .range([ML + 10, PLOT_R]);
    const rad = d3.scaleSqrt()
      .domain([0, d3.max(all, d => d.employ)])
      .range([3.5, 13]);

    const rowY = i => MT + i * RH + RH / 2;
    const gridBottom = MT + rows.length * RH;

    // Behind the gridlines and everything else, so the band tints the rows
    // without hiding any part of the chart drawn over it.
    if (rows.length >= 3) {
      svg.append("rect").attr("class", "rca-top-band")
        .attr("x", 0).attr("y", MT).attr("width", W).attr("height", 3 * RH);
    }

    svg.append("line").attr("class", "rca-axis")
      .attr("x1", x.range()[0]).attr("y1", MT - 12).attr("x2", PLOT_R).attr("y2", MT - 12);

    // whole-number ticks only; 1 is drawn as the benchmark instead
    const hi = Math.floor(x.domain()[1]);
    for (let t = 2; t <= hi; t++) {
      svg.append("line").attr("class", "rca-grid")
        .attr("x1", x(t)).attr("y1", MT - 12).attr("x2", x(t)).attr("y2", gridBottom);
      svg.append("text").attr("class", "rca-tick")
        .attr("x", x(t)).attr("y", MT - 20).attr("text-anchor", "middle").text(t + "×");
    }

    const bench = drawAxisHeader(svg, x, PLOT_R, MT, gridBottom, false);

    const tip  = document.getElementById("rcaTip");
    const wrap = el.parentElement;
    if (tip && wrap) {
      bench
        .on("mouseenter", function(){
          const b = this.getBoundingClientRect();
          const w = wrap.getBoundingClientRect();
          tip.hidden = false;
          const left = b.left - w.left + b.width / 2 - tip.offsetWidth / 2;
          tip.style.left = Math.max(0, Math.min(left, w.width - tip.offsetWidth)) + "px";
          tip.style.top  = (b.bottom - w.top + 8) + "px";
        })
        .on("mouseleave", function(){ tip.hidden = true; });
    }

    const g = svg.selectAll(".rca-row").data(rows).join("g").attr("class", "rca-row");

    // Both charts sort by RCA, so "first three" is the same three industries in
    // each — which is what lets the peer label refer back to the other chart.
    g.classed("is-top", (d, i) => i < 3);

    g.append("rect").attr("class", "rca-hit")
      .attr("x", 0).attr("y", (d, i) => MT + i * RH)
      .attr("width", W).attr("height", RH);

    g.append("text").attr("class", "rca-label")
      .attr("x", ML - 16).attr("y", (d, i) => rowY(i) + 4)
      .attr("text-anchor", "end").text(d => d.label);

    if (rcaDesign === "bar") {
      // Bars run from the benchmark, not from zero, so their length is the
      // excess over 1.0 rather than a total measured from an origin no row
      // ever reaches. Employment is not encoded in the mark here — it only
      // appears in the Employment column.
      g.append("rect").attr("class", "rca-bar")
        .attr("x", x(1)).attr("y", (d, i) => rowY(i) - 9)
        .attr("width", d => Math.max(1.5, x(d.rca) - x(1)))
        .attr("height", 18)
        .attr("fill", d => sectorColors[d.sector]);
    } else {
      // stem runs from the benchmark, so its length is the excess over 1.0
      g.append("line").attr("class", "rca-stem")
        .attr("x1", x(1)).attr("y1", (d, i) => rowY(i))
        .attr("x2", d => x(d.rca)).attr("y2", (d, i) => rowY(i))
        .attr("stroke", d => sectorColors[d.sector]);

      g.append("circle").attr("class", "rca-dot")
        .attr("cx", d => x(d.rca)).attr("cy", (d, i) => rowY(i))
        .attr("r", d => rad(d.employ))
        .attr("fill", d => sectorColors[d.sector]);
    }

    // "5.4×" reads as a multiplier; "5.40" reads as a score on an unknown scale
    g.append("text").attr("class", "rca-value")
      .attr("x", d => x(d.rca) + (rcaDesign === "bar" ? 9 : rad(d.employ) + 9))
      .attr("y", (d, i) => rowY(i) + 4)
      .text(d => fmtX(d.rca));

    // Row tooltip carries what the marks can't: the exact employment count,
    // the year, and the two shares the multiplier is derived from.
    topTag(svg, rows, 0, MT - 7, false);

    const rowTip = document.getElementById("rcaRowTip");
    if (rowTip && wrap) {
      const yearSel = document.querySelector("#specializationSection .ctl select");
      g.on("mouseenter", function(ev, d){
        const year = yearSel ? yearSel.value : "";
        rowTip.innerHTML =
          '<strong>' + d.name + '</strong>' +
          (year ? '<div class="tip-row"><span>Year</span><span>' + year + '</span></div>' : '') +
          '<div class="tip-row"><span>RCA</span><span>' + fmtX(d.rca) + '</span></div>' +
          '<div class="tip-sub">' + d.localPct.toFixed(2) + '% of ' + cityName +
            "'s jobs vs " + d.worldPct.toFixed(2) + "% across US metros</div>" +
          '<div class="tip-row"><span>Employment</span><span>' +
            fmtJobs(d.employ) + ' jobs</span></div>';
        rowTip.hidden = false;
      })
      .on("mousemove", function(ev){
        cursorTipPos(ev, wrap, rowTip);
      })
      .on("mouseleave", function(){ rowTip.hidden = true; });
    }

    const btn = document.getElementById("rcaToggleBtn");
    if (btn) {
      btn.textContent = rcaShowAll
        ? "Show top " + RCA_TOP_N
        : "Show all " + all.length;
    }

    // legend covering only the sectors actually on screen
    const legend = document.getElementById("rcaLegend");
    if (legend) {
      const seen = [];
      rows.forEach(d => { if (seen.indexOf(d.sector) === -1) seen.push(d.sector); });
      legend.innerHTML = seen.sort().map(s =>
        '<span class="rca-sw"><i style="background:' + sectorColors[s] + '"></i>' +
        s + "</span>").join("");
    }

    /* Only the mark-specific key swaps. The sector legend describes both forms —
       bars are filled by sector too — and with bar as the default, dropping the
       whole footnote would leave the chart's only colour key off the page. */
    const isBar = (rcaDesign === "bar");
    /* the bar form reads without a legend — sector colour is decoration the
       row labels already carry, and the footnote returns with the dot form */
    const foot = document.getElementById("rcaFootnote");
    if (foot) foot.hidden = isBar;
    const setKey = (id, shown) => {
      const k = document.getElementById(id);
      if (k) k.hidden = !shown;
    };
    setKey("rcaDotKey", !isBar);
    setKey("rcaBarKey", isBar);
  }

  /* =====================================================================
     4 · Peer comparison

     Same RCA formula, same US-metro benchmark — computed independently for each
     peer city, then compared. The peer marker is a single number (the mean of
     the four), with the individual cities available on hover.
     ===================================================================== */
  const PEERS = ["Washington", "Seattle", "Denver", "San Diego"];
  const peerByName = new Map();

  /* Profile card shown when hovering a peer city. Dummy figures for the
     prototype; the home city's column is the same on every card. */
  const HOME_PROFILE = {
    label: "Boston, MA",
    population: "660K", density: "5,400/km²", wage: "$100,000",
    home: "$971,000", share: "13.4%", diversity: "0.64"
  };

  const PEER_PROFILES = {
    "Washington": { label: "Washington, DC",
      population: "690K", density: "4,457/km²", wage: "$105,318",
      home: "$625,470", share: "10.8%", diversity: "0.69" },
    "Seattle": { label: "Seattle, WA",
      population: "755K", density: "3,390/km²", wage: "$112,000",
      home: "$866,000", share: "18.6%", diversity: "0.61" },
    "Denver": { label: "Denver, CO",
      population: "715K", density: "1,830/km²", wage: "$85,000",
      home: "$585,000", share: "24.1%", diversity: "0.73" },
    "San Diego": { label: "San Diego, CA",
      population: "1.39M", density: "1,680/km²", wage: "$88,000",
      home: "$902,000", share: "41.5%", diversity: "0.70" }
  };

  const PROFILE_ROWS = [
    ["Population",      "population"],
    ["Density",         "density"],
    ["Average salary",  "wage"],
    ["Home value",      "home"],
    ["Share of metro",  "share"],
    ["Diversity index", "diversity"]
  ];

  function initPeerCityChips(){
    const wrap = document.getElementById("peerCityList");
    if (!wrap) return;
    wrap.innerHTML = PEERS.map(name => {
      const p = PEER_PROFILES[name];
      if (!p) return "";
      const rows = PROFILE_ROWS.map(([label, key]) =>
        '<tr><th scope="row">' + label + "</th>" +
        "<td>" + p[key] + "</td>" +
        "<td>" + HOME_PROFILE[key] + "</td></tr>").join("");
      return '<span class="peer-city">' +
        '<button type="button" class="peer-city-btn">' + p.label + "</button>" +
        '<span class="peer-card" role="tooltip">' +
          "<table><thead><tr><td></td>" +
            "<th>This</th><th>" + HOME_PROFILE.label.split(",")[0] + "</th>" +
          "</tr></thead><tbody>" + rows + "</tbody></table>" +
        "</span></span>";
    }).join("");
  }

  function peersFor(name, cityRca){
    if (!peerByName.has(name)) {
      // Where the peer group sits relative to this city. Mostly below (the
      // city is specialised here), sometimes above — those are the rows worth
      // arguing about.
      const factor = 0.4 + srand() * 0.85;
      // Floor the target, never the resulting average — clamping after the
      // fact would leave the tick showing a number the four cities don't
      // actually average to.
      const target = Math.max(1.15, cityRca * factor);

      // Spread four cities around that target, then rescale so they average
      // to it exactly — the tooltip numbers must reconcile with the tick.
      const jitter = PEERS.map(() => 0.62 + srand() * 0.76);
      const mean = jitter.reduce((s, j) => s + j, 0) / jitter.length;
      const values = jitter.map(j => Math.round(target * (j / mean) * 10) / 10);

      // Average taken from the rounded values, so what is shown adds up.
      const avg = Math.round(
        (values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10;

      peerByName.set(name, { values: values, avg: avg });
    }
    return peerByName.get(name);
  }

  function specializedWithPeers(rows){
    // Compare on the values the reader actually sees. Testing the raw numbers
    // would flag a row orange while its two labels read identically.
    const shown = v => Math.round(v * 10) / 10;
    return specialized(rows).map(d => {
      const p = peersFor(d.name, d.rca);
      return Object.assign({}, d, {
        peerAvg: p.avg,
        peerValues: p.values,
        ahead: shown(d.rca) >= shown(p.avg)
      });
    });
  }

  let peerShowAll = false;
  /* Follows the specialization chart: the two are one section behind a toggle,
     so switching views must not also switch mark type under the reader. */
  let peerDesign = "bar";

  function renderPeerChart(){
    const el = document.getElementById("peerChartSvg");
    if (!el) return;

    const all  = specializedWithPeers();
    const rows = peerShowAll ? all : all.slice(0, RCA_TOP_N);

    // Employment lives in the row tooltip, so the plot takes that width.
    const W = 880, ML = 300, MT = 76, MB = 26, RH = 34;
    const PLOT_R = 800;
    const H = MT + rows.length * RH + MB;

    const svg = d3.select(el)
      .attr("viewBox", "0 0 " + W + " " + H)
      .attr("height", H);
    svg.selectAll("*").remove();

    const hiVal = d3.max(all, d => Math.max(d.rca, d.peerAvg));
    const x = d3.scaleLinear().domain([1, hiVal * 1.05]).range([ML + 10, PLOT_R]);
    const rad = d3.scaleSqrt()
      .domain([0, d3.max(all, d => d.employ)]).range([3.5, 13]);

    const rowY = i => MT + i * RH + RH / 2;
    const gridBottom = MT + rows.length * RH;

    // Behind the gridlines and everything else, so the band tints the rows
    // without hiding any part of the chart drawn over it.
    if (rows.length >= 3) {
      svg.append("rect").attr("class", "rca-top-band")
        .attr("x", 0).attr("y", MT).attr("width", W).attr("height", 3 * RH);
    }

    svg.append("line").attr("class", "rca-axis")
      .attr("x1", x.range()[0]).attr("y1", MT - 12).attr("x2", PLOT_R).attr("y2", MT - 12);

    const hi = Math.floor(x.domain()[1]);
    for (let t = 2; t <= hi; t++) {
      svg.append("line").attr("class", "rca-grid")
        .attr("x1", x(t)).attr("y1", MT - 12).attr("x2", x(t)).attr("y2", gridBottom);
      svg.append("text").attr("class", "rca-tick")
        .attr("x", x(t)).attr("y", MT - 20).attr("text-anchor", "middle").text(t + "×");
    }

    drawAxisHeader(svg, x, PLOT_R, MT, gridBottom, true);

    const g = svg.selectAll(".rca-row").data(rows).join("g").attr("class", "rca-row");

    // Both charts sort by RCA, so "first three" is the same three industries in
    // each — which is what lets the peer label refer back to the other chart.
    g.classed("is-top", (d, i) => i < 3);

    g.append("rect").attr("class", "rca-hit")
      .attr("x", 0).attr("y", (d, i) => MT + i * RH)
      .attr("width", W).attr("height", RH);

    g.append("text").attr("class", "rca-label")
      .attr("x", ML - 16).attr("y", (d, i) => rowY(i) + 4)
      .attr("text-anchor", "end").text(d => d.label);

    if (peerDesign === "bar") {
      // Bullet form: the bar is this city, the tick is the peer target. Where
      // the bar falls short of the tick, the shortfall is drawn in.
      g.append("rect").attr("class", "rca-bar")
        .attr("x", x(1)).attr("y", (d, i) => rowY(i) - 9)
        .attr("width", d => Math.max(1.5, x(d.rca) - x(1)))
        .attr("height", 18)
        .attr("fill", d => sectorColors[d.sector]);

      g.append("line").attr("class", "peer-gap peer-gap--behind")
        .attr("x1", d => x(d.rca)).attr("y1", (d, i) => rowY(i))
        .attr("x2", d => x(Math.max(d.rca, d.peerAvg))).attr("y2", (d, i) => rowY(i))
        .style("display", d => d.ahead ? "none" : null);

      // taller than the bar so it stays readable where it overlaps
      g.append("line").attr("class", "peer-tick")
        .attr("x1", d => x(d.peerAvg)).attr("y1", (d, i) => rowY(i) - 13)
        .attr("x2", d => x(d.peerAvg)).attr("y2", (d, i) => rowY(i) + 13);
    } else {
      // Connector spans the gap. Neutral by default; highlighted only where the
      // city trails its peers, since those are the exceptions worth spotting.
      g.append("line")
        .attr("class", d => "peer-gap" + (d.ahead ? "" : " peer-gap--behind"))
        .attr("x1", d => x(Math.min(d.rca, d.peerAvg))).attr("y1", (d, i) => rowY(i))
        .attr("x2", d => x(Math.max(d.rca, d.peerAvg))).attr("y2", (d, i) => rowY(i));

      // Peer average is a tick, not a dot — a different mark shape reads as a
      // reference value rather than a second comparable observation.
      g.append("line").attr("class", "peer-tick")
        .attr("x1", d => x(d.peerAvg)).attr("y1", (d, i) => rowY(i) - 9)
        .attr("x2", d => x(d.peerAvg)).attr("y2", (d, i) => rowY(i) + 9);

      g.append("circle").attr("class", "rca-dot")
        .attr("cx", d => x(d.rca)).attr("cy", (d, i) => rowY(i))
        .attr("r", d => rad(d.employ))
        .attr("fill", d => sectorColors[d.sector]);
    }

    g.append("text")
      .attr("class", d => "rca-value" + (d.ahead ? "" : " rca-value--behind"))
      .attr("x", d => x(Math.max(d.rca, d.peerAvg)) +
                      (peerDesign === "bar" ? 11 : rad(d.employ) + 9))
      .attr("y", (d, i) => rowY(i) + 4)
      .text(d => fmtX(d.rca));

    // Row tooltip: the peer comparison spelled out, with the four cities the
    // average is built from and an explicit above/below verdict.
    topTag(svg, rows, 0, MT - 7, true);

    const rowTip = document.getElementById("peerRowTip");
    const wrap = el.parentElement;
    if (rowTip && wrap) {
      const yearSel = document.querySelector("#specializationSection .ctl select");
      g.on("mouseenter", function(ev, d){
        const year = yearSel ? yearSel.value : "";
        // A gap between two multipliers is a difference in points, not itself
        // a multiplier — "0.8×" would read as Boston being smaller than peers.
        const diff = Math.abs(Math.round((d.rca - d.peerAvg) * 10) / 10);
        const dir  = d.ahead ? "up" : "down";
        const verdict = diff === 0
          ? "Level with the peer average"
          : diff + (d.ahead ? " above the peer average" : " below the peer average");
        rowTip.innerHTML =
          '<strong>' + d.name + '</strong>' +
          (year ? '<div class="tip-row"><span>Year</span><span>' + year + '</span></div>' : '') +
          '<div class="tip-row"><span>' + cityName + '</span><span>' + fmtX(d.rca) + '</span></div>' +
          '<div class="tip-row"><span>Peer average</span><span>' + fmtX(d.peerAvg) + '</span></div>' +
          '<div class="tip-verdict ' + dir + '">' +
            '<span class="tip-arrow" aria-hidden="true">' + (d.ahead ? "▲" : "▼") + '</span>' +
            verdict + '</div>' +
          '<div class="tip-peers">' +
            PEERS.map((p, i) =>
              '<div class="tip-row tip-row--peer"><span>' + p + '</span><span>' +
              fmtX(d.peerValues[i]) + '</span></div>').join("") +
          '</div>' +
          '<div class="tip-row"><span>Employment</span><span>' +
            fmtJobs(d.employ) + ' jobs</span></div>';
        rowTip.hidden = false;
      })
      .on("mousemove", function(ev){
        cursorTipPos(ev, wrap, rowTip);
      })
      .on("mouseleave", function(){ rowTip.hidden = true; });
    }

    const btn = document.getElementById("peerToggleBtn");
    if (btn) {
      btn.textContent = peerShowAll ? "Show top " + RCA_TOP_N : "Show all " + all.length;
    }

    // Keep the legend to marks actually on screen. In bar form the city is a
    // bar rather than a sized dot, and the "above" run isn't drawn at all —
    // only shortfalls are — so naming it would describe nothing.
    const isBar = (peerDesign === "bar");
    const setKey = (id, shown) => {
      const k = document.getElementById(id);
      if (k) k.hidden = !shown;
    };
    // In bar form neither city key applies: there is no sized dot, and the bar
    // needs no naming. Only the peer tick and the shortfall remain.
    setKey("peerCityKey", !isBar);
    setKey("peerCityKeyBar", false);
    setKey("peerAboveKey", !isBar);
  }

  function initPeerChart(){
    if (!document.getElementById("peerChartSvg")) return;
    renderPeerChart();
    const btn = document.getElementById("peerToggleBtn");
    if (btn) btn.addEventListener("click", () => {
      peerShowAll = !peerShowAll;
      renderPeerChart();
    });
  }

  /* World benchmark vs peer benchmark: the same industries and the same RCA
     formula, so this is one section with two views rather than two sections.
     Both charts stay rendered and only their visibility changes — switching
     costs nothing, and each view keeps its own "show all" and design state
     instead of being reset every time the reader looks at the other one. */
  function initRcaViewToggle(){
    const host = document.getElementById("specializationSection");
    const seg  = document.getElementById("rcaViewSeg");
    if (!host || !seg) return;

    let cur = "self";
    function show(view){
      cur = view;
      host.classList.toggle("is-dist", view === "dist");
      host.querySelectorAll("[data-rcaview]").forEach(el => {
        el.classList.toggle("view-off", el.dataset.rcaview !== view);
      });
      seg.querySelectorAll(".seg-btn").forEach(b => {
        const on = b.dataset.rcaviewGo === view;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
      /* entering or leaving by any route keeps the active design marked */
      markDesigns();
    }

    /* One design list serves the whole section: bar and dot restyle the
       charts in place (both views share the choice, one mental model),
       while the two box plots open the all-metros view with that design
       pinned through the query string. The active option is marked rather
       than relabelled, so every design the section can wear stays listed. */
    const designList = document.getElementById("rcaDesignList");
    const distFrame  = document.getElementById("rcaDistFrame");
    let distBack = "self", distDesign = "box";
    function markDesigns(){
      if (!designList) return;
      const active = (cur === "dist") ? distDesign : rcaDesign;
      designList.querySelectorAll(".design-opt").forEach(b =>
        b.classList.toggle("is-on", b.dataset.design === active));
    }
    function openDist(design){
      if (cur !== "dist") distBack = cur;
      distDesign = design;
      if (distFrame){
        /* both box plots keep the four peer metros on stage */
        const url = "rca-distributions.html?dots=peers&design=" + design;
        if (distFrame.getAttribute("src") !== url) distFrame.setAttribute("src", url);
      }
      show("dist");
    }
    if (designList) designList.addEventListener("click", e => {
      const b = e.target.closest(".design-opt");
      if (!b) return;
      const d = b.dataset.design;
      if (d === "box" || d === "band"){
        if (cur !== "dist" || distDesign !== d) openDist(d);
      } else {
        rcaDesign = d;
        peerDesign = d;
        renderRcaChart();
        renderPeerChart();
        if (cur === "dist") show(distBack);
      }
      markDesigns();
    });

    /* Named from the same list the chart averages, so the tooltip cannot drift
       from the four cities actually behind the tick. */
    const tip = document.getElementById("peerListTip");
    if (tip) {
      tip.innerHTML =
        "<strong>" + PEERS.length + " peer cities</strong><ul>" +
        PEERS.map(n => "<li>" + ((PEER_PROFILES[n] || {}).label || n) + "</li>").join("") +
        "</ul><span class=\"peer-tip-note\">Metros close to " + cityName +
        " in size, income and industry mix — close enough that the comparison " +
        "says something other than \u201clarge city\u201d.</span>";
    }

    seg.addEventListener("click", e => {
      const btn = e.target.closest(".seg-btn");
      if (btn && seg.contains(btn)) show(btn.dataset.rcaviewGo);
    });

    /* ---- intro transport + row-count control for the embedded chart.
       The frame exposes window.__intro (play/pause/resume + step events)
       and window.__chart (row limit); the bar's five dots follow the
       intro's steps. ---- */
    const introBtn    = document.getElementById("rcaIntroBtn");
    const introDotsEl = document.getElementById("rcaIntroDots");
    const rowsBtn     = document.getElementById("distRowsBtn");
    const frameIntro  = () => distFrame && distFrame.contentWindow && distFrame.contentWindow.__intro;
    const frameChart  = () => distFrame && distFrame.contentWindow && distFrame.contentWindow.__chart;
    function frameHeight(){
      const c = frameChart();
      if (!c) return;
      const b = c.contentBottom();
      if (b > 200) distFrame.style.height = (b + 14) + "px";
    }
    function introUi(st){
      if (introBtn) introBtn.innerHTML =
        !st.running ? "&#9654; Play intro"
        : st.paused ? "&#9654; Resume intro"
        :             "&#10074;&#10074; Pause intro";
      if (introDotsEl) [...introDotsEl.children].forEach((d, i) => {
        d.classList.toggle("on", i < st.step);
        d.classList.toggle("cur", st.running && !st.paused && i === st.step - 1);
      });
      frameHeight();
    }
    function bindDistFrame(){
      const api = frameIntro();
      if (!api) return;
      api.onChange = introUi;
      introUi(api.state());
      const c = frameChart();
      if (rowsBtn && c) rowsBtn.textContent =
        c.limit() ? "Show all " + c.total() : "Show top 10";
    }
    if (distFrame){
      distFrame.addEventListener("load", bindDistFrame);
      bindDistFrame();
    }
    if (introBtn) introBtn.addEventListener("click", () => {
      const api = frameIntro();
      if (!api) return;
      const st = api.state();
      if (!st.running) api.play();
      else if (st.paused) api.resume();
      else api.pause();
    });
    if (rowsBtn) rowsBtn.addEventListener("click", () => {
      const c = frameChart();
      if (!c) return;
      c.setLimit(c.limit() ? null : 10);
      rowsBtn.textContent = c.limit() ? "Show all " + c.total() : "Show top 10";
      frameHeight();
    });

    /* the friendly box plot is the section's opening view; Bar and the
       classic box stay one click away on the design list */
    openDist("band");
  }

  function initRcaChart(){
    if (!document.getElementById("rcaChartSvg")) return;
    renderRcaChart();
    const btn = document.getElementById("rcaToggleBtn");
    if (btn) btn.addEventListener("click", () => {
      rcaShowAll = !rcaShowAll;
      renderRcaChart();
    });
  }

  /* Visible "Color by" segmented control (replaces the old <select>).
     Each group carries the svg it drives and the legends it can reveal. */
  function initColorBySegments(){
    document.querySelectorAll(".seg[data-svg]").forEach(group => {
      const legends = {
        complexity: group.dataset.legendComplexity,
        change:     group.dataset.legendChange
      };
      group.addEventListener("click", e => {
        const btn = e.target.closest(".seg-btn");
        if (!btn || !group.contains(btn)) return;
        group.querySelectorAll(".seg-btn").forEach(b => {
          const on = b === btn;
          b.classList.toggle("is-active", on);
          b.setAttribute("aria-pressed", on ? "true" : "false");
        });
        setColorBy(group.dataset.svg, btn.dataset.mode, legends);
      });
    });
  }

  /* =====================================================================
     5 · Metro scatter — population growth vs wage growth

     Dummy metros, generated once per load. Medians are set so the quadrant
     story matches the section copy and the City Overview tables: Boston's
     metro grows slowly (+0.4%/yr) while pay runs ahead (+4.5%/yr), which
     lands it in the constrained-supply quadrant.
     ===================================================================== */
  const METRO_X_MED = 0.7;    // population CAGR, %/yr
  const METRO_Y_MED = 4.0;    // avg-salary CAGR, %/yr

  const HOME = { name: "Boston", pop: 0.4, pay: 5.3, size: 4.9 };
  /* the section bar's opening of part two draws these two rows: one source */
  window.BOSTON_GROWTH = { pop: HOME.pop, pay: HOME.pay, popMed: METRO_X_MED, payMed: METRO_Y_MED };
  const PEER_POINTS = [
    { name: "Washington",  pop: 0.35, pay: 4.9, size: 6.4 },
    { name: "Seattle",     pop: 1.15, pay: 5.4, size: 4.0 },
    { name: "Denver",      pop: 1.30, pay: 4.6, size: 3.0 },
    { name: "San Diego",   pop: 0.25, pay: 4.3, size: 3.3 }
  ];

  let _metros = null;
  function metroPoints(){
    if (_metros) return _metros;
    const rest = [];
    for (let i = 0; i < 170; i++) {
      // clustered around the medians, with a long tail on both axes
      const pop = METRO_X_MED + (srand() + srand() + srand() - 1.5) * 1.1;
      const pay = METRO_Y_MED + (srand() + srand() + srand() - 1.5) * 1.1;
      rest.push({
        name: "Metro area " + (i + 1),
        pop: Math.round(pop * 100) / 100,
        pay: Math.round(pay * 100) / 100,
        size: Math.round((0.15 + Math.pow(srand(), 3) * 5.5) * 100) / 100,
        other: true
      });
    }
    _metros = rest
      .concat(PEER_POINTS.map(p => Object.assign({ peer: true }, p)))
      .concat([Object.assign({ home: true }, HOME)])
      // draw the small grey mass first so highlights sit on top
      .sort((a, b) => (a.home ? 2 : a.peer ? 1 : 0) - (b.home ? 2 : b.peer ? 1 : 0));
    return _metros;
  }

  /* Quadrant buttons. Rendered as HTML over the chart rather than in the SVG
     so they are real buttons — focusable, with a genuine border-radius — and
     positioned in % so they track the responsive viewBox. */
  const QUADS = [
    { key:"tl", name:"Held back", pop:"down", pay:"up",
      dx:"Negative Supply Shock",
      blurb:"Pay is bid up because workers cannot, or will not, move in \u2014 often a housing or cost-of-living wall. Demand for labor is there; the supply of people can\u2019t follow it." },
    { key:"tr", name:"Boomtown", pop:"up", pay:"up",
      dx:"Positive Demand Shock",
      blurb:"People and pay rise together. Demand for what the city produces is growing, and the city is still able to absorb the workers it pulls in." },
    { key:"bl", name:"Cooling off", pop:"down", pay:"down",
      dx:"Negative Demand Shock",
      blurb:"Fewer newcomers and slower raises at the same time. Demand for the city\u2019s output has gone quiet, so neither wages nor population are being pulled up." },
    { key:"br", name:"Lifestyle magnet", pop:"up", pay:"down",
      dx:"Positive Supply Shock",
      blurb:"People keep arriving even though pay lags. Amenities or cheaper living draw workers in, and that added supply of people holds wages down." }
  ];

  /* Conventional icons: a group-of-people silhouette, and a coin marked with
     a dollar sign. Both solid so they sit together. */
  const ICON_POP =
    '<svg class="q-ico q-ico--pop" viewBox="0 0 24 18" aria-hidden="true">' +
    '<circle cx="5" cy="5.4" r="3"/><circle cx="19" cy="5.4" r="3"/>' +
    '<circle cx="12" cy="4.4" r="3.7"/>' +
    '<path d="M0.5 17v-2.1a4.5 4.5 0 0 1 7.1-3.7 6 6 0 0 0-1.6 4.1V17Z"/>' +
    '<path d="M23.5 17v-2.1a4.5 4.5 0 0 0-7.1-3.7 6 6 0 0 1 1.6 4.1V17Z"/>' +
    '<path d="M6.5 17v-2.3a5.5 5.5 0 0 1 11 0V17Z"/></svg>';
  const ICON_PAY =
    '<svg class="q-ico q-ico--pay" viewBox="0 0 18 18" aria-hidden="true">' +
    '<circle cx="9" cy="9" r="8"/>' +
    '<path d="M9 3.5v11" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>' +
    '<path d="M11.6 6.2c-.6-.8-1.6-1.2-2.6-1.2-1.5 0-2.6.8-2.6 1.9 0 1.2 1 1.6 2.6 1.9 1.6.3 2.6.7 2.6 1.9 0 1.1-1.1 1.9-2.6 1.9-1.1 0-2.1-.4-2.7-1.2" ' +
    'fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/></svg>';
  const arrow = dir => '<svg class="q-arr q-arr--' + dir + '" viewBox="0 0 10 10" aria-hidden="true">' +
    (dir === "up" ? '<path d="M5 1 9 9 1 9Z"/>' : '<path d="M5 9 1 1 9 1Z"/>') + '</svg>';

  function buildQuadrantButtons(wrap, tip){
    if (!wrap || wrap.querySelector(".q-btn")) return;
    QUADS.forEach(q => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "q-btn q-btn--" + q.key;
      b.dataset.q = q.key;
      b.setAttribute("aria-expanded", "false");
      b.innerHTML =
        '<span class="q-btn-name">' + q.name + '</span>' +
        '<span class="q-btn-metrics">' +
          '<span class="q-metric">' + ICON_POP + 'Population' + arrow(q.pop) + '</span>' +
          '<span class="q-metric">' + ICON_PAY + 'Pay' + arrow(q.pay) + '</span>' +
        '</span>';
      wrap.appendChild(b);
    });

    if (!tip) return;

    const show = btn => {
      const q = QUADS.find(d => d.key === btn.dataset.q);
      btn.setAttribute("aria-expanded", "true");
      tip.innerHTML =
        '<strong>' + q.dx + '</strong>' +
        '<p>' + q.blurb + '</p>';
      tip.hidden = false;
      const w = wrap.getBoundingClientRect(), r = btn.getBoundingClientRect();
      const left = r.left - w.left + r.width / 2 - tip.offsetWidth / 2;
      // flip above the button when there is no room below
      const below = r.bottom - w.top + 8;
      const fits = below + tip.offsetHeight <= w.height;
      tip.style.left = Math.max(6, Math.min(left, w.width - tip.offsetWidth - 6)) + "px";
      tip.style.top = (fits ? below : r.top - w.top - tip.offsetHeight - 8) + "px";
    };
    const hide = btn => {
      if (btn) btn.setAttribute("aria-expanded", "false");
      tip.hidden = true;
    };

    wrap.querySelectorAll(".q-btn").forEach(btn => {
      btn.addEventListener("mouseenter", () => show(btn));
      btn.addEventListener("focus", () => show(btn));
      btn.addEventListener("mouseleave", () => hide(btn));
      btn.addEventListener("blur", () => hide(btn));
      // tap support, where hover does not exist
      btn.addEventListener("click", () => {
        if (btn.getAttribute("aria-expanded") === "true") hide(btn); else show(btn);
      });
    });
  }

  /* Anchor each button just inside its quadrant, in % of the viewBox. */
  function placeQuadrantButtons(wrap, tip, x, y, W, H){
    buildQuadrantButtons(wrap, tip);
    if (!wrap) return;
    const vx = x(METRO_X_MED) / W * 100, vy = y(METRO_Y_MED) / H * 100;
    const pad = 1.4;
    const pos = {
      tl: { left: (x.range()[0] / W * 100 + pad) + "%", top: (y.range()[1] / H * 100 + pad) + "%" },
      tr: { right: ((W - x.range()[1]) / W * 100 + pad) + "%", top: (y.range()[1] / H * 100 + pad) + "%" },
      bl: { left: (x.range()[0] / W * 100 + pad) + "%", bottom: ((H - y.range()[0]) / H * 100 + pad) + "%" },
      br: { right: ((W - x.range()[1]) / W * 100 + pad) + "%", bottom: ((H - y.range()[0]) / H * 100 + pad) + "%" }
    };
    Object.keys(pos).forEach(k => {
      const b = wrap.querySelector(".q-btn--" + k);
      if (!b) return;
      b.style.left = b.style.right = b.style.top = b.style.bottom = "";
      Object.assign(b.style, pos[k]);
    });
    void vx; void vy;
  }

  /* =====================================================================
     6 · Diagnostic explainer

     Two dials and a draggable dot over the same four quarters as the scatter.
     Setting the dials moves the dot; dragging the dot sets the dials. Either
     way the verdict below explains the supply/demand mechanism.
     ===================================================================== */
  const DX_TEXT = {
    tl: { title:"Negative Supply Shock",
      body:"Demand for workers is strong, and that is what bids pay up. What is missing is the supply of people: they cannot move in, or will not. The wall is usually housing. Too few homes get built, so the cost of living swallows the raise before anyone banks it, and the city is held back by its own capacity rather than by weak demand." },
    tr: { title:"Positive Demand Shock",
      body:"Demand for what the city produces is growing, and both numbers move up together. Employers bid harder for workers, and workers arrive. Supply is keeping pace well enough that the newcomers do not drag pay back down, which is growth working roughly as intended." },
    bl: { title:"Negative Demand Shock",
      body:"Demand has gone quiet. Fewer employers competing for workers means slower raises, and slower raises mean fewer reasons to move in. Nothing is blocking supply here; there simply is not the pull. The constraint sits on the demand side." },
    br: { title:"Positive Supply Shock",
      body:"People arrive for reasons other than pay: amenities, space, a lower cost of living. That inflow is itself an increase in labor supply, and more workers competing for the same jobs holds wages down. The draw is the place, not the paycheck." }
  };

  function initDxExplainer(){
    const svgEl = document.getElementById("dxChart");
    const verdict = document.getElementById("dxVerdict");
    if (!svgEl || !verdict) return;

    const S = 300, PAD = 26, MID = S / 2;
    const svg = d3.select(svgEl);
    // Flat pastels, butted edge to edge with no separator. Selection is shown
    // by dimming the other three rather than by deepening this one.
    const fills = { tl:"#f6f2e9", tr:"#e8ecf2",
                    bl:"#f9edec", br:"#e9efeb" };
    const box = { tl:[PAD, PAD], tr:[MID, PAD], bl:[PAD, MID], br:[MID, MID] };
    Object.keys(box).forEach(k => {
      svg.append("rect").attr("class", "dx-q dx-q--" + k)
        .attr("x", box[k][0]).attr("y", box[k][1])
        .attr("width", MID - PAD).attr("height", MID - PAD)
        .attr("fill", fills[k]);
    });

    svg.append("line").attr("class", "dx-cross")
      .attr("x1", MID).attr("x2", MID).attr("y1", PAD).attr("y2", S - PAD);
    svg.append("line").attr("class", "dx-cross")
      .attr("x1", PAD).attr("x2", S - PAD).attr("y1", MID).attr("y2", MID);

    // Both labels sit flat inside the plot, hugging their own axis line.
    svg.append("text").attr("class", "dx-axis")
      .attr("x", S - PAD - 4).attr("y", MID - 9).attr("text-anchor", "end")
      .text("People \u2192");
    svg.append("text").attr("class", "dx-axis")
      .attr("x", MID + 9).attr("y", PAD + 16).attr("text-anchor", "start")
      .text("Pay \u2191");

    // A black dot in a white ring, inside a dashed halo that marks it draggable.
    const dot = svg.append("g").attr("class", "dx-dot-g")
      .attr("transform", "translate(" + MID + "," + MID + ")");
    dot.append("circle").attr("class", "dx-dot-halo").attr("r", 16);
    dot.append("circle").attr("class", "dx-dot").attr("r", 9);

    let state = { pop:null, pay:null };

    const quadOf = (px, py) =>
      (py < MID ? "t" : "b") + (px < MID ? "l" : "r");

    function paint(){
      svg.selectAll(".dx-q").classed("is-on", false);
      const q = (state.pop && state.pay)
        ? (state.pay === "up" ? "t" : "b") + (state.pop === "up" ? "r" : "l")
        : null;
      if (q) svg.select(".dx-q--" + q).classed("is-on", true);
      svg.classed("has-sel", !!q);

      document.querySelectorAll(".dx-opt").forEach(b => {
        b.classList.toggle("is-on", state[b.dataset.dial] === b.dataset.val);
      });

      if (!q) {
        verdict.innerHTML =
          '<h5 class="dx-step-head">2 · What that tells you</h5>' +
          '<p class="dx-idle">Set both dials, or drag the dot on the chart.</p>';
        return;
      }
      const t = DX_TEXT[q];
      verdict.innerHTML =
        '<h5 class="dx-step-head">2 · What that tells you</h5>' +
        '<strong class="dx-verdict-title">' + t.title + '</strong>' +
        '<p class="dx-verdict-body">' + t.body + '</p>';
    }

    function moveDotToState(){
      if (!state.pop || !state.pay) return;
      const cx = state.pop === "up" ? MID + 52 : MID - 52;
      const cy = state.pay === "up" ? MID - 52 : MID + 52;
      dot.transition().duration(260)
        .attr("transform", "translate(" + cx + "," + cy + ")");
    }

    document.querySelectorAll(".dx-opt").forEach(b => {
      b.addEventListener("click", () => {
        state[b.dataset.dial] = b.dataset.val;
        paint(); moveDotToState();
      });
    });

    // drag the dot by hand — it sets the dials rather than reading them
    let dragging = false;
    const place = ev => {
      const r = svgEl.getBoundingClientRect();
      const pt = ev.touches ? ev.touches[0] : ev;
      const px = Math.max(PAD, Math.min(S - PAD, (pt.clientX - r.left) / r.width * S));
      const py = Math.max(PAD, Math.min(S - PAD, (pt.clientY - r.top) / r.height * S));
      dot.interrupt().attr("transform", "translate(" + px + "," + py + ")");
      const q = quadOf(px, py);
      state.pop = q[1] === "r" ? "up" : "down";
      state.pay = q[0] === "t" ? "up" : "down";
      paint();
    };
    svgEl.addEventListener("pointerdown", e => {
      dragging = true; svgEl.setPointerCapture(e.pointerId); place(e); e.preventDefault();
    });
    svgEl.addEventListener("pointermove", e => { if (dragging) place(e); });
    svgEl.addEventListener("pointerup", e => {
      dragging = false;
      try { svgEl.releasePointerCapture(e.pointerId); } catch (err) {}
    });

    paint();
  }

  /* The frame both metro-scale scatters share: same margins, same scales off
     the same metro field, same reference lines. The second chart has to read
     as the first one carrying on, so none of this may drift between them. */
  function metroFrame(el){
    const data = metroPoints();
    const W = 880, H = 560;
    // Room for the axis lines and their labels: the top clears the "typical"
    // caption, the left and bottom clear ticks plus the axis titles.
    const M = { top: 46, right: 30, bottom: 82, left: 92 };

    const svg = d3.select(el).attr("viewBox", "0 0 " + W + " " + H);
    svg.selectAll("*").remove();

    const x = d3.scaleLinear()
      .domain(d3.extent(data, d => d.pop)).nice()
      .range([M.left, W - M.right]);
    const y = d3.scaleLinear()
      .domain(d3.extent(data, d => d.pay)).nice()
      .range([H - M.bottom, M.top]);
    const r = d3.scaleSqrt()
      .domain([0, d3.max(data, d => d.size)]).range([1.3, 12]);

    // the quadrant this section is about
    svg.append("rect").attr("class", "ms-quad")
      .attr("x", x.range()[0]).attr("y", y.range()[1])
      .attr("width", x(METRO_X_MED) - x.range()[0])
      .attr("height", y(METRO_Y_MED) - y.range()[1]);

    x.ticks(6).forEach(t => {
      svg.append("line").attr("class", "ms-grid")
        .attr("x1", x(t)).attr("x2", x(t)).attr("y1", M.top).attr("y2", H - M.bottom);
      svg.append("text").attr("class", "ms-tick")
        .attr("x", x(t)).attr("y", H - M.bottom + 20).attr("text-anchor", "middle")
        .text(t + "%");
    });
    y.ticks(6).forEach(t => {
      svg.append("line").attr("class", "ms-grid")
        .attr("x1", M.left).attr("x2", W - M.right).attr("y1", y(t)).attr("y2", y(t));
      svg.append("text").attr("class", "ms-tick")
        .attr("x", M.left - 10).attr("y", y(t) + 4).attr("text-anchor", "end")
        .text(t.toFixed(1) + "%");
    });

    // solid axis lines framing the plot, drawn over the gridlines
    svg.append("line").attr("class", "ms-axis-line")
      .attr("x1", M.left).attr("x2", M.left)
      .attr("y1", M.top).attr("y2", H - M.bottom);
    svg.append("line").attr("class", "ms-axis-line")
      .attr("x1", M.left).attr("x2", W - M.right)
      .attr("y1", H - M.bottom).attr("y2", H - M.bottom);

    // medians that split the four quadrants
    svg.append("line").attr("class", "ms-median")
      .attr("x1", x(METRO_X_MED)).attr("x2", x(METRO_X_MED))
      .attr("y1", M.top).attr("y2", H - M.bottom);
    svg.append("line").attr("class", "ms-median")
      .attr("x1", M.left).attr("x2", W - M.right)
      .attr("y1", y(METRO_Y_MED)).attr("y2", y(METRO_Y_MED));

    // Reference lines get named in place — "typical" is what the dashed
    // crosshair actually means, and saying so beats a legend.
    svg.append("text").attr("class", "ms-typical")
      .attr("x", x(METRO_X_MED)).attr("y", M.top - 10).attr("text-anchor", "middle")
      .text("Typical population growth");
    svg.append("path").attr("class", "ms-typical-mark")
      .attr("d", "M" + (x(METRO_X_MED) - 4) + " " + (M.top - 6) +
                 "L" + (x(METRO_X_MED) + 4) + " " + (M.top - 6) +
                 "L" + x(METRO_X_MED) + " " + (M.top) + "Z");

    svg.append("text").attr("class", "ms-typical")
      .attr("x", W - M.right - 10).attr("y", y(METRO_Y_MED) - 8).attr("text-anchor", "end")
      .text("Typical salary growth");
    svg.append("path").attr("class", "ms-typical-mark")
      .attr("d", "M" + (W - M.right) + " " + (y(METRO_Y_MED) - 4) +
                 "L" + (W - M.right) + " " + (y(METRO_Y_MED) + 4) +
                 "L" + (W - M.right - 5) + " " + y(METRO_Y_MED) + "Z");

    svg.append("text").attr("class", "ms-axis-title")
      .attr("x", (M.left + W - M.right) / 2).attr("y", H - 14)
      .attr("text-anchor", "middle")
      .text("Population growth (annual rate, 2015\u20132025)");
    svg.append("text").attr("class", "ms-axis-title")
      .attr("transform", "rotate(-90)")
      .attr("x", -(M.top + H - M.bottom) / 2).attr("y", 24)
      .attr("text-anchor", "middle")
      .text("Average salary growth (annual rate, 2015\u20132025)");

    return { svg, data, x, y, r, W, H, M };
  }

  function renderMetroScatter(){
    const el = document.getElementById("metroScatterSvg");
    if (!el) return;

    const { svg, data, x, y, r, W, H } = metroFrame(el);

    placeQuadrantButtons(document.getElementById("scatterWrap"),
                         document.getElementById("quadTip"), x, y, W, H);

    svg.append("g").selectAll("circle").data(data).join("circle")
      .attr("class", d => "ms-dot" + (d.home ? " ms-dot--home" : d.peer ? " ms-dot--peer" : ""))
      .attr("cx", d => x(d.pop)).attr("cy", d => y(d.pay))
      .attr("r", d => r(d.size));

    // Peers are named too, but smaller — they are context, not the subject.
    svg.append("g").selectAll("text")
      .data(data.filter(d => d.peer)).join("text")
      .attr("class", "ms-peer-label")
      .attr("x", d => x(d.pop) + r(d.size) + 6)
      .attr("y", d => y(d.pay) + 4)
      .text(d => d.name);

    svg.append("text").attr("class", "ms-home-label")
      .attr("x", x(HOME.pop) + r(HOME.size) + 8).attr("y", y(HOME.pay) + 5)
      .text(HOME.name);
  }

  /* =====================================================================
     6 · The city inside the metro

     The same plot again, but the metro dot breaks apart into the places
     that make it up. Positions are authored as offsets from the metro's
     own point rather than as absolute rates, so the places land inside
     the frame whatever domain the random metro field happens to produce.

     The story the dummy numbers tell: the metro grows slowly while pay
     runs ahead, and the city itself is the part shedding people fastest
     — so the single metro dot was hiding the city's own problem.
     ===================================================================== */
  const MSA_PLACES = [
    // The left-hand places are kept under pay ≈ 4.9 so they clear the "Held
    // back" button sitting in that corner — the city especially.
    { name:"Somerville",  dx:-1.00, dy: 0.32, size: 81 },
    { name:"Cambridge",   dx:-0.70, dy: 0.38, size:118 },
    { name:"Brookline",   dx:-0.50, dy: 0.34, size: 63 },
    { name:"Arlington",   dx:-0.38, dy: 0.28, size: 46 },
    { name:"Watertown",   dx:-0.32, dy: 0.26, size: 35 },
    { name:"Medford",     dx:-0.24, dy: 0.34, size: 59 },
    { name:"Milton",      dx:-0.12, dy:-0.30, size: 28 },
    { name:"Melrose",     dx: 0.06, dy:-0.55, size: 29 },
    { name:"Waltham",     dx: 0.06, dy: 0.38, size: 65 },
    { name:"Needham",     dx: 0.12, dy: 0.50, size: 32 },
    { name:"Newton",      dx: 0.18, dy: 0.55, size: 88 },
    { name:"Beverly",     dx: 0.18, dy:-0.62, size: 42 },
    { name:"Salem",       dx: 0.24, dy:-0.36, size: 44 },
    { name:"Dedham",      dx: 0.26, dy:-0.95, size: 25 },
    { name:"Norwood",     dx: 0.30, dy:-0.72, size: 31 },
    { name:"Malden",      dx: 0.32, dy:-0.44, size: 66 },
    { name:"Woburn",      dx: 0.36, dy: 0.22, size: 41 },
    { name:"Quincy",      dx: 0.42, dy: 0.16, size:101 },
    { name:"Braintree",   dx: 0.44, dy:-0.18, size: 39 },
    { name:"Saugus",      dx: 0.44, dy:-1.15, size: 29 },
    { name:"Peabody",     dx: 0.50, dy:-0.86, size: 54 },
    { name:"Framingham",  dx: 0.56, dy: 0.06, size: 72 },
    { name:"Wakefield",   dx: 0.56, dy:-0.42, size: 27 },
    { name:"Everett",     dx: 0.62, dy:-1.05, size: 49 },
    { name:"Lynn",        dx: 0.68, dy:-0.92, size:101 },
    { name:"Weymouth",    dx: 0.70, dy:-0.66, size: 57 },
    { name:"Revere",      dx: 0.76, dy:-1.28, size: 62 },
    { name:"Natick",      dx: 0.76, dy: 0.34, size: 37 },
    { name:"Randolph",    dx: 0.84, dy:-1.35, size: 34 },
    { name:"Lowell",      dx: 0.90, dy:-0.55, size:115 },
    { name:"Chelsea",     dx: 0.96, dy:-1.20, size: 40 },
    { name:"Marlborough", dx: 1.08, dy: 0.12, size: 41 },
    { name:"Franklin",    dx: 1.24, dy:-0.24, size: 33 },
    // last so it paints on top of the rest
    { name:"Boston",      dx:-1.2,  dy: 0.5,  size:660, home:true }
  ];

  function renderCityInMetro(){
    const el = document.getElementById("cityInMetroSvg");
    if (!el) return;

    const { svg, data, x, y, r, W, H } = metroFrame(el);

    // Same four quadrant buttons as the section above — the plot is the same
    // plot, so the reader should not have to re-learn what the corners mean.
    placeQuadrantButtons(document.getElementById("cimWrap"),
                         document.getElementById("cimQuadTip"), x, y, W, H);

    // Keep the places off the axis lines however the domain came out.
    const inset = 12;
    const clamp = (scale, v) => {
      const [a, b] = scale.range();
      const lo = Math.min(a, b) + inset, hi = Math.max(a, b) - inset;
      return Math.max(lo, Math.min(hi, scale(v)));
    };
    const px = d => clamp(x, HOME.pop + d.dx);
    const py = d => clamp(y, HOME.pay + d.dy);
    const pr = d3.scaleSqrt()
      .domain([0, d3.max(MSA_PLACES, d => d.size)]).range([2.5, 13]);

    /* Opening frame: the metro field exactly as the section above leaves it. */
    const field = svg.append("g").attr("class", "cim-field");
    field.selectAll("circle").data(data).join("circle")
      .attr("class", d => "ms-dot" + (d.home ? " ms-dot--home" : d.peer ? " ms-dot--peer" : ""))
      .attr("cx", d => x(d.pop)).attr("cy", d => y(d.pay))
      .attr("r", d => r(d.size));
    field.selectAll("text").data(data.filter(d => d.peer)).join("text")
      .attr("class", "ms-peer-label")
      .attr("x", d => x(d.pop) + r(d.size) + 6)
      .attr("y", d => y(d.pay) + 4)
      .text(d => d.name);

    const mx = x(HOME.pop), my = y(HOME.pay), mr = r(HOME.size);

    const metroDot = svg.append("circle").attr("class", "ms-dot ms-dot--home cim-metro")
      .attr("cx", mx).attr("cy", my).attr("r", mr);
    const metroLabel = svg.append("text").attr("class", "ms-home-label")
      .attr("x", mx + mr + 8).attr("y", my + 5)
      .text(HOME.name);

    /* What the metro leaves behind once it has come apart: a dashed ring on
       the spot, so every place can still be read against its own metro. */
    // Opacity goes through style() throughout: the dot classes carry an
    // `opacity` rule in the stylesheet, which outranks the attribute.
    const ring = svg.append("g").attr("class", "cim-ring").style("opacity", 0);
    ring.append("circle").attr("class", "cim-ring-c")
      .attr("cx", mx).attr("cy", my).attr("r", mr + 7);
    ring.append("text").attr("class", "cim-ring-label")
      .attr("x", mx + mr + 14).attr("y", my + 4)
      .text("Boston metro");

    const places = svg.append("g").attr("class", "cim-places")
      .selectAll("circle").data(MSA_PLACES).join("circle")
      .attr("class", d => "cim-dot" + (d.home ? " cim-dot--home" : ""))
      .attr("cx", mx).attr("cy", my).attr("r", 0).style("opacity", 0);

    const city = MSA_PLACES[MSA_PLACES.length - 1];
    const cityLabel = svg.append("text").attr("class", "ms-home-label")
      .attr("x", px(city) + pr(city.size) + 8).attr("y", py(city) + 5)
      .style("opacity", 0)
      .text(city.name);

    function reset(){
      svg.selectAll(".cim-field, .cim-metro, .ms-home-label, .cim-ring").interrupt();
      places.interrupt();
      field.style("opacity", 1);
      metroDot.style("opacity", 1).attr("r", mr);
      metroLabel.style("opacity", 1);
      ring.style("opacity", 0);
      cityLabel.style("opacity", 0);
      places.attr("cx", mx).attr("cy", my).attr("r", 0).style("opacity", 0);
    }

    /* The break-up, in one pass: the rest of the country clears out, the
       metro dot collapses into its ring, and the places it was standing in
       for spill out of that same point to their own growth rates. */
    function run(){
      reset();

      field.transition().duration(520).style("opacity", 0);
      metroLabel.transition().duration(320).style("opacity", 0);
      metroDot.transition().delay(320).duration(340)
        .attr("r", 0).style("opacity", 0);
      ring.transition().delay(520).duration(300).style("opacity", 1);

      places.transition()
        .delay((d, i) => d.home ? 560 : 660 + i * 16)
        .duration(900).ease(d3.easeCubicOut)
        .attr("cx", px).attr("cy", py)
        .attr("r", d => pr(d.size))
        .style("opacity", 1);

      cityLabel.transition().delay(1400).duration(400).style("opacity", 1);
    }

    const btn = document.getElementById("cimReplayBtn");
    if (btn) btn.addEventListener("click", run);

    // Play once when the section first scrolls into view.
    new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        setTimeout(run, 350);
        obs.disconnect();
      });
    }, { threshold: 0.35 }).observe(el);
  }


  /* ---------- export treemap: transformation options 1-4 ----------
     Stakeholder-facing, numbered on the right of the controls bar. Each
     number transforms the export treemap (or annotates it) around whichever
     "Color by" is active: 1 = ranked list beside the map, 2 = one-axis
     swarm. The metric follows the
     colour mode: complexity -> PCI, tradability -> traded share, sector -> jobs.
     Clicking the active number restores the plain map. */
  let exportOpt = 0;
  let exportView = "map";   /* the treemap is always the default view */
  let exportListOn = false; /* option 1's side list, off until asked for */
  const EOPT_DUR = 950;

  function pciNumOf(name){
    const v = pciByName.get(name);
    return v == null ? 0 : Math.round(v * 100) / 100;
  }

  function exportMetric(){
    const mode = colorMode.exportTreemapSvg;
    if (mode === COMPLEXITY) return {
      kind: "pci", axis: "Product complexity (PCI)",
      listTitle: "Top 5 most complex industries",
      corner: "big and complex",
      val: n => pciNumOf(n),
      fmt: v => "PCI " + v.toFixed(2), barFmt: v => v.toFixed(2)
    };
    if (mode === TRADABILITY) return {
      kind: "trd", axis: "Tradability (0 local \u2192 1 traded)",
      listTitle: "Top 5 most traded industries",
      corner: "big and traded",
      val: n => tradabilityOf(n),
      fmt: v => v.toFixed(2), barFmt: v => v.toFixed(2)
    };
    return {
      kind: "jobs", axis: "Jobs (log scale)",
      listTitle: "Top 5 industries by jobs",
      fmt: v => Math.round(v).toLocaleString() + " jobs",
      barFmt: v => Math.round(v).toLocaleString(), log: true
    };
  }
  const exVal  = (m, d) => m.val ? m.val(d.data.name) : d.value;
  const exRank = (m, d) => m.rank ? m.rank(d.data.name) : exVal(m, d);

  function exportAltLabel(){
    const m = exportMetric();
    if (exportOpt === 2) return m.kind === "pci" ? "Ordered by complexity"
                       : m.kind === "trd" ? "Ordered by tradability" : "Ordered by jobs";
    if (exportOpt === 3) return m.kind === "pci" ? "Most complex, ranked"
                       : m.kind === "trd" ? "Most traded, ranked" : "Biggest, ranked";
    if (exportOpt === 4) return m.kind === "pci" ? "Complexity vs. jobs"
                       : m.kind === "trd" ? "Tradability vs. jobs" : "Jobs by sector";
    return "";
  }

  function updateExportViewSeg(){
    const wrap = document.getElementById("exportViewWrap");
    if (!wrap) return;
    const show = exportOpt >= 2;
    wrap.hidden = !show;
    if (!show) return;
    wrap.querySelector('[data-view="alt"]').textContent = exportAltLabel();
    wrap.querySelectorAll(".seg-btn").forEach(b => {
      const on = (b.dataset.view === "alt") === (exportView === "alt");
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", String(on));
    });
  }

  function applyExportOption(animate){
    const svgEl = document.getElementById("exportTreemapSvg");
    const listWrap = document.getElementById("exportTopList");
    if (!svgEl || !listWrap) return;
    const svg = d3.select(svgEl);
    const cells = svg.selectAll("g.industry");
    if (cells.empty()) return;
    const m = exportMetric();
    const dur = animate ? EOPT_DUR : 0;
    const leaves = cells.data();
    if (exportClearHover) exportClearHover();   /* no highlight survives a view change */
    const W2 = WIDTH, H2 = HEIGHT;

    svg.selectAll(".opt-overlay").interrupt().transition().duration(200).attr("opacity", 0).remove();
    listWrap.hidden = true; listWrap.textContent = "";
    cells.style("opacity", 1);

    const restoreMap = () => {
      svg.selectAll(".sector-layer").interrupt().transition().duration(dur * .6).style("opacity", 1);
      cells.select("rect").interrupt().transition().duration(dur).ease(d3.easeCubicInOut)
        .attr("x", d => d.x0).attr("y", d => d.y0)
        .attr("width", d => d.x1 - d.x0).attr("height", d => d.y1 - d.y0)
        .attr("rx", 0).attr("opacity", 1)
        .attr("stroke", null).attr("stroke-width", null);
      cells.select("text").interrupt().transition()
        .delay(dur ? dur - 150 : 0).duration(300).attr("opacity", 1);
    };

    if (exportOpt === 0){ restoreMap(); return; }

    const vizRow = document.querySelector(".export-viz-row");
    if (vizRow) vizRow.classList.toggle("with-list", exportOpt === 1 && exportListOn);

    if (exportOpt === 1){
      restoreMap();
      if (!exportListOn) return;
      const ranked = [...leaves].sort((a, b) => exRank(m, b) - exRank(m, a));
      const groups = [];
      if (m.kind === "trd"){
        /* tradability cuts both ways: the local tail is often the story */
        groups.push(["Top 5 most traded", ranked.slice(0, 5)]);
        groups.push(["Top 5 most local", ranked.slice(-5).reverse()]);
      } else {
        groups.push([m.listTitle, ranked.slice(0, 5)]);
      }
      groups.forEach(([gTitle, items], gi) => {
      const title = document.createElement("div");
      title.className = "toplist-title";
      title.textContent = gTitle + (gi === 0 ? " (hover to locate)" : "");
      listWrap.appendChild(title);
      items.forEach((d, i) => {
        const b = document.createElement("button");
        b.type = "button";
        const valTxt = m.isNew && m.isNew(d.data.name) ? "new since 2015" : m.fmt(exVal(m, d));
        b.innerHTML = '<span class="rk">' + (i + 1) + '</span><span>' + d.data.name +
                      '</span><span class="pci">' + valTxt + '</span>';
        b.addEventListener("mouseenter", () => {
          cells.style("opacity", c => c === d ? 1 : .18)
            .select("rect").style("stroke", c => c === d ? "#1a2226" : null)
            .style("stroke-width", c => c === d ? 2.5 : null);
          svg.selectAll(".sector-layer").style("opacity", .18);
        });
        b.addEventListener("mouseleave", () => {
          cells.style("opacity", 1).select("rect").style("stroke", null).style("stroke-width", null);
          svg.selectAll(".sector-layer").style("opacity", 1);
        });
        listWrap.appendChild(b);
      });
      });
      listWrap.hidden = false;
      return;
    }

    /* options 2-4 rest on the treemap until the reader flips their toggle */
    if (exportView !== "alt"){ restoreMap(); return; }

    /* the morphs: sector blocks and cell labels step aside */
    svg.selectAll(".sector-layer").interrupt().transition().duration(300).style("opacity", 0);
    cells.select("text").interrupt().transition().duration(250).attr("opacity", 0);
    const ov = svg.append("g").attr("class", "opt-ax opt-overlay").attr("opacity", 0);
    const moveRect = (sel, fx, fy, fw, fh, frx) => sel.select("rect").interrupt()
      .transition().duration(dur).ease(d3.easeCubicInOut)
      .attr("x", fx).attr("y", fy).attr("width", fw).attr("height", fh)
      .attr("rx", frx).attr("opacity", 1).attr("stroke", null).attr("stroke-width", null);

    if (exportOpt === 2){
      const vals = leaves.map(d => exVal(m, d));
      const x = m.log
        ? d3.scaleLog([Math.max(1, d3.min(vals)), d3.max(vals)], [46, W2 - 26])
        : d3.scaleLinear([d3.min(vals), d3.max(vals)], [46, W2 - 26]);
      const r = d3.scaleSqrt([0, d3.max(leaves, d => d.value)], [2, 34]);
      const nodes = leaves.map(d => ({d, x: x(exVal(m, d)), y: H2 * .46, r: r(d.value)}));
      const sim = d3.forceSimulation(nodes)
        .force("x", d3.forceX(n => x(exVal(m, n.d))).strength(1))
        .force("y", d3.forceY(H2 * .46).strength(.08))
        .force("c", d3.forceCollide(n => n.r + .6)).stop();
      for (let i = 0; i < 200; i++) sim.tick();
      /* no dot may leave the sheet: pin centres a radius inside every edge */
      nodes.forEach(n => {
        n.x = Math.max(n.r + 2, Math.min(W2 - n.r - 2, n.x));
        n.y = Math.max(n.r + 2, Math.min(H2 - 60 - n.r, n.y));
      });
      const pos = new Map(nodes.map(n => [n.d, n]));
      moveRect(cells,
        d => pos.get(d).x - pos.get(d).r, d => pos.get(d).y - pos.get(d).r,
        d => pos.get(d).r * 2, d => pos.get(d).r * 2, d => pos.get(d).r);
      ov.append("line").attr("x1", 26).attr("x2", W2 - 16).attr("y1", H2 - 46).attr("y2", H2 - 46);
      ov.append("text").attr("class", "axname").attr("x", W2 / 2).attr("y", H2 - 24)
        .attr("text-anchor", "middle").text(m.axis + " →");
      const lead = [...leaves].sort((a, b) => exRank(m, b) - exRank(m, a))[0];
      const lp = pos.get(lead), t = lead.data.name;
      const est = t.length * 6.4;
      const labY = Math.max(16, lp.y - lp.r - 24);
      const lx = Math.max(est / 2 + 8, Math.min(lp.x, W2 - 10 - est / 2));
      ov.append("circle").attr("class", "opt-lead-ring")
        .attr("cx", lp.x).attr("cy", lp.y).attr("r", lp.r + 3.5);
      ov.append("line").attr("class", "opt-lead-stem")
        .attr("x1", lp.x).attr("y1", lp.y - lp.r - 5)
        .attr("x2", lx).attr("y2", labY + 4);
      ov.append("text").attr("class", "opt-dotlab").attr("x", lx).attr("y", labY)
        .attr("text-anchor", "middle").text(t);
      ov.transition().delay(Math.max(0, dur - 200)).duration(400).attr("opacity", 1);
      return;
    }

    if (exportOpt === 4){
      const R = 8;
      const jobs = leaves.map(d => d.value);
      if (m.kind === "jobs"){
        /* sector strip plot: a row per sector, jobs along x */
        const sectors = [...new Set(leaves.map(d => d.parent.data.name))];
        const band = d3.scalePoint().domain(sectors).range([34, H2 - 72]).padding(.5);
        const x = d3.scaleLog([Math.max(1, d3.min(jobs)), d3.max(jobs)], [120, W2 - 26]);
        const jit = d => { let h = 0; for (const c of d.data.name) h = (h * 31 + c.charCodeAt(0)) | 0;
                           return ((h >>> 0) % 21) - 10; };
        moveRect(cells,
          d => x(Math.max(1, d.value)) - R, d => band(d.parent.data.name) + jit(d) - R,
          R * 2, R * 2, R);
        sectors.forEach(s => {
          ov.append("text").attr("x", 4).attr("y", band(s) + 4).attr("font-size", 10)
            .text(s.length > 16 ? s.slice(0, 15) + "…" : s);
        });
        ov.append("line").attr("x1", 110).attr("x2", W2 - 16).attr("y1", H2 - 48).attr("y2", H2 - 48);
        ov.append("text").attr("class", "axname").attr("x", (W2 + 100) / 2).attr("y", H2 - 26)
          .attr("text-anchor", "middle").text("Jobs (log) →");
      } else {
        const vals = leaves.map(d => exVal(m, d));
        const x = d3.scaleLinear([d3.min(vals), d3.max(vals)], [56, W2 - 26]);
        const y = d3.scaleLog([Math.max(1, d3.min(jobs)), d3.max(jobs)], [H2 - 62, 22]);
        moveRect(cells,
          d => x(exVal(m, d)) - R, d => y(Math.max(1, d.value)) - R, R * 2, R * 2, R);
        ov.append("line").attr("x1", 46).attr("x2", W2 - 16).attr("y1", H2 - 48).attr("y2", H2 - 48);
        ov.append("line").attr("x1", 46).attr("x2", 46).attr("y1", 14).attr("y2", H2 - 48);
        ov.append("text").attr("x", 50).attr("y", H2 - 28).text("← " + m.axis + " →");
        ov.append("text").attr("class", "axname").attr("x", 14).attr("y", 26)
          .attr("transform", "rotate(-90 14 26)").attr("text-anchor", "end").text("jobs (log)");
        const medX = d3.median(vals), medY = d3.median(jobs);
        ov.append("line").attr("class", "opt-quad")
          .attr("x1", x(medX)).attr("x2", x(medX)).attr("y1", 14).attr("y2", H2 - 48);
        ov.append("line").attr("class", "opt-quad")
          .attr("x1", 46).attr("x2", W2 - 16).attr("y1", y(medY)).attr("y2", y(medY));
        ov.append("text").attr("class", "opt-quadlab").attr("x", W2 - 20).attr("y", 30)
          .attr("text-anchor", "end").text(m.corner + " → the corner that matters");
      }
      ov.transition().delay(Math.max(0, dur - 200)).duration(400).attr("opacity", 1);
      return;
    }

    if (exportOpt === 3){
      const top = [...leaves].sort((a, b) => exRank(m, b) - exRank(m, a)).slice(0, 12);
      const rows = new Map(top.map((d, i) => [d, i]));
      const GUT = 330, rowH = (H2 - 66) / 12, barH = Math.min(26, rowH - 8);
      const xw = d3.scaleLinear([0, exVal(m, top[0])], [GUT, W2 - 96]);
      const rowY = i => 16 + i * rowH;
      cells.filter(d => !rows.has(d)).select("rect").interrupt()
        .transition().duration(dur * .8)
        .attr("x", d => (d.x0 + d.x1) / 2).attr("y", d => (d.y0 + d.y1) / 2)
        .attr("width", 0).attr("height", 0).attr("opacity", 0);
      moveRect(cells.filter(d => rows.has(d)),
        GUT, d => rowY(rows.get(d)), d => Math.max(2, xw(exVal(m, d)) - GUT), barH, 2);
      top.forEach((d, i) => {
        const n = d.data.name;
        ov.append("text").attr("class", "opt-bar-name").attr("x", GUT - 8)
          .attr("y", rowY(i) + barH / 2 + 4).attr("text-anchor", "end")
          .text(n.length > 52 ? n.slice(0, 51) + "…" : n);
        const valTxt = m.isNew && m.isNew(d.data.name) ? "new" : m.barFmt(exVal(m, d));
        ov.append("text").attr("class", "opt-bar-val")
          .attr("x", xw(exVal(m, d)) + 6).attr("y", rowY(i) + barH / 2 + 4).text(valTxt);
      });
      ov.append("text").attr("class", "axname").attr("x", GUT).attr("y", H2 - 14)
        .text("bar length = " + m.axis.toLowerCase());
      ov.transition().delay(Math.max(0, dur - 200)).duration(400).attr("opacity", 1);
      return;
    }

  }

  function refreshExportOption(){
    if (!exportOpt) return;
    updateExportViewSeg();
    updateTopBtn();
    applyExportOption(true);
  }

  function updateTopBtn(){
    const b = document.getElementById("exportTopBtn");
    if (!b) return;
    b.hidden = exportOpt !== 1;
    /* the switch names what it will actually show under the active Color by */
    const mk = exportMetric().kind;
    const lab = b.querySelector(".switch-label");
    if (lab) lab.textContent =
        mk === "pci" ? "Show Most Complex Industries"
      : mk === "trd" ? "Show Most & Least Traded Industries"
      :                "Show Largest Industries";
    b.setAttribute("aria-pressed", String(exportListOn));
  }

  /* one labelled slot in the bar carries whichever control the active
     option brings: "Top industries" for the list, "View" for the morphs */
  function updateExportOptCtl(){
    const ctl = document.getElementById("exportOptCtl");
    if (!ctl) return;
    ctl.hidden = !exportOpt;
    ctl.dataset.opt = String(exportOpt);   /* lets CSS hard-guard per option */
    /* option 1's button names itself; the morph options keep a View label */
    const lab = document.getElementById("exportOptCtlLabel");
    if (lab){ lab.hidden = exportOpt === 1; lab.textContent = "View"; }
  }

  /* One tooltip serves every form a treemap's cells take — tiles, swarm
     dots, ranked bars, the tradable/local split — because the morphs reuse
     the same elements. Same card pattern as the RCA row tooltips. */
  let exportClearHover = null;     /* lets view changes clear a live highlight */
  let tradableClearHover = null;   /* same, for the split animation */

  /* Cursor tooltips prefer the top-right corner of the cursor; when the
     cursor is too close to the frame's top the tip flips BELOW it, and when
     it is too close to the right edge it flips to the left of the cursor —
     never pinned to an edge while the cursor keeps moving.
     Where the frame is too narrow to hold the card beside the cursor at all
     (a card is 330 wide and a stage can be narrower than twice that), the
     card centres ON the cursor rather than parking against the left edge,
     which is what made it look stuck while the pointer moved. */
  function cursorTipPos(ev, wrap, tip){
    const w = wrap.getBoundingClientRect();
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    const x = ev.clientX - w.left, y = ev.clientY - w.top;
    let left = x + 10;
    if (left + tw > w.width){
      left = x - tw - 10;
      if (left < 0) left = x - tw / 2;
    }
    let top = y - th - 10;
    if (top < 0) top = y + 14;
    /* the card is laid out inside the frame, so where the frame has been
       panned sideways the card's place moves by as much */
    const sx = wrap.scrollLeft || 0;
    tip.style.left = (sx + Math.max(0, Math.min(left, Math.max(0, w.width - tw)))) + "px";
    tip.style.top  = Math.max(0, Math.min(top, Math.max(0, w.height - th))) + "px";
  }

  function attachCellTip(svgEl, wrap, tip){
    /* Self-healing highlight: re-parenting a hovered node (the bring-to-
       front) can swallow its mouseleave, so never trust leave alone — track
       the hot mark and clear it on the next enter, on leaving the svg, and
       on any view change. */
    let hot = null;
    const clearHot = () => {
      tip.hidden = true;
      if (!hot) return;
      d3.select(hot).select("rect").style("stroke", null).style("stroke-width", null);
      hot = null;
    };
    d3.select(svgEl).on("mouseleave.celltip", () => { tip.hidden = true; clearHot(); });
    d3.select(svgEl).selectAll("g.industry")
      .on("mouseenter", function(ev, d){
        clearHot();
        hot = this;
        const name = d.data.name;
        const mode = colorMode[svgEl.id];
        let extra = "";
        if (mode === COMPLEXITY)
          extra = '<div class="tip-row"><span>Complexity (PCI)</span><span>' +
                  pciNumOf(name).toFixed(2) + '</span></div>';
        if (mode === TRADABILITY)
          extra = '<div class="tip-row"><span>Tradability</span><span>' +
                  tradabilityOf(name).toFixed(2) + '</span></div>';
        tip.innerHTML = '<strong>' + name + '</strong>' +
          '<div class="tip-row"><span>Sector</span><span>' + d.parent.data.name + '</span></div>' +
          '<div class="tip-row"><span>Jobs</span><span>' +
            Math.round(d.value).toLocaleString() + '</span></div>' + extra;
        tip.hidden = false;
        cursorTipPos(ev, wrap, tip);
        /* the mark answers the cursor: ink outline, brought to the front
           because swarm dots overlap (inline style so it beats the CSS) */
        this.parentNode.appendChild(this);
        d3.select(this).select("rect").style("stroke", "#1a2226").style("stroke-width", 2.5);
      })
      .on("mousemove", function(ev){
        cursorTipPos(ev, wrap, tip);
      })
      .on("mouseleave", function(){
        tip.hidden = true;
        clearHot();
      });
    return clearHot;
  }

  /* ---- share strips: one headline percentage per treemap reading ----
     A jobs-weighted share of the metro above a stated threshold, drawn as a
     number plus a 100% bar, so every colour ramp also gets its one-line
     quantitative summary. */
  function jobsShare(pred){
    let hit = 0, tot = 0;
    industryData.forEach(r => { tot += r.employ; if (pred(r)) hit += r.employ; });
    return tot ? hit / tot : 0;
  }

  function donutStat(host, pct, color, caption){
    if (!host) return;
    const r = 15.5, c = 2 * Math.PI * r;
    host.innerHTML =
      '<svg class="ds-donut" width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">' +
        '<circle class="ds-track" cx="20" cy="20" r="' + r + '"/>' +
        '<circle class="ds-val" cx="20" cy="20" r="' + r + '" style="stroke:' + color +
          '" stroke-dasharray="' + (c * pct).toFixed(2) + ' ' + (c * (1 - pct)).toFixed(2) + '"/>' +
      '</svg>' +
      '<span class="ds-txt"><span class="ds-num">' + Math.round(pct * 100) + '%</span>' +
      '<span class="ds-cap">' + caption + '</span></span>';
    host.hidden = false;
  }

  /* The export map's stat follows the Color-by mode and hides with it. */
  function updateExportHeadStat(){
    const host = document.getElementById("exportHeadStat");
    if (!host) return;
    const mode = colorMode.exportTreemapSvg;
    if (mode === COMPLEXITY)
      donutStat(host, jobsShare(r => pciNumOf(r.name) > 0), "#2f7d6a",
        "of metro jobs \u00b7 above-average complexity");
    else if (mode === TRADABILITY)
      donutStat(host, jobsShare(r => isTradable(r.name)), token("--teal", "#255862"),
        "of metro jobs \u00b7 widely traded");
    else host.hidden = true;
  }

  /* ---- the lean map: what the place does more of than its metro ----
     The same sector blocks as the merged admin map, recoloured by each
     sector's share of the city against its share of the metro (the form the reference proto uses; ours computes ~1.6× from ADMIN_SHARE). House
     diverging pair: russet = leans less, teal = leans more, parity pale. */
  /* The two commuting donuts — real LEHD-style shares from the reference. */
  function initCommuteStats(){
    donutStat(document.getElementById("commuteOutStat"), 0.54, token("--teal", "#255862"),
      'of residents\u2019 jobs \u00b7 inside <span class="city-short">Boston</span>');
    donutStat(document.getElementById("commuteInStat"), 0.26, token("--teal", "#255862"),
      'of <span class="city-short">Boston</span>\u2019s jobs \u00b7 held by residents');
  }

  function initLeanMap(){
    const el = document.getElementById("leanMapSvg");
    if (!el) return;
    const root = layout(industryData, "root", WIDTH);
    const total = d3.sum(root.children, sec => sec.value);

    /* Two ways to count, as in the reference's Count control: jobs located
       inside the admin boundary (ADMIN_SHARE), or the jobs the city's
       residents hold wherever those jobs sit. The residence profile is
       authored as relative propensities and normalised so its jobs-weighted
       mean lands exactly on the canon: 334,026 resident jobs over the
       metro's real total. */
    const RESIDENT_PROFILE = {
      Construction: .6, "Education & Health": 1.25, "Financial Activities": 1.15,
      "Leisure & Hospitality": 1.2, Manufacturing: .45, "Natural Resources": .5,
      Other: 1.05, "Professional & Business": 1.1, "Trade & Transportation": .8
    };
    const RES_OVERALL = 334026 / totalCityJobs;
    const profOf = sec => RESIDENT_PROFILE[sec.data.name] !== undefined ? RESIDENT_PROFILE[sec.data.name] : 1;
    const profMean = d3.sum(root.children, sec => sec.value * profOf(sec)) / total;
    const admShareOf = sec => ADMIN_SHARE[sec.data.name] !== undefined ? ADMIN_SHARE[sec.data.name] : 0.15;
    const admOverall = d3.sum(root.children, sec => sec.value * admShareOf(sec)) / total;

    const LENSES = {
      work: { overall: admOverall, shareOf: admShareOf,
              shareLbl: cityName + " admin share of this sector",
              allLbl: cityName + " admin share of all metro jobs" },
      res:  { overall: RES_OVERALL,
              shareOf: sec => profOf(sec) * (RES_OVERALL / profMean),
              shareLbl: "held by " + cityName + " residents — this sector",
              allLbl: "held by " + cityName + " residents — all metro jobs" }
    };
    let lens = "work";

    /* the frame IS the treemap's frame: the blocks state sits at the exact
       coordinates the admin-share animation ends on, so the scroll from one
       step to the next hands off pixel-identical — no redraw, the same map
       simply starts to morph. Any spare height centers the bar chart. */
    const W = 880, ROW = 36, MB = 66;
    const need = 26 + root.children.length * ROW + MB;
    const H = Math.max(need, HEIGHT);
    const MT = 26 + (H - need) / 2;
    el.setAttribute("viewBox", "0 0 " + W + " " + H);
    el.setAttribute("height", H);
    const BASE = 500, K = 140, LOGMIN = -2.1, LOGMAX = 0.9;
    const xOf = r => BASE + K * Math.max(LOGMIN, Math.min(LOGMAX, Math.log2(r)));

    /* two geometries per sector under the current lens: its block on the
       sector map and its bar row. The SOLID band — the counted slice — is
       the element that morphs; the veiled remainder just fades away. */
    function computeGeo(){
      const L = LENSES[lens];
      const ratioOf = sec => L.shareOf(sec) / L.overall;
      const rows = [...root.children].sort((a, b) => ratioOf(b) - ratioOf(a));
      const geo = new Map(rows.map((d, i) => {
        const share = L.shareOf(d), r = ratioOf(d), x = xOf(r);
        const bx = d.x0, bw = d.x1 - d.x0;
        const by = d.y0, bh = d.y1 - d.y0;
        return [d.data.name, {
          share, r,
          ghost: { x: bx, y: by, w: bw, h: bh * (1 - share) },
          solid: { x: bx, y: by + bh * (1 - share), w: bw, h: bh * share },
          bar:   { x: Math.min(BASE, x), y: MT + i * ROW + 4, w: Math.abs(x - BASE), h: 22 },
          tipX: x
        }];
      }));
      return { rows, geo, overall: L.overall };
    }
    let cur = computeGeo();

    const svg = d3.select(el);
    svg.selectAll("*").remove();

    /* bar furniture, hidden until the bars state; rebuilt on lens change
       because the ranking and the values both move with the count */
    const furn = svg.append("g").attr("class", "lean-furn").style("opacity", 0);
    function buildFurn(){
      furn.selectAll("*").remove();
      furn.append("line")
        .attr("x1", BASE).attr("x2", BASE)
        .attr("y1", MT - 12).attr("y2", MT + cur.rows.length * ROW + 8)
        .attr("stroke", "#8a989d").attr("stroke-width", 1.5);
      cur.rows.forEach((d, i) => {
        const g0 = cur.geo.get(d.data.name);
        furn.append("text")
          .attr("x", 280).attr("y", MT + i * ROW + 22)
          .attr("text-anchor", "end")
          .style("fill", "#1a2226").style("stroke", "none")
          .attr("font-size", 13.5).attr("font-weight", 600)
          .text(d.data.name);
        furn.append("text")
          .attr("x", g0.r >= 1 ? g0.tipX + 8 : g0.tipX - 8)
          .attr("y", MT + i * ROW + 23)
          .attr("text-anchor", g0.r >= 1 ? "start" : "end")
          .style("fill", "#1a2226").style("stroke", "none")
          .attr("font-size", 13).attr("font-weight", 700)
          .text(g0.r.toFixed(2).replace(/0$/, "") + "×");
      });
      furn.append("text")
        .attr("x", BASE).attr("y", MT + cur.rows.length * ROW + 26)
        .attr("text-anchor", "middle")
        .style("fill", "#5b686d").style("stroke", "none").attr("font-size", 12)
        .text("same as the metro");
      furn.append("text")
        .attr("x", BASE).attr("y", MT + cur.rows.length * ROW + 46)
        .attr("text-anchor", "middle")
        .style("fill", "#5b686d").style("stroke", "none").attr("font-size", 12)
        .text(lens === "work"
          ? "share of " + cityName + " ÷ share of the metro"
          : "share of residents’ work ÷ share of the metro");
    }
    buildFurn();

    /* the sectors: pale ghost (the uncounted remainder), solid slice, name */
    const secs = svg.selectAll("g.lean-sec").data(root.children, d => d.data.name)
      .join("g").attr("class", "lean-sec");
    secs.each(function(d){
      const g0 = cur.geo.get(d.data.name);
      const sel = d3.select(this);
      sel.append("rect").attr("class", "ln-ghost")
        .attr("x", g0.ghost.x).attr("y", g0.ghost.y)
        .attr("width", g0.ghost.w).attr("height", g0.ghost.h)
        .attr("fill", sectorColors[d.data.name]).attr("fill-opacity", .26)
        .attr("stroke", "#fff").attr("stroke-width", 1);
      sel.append("rect").attr("class", "ln-solid")
        .attr("x", g0.solid.x).attr("y", g0.solid.y)
        .attr("width", g0.solid.w).attr("height", g0.solid.h)
        .attr("fill", sectorColors[d.data.name])
        .attr("stroke", "#fff").attr("stroke-width", .8);
      if (g0.ghost.w > 70 && (g0.ghost.h + g0.solid.h) > 40)
        sel.append("text").attr("class", "ln-name")
          .attr("x", g0.ghost.x + 8).attr("y", g0.ghost.y + 17)
          .style("fill", "#1a2226").style("stroke", "none")
          .attr("font-size", 13).attr("font-weight", 600)
          .text(fitLabel(d.data.name, { width: g0.ghost.w, height: 40 }));
    });

    let view = "blocks", visible = false, playTimer = null;
    const DUR = 850;
    function toBars(animate){
      view = "bars";
      buildFurn();                       // the lens may have changed meanwhile
      const t = animate ? DUR : 0;
      secs.selectAll(".ln-ghost").transition().duration(t * .5).attr("fill-opacity", 0);
      secs.selectAll(".ln-name").transition().duration(t * .4).style("opacity", 0);
      secs.each(function(d){
        const g0 = cur.geo.get(d.data.name);
        d3.select(this).select(".ln-solid")
          .transition().duration(t).ease(d3.easeCubicInOut)
          .attr("x", g0.bar.x).attr("y", g0.bar.y)
          .attr("width", g0.bar.w).attr("height", g0.bar.h);
      });
      furn.transition().delay(t * .55).duration(Math.max(1, t * .5)).style("opacity", 1);
    }
    function toBlocks(animate){
      view = "blocks";
      const t = animate ? DUR : 0;
      furn.transition().duration(t * .35).style("opacity", 0);
      secs.each(function(d){
        const g0 = cur.geo.get(d.data.name);
        const s = d3.select(this);
        s.select(".ln-ghost").attr("height", g0.ghost.h);   // lens-true remainder
        s.select(".ln-solid")
          .transition().duration(t).ease(d3.easeCubicInOut)
          .attr("x", g0.solid.x).attr("y", g0.solid.y)
          .attr("width", g0.solid.w).attr("height", g0.solid.h);
      });
      secs.selectAll(".ln-ghost").transition().delay(t * .4).duration(t * .5).attr("fill-opacity", .26);
      secs.selectAll(".ln-name").transition().delay(t * .5).duration(t * .4).style("opacity", 1);
    }

    /* the Count control: same chart, different question — where the job
       sits, or what the residents do. Re-rank and re-scale in place. */
    function setLens(k, animate){
      if (k === lens) return;
      lens = k;
      cur = computeGeo();
      document.querySelectorAll("#leanLensSeg .seg-btn").forEach(b => {
        const on = b.dataset.l === lens;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", String(on));
      });
      const t = animate ? 600 : 0;
      if (view === "bars"){
        buildFurn();
        furn.style("opacity", 1);
        secs.each(function(d){
          const g0 = cur.geo.get(d.data.name);
          d3.select(this).select(".ln-solid")
            .transition().duration(t).ease(d3.easeCubicInOut)
            .attr("x", g0.bar.x).attr("y", g0.bar.y)
            .attr("width", g0.bar.w).attr("height", g0.bar.h);
        });
      } else {
        secs.each(function(d){
          const g0 = cur.geo.get(d.data.name);
          const s = d3.select(this);
          s.select(".ln-solid")
            .transition().duration(t).ease(d3.easeCubicInOut)
            .attr("x", g0.solid.x).attr("y", g0.solid.y)
            .attr("width", g0.solid.w).attr("height", g0.solid.h);
          s.select(".ln-ghost")
            .transition().duration(t).ease(d3.easeCubicInOut)
            .attr("height", g0.ghost.h);
        });
      }
      renderNote();
    }
    document.querySelectorAll("#leanLensSeg .seg-btn").forEach(b =>
      b.addEventListener("click", () => setLens(b.dataset.l, true)));

    /* every arrival replays: the blocks hold for a beat, then the solid
       slices line up — scrolling away and back always runs it again */
    function playSeq(){
      clearTimeout(playTimer);
      toBlocks(false);
      playTimer = setTimeout(() => { if (visible && view === "blocks") toBars(true); }, 650);
    }
    const inView = () => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.top < window.innerHeight * .8 &&
             r.bottom > window.innerHeight * .15;
    };
    const setVis = v => {
      if (v === visible) return;
      visible = v;
      clearTimeout(playTimer);
      if (v) playSeq();
    };
    const scroller = document.getElementById("pages");
    if (scroller) scroller.addEventListener("scroll", () => setVis(inView()), { passive: true });
    window.addEventListener("resize", () => setVis(inView()));

    /* the superlative under whichever count is on */
    function renderNote(){
      const note = document.getElementById("leanNote");
      if (!note) return;
      const top = cur.rows[0], g0 = cur.geo.get(top.data.name);
      if (lens === "work")
        note.innerHTML = "<strong>" + top.data.name + "</strong> is " +
          g0.r.toFixed(1) + "× as large a share here as in the metro — " +
          Math.round(g0.share * 100) + "% of the metro’s " + top.data.name.toLowerCase() +
          " sits inside the city, against " + Math.round(cur.overall * 100) +
          "% of the metro’s jobs overall.";
      else
        note.innerHTML = "<strong>" + top.data.name + "</strong> leads what residents do — they hold " +
          Math.round(g0.share * 100) + "% of the metro’s " + top.data.name.toLowerCase() +
          " jobs, against " + Math.round(cur.overall * 100) + "% of all metro jobs.";
    }
    renderNote();

    /* house tooltip: cursor top-right, works in both states and both counts */
    const tip = document.getElementById("leanTip");
    const wrap = document.getElementById("leanWrap");
    if (tip && wrap){
      secs.style("cursor", "default")
       .on("mouseenter", function(ev, d){
        const g0 = cur.geo.get(d.data.name);
        const L = LENSES[lens];
        tip.innerHTML = "<strong>" + d.data.name + "</strong>" +
          '<div class="tip-row"><span>Lean vs the metro</span><span><b class="tip-pct">' +
            g0.r.toFixed(2) + "×</b></span></div>" +
          '<div class="tip-row"><span>' + L.shareLbl + '</span><span>' +
            Math.round(g0.share * 100) + "%</span></div>" +
          '<div class="tip-row"><span>' + L.allLbl + '</span><span>' +
            Math.round(cur.overall * 100) + "%</span></div>";
        tip.hidden = false;
        cursorTipPos(ev, wrap, tip);
      })
      .on("mousemove", function(ev){
        cursorTipPos(ev, wrap, tip);
      })
      .on("mouseleave", function(){ tip.hidden = true; });
    }
  }

  /* ---------- 4 · from the tradable map to what the metro leads on ----------
     The closing beat of Metro Industries. It opens as a treemap of the
     tradable industries the metro is specialised in, then every cell travels
     to its own row and stretches into a bar: how many times more concentrated
     the industry is here than in a typical US metro. The four peer metros'
     average rides each row as a tick, and the top three are picked out. */
  const SPEC_TOP_N = 12;

  function initSpecializationMorph(){
    const el = document.getElementById("specMorphSvg");
    if (!el || typeof d3 === "undefined") return;

    const all = specializedWithPeers().sort((a, b) => b.rca - a.rca);
    if (!all.length) return;
    const rows = all.slice(0, SPEC_TOP_N);
    const keep = new Set(rows.map(d => d.name));

    const W = 880, ML = 292, MT = 62, MB = 30, RH = 34, PLOT_R = 812;
    const H = MT + rows.length * RH + MB;
    el.setAttribute("viewBox", "0 0 " + W + " " + H);
    el.setAttribute("height", H);

    const svg = d3.select(el);
    const x = d3.scaleLinear()
      .domain([1, d3.max(all, d => Math.max(d.rca, d.peerAvg)) * 1.06])
      .range([ML + 12, PLOT_R]);
    const rowY = i => MT + i * RH + RH / 2;
    const BAR_H = 17;
    const TEAL = token("--teal", "#255862");

    /* the opening treemap, laid out over the plot's own box so nothing has
       to jump before the morph begins */
    const tm = d3.hierarchy({ name: "S", children: all.map(d =>
        ({ name: d.name, value: d.employ, sector: d.sector })) }).sum(d => d.value);
    d3.treemap().size([W, H - 6]).paddingTop(1).paddingRight(1)
      .paddingBottom(1).paddingLeft(1)(tm);
    const cellBox = new Map();
    tm.leaves().forEach(n => cellBox.set(n.data.name,
      { x: n.x0, y: n.y0, w: n.x1 - n.x0, h: n.y1 - n.y0, sector: n.data.sector }));

    let axisG = null, drawn = false;

    function build(){
      svg.selectAll("*").remove();
      axisG = svg.append("g").attr("class", "spec-axis").style("opacity", 0);
      const g = svg.append("g").attr("class", "spec-cells");

      const cell = g.selectAll("g.spec-cell").data(all, d => d.name)
        .join("g").attr("class", "spec-cell");
      cell.append("rect").attr("class", "spec-rect")
        .attr("x", d => cellBox.get(d.name).x).attr("y", d => cellBox.get(d.name).y)
        .attr("width", d => cellBox.get(d.name).w).attr("height", d => cellBox.get(d.name).h)
        .attr("fill", d => sectorColors[d.sector] || TEAL)
        .attr("rx", 0);
      cell.append("text").attr("class", "spec-cell-lab")
        .attr("x", d => cellBox.get(d.name).x + 4).attr("y", d => cellBox.get(d.name).y + 11)
        .text(d => fitLabel(d.label, { width: cellBox.get(d.name).w, height: cellBox.get(d.name).h }));
      drawn = false;
    }

    function axis(){
      axisG.selectAll("*").remove();
      const ticks = x.ticks(5).filter(t => t >= 1);
      const t = axisG.selectAll("g.spec-tick").data(ticks).join("g").attr("class", "spec-tick");
      t.append("line").attr("class", d => "spec-grid" + (d === 1 ? " is-base" : ""))
        .attr("x1", d => x(d)).attr("x2", d => x(d))
        .attr("y1", MT - 18).attr("y2", MT + rows.length * RH);
      t.append("text").attr("class", "spec-ticklab")
        .attr("x", d => x(d)).attr("y", MT - 24).attr("text-anchor", "middle")
        .text(d => d + "×");
      axisG.append("text").attr("class", "spec-axname")
        .attr("x", ML + 12).attr("y", MT - 42)
        .text("Times more concentrated here than in a typical US metro");
    }

    function toBars(animate){
      if (drawn) return;
      drawn = true;
      /* a reader who has asked for less motion gets the ranking itself, not
         the journey to it — and the end state is then reachable without
         waiting on a frame loop */
      const reduce = window.matchMedia &&
        matchMedia("(prefers-reduced-motion: reduce)").matches;
      const run = animate !== false && !reduce;

      axis();
      const cells = svg.selectAll("g.spec-cell");
      const idx = new Map(rows.map((d, i) => [d.name, i]));
      const bars = cells.filter(d => keep.has(d.name));
      const barX = x(1);
      const geom = {
        x: barX,
        y: d => rowY(idx.get(d.name)) - BAR_H / 2,
        w: d => Math.max(2, x(d.rca) - barX),
        fill: d => idx.get(d.name) < 3 ? TEAL : "#a9c2c7"
      };

      if (!run){
        cells.filter(d => !keep.has(d.name)).remove();
        svg.selectAll(".spec-cell-lab").remove();
        bars.select(".spec-rect")
          .attr("x", geom.x).attr("y", geom.y).attr("width", geom.w)
          .attr("height", BAR_H).attr("rx", 0).attr("fill", geom.fill);
        axisG.style("opacity", 1);
        decorate(bars, idx, false);
        return;
      }

      /* everything outside the ranking leaves first, so the rows it makes
         room for are not travelling through a crowd */
      cells.filter(d => !keep.has(d.name)).transition().duration(520)
        .style("opacity", 0).remove();
      svg.selectAll(".spec-cell-lab").transition().duration(260).style("opacity", 0);

      let ended = false;
      bars.select(".spec-rect").transition().delay(320).duration(1150)
        .ease(d3.easeCubicInOut)
        .attr("x", geom.x).attr("y", geom.y).attr("width", geom.w)
        .attr("height", BAR_H).attr("rx", 0).attr("fill", geom.fill)
        .on("end", function(){
          if (ended) return;          // once for the group, not once per bar
          ended = true;
          decorate(bars, idx, true);
        });

      axisG.transition().delay(420).duration(600).style("opacity", 1);
    }

    /* the row's furniture arrives once the bars have stopped moving: name,
       multiplier, the peer tick, and a rank badge on the leading three */
    function decorate(bars, idx, animate){
      const fade = (sel, delay) => animate
        ? sel.style("opacity", 0).transition().delay(delay).duration(420).style("opacity", 1)
        : sel;
      bars.each(function(d){
        const i = idx.get(d.name), g = d3.select(this), y = rowY(i), top3 = i < 3;
        fade(g.append("text").attr("class", "spec-name" + (top3 ? " is-top" : ""))
          .attr("x", ML - 10).attr("y", y + 4).attr("text-anchor", "end")
          .text(d.label), 0);
        fade(g.append("text").attr("class", "spec-val" + (top3 ? " is-top" : ""))
          .attr("x", Math.max(x(d.rca), x(d.peerAvg)) + 9).attr("y", y + 4)
          .text(d.rca.toFixed(1) + "\u00d7"), 120);
        /* the peer metros' average, as a tick standing across the bar */
        fade(g.append("line").attr("class", "spec-peer")
          .attr("x1", x(d.peerAvg)).attr("x2", x(d.peerAvg))
          .attr("y1", y - BAR_H / 2 - 4).attr("y2", y + BAR_H / 2 + 4), 260);
        /* the leading three carry a numbered badge ahead of their label */
        if (top3){
          fade(g.append("circle").attr("class", "spec-badge-bg")
            .attr("cx", 14).attr("cy", y).attr("r", 9), 0);
          fade(g.append("text").attr("class", "spec-badge")
            .attr("x", 14).attr("y", y + 3.5).attr("text-anchor", "middle")
            .text(i + 1), 0);
        }
      });
    }

    build();
    const btn = document.getElementById("specReplayBtn");
    if (btn) btn.addEventListener("click", () => { build(); setTimeout(() => toBars(true), 420); });

    new IntersectionObserver((entries, obs) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        setTimeout(() => toBars(true), 420);
        obs.disconnect();
      });
    }, { threshold: 0.3 }).observe(el);
  }

  /* =====================================================================
     Metro Industries — one figure, four states

     The section's four beats share a single treemap that lives in the
     scrolly's stage. Scrolling drives it between states, and every move is a
     transition of the same cells, so nothing is ever redrawn from scratch:

       0 · the metro's mix, coloured by sector
       1 · the same mix, recoloured by how complex each industry is
       2 · the mix parts into what sells outward and what serves locally
       3 · the tradable, specialised half ranks itself as bars

     It is driven by scroll position, so it plays in reverse on the way back
     up; that is why nothing is ever removed, only faded. */
  const MI_W = 880, MI_H = 500, MI_TOP_N = 12;

  /* The coarse grain. The mix is drawn industry by industry everywhere else;
     the admin beat opens one level up, where each sector shows only its
     largest industries and rolls the rest into a single block. Areas are
     preserved, so the coarse map covers exactly the same ground as the fine
     one — only the level of detail changes. */
  /* the ranked view has to be readable as an order, and no treemap tiling
     gives that: squarify chases square cells and throws the sequence away,
     binary keeps it only loosely, and slice or dice would put 292 industries
     in slivers under a pixel. This is a strip layout — the classic answer.
     Cells run largest first, left to right along a row, then on to the next
     row, and a row closes when adding one more would make its cells worse
     shaped. Area still encodes jobs; only the reading order is imposed. */
  function stripLayout(rows, W, H, gap){
    const g = gap === undefined ? 1 : gap;
    const items = rows.slice().sort((a, b) => b.employ - a.employ);
    const total = items.reduce((s, d) => s + d.employ, 0) || 1;
    const scale = (W * H) / total;
    const out = new Map();
    let i = 0, y = 0;
    while (i < items.length){
      let sum = 0, best = Infinity, count = 0;
      for (let k = i; k < items.length; k++){
        const trySum = sum + items[k].employ * scale;
        const rowH = trySum / W;
        let worst = 0;
        for (let m = i; m <= k; m++){
          const wI = (items[m].employ * scale) / rowH;
          worst = Math.max(worst, Math.max(wI / rowH, rowH / wI));
        }
        if (worst <= best){ best = worst; sum = trySum; count = k - i + 1; }
        else break;
      }
      if (!count){ count = 1; sum = items[i].employ * scale; }
      const rowH = sum / W;
      let x = 0;
      for (let m = i; m < i + count; m++){
        const wI = (items[m].employ * scale) / rowH;
        out.set(items[m].name, {
          x: x + g / 2, y: y + g / 2,
          w: Math.max(0, wI - g), h: Math.max(0, rowH - g)
        });
        x += wI;
      }
      y += rowH; i += count;
    }
    return out;
  }

  function twoDigitRows(rows, keepPerSector){
    const keep = keepPerSector || 3, bySector = {};
    rows.forEach(d => { (bySector[d.sector] = bySector[d.sector] || []).push(d); });
    const out = [];
    Object.keys(bySector).forEach(sec => {
      const list = bySector[sec].slice().sort((a, b) => b.employ - a.employ);
      list.slice(0, keep).forEach(d => out.push({ name: d.name, sector: sec, employ: d.employ }));
      const rest = list.slice(keep);
      if (rest.length) out.push({
        /* the catch-all sector would otherwise read "Other Other" */
        name: sec === "Other" ? "All other industries" : "Other " + sec,
        sector: sec, coarse: true,
        employ: rest.reduce((a, d) => a + d.employ, 0)
      });
    });
    return out;
  }


  /* The same figure serves any section built on this grammar; `p` is the id
     prefix its markup uses and `rows` the industry set it reads, so the metro
     and the administrative city each get their own instance. */
  /* =========================================================================
     The industry map, after the reference build's "What We Produce" page.
     Every industry is a cell; the cells sit inside their industry groups
     and the groups inside their sectors, with a one-pixel gap at each level,
     so the nesting is read from the gaps alone and nothing is named on the
     map but the cells. A cell too small to see is folded into its
     neighbours: first whole groups into "Other ..." cells of their
     subsector or sector, then, inside each group, the small industries
     into an "Other ..." cell of the group - or, where the group is one big
     industry and a few tiny ones, into a single cell that carries the
     group's own name. The map is tiled in screen pixels so the gaps are a
     pixel and the type is 13px at any width (12.5 where that is what
     fits; nothing on this figure is set smaller), and read back into the
     figure's units to be drawn.
     ========================================================================= */
  const MAP = { padding: 1, minSide: 4, inset: 3, first: 1.1, step: 0.9, shareGap: 0.3,
                descent: 0.25, size: 13, min: 12.5, weight: 500, shareWeight: 400,
                /* at the sector level the nine blocks are the cells, and a
                   13px label is lost in them: the fit starts higher there */
                sectorSize: 18 };
  /* the sizes a label is tried at: whole pixels from its ceiling down,
     ending on the floor itself, which is not a whole pixel */
  const mapSizes = max => { const out = []; for (let v = max; v > MAP.min; v--) out.push(v); out.push(MAP.min); return out; };
  const MAP_FONT = '"Source Sans 3", "Source Sans Pro", sans-serif';
  /* the sector-names study: "off", or the sectors named on the map -
     "band", an 18px strip in a deeper shade of the sector's colour with a
     hairline round its block, or "gutter", the name in ink on the page's
     white above the block, the block's cells inset from it. The strip is
     screen pixels, like the labels, and the tiling makes the room for it. */
  let SEC_NAMES = "off";
  const SEC_STRIP = 18, SEC_INSET = 3, SEC_NAME_SIZE = 12.5;
  /* the grain of the map: the level its cells are tiled at - 6 the
     industries (877 in 2024), 4 the industry groups (292), 2 the sectors
     (9); 3, the subsectors (85), is tiled the same way but not offered. A
     coarser grain folds every industry into its group or sector as a
     whole before the tiling; the bars and the ranking stay industries. */
  let MAP_GRAIN = 6;
  const GRAIN_WORDS = { 6: ["industry", "industries"], 4: ["industry group", "industry groups"], 3: ["subsector", "subsectors"], 2: ["sector", "sectors"] };
  const grainWordAt = (grain, n) => (GRAIN_WORDS[grain] || GRAIN_WORDS[6])[n === 1 ? 0 : 1];
  /* the level is where the map rests; the zoom walks down from there as it
     always has, sector, then group, then the industries - so what is
     tiled is the finer of the level chosen and the depth zoomed to */
  const GRAIN_STEPS = [2, 4, 6];
  const effectiveGrain = (grain, depth) => GRAIN_STEPS[Math.max(GRAIN_STEPS.indexOf(grain) < 0 ? 2 : GRAIN_STEPS.indexOf(grain), depth)];
  /* the sector blocks' dressing (the "Sector blocks" study), for the map
     resting at the sector grain: "plain" the name and share; "card" the
     block as a card - name, share and jobs, its three largest groups, the
     complexity steps; "ghost" the groups' tiling faint inside the block;
     "cardghost" both; "change" the card with the sector's yearly change
     in jobs, 2014 to 2024. Zoomed in, the grain is finer and none of it
     applies. */
  let SEC_BLOCK = "plain";
  const SEC_BLOCK_MODES = ["plain", "card", "ghost", "cardghost", "change"];
  const SECTOR_JOBS_YEAR = {};
  function sectorJobs(year){
    if (SECTOR_JOBS_YEAR[year]) return SECTOR_JOBS_YEAR[year];
    const out = {}, src = YEARS[year];
    if (src) rowsFrom(src).forEach(r => { out[r.sector] = (out[r.sector] || 0) + r.employ; });
    return (SECTOR_JOBS_YEAR[year] = out);
  }
  const SECTOR_SHORT = { "Professional & Business": "Professional", "Education & Health": "Edu & Health",
    "Trade & Transportation": "Trade & Transport", "Leisure & Hospitality": "Leisure", "Financial Activities": "Financial",
    "Manufacturing": "Manufacturing", "Construction": "Construction", "Other": "Other", "Natural Resources": "Natural" };
  /* the band's shade: the sector's colour taken down a little, and further
     where a little leaves neither white nor ink reading 4.5 to 1 on it */
  const secDeeper = sec => {
    const c = d3.color(sectorColors[sec] || "#ccc"); if (!c) return "#888";
    for (let k = 0.55; k <= 1.6; k += 0.15){
      const d = c.darker(k), L = relLum(d.rgb());
      if (Math.max(1.05 / (L + 0.05), (L + 0.05) / (LUM_INK + 0.05)) >= 4.5) return d.formatHex();
    }
    return c.darker(1.6).formatHex();
  };
  /* the name on white: the sector's colour taken down until it reads 4.5 to
     1, and ink where no shade of it does */
  const gutterInk = sec => {
    const c = d3.color(sectorColors[sec] || "#888"); if (!c) return CELL_INK;
    for (let k = 0.9; k <= 2.6; k += 0.25){
      const d = c.darker(k), r = 1.05 / (relLum(d.rgb()) + 0.05);
      if (r >= 4.5) return d.formatHex();
    }
    return CELL_INK;
  };
  const SECTOR_RANK = new Map(SECTOR_KEYS.map((s, i) => [s.label, i]));
  /* white or ink on a sector's fill, whichever reads better on it */
  const sectorInk = sec => cellInk(sectorColors[sec] || "#ccc");
  const TIER_WORDS = ["Traded", "Partly traded", "Local"];
  const cxBinOf = pci => {
    if (pci == null) return null;
    let b = 0; while (b < PCI_CUTS.length && pci >= PCI_CUTS[b]) b++;
    return b;
  };
  const cxFillOf = pci => { const b = cxBinOf(pci); return b == null ? "#c3ccce" : complexityPalette[b]; };
  /* shares as the reference prints them: 26%, 5.4%, 0.55% */
  const fmtShare = v => { const t = v * 100; return t.toFixed(t >= 10 ? 0 : t >= 1 ? 1 : 2) + "%"; };
  const fmtJobsFull = v => Math.round(v).toLocaleString("en-US");
  const escHtml = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* a cell for one industry: named by its short name, with the full NAICS
     name kept for the card */
  function cellOfRow(r, total){
    const name = r.short || r.name;
    return { id: r.code, name: name, title: r.name !== name ? r.name : undefined,
      group: r.group, groupName: r.groupShort || r.groupName, groupTitle: r.groupName,
      subsector: r.sub, subsectorName: r.subShort || r.sub, subsectorTitle: undefined,
      sector: r.sector, tier: r.tier, pci: r.pci, rca: r.rca, jobs: r.employ,
      share: r.employ / total, nationalShare: r.nationalShare, members: null, rows: [r] };
  }
  /* a cell standing for several: jobs and shares summed, the PCI the
     jobs-weighted mean, the RCA the share-weighted one, the tier only if
     they all share it, and the members kept, largest first */
  function aggCell(id, name, cells, meta, title){
    const sum = f => cells.reduce((a, c) => a + f(c), 0);
    const withPci = cells.filter(c => c.pci != null && c.jobs > 0);
    const pciJobs = withPci.reduce((a, c) => a + c.jobs, 0);
    const withRca = cells.filter(c => c.rca != null && c.rca > 0);
    const denom = withRca.reduce((a, c) => a + c.share / c.rca, 0);
    const tiers = new Set(cells.map(c => c.tier));
    const d = cells[0] || {};
    const groupTitle = meta.groupName === undefined ? d.groupTitle : meta.groupTitle;
    const subTitle = meta.subsectorName === undefined ? d.subsectorTitle : meta.subsectorTitle;
    return { id: id, name: name, title: title,
      group: meta.group ?? d.group ?? id, groupName: meta.groupName ?? d.groupName ?? name, groupTitle: groupTitle,
      subsector: meta.subsector ?? d.subsector ?? id, subsectorName: meta.subsectorName ?? d.subsectorName ?? name,
      subsectorTitle: subTitle, sector: d.sector || "Other",
      tier: tiers.size === 1 ? (d.tier ?? null) : null,
      pci: pciJobs > 0 ? withPci.reduce((a, c) => a + (c.pci || 0) * c.jobs, 0) / pciJobs : null,
      rca: denom > 0 ? withRca.reduce((a, c) => a + c.share, 0) / denom : null,
      jobs: sum(c => c.jobs), share: sum(c => c.share), nationalShare: sum(c => c.nationalShare || 0),
      members: cells.slice().sort((a, b) => b.jobs - a.jobs),
      rows: cells.flatMap(c => c.rows) };
  }
  /* "Other legal services", "All other technical services": the group's
     name in lower case, its initialisms kept */
  function otherName(name){
    const t = name.split(" ").map(w => /^[^a-z]*[A-Z][^a-z]*[A-Z][^a-z]*$/.test(w) ? w : w.toLowerCase()).join(" ");
    return (/^other\b/.test(t) ? "All " : "Other ") + t;
  }
  /* the three levels a small cell can be folded up into */
  const LEVELS = {
    group:     { id: "group",     key: c => c.group,     name: c => c.groupName,     title: c => c.groupTitle },
    subsector: { id: "subsector", key: c => c.subsector, name: c => c.subsectorName, title: c => c.subsectorTitle },
    sector:    { id: "sector",    key: c => c.sector,    name: c => c.sector,        title: () => undefined }
  };
  /* what a folded cell is grouped under, so it tiles as its own group */
  function levelMeta(level, key, name, title){
    if (level.id === "group") return { group: key, groupName: name, groupTitle: title };
    if (level.id === "subsector") return { group: "subsector:" + key, groupName: name, groupTitle: title,
                                           subsector: key, subsectorName: name, subsectorTitle: title };
    return { group: "sector:" + key, groupName: name, subsector: "sector:" + key, subsectorName: name };
  }
  /* the items of a band rolled up to a level as wholes - one item per
     group, subsector or sector, its industries as members - for the map
     tiled at that grain */
  function levelUp(bandKey, items, level){
    const buckets = new Map();
    items.forEach(it => { const k = level.key(it.cell); if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(it); });
    return [...buckets].map(([k, list]) => {
      const first = list[0], name = level.name(first.cell), title = level.title(first.cell);
      const c = aggCell(level.id + ":" + bandKey + ":" + k, name, list.map(e => e.cell), levelMeta(level, k, name, title), title);
      return { id: c.id, sector: c.sector, group: c.group, value: list.reduce((a, e) => a + e.value, 0), cell: c };
    });
  }
  /* one band tiled, each level padded by a pixel and rounded to whole
     pixels; the sectors in the reference's fixed order, the rest by size
     with the folded "Other" cells last. Flat, a sector holds its cells
     directly - the industry map, clustered by sector and no further.
     Otherwise a group layer stands between them, which at the coarser
     grains is each cell's own box and the zoom's target. */
  function tileBand(items, box, bandKey, flat){
    const out = { blocks: [], groups: [], cells: [] };
    if (!items.length || box.w <= 0 || box.h <= 0) return out;
    const bySector = new Map();
    items.forEach(it => { if (!bySector.has(it.sector)) bySector.set(it.sector, []); bySector.get(it.sector).push(it); });
    const tree = { kind: "root", children: [...bySector].map(([sector, list]) => {
      if (flat) return { kind: "sector", sector: sector, children: list.map(it => ({ kind: "item", item: it })) };
      const byGroup = new Map();
      list.forEach(it => { const g = it.group ?? it.id; if (!byGroup.has(g)) byGroup.set(g, []); byGroup.get(g).push(it); });
      return { kind: "sector", sector: sector, children: [...byGroup].map(([group, l]) =>
        ({ kind: "group", group: group, children: l.map(it => ({ kind: "item", item: it })) })) };
    }) };
    const isRest = n => n.data.kind === "item" ? n.data.item.rest === true
      : n.data.kind === "group" && (n.children || []).every(isRest);
    const root = d3.hierarchy(tree, d => d.kind === "item" ? undefined : d.children)
      .sum(d => d.kind === "item" ? Math.max(0, d.item.value) : 0)
      .sort((a, b) => {
        if (a.data.kind === "sector" && b.data.kind === "sector")
          return (SECTOR_RANK.get(a.data.sector) ?? 0) - (SECTOR_RANK.get(b.data.sector) ?? 0);
        const ra = isRest(a), rb = isRest(b);
        return ra === rb ? (b.value || 0) - (a.value || 0) : ra ? 1 : -1;
      });
    const named = SEC_NAMES !== "off", gutter = SEC_NAMES === "gutter";
    d3.treemap().size([box.w, box.h]).paddingInner(MAP.padding)
      .paddingOuter(n => n.depth === 1 && gutter ? SEC_INSET : MAP.padding)
      .paddingTop(n => n.depth === 1 ? (named ? SEC_STRIP + (gutter ? 1 : 0) : MAP.padding) : MAP.padding)
      .round(true)(root);
    root.descendants().forEach(n => {
      const r = { x: box.x + n.x0, y: box.y + n.y0, w: Math.max(0, n.x1 - n.x0), h: Math.max(0, n.y1 - n.y0) };
      if (n.data.kind === "sector") out.blocks.push({ ...r, key: bandKey + ":" + n.data.sector, sector: n.data.sector, value: n.value || 0 });
      else if (n.data.kind === "group") out.groups.push({ ...r, key: bandKey + ":" + n.data.group, group: n.data.group,
        items: n.leaves().map(l => l.data.item) });
      else if (n.data.kind === "item") out.cells.push({ ...r, item: n.data.item });
    });
    return out;
  }
  /* the small cells of a band folded up at one level: in every bucket of
     that level, the tiny items and the bucket's existing "Other" cell (or,
     at the last level with one tiny item, its smallest neighbour) become
     one cell. When that takes the whole bucket, the cell carries the
     bucket's own name and is not "Other" at all. Null if nothing changed. */
  function mergeBucket(bandKey, items, tiny, level, last){
    const buckets = new Map();
    items.forEach(it => {
      const k = it.sector + "|" + level.key(it.cell);
      if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(it);
    });
    let changed = false;
    const out = [...buckets.values()].flatMap(t => {
      const a = t[0]; if (!a) return [];
      const s = level.key(a.cell), restId = "other:" + bandKey + ":" + level.id + ":" + s;
      const l = t.filter(e => tiny.has(e.id)), u = t.filter(e => !tiny.has(e.id));
      const d = u.find(e => e.id === restId) ??
        (last && l.length === 1 ? (u.find(e => e.rest) ?? u.reduce((m, e) => !m || e.value < m.value ? e : m, undefined)) : undefined);
      const f = d ? l.concat([d]) : l;
      if (l.length === 0 || f.length < 2 || (level.id === "sector" && d && d.id !== restId && f.length === t.length)) return t;
      changed = true;
      const whole = f.length === t.length, name = level.name(a.cell), title = level.title(a.cell);
      const c = aggCell(whole ? level.id + ":" + bandKey + ":" + s : restId, whole ? name : otherName(name),
        f.flatMap(e => e.cell.members ?? [e.cell]), levelMeta(level, s, name, title), whole ? title : undefined);
      return t.filter(e => !f.includes(e)).concat([{ id: c.id, sector: c.sector, group: c.group, rest: !whole,
        value: f.reduce((x, e) => x + e.value, 0), cell: c }]);
    });
    return changed ? out : null;
  }
  /* one round of folding across the bands, at the first level that has
     anything to fold; null when no level does */
  function mergeOnce(levels, bands, tiny){
    for (let li = 0; li < levels.length; li++){
      const level = levels[li], last = li === levels.length - 1;
      let changed = false;
      const out = bands.map(b => {
        const items = mergeBucket(b.key, b.items, tiny, level, last);
        if (items){ changed = true; return { ...b, items: items }; }
        return b;
      });
      if (changed) return out;
    }
    return null;
  }
  /* tile, fold whatever came out under four pixels a side, tile again,
     until every cell can be seen or nothing more will fold */
  function mergeLoop(levels, bands, flat){
    let cur = bands;
    for (let guard = 0; guard < 60; guard++){
      const layouts = cur.map(b => tileBand(b.items, b.box, b.key, flat));
      const tiny = new Set(layouts.flatMap(L => L.cells.filter(c => Math.min(c.w, c.h) < MAP.minSide).map(c => c.item.id)));
      if (!tiny.size) return { bands: cur, layouts: layouts };
      const next = mergeOnce(levels, cur, tiny);
      if (!next) return { bands: cur, layouts: layouts };
      cur = next;
    }
    return { bands: cur, layouts: cur.map(b => tileBand(b.items, b.box, b.key, flat)) };
  }
  /* the bands laid out. At the industry grain the map is clustered by
     sector and no further: each sector holds its industries directly, and
     the industries too small to see fold into one "Other" cell for their
     sector. (Until 2026-10-01 a 4-digit group layer stood between the two,
     with its own gutters, its own "Other" cells and a zoom of its own.) */
  function layoutBands(bands, grain){
    /* at a coarser grain the industries are rolled up as wholes first, and
       only what is still too small folds further up */
    if (grain && grain !== 6){
      const level = grain === 4 ? LEVELS.group : grain === 3 ? LEVELS.subsector : LEVELS.sector;
      const coarse = bands.map(b => ({ ...b, items: levelUp(b.key, b.items, level) }));
      const above = grain === 4 ? [LEVELS.subsector, LEVELS.sector] : grain === 3 ? [LEVELS.sector] : [];
      return mergeLoop(above, coarse);
    }
    /* a map that holds one group alone - a zoom into a group, made from
       a coarser level and carried here - folds within that group, so the
       cell is "Other <group>", named for where the reader stands, and a
       pair in which one is too small to see becomes the group's own cell */
    const oneGroup = new Set(bands.flatMap(b => b.items.map(it => it.group))).size === 1;
    return mergeLoop([oneGroup ? LEVELS.group : LEVELS.sector], bands, true);
  }

  /* ---- the cell labels: the name whole, wrapped by words, at 13px or at
     12.5, and the share under it where that still fits; a name that cannot
     be set whole leaves the cell bare ---- */
  const _mapCtx = (function(){ try { return document.createElement("canvas").getContext("2d"); } catch (e){ return null; } })();
  const _mapW = new Map();
  function mapTextW(str, size, weight){
    const key = weight + "|" + size + "|" + str;
    if (_mapW.has(key)) return _mapW.get(key);
    let w = str.length * size * 0.5;
    if (_mapCtx){ _mapCtx.font = weight + " " + size + "px " + MAP_FONT; w = _mapCtx.measureText(str).width; }
    _mapW.set(key, w);
    return w;
  }
  const lineY = (y, size, n, share) => y + size * (MAP.first + MAP.step * n + (share ? MAP.shareGap : 0));
  const blockH = (lines, size, share) => lineY(0, size, share ? lines : lines - 1, share) + size * MAP.descent;
  function wrapFit(words, size, weight, maxW){
    const out = []; let cur = "";
    for (const w of words){
      if (mapTextW(w, size, weight) > maxW) return null;
      const next = cur ? cur + " " + w : w;
      if (mapTextW(next, size, weight) <= maxW) cur = next; else { out.push(cur); cur = w; }
    }
    if (cur) out.push(cur);
    return out;
  }
  function fitLines(name, shareText, box, maxSize){
    const words = name.split(/\s+/);
    for (const size of mapSizes(maxSize || MAP.size)){
      const lines = wrapFit(words, size, MAP.weight, box.w);
      if (!lines || blockH(lines.length, size, false) > box.h) continue;
      const share = mapTextW(shareText, size, MAP.shareWeight) <= box.w && blockH(lines.length, size, true) <= box.h;
      return { x: box.x, y: box.y, lines: lines, size: size, share: share };
    }
    return null;
  }
  /* the fit depends only on the words and the cell's size, so it is cached
     on those; the cell's own corner is added on the way out */
  const _mapLab = new Map();
  function fitCellLabel(name, shareText, cell, maxSize){
    const key = name + "|" + shareText + "|" + Math.round(cell.w) + "|" + Math.round(cell.h) + "|" + (maxSize || 0);
    let fit = _mapLab.get(key);
    if (fit === undefined){
      fit = null;
      const box = { x: 0, y: 0, w: cell.w - 2 * MAP.inset, h: cell.h };
      if (box.w > 0 && box.h > 0){
        const bare = name.replace(/\s*\([^)]*\)/g, "").trim();
        for (const n of (bare && bare !== name ? [name, bare] : [name])){
          fit = fitLines(n, shareText, box, maxSize);
          if (fit) break;
        }
      }
      _mapLab.set(key, fit);
    }
    return fit ? { x: cell.x + MAP.inset, y: cell.y, lines: fit.lines, size: fit.size, share: fit.share } : null;
  }
  const clearMapMeasure = () => { _mapW.clear(); _mapLab.clear(); };
  /* The sentence's blanks are native selects, each cut to the width of the
     word it shows: left alone, a select stands at the width of its longest
     option. A hidden twin of the word is measured for it. Nothing is set
     while the blank is out of the flow - its twin measures nought then. */
  function fitPick(sel){
    const m = sel.parentNode && sel.parentNode.querySelector(".mi-measure");
    const o = sel.options[sel.selectedIndex];
    if (!m || !o) return;
    m.textContent = o.text;
    /* a held blank has no chevron, so it is cut to the word and its sides */
    const room = sel.getAttribute("aria-disabled") === "true" ? 14 : 24;
    if (m.offsetWidth) sel.style.width = (m.offsetWidth + room) + "px";
  }
  function fitPicks(root){ (root || document).querySelectorAll(".mi-pick select").forEach(fitPick); }

  function initIndustryFigure(p, rows, ctlName, opts){
    opts = opts || {};
    const el = document.getElementById(p + "TreemapSvg");
    const fig = document.getElementById(p + "Figure");
    if (!el || !fig || typeof d3 === "undefined") return;
    const industryData = rows;
    /* everything this build hangs on the page is recorded here, so a later
       build of the same figure - another year - can take it down first */
    const disposers = [];
    let dead = false;
    disposers.push(() => { dead = true; });
    const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); disposers.push(() => t.removeEventListener(ev, fn, o)); };
    /* the per-industry readings this build works from are the rows it was
       given, not the page's 2024 tables, so another year's figure reads its
       own tiers, scores and shares */
    const tierByName = new Map(rows.map(r => [r.name, r.tier]));
    const tradByName = new Map(rows.map(r => [r.name, r.trad]));
    const rcaReal = new Map(rows.map(r => [r.name, Math.round((r.rca || 0) * 100) / 100]));
    const pciByName = new Map(rows.map(r => [r.name, r.pci]));
    const tradableByName = new Map(rows.map(r => [r.name, r.tradable]));
    const tierOf = name => tierByName.has(name) ? tierByName.get(name) : 2;
    const tradabilityOf = name => tradByName.has(name) ? tradByName.get(name) : 0;
    const rcaOf = name => rcaReal.has(name) ? rcaReal.get(name) : 0;
    const isTradable = name => tradableByName.get(name) === true;

    const svg = d3.select(el);
    const TEAL = token("--teal", "#255862");
    const MUTED = "#a9c2c7";
    const ORANGE = token("--orange", "#e76565");

    const box = (n, dx, dy) => ({ x: n.x0 + (dx || 0), y: n.y0 + (dy || 0),
                                  w: Math.max(0, n.x1 - n.x0), h: Math.max(0, n.y1 - n.y0) });
    /* the older sector-grouped tiling, kept only for the two-way split of
       the legacy beats; every map beat is laid out by the industry map */
    function tmap(rows, w, h, grouped){
      const node = grouped
        ? d3.hierarchy(hierarchyFor(rows, "MI")).sum(d => d.value)
        : d3.hierarchy({ name: "MI", children: rows.map(r => ({ name: r.name, value: r.employ })) })
            .sum(d => d.value);
      const t = d3.treemap().size([w, h]).paddingInner(1);
      if (grouped) t.paddingOuter(3.5);
      t(node);
      return node;
    }
    let view = "map";
    fig.dataset.view = view;
    /* the arrangement has two controls - the buttons, and the sentence's
       blank - and both show the one state */
    const syncViewCtl = () => {
      const ve = document.getElementById(p + "View");
      if (ve) ve.querySelectorAll(".seg-btn[data-view]").forEach(x => {
        const on = x.dataset.view === view;
        x.classList.toggle("is-active", on);
        x.setAttribute("aria-pressed", String(on));
      });
      const sv = document.getElementById(p + "SView");
      if (sv && sv.value !== view){ sv.value = view; fitPick(sv); }
      /* the bars' order is a blank only while the bars are up, and a blank
         out of the flow cannot be measured: it is cut to size on arriving */
      fitPicks(fig);
    };
    syncViewCtl();
    /* what the map beats colour their cells by: the sector, or how much
       know-how each industry takes */
    let colorBy = "sector";
    const jobsTotal = d3.sum(industryData, d => d.employ) || 1;
    const fillBy = d => colorBy === "complexity" ? complexityColor(d.name) : sectorColors[d.sector];
    const TIER_NAMES = ["Traded", "Partly traded", "Local"];

    /* ---- the industry map, in screen pixels ----
       S is the scale from the figure's 880 units to the pixels it is drawn
       at. The map is tiled in pixels, so its gaps are a pixel and its type
       13px on any screen, and read back into units to be drawn. It is
       measured once the figure is on screen and laid out again whenever
       the width changes; until then it is tiled at the width the reference
       column gives it.
       The charts' own type - names, values, ticks, heads - is set by class
       in the stylesheet, and that is in units too: the stylesheet is told
       the scale (--mi-s on the figure) and divides by it, so that type is
       a fixed size on screen as well, whatever width the figure is drawn
       at. */
    let S = 0;
    const DEFAULT_S = 880 / MI_W;
    /* the drawing keeps its proportions inside the element, so when the
       element is held shorter than that the drawing is narrower than it */
    const measureS = () => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 ? Math.min(r.width / MI_W, r.height / MI_H) : 0;
    };
    const scaleNow = () => S || DEFAULT_S;
    const tellScale = () => { if (fig) fig.style.setProperty("--mi-s", String(+scaleNow().toFixed(4))); };
    tellScale();
    const cellOf = new Map();                       /* row name -> its cell */
    industryData.forEach(r => cellOf.set(r.name, cellOfRow(r, jobsTotal)));
    const itemOf = r => { const c = cellOf.get(r.name); return { id: c.id, sector: c.sector, group: c.group, value: r.employ, cell: c }; };

    /* ---- which industries are in play ----
       The key under the map hides sectors; a hidden sector leaves no hole,
       the map is tiled again over the rest. Null means every sector. The
       tiers' grounds can be cancelled the same way. And the reader can zoom
       into one sector, then into one of its groups, which tiles that alone
       over the whole map. */
    let secOn = null;
    const secShown = d => !secOn || secOn.has(d.sector);
    const secFiltered = () => !!secOn;
    let tierOn = [true, true, true];
    const clusterOf = d => tierOf(d.name);
    const tierShown = d => tierOn[clusterOf(d)];
    let focus = null, focusGroup = null;
    const inFocus = d => !focus || (d.sector === focus && (!focusGroup || d.group === focusGroup));
    /* what the map is tiled at now: the level chosen, or finer where the
       zoom has gone further down */
    const effGrain = () => effectiveGrain(MAP_GRAIN, focusGroup ? 2 : focus ? 1 : 0);
    const clusterRows = [0, 1, 2].map(k => industryData.filter(d => clusterOf(d) === k));
    const clusterShare = clusterRows.map(l => d3.sum(l, d => d.employ) / jobsTotal);
    const tradRows = clusterRows[0].concat(clusterRows[1]);

    /* one tiling of one or more bands, cached by what went into it: its
       cells, sector blocks and groups in units, the rows it shows, and
       where each industry sits - its own cell, or the one it was folded
       into, which is where it travels from when the map becomes bars */
    const laid = new Map();
    function bandsLayout(key, bands){
      const s = scaleNow();
      const grain = effGrain();
      const k = key + "|" + s.toFixed(4) + "|" + SEC_NAMES + "|" + grain;
      if (laid.has(k)) return laid.get(k);
      const px = b => ({ x: b.x * s, y: b.y * s, w: b.w * s, h: b.h * s });
      const un = b => ({ x: b.x / s, y: b.y / s, w: b.w / s, h: b.h / s });
      const live = bands.filter(b => b.rows.length);
      const res = layoutBands(live.map(b => ({ key: b.key, items: b.rows.map(itemOf), box: px(b.box) })), grain);
      const out = { cells: [], blocks: [], groups: [], spot: new Map(), rows: [], byId: new Map(), s: s, grain: grain };
      res.layouts.forEach((L, i) => {
        const band = live[i].key;
        L.cells.forEach(c => {
          const b = un(c);
          const cell = { id: c.item.id, band: band, box: b, px: c, cell: c.item.cell, rest: c.item.rest === true };
          out.cells.push(cell); out.byId.set(cell.id, cell);
          c.item.cell.rows.forEach(r => { out.spot.set(r.name, b); out.rows.push(r); });
        });
        L.blocks.forEach(bl => out.blocks.push({ key: band + ":" + bl.sector, band: band, sector: bl.sector, box: un(bl), value: bl.value }));
        L.groups.forEach(g => out.groups.push({ key: band + ":" + g.group, band: band, group: g.group, box: un(g), items: g.items }));
      });
      laid.set(k, out);
      return out;
    }
    const invalidateMaps = () => laid.clear();
    const FULL_BOX = { x: 0, y: 0, w: MI_W, h: MI_H };
    const secKey = () => secOn ? [...secOn].sort().join(",") : "*";
    const rowsAll = () => industryData.filter(d => secShown(d) && inFocus(d));
    const mapFull = () => bandsLayout("full|" + secKey() + "|" + (focus || "") + "|" + (focusGroup || ""),
      [{ key: "all", rows: rowsAll(), box: FULL_BOX }]);
    const mapTrad = () => bandsLayout("trad|" + secKey(),
      [{ key: "trad", rows: tradRows.filter(secShown), box: FULL_BOX }]);
    const allSpot = d => mapFull().spot.get(d.name) || FULL_BOX;
    const tradSpot = d => mapTrad().spot.get(d.name) || allSpot(d);
    const spot = allSpot;

    const GAP = 8, HALF = (MI_W - GAP) / 2;
    const outward = industryData.filter(d => isTradable(d.name));
    const local   = industryData.filter(d => !isTradable(d.name));
    const posSplit = new Map();
    tmap(outward, HALF, MI_H, true).leaves()
      .forEach(n => posSplit.set(n.data.name, box(n)));
    tmap(local, HALF, MI_H, false).leaves()
      .forEach(n => posSplit.set(n.data.name, box(n, HALF + GAP)));

    /* ---- three tiers by tradability, the most tradable on the left.
       Each is a card: a ground of its own carrying the name and the share,
       with its industries tiled inside it as the whole map is tiled, so a
       sector keeps its colour and position alone carries tradability. A
       card the reader cancels takes its width with it and the rest spread
       into the room. ---- */
    const CL_HI = 0.8, CL_LO = 0.2;
    const CGAP = 8, CW = MI_W - 2 * CGAP;
    const CARD_PAD = 9, CARD_BOT = 9, CARD_TXT = CARD_PAD + 7;
    /* the band is 30 units where the figure is drawn near its own size; its
       name is a fixed size on screen, so where the figure is drawn smaller
       the band is taller in units - never less than 26px on screen - and
       the cells start 14 units under it */
    /* The band also says the tier's share of the metro's jobs, after its
       name. Where a ground is too narrow for the two side by side, with
       the cross beside them (a phone, where "Partly traded" alone nearly
       fills its ground), every band takes a second line for the share. */
    let bandStacked = false, fitBandRef = null;
    const bandH = () => { const s = scaleNow(), one = Math.max(30, Math.ceil(26 / s)); return bandStacked ? one + Math.ceil(17 / s) : one; };
    const cardHead = () => bandH() + 14;
    const cardH = () => MI_H - cardHead() - CARD_BOT;
    let cardBox = [];
    function layoutClusters(){
      cardBox = [];
      const live = [0, 1, 2].filter(k => tierOn[k]);
      const shareSum = live.reduce((a, k) => a + clusterShare[k], 0) || 1;
      const room = MI_W - CGAP * Math.max(0, live.length - 1);
      let x0 = 0;
      live.forEach(k => {
        const w = Math.max(36, room * clusterShare[k] / shareSum);
        cardBox.push({ x: x0, w: w, k: k });
        x0 += w + CGAP;
      });
      if (fitBandRef) fitBandRef();
    }
    layoutClusters();
    const mapTiers = () => bandsLayout("tiers|" + tierOn.map(Number).join("") + "|" + secKey() + "|" + (focus || "") + "|" + (focusGroup || ""),
      cardBox.map(c => ({ key: TIER_NAMES[c.k], rows: clusterRows[c.k].filter(d => secShown(d) && inFocus(d)),
        box: { x: c.x + CARD_PAD, y: cardHead(), w: Math.max(20, c.w - CARD_PAD * 2), h: cardH() } })));
    const clusterSpot = d => mapTiers().spot.get(d.name) || allSpot(d);
    const clusterFill = fillBy;
    let resetSec = null;              /* the key fills this in: applySec(null) */
    let hideKeyTip = null;            /* and this: close the key's card, if one is open */
    let keyTipIsOpen = () => false;   /* and whether one is */
    /* the filters moved: every tiling is stale, and the grounds are laid out again */
    function rebuildSecGeo(){ invalidateMaps(); layoutClusters(); }

    /* ---- Ranked: the same cells as a ranked bar chart. The top
       rows by jobs become bars, named on the left and valued at the end;
       every other cell keeps its place in the map and fades, so it can come
       back when the map does. One ranking is over the whole mix, one over
       the tradable cluster for the beat that shows that alone. ---- */
    /* the bars stop short of the right edge so the tradability column has a
       place to stand: ordered by jobs answers "what is biggest", and the
       column beside it answers "and does it sell outward", which is the
       question this beat is actually asking */
    const NB = 25, BMT = 62, BRH = 17.2, BBAR = 12, BPR = 740;
    /* ---- the names' gutter ----
       The bars and the ranking set their names in a gutter on the left,
       right-aligned against the plot. It was a fixed 292 units: the width
       the phone needs, where the names are set at 18 units and the longest
       fills it. At the desktop's 13 the longest name needs about 200, and
       the rest stood empty at the figure's left edge, so the chart read
       narrower than the map it replaces. The gutter is now as wide as the
       widest name it holds, at the size the names are set at where the
       figure stands - measured on a canvas, which reads true while the
       page is still hidden, where getComputedTextLength reads nought. The
       old width stays as the ceiling; a name past it is trimmed on paint. */
    const GUT_MAX = 292, GUT_MIN = 60, TOP_LAB = "Most specialized tradable industries";
    const gutCtx = document.createElement("canvas").getContext("2d");
    /* a measure for one class of text in this figure: off the page's own
       text when the figure is on screen - the measure refitNames tests the
       names against - and off a canvas in the same type while the page is
       still hidden, where the page's measure reads nought. The probe is
       gone again before anything else looks at the svg. */
    const measureFor = cls => {
      const t = svg.append("text").attr("class", cls).style("visibility", "hidden").text("M");
      const node = t.node(), cs = getComputedStyle(node);
      const font = (cs.fontWeight || "400") + " " + (parseFloat(cs.fontSize) || 13) + "px " + (cs.fontFamily || "sans-serif");
      const live = !!node.getComputedTextLength && node.getComputedTextLength() > 0;
      return { live, font, done: () => t.remove(),
        w: str => {
          if (live){ node.textContent = str; return node.getComputedTextLength(); }
          gutCtx.font = font; return gutCtx.measureText(str).width;
        } };
    };
    const widest = (cls, strs) => {
      const m = measureFor(cls), w = strs.reduce((a, str) => Math.max(a, m.w(str)), 0);
      m.done();
      return w;
    };
    /* the tier grounds' bands: how wide each one's name and share are, and
       whether any ground is too narrow to set them on one line */
    const sharePct = k => Math.round(clusterShare[k] * 100) + "%";
    const bandNameW = [0, 0, 0], bandGap = () => 7 / scaleNow();
    /* the name a band carries: the tier's, or where even that alone is too
       wide for its ground (the drawing letterboxed under the open table on
       a narrow screen) the first word of it, "Partly" */
    const bandName = [TIER_NAMES[0], TIER_NAMES[1], TIER_NAMES[2]];
    fitBandRef = () => {
      const u = 1 / scaleNow();
      const mn = measureFor("mi-card-lab"), mp = measureFor("mi-card-pct");
      [0, 1, 2].forEach(k => { bandName[k] = TIER_NAMES[k]; bandNameW[k] = mn.w(bandName[k]); });
      const pw = [0, 1, 2].map(k => mp.w(sharePct(k)));
      /* the cross, where there is one, keeps the band's last 22px on screen */
      const crosses = cardBox.length > 1, right = crosses ? 22 * u : CARD_TXT;
      bandStacked = cardBox.some(c => CARD_TXT + bandNameW[c.k] + bandGap() + pw[c.k] > c.w - right);
      if (bandStacked) cardBox.forEach(c => {
        if (CARD_TXT + bandNameW[c.k] <= c.w - 4 * u || !/\s/.test(TIER_NAMES[c.k])) return;
        bandName[c.k] = TIER_NAMES[c.k].split(/\s+/)[0];
        bandNameW[c.k] = mn.w(bandName[c.k]);
      });
      mn.done(); mp.done();
      /* stacked, a ground whose words do not clear the cross goes without
         one (a phone, or the drawing letterboxed small under the open
         table); the tier can still be taken off from a wider frame, and
         brought back from the chips above the chart */
      cardBox.forEach(c => { c.noX = crosses && bandStacked && CARD_TXT + Math.max(bandNameW[c.k], pw[c.k]) > c.w - right; });
    };
    fitBandRef();
    /* what the gutters were last fitted to - the type, and whether it could
       be measured on the page - so a resize that changes neither costs a
       comparison and no more */
    const typeSig = () => ["mi-name", "mi-name is-top", "mi-toplab", "mi-colhead"]
      .map(c => { const m = measureFor(c); m.done(); return m.font + (m.live ? "/live" : "/blind"); }).join("|");
    /* the bars' gutter: the widest name, the 10 between it and the plot,
       and 2 to spare */
    const barGutter = names => Math.max(GUT_MIN, Math.min(GUT_MAX, Math.ceil(widest("mi-name", names)) + 12));
    /* the bars' head is the ranking's head, line for line: the column names
       on one baseline, a rule under each column, the tick row below that */
    const BHEAD_Y = BMT - 46, BRULE_Y = BMT - 36, BTICK_Y = BMT - 14, BGRID_TOP = BMT - 8;
    /* which column the bars carry beside the jobs: the opening beat asks how
       much know-how the work takes, the tiers beat how much of it sells out */
    let barMode = "cx";
    /* the five complexity steps, the same cuts the map's ramp is built on */
    const cxBin = name => {
      const v = pciByName.get(name);
      if (v == null) return 2;
      let b = 0; while (b < PCI_CUTS.length && v >= PCI_CUTS[b]) b++;
      return b;
    };
    const CX_WORDS = ["lowest", "low", "middle", "high", "highest"];
    /* what orders the bars: their own length, or the complexity beside them.
       Either way the bar is the jobs, as the ranking's bar stays the
       concentration whichever order its rows take */
    let barSort = "jobs";
    const cxVal = name => { const v = pciByName.get(name); return v == null ? -99 : v; };
    /* the set is the metro's biggest industries either way; the order is
       what the control changes */
    const barOrder = list => {
      const rows = list.slice(0, NB);
      return barSort === "cx" && barMode !== "tier"
        ? rows.slice().sort((a, b) => cxVal(b.name) - cxVal(a.name) || b.employ - a.employ)
        : rows;
    };
    const byJobsAll = industryData.slice().sort((a, b) => b.employ - a.employ);
    /* each set of bars keeps its own gutter and scale - the whole mix's
       and the tradable cluster's hold different names - fitted whenever
       the set is drawn, and read by the cells that become its bars */
    const mkBarGeo = () => ({ ml: GUT_MAX, scale: d3.scaleLinear()
      .domain([0, (byJobsAll[0] ? byJobsAll[0].employ : 1) * 1.04]).range([GUT_MAX + 12, BPR]) });
    const barGeoAll = mkBarGeo(), barGeoTrad = mkBarGeo();
    let closeMenuRef = null, keepMenuRef = null;
    /* the bars answer to both filters, so either one has to ask what the
       other leaves before it takes anything away */
    const tierListWith = (tOn, sOn) =>
      byJobsAll.filter(d => tOn[clusterOf(d)] && (!sOn || sOn.has(d.sector)) && inFocus(d));
    const tierList = () => tierListWith(tierOn, secOn);
    /* the bars, ranked again over what the filter and the zoom leave */
    const reBars = () => { barListAll = tierList(); reBarRank(); drawBars(barListAll, gBarsAll); };
    let barRankAll = null;                 /* set once barOrder exists */
    const byJobsTrad = tradRows.slice().sort((a, b) => b.employ - a.employ);
    const barRankTrad = new Map(byJobsTrad.slice(0, NB).map((d, i) => [d.name, i]));
    const barY = i => BMT + i * BRH + BRH / 2;
    const asBars = (d, rankMap, fill, fallback) => {
      const r = rankMap.get(d.name);
      const barScale = (rankMap === barRankTrad ? barGeoTrad : barGeoAll).scale;
      return r == null
        ? { box: fallback, fill, op: 0, rx: 0 }
        : { box: { x: barScale(0), y: barY(r) - BBAR / 2,
                   w: Math.max(2, barScale(d.employ) - barScale(0)), h: BBAR }, fill, op: 1, rx: 0 };
    };
    window[ctlName + "_CLUSTERS"] = { share: clusterShare, gap: CGAP, width: MI_W };

    const MT = 62, RH = 34, BAR_H = 17, PLOT_R = 712;
    /* the three heads share a baseline, and the rules sit under them - the tick
       row keeps its own line below, so the labels of the columns and the
       readings of the scale never sit on the same line. The tick row sits
       midway between the rule and the first row, 14 clear of each, and the
       grid starts under it. */
    const HEAD_Y = MT - 46, HEAD_RULE_Y = MT - 36, TICK_Y = MT - 14, GRID_TOP = MT - 8;

    /* Trimming by character count let the widest names run past the left edge
       of the frame - "Sporting Goods Hobby and Musical Inst..." reached -17.6
       of an 880-unit box and was cut by it. The gutter is fixed in user units
       while .mi-name's size is not, so the only honest test is a measured one.
       It cannot be done at build time: the figure is built while its page is
       still hidden, and getComputedTextLength returns 0 in a display:none
       subtree, which silently passed every name through untrimmed. So the
       names are trimmed on paint, when the figure is on screen, and the
       character rule stands in until then. */
    const charFit = n => n.length > 34 ? n.slice(0, 33).replace(/\s+\S*$/, "") + "\u2026" : n;
    function refitNames(){
      svg.selectAll("text.mi-name").each(function(){
        const full = this.getAttribute("data-full");
        if (!full || !this.getComputedTextLength) return;
        this.textContent = full;
        const w0 = this.getComputedTextLength();
        if (w0 === 0){ this.textContent = charFit(full); return; }
        /* each name knows the room its own gutter gives it */
        const max = +this.getAttribute("data-max") || (GUT_MAX - 40);
        if (w0 <= max) return;
        let cut = full;
        while (cut.length > 4){
          cut = cut.slice(0, -1).replace(/\s+$/, "");
          this.textContent = cut + "\u2026";
          if (this.getComputedTextLength() <= max) return;
        }
      });
    }

    /* the tradability column, between the bars and the jobs column */
    /* the two columns beside the plot, jobs first and tradability at the
       edge: the ranking is read left to right as size then role, and the
       bars' own head reads the same way */
    const TC_R = MI_W - 6, TC_W = 56;
    const rowY = i => MT + i * RH + RH / 2;
    /* A ranking over a set of industries: the top twelve by concentration,
       with the scale they need. Two are kept. One is over the whole mix, for
       the narrative that reads sector first; the other is over the tradable
       cluster alone, for the narrative that reads tradability first, so its
       bars only ever rise from cells that were on screen the beat before. */
    /* the specializations among a set of industries. The tool's older
       tradable flag is a separate draw from the 0-1 score, and filtering on
       it would drop cells the clusters count as tradable, so a set picked by
       the score is judged on concentration alone. Shares are of all metro
       jobs, which is what the card says they are. */
    /* rcaOf and peersFor draw from the one seeded sequence the rest of the
       tool shares, and cache what they draw. Before this ranking, only
       industries the older flag admits were ever asked about, so asking about
       the others here would move every later draw — the metro scatter's
       background metros among them. So a value already drawn is used as it
       stands, and one not yet drawn comes from a generator seeded on the
       industry's own name, with the same formula, touching neither the shared
       sequence nor its caches. */
    const nameRand = key => {
      let h = 2166136261;
      for (const c of key){ h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
      let st = (h >>> 0) || 1;
      return () => (st = (st * 1664525 + 1013904223) >>> 0) / 4294967296;
    };
    /* the RCA as the source gives it; the peer values below are still
       generated, since the source carries no peer metros */
    const rcaQuiet = name => rcaOf(name);
    const peersQuiet = (name, cityRca) => {
      if (peerByName.has(name)) return peerByName.get(name);
      /* the peers' average is the source's own where it carries one; the
         values around it are still drawn, since the source has no per-peer figure */
      const real = peerRcaByName.get(name);
      const r = nameRand(name + "|peers");
      const target = real != null ? real : Math.max(1.15, cityRca * (0.4 + r() * 0.85));
      const jitter = PEERS.map(() => 0.62 + r() * 0.76);
      const mean = jitter.reduce((a, j) => a + j, 0) / jitter.length;
      const values = jitter.map(j => Math.round(target * (j / mean) * 10) / 10);
      const avg = real != null ? Math.round(real * 10) / 10
        : Math.round((values.reduce((a, v) => a + v, 0) / values.length) * 10) / 10;
      return { values: values, avg: avg };
    };
    function specializedAmong(rows){
      const total = d3.sum(industryData, d => d.employ) || 1;
      const shown = v => Math.round(v * 10) / 10;
      return rows.filter(d => rcaQuiet(d.name) > 1).map(d => {
        const rca = rcaQuiet(d.name), localPct = d.employ / total * 100, pr = peersQuiet(d.name, rca);
        return { name: d.name, sector: d.sector, employ: d.employ, rca: rca,
          localPct: localPct, worldPct: localPct / rca,
          label: shortLabel(d.name) ||
                 (d.name.length > 40 ? d.name.slice(0, 37) + "\u2026" : d.name),
          peerAvg: pr.avg, peerValues: pr.values, ahead: shown(rca) >= shown(pr.avg) };
      });
    }
    /* The ranking ships as its second option: the tradability column names
       the tier ("Traded", "Partly traded", "Local") instead of printing the
       score, and its head opens the tier filter. The two tradable tiers
       start checked and the local one does not, so the beat opens on the
       most specialised tradable industries, as the question asks, and the
       reader can let the local ones in from the head. opt-1 keeps the
       earlier ranking: the score in the column, over the same two tiers,
       with no filter. */
    const rankOptEl0 = document.getElementById(p + "RankOpt");
    let rankMode = rankOptEl0 && rankOptEl0.value === "score" ? "score" : "tier";
    fig.dataset.rank = rankMode;
    const TIER_DEFAULT6 = () => [true, true, false];
    let tierOn6 = TIER_DEFAULT6();
    /* the industries the third beat ranks over: whatever the filter has
       checked under opt-2, the two tradable tiers under opt-1 */
    const rankPool = () => rankMode === "tier"
      ? clusterRows.filter((_, k) => tierOn6[k]).flat()
      : clusterRows[0].concat(clusterRows[1]);
    const tierLabel = d => TIER_NAMES[clusterOf(d)];
    /* A word is wider than a number, so the plot gives up room to the column
       while the words are showing - 54 units, not more. At 82 the value
       labels sat 70.8 from the words where opt-1's scores sit 44.6; the widest
       bar lands 0.0687 of the span short of the edge and the widest label
       runs 37.8 past it, so 54 puts the gap at 44.7. Only the third beat's
       ranking shows the words; the first ranking keeps its score and its
       full plot whichever option is on. */
    /* both orders now give the same room back, since the jobs column sits
       where the tier words used to and the value labels clear the same edge */
    const plotR = () => PLOT_R - 54;
    const inTier = R => R === R2 && rankMode === "tier";
    let wireRowsRef = null, rebuildR2Ref = null, hlSpansRef = null;
    /* how a phrase in the text points at its sector: "frame" draws a line
       round the block, "mute" turns the rest grey, "dim" fades it */
    const hlOptEl0 = document.getElementById(p + "HlOpt");
    let hlMode = hlOptEl0 && /^(dim|mute|frame)$/.test(hlOptEl0.value) ? hlOptEl0.value : "frame";
    /* the ranking's gutter: the badge's room, the widest name - the
       leading three are set bold - and its clearance; and never narrower
       than the label over the leading rows, which the plot starts clear of */
    const rankGutter = ranked => {
      const names = ranked.map(d => charFit(d.label));
      const w = Math.max(widest("mi-name is-top", names.slice(0, 3)), widest("mi-name", names.slice(3)));
      const lab = 4 + widest("mi-toplab", [TOP_LAB]);
      return Math.max(GUT_MIN, Math.min(GUT_MAX, Math.max(30 + Math.ceil(w) + 12, Math.ceil(lab))));
    };
    function ranking(rows, among){
      const base = among ? specializedAmong(rows) : specializedWithPeers(rows);
      const ranked = base.sort((a, b) => b.rca - a.rca).slice(0, MI_TOP_N);
      const ml = rankGutter(ranked);
      /* only the ranking among the clusters - the third beat's - ever
         shows the tier words */
      const right = plotR(among && rankMode === "tier");
      return { ranked, ml,
        rankIdx: new Map(ranked.map((d, i) => [d.name, i])),   /* by concentration: the badges' order */
        pos: new Map(ranked.map((d, i) => [d.name, i])),       /* the order on screen, which sorting changes */
        rankRow: new Map(ranked.map(d => [d.name, d])),
        xr: d3.scaleLinear()
          .domain([1, (d3.max(ranked, d => Math.max(d.rca, d.peerAvg)) || 2) * 1.06])
          .range([ml + 12, right]),
        /* the gap against the peer average, symmetric so the average sits
           mid-chart: ahead to the right, behind to the left */
        xg: (function(){
          const g = Math.max(0.5, (d3.max(ranked, d => Math.abs(d.rca - d.peerAvg)) || 0.5) * 1.15);
          return d3.scaleLinear().domain([-g, g]).range([ml + 12, right]);
        })() };
    }
    const gapOf = d => d.rca - d.peerAvg;
    const gapBox = (R, d, pos) => {
      const g = gapOf(d), x0 = Math.min(R.xg(0), R.xg(g));
      return { x: x0, y: rowY(pos) - BAR_H / 2, w: Math.max(2, Math.abs(R.xg(g) - R.xg(0))), h: BAR_H };
    };
    /* the three orders a reader can ask for: how concentrated, how big, and
       how far ahead of or behind the peers */
    const SORTS = {
      rca:  (a, b) => b.rca - a.rca,
      jobs: (a, b) => b.employ - a.employ,
      gap:  (a, b) => (b.rca - b.peerAvg) - (a.rca - a.peerAvg),
      trad: (a, b) => tradabilityOf(b.name) - tradabilityOf(a.name)
    };
    let sortKey = "rca";
    function reorder(R){
      const order = R.ranked.slice().sort(SORTS[sortKey] || SORTS.rca);
      R.pos = new Map(order.map((d, i) => [d.name, i]));
    }
    /* the ranking the third beat shows is over the clusters the filter has
       checked - the two tradable ones as shipped, so its bars rise only from
       cells that were in those two columns a beat before, unless the reader
       has let the local cluster in from the head */
    const R1 = ranking(industryData), R2 = ranking(rankPool(), true);
    const ranked = R1.ranked, rankIdx = R1.rankIdx, rankRow = R1.rankRow, xr = R1.xr;

    /* every industry, with everything each state needs to place and paint it */
    const cells = industryData.map(d => ({
      name: d.name, sector: d.sector, employ: d.employ,
      rank: rankIdx.has(d.name) ? rankIdx.get(d.name) : -1,
      row: rankRow.get(d.name) || null,
      rank2: R2.rankIdx.has(d.name) ? R2.rankIdx.get(d.name) : -1,
      row2: R2.rankRow.get(d.name) || null
    }));

    const STATE = {
      /* every industry, sized by jobs and grouped into sectors: the opening
         beat, coloured by sector or by complexity as the reader asks */
      0: d => !secShown(d) ? { box: allSpot(d), fill: fillBy(d), op: 0, rx: 0 }
        : view === "alt" ? asBars(d, barRankAll, fillBy(d), allSpot(d))
                         : { box: allSpot(d), fill: fillBy(d), op: 1, rx: 0 },
      1: d => view === "alt" ? asBars(d, barRankAll, complexityColor(d.name), spot(d))
                             : { box: spot(d), fill: complexityColor(d.name), op: 1, rx: 0 },
      2: d => ({ box: posSplit.get(d.name) || allSpot(d),
                 fill: isTradable(d.name) ? sectorColors[d.sector] : GREY,
                 op: 1, rx: 0 }),
      3: d => d.rank < 0
        ? { box: posSplit.get(d.name) || allSpot(d), fill: GREY, op: 0, rx: 0 }
        : sortKey === "gap"
          ? { box: gapBox(R1, d.row, R1.pos.get(d.name)), fill: gapOf(d.row) >= 0 ? TEAL : ORANGE, op: 1, rx: 0 }
          : { box: { x: xr(1), y: rowY(R1.pos.get(d.name)) - BAR_H / 2,
                     w: Math.max(2, xr(d.row.rca) - xr(1)), h: BAR_H },
              fill: d.rank < 3 ? TEAL : MUTED, op: 1, rx: 0 },
      /* the three clusters by tradability, the most tradable on the left */
      4: d => !secShown(d) || !inFocus(d) || !tierShown(d) ? { box: clusterSpot(d), fill: clusterFill(d), op: 0, rx: 0 }
        : view === "alt"
          ? asBars(d, barRankAll, clusterFill(d), clusterSpot(d))
          : { box: clusterSpot(d), fill: clusterFill(d), op: 1, rx: 0 },
      /* the two outward-selling tiers on their own, the full width, read by
         complexity; the local tier stays where the clusters left it and fades */
      5: d => !secShown(d)
        ? { box: clusterOf(d) <= 1 ? (tradSpot(d)) : clusterSpot(d),
            fill: complexityColor(d.name), op: 0, rx: 0 }
        : clusterOf(d) <= 1
        ? (view === "alt"
            ? asBars(d, barRankTrad, complexityColor(d.name), tradSpot(d))
            : { box: tradSpot(d), fill: complexityColor(d.name), op: 1, rx: 0 })
        : { box: clusterSpot(d), fill: GREY, op: 0, rx: 0 },
      /* traded and partly traded together, the full width, with no tier
         grounds: the beat after the three tiers. The local tier waits unseen
         where the tiers put it, already in the colour it wears there, so
         travelling back fades it in in place */
      7: d => !secShown(d)
        ? { box: clusterOf(d) <= 1 ? (tradSpot(d)) : clusterSpot(d),
            fill: fillBy(d), op: 0, rx: 0 }
        : clusterOf(d) <= 1
        ? (view === "alt"
            ? asBars(d, barRankTrad, fillBy(d), tradSpot(d))
            : { box: tradSpot(d), fill: fillBy(d), op: 1, rx: 0 })
        : { box: clusterSpot(d), fill: fillBy(d), op: 0, rx: 0 },
      /* the ranking the two tradable clusters turn into. Arriving, it runs in
         two movements: everything that will not be a bar fades where it
         stands, then the ranked cells travel out of their columns and settle
         into bars */
      6: d => d.rank2 < 0
        ? { box: clusterSpot(d), fill: fillBy(d), op: 0, rx: 0 }
        : sortKey === "gap"
          ? { box: gapBox(R2, d.row2, R2.pos.get(d.name)), fill: gapOf(d.row2) >= 0 ? TEAL : ORANGE,
              op: 1, rx: 0, delay: arriving ? 300 : 0 }
          : { box: { x: R2.xr(1), y: rowY(R2.pos.get(d.name)) - BAR_H / 2,
                     w: Math.max(2, R2.xr(d.row2.rca) - R2.xr(1)), h: BAR_H },
              fill: d.rank2 < 3 ? TEAL : MUTED, op: 1, rx: 0, delay: arriving ? 300 : 0 }
    };

    /* ---- the marks ---- */
    svg.selectAll("*").remove();
    const gAxis = svg.append("g").attr("class", "mi-axis").style("opacity", 0);
    const gAxis2 = svg.append("g").attr("class", "mi-axis").style("opacity", 0);
    const gAxisGap  = svg.append("g").attr("class", "mi-axis").style("opacity", 0);
    const gAxisGap2 = svg.append("g").attr("class", "mi-axis").style("opacity", 0);
    /* the row highlight lives below the cells: above them it would paint
       over the bars, and any translucency would shift the sector colour the
       bar is encoding */
    /* behind every other layer: the three grounds and their headers */
    const gCards = svg.append("g").attr("class", "mi-cards").style("opacity", 0);
    /* Each ground is a frame with a band across its top: the tier's name at
       the left of the band, its share beside it, and a cross at the right
       that takes the ground away. The frame is square, drawn as an outline
       rather than a grey field, so the cells inside it carry all the colour. */
    function drawCards(animate){
      const dur = animate ? 950 : 0;
      const sel = gCards.selectAll("g.mi-card-g").data(cardBox, c => c.k)
        .join(enter => {
          const g = enter.append("g").attr("class", "mi-card-g");
          g.append("rect").attr("class", "mi-card").attr("y", 0).attr("height", MI_H).attr("rx", 0);
          g.append("rect").attr("class", "mi-card-band").attr("y", 0);
          g.append("text").attr("class", "mi-card-lab");
          g.append("text").attr("class", "mi-card-pct");
          g.append("text").attr("class", "mi-card-none");
          const x = g.append("g").attr("class", "mi-card-x");
          x.append("rect").attr("class", "mi-card-x-hit")
            .attr("role", "button").attr("tabindex", -1).attr("focusable", "true");
          x.append("path").attr("class", "mi-card-x-mark");
          x.append("title");
          return g;
        });
      const go = q => dur ? q.transition().duration(dur).ease(d3.easeCubicInOut) : q;
      /* the words are set at once and only the geometry travels: text put on
         a transition arrives with it, and a ground coming back would carry a
         blank band the whole way */
      /* the band's words sit on its middle line, whatever its height: the
         name, then the share after it - or under it, on a second line,
         where the grounds are too narrow for both */
      const bh = bandH(), half = 8.5 / scaleNow();
      const mid = bandStacked ? bh / 2 - half : bh / 2, mid2 = bandStacked ? bh / 2 + half : mid;
      sel.select("rect.mi-card-band").attr("height", bh);
      sel.select("text.mi-card-lab").attr("y", mid).attr("dy", "0.35em").text(c => bandName[c.k]);
      sel.select("text.mi-card-pct").attr("y", mid2).attr("dy", "0.35em").attr("text-anchor", "start")
        .text(c => sharePct(c.k));
      sel.select("text.mi-card-none").attr("y", cardHead() + 26);
      go(sel.select("rect.mi-card")).attr("x", c => c.x).attr("width", c => c.w);
      go(sel.select("rect.mi-card-band")).attr("x", c => c.x).attr("width", c => c.w);
      go(sel.select("text.mi-card-lab")).attr("x", c => c.x + CARD_TXT);
      go(sel.select("text.mi-card-pct")).attr("x", c => c.x + CARD_TXT + (bandStacked ? 0 : bandNameW[c.k] + bandGap()));
      go(sel.select("text.mi-card-none")).attr("x", c => c.x + CARD_TXT);
      /* the cross only where there is another ground to fall back on, and
         a fixed size on screen like the words beside it: an 8px mark 13px
         in from the band's right edge, on a 20px target */
      sel.select("g.mi-card-x").style("display", c => cardBox.length > 1 && !c.noX ? null : "none");
      const u = 1 / scaleNow(), hit = Math.min(20 * u, bh);
      sel.select("rect.mi-card-x-hit").attr("y", mid - hit / 2).attr("width", hit).attr("height", hit);
      go(sel.select("rect.mi-card-x-hit")).attr("x", c => c.x + c.w - 13 * u - hit / 2);
      go(sel.select("path.mi-card-x-mark")).attr("d", c => {
        const x = c.x + c.w - 13 * u, y = mid, r = 4 * u;
        return "M" + (x - r) + "," + (y - r) + "L" + (x + r) + "," + (y + r) +
               "M" + (x + r) + "," + (y - r) + "L" + (x - r) + "," + (y + r);
      });
      sel.select("title").text(c => "Take " + TIER_NAMES[c.k].toLowerCase() + " off the map");
      sel.select("rect.mi-card-x-hit").attr("aria-label", c => "Take " + TIER_NAMES[c.k].toLowerCase() + " off the map")
        .attr("data-close", c => c.k)
        .on("click", (ev, c) => { ev.stopPropagation(); setTier(c.k, false, ev.detail === 0); })
        .on("keydown", (ev, c) => { if (ev.key === "Enter" || ev.key === " "){ ev.preventDefault(); ev.stopPropagation(); setTier(c.k, false, true); } });
    }
    drawCards(false);
    /* the grounds a reader has cancelled, offered back above the chart */
    const tierBack = document.getElementById(p + "TierBack");
    function syncTierBack(){
      if (!tierBack) return;
      const off = [0, 1, 2].filter(k => !tierOn[k]);
      tierBack.innerHTML = off.map(k =>
        '<button type="button" class="mcl-chip" data-tier="' + k + '">' +
        '<i aria-hidden="true">+</i>' + TIER_NAMES[k] + '</button>').join("");
    }
    /* one state for the beat: the map's grounds and the bars' filter are the
       same three tiers, so cancelling a ground drops it from both */
    function setTier(k, on, byKey){
      if (tierOn[k] === on) return;
      const probe = tierOn.slice(); probe[k] = on;
      if (!probe.some(Boolean) || !tierListWith(probe, secOn).length) return;
      tierOn[k] = on;
      layoutClusters();
      barListAll = tierList();
      reBarRank();
      drawBars(barListAll, gBarsAll);
      drawCards(!reduced());
      syncTierBack();
      if (syncTierMenu) syncTierMenu();
      if (step >= 0) paint(step, !reduced());
      if (byKey){ refocus = on ? { kind: "close", k: k } : { kind: "chip", k: k }; applyRefocus(); }
    }
    let syncTierMenu = null;
    if (tierBack) on(tierBack, "click", ev => {
      const b = ev.target.closest(".mcl-chip[data-tier]");
      if (b) setTier(+b.dataset.tier, true, ev.detail === 0);
    });
    syncTierBack();
    const gHi = svg.append("g").attr("class", "mi-hilite-layer");
    const hiRect = gHi.append("rect").attr("class", "mi-hilite")
      .attr("x", 0).attr("width", MI_W).attr("height", RH).style("opacity", 0);
    /* the bands a named phrase lights, in the same layer for the same reason */
    const gLit = gHi.append("g").attr("class", "mi-litrows");
    const gCells = svg.append("g").attr("class", "mi-cells");
    const gRows  = svg.append("g").attr("class", "mi-rows").style("opacity", 0);
    const gRows2 = svg.append("g").attr("class", "mi-rows").style("opacity", 0);
    const gBarsAll  = svg.append("g").attr("class", "mi-rows mi-bars").style("opacity", 0);
    const gBarsTrad = svg.append("g").attr("class", "mi-rows mi-bars").style("opacity", 0);
    /* ---- the map layer: the industry map's own cells, above the bars and
       the per-industry cells, which stand down while it is showing. It is
       drawn per tiling and joined by cell id, so a cell that survives from
       one tiling to the next travels, and one that does not fades. The
       zoom's targets sit under the cells, for the keyboard. ---- */
    const gMap = svg.append("g").attr("class", "mi-map").style("font-family", MAP_FONT);
    const gMapHit = gMap.append("g").attr("class", "mi-map-hit");
    const gMapFrames = gMap.append("g").attr("class", "mi-map-frames");
    const gMapCells = gMap.append("g").attr("class", "mi-map-cells");
    const gMapOutline = gMap.append("g").attr("class", "mi-map-outline").style("pointer-events", "none");
    /* the phrase highlight's frame sits above everything: it draws no fill,
       so the blocks and their names read straight through it */
    const gHlFrame = svg.append("g").attr("class", "mi-hlframe-layer");
    let coarseCell = null, posCoarse = null, posCoarseFlat = null, coarseShare = null;
    if (opts.adminReveal){
      /* This beat asks how much of the METRO's work happens in the city, so
         it opens on the metro's own mix, aggregated one level up. The beats
         after it read the administrative city, which is the set this figure
         otherwise carries. */
      const revealRows = opts.revealRows || industryData;
      const coarse = twoDigitRows(revealRows);
      posCoarse = new Map(tmap(coarse, MI_W, MI_H, true).leaves()
        .map(n => [n.data.name, box(n)]));
      posCoarseFlat = stripLayout(coarse, MI_W, MI_H);
      coarseShare = d => ADMIN_SHARE[d.sector] !== undefined ? ADMIN_SHARE[d.sector] : 0.15;

      /* the sector's own colour, once pale and once full: the pale ground is
         the whole of that work across the metro, and the full band standing
         on the foot of the block is the part of it inside the city */
      const pale = sec => d3.interpolateRgb(sectorColors[sec] || "#ccc", "#ffffff")(0.66);

      const gCoarse = svg.insert("g", ".mi-cells").attr("class", "mi-coarse");
      coarseCell = gCoarse.selectAll("g.mi-cell").data(coarse, d => d.name)
        .join("g").attr("class", "mi-cell");
      coarseCell.append("rect").attr("class", "mi-rect")
        .attr("fill", d => sectorColors[d.sector] || "#ccc");
      coarseCell.append("rect").attr("class", "mi-share")
        .attr("fill", d => sectorColors[d.sector] || "#ccc")
        .attr("height", 0);
      coarseCell.append("text").attr("class", "mi-lab");
      /* one figure per sector, on its largest block */
      const biggest = {};
      coarse.forEach(d => {
        const cur = biggest[d.sector];
        if (!cur || d.employ > cur.employ) biggest[d.sector] = d;
      });
      coarseCell.filter(d => biggest[d.sector] === d)
        .append("text").attr("class", "mi-share-pct")
        .text(d => Math.round(coarseShare(d) * 100) + "% here");
    }

    const cell = gCells.selectAll("g.mi-cell").data(cells, d => d.name)
      .join("g").attr("class", "mi-cell");
    cell.append("rect").attr("class", "mi-rect cell");
    cell.append("text").attr("class", "mi-lab");
    cell.append("text").attr("class", "mi-pct");

    /* the ranking's own furniture, drawn once per ranking and revealed with
       its state: the axis and its name, the leading three braced, and each
       row's name, value, peer tick and badge */
    function drawGapAxis(R, AG){
      const ticks = R.xg.ticks(5);
      AG.selectAll("g.mi-tick").data(ticks).join("g").attr("class", "mi-tick")
        .call(g => g.append("line").attr("class", d => "mi-grid" + (d === 0 ? " is-base" : ""))
          .attr("x1", d => R.xg(d)).attr("x2", d => R.xg(d))
          .attr("y1", GRID_TOP).attr("y2", MT + R.ranked.length * RH))
        .call(g => g.append("text").attr("class", "mi-ticklab")
          .attr("x", d => R.xg(d)).attr("y", TICK_Y).attr("text-anchor", "middle")
          .text(d => (d > 0 ? "+" : "") + d + "\u00d7"));
      AG.append("text").attr("class", "mi-axname")
        .attr("x", R.ml + 12).attr("y", HEAD_Y)
        .text("Against the peer average");
      AG.append("text").attr("class", "mi-colhead")
        .attr("x", JOBS_R).attr("y", HEAD_Y).attr("text-anchor", "end").text("Jobs");
      tradHead(AG, R);
      headRules(AG, R.ml + 12, plotR(inTier(R)), inTier(R));
    }
    /* the tradability column's head, its range on the same line, and the rules
       that make the three columns read as a table head */
    const JOBS_L = 716, JOBS_R = 774;
    /* the head as a button: the word, a caret, and a hit area round both. ctx
       says which filter it opens, since the jobs order and the ranking keep
       their own tier sets. */
    function menuHead(G, xRight, yBase, ctx){
      const hg = G.append("g").attr("class", "mi-tradmenu " + ctx)
        .attr("tabindex", 0).attr("role", "button")
        .attr("aria-haspopup", "true").attr("aria-expanded", "false");
      const ht = hg.append("text").attr("class", "mi-colhead")
        .attr("x", xRight - 13).attr("y", yBase).attr("text-anchor", "end").text("Tradability");
      /* the caret ends flush with the column's edge, and the hit area stops
         at the separator rather than crossing it */
      hg.append("path").attr("class", "mi-tradmenu-caret")
        .attr("d", `M${xRight - 7},${yBase - 6} l3.5,3.5 l3.5,-3.5`);
      const tw = ht.node().getComputedTextLength ? ht.node().getComputedTextLength() : 70;
      hg.insert("rect", "text").attr("class", "mi-tradmenu-hit")
        .attr("x", xRight - 13 - tw - 6).attr("y", yBase - 16)
        .attr("width", tw + 21).attr("height", 22).attr("rx", 3);
    }
    function tradHead(A, R){
      if (inTier(R)){ menuHead(A, TC_R, HEAD_Y, "is-rank"); return; }
      A.append("text").attr("class", "mi-colhead")
        .attr("x", TC_R).attr("y", HEAD_Y).attr("text-anchor", "end").text("Tradability");
    }
    function headRules(A, plotL, plotEnd, tier){
      const y = HEAD_RULE_Y;
      /* one rule under each column, and nothing between them: the breaks in
         the rule are the separators. The tradability column is 56 wide under
         a score and 80 under a word, so its rule follows the mode; 712 clears
         the widest word by 4 and the head by 8, as the jobs rule clears its
         column */
      const tradL = tier ? 790 : TC_R - TC_W - 8;
      [[plotL, plotEnd], [JOBS_L, JOBS_R], [tradL, TC_R]].forEach(seg => {
        A.append("line").attr("class", "mi-headrule")
          .attr("x1", seg[0]).attr("x2", seg[1]).attr("y1", y).attr("y2", y);
      });
    }
    function drawRanking(R, A, G){
      const tierMode = inTier(R);
      /* the rows carry the mode, so the score's track stands down under
         the words without touching the first ranking's rows */
      G.classed("is-tier", tierMode);
      A.selectAll("g.mi-tick").data(R.xr.ticks(5).filter(t => t >= 1)).join("g")
        .attr("class", "mi-tick")
        .call(g => g.append("line").attr("class", d => "mi-grid" + (d === 1 ? " is-base" : ""))
          .attr("x1", d => R.xr(d)).attr("x2", d => R.xr(d))
          .attr("y1", GRID_TOP).attr("y2", MT + R.ranked.length * RH))
        .call(g => g.append("text").attr("class", "mi-ticklab")
          .attr("x", d => R.xr(d)).attr("y", TICK_Y).attr("text-anchor", "middle")
          .text(d => d + "\u00d7"));
      A.append("text").attr("class", "mi-axname")
        .attr("x", R.ml + 12).attr("y", HEAD_Y)
        .text("Times more concentrated");
      /* the jobs column: its head, and each row's count at the right edge */
      A.append("text").attr("class", "mi-colhead")
        .attr("x", JOBS_R).attr("y", HEAD_Y).attr("text-anchor", "end").text("Jobs");
      tradHead(A, R);
      headRules(A, R.ml + 12, plotR(tierMode), tierMode);
      /* the leading three by concentration, braced only while that is the order */
      const topN = Math.min(3, R.ranked.length);
      R.brace = A.append("g").attr("class", "mi-bracewrap");
      if (topN){
        const y0 = rowY(0) - BAR_H / 2 - 5, y1 = rowY(topN - 1) + BAR_H / 2 + 5;
        R.brace.append("path").attr("class", "mi-brace").attr("d", "M4," + y0 + "V" + y1);
        R.brace.append("text").attr("class", "mi-toplab")
          .attr("x", 4).attr("y", y0 - 9)
          .text(TOP_LAB);
      }
      const row = G.selectAll("g.mi-row").data(R.ranked, d => d.name)
        .join("g").attr("class", "mi-row")
        .attr("transform", d => "translate(0," + rowY(R.pos.get(d.name)) + ")");
      /* the band the cursor actually hits: full width, so the name at one end
         and the jobs count at the other belong to the same target */
      row.append("rect").attr("class", "mi-rowbg")
        .attr("x", 0).attr("y", -RH / 2).attr("width", MI_W).attr("height", RH);
      const top = d => R.rankIdx.get(d.name) < 3;
      row.append("text").attr("class", d => "mi-name" + (top(d) ? " is-top" : ""))
        .attr("x", R.ml - 10).attr("y", 4).attr("text-anchor", "end")
        .attr("data-max", R.ml - 40)
        .attr("data-full", d => d.label).text(d => charFit(d.label));
      row.append("text").attr("class", d => "mi-val" + (top(d) ? " is-top" : ""))
        .attr("x", d => Math.max(R.xr(d.rca), R.xr(d.peerAvg)) + 9).attr("y", 4)
        .text(d => d.rca.toFixed(1) + "\u00d7");
      row.append("line").attr("class", "mi-peer")
        .attr("x1", d => R.xr(d.peerAvg)).attr("x2", d => R.xr(d.peerAvg))
        .attr("y1", -BAR_H / 2 - 4).attr("y2", BAR_H / 2 + 4);
      /* the jobs column: the count, and a short bar beneath it so size reads
         as a second small chart in every order the rows can take. Beside the
         tier word the count sits on the row's common baseline, as the word
         and the value do, and the bar drops a step to stay clear of it */
      const jb = d3.scaleLinear().domain([0, d3.max(R.ranked, d => d.employ) || 1]).range([0, 58]);
      row.append("text").attr("class", "mi-jobs")
        .attr("x", JOBS_R).attr("y", tierMode ? 4 : 1).attr("text-anchor", "end")
        .text(d => d.employ >= 1000 ? Math.round(d.employ / 1000) + "K" : Math.round(d.employ));
      row.append("rect").attr("class", "mi-jobsbar")
        .attr("x", d => JOBS_R - Math.max(4, jb(d.employ))).attr("y", tierMode ? 7 : 5)
        .attr("width", d => Math.max(4, jb(d.employ))).attr("height", 4).attr("rx", 0);
      /* the tradability column, built the way the jobs column is: the score,
         and a short track beneath it from 0 to 1, filled as far as the score
         reaches, with a tick where the traded tier begins */
      const tw = d3.scaleLinear().domain([0, 1]).range([0, TC_W]);
      row.append("text").attr("class", "mi-trad" + (tierMode ? " is-tier" : ""))
        .attr("x", TC_R).attr("y", tierMode ? 4 : 1).attr("text-anchor", "end")
        .text(d => tierMode ? tierLabel(d) : tradabilityOf(d.name).toFixed(2));
      row.append("rect").attr("class", "mi-tradtrack")
        .attr("x", TC_R - TC_W).attr("y", 5).attr("width", TC_W).attr("height", 4).attr("rx", 0);
      row.append("rect").attr("class", "mi-tradbar")
        .attr("x", TC_R - TC_W).attr("y", 5).attr("height", 4).attr("rx", 0)
        .attr("width", d => Math.max(1, tw(tradabilityOf(d.name))));
      row.append("line").attr("class", "mi-tradtick")
        .attr("x1", TC_R - TC_W + tw(CL_HI)).attr("x2", TC_R - TC_W + tw(CL_HI))
        .attr("y1", 10).attr("y2", 13.5);
      row.filter(top).call(g => {
        /* the number is a fixed size on screen, so its disc is too: 9
           units where the figure is drawn at its own size, more where it
           is drawn smaller, inside the 30 the gutter keeps for it */
        const br = Math.min(13, Math.max(9, 9.5 / scaleNow()));
        g.append("circle").attr("class", "mi-badge-bg").attr("cx", br + 3).attr("cy", 0).attr("r", br);
        g.append("text").attr("class", "mi-badge").attr("x", br + 3).attr("y", 0).attr("dy", "0.35em")
          .attr("text-anchor", "middle").text(d => R.rankIdx.get(d.name) + 1);
      });
      R.row = row;
    }
    /* The ranking over a different pool. R2 is mutated in place rather than
       replaced, because every state closure holds it; the cells relearn
       their place in it; and its three groups are cleared and drawn again,
       since the axis furniture is appended rather than joined. */
    function rebuildR2(animate){
      Object.assign(R2, ranking(rankPool(), true));
      cells.forEach(c => {
        c.rank2 = R2.rankIdx.has(c.name) ? R2.rankIdx.get(c.name) : -1;
        c.row2 = R2.rankRow.get(c.name) || null;
      });
      gAxis2.selectAll("*").remove(); gAxisGap2.selectAll("*").remove(); gRows2.selectAll("*").remove();
      drawGapAxis(R2, gAxisGap2);
      drawRanking(R2, gAxis2, gRows2);
      reorder(R2);
      placeRanking(R2, false);
      if (wireRowsRef) wireRowsRef(R2);
      if (step === 6) paint(6, animate);
    }
    rebuildR2Ref = rebuildR2;
    /* the rows to their places in the current order */
    function placeRanking(R, animate){
      if (!R.row) return;
      const dur = animate ? 800 : 0;
      const t = sel => dur ? sel.transition().duration(dur).ease(d3.easeCubicInOut) : sel;
      t(R.row).attr("transform", d => "translate(0," + rowY(R.pos.get(d.name)) + ")");
      (dur ? R.brace.transition().duration(dur / 2) : R.brace)
        .style("opacity", sortKey === "rca" ? 1 : 0);
      /* under the peers order the value is the gap, printed at the bar's
         far end; the peer tick stands down, since the average is the line */
      const gap = sortKey === "gap";
      const val = R.row.select(".mi-val");
      val.text(d => gap ? ((gapOf(d) >= 0 ? "+" : "\u2212") + Math.abs(gapOf(d)).toFixed(1) + "\u00d7")
                        : d.rca.toFixed(1) + "\u00d7");
      t(val).attr("x", d => gap ? (gapOf(d) >= 0 ? R.xg(gapOf(d)) + 8 : R.xg(gapOf(d)) - 8)
                                : Math.max(R.xr(d.rca), R.xr(d.peerAvg)) + 9)
        .attr("text-anchor", d => gap && gapOf(d) < 0 ? "end" : "start");
      t(R.row.select(".mi-peer")).style("opacity", gap ? 0 : 1);
    }
    drawRanking(R1, gAxis, gRows);
    drawRanking(R2, gAxis2, gRows2);
    drawGapAxis(R1, gAxisGap);
    drawGapAxis(R2, gAxisGap2);

    /* the bars' furniture: a jobs axis, the names on the left, the value at
       each bar's end */
    const fmtJobs = v => v >= 1000 ? Math.round(v / 1000) + "K" : String(Math.round(v));
    const shortName = n => charFit(n);
    function drawBars(list, G){
      /* built fresh each time: the tier filter re-ranks the whole view, the
         order can change under the reader, and the beats ask for different
         columns, so there is nothing here worth updating in place */
      G.selectAll("*").remove();
      const rows = barOrder(list);
      const tierMode = barMode === "tier";
      /* the bars name their industries as the map does, by the short name;
         the gutter is fitted to the names this set holds, and the plot
         takes the room from there to its right edge */
      const barName = d => d.label || shortLabel(d.name) || d.name;
      const geo = G === gBarsTrad ? barGeoTrad : barGeoAll;
      geo.ml = barGutter(rows.map(d => charFit(barName(d))));
      geo.scale.range([geo.ml + 12, BPR]);
      const BML = geo.ml, barScale = geo.scale;
      G.selectAll("g.mi-tick").data(barScale.ticks(4)).join("g").attr("class", "mi-tick")
        .call(g => g.append("line").attr("class", d => "mi-grid" + (d === 0 ? " is-base" : ""))
          .attr("x1", d => barScale(d)).attr("x2", d => barScale(d))
          .attr("y1", BGRID_TOP).attr("y2", BMT + rows.length * BRH))
        .call(g => g.append("text").attr("class", "mi-ticklab")
          .attr("x", d => barScale(d)).attr("y", BTICK_Y).attr("text-anchor", "middle")
          .text(d => fmtJobs(d)));
      G.append("text").attr("class", "mi-axname")
        .attr("x", BML + 12).attr("y", BHEAD_Y).text("Jobs in the metro");
      /* one column beside the plot, at the edge the ranking keeps its last
         column on. The tiers beat carries tradability, and its head is the
         filter; the opening beat carries complexity, as five steps rather
         than a score, since the beat puts no number on complexity */
      const COL_R = MI_W - 6, CX_D = 4.2, CX_GAP = 12, CX_L = COL_R - 4 * CX_GAP - 2 * CX_D;
      if (tierMode){
        if (G === gBarsAll) menuHead(G, COL_R, BHEAD_Y, "is-bars");
        else G.append("text").attr("class", "mi-colhead")
          .attr("x", COL_R).attr("y", BHEAD_Y).attr("text-anchor", "end").text("Tradability");
      } else {
        G.append("text").attr("class", "mi-colhead")
          .attr("x", COL_R).attr("y", BHEAD_Y).attr("text-anchor", "end").text("Complexity");
      }
      /* both columns are 84 wide, which clears the longest of the words that
         head them; measuring the word instead would read 0, since the figure
         is drawn before the page that holds it is laid out */
      const colL = COL_R - 84;
      /* a rule under each column, and the break between them is the only
         separator - the ranking's head, at the bars' own height */
      [[BML + 12, BPR], [colL, COL_R]].forEach(seg => {
        G.append("line").attr("class", "mi-headrule")
          .attr("x1", seg[0]).attr("x2", seg[1]).attr("y1", BRULE_Y).attr("y2", BRULE_Y);
      });
      const row = G.selectAll("g.mi-row").data(rows, d => d.name).join("g").attr("class", "mi-row");
      row.append("text").attr("class", "mi-name")
        .attr("x", BML - 10).attr("y", (d, i) => barY(i) + 4).attr("text-anchor", "end")
        .attr("data-max", BML - 10)
        .attr("data-full", barName).text(d => charFit(barName(d)));
      /* the reading sits at the end of the bar it belongs to, as the
         ranking's does */
      row.append("text").attr("class", "mi-val")
        .attr("x", d => barScale(d.employ) + 8).attr("y", (d, i) => barY(i) + 4)
        .text(d => fmtJobs(d.employ));
      if (tierMode){
        row.append("text").attr("class", "mi-trad is-tier")
          .attr("x", COL_R).attr("y", (d, i) => barY(i) + 4).attr("text-anchor", "end")
          .text(d => tierLabel(d));
        return;
      }
      /* five steps, filled as far as the industry reaches. The count is the
         reading, so every step is the same ink rather than the ramp's own
         colour, whose middle is too pale to count at this size. Diamonds:
         a row of them counts at a glance, and they are the one mark in the
         figure that is neither a square cell nor a round dot. */
      row.each(function(d, i){
        const g = d3.select(this), on = cxBin(d.name), y = barY(i);
        for (let k = 0; k < 5; k++){
          const x = CX_L + CX_D + k * CX_GAP;
          g.append("path").attr("class", "mi-cxdot" + (k <= on ? " is-on" : ""))
            .attr("d", "M" + x + "," + (y - CX_D) + "L" + (x + CX_D) + "," + y +
                       "L" + x + "," + (y + CX_D) + "L" + (x - CX_D) + "," + y + "Z");
        }
      });
    }
    let barListAll = byJobsAll;
    const reBarRank = () => { barRankAll = new Map(barOrder(barListAll).map((d, i) => [d.name, i])); };
    reBarRank();
    drawBars(byJobsAll, gBarsAll);
    const drawBarsTrad = () => { const keep = barMode; barMode = "tier"; drawBars(byJobsTrad, gBarsTrad); barMode = keep; };
    drawBarsTrad();
    /* the names' size follows the page's breakpoints, and its face arrives
       after the figure is built: when either changes what a name measures,
       every gutter is fitted again and its chart drawn again. Says whether
       anything changed, so the caller knows to repaint. */
    let gutSig = typeSig();
    function refitGutters(force){
      const sig = typeSig();
      if (!force && sig === gutSig) return false;
      gutSig = sig;
      /* the heads are drawn again; a tier menu standing open stays open and
         is hung from the new head, and the focus, if it was on a head,
         goes to that head's successor rather than to the page */
      const keepMenu = keepMenuRef ? keepMenuRef.save() : null;
      [[R1, gAxis, gAxisGap, gRows], [R2, gAxis2, gAxisGap2, gRows2]].forEach(([R, A, AG, G]) => {
        const right = R.xr.range()[1];
        /* a row a phrase in the text has lit stays lit across the redraw */
        const lit = new Set();
        G.selectAll("g.mi-row.is-lit").each(d => lit.add(d.name));
        R.ml = rankGutter(R.ranked);
        R.xr.range([R.ml + 12, right]); R.xg.range([R.ml + 12, right]);
        A.selectAll("*").remove(); AG.selectAll("*").remove(); G.selectAll("*").remove();
        drawGapAxis(R, AG);
        drawRanking(R, A, G);
        placeRanking(R, false);
        if (wireRowsRef) wireRowsRef(R);
        if (lit.size && R.row) R.row.classed("is-lit", d => lit.has(d.name));
      });
      drawBars(barListAll, gBarsAll);
      drawBarsTrad();
      if (keepMenu) keepMenuRef.restore(keepMenu);
      return true;
    }

    /* the labels are fitted when a beat paints; when the window crosses one
       of the widths that change the unit scale, the beat on screen is
       painted again so its names are fitted to the new scale */
    {
      let lastUnit = null, timer = null;
      on(window, "resize", () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          if (dead) return;
          const u = labUnit();
          /* the same widths change the names' size, and with it the
             gutters of the bars and the rankings */
          const refit = refitGutters();
          if ((refit || (lastUnit !== null && u !== lastUnit)) && step >= 0) paint(step, false);
          lastUnit = u;
        }, 150);
      });
      lastUnit = labUnit();
    }

    let step = -1, painted = -1, arriving = false;
    /* a view or a beat whose chart pans draws wider than the map does, so
       the scale can move without the window moving: it is settled, and
       the gutters fitted to it, before the move is painted, or the next
       measure would cut the animation short (set where the scale is
       measured, below) */
    let settleScaleRef = null;
    const settleForPaint = () => { if (settleScaleRef && settleScaleRef()){ refitGutters(); fitPicks(fig); } };
    /* a named view sets several things at once and paints once: while the
       hold is up a paint is only noted (see setNamed). And the question
       the chart is answering, if any, with the hooks the beat change and
       the paint reach it through (see "Ask the chart") */
    let holdPaint = 0, heldPaint = false, asked = null, checkAskRef = null, leaveAskRef = null, afterStepRef = null;
    /* set once the tooltips are wired; the beat change calls it so a phrase
       left lit cannot dim the next beat */
    let clearHighlight = null;
    const reduced = () => window.matchMedia &&
      matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* Escape does one thing per press, from the top of what is open down:
       the studies panel, the tradability menu, a donut card, the key's
       card, a pinned cell card, the zoom. Each layer says whether it is
       open and how to close it; the quiz dialog has its own, and a press
       inside it is left to it. The pinned card and the zoom answer only
       when the figure is where the reader is. */
    const escLayers = [];
    on(document, "keydown", ev => {
      if (ev.key !== "Escape" || ev.defaultPrevented) return;
      const t = (ev.target === document || ev.target === document.documentElement) ? document.body : ev.target;
      if (t && t.closest && t.closest("dialog")) return;
      /* the figure and the text beside it that drives it (the study word
         rides that text's counter), or the page with the pointer over the
         figure */
      const studyEl = document.getElementById(p + "Studies");
      const scope = fig.closest(".ct-scrolly") || fig;
      const inFig = scope.contains(t) || !!(studyEl && studyEl.contains(t)) || (t === document.body && fig.matches(":hover"));
      const layer = escLayers.filter(l => l.open() && (!l.scoped || inFig)).sort((a, b) => a.p - b.p)[0];
      if (layer){ layer.close(); ev.preventDefault(); }
    });
    /* where a keyboard's focus goes when its action takes away the control it
       was on (see applyRefocus) */
    let refocus = null;
    /* the trad menu's heads are drawn in every beat's axis group and faded
       with it; a faded head must not be a stop for the keyboard */
    let menuHeadT = null;
    function syncMenuHeads(){
      el.querySelectorAll("g.mi-tradmenu").forEach(g => {
        let vis = true;
        for (let n = g; n && n !== el; n = n.parentNode){
          if (n.nodeType === 1 && +getComputedStyle(n).opacity < 0.05){ vis = false; break; }
        }
        g.setAttribute("tabindex", vis ? 0 : -1);
        if (vis) g.removeAttribute("aria-hidden"); else g.setAttribute("aria-hidden", "true");
      });
    }

    function paint(i, animate){
      if (holdPaint){ heldPaint = true; return; }
      /* every change to what the chart shows ends in a paint: an answer
         in the text stands only while the chart still shows it */
      if (checkAskRef) checkAskRef();
      /* the zoom targets belong to the map beats and the map view: anywhere
         else they are drawn away, or a keyboard would still find them */
      if (!((i === 0 || i === 4 || i === 7) && view === "map")) drawHits({ blocks: [], groups: [] });
      clearTimeout(menuHeadT); menuHeadT = setTimeout(syncMenuHeads, animate ? 1000 : 80);
      /* only a first arrival at the ranking is staged; re-sorting it is not */
      arriving = !!animate && i === 6 && painted !== 6;
      const at = STATE[i];
      const dur = animate ? 950 : 0;
      /* the map beats are drawn by the map layer. The per-industry cells
         under it stand down, but still travel to where the map puts their
         industry, so a beat that turns the map into bars starts each bar
         from the cell it comes from, and one that turns bars back into the
         map sends each bar home before the map comes in over it. */
      const mapOn = view === "map" && (i === 0 || i === 4 || i === 5 || i === 7);
      const opOf = d => mapOn ? 0 : at(d).op;
      const rects = cell.select(".mi-rect");
      /* a paint without animation also ends one still running on the
         cells: its targets were fixed when it began, and a gutter fitted
         since would be overwritten by them */
      const sel = dur ? rects.transition().delay(d => at(d).delay || 0)
        .duration(dur).ease(d3.easeCubicInOut) : rects.interrupt();
      sel.attr("x", d => at(d).box.x).attr("y", d => at(d).box.y)
         .attr("width", d => at(d).box.w).attr("height", d => at(d).box.h)
         .attr("fill", d => at(d).fill).attr("rx", d => at(d).rx)
         .style("opacity", opOf);
      /* a cell faded out of the ranking must not answer the cursor */
      rects.style("pointer-events", d => opOf(d) > 0 ? null : "none");

      /* labels ride the cells while there is room for them, and stand down
         once the mix becomes a ranking that carries its own names */
      const labs = cell.select(".mi-lab"), pcts = cell.select(".mi-pct");
      const barsOn = view === "alt" && (i === 0 || i === 1 || i === 4 || i === 5 || i === 7);
      /* the names can only be measured once the figure is on screen */
      refitNames();
      /* under the map layer, the bars and the rankings the cells carry no
         words of their own */
      if (i === 3 || i === 6 || barsOn || mapOn){
        [labs, pcts].forEach(t => (dur ? t.transition().duration(dur / 3) : t).style("opacity", 0));
      } else {
        /* the name whole and as large as the cell allows, the share under
           it; a cell that cannot hold the whole name carries nothing */
        const k = labUnit() / LAB_BASE, pctFmt = d3.format(".2%");
        cell.each(function(d){
          const st = at(d), b = st.box, g = d3.select(this);
          const nameT = g.select(".mi-lab"), pctT = g.select(".mi-pct");
          nameT.text(null); pctT.text(null);
          if (st.op <= 0) return;
          const spec = cellLabelSpec(d.name, b.w, b.h, k, pctFmt(d.employ / jobsTotal));
          if (!spec) return;
          const ink = cellInk(st.fill), x = b.x + spec.pad;
          nameT.attr("x", x).attr("y", b.y + spec.pad + spec.f * 0.86)
            .style("font-size", spec.f + "px").style("fill", ink).attr("data-ink", ink);
          spec.lines.forEach((ln, n) => nameT.append("tspan")
            .attr("x", x).attr("dy", n ? spec.f * spec.lh : 0).text(ln));
          if (spec.pf) pctT.attr("x", b.x + b.w / 2).attr("y", b.y + b.h - spec.pad - spec.pf * 0.12)
            .style("font-size", spec.pf + "px").style("fill", ink).attr("data-ink", ink)
            .text(pctFmt(d.employ / jobsTotal));
        });
        [labs, pcts].forEach(t => (dur ? t.transition().delay(dur / 2).duration(dur / 2) : t)
          .style("opacity", d => opOf(d) > 0 ? 1 : 0));
      }
      const show = (g, on, delay) => {
        /* a faded group still sits over everything beneath it, so the pointer
           has to be handed back with the opacity */
        g.style("pointer-events", on ? null : "none");
        return (dur ? g.transition().delay(on ? (delay || 0) : 0).duration(dur / 2) : g)
          .style("opacity", on ? 1 : 0);
      };
      const gapMode = sortKey === "gap";
      /* on arrival the ranking's names and columns come in once the bars
         have nearly settled */
      const late = arriving ? dur * 0.7 : 0;
      show(gAxis, i === 3 && !gapMode);
      show(gAxisGap, i === 3 && gapMode);
      show(gRows, i === 3);
      show(gAxis2, i === 6 && !gapMode, late);
      show(gAxisGap2, i === 6 && gapMode, late);
      show(gRows2, i === 6, late);
      if (barsOn && i !== 5 && i !== 7){
        const wantBar = i === 4 ? "tier" : "cx";
        if (barMode !== wantBar){ barMode = wantBar; reBarRank(); drawBars(barListAll, gBarsAll); }
      }
      show(gBarsAll, barsOn && i !== 5 && i !== 7);
      show(gBarsTrad, barsOn && (i === 5 || i === 7));
      /* the names belong to the sector-coloured map: under the ranked view
         the blocks are gone, and under Complexity the colour is not the
         sector's any more, so the labels would be naming the wrong thing */
      /* both map beats name their blocks; the sets differ, so redraw on
         arrival rather than once */
      if (closeMenuRef && !(((i === 4 || i === 0) && view === "alt") || i === 6)) closeMenuRef();
      const cardsOn = i === 4 && view === "map";
      gCards.classed("is-on", cardsOn);
      /* the crosses are for the keyboard only while the grounds are up */
      gCards.selectAll("rect.mi-card-x-hit").attr("tabindex", c => cardsOn && cardBox.length > 1 && !c.noX ? 0 : -1);
      show(gCards, cardsOn);
      /* a ground the filter empties keeps its width - the tiers' shares are
         the metro's, not the filter's - and says why it is bare */
      gCards.selectAll("g.mi-card-g").each(function(c){
        const g = d3.select(this), k = c.k;
        const bare = (secFiltered() || focus) && !clusterRows[k].some(d => secShown(d) && inFocus(d));
        /* named for what the reader zoomed into, the group if they went that far */
        const gRow = focusGroup ? industryData.find(d => d.group === focusGroup) : null;
        const zoomed = gRow ? (gRow.groupShort || gRow.groupName) : focus;
        const tn = g.select(".mi-card-none");
        tn.text(!bare ? "" : zoomed ? "Nothing here from " + zoomed : "None of the sectors shown");
        /* the line must fit its ground, or it prints across the next one */
        const node = tn.node(), room = c.w - 2 * Math.max(0, (+tn.attr("x") || c.x) - c.x);
        if (bare && zoomed){
          let nm = zoomed;
          while (nm.length > 3 && node.getComputedTextLength() > room){
            nm = nm.slice(0, -1).replace(/[\s&,-]+$/, ""); tn.text("Nothing here from " + nm + "\u2026");
          }
          if (node.getComputedTextLength() > room) tn.text("Nothing here");
        }
        /* it is a fixed size on screen, so a narrow ground takes a shorter line */
        if (bare && !zoomed) for (const t of ["None of these sectors", "None shown", "None"]){
          if (node.getComputedTextLength() <= room) break;
          tn.text(t);
        }
        /* a ground with nothing to show steps back, but its name and share
           still read (0.4 left them at 2.4 to 1) */
        g.select(".mi-card-pct").style("opacity", bare ? 0.72 : 1);
        g.select(".mi-card-lab").style("opacity", bare ? 0.72 : 1);
      });
      /* the map itself: tiled for the beat over whatever the filters and
         the zoom leave, and faded out under the bars and the rankings. It
         comes in once the bars have had time to travel home. */
      if (mapOn){
        gMap.style("pointer-events", null);
        const wasOff = +gMap.style("opacity") === 0;
        paintMap(layoutFor(i), animate && !wasOff);
        (dur && wasOff ? gMap.transition().delay(dur / 3).duration(dur / 2) : gMap.interrupt()).style("opacity", 1);
      } else {
        gMap.style("pointer-events", "none");
        (dur ? gMap.transition().duration(dur / 2) : gMap.interrupt()).style("opacity", 0);
        hideMapTip(true);
        mapLayout = null;
        syncNote(); syncTable();
      }
      /* on the reveal section the opening beat rests on the admin bands: the
         cells fade first, the blocks behind them come forward, and the veil
         drops last. Leaving the beat runs the same three in reverse. */
      if (opts.adminReveal && coarseCell){
        const onZero = i === 0;
        /* the coarse map is the beat's own grain: on its beat it splits into
           the two shades, and it steps aside for the finer beats after it */
        if (onZero) placeCoarse(animate, true);
        (dur ? coarseCell.transition().duration(dur / 2) : coarseCell)
          .style("opacity", onZero ? 1 : 0);
        if (dur){
          rects.transition().delay(onZero ? 0 : dur / 4).duration(dur / 2)
            .style("opacity", d => onZero ? 0 : at(d).op);
        } else {
          rects.style("opacity", d => onZero ? 0 : at(d).op);
        }
        rects.style("pointer-events", d => onZero || at(d).op === 0 ? "none" : null);
        labs.style("opacity", onZero ? 0 : null);
      }
      painted = i;
    }

    function setView(v){
      if (v === view) return;
      view = v;
      fig.dataset.view = view;
      syncViewCtl();
    }

    /* colour by: sector or complexity, on the two map beats. Each beat
       opens on sector, which is what its text describes; the reader changes
       it once there */
    /* The tradability tiers, as a filter on the jobs order and on the
       ranking. The ranked view answers "what is biggest"; unchecking a tier
       asks the narrower question the beat is really about - what is the
       biggest work that sells outward - so there all three start checked.
       The ranking starts on the two tradable tiers, which is its question.
       In either place the last one cannot be unchecked, since an empty chart
       answers nothing. */
    const menuEl = document.getElementById(p + "TradMenu");
    if (menuEl){
      /* which head opened it: the jobs order and the ranking keep separate
         tier sets, under the same three words */
      let menuCtx = "bars";
      const ctxOf = g => g && g.classList.contains("is-rank") ? "rank" : "bars";
      const tiersOf = ctx => ctx === "rank" ? tierOn6 : tierOn;
      /* the ranking draws a head in each of its two axis groups, one per
         order, so take the one that is actually showing */
      const headG = () => {
        const all = [].slice.call(el.querySelectorAll("g.mi-tradmenu." + (menuCtx === "rank" ? "is-rank" : "is-bars")));
        const shown = all.filter(g => {
          let n = g; while (n && n !== el){ if (n.nodeType === 1 && +getComputedStyle(n).opacity === 0) return false; n = n.parentNode; }
          return true;
        });
        return shown[0] || all[0] || null;
      };
      const isOpen = () => !menuEl.hidden;
      const closeMenu = toHead => {
        const was = !menuEl.hidden;
        menuEl.hidden = true;
        el.querySelectorAll("g.mi-tradmenu").forEach(g => {
          g.classList.remove("is-open"); g.setAttribute("aria-expanded", "false");
        });
        /* focus goes back to the head that opened it, not to the body */
        if (toHead === true && was){ const g = headG(); if (g && g.focus) g.focus({ preventScroll: true }); }
      };
      syncTierMenu = () => { if (!menuEl.hidden && menuCtx === "bars") syncItems(); };
      const syncItems = () => {
        const on = tiersOf(menuCtx);
        menuEl.querySelectorAll(".tm-item[data-tier]").forEach(b => {
          const k = +b.dataset.tier;
          b.classList.toggle("is-on", !!on[k]);
          b.setAttribute("aria-pressed", String(!!on[k]));
        });
      };
      const openMenu = byKey => {
        const g = headG(); if (!g) return;
        syncItems();
        const host = el.parentNode;                       /* the viz wrapper */
        const hb = g.getBoundingClientRect(), pb = host.getBoundingClientRect();
        menuEl.hidden = false;
        /* under the head, right edges together, and never off the wrapper */
        const mw = menuEl.offsetWidth;
        let left = hb.right - pb.left - mw;
        left = Math.max(4, Math.min(left, pb.width - mw - 4));
        /* the menu sits inside the wrapper: where that has been panned, its place moves with it */
        menuEl.style.left = (left + (host.scrollLeft || 0)) + "px";
        menuEl.style.top = (hb.bottom - pb.top + 6) + "px";
        g.classList.add("is-open");
        g.setAttribute("aria-expanded", "true");
        /* opened from the keyboard, the menu's own items are where it goes next */
        if (byKey){ const first = menuEl.querySelector(".tm-item"); if (first) first.focus({ preventScroll: true }); }
      };
      /* the head is redrawn whenever the filter moves, so the click is caught
         on the figure rather than bound to a node that will not survive */
      const toggleFrom = (g, byKey) => {
        const ctx = ctxOf(g);
        if (isOpen() && ctx === menuCtx){ closeMenu(byKey); return; }
        closeMenu(); menuCtx = ctx; openMenu(byKey);
      };
      on(el, "click", ev => {
        const g = ev.target.closest && ev.target.closest("g.mi-tradmenu");
        if (g) toggleFrom(g, ev.detail === 0);
      });
      on(el, "keydown", ev => {
        if (ev.key !== "Enter" && ev.key !== " ") return;
        const g = ev.target.closest && ev.target.closest("g.mi-tradmenu");
        if (!g) return;
        ev.preventDefault();
        toggleFrom(g, true);
      });
      on(menuEl, "click", ev => {
        const b = ev.target.closest(".tm-item[data-tier]");
        if (!b) return;
        const k = +b.dataset.tier, on = tiersOf(menuCtx);
        /* an empty chart answers nothing, so the last one stays on. Over the
           bars that is not the last tier but the last tier the sectors on
           screen still have anything in */
        if (menuCtx === "rank"){
          if (on[k] && on.filter(Boolean).length === 1) return;
        } else {
          const probe = on.slice(); probe[k] = !probe[k];
          if (!tierListWith(probe, secOn).length) return;
        }
        on[k] = !on[k];
        b.classList.toggle("is-on", on[k]);
        b.setAttribute("aria-pressed", String(on[k]));
        if (menuCtx === "rank"){
          if (rebuildR2Ref) rebuildR2Ref(!reduced());
        } else {
          /* the map's grounds are these same tiers, so they move together */
          layoutClusters();
          const list = tierList();
          barListAll = list;
          reBarRank();
          drawBars(list, gBarsAll);
          drawCards(!reduced());
          syncTierBack();
          paint(step, !reduced());
        }
        openMenu();                                        /* re-anchor */
      });
      on(document, "click", ev => {
        if (!isOpen()) return;
        if (menuEl.contains(ev.target)) return;
        if (ev.target.closest && ev.target.closest("g.mi-tradmenu")) return;
        closeMenu();
      });
      escLayers.push({ p: 2, open: isOpen, close: () => closeMenu(true) });
      closeMenuRef = closeMenu;
      keepMenuRef = {
        save: () => {
          const a = document.activeElement, head = a && el.contains(a) && a.closest ? a.closest("g.mi-tradmenu") : null;
          return { open: isOpen(), ctx: menuCtx, head: head ? ctxOf(head) : null };
        },
        restore: st => {
          if (st.open){
            /* re-anchored without moving the focus, which is still on the menu's item if it was */
            el.querySelectorAll("g.mi-tradmenu").forEach(g => { g.classList.remove("is-open"); g.setAttribute("aria-expanded", "false"); });
            menuCtx = st.ctx; openMenu(false);
          }
          /* the head that had the focus, found again in its own chart */
          if (st.head){
            const keep = menuCtx; menuCtx = st.head;
            const g = headG(); if (g && g.focus) g.focus({ preventScroll: true });
            if (!st.open) menuCtx = keep;
          }
        }
      };
    }

    /* the ranking's own study: tier word (shipped) or score in the
       tradability column. Going to opt-1 also resets the filter, so opt-1 is
       always the ranking over the two tradable tiers alone. */
    const rankOptEl = document.getElementById(p + "RankOpt");
    if (rankOptEl) on(rankOptEl, "change", () => {
      if (rankOptEl.value === rankMode) return;
      rankMode = rankOptEl.value;
      fig.dataset.rank = rankMode;
      tierOn6 = TIER_DEFAULT6();                          /* opt-2 always reopens as shipped */
      if (closeMenuRef) closeMenuRef();
      if (rebuildR2Ref) rebuildR2Ref(!reduced());
    });

    const colorEl = document.getElementById(p + "Color");
    /* the complexity rank in the first beat's text (and, where a section
       still has one, its complexity explainer) */
    const complexityBits = [p + "RankCard", p + "ComplexityInfo"]
      .map(id => document.getElementById(id)).filter(Boolean);
    function setColorBy(c){
      colorBy = c === "complexity" ? "complexity" : "sector";
      fig.dataset.color = colorBy;
      /* the complexity ramp takes the key's slot under the chart, and the key
         is the only way back from a sector filter: rather than strand the
         reader with a filtered map and nothing to undo it, the sectors come
         back as the key leaves */
      if (colorBy === "complexity" && secFiltered() && resetSec) resetSec();
      /* those show only while the first beat is coloured by complexity. They
         are only touched on that beat: showing or hiding them in a beat above
         the reader would shift the page under them. They open and close in
         place, so the centred text re-settles smoothly rather than jumping,
         and while closed they leave the tab order and the reading order */
      if (step === 0 || step < 0) complexityBits.forEach(el => {
        const off = colorBy !== "complexity";
        el.classList.toggle("is-off", off);
        el.setAttribute("aria-hidden", String(off));
        el.inert = off;
      });
      if (colorEl) colorEl.querySelectorAll(".seg-btn[data-color]").forEach(x => {
        const on = x.dataset.color === colorBy;
        x.classList.toggle("is-active", on);
        x.setAttribute("aria-pressed", String(on));
      });
      const sc = document.getElementById(p + "SColor");
      if (sc && sc.value !== colorBy){ sc.value = colorBy; fitPick(sc); }
    }
    setColorBy(colorBy);
    const applyColor = c => {
      if (c === colorBy) return;
      setColorBy(c);
      if (step === 7 || step === 4 || step === 0) paint(step, !reduced());
    };
    if (colorEl) on(colorEl, "click", ev => {
      const b = ev.target.closest(".seg-btn[data-color]");
      if (b) applyColor(b.dataset.color);
    });
    const sColorEl = document.getElementById(p + "SColor");
    if (sColorEl) on(sColorEl, "change", () => { fitPick(sColorEl); applyColor(sColorEl.value); });

    window[ctlName] = { destroy: function(){ disposers.forEach(f => f()); disposers.length = 0; }, setStep: function(i){
      i = Math.max(0, Math.min(7, i | 0));
      if (i === step) return;
      /* a phrase left lit must not dim the beat that follows it */
      if (clearHighlight) clearHighlight();
      /* nor does a question's view travel: the beat being left goes back
         to its own view first */
      if (leaveAskRef) leaveAskRef();
      const first = step < 0;
      step = i;
      fig.dataset.step = String(i);
      /* the tradable beat reads at the industry level whatever the map
         rested at: the grain goes back to 6 before the beat is painted,
         and the level control follows the beat (set, or set and held) */
      const forced = i === 4 && MAP_GRAIN !== 6;
      if (forced){ MAP_GRAIN = 6; invalidateMaps(); }
      /* a card pinned on one beat does not ride into the next; every other
         retile lets it go, and so does the beat change */
      hideMapTip(true);
      syncLevel();
      seatTableBtn(i);
      /* a head that is only faded still held its buttons for the keyboard -
         and so did the title slots, whose chips bring a tier back */
      [[p + "AllHead", i === 0], [p + "ClusterHead", i === 4], [p + "Sort", i === 3 || i === 6]].forEach(([id, on]) => {
        const h = document.getElementById(id); if (h) h.inert = !on;
      });
      [[".mi-title-all", i === 0], [".mi-title-tier", i === 4]].forEach(([sel, on]) => {
        const h = document.querySelector("#" + p + "View " + sel); if (h) h.inert = !on;
      });
      /* a blank the beat has just brought into the flow - the bars' order
         on the first beat - could not be measured while it was out of it */
      fitPicks(fig);
      /* each map beat opens coloured by sector, as its text describes */
      if (i === 7 || i === 4 || i === 0) setColorBy("sector");
      /* the zoom belongs to the map beats and travels between them: what
         the reader zoomed into on the whole map is what the tiers show, and
         back again. It is let go on the beats that have no map. */
      if (i !== 0 && i !== 4 && i !== 7 && focus){ focus = null; focusGroup = null; fig.dataset.focus = ""; reBars(); syncKey(); }
      /* the clusters are a movement between columns, and the ranked bars
         have none: the beat opens as the map however the last one was left */
      if (i === 4) setView("map");
      /* the reveal section opens on the metro's own mix and only then shows
         the city's part of it, so its first beat is played, not painted */
      if (first && i === 0 && opts.adminReveal){ paintMetroFirst(); return; }
      settleForPaint();
      paint(i, !first && !reduced());
      if (forced) syncLive(", set back to the industry level, which this beat holds");
      if (afterStepRef) afterStepRef(i);
    } };

    /* the clusters' furniture: the header's columns and the captions share
       the columns' widths, and the captions carry each cluster's share */
    (function clusterFurniture(){
      const head = document.getElementById(p + "ClusterHead");
      const pct = v => Math.round(v * 100) + "%";
      /* the cluster header's columns moved into the cards, so this is null on
         that beat now - it must not fall back to the head itself, or the
         arrow row gets sized as if it were the three columns */
      const colsEl = head && head.querySelector(".mcl-cols");
      if (colsEl) [].forEach.call(colsEl.children, (c, k) => {
        const pc = c.querySelector(".pct"); if (pc) pc.textContent = "(" + pct(clusterShare[k]) + ")";
      });
      /* the header of the opening frame, which shows the most tradable alone */
      const tradHead = document.getElementById(p + "TradHead");
      if (tradHead){ const pc = tradHead.querySelector(".pct");
        if (pc) pc.textContent = "(" + pct(clusterShare[0] + clusterShare[1]) + " of metro jobs)"; }
      /* each name sits over its own column, so the header is measured from
         the chart rather than from the slot that holds it — the slot runs a
         little wider, and a share of that width would drift the names right */
      function sizeClusterHead(){
        if (!head || !colsEl) return;
        /* only the columns need measuring against the chart. The head itself
           must NOT be given a measured width: this runs while the page is
           still hidden, where the chart measures 0 and the fallback pinned the
           row at 880px against a 620px figure, so the arrow ran off the panel
           and took "Less tradable" with it. */
        const w = el.getBoundingClientRect().width || MI_W, sc = w / MI_W;
        colsEl.style.gap = (CGAP * sc) + "px";
        [].forEach.call(colsEl.children, (c, k) => {
          c.style.flexBasis = (Math.max(36, CW * clusterShare[k]) * sc) + "px";
        });
      }
      sizeClusterHead();
      on(window, "resize", sizeClusterHead);
      /* each tier's share of the metro's jobs is printed on its own ground,
         beside its name (2026-10-02; it stood in a donut beside the text,
         with the grounds carrying the name alone) */
    })();

    /* the coarse map, laid out for whichever arrangement is chosen. `split`
       says whether the blocks are showing their two shades yet. */
    function placeCoarse(animate, split){
      if (!coarseCell) return;
      const at = d => (view === "alt" ? posCoarseFlat : posCoarse).get(d.name);
      const pale = sec => d3.interpolateRgb(sectorColors[sec] || "#ccc", "#ffffff")(0.66);
      const dur = animate ? 900 : 0;

      const r = coarseCell.select(".mi-rect");
      (dur ? r.transition().duration(dur).ease(d3.easeCubicInOut) : r)
        .attr("x", d => at(d).x).attr("y", d => at(d).y)
        .attr("width", d => at(d).w).attr("height", d => at(d).h)
        .attr("fill", d => split ? pale(d.sector) : (sectorColors[d.sector] || "#ccc"));

      /* the city's band grows up from the foot of its own block */
      const band = coarseCell.select(".mi-share")
        .attr("x", d => at(d).x).attr("width", d => at(d).w);
      (dur ? band.transition().delay(split ? dur * 0.35 : 0).duration(dur * 0.65)
                 .ease(d3.easeCubicInOut) : band)
        .attr("y", d => at(d).y + at(d).h * (split ? 1 - coarseShare(d) : 1))
        .attr("height", d => split ? at(d).h * coarseShare(d) : 0);

      const t = coarseCell.select(".mi-lab");
      t.attr("x", d => at(d).x + 5).attr("y", d => at(d).y + 13)
        .text(d => fitLabel(d.name, { width: at(d).w, height: at(d).h }));
      (dur ? t.transition().delay(dur / 2).duration(dur / 2) : t).style("opacity", 1);

      const pct = coarseCell.select(".mi-share-pct");
      pct.attr("x", d => at(d).x + 6).attr("y", d => at(d).y + at(d).h - 7);
      (dur ? pct.transition().delay(split ? dur * 0.8 : 0).duration(dur * 0.4) : pct)
        .style("opacity", split ? 1 : 0);
    }

    /* the opening frame of the reveal: the metro's mix at the coarse grain,
       with the sector blocks and the veil still to come. The reveal waits for
       the figure to be on screen, and plays again on every return. */
    function paintMetroFirst(){
      placeCoarse(false, false);
      coarseCell.style("opacity", 1);
      cell.select(".mi-rect").style("opacity", 0);
      cell.select(".mi-lab").style("opacity", 0); cell.select(".mi-pct").style("opacity", 0);
    }
    if (opts.adminReveal){
      let played = false;
      const play = () => {
        if (played || step !== 0) return;
        played = true;
        paint(0, !reduced());
      };
      if (window.IntersectionObserver){
        const io = new IntersectionObserver(es => es.forEach(e => {
          if (e.isIntersecting) setTimeout(play, 420);
          else played = false;            // leaving arms it to play again
        }), { threshold: 0.35 });
        io.observe(el); disposers.push(() => io.disconnect());
      } else {
        setTimeout(play, 600);
      }
    }

    /* ---- the map layer's own workings: the tiling for the beat, the cells
       drawn from it, the zoom, the outline under the pointer, the card, the
       line over the map and the table under it ---- */
    let mapLayout = null;                 /* the tiling on screen */
    const mapTip = document.getElementById(p + "Tip");
    const mapWrap = el.closest(".tradable-viz-wrapper");
    const svgEl = document.getElementById(p + "TreemapSvg");
    let pinned = null, syncKeyRef = null, hlSwatchRef = null;
    const mapFillOf = c => colorBy === "complexity" ? cxFillOf(c.cell.pci) : sectorColors[c.cell.sector];
    const mapInkOf = c => colorBy === "complexity" ? cellInk(cxFillOf(c.cell.pci)) : sectorInk(c.cell.sector);
    function layoutFor(i){ return i === 4 ? mapTiers() : (i === 5 || i === 7) ? mapTrad() : mapFull(); }
    /* what a click on a cell does: at the top of the map it zooms into the
       cell's sector; inside a sector whose cells are groups - a map
       resting at a coarser level - into the cell's group; and where the
       cells are industries there is nowhere further to go, so it pins
       the card */
    const zoomTarget = c => {
      if ((step !== 0 && step !== 4 && step !== 7) || view !== "map") return null;
      if (!focus) return { sector: c.cell.sector, group: null, label: c.cell.sector };
      if (!focusGroup && mapLayout && mapLayout.grain === 4 && /^\d{4}$/.test(c.cell.group))
        return { sector: focus, group: c.cell.group, label: c.cell.groupName };
      return null;
    };
    function paintMap(L, animate){
      mapLayout = L;
      const s = L.s, dur = animate ? 950 : 0;
      const sel = gMapCells.selectAll("g.mi-mcell").data(L.cells, c => c.id);
      const enter = sel.enter().append("g").attr("class", "mi-mcell");
      enter.append("rect").attr("class", "mi-mrect")
        .attr("x", c => c.box.x).attr("y", c => c.box.y).attr("width", c => c.box.w).attr("height", c => c.box.h)
        .attr("fill", c => mapFillOf(c)).style("opacity", 0);
      enter.append("text").attr("class", "mi-mlab");
      const exit = sel.exit().style("pointer-events", "none");
      (dur ? exit.transition().duration(dur / 2) : exit).style("opacity", 0).remove();
      const all = enter.merge(sel).classed("is-rest", c => c.rest)
        .style("pointer-events", null).style("opacity", null);
      const rect = all.select("rect.mi-mrect");
      (dur ? rect.transition().duration(dur).ease(d3.easeCubicInOut) : rect.interrupt())
        .attr("x", c => c.box.x).attr("y", c => c.box.y).attr("width", c => c.box.w).attr("height", c => c.box.h)
        .attr("fill", c => mapFillOf(c)).style("opacity", 1);
      /* the labels are written for the new tiling at once and come in once
         the cells have nearly settled; a folded "Other" cell carries none */
      all.each(function(c){
        const t = d3.select(this).select("text.mi-mlab");
        t.selectAll("tspan").remove();
        if (c.rest) return;
        /* under a card the block's name and share are the card's first lines */
        if (L.grain === 2 && SEC_BLOCK !== "plain" && SEC_BLOCK !== "ghost") return;
        const share = fmtShare(c.cell.share);
        /* at the sector grain with the band naming the block, the cell keeps its share alone */
        const shareOnly = L.grain === 2 && SEC_NAMES !== "off";
        const ceil = L.grain === 2 ? MAP.sectorSize : MAP.size;
        const spec = shareOnly ? fitCellLabel(share, "", c.px, ceil) : fitCellLabel(c.cell.name, share, c.px, ceil);
        if (!spec) return;
        const ink = mapInkOf(c);
        t.attr("font-size", spec.size / s).attr("fill", ink).attr("data-ink", ink).attr("font-weight", MAP.weight);
        spec.lines.forEach((ln, n) => t.append("tspan")
          .attr("x", spec.x / s).attr("y", lineY(spec.y, spec.size, n) / s).text(ln));
        if (spec.share && !shareOnly) t.append("tspan").attr("class", "mi-mshare")
          .attr("x", spec.x / s).attr("y", lineY(spec.y, spec.size, spec.lines.length, true) / s)
          .attr("font-weight", MAP.shareWeight).text(share);
      });
      const lab = all.select("text.mi-mlab");
      if (dur) lab.style("opacity", 0).transition().delay(dur * 0.55).duration(dur * 0.45).style("opacity", 1);
      else lab.interrupt().style("opacity", 1);
      paintCards(all, L, dur);
      all.on("mouseenter", (ev, c) => { if (!pinned) showMapTip(c, ev); })
         .on("mousemove", ev => { if (!pinned && mapTip && !mapTip.hidden) cursorTipPos(ev, mapWrap, mapTip); })
         .on("mouseleave", () => { if (!pinned) hideMapTip(false); })
         .on("click", (ev, c) => {
           ev.stopPropagation();
           const t = zoomTarget(c);
           if (t){ setFocus(t.sector, t.group); return; }
           if (pinned === c.id){ hideMapTip(true); return; }
           pinned = c.id; showMapTip(c, ev);
         });
      paintFrames(L, dur);
      drawHits(L);
      clearOutline();
      syncNote(); syncTable();
    }
    /* the sector blocks' dressing, at the sector grain: a faint tiling of
       the block's groups, a card of its facts, or both. The card fits what
       the block's size allows, from the top down: name, share and jobs, the
       change, the largest groups, the complexity steps; a line that will
       not fit is left out, and the lines beneath it with it. */
    const fmtJobsK = v => v >= 1e6 ? (v / 1e6).toFixed(1) + "M" : v >= 1000 ? Math.round(v / 1000) + "K" : String(Math.round(v));
    const groupsOf = cell => {
      const members = cell.members || [cell];
      return d3.rollups(members, v => d3.sum(v, m => m.jobs), m => m.group)
        .map(([g, jobs]) => ({ group: g, name: (members.find(m => m.group === g) || {}).groupName || g, jobs: jobs }))
        .sort((a, b) => b.jobs - a.jobs);
    };
    function paintCards(all, L, dur){
      const s = L.s, mode = L.grain === 2 ? SEC_BLOCK : "plain";
      const ghostOn = mode === "ghost" || mode === "cardghost" || mode === "change";
      const cardOn = mode === "card" || mode === "cardghost" || mode === "change";
      all.each(function(c){
        const g = d3.select(this);
        let ghost = g.select("g.mi-mghost"), card = g.select("g.mi-mcard");
        if (ghost.empty()) ghost = g.insert("g", "text.mi-mlab").attr("class", "mi-mghost");
        if (card.empty()) card = g.append("g").attr("class", "mi-mcard");
        ghost.selectAll("*").remove(); card.selectAll("*").remove();
        if (c.rest || mode === "plain") return;
        const px = c.px, sec = c.cell.sector, groups = groupsOf(c.cell);
        if (ghostOn && groups.length > 1){
          const root = d3.hierarchy({ children: groups }).sum(d => d.jobs).sort((a, b) => b.value - a.value);
          d3.treemap().size([px.w, px.h]).paddingInner(1).round(true)(root);
          root.leaves().forEach(n => ghost.append("rect")
            .attr("x", (px.x + n.x0) / s).attr("y", (px.y + n.y0) / s)
            .attr("width", Math.max(0, n.x1 - n.x0) / s).attr("height", Math.max(0, n.y1 - n.y0) / s)
            .attr("fill", "none").attr("stroke", "#fff").attr("stroke-opacity", 0.3).attr("stroke-width", 1 / s));
        }
        if (!cardOn) return;
        const ink = mapInkOf(c), soft = /^#f/i.test(ink) ? "rgba(255,255,255,.82)" : "rgba(26,34,38,.78)";
        const pad = 7, room = px.w - 2 * pad, bottom = px.y + px.h - 4;
        let y = px.y + pad;
        const line = (txt, size, weight, fill) => {
          if (mapTextW(txt, size, weight) > room || y + size * 1.05 > bottom) return false;
          y += size * 1.02;
          card.append("text").attr("x", (px.x + pad) / s).attr("y", y / s)
            .attr("font-size", size / s).attr("font-weight", weight).attr("fill", fill).text(txt);
          y += size * 0.28; return true;
        };
        /* the band names the block already when the sector-names study is on */
        if (SEC_NAMES === "off" && !line(sec, 14, 700, ink) && !line(SECTOR_SHORT[sec] || sec, 12.5, 700, ink)) return;
        if (!line(fmtShare(c.cell.share) + " of metro jobs \u00b7 " + fmtJobsK(c.cell.jobs), 12.5, 400, ink)) return;
        if (mode === "change"){
          const j14 = sectorJobs(2014)[sec], j24 = sectorJobs(2024)[sec];
          if (j14 > 0 && j24 > 0){
            const r = Math.pow(j24 / j14, 1 / 10) - 1;
            line((r >= 0 ? "+" : "\u2212") + Math.abs(r * 100).toFixed(1) + "% a year, 2014 to 2024", 12.5, 400, soft);
          }
        }
        const gl = groups.slice(0, 3).map(gr => gr.name + " " + fmtShare(gr.jobs / jobsTotal)).filter(t => mapTextW(t, 12.5, 500) <= room);
        if (gl.length && y + 6 + 12.5 * 1.3 + 12.5 * 1.3 <= bottom){
          y += 6; line("Largest groups", 12.5, 700, soft);
          for (const t of gl) if (!line(t, 12.5, 500, ink)) break;
        }
        const bin = cxBinOf(c.cell.pci);
        if (bin != null && y + 16 <= bottom && room >= 62 + mapTextW("complexity", 12.5, 400)){
          y += 8;
          for (let k = 0; k < 5; k++) card.append("circle").attr("cx", (px.x + pad + 4 + k * 11) / s).attr("cy", (y + 4) / s).attr("r", 3.2 / s)
            .attr("fill", k <= bin ? ink : "none").attr("stroke", ink).attr("stroke-opacity", k <= bin ? 1 : 0.55).attr("stroke-width", 1 / s);
          card.append("text").attr("x", (px.x + pad + 62) / s).attr("y", (y + 8) / s).attr("font-size", 12.5 / s).attr("fill", soft).text("complexity");
        }
      });
      const dress = all.selectAll("g.mi-mghost, g.mi-mcard");
      if (dur) dress.style("opacity", 0).transition().delay(dur * 0.55).duration(dur * 0.45).style("opacity", 1);
      else dress.interrupt().style("opacity", 1);
    }
    /* the sectors' frames and names, one per block the tiling made, drawn
       under the cells in the room the tiling left above them. A name that
       will not fit its block at 11px tries its short form, then stands
       down and leaves the frame alone. The strip answers the pointer as
       the key's entry does - it outlines the block, and a click zooms in. */
    function paintFrames(L, dur){
      const s = L.s, mode = SEC_NAMES;
      const data = mode === "off" ? [] : L.blocks.filter(b => b.box.w > 0 && b.box.h > 0);
      const sel = gMapFrames.selectAll("g.mi-secg").data(data, b => b.key);
      const enter = sel.enter().append("g").attr("class", "mi-secg").style("opacity", 0);
      enter.append("rect").attr("class", "mi-secframe").attr("fill", "none");
      enter.append("rect").attr("class", "mi-sechead");
      enter.append("text").attr("class", "mi-secname");
      const exit = sel.exit().style("pointer-events", "none");
      (dur ? exit.transition().duration(dur / 2) : exit).style("opacity", 0).remove();
      const all = enter.merge(sel).attr("data-sector", b => b.sector)
        .classed("is-band", mode === "band").classed("is-gutter", mode === "gutter")
        .classed("is-zoomable", !focus && hitsLive()).style("pointer-events", null);
      const strip = SEC_STRIP / s, lw = 1 / s;
      const go = g => dur ? g.transition().duration(dur).ease(d3.easeCubicInOut) : g.interrupt();
      go(all.select("rect.mi-secframe"))
        .attr("x", b => b.box.x + lw / 2).attr("y", b => b.box.y + lw / 2)
        .attr("width", b => Math.max(0, b.box.w - lw)).attr("height", b => Math.max(0, b.box.h - lw))
        .attr("stroke", b => mode === "band" ? secDeeper(b.sector) : "none").attr("stroke-width", lw);
      go(all.select("rect.mi-sechead"))
        .attr("x", b => b.box.x).attr("y", b => b.box.y).attr("width", b => b.box.w)
        .attr("height", b => Math.min(strip, b.box.h))
        .attr("fill", b => mode === "band" ? secDeeper(b.sector) : "#fff")
        .attr("fill-opacity", mode === "band" ? 1 : 0.001);
      all.each(function(b){
        const t = d3.select(this).select("text.mi-secname");
        const room = b.box.w * s - 10;
        let name = "";
        if (b.box.h * s >= SEC_STRIP + 4)
          for (const n of [b.sector, SECTOR_SHORT[b.sector] || b.sector]) if (mapTextW(n, SEC_NAME_SIZE, 700) <= room){ name = n; break; }
        const ink = mode === "band" ? cellInk(secDeeper(b.sector)) : gutterInk(b.sector);
        t.text(name).attr("font-size", SEC_NAME_SIZE / s).attr("font-weight", 700).attr("fill", ink).attr("data-ink", ink);
        go(t).attr("x", b.box.x + 5 / s).attr("y", b.box.y + 13 / s);
      });
      (dur ? all.transition().delay(dur * 0.4).duration(dur * 0.6) : all.interrupt()).style("opacity", 1);
      all.on("mouseenter", (ev, b) => { if (!pinned) showOutline([b.box], 1.5); })
         .on("mouseleave", () => { if (!pinned) clearOutline(); })
         .on("click", (ev, b) => { ev.stopPropagation(); if (!focus && hitsLive()) setFocus(b.sector, null); });
    }
    /* the zoom's targets, under the cells for the keyboard: the sector
       blocks at the top of the map, and inside a sector the groups, where
       the cells are groups (the industry map has no group layer) */
    function hitsLive(){ return (step === 0 || step === 4 || step === 7) && view === "map"; }
    function drawHits(L){
      let targets = [];
      /* on the tiers a sector or a group is a block in each ground, so each
         is its own target, named for the ground it is in */
      const where = b => step === 4 && b.band ? " (" + b.band + ")" : "";
      if ((step === 0 || step === 4 || step === 7) && view === "map"){
        if (!focus) targets = L.blocks.map(b => ({ key: (b.band || "") + ":" + b.key, box: b.box, sector: b.sector, group: null, label: "Zoom into " + b.sector + where(b) }));
        else if (!focusGroup && L.grain === 4) targets = L.groups.filter(g => /^\d{4}$/.test(g.group))
          .map(g => ({ key: g.key, box: g.box, sector: focus, group: g.group,
                       label: "Zoom into " + ((g.items[0] && g.items[0].cell.groupName) || g.group) + where(g) }));
      }
      const h = gMapHit.selectAll("rect.mi-mhit").data(targets, t => t.key);
      h.exit().remove();
      h.enter().append("rect").attr("class", "mi-mhit").attr("fill", "transparent")
        .attr("role", "button").attr("tabindex", 0)
        .merge(h)
        .attr("x", t => t.box.x).attr("y", t => t.box.y).attr("width", t => t.box.w).attr("height", t => t.box.h)
        .attr("aria-label", t => t.label)
        .on("click", (ev, t) => { ev.stopPropagation(); if (hitsLive()) setFocus(t.sector, t.group, ev.detail === 0); })
        .on("keydown", (ev, t) => { if (ev.key === "Enter" || ev.key === " "){ ev.preventDefault(); if (hitsLive()) setFocus(t.sector, t.group, true); } })
        .on("focus", (ev, t) => { if (ev.target.matches(":focus-visible")) showRing(t.box); })
        .on("blur", () => showRing(null));
    }
    /* what the pointer's outline goes round: the cell's sector block at the
       top of the map (in its own tier on the tiers beat); inside a sector
       the cell itself, which where the cells are groups is its group's box */
    const outlineBoxes = c => {
      const L = mapLayout; if (!L) return [c.box];
      if (!focus) return L.blocks.filter(b => b.sector === c.cell.sector && (step !== 4 || b.band === c.band)).map(b => b.box);
      if (!focusGroup){ const g = L.groups.find(g => g.items.some(it => it.id === c.id)); return [g ? g.box : c.box]; }
      return [c.box];
    };
    function showOutline(boxes, width){
      const s = scaleNow(), w = (width || 1.5) / s, o = w / 2;
      gMapOutline.selectAll("rect.mi-moutline").data(boxes).join("rect").attr("class", "mi-moutline")
        .attr("x", b => b.x - o).attr("y", b => b.y - o).attr("width", b => b.w + w).attr("height", b => b.h + w)
        .attr("stroke-width", w);
    }
    const clearOutline = () => gMapOutline.selectAll("rect.mi-moutline").remove();
    function showRing(b){
      const s = scaleNow();
      gMapOutline.selectAll("rect.mi-mring").data(b ? [b] : []).join("rect").attr("class", "mi-mring")
        .attr("x", d => d.x - 2 / s).attr("y", d => d.y - 2 / s).attr("width", d => d.w + 4 / s).attr("height", d => d.h + 4 / s)
        .attr("rx", 3 / s).attr("stroke-width", 2.5 / s);
    }
    /* the blocks of the sectors a phrase or the key names, on the tiling showing */
    const sectorBlocks = want => !mapLayout ? [] : mapLayout.blocks.filter(b => want.indexOf(b.sector) >= 0).map(b => b.box);

    /* ---- the zoom: one sector over the whole map, then one of its groups ---- */
    /* After a keyboard action removes the control focus was on, focus goes
       where the reader will want it: into the trail after zooming in, back
       to the block just left after zooming out, onto the chip after a tier
       is taken off the map and onto that ground's cross after it is put
       back. A pointer's action never moves focus. */
    function applyRefocus(){
      const r = refocus; refocus = null; if (!r) return;
      const a = document.activeElement;
      if (a && a !== document.body && !fig.contains(a)) return;
      let node = null;
      if (r.kind === "crumb"){
        const note = document.getElementById(p + (step === 4 ? "Note4" : "Note"));
        node = note && note.querySelector('.mi-crumb[data-zoom="all"]');
      } else if (r.kind === "hit"){
        const hits = [].slice.call(el.querySelectorAll("rect.mi-mhit"));
        node = hits.find(h => { const t = d3.select(h).datum(); return r.group ? t.group === r.group : (t.sector === r.sector && !t.group); }) || hits[0];
        /* inside a sector whose cells are industries there are no blocks
           to land on: the zoom's own trail takes the keyboard instead */
        if (!node && focus){
          const note = document.getElementById(p + (step === 4 ? "Note4" : "Note"));
          node = note && note.querySelector('.mi-crumb[data-zoom="all"]');
        }
      } else if (r.kind === "chip"){
        node = tierBack && tierBack.querySelector('.mcl-chip[data-tier="' + r.k + '"]');
      } else if (r.kind === "close"){
        node = el.querySelector('rect.mi-card-x-hit[data-close="' + r.k + '"]');
      }
      if (!node) node = svgEl;
      if (node && node.focus) node.focus({ preventScroll: true });
      if (r.kind === "hit" && node && node.matches && node.matches("rect.mi-mhit")) showRing(d3.select(node).datum().box);
    }
    function setFocus(sec, grp, byKey){
      grp = grp || null;
      if (sec === focus && grp === focusGroup) return;
      if (byKey){
        const od = focusGroup ? 2 : focus ? 1 : 0, nd = sec ? (grp ? 2 : 1) : 0;
        refocus = nd > od ? { kind: "crumb" } : od === 2 ? { kind: "hit", group: focusGroup } : { kind: "hit", sector: focus };
      }
      focus = sec || null; focusGroup = focus ? grp : null;
      fig.dataset.focus = focus ? (focusGroup ? "group" : "sector") : "";
      hideMapTip(true);
      reBars();
      if (syncKeyRef) syncKeyRef();
      if (step >= 0) paint(step, !reduced());
      applyRefocus();
    }
    const zoomOut = byKey => { if (focusGroup) setFocus(focus, null, byKey); else if (focus) setFocus(null, null, byKey); };
    escLayers.push({ p: 4, open: () => keyTipIsOpen(), close: () => { if (hideKeyTip) hideKeyTip(); } });
    escLayers.push({ p: 5, scoped: true, open: () => !!pinned, close: () => hideMapTip(true) });
    escLayers.push({ p: 6, scoped: true, open: () => (step === 0 || step === 4 || step === 7) && view === "map" && !!focus, close: () => zoomOut(true) });

    /* the hand that taps, for either card's last line */
    const HAND = '<svg class="skt-hand" viewBox="0 0 24 24" width="17" height="17" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M8 13V4.5a1.5 1.5 0 0 1 3 0V12M11 11.5v-2a1.5 1.5 0 0 1 3 0V12M14 10.5a1.5 1.5 0 0 1 3 0V12M17 11.5a1.5 1.5 0 0 1 3 0V16a6 6 0 0 1-6 6h-1.792a6 6 0 0 1-5.012-2.7l-.196-.3c-.312-.479-1.407-2.388-3.286-5.728a1.5 1.5 0 0 1 .536-2.022 1.867 1.867 0 0 1 2.28.28L8 13"/>' +
      '<path class="skt-hand-marks" d="M5 3 4 2M4 7H3M14 3l1-1M15 6h1"/></svg>';
    /* ---- the card: the ranking's card, row for row - the industry's name
       over its sector in the sector's colour, then Jobs, Share of metro
       jobs, Complexity as the column's five diamonds with the score, and
       Tradability - with a last line, beside the hand that taps, for what
       a click does. A folded cell adds how many it stands for. ---- */
    function mapTipHtml(c, hint){
      const cell = c.cell;
      const row = (k, v) => '<dt>' + k + '</dt><dd>' + v + '</dd>';
      const b = cxBinOf(cell.pci);
      let cx;
      if (b == null) cx = '<dd class="tip-cx-cell"><em>not measured</em></dd>';
      else {
        let dots = '<span class="tip-cx" aria-hidden="true">';
        for (let k = 0; k < 5; k++) dots += '<i' + (k <= b ? ' class="is-on"' : '') + '></i>';
        cx = '<dd class="tip-cx-cell">' + dots + '</span><span class="tip-cx-val">' + cell.pci.toFixed(2) + '</span>' +
          '<span class="tip-sr">step ' + (b + 1) + ' of 5, ' + CX_WORDS[b] + '</span></dd>';
      }
      const head = '<div class="tip-head"><strong>' + escHtml(cell.name) + '</strong>' +
        '<span class="tip-sector"><i style="background:' + (sectorColors[cell.sector] || "#ccc") + '"></i>' +
        escHtml(cell.sector) + '</span></div>';
      const body = '<dl class="tip-grid">' +
        (cell.members ? row("Industries", cell.members.length + (c.rest ? " smaller" : "")) : "") +
        row("Jobs", fmtJobsFull(cell.jobs)) +
        row("Share of metro jobs", (cell.share * 100).toFixed(2) + "%") +
        '<dt>Complexity</dt>' + cx +
        /* tradability is the second beat's reading: the whole-map beat has
           not introduced it yet, so its card does not carry it */
        (cell.tier != null && step !== 0 ? row("Tradability", TIER_WORDS[cell.tier]) : "") +
        '</dl>';
      return head + body + (hint ? '<p class="tip-hint">' + HAND + '<span>' + escHtml(hint) + '</span></p>' : '');
    }
    const hintFor = c => {
      const t = zoomTarget(c);
      if (t) return "Click to zoom into " + t.label;
      return pinned === c.id ? "Click again or press Esc to unpin" : "Click to pin";
    };
    function showMapTip(c, ev){
      if (!mapTip || !mapWrap) return;
      mapTip.className = "rca-tip is-map";
      mapTip.innerHTML = mapTipHtml(c, hintFor(c));
      mapTip.hidden = false;
      if (ev) cursorTipPos(ev, mapWrap, mapTip);
      showOutline(outlineBoxes(c), pinned === c.id ? 2.5 : 1.5);
    }
    function hideMapTip(force){
      if (pinned && !force) return;
      pinned = null;
      if (mapTip && mapTip.classList.contains("is-map")){ mapTip.hidden = true; mapTip.classList.remove("is-map"); }
      clearOutline();
    }

    /* ---- the line over the map: where the reader has zoomed to, while
       they are zoomed in, and nothing otherwise ---- */
    const notes = [p + "Note", p + "Note4"].map(id => document.getElementById(id)).filter(Boolean);
    function syncNote(){
      let txt;
      if (focus){
        const gRow = focusGroup ? industryData.find(d => d.group === focusGroup) : null;
        const gName = gRow ? (gRow.groupShort || gRow.groupName) : focusGroup;
        txt = '<span class="mi-crumbs" role="navigation" aria-label="Zoom"><button type="button" class="mi-crumb" data-zoom="all">All sectors</button>' +
          '<span class="mi-crumb-sep" aria-hidden="true">›</span>' +
          (focusGroup
            ? '<button type="button" class="mi-crumb" data-zoom="sector">' + escHtml(focus) + '</button>' +
              '<span class="mi-crumb-sep" aria-hidden="true">›</span><span class="mi-crumb-here" aria-current="location">' + escHtml(gName) + '</span>'
            : '<span class="mi-crumb-here" aria-current="location">' + escHtml(focus) + '</span>') +
          '<button type="button" class="mi-crumb-x" aria-keyshortcuts="Escape" aria-label="Zoom out to ' +
          (focusGroup ? escHtml(focus) : "all sectors") + ' (Esc)">×</button></span>';
      } else txt = "";
      /* only the head that is showing carries them: the other head is only
         faded, and buttons in it would still be stops for the keyboard */
      notes.forEach(n => { n.querySelector(".mi-note-txt").innerHTML = ((n.id === p + "Note4") === (step === 4)) ? txt : ""; });
      syncLive();
    }
    /* what the map is showing, said for a reader who cannot see it - only
       when it changes, so the line is not read twice for one move */
    const liveEl = document.getElementById(p + "Live");
    const sectorCount = new Set(industryData.map(d => d.sector)).size;
    const mapTitleOf = () => step === 4 ? "All industries, by tier" : step === 6 || step === 3 ? "Most specialized tradable industries" : step === 7 || step === 5 ? "The tradable industries" : "All industries";
    function syncLive(note){
      if (!liveEl) return;
      const gRow = focusGroup ? industryData.find(d => d.group === focusGroup) : null;
      const zoomed = gRow ? (gRow.groupShort || gRow.groupName) : focus;
      let said;
      if (step === 6 || step === 3){
        said = "A ranking of the most specialized tradable industries";
      } else if (view === "alt"){
        said = barListAll.length + " industries as bars, ordered by " + (barSort === "jobs" ? "jobs" : "complexity");
      } else {
        /* counted at the map's grain: the industries, or the groups,
           subsectors or sectors they are rolled up into */
        const rows = mapLayout ? mapLayout.rows : rowsAll(), grain = effGrain();
        const n = grain === 6 ? rows.length
          : new Set(rows.map(r => grain === 4 ? r.group : grain === 3 ? r.sub : r.sector)).size;
        said = n + " " + grainWordAt(grain, n) + " shown in the map" + (step === 4 ? ", in three tiers by tradability" : "");
      }
      if (zoomed) said += ", zoomed into " + zoomed;
      if (secOn) said += ", " + secOn.size + " of " + sectorCount + " sectors";
      if (tierOn && !tierOn.every(Boolean)) said += ", " + tierOn.map((on, k) => on ? TIER_NAMES[k] : null).filter(Boolean).join(" and ") + " only";
      if (colorBy === "complexity") said += ", coloured by complexity";
      if (note) said += note;
      if (liveEl.textContent !== said) liveEl.textContent = said;
      if (svgEl) svgEl.setAttribute("aria-label", mapTitleOf());
      fig.setAttribute("aria-label", mapTitleOf());
    }
    notes.forEach(n => on(n, "click", ev => {
      const b = ev.target.closest("[data-zoom], .mi-crumb-x"); if (!b) return;
      const byKey = ev.detail === 0;
      if (b.classList.contains("mi-crumb-x")) zoomOut(byKey);
      else if (b.dataset.zoom === "all") setFocus(null, null, byKey);
      else setFocus(focus, null, byKey);
    }));

    /* ---- what the map shows, as a table, over the map: its cells at the
       level it is tiled at, largest first, with the readings the card
       carries and nothing the page does not show ---- */
    const tableHost = document.getElementById(p + "Table");
    /* the word that opens the table stands at the map's top right corner, on
       the line the crumbs take when the reader has zoomed - the note of the
       beat showing - and travels between the two map beats' notes. The
       table itself opens over the map, which gives up height to it. */
    const tableBtn = document.getElementById(p + "TableBtn") || (tableHost && tableHost.querySelector(".mi-table-btn"));
    const seatTableBtn = i => {
      const note = document.getElementById(p + (i === 4 ? "Note4" : "Note"));
      if (tableBtn && note && (i === 0 || i === 4) && tableBtn.parentNode !== note) note.appendChild(tableBtn);
    };
    let tableOpen = false;
    function syncTable(){
      if (!tableHost) return;
      const btn = tableBtn, wrapT = tableHost.querySelector(".mi-table-wrap");
      const on = tableOpen && !!mapLayout;
      wrapT.hidden = !on;
      btn.setAttribute("aria-expanded", String(on));
      btn.querySelector(".mi-table-btn-txt").textContent = on ? "Hide table" : "Show as table";
      fig.classList.toggle("has-table", on);
      if (!on){ wrapT.innerHTML = ""; return; }
      const td = (v, cls) => '<td' + (cls ? ' class="' + cls + '"' : '') + '>' + v + '</td>';
      const th = (t, cls) => '<th scope="col"' + (cls ? ' class="' + cls + '"' : '') + '>' + t + '</th>';
      /* complexity as the card draws it: the five diamonds and the score,
         with the step said in words for a screen reader */
      const cx = pci => {
        const b = cxBinOf(pci);
        if (b == null) return td('<span class="mi-tbl-none">Not measured</span>', "nw");
        let d = '<span class="mi-tbl-dia" aria-hidden="true">';
        for (let k = 0; k < 5; k++) d += '<i' + (k <= b ? ' class="is-on"' : '') + '></i>';
        return td('<span class="mi-tbl-cx">' + d + '</span><span class="mi-tbl-cxval">' + pci.toFixed(2) +
          '</span><span class="mi-sr">step ' + (b + 1) + ' of 5, ' + CX_WORDS[b] + '</span></span>', "nw");
      };
      const grain = mapLayout.grain || 6;
      let n, head, body;
      if (grain === 6){
        /* the industries, with what the card says of each; tradability is
           the second beat's reading, so the first beat's table leaves it out */
        const showTier = step !== 0;
        const rows = mapLayout.rows.slice().sort((a, b) => b.employ - a.employ);
        n = rows.length;
        head = th("Industry") + th("Sector") + (showTier ? th("Tradability") : "") +
          th("Jobs", "num") + th("Share of metro jobs", "num") + th("Complexity");
        body = rows.map(r => '<tr><th scope="row">' + escHtml(r.short || r.name) + '</th>' +
          td(escHtml(r.sector)) + (showTier ? td(TIER_WORDS[r.tier], "nw") : "") +
          td(fmtJobsFull(r.employ), "num") + td(fmtShare(r.employ / jobsTotal), "num") +
          cx(r.pci) + '</tr>').join("");
      } else {
        /* a coarser map is listed at its own level - the groups, or the
           sectors - each row what its block's card says: how many
           industries it holds, its jobs and share, and its complexity,
           the industries' weighted by their jobs */
        const byGroup = grain === 4, by = new Map();
        mapLayout.rows.forEach(r => {
          const k = byGroup ? r.group : r.sector;
          let a = by.get(k);
          if (!a){ a = { name: byGroup ? (r.groupShort || r.groupName) : r.sector, sector: r.sector, jobs: 0, n: 0, pci: 0, pciJobs: 0 }; by.set(k, a); }
          a.jobs += r.employ; a.n++;
          if (r.pci != null && r.employ > 0){ a.pci += r.pci * r.employ; a.pciJobs += r.employ; }
        });
        const rows = Array.from(by.values()).sort((a, b) => b.jobs - a.jobs);
        n = rows.length;
        head = th(byGroup ? "Industry group" : "Sector") + (byGroup ? th("Sector") : "") + th("Industries", "num") +
          th("Jobs", "num") + th("Share of metro jobs", "num") + th("Complexity");
        body = rows.map(a => '<tr><th scope="row">' + escHtml(a.name) + '</th>' +
          (byGroup ? td(escHtml(a.sector)) : "") + td(String(a.n), "num") +
          td(fmtJobsFull(a.jobs), "num") + td(fmtShare(a.jobs / jobsTotal), "num") +
          cx(a.pciJobs > 0 ? a.pci / a.pciJobs : null) + '</tr>').join("");
      }
      wrapT.innerHTML = '<table class="mi-tbl"><caption class="mi-sr">' + n + ' ' + grainWordAt(grain, n) +
        ' shown in the map, largest first</caption><thead><tr>' + head + '</tr></thead><tbody>' + body + '</tbody></table>';
    }
    if (tableHost && tableBtn) on(tableBtn, "click", () => {
      tableOpen = !tableOpen; syncTable();
    });
    seatTableBtn(step);

    /* the map is tiled at the width it is drawn at: measured when the
       figure comes on screen and again whenever that width changes, and
       its labels fitted again once the page's face has loaded */
    /* a chart's rows cannot hold the type under about 700px of drawing (the
       bars stand 17 units apart), so in a frame narrower than that the
       bars and the ranking keep that width and pan inside the frame: the
       stylesheet does it, off this flag */
    const PAN_MIN = 704;
    const syncPan = () => {
      const w = el.parentNode ? el.parentNode.clientWidth : 0, v = w && w < PAN_MIN ? "1" : "";
      if ((fig.dataset.pan || "") !== v) fig.dataset.pan = v;
    };
    /* the scale, settled without painting. The scale first: the stylesheet
       sizes the charts' type from it, the bands and the tilings follow it,
       and the gutters are fitted to that type. Says whether it moved. */
    settleScaleRef = () => {
      syncPan();
      const s2 = measureS();
      if (!s2 || Math.abs(s2 - S) < 1e-4) return false;
      S = s2; tellScale(); fitBandRef(); invalidateMaps(); drawCards(false);
      return true;
    };
    /* the gutters follow a change of scale once it has stopped moving:
       refitting them redraws all four charts, which every step of a
       dragged window edge cannot afford; meanwhile the type itself has
       already taken its size from the stylesheet */
    let refitT = null;
    const scheduleRefit = () => {
      clearTimeout(refitT);
      refitT = setTimeout(() => { if (!dead && refitGutters() && step >= 0) paint(step, false); }, 150);
    };
    disposers.push(() => clearTimeout(refitT));
    const remeasure = () => {
      const moved = settleScaleRef();
      /* gutters fitted while the page was still hidden were fitted blind,
         on a canvas: the first tick with the figure on screen fits them
         to the page's own measure, at once */
      const blind = /blind/.test(gutSig);
      const refit = blind && refitGutters();
      if (moved && !blind) scheduleRefit();
      if (!moved){ if (refit && step >= 0) paint(step, false); return; }
      fitPicks(fig);                                    /* the blanks, once the figure has a width to measure in */
      if (step >= 0 && (view === "map" || refit)) paint(step, false);
    };
    if (window.ResizeObserver){ const ro = new ResizeObserver(remeasure); ro.observe(el); if (el.parentNode) ro.observe(el.parentNode); disposers.push(() => ro.disconnect()); }
    on(window, "resize", remeasure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => {
      if (dead) return;
      clearMapMeasure();
      /* the names were measured in whatever face stood in for the page's */
      refitGutters(true);
      if (step >= 0) paint(step, false);
    });


    /* ---- the sector key, which is also the map's filter and its zoom ----
       Every sector, in the reference's fixed order. A click on a name takes
       its sector out of the map, and the map is tiled again over the rest;
       a click on the last one showing brings them all back. "only", which
       appears on hover, zooms into that sector, and over the sector zoomed
       into it reads "all" and zooms back out. Pointing at an entry outlines
       the sector's block on the map. */
    const key = document.getElementById(p + "SectorKey");
    let syncKey = () => {};
    if (key){
      const order = SECTOR_KEYS.map(s => s.label).filter(l => industryData.some(d => d.sector === l));
      key.innerHTML = order.map((sec, i) =>
        '<li class="sk-item"><button type="button" class="sk-sec" data-si="' + i + '" aria-pressed="true" style="--sw:' +
        (sectorColors[sec] || "#ccc") + '"><i class="sk-sw"></i><span class="sk-name">' + escHtml(sec) + '</span></button>' +
        '<span class="sk-verbs"><button type="button" class="sk-hide" data-si="' + i + '">Hide</button>' +
        '<span class="sk-dot" aria-hidden="true">&middot;</span>' +
        '<button type="button" class="sk-only" data-si="' + i + '" aria-label="Show only ' + escHtml(sec) + '">Only</button></span></li>').join("") +
        '<li class="sk-item sk-item--reset"><button type="button" class="sk-reset" hidden>Show all</button></li>';
      const resetBtn = key.querySelector(".sk-reset");
      const items = [].slice.call(key.querySelectorAll(".sk-sec"));
      const onlys = [].slice.call(key.querySelectorAll(".sk-only"));
      const hides = [].slice.call(key.querySelectorAll(".sk-hide"));
      /* the chart's titles must not still say every industry while the map
         is showing some of them: the two map beats' titles in the row, and
         the sentence's leads for the same beats. Each keeps the title as
         authored on the element, since a rebuild must not take a filter's
         title left by the last build for the default. */
      const titleEls = [".mi-title-all .mcl-dir", ".mi-title-tier .mcl-dir", ".mi-s-all", ".mi-s-tier"]
        .map(sel => document.querySelector("#" + p + "View " + sel)).filter(Boolean);
      titleEls.forEach(el => { if (!el.dataset.title) el.dataset.title = el.textContent; });
      /* zoomed into a sector, that sector alone is showing */
      const shownSec = sec => focus ? sec === focus : (!secOn || secOn.has(sec));
      const soloSec = sec => order.every(o => o === sec || !shownSec(o));
      syncKey = function(){
        items.forEach((b, i) => {
          const on = shownSec(order[i]);
          b.classList.toggle("is-off", !on);
          b.setAttribute("aria-pressed", String(on));
        });
        /* the verbs say what a click will do, in the state the sector is in:
           the last one showing cannot be hidden, so its one verb brings all
           back and "Only" stands down */
        hides.forEach((b, i) => {
          const sec = order[i], on = shownSec(sec), solo = on && soloSec(sec);
          b.textContent = solo ? "Show all" : on ? "Hide" : "Bring back";
          b.setAttribute("aria-label", solo ? "Show all sectors" : (on ? "Hide " : "Bring back ") + sec);
          b.closest(".sk-item").classList.toggle("is-solo", solo);
        });
        onlys.forEach((b, i) => b.setAttribute("aria-label", "Show only " + order[i]));
        if (resetBtn) resetBtn.hidden = !(secFiltered() || focus);
        /* the titles stay as authored whatever is hidden or zoomed into:
           the key and the crumbs say what the map is showing, and a title
           that changed under the reader read as a different chart */
        titleEls.forEach(el => { if (el.textContent !== el.dataset.title) el.textContent = el.dataset.title; });
      };
      syncKeyRef = syncKey;
      const dropFocus = () => { focus = null; focusGroup = null; fig.dataset.focus = ""; };
      /* the filter moves the map and the bars beside it */
      function applySec(next){
        if (next && !next.size) return;                 /* an empty map answers nothing */
        secOn = (next && next.size === order.length) ? null : next;
        if (focus && !secShown({ sector: focus })) dropFocus();
        rebuildSecGeo();
        barListAll = tierList();
        reBarRank();
        drawBars(barListAll, gBarsAll);
        hideMapTip(true);
        syncKey();
        if (step >= 0) paint(step, !reduced());
      }
      resetSec = () => { dropFocus(); applySec(null); };
      const allSet = () => new Set(order);
      /* the two things that can be done with a sector, whichever control
         asks: take it out of the map or bring it back, and keep only it */
      const toggleSec = sec => {
        if (shownSec(sec) && soloSec(sec)) resetSec();
        else if (focus){
          /* zoomed into one sector, a click on another shows the two together */
          const next = new Set([focus, sec]);
          dropFocus();
          applySec(next);
        } else {
          const next = secOn ? new Set(secOn) : allSet();
          if (next.has(sec)) next.delete(sec); else next.add(sec);
          applySec(next);
        }
      };
      /* "only" is the zoom, on both map beats: the whole map re-tiles over
         the sector, the tiers keep their grounds and show the sector's work
         in each, and the zoom travels between the two */
      const onlySec = sec => {
        if (shownSec(sec) && soloSec(sec)){ resetSec(); return; }
        /* zooming into a sector that is off the map: it comes back into the
           filter first, or there would be nothing to zoom to */
        if (!secShown({ sector: sec })){
          const next = new Set(secOn); next.add(sec);
          applySec(next);
        }
        setFocus(sec, null);
      };

      /* ---- opt-2 of the key study: the entry's card ----
         Hovering or focusing an entry opens a small card over it: the
         sector's colour and name, what it is in the metro - its share of
         the jobs, the jobs, how many industries - and its verbs as
         buttons: "Hide" (or "Bring back"; "Show all" alone for the last
         one showing, since it cannot be hidden) and "Keep only". The card
         stays while the pointer or the focus is in it; Tab from the entry
         goes into the card, and out of it to whatever follows the entry.
         The entry's own click still switches the sector. The inline verbs
         of opt-1 stand down here, the card's buttons taking their place.
         Under opt-1 none of this runs. */
      const cardMode = () => fig.dataset.key === "card";
      const lis = [].slice.call(key.querySelectorAll(".sk-item:not(.sk-item--reset)"));
      let tipEl = fig.querySelector(":scope > .sk-tip");
      if (!tipEl){
        tipEl = document.createElement("div"); tipEl.className = "sk-tip"; fig.appendChild(tipEl);
      }
      tipEl.id = p + "KeyTip";
      tipEl.setAttribute("role", "group");
      tipEl.hidden = true;
      /* what each sector is in the metro, for the card's facts line: the
         whole year's rows, whatever the map is showing */
      const totalJobs = industryData.reduce((a, d) => a + (d.employ || 0), 0);
      const secFacts = new Map(order.map(sec => {
        const rows = industryData.filter(d => d.sector === sec);
        const jobs = rows.reduce((a, d) => a + (d.employ || 0), 0);
        return [sec, { jobs, n: rows.length, share: totalJobs ? jobs / totalJobs : 0 }];
      }));
      let hideT = null, quiet = false;
      disposers.push(() => clearTimeout(hideT));
      /* silent: the caller is placing focus itself, so the card must not */
      function hideTip(silent){
        clearTimeout(hideT);
        if (tipEl.hidden) return false;
        const i = +tipEl.dataset.si;
        const inCard = tipEl.contains(document.activeElement);
        tipEl.hidden = true;
        lis.forEach(li => { li.classList.remove("is-open"); li.querySelector(".sk-sec").removeAttribute("aria-describedby"); });
        /* focus in the card when it closes goes back to its entry, not to
           the page - quietly, or the entry's focus would open the card again */
        if (inCard && !silent && items[i]){ quiet = true; items[i].focus({ preventScroll: true }); quiet = false; }
        return true;
      }
      /* the pointer or the focus leaving an entry: the card waits a moment,
         long enough for either to arrive in the card itself. Focus a
         keyboard put in the card holds it; focus a click left there does not. */
      const heldByKey = () => tipEl.contains(document.activeElement) && document.activeElement.matches(":focus-visible");
      const laterHide = () => {
        clearTimeout(hideT);
        hideT = setTimeout(() => { if (!tipEl.matches(":hover") && !heldByKey()) hideTip(); }, 160);
      };
      hideKeyTip = hideTip;
      keyTipIsOpen = () => !tipEl.hidden;
      /* keepFocus: the card is being redrawn under a reader who is in it,
         so the button they used, or its successor, takes the focus back */
      function showTip(b, keepFocus){
        if (!cardMode()) return;
        clearTimeout(hideT);
        const i = +b.dataset.si, sec = order[i];
        const shown = shownSec(sec), solo = shown && soloSec(sec);
        const f = secFacts.get(sec);
        const was = tipEl.contains(document.activeElement) ? document.activeElement.dataset.act : null;
        tipEl.dataset.si = i;
        tipEl.innerHTML =
          '<span class="skt-name"><i class="skt-sw" style="--sw:' + (sectorColors[sec] || "#ccc") + '"></i><b>' + escHtml(sec) + '</b></span>' +
          /* the same rows, in the same order and dress, as the cell's card */
          '<dl class="skt-grid" id="' + p + 'KeyHint">' +
            '<dt>Industries</dt><dd>' + f.n + '</dd>' +
            '<dt>Jobs</dt><dd>' + fmtJobsFull(f.jobs) + '</dd>' +
            '<dt>Share of metro jobs</dt><dd>' + (f.share * 100).toFixed(2) + '%</dd>' +
          '</dl>' +
          '<span class="skt-verbs">' +
            (solo
              ? '<button type="button" class="skt-btn" data-act="all">Show all</button>'
              : '<button type="button" class="skt-btn" data-act="hide">' + (shown ? 'Hide' : 'Bring back') + '</button>' +
                '<button type="button" class="skt-btn" data-act="only">Keep only</button>') +
          '</span>';
        tipEl.hidden = false;
        lis.forEach((li, k) => {
          li.classList.toggle("is-open", k === i);
          /* the card describes its entry, so a reader arriving by keyboard hears what the sector is */
          const sb = li.querySelector(".sk-sec");
          if (k === i) sb.setAttribute("aria-describedby", p + "KeyHint"); else sb.removeAttribute("aria-describedby");
        });
        const fb = fig.getBoundingClientRect(), bb = b.closest(".sk-item").getBoundingClientRect();
        const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
        const left = bb.left - fb.left + bb.width / 2 - w / 2;
        tipEl.style.left = Math.max(0, Math.min(left, Math.max(0, fb.width - w))) + "px";
        tipEl.style.top = Math.max(0, bb.top - fb.top - h - 4) + "px";
        if (keepFocus){
          const t = (was && tipEl.querySelector('[data-act="' + was + '"]')) || tipEl.querySelector("button");
          if (t) t.focus({ preventScroll: true });
        }
      }
      on(key, "click", ev => {
        if (ev.target.closest(".sk-reset")){ resetSec(); hideTip(); return; }
        const only = ev.target.closest(".sk-only");
        if (only){ onlySec(order[+only.dataset.si]); return; }
        const hideB = ev.target.closest(".sk-hide");
        if (hideB){ toggleSec(order[+hideB.dataset.si]); return; }
        const b = ev.target.closest(".sk-sec");
        if (!b) return;
        toggleSec(order[+b.dataset.si]);
        if (cardMode()) showTip(b);
      });
      /* the card's own buttons */
      on(tipEl, "click", ev => {
        const btn = ev.target.closest("[data-act]");
        if (!btn) return;
        const i = +tipEl.dataset.si, sec = order[i], act = btn.dataset.act;
        const held = tipEl.contains(document.activeElement) || ev.detail === 0;
        if (act === "hide") toggleSec(sec); else if (act === "only") onlySec(sec); else resetSec();
        showTip(items[i], held);
      });
      /* Tab walks from the entry into its card, and out of the card to
         whatever follows the entry; Shift+Tab from the card's first button
         returns to the entry */
      const tabbables = () => [].slice.call(fig.querySelectorAll('button,a[href],select,input,[tabindex]:not([tabindex="-1"])'))
        .filter(e => !tipEl.contains(e) && !e.disabled && !e.hidden && e.offsetParent !== null && !e.closest("[inert]"));
      on(key, "keydown", ev => {
        if (ev.key !== "Tab" || ev.shiftKey || !cardMode() || tipEl.hidden) return;
        const b = ev.target.closest(".sk-sec");
        if (!b || +b.dataset.si !== +tipEl.dataset.si) return;
        const first = tipEl.querySelector("button");
        if (!first) return;
        ev.preventDefault(); first.focus({ preventScroll: true });
      });
      on(tipEl, "keydown", ev => {
        if (ev.key !== "Tab") return;
        const btns = [].slice.call(tipEl.querySelectorAll("button")), at = btns.indexOf(document.activeElement);
        const i = +tipEl.dataset.si;
        if (ev.shiftKey && at === 0){ ev.preventDefault(); items[i].focus({ preventScroll: true }); return; }
        if (!ev.shiftKey && at === btns.length - 1){
          ev.preventDefault();
          const list = tabbables(), k = list.indexOf(items[i]), next = k >= 0 ? list[k + 1] : null;
          hideTip(true);
          if (next) next.focus({ preventScroll: true });
        }
      });
      on(tipEl, "mouseenter", () => {
        clearTimeout(hideT);
        const sec = order[+tipEl.dataset.si];
        if (sec && shownSec(sec) && view === "map" && mapLayout && !pinned) showOutline(sectorBlocks([sec]), 1.5);
      });
      on(tipEl, "mouseleave", () => { if (!pinned) clearOutline(); laterHide(); });
      on(tipEl, "focusout", () => laterHide());
      /* pointing at an entry outlines its block on the map - and, under
         opt-2, opens its card */
      lis.forEach((li, i) => {
        const sec = order[i], b = li.querySelector(".sk-sec");
        const lit = () => { if (shownSec(sec) && view === "map" && mapLayout && !pinned) showOutline(sectorBlocks([sec]), 1.5); };
        const unlit = () => { if (!pinned) clearOutline(); };
        on(li, "mouseenter", () => { lit(); if (cardMode()) showTip(b); });
        on(li, "mouseleave", () => { unlit(); if (cardMode()) laterHide(); });
        on(li, "focusin", () => { lit(); if (cardMode() && !quiet && document.activeElement === b) showTip(b); });
        on(li, "focusout", () => { unlit(); if (cardMode()) laterHide(); });
      });
      syncKey();
    }

    /* ---- the tooltip, reading whatever the figure is currently showing ----
       The same cells mean different things state to state, so the card names
       the measure in play rather than always reciting jobs. */
    const wrap = el.closest(".tradable-viz-wrapper");
    const tip = document.getElementById(p + "Tip");
    if (wrap && tip){
      const cellOf = (k, v) => '<dt>' + k + '</dt><dd>' + v + '</dd>';
      const pct = v => v.toFixed(2) + "%";
      /* the number the ranking is ordered by, given the size it is ordered by */
      const tipLead = r => '<div class="tip-lead"><b>' + r.rca.toFixed(1) +
        '\u00d7</b><span>more concentrated here than in<br>a typical US metro</span></div>';
      /* complexity reads the same here as it does in the chart's own column -
         the five steps - with the score beside them, since a card has room
         for the number the column has no space to carry */
      const cxCell = name => {
        if (pciByName.get(name) == null)
          return '<dd class="tip-cx-cell"><em>not measured</em></dd>';
        const on = cxBin(name);
        let dots = '<span class="tip-cx" aria-hidden="true">';
        for (let k = 0; k < 5; k++) dots += '<i' + (k <= on ? ' class="is-on"' : '') + '></i>';
        return '<dd class="tip-cx-cell">' + dots + '</span>' +
          '<span class="tip-cx-val">' + pciNumOf(name).toFixed(2) + '</span>' +
          '<span class="tip-sr">step ' + (on + 1) + ' of 5, ' + CX_WORDS[on] + '</span></dd>';
      };
      let hot = null, hotRow = null;
      const cool = () => {
        if (pinned) return;                   /* the map's pinned card stays */
        tip.hidden = true;
        hiRect.style("opacity", 0);
        if (hotRow){ hotRow.classList.remove("is-hot"); hotRow = null; }
        if (hot) d3.select(hot).style("stroke", "#1a2226").style("stroke", null).style("stroke-width", null);
        hot = null;
      };
      d3.select(el).on("mouseleave.mitip", cool);
      cell.on("mouseenter", function(ev, d){
        cool();
        const r = this.querySelector(".mi-rect");
        hot = r;
        /* one card, whatever the figure is showing: the industry says the
           same things about itself on every beat, and a reader who learned
           where to look on one beat finds it in the same place on the next.
           The beat only adds - the ranking puts its own reading on top. */
        const rrow = step === 6 ? d.row2 : d.row;
        const onRank = (step === 3 || step === 6) && !!rrow;
        const body = (onRank ? tipLead(rrow) : "") +
          '<dl class="tip-grid">' +
          cellOf("Jobs", Math.round(d.employ).toLocaleString()) +
          cellOf("Share of metro jobs", pct(d.employ / jobsTotal * 100)) +
          '<dt>Complexity</dt>' + cxCell(d.name) +
          cellOf("Tradability", tierLabel(d)) +
          (onRank ? cellOf("Peer metros average", rrow.peerAvg.toFixed(1) + "\u00d7") : "") +
          '</dl>';
        const labRow = rrow;
        const rank = (step === 6 && R2.rankIdx.has(d.name) && R2.rankIdx.get(d.name) < 3)
          ? '<span class="tip-rank">' + (R2.rankIdx.get(d.name) + 1) + '</span>' : '';
        /* the sector belongs on every card: it is what the colour under the
           cursor means, and on the ranking it is the one thing the row does
           not already say */
        const head = '<div class="tip-head"><strong>' + rank +
          (labRow ? labRow.label : d.name) + '</strong>' +
          '<span class="tip-sector"><i style="background:' + sectorColors[d.sector] + '"></i>' +
          d.sector + '</span></div>';
        tip.className = "rca-tip";
        tip.innerHTML = head + body;
        tip.hidden = false;
        cursorTipPos(ev, wrap, tip);
        this.parentNode.appendChild(this);          // hovered mark to the front
        d3.select(r).style("stroke", "#1a2226").style("stroke-width", 2.5);
        /* coming in off the bar rather than the band, light the band anyway */
        if (!hotRow && (step === 3 || step === 6)){
          const R = step === 6 ? R2 : R1;
          const g = R && R.row && R.row.filter(x => x.name === d.name).node();
          if (g){
            hotRow = g; g.classList.add("is-hot");
            hiRect.attr("y", rowY(R.pos.get(d.name)) - RH / 2).style("opacity", 1);
          }
        }
      })
      .on("mousemove", function(ev){ cursorTipPos(ev, wrap, tip); })
      .on("mouseleave", cool);

      /* the prose points at the chart. A phrase in the lede naming a sector
         stands the rest of the mix down, so the reader does not have to
         translate "manufacturing" into a colour before they can find it.
         Hover and focus for pointer and keyboard; click as well, because a
         phone has no hover and the reference this follows forgets that. */
      const hlSpans = [].slice.call(document.querySelectorAll(".mi-hl"));
      hlSpansRef = hlSpans;
      /* each beat points at what it is about: the mix beat names sectors, the
         tradability beat names one of the three clusters, and the ranking
         names industries outright */
      const hlRows = () => [R1, R2].filter(R => R && R.row);
      const clearHl = () => {
        cell.classed("is-dim", false).classed("is-mute", false);
        gMapCells.selectAll("g.mi-mcell").classed("is-dim", false).classed("is-mute", false);
        gMapFrames.selectAll("g.mi-secg").classed("is-dim", false).classed("is-mute", false);
        /* a muted label was repainted, so it is put back in the ink the cell
           wrote it in rather than guessed at */
        cell.selectAll(".mi-lab,.mi-pct")
          .style("fill", function(){ return this.getAttribute("data-ink"); });
        gMapCells.selectAll("text.mi-mlab")
          .attr("fill", function(){ return this.getAttribute("data-ink"); });
        gHlFrame.selectAll("rect").remove();
        hlRows().forEach(R => R.row.classed("is-lit", false));
        gLit.selectAll("rect").remove();
        hlSpans.forEach(x => x.classList.remove("is-lit"));
      };
      /* where a sector's own block is on the beat showing: one block on the
         whole mix, one per tier on the clusters. Nothing outside the maps -
         under the bars a sector is scattered down the rows, and a frame
         round scattered rows is not a frame */
      const hlSectorBoxes = want => view !== "map" ? [] : sectorBlocks(want);
      /* the rest of the mix turns to one grey rather than fading away: every
         block keeps its place and its size, and colour alone says which is
         the one being named */
      const muteOthers = want => {
        const off = d => want.indexOf(d.sector) < 0;
        cell.classed("is-mute", off);
        /* still grey, still plainly not the sector being named, but dark
           enough on that grey to be read: at #9aa3a6 it was 2.1 to 1 */
        cell.filter(off).selectAll(".mi-lab,.mi-pct").style("fill", "#60686b");
        const offM = c => want.indexOf(c.cell.sector) < 0;
        gMapCells.selectAll("g.mi-mcell").classed("is-mute", offM)
          .filter(offM).select("text.mi-mlab").attr("fill", "#60686b");
        gMapFrames.selectAll("g.mi-secg").classed("is-mute", b => want.indexOf(b.sector) < 0);
      };
      const hlStep = span => span.dataset.on || "0";
      /* the band behind a lit row has to be drawn under the cells, since the
         ranking's rows paint over them - the same reason the hover band lives
         in this layer */
      const litBands = (R, keep) => {
        const ys = [];
        R.row.each(function(d){
          if (!keep.has(d.name)) return;
          const m = /translate\(0,\s*([-\d.]+)\)/.exec(this.getAttribute("transform") || "");
          if (m) ys.push(+m[1]);
        });
        gLit.selectAll("rect").data(ys).join("rect")
          .attr("x", 0).attr("width", MI_W).attr("height", RH).attr("y", y => y - RH / 2);
      };
      const litHl = span => {
        const ds = span.dataset;
        if (ds.sector){
          const want = ds.sector.split("|").filter(n => !secOn || secOn.has(n));
          /* the sector the phrase names is off the map: there is nothing to
             point at, and dimming or greying every cell would say there is */
          if (!want.length){ span.classList.add("is-lit"); return; }
          if (hlMode === "dim"){
            cell.classed("is-dim", d => want.indexOf(d.sector) < 0);
            gMapCells.selectAll("g.mi-mcell").classed("is-dim", c => want.indexOf(c.cell.sector) < 0);
            gMapFrames.selectAll("g.mi-secg").classed("is-dim", b => want.indexOf(b.sector) < 0);
          } else if (hlMode === "mute"){
            muteOthers(want);
          } else {
            /* the frame leaves the mix exactly as it was and draws a line
               round the block being named; where there is no block to draw
               round, the rest turns grey instead */
            const boxes = hlSectorBoxes(want);
            if (boxes.length) gHlFrame.selectAll("rect").data(boxes).join("rect")
              .attr("class", "mi-hlframe")
              .attr("x", b => b.x).attr("y", b => b.y)
              .attr("width", b => b.w).attr("height", b => b.h);
            else muteOthers(want);
          }
        } else if (ds.ind){
          /* the ranking lights what is named instead, and leaves the rest alone */
          const keep = new Set(ds.ind.split("|"));
          const named = d => keep.has(d.name) || keep.has(d.title) || keep.has(d.full) || keep.has(d.short);
          const R = hlStep(span) === "3" ? R1 : R2;
          if (R && R.row){
            const keepNames = new Set(); R.row.each(d => { if (named(d)) keepNames.add(d.name); });
            litBands(R, keepNames); R.row.classed("is-lit", d => keepNames.has(d.name));
          }
        }
        span.classList.add("is-lit");
      };
      hlSpans.forEach(span => {
        const light = () => { if (fig.dataset.step !== hlStep(span)) return; clearHl(); litHl(span); };
        /* a phrase that points at the chart is a control: a screen reader
           says so, and Enter or Space does what a click does, without
           Space scrolling the page */
        span.setAttribute("role", "button");
        on(span, "keydown", ev => { if (ev.key === "Enter" || ev.key === " "){ ev.preventDefault(); span.click(); } });
        on(span, "mouseenter", light);
        on(span, "focus", light);
        on(span, "mouseleave", clearHl);
        on(span, "blur", clearHl);
        on(span, "click", () => {
          if (span.classList.contains("is-lit")) clearHl(); else light();
        });
      });
      /* a phrase naming a sector wears the sector's colour block, as the key
         does, so the words and the map share one mark */
      const hlSwatch = () => hlSpans.forEach(span => {
        if (!span.dataset.sector) return;
        span.classList.add("mi-hl-sec");
        span.style.setProperty("--sw", sectorColors[span.dataset.sector.split("|")[0]] || "#ccc");
      });
      hlSwatch();
      hlSwatchRef = hlSwatch;
      /* leaving the beat must not leave the mix half dimmed */
      clearHighlight = clearHl;

      /* the ranking rows carry the same card, raised from the row rather than
         the bar — hovering a name or a jobs count is hovering the industry */
      function wireRows(R){
        if (!R || !R.row) return;
        R.row.style("cursor", "default")
          .on("mouseenter.mirow", function(ev, d){
            /* the cell's handler opens with cool(), so the band has to be lit
               after it has run, not before — and it lights a row of its own,
               which this one replaces */
            const cellG = cell.filter(c => c.name === d.name).node();
            if (cellG) cellG.dispatchEvent(new MouseEvent("mouseenter"));
            else cool();
            if (hotRow) hotRow.classList.remove("is-hot");
            hotRow = this;
            this.classList.add("is-hot");
            hiRect.attr("y", rowY(R.pos.get(d.name)) - RH / 2).style("opacity", 1);
          })
          .on("mousemove.mirow", function(ev){ cursorTipPos(ev, wrap, tip); })
          .on("mouseleave.mirow", cool);
      }
      wireRows(R1); wireRows(R2);
      wireRowsRef = wireRows;
    }

    /* a study control: three ways for a phrase in the text to point at a
       sector on the map - stand the rest down, turn the rest grey, or draw a
       line round the block being named */
    const hlOptEl = document.getElementById(p + "HlOpt");
    if (hlOptEl) on(hlOptEl, "change", () => {
      if (hlOptEl.value === hlMode) return;
      const lit = hlSpansRef && hlSpansRef.find(x => x.classList.contains("is-lit"));
      if (clearHighlight) clearHighlight();
      hlMode = hlOptEl.value;
      fig.dataset.hl = hlMode;
      /* a phrase left lit shows the new treatment at once */
      if (lit) lit.dispatchEvent(new MouseEvent("mouseenter"));
    });

    /* a study control: the sector palette as shipped (opt-1) or Paul Tol's
       muted set (opt-2), from SECTOR_PALETTES. The colours
       are read at paint by the map, the cells under it and the bars, so a
       repaint carries them; the key's swatches are set once, so they are
       set again here. The set survives a year's rebuild: sectorColors is
       one object for every build. */
    const palEl = document.getElementById(p + "Pal");
    if (palEl) on(palEl, "change", () => {
      const v = SECTOR_PALETTES[palEl.value] ? palEl.value : "house", set = SECTOR_PALETTES[v];
      if (Object.keys(set).every(k => sectorColors[k] === set[k])) return;
      Object.assign(sectorColors, set);
      fig.dataset.pal = v;
      if (key) key.querySelectorAll(".sk-sec").forEach(b => {
        const nm = b.querySelector(".sk-name"); if (!nm) return;
        b.style.setProperty("--sw", sectorColors[nm.textContent] || "#ccc");
      });
      hideMapTip(true);
      if (hlSwatchRef) hlSwatchRef();
      if (step >= 0) paint(step, !reduced());
    });

    /* a study control: the tiers' grounds as a line round each one, or as a
       light grey field under it */
    /* a study control: the sectors named on the map - opt-2 a band in a
       deeper shade of their colour with a hairline round the block, opt-3
       the name in ink on the white above the block. The tiling makes the
       room, so every tiling is stale when it changes. */
    const secNamesEl = document.getElementById(p + "SecNames");
    const setSecNames = (v, first) => {
      const mode = v === "band" || v === "gutter" ? v : "off";
      if (!first && mode === SEC_NAMES) return;
      SEC_NAMES = mode; fig.dataset.secnames = mode;
      if (first) return;
      invalidateMaps(); hideMapTip(true);
      if (step >= 0) paint(step, !reduced());
    };
    setSecNames(secNamesEl ? secNamesEl.value : SEC_NAMES, true);
    if (secNamesEl) on(secNamesEl, "change", () => setSecNames(secNamesEl.value));
    /* a study control: what a sector's block carries when the map rests at
       the sector grain; a repaint without re-tiling is enough */
    const secBlockEl = document.getElementById(p + "SecBlock");
    const setSecBlock = (v, first) => {
      const mode = SEC_BLOCK_MODES.indexOf(v) >= 0 ? v : "plain";
      if (!first && mode === SEC_BLOCK) return;
      SEC_BLOCK = mode; fig.dataset.secblock = mode;
      if (first) return;
      hideMapTip(true);
      if (step >= 0) paint(step, false);
    };
    setSecBlock(secBlockEl ? secBlockEl.value : SEC_BLOCK, true);
    if (secBlockEl) on(secBlockEl, "change", () => setSecBlock(secBlockEl.value));
    const groundEl = document.getElementById(p + "Ground");
    const setGround = v => { fig.dataset.ground = v === "grey" ? "grey" : "frame"; };
    setGround(groundEl ? groundEl.value : "frame");
    if (groundEl) on(groundEl, "change", () => setGround(groundEl.value));

    /* a study control: the head's row as labelled pairs in a paper tray, or
       as the title's own sentence with the choices as blanks in it. The
       blanks are measured once they are in the flow. */
    const rowEl = document.getElementById(p + "RowOpt");
    const setRow = v => { fig.dataset.row = v === "sentence" ? "sentence" : "tray"; fitPicks(fig); };
    setRow(rowEl ? rowEl.value : "tray");
    if (rowEl) on(rowEl, "change", () => setRow(rowEl.value));

    /* a study control: what the key's entries do - the entry is the switch
       and "only" sits beside it, or a card opens over the entry with the
       sector's figures and the two actions as buttons */
    const keyOptEl = document.getElementById(p + "KeyOpt");
    const setKeyMode = v => { fig.dataset.key = v === "card" ? "card" : "inline"; if (hideKeyTip) hideKeyTip(); };
    setKeyMode(keyOptEl ? keyOptEl.value : "inline");
    if (keyOptEl) on(keyOptEl, "change", () => setKeyMode(keyOptEl.value));

    /* one word in the head carries every study: it opens a panel of plain
       dropdowns rather than lining four sets of buttons along the row */
    const studies = document.getElementById(p + "Studies");
    if (studies){
      const sBtn = studies.querySelector(".mi-studies-btn");
      const sPanel = studies.querySelector(".mi-studies-panel");
      const setOpen = (on, toBtn) => {
        const was = !sPanel.hidden;
        sPanel.hidden = !on;
        sBtn.setAttribute("aria-expanded", String(on));
        /* closing it from inside, the word it opened from is where focus goes */
        if (!on && was && toBtn) sBtn.focus({ preventScroll: true });
      };
      on(sBtn, "click", () => setOpen(sPanel.hidden));
      on(document, "click", ev => {
        if (!sPanel.hidden && !studies.contains(ev.target)) setOpen(false);
      });
      escLayers.push({ p: 1, open: () => !sPanel.hidden, close: () => setOpen(false, true) });
    }

    /* the bars' order: the same bars, re-sorted. The set does not change,
       so the reader keeps the metro's biggest industries in view either way */
    const barSortEl = document.getElementById(p + "BarSort");
    const sSortEl = document.getElementById(p + "SSort");
    const syncBarSort = () => {
      if (barSortEl) barSortEl.querySelectorAll(".seg-btn[data-barsort]").forEach(x => {
        const on = x.dataset.barsort === barSort;
        x.classList.toggle("is-active", on);
        x.setAttribute("aria-pressed", String(on));
      });
      if (sSortEl && sSortEl.value !== barSort){ sSortEl.value = barSort; fitPick(sSortEl); }
    };
    syncBarSort();
    const applyBarSort = v => {
      if (v === barSort) return;
      barSort = v;
      syncBarSort();
      reBarRank();
      drawBars(barListAll, gBarsAll);
      paint(step, !reduced());
    };
    if (sSortEl) on(sSortEl, "change", () => { fitPick(sSortEl); applyBarSort(sSortEl.value); });
    if (barSortEl) on(barSortEl, "click", ev => {
      const b = ev.target.closest(".seg-btn[data-barsort]");
      if (!b) return;
      applyBarSort(b.dataset.barsort);
    });

    /* the arrangement control belongs to the two beats that show the whole
       mix; switching it repaints the beat in place */
    const viewEl = document.getElementById(p + "View");
    const applyView = v => {
      if (v === view) return;
      view = v;
      fig.dataset.view = view;
      syncViewCtl();
      if (opts.adminReveal && step === 0){ placeCoarse(!reduced(), true); return; }
      settleForPaint();
      if (step === 0 || step === 1 || step === 4 || step === 5 || step === 7) paint(step, !reduced());
    };
    if (viewEl) on(viewEl, "click", ev => {
      const b = ev.target.closest(".seg-btn[data-view]");
      if (b) applyView(b.dataset.view);
    });
    const sViewEl = document.getElementById(p + "SView");
    if (sViewEl) on(sViewEl, "change", () => { fitPick(sViewEl); applyView(sViewEl.value); });

    /* the grain: the NAICS level the map is tiled at, from the tray's
       buttons or the sentence's blank, both showing the one state. The
       bars stay industries, so the control shows only while the map is
       up; a group is a cell of its own only at the finest grain, so a zoom
       into a group comes back to its sector when the grain coarsens. */
    const levelEl = document.getElementById(p + "Level"), sLevelEl = document.getElementById(p + "SLevel"),
          levelSelEl = document.getElementById(p + "LevelSel");
    /* tradability is read industry by industry, so the tradable beat
       holds the map at the industry level and the level control is set
       but not offered there; setStep brings the grain back to 6 first */
    const LEVEL_LOCK_WHY = "Tradability is measured by industry, so this beat reads the map at the industry level";
    const levelLocked = () => step === 4;
    /* the reason, as a hidden note beside each form of the control for the
       held controls to point at, and as the pair's title for the pointer */
    const levelPair = levelEl && levelEl.closest(".mi-ctlpair"), sLevelHost = sLevelEl && sLevelEl.closest(".mi-s-level");
    const lockNote = (host, id) => {
      if (!host) return null;
      const n = document.createElement("span"); n.className = "mi-sr"; n.id = id; host.appendChild(n);
      disposers.push(() => n.remove());
      return n;
    };
    const levelWhy = lockNote(levelPair, p + "LevelWhy"), sLevelWhy = lockNote(sLevelHost, p + "SLevelWhy");
    const syncLevel = () => {
      const lock = levelLocked();
      [[levelWhy, levelPair], [sLevelWhy, sLevelHost]].forEach(([n, h]) => {
        if (n) n.textContent = lock ? LEVEL_LOCK_WHY : "";
        if (!h) return;
        if (lock) h.setAttribute("title", LEVEL_LOCK_WHY); else h.removeAttribute("title");
      });
      /* set but not offered: the control stays where the keyboard and a
         screen reader can reach it, marked as held and pointing at the why */
      const held = (el, why) => {
        if (lock){ el.setAttribute("aria-disabled", "true"); if (why) el.setAttribute("aria-describedby", why.id); }
        else { el.removeAttribute("aria-disabled"); el.removeAttribute("aria-describedby"); }
      };
      if (levelEl){
        const onTile = levelEl.querySelector('.seg-btn[data-level="' + MAP_GRAIN + '"]');
        levelEl.querySelectorAll(".seg-btn[data-level]").forEach(x => {
          const onIt = +x.dataset.level === MAP_GRAIN;
          x.classList.toggle("is-active", onIt); x.setAttribute("aria-pressed", String(onIt));
          /* the other levels are out of reach; the chosen tile is the
             group's stop. Focus on a tile going out of reach moves to it
             first, or the keyboard would be dropped to the page */
          const off = lock && !onIt;
          if (off && x === document.activeElement && onTile) onTile.focus({ preventScroll: true });
          x.disabled = off;
          if (onIt) held(x, levelWhy); else { x.removeAttribute("aria-disabled"); x.removeAttribute("aria-describedby"); }
        });
      }
      if (levelSelEl){ if (+levelSelEl.value !== MAP_GRAIN) levelSelEl.value = String(MAP_GRAIN); held(levelSelEl, levelWhy); }
      if (sLevelEl){ if (+sLevelEl.value !== MAP_GRAIN) sLevelEl.value = String(MAP_GRAIN); held(sLevelEl, sLevelWhy); fitPick(sLevelEl); }
      fig.dataset.level = String(MAP_GRAIN);
      fig.dataset.levellock = lock ? "1" : "";
    };
    /* a held blank takes no key that would change it; a change that gets
       through all the same (a pick from a menu opened another way) is put
       back by applyLevel */
    const holdKeys = ev => {
      if (levelLocked() && !ev.metaKey && !ev.ctrlKey && ev.key !== "Tab" && ev.key !== "Escape") ev.preventDefault();
    };
    const applyLevel = g => {
      if (levelLocked()){ syncLevel(); return; }
      g = [6, 4, 2].indexOf(+g) >= 0 ? +g : 6;   /* the 3-digit subsectors are tiled too, but not offered */
      if (g === MAP_GRAIN) return;
      MAP_GRAIN = g;
      invalidateMaps(); hideMapTip(true);
      syncLevel();
      /* the level is where the map starts, so choosing one goes back to
         the start; from there the zoom walks down as before */
      if (focus) setFocus(null, null);
      else if (step >= 0) paint(step, !reduced());
      syncLive();
    };
    syncLevel();
    if (levelEl) on(levelEl, "click", ev => { const b = ev.target.closest(".seg-btn[data-level]"); if (b) applyLevel(b.dataset.level); });
    if (levelSelEl){ on(levelSelEl, "change", () => applyLevel(levelSelEl.value)); on(levelSelEl, "keydown", holdKeys); }
    if (sLevelEl){ on(sLevelEl, "change", () => { fitPick(sLevelEl); applyLevel(sLevelEl.value); }); on(sLevelEl, "keydown", holdKeys); }
    /* a study control: the level as a toggle between the sectors and the
       industries (opt-1), or as a menu of the three grains (opt-2). The
       toggle has no 4-digit, so going back to it from a map at 4 digits
       returns the map to the industries. */
    const levelOptEl = document.getElementById(p + "LevelOpt");
    const setLevelCtl = (v, first) => {
      const mode = v === "menu" ? "menu" : "toggle";
      fig.dataset.levelctl = mode;
      if (!first && mode === "toggle" && MAP_GRAIN === 4) applyLevel(6);
    };
    setLevelCtl(levelOptEl ? levelOptEl.value : "toggle", true);
    if (levelOptEl) on(levelOptEl, "change", () => setLevelCtl(levelOptEl.value));

    /* ---- "Ask the chart": questions in a beat's text that set the figure ----
       Each beat's chart answers more than its paragraph says, under some
       setting of the controls most readers never try. A question row in
       the text sets that view and opens a short answer under itself. The
       rules that keep it from confusing anyone: one question at a time; a
       question is the beat's own view plus its settings, never stacked on
       what the reader had; it moves the real controls, and the ones it
       moved are marked; the answer stands only while the chart shows it;
       one way back - the row itself, pressed again; and leaving the beat
       puts the beat back. */
    const ASKS = {
      b1q1: { step: 0, set: { view: "alt", barSort: "cx" }, marks: "view barsort" },
      b1q2: { step: 0, set: { colorBy: "complexity" }, marks: "color" },
      b2q1: { step: 4, set: { colorBy: "complexity" }, marks: "color" },
      b2q2: { step: 4, set: { tiers: [true, false, false] }, marks: "" },
      b3q1: { step: 6, set: { rankTiers: [false, true, false] }, marks: "trad" },
      b3q2: { step: 6, set: { sortKey: "jobs" }, marks: "sort" }
    };
    const askRows = [].slice.call(document.querySelectorAll('.ask-chart[data-fig="' + p + '"] .ask-q[data-ask]'));
    /* the beat's own view with a question's settings over it, through the
       same doors the controls use, held to one paint */
    const setNamed = (set, noPaint) => {
      holdPaint++;
      try {
        if (step === 0 || step === 4){
          if (focus) setFocus(null, null);
          if (secFiltered() && resetSec) resetSec();
          const tiers = set.tiers || [true, true, true];
          tiers.forEach((on, k) => { if (on) setTier(k, true); });
          tiers.forEach((on, k) => { if (!on) setTier(k, false); });
          if (step === 0) applyLevel(6);
          applyView(set.view || "map");
          applyColor(set.colorBy || "sector");
          if (step === 0) applyBarSort(set.barSort || "jobs");
        } else if (step === 6){
          applySort(set.sortKey || "rca");
          const want = set.rankTiers || TIER_DEFAULT6();
          if (rankMode === "tier" && want.some((v, k) => v !== tierOn6[k])){
            tierOn6 = want.slice();
            if (closeMenuRef) closeMenuRef();
            if (rebuildR2Ref) rebuildR2Ref(!reduced());
          }
        }
      } finally { holdPaint--; }
      const dirty = heldPaint; heldPaint = false;
      if (dirty && !noPaint && !holdPaint && step >= 0) paint(step, !reduced());
    };
    /* everything a reader's hand can change that an answer depends on */
    const askSig = () => [step, view, colorBy, barSort, sortKey, MAP_GRAIN, focus || "", focusGroup || "",
      secOn ? Array.from(secOn).sort().join(",") : "", tierOn.map(Number).join(""), tierOn6.map(Number).join("")].join("|");
    /* the tab on the frame while an answer stands (the "Answer shown"
       study's opt-2, shipped): what the figure is showing, and the way
       back, named for the view the beat goes back to */
    const BACK_TO = { b1q1: "Back to the treemap", b1q2: "Back to sector colours", b2q1: "Back to sector colours",
                      b2q2: "Back to all three tiers", b3q1: "Back to both tradable tiers", b3q2: "Back to most specialized" };
    const askTab = document.createElement("div");
    askTab.className = "mi-asktab"; askTab.hidden = true;
    askTab.innerHTML = '<span class="mi-asktab-dot" aria-hidden="true"></span><span class="mi-asktab-txt">Showing an answer</span>' +
      '<span class="mi-asktab-sep" aria-hidden="true"></span><button type="button" class="mi-asktab-back">' +
      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 6.5h6a3.5 3.5 0 0 1 0 7H7"/><path d="M6 3.5 3 6.5l3 3"/></svg>' +
      '<span class="mi-asktab-lab"></span></button>';
    const askCueEl = document.getElementById(p + "AskCue");
    let askCue = askCueEl && askCueEl.value === "marks" ? "marks" : "tab";
    /* the frame is the scrolly's panel, built round the figure after it;
       the tab is hung on it the first time it is needed */
    const askHost = () => fig.closest(".ct-panel") || fig;
    function syncAsk(){
      const key = asked ? asked.key : "";
      fig.dataset.asked = key;
      fig.dataset.askmarks = key ? ASKS[key].marks : "";
      const host = askHost(), cue = askCue === "tab" && !!key;
      if (cue && askTab.parentNode !== host) host.appendChild(askTab);
      if (cue) askTab.querySelector(".mi-asktab-lab").textContent = BACK_TO[key] || "Back to the starting view";
      /* a press on the tab's own button leaves the focus on the figure, not the page */
      if (!cue && askTab.contains(document.activeElement)) fig.focus({ preventScroll: true });
      askTab.hidden = !cue;
      if (host.classList) host.classList.toggle("is-asked", cue);
      askRows.forEach(b => {
        const on = b.dataset.ask === key;
        b.setAttribute("aria-expanded", String(on));
        const item = b.closest(".ask-item"); if (item) item.classList.toggle("is-on", on);
        const ans = document.getElementById(b.getAttribute("aria-controls"));
        if (!ans) return;
        /* a term's card open inside an answer goes with the answer */
        if (!on && !ans.hidden && window.closeTermCard && ans.querySelector(".term-card")) window.closeTermCard(false);
        ans.hidden = !on;
      });
    }
    /* the beat's text is centred in its step, so an answer opening under a
       row would move the row out from under the pointer that pressed it -
       and the row is the way back. The step is pinned where it stands from
       the first question on, and three things keep the page still after:
       the pressed row is held where it is when an answer above it closes
       (the pin's padding takes up the difference); a beat that is left
       keeps its box, its height frozen before its answer closes, so
       nothing collapses above the reader; and only a real change of
       width, which re-flows the text anyway, lets the steps go. */
    const pinStep = st => {
      if (!st || st.dataset.pinned) return;
      const first = st.firstElementChild; if (!first) return;
      const off = Math.max(0, first.getBoundingClientRect().top - st.getBoundingClientRect().top);
      st.style.justifyContent = "flex-start";
      st.style.paddingTop = off + "px";
      st.dataset.pinned = "1"; st.dataset.pad0 = String(off);
    };
    const pinnedSteps = () => [].slice.call(document.querySelectorAll(".ct-step[data-pinned]"));
    const unpinSteps = () => pinnedSteps().forEach(st => {
      st.style.justifyContent = ""; st.style.paddingTop = ""; st.style.minHeight = "";
      delete st.dataset.pinned; delete st.dataset.pad0;
    });
    const freezeSteps = () => pinnedSteps().forEach(st => { st.style.minHeight = st.offsetHeight + "px"; });
    /* behind the reader, a step's text goes back to where it began, inside the box it kept */
    const settleSteps = active => pinnedSteps().forEach(st => { if (st !== active) st.style.paddingTop = (st.dataset.pad0 || "0") + "px"; });
    const rowOf = key => askRows.find(b => b.dataset.ask === key) || null;
    function ask(key){
      const q = key ? ASKS[key] : null;
      if (key && (!q || q.step !== step)) return;
      /* the answers are written for 2024 */
      if (key && (fig.dataset.year || "2024") !== "2024") return;
      const was = asked;
      const row = key ? rowOf(key) : null, st = row && row.closest(".ct-step");
      if (q) pinStep(st);
      const y0 = row ? row.getBoundingClientRect().top : 0;
      asked = null;                         /* the paint that follows must not judge the old question */
      setNamed(q ? q.set : {});
      asked = q ? { key: key, sig: askSig() } : null;
      syncAsk();
      /* the other question's answer, closing above this row, would have
         drawn the row up from under the pointer */
      if (row && st && st.dataset.pinned){
        const dy = y0 - row.getBoundingClientRect().top;
        if (Math.abs(dy) > 0.5) st.style.paddingTop = ((parseFloat(st.style.paddingTop) || 0) + dy) + "px";
      }
      if (q || was) syncLive(q ? ", changed to answer the question" : ", back to the starting view");
    }
    if (askRows.length){
      checkAskRef = () => { if (asked && askSig() !== asked.sig){ asked = null; syncAsk(); } };
      leaveAskRef = () => { if (!asked) return; freezeSteps(); asked = null; setNamed({}, true); syncAsk(); };
      /* a question pressed in a beat the reader is not on brings that beat
         in first, and is asked once the figure has arrived there */
      let pending = null;
      afterStepRef = i => {
        freezeSteps();
        settleSteps((fig.closest(".ct-scrolly") || document).querySelector(".ct-step.is-on"));
        if (!pending) return;
        const k = pending.key, fresh = Date.now() - pending.at < 4000;
        if (!fresh){ pending = null; return; }
        if (ASKS[k].step === i){ pending = null; ask(k); }
      };
      /* the way back. The answer closes first, so the text is laid out
         as it will stay; then a beat taken by a press is given back, and
         the scroll decides again - where that is another beat, the figure
         goes there */
      const backToStart = row => {
        if (asked) ask(null);
        if (row) row.dispatchEvent(new CustomEvent("ct:release", { bubbles: true }));
      };
      /* the tab's way back is the row's */
      on(askTab.querySelector(".mi-asktab-back"), "click", () => {
        if (!asked) return;
        const row = rowOf(asked.key), kb = askTab.contains(document.activeElement);
        backToStart(row);
        /* from the keyboard, the focus goes back to the question that was asked */
        if (kb && row) row.focus({ preventScroll: true });
      });
      if (askCueEl) on(askCueEl, "change", () => { askCue = askCueEl.value === "marks" ? "marks" : "tab"; syncAsk(); });
      askRows.forEach(b => on(b, "click", () => {
        const key = b.dataset.ask, q = ASKS[key];
        if (!q) return;
        if (q.step !== step){
          /* the beat is taken where it stands, with no scroll: the scrolly
             makes it the active one, the figure follows, and the question
             is asked on arrival */
          pending = { key: key, at: Date.now() };
          b.dispatchEvent(new CustomEvent("ct:take", { bubbles: true }));
          if (step !== q.step && window[ctlName]) window[ctlName].setStep(q.step);
          return;
        }
        if (asked && asked.key === key) backToStart(b); else ask(key);
      }));
      /* a width that re-flows the text re-centres it; an open answer's
         step is pinned again where it then stands. The page also sends
         "resize" to its figures when a beat changes, with the width as it
         was: those are not this. What is watched is the text column's own
         width: it follows the window's width, and on a short window its
         height too, since the column takes the room the figure cannot use
         - while a phone's address bar coming and going moves neither */
      const railW = () => { const st = fig.closest(".ct-scrolly"), c = st && st.querySelector(".ct-steps"); return (c ? c.offsetWidth : 0) + "|" + window.innerWidth; };
      let pinW = railW();
      on(window, "resize", () => {
        const w = railW();
        if (w === pinW) return;
        pinW = w;
        unpinSteps();
        if (asked){ const row = rowOf(asked.key); pinStep(row && row.closest(".ct-step")); }
      });
      /* Escape, once nothing else is open, is the same way back */
      escLayers.push({ p: 7, scoped: true, open: () => !!asked, close: () => {
        const row = rowOf(asked.key);
        backToStart(row);
        if (row && document.activeElement && row.closest(".ask-chart").contains(document.activeElement)) row.focus({ preventScroll: true });
      } });
      syncAsk();
    }

    /* sort: the same rows in another order, bars and names travelling together */
    const sortEl = document.getElementById(p + "Sort");
    /* the ranking's order as a blank in the row's sentence (opt-2 of the
       control row), the same choice as the buttons and kept in step with them */
    const sSortRankEl = document.getElementById(p + "SSortRank");
    function applySort(key){
      if (!key || key === sortKey) return;
      sortKey = key;
      fig.dataset.sort = sortKey;
      if (sortEl) sortEl.querySelectorAll(".seg-btn").forEach(x => {
        const on = x.dataset.sort === sortKey;
        x.classList.toggle("is-active", on);
        x.setAttribute("aria-pressed", String(on));
      });
      if (sSortRankEl && sSortRankEl.value !== sortKey){ sSortRankEl.value = sortKey; fitPick(sSortRankEl); }
      reorder(R1); reorder(R2);
      const anim = !reduced();
      placeRanking(R1, anim); placeRanking(R2, anim);
      if (step === 3 || step === 6) paint(step, anim);
    }
    if (sortEl) on(sortEl, "click", ev => {
      /* the opt-1/opt-2 study shares this row and this button class: a click
         on it must not read as a sort with no key, which cleared every sort
         button's selected state and hid the brace */
      const b = ev.target.closest(".seg-btn[data-sort]");
      if (b) applySort(b.dataset.sort);
    });
    if (sSortRankEl) on(sSortRankEl, "change", () => { fitPick(sSortRankEl); applySort(sSortRankEl.value); });

    /* the section may have mounted before this figure existed, in which
       case the beat it settled on is waiting on the figure: open there, not
       on state 0, or the first beat shows a state its controls do not drive */
    /* a rebuild starts from the engine's own state, so the segmented
       controls are set to it rather than left as the last build left them */
    [[p + "View", "view", view], [p + "BarSort", "barsort", barSort], [p + "Sort", "sort", sortKey]].forEach(([id, attr, val]) => {
      const host = document.getElementById(id);
      if (host) host.querySelectorAll(".seg-btn[data-" + attr + "]").forEach(x => {
        const onIt = x.dataset[attr] === val;
        x.classList.toggle("is-active", onIt);
        x.setAttribute("aria-pressed", String(onIt));
      });
    });
    if (sSortRankEl){ sSortRankEl.value = sortKey; fitPick(sSortRankEl); }
    window[ctlName].setStep(fig.dataset.wantStep != null ? +fig.dataset.wantStep : 0);
  }

  function initExportTooltip(){
    const svgEl = document.getElementById("exportTreemapSvg");
    const tip = document.getElementById("exportTip");
    const wrap = document.querySelector(".export-viz-row");
    if (!svgEl || !tip || !wrap) return;
    exportClearHover = attachCellTip(svgEl, wrap, tip);
  }

  function initTradableTooltip(){
    const svgEl = document.getElementById("tradableAnimatedSvg");
    const tip = document.getElementById("tradableTip");
    const wrap = document.querySelector(".tradable-viz-wrapper");
    if (!svgEl || !tip || !wrap) return;
    tradableClearHover = attachCellTip(svgEl, wrap, tip);
  }


  function initExportOptions(){
    /* the numbered design list is gone from the bar — the section ships on
       option 2 alone — so the wiring no longer depends on finding it */
    const btns = document.querySelectorAll("#exportOptList .design-opt");
    btns.forEach(b => b.addEventListener("click", () => {
      const n = +b.dataset.opt;
      exportOpt = (exportOpt === n) ? 0 : n;
      exportView = "map";                       /* every option opens on the treemap */
      exportListOn = false;                     /* the list is always opt-in */
      btns.forEach(x => x.classList.toggle("is-on", +x.dataset.opt === exportOpt));
      updateExportViewSeg();
      updateTopBtn();
      updateExportOptCtl();
      applyExportOption(true);
    }));
    const topBtn = document.getElementById("exportTopBtn");
    if (topBtn) topBtn.addEventListener("click", () => {
      exportListOn = !exportListOn;
      updateTopBtn();
      applyExportOption(true);
    });

    /* option 2 is the section's default: its View toggle sits on the bar
       from the start, with the treemap still the resting view */
    exportOpt = 2;
    btns.forEach(x => x.classList.toggle("is-on", +x.dataset.opt === 2));
    updateExportViewSeg();
    updateTopBtn();
    updateExportOptCtl();
    applyExportOption(false);
    const wrap = document.getElementById("exportViewWrap");
    if (wrap) wrap.addEventListener("click", e => {
      const b = e.target.closest(".seg-btn");
      if (!b || b.dataset.view === exportView) return;
      exportView = b.dataset.view;
      updateExportViewSeg();
      applyExportOption(true);
    });
  }

  function init(){
    if (typeof d3 === "undefined") return;
    renderStaticTreemap();
    renderComplexityTreemap();
    initComplexityTooltip();
    initTradableAnimation();
    initColorBySegments();
    initExportOptions();
    initExportTooltip();
    initTradableTooltip();
    initLeanMap();
    initCommuteStats();
    updateExportHeadStat();
    initIndustryFigure("mi", industryData, "MI");
    /* the year the industry figure shows: another year is another build
       of the same figure over that year's rows, opened on the beat the
       reader is on; the studies' dropdowns and the palette carry over */
    const yearEl = document.getElementById("miYear");
    if (yearEl) yearEl.addEventListener("change", () => {
      const srcY = YEARS[yearEl.value];
      const figY = document.getElementById("miFigure");
      if (!srcY || !figY) return;
      if (window.MI && window.MI.destroy) window.MI.destroy();
      figY.dataset.wantStep = figY.dataset.step || "0";
      figY.dataset.year = yearEl.value;
      initIndustryFigure("mi", rowsFrom(srcY).sort((a, b) => b.employ - a.employ), "MI");
    });
    /* the sentence's year is the same choice: it sets the dropdown, which
       does the work, and follows it */
    const sYearEl = document.getElementById("miSYear");
    if (yearEl && sYearEl){
      sYearEl.addEventListener("change", () => {
        fitPick(sYearEl);
        if (yearEl.value === sYearEl.value) return;
        yearEl.value = sYearEl.value;
        yearEl.dispatchEvent(new Event("change"));
      });
      yearEl.addEventListener("change", () => {
        if (sYearEl.value === yearEl.value) return;
        sYearEl.value = yearEl.value;
        fitPick(sYearEl);
      });
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => fitPicks());
    /* Worker Flows now runs its own figure — one set of sector rows
       read three ways — which lives with the section's markup rather than
       here; nothing to build in this file. */
    initRcaChart();
    initPeerChart();
    initRcaViewToggle();
    initPeerCityChips();
    renderMetroScatter();
    renderCityInMetro();
    initDxExplainer();
  }

  window.CityTreemaps = { setColorBy };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
