/* type and layout audit of the Metro Industries section.
   W, H: viewport. FLOOR: the size under which text is reported (default 12.5).
   SECTION: 1 = Metro Industries (default), 2 = the city's section */
export const AUDIT = `
window.__type = (rootSel, floor) => {
  const root = document.querySelector(rootSel) || document.body, small = {}, all = {};
  const shown = el => {
    for (let e = el; e && e.nodeType === 1; e = e.parentElement){
      const c = getComputedStyle(e);
      if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity < 0.05) return false;
      if (e.hasAttribute && e.hasAttribute('hidden')) return false;
    }
    const r = el.getBoundingClientRect(); return r.width >= 2 && r.height >= 2;
  };
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()){
    const t = n.nodeValue.replace(/\\s+/g, ' ').trim(); if (!t) continue;
    const el = n.parentElement; if (!el || /^(SCRIPT|STYLE|TITLE|DESC)$/i.test(el.tagName)) continue;
    if (!shown(el)) continue;
    let px = parseFloat(getComputedStyle(el).fontSize);
    if (el.ownerSVGElement || el.tagName.toLowerCase() === 'svg'){ const m = el.getScreenCTM && el.getScreenCTM(); if (m) px *= Math.hypot(m.a, m.b); }
    px = Math.round(px * 10) / 10;
    if (px === 0) continue;                       /* font-size:0 hides a button's bare text beside its icon */
    all[px] = (all[px] || 0) + 1;
    if (px >= floor - 0.05) continue;
    let id = ''; for (let e = el; e; e = e.parentElement){ if (e.id){ id = '#' + e.id; break; } }
    const cls = (el.getAttribute('class') || '').trim().split(/\\s+/).slice(0, 2).join('.');
    const key = px + ' ' + el.tagName.toLowerCase() + (cls ? '.' + cls : '') + ' in ' + id;
    (small[key] = small[key] || { n: 0, eg: t.slice(0, 28) }).n++;
  }
  /* text a pseudo-element prints */
  for (const el of root.querySelectorAll('*')){
    for (const ps of ['::before', '::after']){
      const c = getComputedStyle(el, ps), txt = c.content;
      if (!txt || txt === 'none' || txt === 'normal' || !/[A-Za-z0-9]/.test(txt.replace(/url\([^)]*\)|attr\([^)]*\)|counter\([^)]*\)/g, ''))) continue;
      if (c.display === 'none' || !shown(el)) continue;
      const px = Math.round(parseFloat(c.fontSize) * 10) / 10; if (!px) continue;
      all[px] = (all[px] || 0) + 1;
      if (px >= floor - 0.05) continue;
      let id = ''; for (let e = el; e; e = e.parentElement){ if (e.id){ id = '#' + e.id; break; } }
      const cls = (el.getAttribute('class') || '').trim().split(/\\s+/).slice(0, 2).join('.');
      const key = px + ' ' + el.tagName.toLowerCase() + (cls ? '.' + cls : '') + ps + ' in ' + id;
      (small[key] = small[key] || { n: 0, eg: txt.slice(0, 28) }).n++;
    }
  }
  return { small, min: Math.min(...Object.keys(all).map(Number)) };
};
window.__lay = fig => {
  const q = s => document.querySelector(s), r = e => e ? e.getBoundingClientRect() : null;
  const page = q(fig === 'am' ? '#page-admin-mix' : '#page-export-basket');
  const sc = r(page.querySelector('.ct-scrolly')), st = r(page.querySelector('.ct-steps')), sg = r(page.querySelector('.ct-stage')), pn = r(page.querySelector('.ct-panel')),
        fg = r(q(fig === 'am' ? '#amFigure' : '#miFigure')), svg = page.querySelector('.viz-big svg, #miTreemapSvg');
  const chrome = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--chrome-h'));
  const m = svg && svg.getScreenCTM();
  return { vw: innerWidth, vh: innerHeight, scrolly: Math.round(sc.width), rail: Math.round(st.width), gap: Math.round(sg.left - st.right), stage: Math.round(sg.width),
    panel: [Math.round(pn.width), Math.round(pn.height)], figure: [Math.round(fg.width), Math.round(fg.height)], panelTop: Math.round(pn.top), panelBottom: Math.round(pn.bottom),
    fitsBelowChrome: pn.bottom <= innerHeight + 1 && pn.top >= (innerWidth >= 900 ? chrome - 1 : 0), svgScale: m ? +Math.hypot(m.a, m.b).toFixed(3) : null,
    overflowX: document.documentElement.scrollWidth - innerWidth, pagesOverflowX: q('.pages').scrollWidth - q('.pages').clientWidth };
};`;
export async function run({ evalJs, sleep, shot, emulate, log }){
  const W = +process.env.W || 1440, H = +process.env.H || 900, FLOOR = +process.env.FLOOR || 12.5;
  const run1 = expr => evalJs('(()=>{try{' + expr + ';return 1}catch(e){return "ERR "+e.message}})()');
  const j = async expr => JSON.parse(await evalJs('(()=>{try{return JSON.stringify(' + expr + ')}catch(e){return JSON.stringify("ERR "+e.message)}})()'));
  const beat = async i => { await run1("document.querySelectorAll('#page-export-basket .ct-step')[" + i + "].scrollIntoView({block:'center',behavior:'instant'})"); await sleep(2600); };
  const click = async sel => { const r = await run1("const e=document.querySelector(" + JSON.stringify(sel) + "); if(!e) throw new Error('missing " + sel.replace(/'/g, "") + "'); e.click()"); if (r !== 1) log("  ! " + r); await sleep(1900); };
  const smalls = {};
  const take = async name => {
    const t = await j("window.__type('body', " + FLOOR + ")");
    for (const k in t.small){ (smalls[k] = smalls[k] || { n: 0, eg: t.small[k].eg, in: [] }); smalls[k].n = Math.max(smalls[k].n, t.small[k].n); smalls[k].in.push(name); }
    const l = await j("window.__lay('mi')");
    log(name + " | min " + t.min + " | rail " + l.rail + " gap " + l.gap + " stage " + l.stage + " panel " + l.panel + " fig " + l.figure + " top/bottom " + l.panelTop + "/" + l.panelBottom + (l.fitsBelowChrome ? "" : " DOES NOT FIT") + " scale " + l.svgScale + (l.overflowX || l.pagesOverflowX ? " OVERFLOW-X " + l.overflowX + "/" + l.pagesOverflowX : ""));
    if (process.env.SHOTS) await shot(process.env.S + "/" + process.env.SHOTS + "-" + W + "-" + name.replace(/\W+/g, "-") + ".png", { x: 0, y: 0, width: W, height: H, scale: W < 700 ? 2 : 1 });
  };
  await emulate(W, H);
  await run1("enterTool('page-overview')"); await sleep(2000);
  await run1("showSection(1,false)"); await run1("document.querySelector('.pages').style.scrollBehavior='auto'"); await sleep(1200);
  await evalJs(AUDIT);
  await beat(0); await take("b1 map");
  await click('#miColor [data-color="complexity"]'); await take("b1 complexity");
  await click('#miColor [data-color="sector"]');
  await click('#miLevel [data-level="2"]'); await take("b1 sector level");
  await click('#miLevel [data-level="6"]');
  await click('#miView [data-view="alt"]'); await take("b1 ranked");
  await click('#miView [data-view="map"]');
  await click('#miTableBtn'); await take("b1 table");
  await click('#miTableBtn');
  await click('.ask-q[data-ask="b1q1"]'); await sleep(1200); await take("b1 ask");
  await click('.ask-q[data-ask="b1q1"]'); await sleep(800);
  /* a cell's tooltip */
  await run1("const c=[...document.querySelectorAll('#miTreemapSvg rect')].sort((a,b)=>b.getBoundingClientRect().width*b.getBoundingClientRect().height-a.getBoundingClientRect().width*a.getBoundingClientRect().height)[3]; const r=c.getBoundingClientRect(); const o={bubbles:true,clientX:r.left+r.width/2,clientY:r.top+r.height/2}; document.elementFromPoint(o.clientX,o.clientY).dispatchEvent(new MouseEvent('mousemove',o)); document.elementFromPoint(o.clientX,o.clientY).dispatchEvent(new MouseEvent('mouseover',o));"); await sleep(500);
  await take("b1 tooltip");
  await beat(1); await take("b2 tiers");
  await click('#miColor [data-color="complexity"]'); await take("b2 complexity");
  await click('#miColor [data-color="sector"]');
  await click('.ask-q[data-ask="b2q2"]'); await sleep(1200); await take("b2 ask");
  await click('.ask-q[data-ask="b2q2"]'); await sleep(800);
  await click('button.term[data-term="tradability"]'); await take("b2 term card");
  await run1("document.body.click()");
  await beat(2); await take("b3 ranking");
  await click('#miSort [data-sort="jobs"]'); await take("b3 by jobs");
  await click('#miSort [data-sort="gap"]'); await take("b3 peers");
  await click('#miSort [data-sort="rca"]');
  log("SMALL TEXT under " + FLOOR + "px:");
  for (const k of Object.keys(smalls).sort((a, b) => parseFloat(a) - parseFloat(b))) log("  " + k + " ×" + smalls[k].n + " e.g. \"" + smalls[k].eg + "\" [" + [...new Set(smalls[k].in)].slice(0, 4).join("; ") + (new Set(smalls[k].in).size > 4 ? "; …" : "") + "]");
}
