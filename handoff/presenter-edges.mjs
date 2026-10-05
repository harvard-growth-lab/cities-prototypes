/* The presenter view's edges (HANDOFF §4, "The presenter view", and §8 0g):
   P on the landing, the beat-2 counter's door opening beat 2, the keyboard's
   place across footer rebuilds and a disabled Next, Shift+Tab wrapping, the
   glossary keeping its keys, Escape's order, the view closing with its
   section, and the one-scroll layout (P only on a figure section, Worker
   Flows opening its own figure, unclipped).
   HARNESS_MS=200000 S=<dir> node handoff/verify-harness.mjs handoff/presenter-edges.mjs "http://127.0.0.1:8912/cities-v-5/"
   (the second half reloads nothing: it starts from where the first left the page) */
async function edgesA({ evalJs, sleep, shot, emulate, log }){
  await emulate(1440, 900);
  const key = (k, extra) => evalJs(`(document.activeElement||document.body).dispatchEvent(new KeyboardEvent('keydown',Object.assign({key:${JSON.stringify(k)},bubbles:true,cancelable:true},${JSON.stringify(extra||{})})))`);
  const j = async e => JSON.parse(await evalJs('(()=>{try{return JSON.stringify(' + e + ')}catch(x){return JSON.stringify("ERR "+x.message)}})()'));
  const st = `({on:!!window.presenter.on, step:document.getElementById('miFigure').dataset.step, title:(document.querySelector('.pv-title')||{}).textContent, focus:(document.activeElement.className||document.activeElement.tagName)+(document.activeElement.dataset&&document.activeElement.dataset.ask?':'+document.activeElement.dataset.ask:''), live:(document.querySelector('.pv-live')||{}).textContent, pvlive:document.documentElement.dataset.pvlive||null})`;
  /* 1. on the landing, P does nothing */
  await key("p"); await sleep(600);
  log("landing P: " + JSON.stringify(await j(st)));
  await evalJs("enterTool('page-overview')"); await sleep(2000);
  await evalJs("showSection(1,false)"); await evalJs("document.querySelector('.pages').style.scrollBehavior='auto'"); await sleep(1500);
  log("MI pvlive: " + JSON.stringify((await j(st)).pvlive));
  /* 2. the eyebrow door of beat 2 opens beat 2 while beat 1 is on */
  await evalJs("document.querySelectorAll('#page-export-basket .ct-step')[0].scrollIntoView({block:'center',behavior:'instant'})"); await sleep(2500);
  await evalJs("{const s=document.getElementById('miPresentAt'); s.value='eyebrow'; s.dispatchEvent(new Event('change',{bubbles:true}))}");
  await evalJs("document.querySelectorAll('#page-export-basket .ct-step')[1].querySelector('.pv-open--eyebrow').click()"); await sleep(2500);
  log("eyebrow beat-2 door: " + JSON.stringify(await j(st)));
  /* 3. live region said the beat */
  /* 4. footer focus kept across a beat change: focus a footer question, ArrowRight */
  await evalJs("document.querySelector('.pv-foot .pv-q').focus()");
  await key("ArrowRight"); await sleep(2500);
  log("after ArrowRight from a footer question: " + JSON.stringify(await j(st)));
  /* ask from the footer by keyboard-ish click with focus on the button */
  await evalJs("{const b=document.querySelector('.pv-foot .pv-q'); b.focus(); b.click()}"); await sleep(2600);
  log("asked: " + JSON.stringify(await j(st)) + " describedby:" + JSON.stringify(await j("(document.querySelector('.pv-q[aria-pressed=\"true\"]')||{}).getAttribute&&document.querySelector('.pv-q[aria-pressed=\"true\"]').getAttribute('aria-describedby')")));
  await evalJs("{const b=document.querySelector('.pv-back'); b.focus(); b.click()}"); await sleep(2400);
  log("back from answer: " + JSON.stringify(await j(st)));
  /* 5. Next disabled under focus on the last beat */
  await evalJs("document.querySelector('.pv-next').focus(); document.querySelector('.pv-next').click()"); await sleep(2500);
  log("Next to last beat: " + JSON.stringify(await j(st)));
  /* 6. Shift+Tab out of the start wraps to the end */
  await evalJs("document.querySelector('.pv-prev').focus(); document.querySelector('#page-export-basket .ct-step .ask-q').focus()"); await sleep(200);
  log("focus moved before the panel: " + JSON.stringify(await j(st)));
  /* 7. glossary open: PageDown and Home do not step */
  await evalJs("document.querySelector('#miSpecKey button.term').click()"); await sleep(600);
  await evalJs("[...document.querySelectorAll('.term-card a, .term-card button')].find(b=>/glossary/i.test(b.textContent)).click()"); await sleep(900);
  const before = (await j(st)).step;
  await key("Home"); await sleep(800); await key("PageDown"); await sleep(800);
  log("glossary keys: step before " + before + " after " + (await j(st)).step + " glOpen " + await evalJs("document.getElementById('glossaryOverlay').classList.contains('open')"));
  await key("Escape"); await sleep(600); await key("Escape"); await sleep(1500);
  log("after two Escapes: " + JSON.stringify(await j(st)));
  await evalJs("{const s=document.getElementById('miPresentAt'); s.value='frame'; s.dispatchEvent(new Event('change',{bubbles:true}))}");
  /* 8. back to the landing while presenting closes the view */
  await evalJs("window.presenter.enter()"); await sleep(1500);
  await evalJs("typeof backToLanding==='function' ? backToLanding() : document.querySelector('.logo, .brand, header a').click()"); await sleep(1500);
  log("landing while presenting: " + JSON.stringify(await j(st)) + " html class: " + await evalJs("document.documentElement.className"));
}

async function edgesB({ evalJs, sleep, shot, emulate, log }){
  await emulate(1440, 900);
  const key = k => evalJs(`(document.activeElement||document.body).dispatchEvent(new KeyboardEvent('keydown',{key:${JSON.stringify(k)},bubbles:true,cancelable:true}))`);
  const j = async e => JSON.parse(await evalJs('(()=>{try{return JSON.stringify(' + e + ')}catch(x){return JSON.stringify("ERR "+x.message)}})()'));
  const st = `({on:!!window.presenter.on, page:(document.querySelector('.ct-panel.is-presenting')||{closest:()=>null}).closest('section, [id^=page-]')?.id||null, title:(document.querySelector('.pv-title')||{}).textContent, focus:(document.activeElement.className||document.activeElement.tagName), pvlive:document.documentElement.dataset.pvlive||null})`;
  await evalJs("enterTool('page-overview')"); await sleep(2000);
  await evalJs("showSection(1,false)"); await evalJs("document.querySelector('.pages').style.scrollBehavior='auto'"); await sleep(1500);
  await evalJs("document.querySelectorAll('#page-export-basket .ct-step')[1].scrollIntoView({block:'center',behavior:'instant'})"); await sleep(2500);
  await evalJs("window.presenter.enter()"); await sleep(1800);
  await evalJs("document.querySelector('.pv-next').focus(); document.querySelector('.pv-next').click()"); await sleep(1500);
  log("Next onto the last beat, focus: " + JSON.stringify(await j(st)) + " nextDisabled " + await evalJs("document.querySelector('.pv-next').disabled"));
  await key("Escape"); await sleep(1200);
  /* the one-scroll layout */
  await evalJs("document.querySelector('.sv-opt[data-layout=\"scroll\"]').click()"); await sleep(1500);
  log("layout: " + await evalJs("document.documentElement.dataset.layout"));
  await evalJs("document.querySelector('.pages').style.scrollBehavior='auto'");
  /* a storyline section that is neither figure section */
  await evalJs("document.getElementById('page-constraints').scrollIntoView({block:'start',behavior:'instant'})"); await sleep(1200);
  log("on Constraints: " + JSON.stringify(await j(st)) + " bar door shown " + await evalJs("(()=>{const s=document.getElementById('miPresentAt'); s.value='bar'; s.dispatchEvent(new Event('change',{bubbles:true})); const b=document.querySelector('.pv-open--bar'); return getComputedStyle(b).display})()"));
  await key("p"); await sleep(800);
  log("P on Constraints: " + JSON.stringify(await j(st)));
  /* Worker Flows */
  await evalJs("document.querySelectorAll('#page-admin-mix .ct-step')[1].scrollIntoView({block:'center',behavior:'instant'})"); await sleep(2500);
  log("on Worker Flows, bar door " + await evalJs("getComputedStyle(document.querySelector('.pv-open--bar')).display"));
  await key("p"); await sleep(2000);
  log("P on Worker Flows: " + JSON.stringify(await j(st)) + " covers " + await evalJs("(()=>{const pn=document.querySelector('.ct-panel.is-presenting'); return [[2,2],[innerWidth-3,innerHeight-3],[innerWidth/2,innerHeight/2]].every(([x,y])=>{const h=document.elementFromPoint(x,y); return !!(h&&pn&&pn.contains(h));})})()") + " clip " + await evalJs("getComputedStyle(document.getElementById('page-admin-mix')).clipPath"));
  await shot(process.env.S + "/pv/scroll-wf.png", { x: 0, y: 0, width: 1440, height: 900, scale: 0.5 });
  await key("Escape"); await sleep(1200);
  log("exit: " + JSON.stringify(await j(st)) + " in WF: " + await evalJs("(()=>{const r=document.getElementById('page-admin-mix').getBoundingClientRect(); return r.top<450&&r.bottom>450})()"));
  await evalJs("{const s=document.getElementById('miPresentAt'); s.value='frame'; s.dispatchEvent(new Event('change',{bubbles:true}))}");
  await evalJs("document.querySelector('.sv-opt[data-layout=\"pages\"]').click()"); await sleep(800);
}

export async function run(h){ await edgesA(h); await edgesB(h); }
