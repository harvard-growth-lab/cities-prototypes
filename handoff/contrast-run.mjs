import fs from 'node:fs';
/* Drives handoff/contrast-audit.js through every section, beat and figure state and
   writes $S/contrast-results.json. Run with the harness and a long timeout:
   HARNESS_MS=900000 S=/tmp/shots node handoff/verify-harness.mjs handoff/contrast-run.mjs "http://127.0.0.1:8912/cities-v-5/" */
const S = process.env.S;
const AUDIT = fs.readFileSync(new URL('./contrast-audit.js', import.meta.url), 'utf8');   /* the auditor beside this file */
export async function run({ evalJs, sleep, shot, emulate, log }){
  const all = new Map();
  const imgs = new Map();
  const seenStates = [];
  const collect = async label => {
    const raw = await evalJs('(()=>{const a=window.__audit(); return JSON.stringify({n:a.length, fails:a.filter(x=>!x.pass), imgs:a.filter(x=>x.image&&x.pass)})})()');
    const d = JSON.parse(raw);
    for (const m of d.imgs){ const k = m.path + '|' + m.fg + '|' + m.bg; if (!imgs.has(k)) imgs.set(k, { ...m, states: [label] }); }
    for (const m of d.fails){
      const key = [m.path, m.fg, m.bg, m.size, m.kind].join('|');
      if (!all.has(key)) all.set(key, { ...m, states: [label], count: 1 });
      else { const e = all.get(key); e.count++; if (!e.states.includes(label)) e.states.push(label); }
    }
    seenStates.push({ state: label, texts: d.n, fails: d.fails.length });
  };
  const wait = ms => sleep(ms);
  const run1 = expr => evalJs('(()=>{try{' + expr + ';return 1}catch(e){return "ERR "+e.message}})()');
  const settle = async () => { await run1("document.querySelector('.pages').style.scrollBehavior='auto'; window.dispatchEvent(new Event('resize'))"); await wait(1300); };

  await evalJs(AUDIT);
  const ctl = new Map();
  const collectControls = async label => {
    const arr = JSON.parse(await evalJs('JSON.stringify(window.__controls())'));
    for (const c of arr){ const k = c.path; if (!ctl.has(k)) ctl.set(k, { ...c, states: [label] }); else if (!ctl.get(k).states.includes(label)) ctl.get(k).states.push(label); }
  };
  await collect('landing'); await collectControls('landing');
  await run1("enterTool('page-overview')"); await wait(2500);
  await run1("document.querySelector('.pages').style.scrollBehavior='auto'");

  const beats = async tag => {
    const n = await evalJs("[...document.querySelectorAll('.ct-step, .ov-left > section.ov-block')].filter(e=>e.offsetParent!==null).length");
    for (let j = 0; j < n; j++){
      await run1("const els=[...document.querySelectorAll('.ct-step, .ov-left > section.ov-block')].filter(e=>e.offsetParent!==null); els[" + j + "].scrollIntoView({block:'center',behavior:'instant'}); window.dispatchEvent(new Event('resize'))");
      await wait(1400); await collect(tag + '-beat' + (j + 1));
    }
  };
  /* every section, at the top and at each beat */
  for (let i = 0; i < 6; i++){
    await run1("showSection(" + i + ",false)"); await settle();
    await collect('sec' + i + '-top'); await collectControls('sec' + i);
    if (i !== 1) await beats('sec' + i);
  }
  /* Metro Industries, state by state */
  await run1("showSection(1,false)"); await settle();
  await run1("document.querySelectorAll('#page-export-basket .ct-step')[0].scrollIntoView({block:'center',behavior:'instant'})"); await settle();
  const setStep = async n => { await run1("window.MI.setStep(" + n + ")"); await wait(2400); };
  const set = async (id, v) => run1("const e=document.getElementById('" + id + "'); e.value='" + v + "'; e.dispatchEvent(new Event('change',{bubbles:true}))");
  for (const st of [0, 4, 6]){ await setStep(st); await collect('mi-step' + st); }
  await setStep(0);
  await run1("document.querySelector('#miColor .seg-btn[data-color=\"complexity\"]').click()"); await wait(1800); await collect('mi-complexity-0');
  await setStep(4); await collect('mi-complexity-4');
  await run1("document.querySelector('#miColor .seg-btn[data-color=\"sector\"]').click()"); await wait(1200);
  await setStep(0);
  await set('miPal', 'periwinkle'); await wait(1500); await collect('mi-periwinkle-0'); await set('miPal', 'mint'); await wait(800);
  await set('miRowOpt', 'sentence'); await wait(900); await collect('mi-sentence-0');
  await run1("document.getElementById('miSView').value='alt'; document.getElementById('miSView').dispatchEvent(new Event('change',{bubbles:true}))"); await wait(2000); await collect('mi-sentence-ranked');
  await set('miSView', 'map'); await set('miRowOpt', 'tray'); await wait(1500);
  await run1("document.querySelector('#miView .seg-btn[data-view=\"alt\"]').click()"); await wait(2200); await collect('mi-ranked-0');
  await run1("document.querySelector('#miView .seg-btn[data-view=\"map\"]').click()"); await wait(2000);
  /* key: hide, verbs, reset button, card */
  await run1("document.querySelectorAll('#miSectorKey .sk-item')[1].querySelector('.sk-sec').click()"); await wait(1800);
  await run1("document.querySelectorAll('#miSectorKey .sk-item')[1].querySelector('.sk-sec').focus()"); await wait(300); await collect('mi-key-hidden-focus');
  await set('miKeyOpt', 'card'); await wait(300);
  await run1("document.querySelectorAll('#miSectorKey .sk-item')[2].dispatchEvent(new MouseEvent('mouseenter',{bubbles:false}))"); await wait(300); await collect('mi-key-card');
  await run1("document.querySelectorAll('#miSectorKey .sk-item')[2].dispatchEvent(new MouseEvent('mouseleave',{bubbles:false}))"); await set('miKeyOpt', 'inline');
  await run1("document.querySelector('#miSectorKey .sk-reset').click()"); await wait(1500);
  /* the cell card, plain and pinned */
  await run1("const g=[...document.querySelectorAll('#miTreemapSvg g.mi-mcell')].find(g=>+getComputedStyle(g.querySelector('rect')).opacity>0.5); const r=g.querySelector('rect').getBoundingClientRect(); g.dispatchEvent(new MouseEvent('mouseenter',{bubbles:true,clientX:r.left+4,clientY:r.top+4}))"); await wait(400); await collect('mi-cell-card');
  await run1("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))");
  /* the phrase highlight */
  await run1("document.querySelectorAll('#page-export-basket .ct-step')[0].scrollIntoView({block:'center',behavior:'instant'})"); await wait(800);
  await run1("const s=document.querySelector('.ct-step.is-on .mi-hl[data-sector]'); s.dispatchEvent(new MouseEvent('mouseenter'))"); await wait(400); await collect('mi-phrase-lit');
  await run1("const s=document.querySelector('.ct-step.is-on .mi-hl[data-sector]'); s.dispatchEvent(new MouseEvent('mouseleave'))");
  /* the opt panel and the table */
  await run1("document.querySelector('#miStudies .mi-studies-btn').click()"); await wait(500); await collect('mi-opt-panel');
  await run1("document.querySelector('#miStudies .mi-studies-btn').click()");
  await run1("document.getElementById('miTableBtn').click()"); await wait(700); await collect('mi-table-open');
  await run1("document.getElementById('miTableBtn').click()");
  /* zoom, crumbs, empty grounds, cancelled tier chips */
  await run1("document.querySelectorAll('#miSectorKey .sk-only')[0].click()"); await wait(2000); await collect('mi-zoom-0');
  await setStep(4); await collect('mi-zoom-4');
  await run1("document.querySelector('#miSectorKey .sk-reset').click()"); await wait(1200);
  const nr = await evalJs("[...document.querySelectorAll('#miSectorKey .sk-name')].findIndex(n=>n.textContent==='Natural Resources')");
  await run1("document.querySelectorAll('#miSectorKey .sk-only')[" + nr + "].click()"); await wait(2200); await collect('mi-zoom-naturalresources-4');
  await run1("document.querySelector('#miSectorKey .sk-reset').click()"); await wait(1200);
  await run1("const h=document.querySelectorAll('#miTreemapSvg .mi-card-x-hit')[1]; h.dispatchEvent(new MouseEvent('click',{bubbles:true}))"); await wait(1800); await collect('mi-tier-cancelled');
  await run1("document.querySelectorAll('#miFigure .mcl-chip').forEach(c=>c.click())"); await wait(1200);
  await setStep(0);
  await collectControls('mi');
  /* the overlays */
  await run1("openJourney()"); await wait(1200); await collect('journey'); await run1("closeJourney()"); await wait(500);
  await run1("toggleExplainers(true)"); await wait(1200); await collect('explainers'); await run1("toggleExplainers(false)"); await wait(500);
  await run1("const b=document.querySelector('.citypick-btn'); if(b) b.click()"); await wait(600); await collect('citypick-open'); await run1("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))");
  await run1("openGeoMap('metro')"); await wait(2500); await collect('geomap-metro'); await run1("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}))"); await wait(600);
  /* Worker Flows figure states */
  await run1("showSection(2,false)"); await settle();
  for (const st of [7, 8, 9, 10]){ const ok = await run1("window.AM.setStep(" + st + ")"); await wait(2200); await collect('am-step' + st); }
  /* the section end, the quiz and its answers */
  await run1("showSection(1,false)"); await settle();
  await run1("document.querySelector('.secpager').scrollIntoView({block:'center',behavior:'instant'})"); await wait(600); await collect('pager');
  await run1("document.querySelector('.pgc--check').click()"); await wait(500); await collect('quiz-open');
  await run1("document.querySelector('.kq-dialog .ktest-opts button').click()"); await wait(500); await collect('quiz-wrong-and-right');
  await run1("document.querySelector('.kq-close').click()");
  /* the whole thing at a narrow width */
  await emulate(390, 844); await wait(1500);
  await run1("showSection(1,false)"); await settle(); await collect('phone-sec1-top'); await beats('phone-sec1');
  await emulate(1500, 1000); await wait(600);

  const rows = [...all.values()].sort((a, b) => a.r - b.r);
  fs.writeFileSync(S + '/contrast-results.json', JSON.stringify({ states: seenStates, rows, controls: [...ctl.values()], imgs: [...imgs.values()] }, null, 1));
  log({ states: seenStates.length, distinctFailures: rows.length, totalHits: rows.reduce((a, r) => a + r.count, 0) });
}
