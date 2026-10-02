/* the city's section (Worker Flows / admin mix): does each step's panel fit under the bar? */
export async function run({ evalJs, sleep, shot, emulate, log }){
  const W = +process.env.W || 1440, H = +process.env.H || 900;
  const run1 = expr => evalJs('(()=>{try{' + expr + ';return 1}catch(e){return "ERR "+e.message}})()');
  const j = async expr => JSON.parse(await evalJs('(()=>{try{return JSON.stringify(' + expr + ')}catch(e){return JSON.stringify("ERR "+e.message)}})()'));
  await emulate(W, H);
  await run1("enterTool('page-overview')"); await sleep(2000);
  await run1("showSection(2,false)"); await run1("document.querySelector('.pages').style.scrollBehavior='auto'"); await sleep(1500);
  const n = await j("document.querySelectorAll('#page-admin-mix .ct-step').length");
  log("steps " + n + " at " + W + "x" + H);
  for (let i = 0; i < n; i++){
    await run1("document.querySelectorAll('#page-admin-mix .ct-step')[" + i + "].scrollIntoView({block:'center',behavior:'instant'})"); await sleep(2400);
    const l = await j(`(()=>{const p=document.querySelector('#page-admin-mix'); const r=e=>e.getBoundingClientRect(); const st=r(p.querySelector('.ct-steps')), sg=r(p.querySelector('.ct-stage')), pn=r(p.querySelector('.ct-panel'));
      const chrome=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--chrome-h')); const svgs=[...p.querySelectorAll('.ct-panel svg.viz-big, .ct-panel svg.am-fig')].filter(s=>r(s).width>2&&getComputedStyle(s).display!=='none'&&getComputedStyle(s).visibility!=='hidden').map(s=>s.id+' '+Math.round(r(s).width)+'x'+Math.round(r(s).height));
      const title=(document.querySelectorAll('#page-admin-mix .ct-step')[${i}].querySelector('h2,h3')||{}).textContent;
      return {title:(title||'').trim().slice(0,40), rail:Math.round(st.width), gap:Math.round(sg.left-st.right), stage:Math.round(sg.width), panel:[Math.round(pn.width),Math.round(pn.height)], top:Math.round(pn.top), bottom:Math.round(pn.bottom), avail:Math.round(innerHeight-chrome), fits: pn.bottom<=innerHeight+1&&pn.top>=chrome-1, svgs, overflowX:document.querySelector('.pages').scrollWidth-document.querySelector('.pages').clientWidth};})()`);
    log(i + " " + JSON.stringify(l));
    if (process.env.SHOTS) await shot(process.env.S + "/" + process.env.SHOTS + "-am-" + W + "-" + i + ".png", { x: 0, y: 0, width: W, height: H, scale: W < 700 ? 2 : 1 });
  }
}
