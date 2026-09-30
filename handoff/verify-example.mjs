/* A test module for verify-harness.mjs: it opens the tool, lands the Metro
   Industries scrolly on its first beat, drives the figure through the three
   beats, exercises the sector key's hide / only and the zoom, reads the state
   after each move, and saves clipped screenshots. Run:

     S=/tmp/shots mkdir -p /tmp/shots; S=/tmp/shots node handoff/verify-harness.mjs handoff/verify-example.mjs "http://127.0.0.1:8912/cities-v-5/"

   The harness gives you: evalJs(expr) (awaits promises, returns JSON-able
   values; wrap const/let in an IIFE), sleep(ms), shot(path, clip?) with clip
   {x,y,width,height,scale} in CSS px (captureBeyondViewport is on), emulate(w,h),
   log(obj) (collected and printed as JSON at the end, with console errors). */
export async function run({ evalJs, sleep, shot, log }){
  const S = process.env.S || "/tmp";
  /* 1. the tool is display:none until a section is entered */
  await evalJs("enterTool('page-export-basket'); 1"); await sleep(2500);
  /* 2. headless does not tick the page's smooth scroll: land the beat instantly, then let the figure measure */
  await evalJs("document.querySelector('.pages').style.scrollBehavior='auto'; document.querySelectorAll('#page-export-basket .ct-step')[0].scrollIntoView({block:'center',behavior:'instant'}); window.dispatchEvent(new Event('resize')); 1"); await sleep(2500);
  await evalJs(`window.__st=()=>{const f=document.getElementById('miFigure'); const vis=[...document.querySelectorAll('#miTreemapSvg g.mi-mcell')].filter(g=>+getComputedStyle(g.querySelector('rect')).opacity>0.5); return {step:f.dataset.step, focus:f.dataset.focus||'', cells:vis.length, off:document.querySelectorAll('#miSectorKey .sk-sec.is-off').length, title:document.querySelector('#miView .mi-title-all .mcl-dir').textContent, tierTitle:document.querySelector('#miView .mi-title-tier .mcl-dir').textContent, crumbs:(document.querySelector('#miNote .mi-note-txt').textContent+document.querySelector('#miNote4 .mi-note-txt').textContent).replace(/\\s+/g,' ').trim()}}; 1`);
  /* 3. the figure's own state machine: 0 whole map, 4 tiers, 6 ranking */
  await evalJs("window.MI.setStep(0); 1"); await sleep(2200);
  log({ beat1: await evalJs("window.__st()") });
  await evalJs("document.querySelectorAll('#miSectorKey .sk-item')[1].querySelector('.sk-sec').click(); 1"); await sleep(2200);
  log({ hidEducation: await evalJs("window.__st()") });
  await evalJs("document.querySelectorAll('#miSectorKey .sk-only')[0].click(); 1"); await sleep(2200);
  log({ zoomedProfessional: await evalJs("window.__st()") });
  await shot(S + "/beat1-zoomed.png", await evalJs("(()=>{const r=document.getElementById('miFigure').getBoundingClientRect(); return {x:r.left,y:r.top,width:r.width,height:r.height,scale:1}})()"));
  await evalJs("window.MI.setStep(4); 1"); await sleep(2800);
  log({ beat2_zoomCarried: await evalJs("window.__st()") });
  await evalJs("document.querySelector('#miSectorKey .sk-reset').click(); 1"); await sleep(2000);
  await evalJs("window.MI.setStep(6); 1"); await sleep(2800);
  log({ beat3: await evalJs("window.__st()") });
}
