/* The presenter view, end to end (HANDOFF §4, "The presenter view").
   HARNESS_MS=120000 S=<dir> W=1440 H=900 [SHOTS=1] node handoff/verify-harness.mjs handoff/presenter-check.mjs "http://127.0.0.1:8912/cities-v-5/"
   Opens the view from the frame button, steps the beats, asks and un-asks a question from the footer,
   uses Home, Escape and P, lists the three placements; prints whether the figure fits between the
   bar and the footer and the smallest text on screen. SHOTS=1 writes to $S/pv/ (make it first). */
export async function run({ evalJs, sleep, shot, emulate, log }){
  const W = +process.env.W || 1440, H = +process.env.H || 900;
  const run1 = expr => evalJs('(()=>{try{' + expr + ';return 1}catch(e){return "ERR "+e.message}})()');
  const j = async expr => JSON.parse(await evalJs('(()=>{try{return JSON.stringify(' + expr + ')}catch(e){return JSON.stringify("ERR "+e.message)}})()'));
  const beat = async i => { await run1("document.querySelectorAll('#page-export-basket .ct-step')[" + i + "].scrollIntoView({block:'center',behavior:'instant'})"); await sleep(2600); };
  const key = async k => { await evalJs(`(document.activeElement||document.body).dispatchEvent(new KeyboardEvent('keydown',{key:${JSON.stringify(k)},bubbles:true,cancelable:true}))`); };
  const state = `(()=>{const f=document.getElementById('miFigure'), pn=document.querySelector('#page-export-basket .ct-panel');
    const o={presenting:pn.classList.contains('is-presenting'), step:f.dataset.step, asked:f.dataset.asked||null};
    const steps=[...document.querySelectorAll('#page-export-basket .ct-step')]; o.onBeat=steps.findIndex(s=>s.classList.contains('is-on'));
    if(!o.presenting){ const st=steps[o.onBeat]; if(st){const r=st.getBoundingClientRect(); o.beatMid=Math.round((r.top+r.bottom)/2); } o.focus=document.activeElement.className||document.activeElement.tagName; return o; }
    const p=pn.getBoundingClientRect(); o.panel=[p.left,p.top,p.width,p.height].map(Math.round);
    const bar=pn.querySelector('.pv-bar'), foot=pn.querySelector('.pv-foot'), fr=f.getBoundingClientRect();
    o.where=bar.querySelector('.pv-where').textContent; o.title=bar.querySelector('.pv-title').textContent;
    o.prevDis=bar.querySelector('.pv-prev').disabled; o.nextDis=bar.querySelector('.pv-next').disabled;
    const sv=[...f.querySelectorAll('svg.viz-big')].find(s=>getComputedStyle(s).display!=='none'&&s.getBoundingClientRect().width>0);
    const sr=sv?sv.getBoundingClientRect():null;
    o.fig=[fr.left,fr.top,fr.width,fr.height].map(Math.round); o.svg=sr?[sr.left,sr.top,sr.width,sr.height].map(Math.round):null;
    o.barBottom=Math.round(bar.getBoundingClientRect().bottom);
    o.foot=foot.hidden?null:{top:Math.round(foot.getBoundingClientRect().top), qs:[...foot.querySelectorAll('.pv-q')].map(b=>(b.getAttribute('aria-pressed')==='true'?'* ':'')+b.textContent.slice(0,40)), ans:(foot.querySelector('.pv-ans:not([hidden])')||{}).textContent||null};
    const lim=o.foot?o.foot.top:innerHeight; o.figFits=fr.bottom<=lim+1 && fr.top>=o.barBottom-1;
    o.slotH=[...pn.querySelectorAll(':scope > .ct-slot')].reduce((a,s)=>a+s.offsetHeight,0);
    /* the smallest text on screen inside the view */
    let min=99, at='';
    const vis=e=>{const r=e.getBoundingClientRect(); if(r.width<1||r.height<1) return false; let n=e; while(n&&n!==pn){const c=getComputedStyle(n); if(c.display==='none'||c.visibility==='hidden'||+c.opacity===0) return false; n=n.parentElement;} return true;};
    pn.querySelectorAll('svg text').forEach(t=>{ if(!t.textContent.trim()||!vis(t)) return; const m=t.getScreenCTM(); const s=parseFloat(getComputedStyle(t).fontSize)*(m?Math.hypot(m.a,m.b):1); if(s<min){min=s;at='svg:'+t.textContent.slice(0,24);} });
    pn.querySelectorAll('*').forEach(e=>{ if(e.closest('svg')) return; if(![...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())) return; if(!vis(e)) return; const s=parseFloat(getComputedStyle(e).fontSize); if(s<min){min=s;at=e.tagName+'.'+e.className+':'+e.textContent.trim().slice(0,24);} });
    o.minFont=Math.round(min*100)/100; o.minAt=at;
    o.miType=getComputedStyle(f).getPropertyValue('--mi-type').trim(); o.overflowX=document.documentElement.scrollWidth>innerWidth;
    o.focus=document.activeElement.className||document.activeElement.tagName;
    o.covers=[[2,2],[innerWidth-3,2],[2,innerHeight-3],[innerWidth-3,innerHeight-3],[innerWidth/2,innerHeight/2]].every(([x,y])=>{const h=document.elementFromPoint(x,y); return !!(h&&pn.contains(h));});
    return o;})()`;
  await emulate(W, H);
  await run1("enterTool('page-overview')"); await sleep(2000);
  await run1("showSection(1,false)"); await run1("document.querySelector('.pages').style.scrollBehavior='auto'"); await sleep(1200);
  await beat(0);
  log(W + "x" + H + " doors: " + JSON.stringify(await j(`[...document.querySelectorAll('.pv-open')].filter(b=>getComputedStyle(b).display!=='none'&&b.getBoundingClientRect().width>0).map(b=>{const r=b.getBoundingClientRect(); const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2); return b.className.replace('pv-open ','')+' '+[r.left,r.top,r.width,r.height].map(Math.round).join(',')+' onTop:'+!!(hit&&b.contains(hit)); })`)));
  if (process.env.SHOTS) await shot(process.env.S + "/pv/" + W + "-door.png", { x: 0, y: 0, width: W, height: H, scale: 1 });
  await run1("document.querySelector('#miFigure .pv-open--frame').click()"); await sleep(1800);
  for (let b = 0; b < 3; b++){
    const s = await j(state); log(W + " beat " + (b + 1) + ": " + JSON.stringify(s));
    if (process.env.SHOTS) await shot(process.env.S + "/pv/" + W + "-b" + (b + 1) + ".png", { x: 0, y: 0, width: W, height: H, scale: 1 });
    if (b < 2){ await key("ArrowRight"); await sleep(2600); }
  }
  /* a question from the footer */
  await run1("document.querySelector('.pv-foot .pv-q').click()"); await sleep(2800);
  log(W + " asked: " + JSON.stringify(await j(state)));
  if (process.env.SHOTS) await shot(process.env.S + "/pv/" + W + "-b3-asked.png", { x: 0, y: 0, width: W, height: H, scale: 1 });
  await run1("document.querySelector('.pv-foot .pv-q[aria-pressed=\"true\"]').click()"); await sleep(2400);
  log(W + " unasked: " + JSON.stringify((await j(state)).asked));
  await key("Home"); await sleep(2600);
  log(W + " home: " + JSON.stringify(await j(`[document.getElementById('miFigure').dataset.step, document.querySelector('.pv-title').textContent]`)));
  await key("ArrowRight"); await sleep(2600);
  await key("Escape"); await sleep(1500);
  log(W + " exit: " + JSON.stringify(await j(state)));
  if (process.env.SHOTS) await shot(process.env.S + "/pv/" + W + "-exit.png", { x: 0, y: 0, width: W, height: H, scale: 1 });
  /* P from the page, then the study's other doors */
  await key("p"); await sleep(1500);
  log(W + " P key: " + JSON.stringify((await j(state)).presenting));
  await run1("document.querySelector('.pv-exit').click()"); await sleep(1200);
  for (const at of ["eyebrow", "bar"]){
    await run1(`const s=document.getElementById('miPresentAt'); s.value='${at}'; s.dispatchEvent(new Event('change',{bubbles:true}))`); await sleep(300);
    log(W + " study " + at + ": " + JSON.stringify(await j(`[...document.querySelectorAll('.pv-open')].filter(b=>getComputedStyle(b).display!=='none'&&b.getBoundingClientRect().width>0).map(b=>{const r=b.getBoundingClientRect(); const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2); return b.className.replace('pv-open ','')+' '+[r.left,r.top,r.width,r.height].map(Math.round).join(',')+' onTop:'+!!(hit&&b.contains(hit)); })`)));
    if (process.env.SHOTS) await shot(process.env.S + "/pv/" + W + "-door-" + at + ".png", { x: 0, y: 0, width: W, height: H, scale: 1 });
  }
  await run1(`const s=document.getElementById('miPresentAt'); s.value='frame'; s.dispatchEvent(new Event('change',{bubbles:true}))`);
}
