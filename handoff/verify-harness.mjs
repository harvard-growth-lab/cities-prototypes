import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9400 + Math.floor(Math.random() * 400);
const prof = `/tmp/nt-cdp-prof-${port}`;
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars',
  `--remote-debugging-port=${port}`, '--remote-allow-origins=*', '--window-size=1500,1000', `--user-data-dir=${prof}`, 'about:blank'], { stdio: 'ignore' });
async function targets(){ for (let i = 0; i < 100; i++){ try { const r = await fetch(`http://127.0.0.1:${port}/json`); return await r.json(); } catch { await new Promise(r => setTimeout(r, 150)); } } throw new Error('chrome did not come up'); }
const page = (await targets()).find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pending = new Map(); const errors = []; const out = [];
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = e => rej(new Error('ws error ' + (e.message || ''))); ws.onclose = e => rej(new Error('ws closed ' + e.code + ' ' + e.reason)); });
const finish = code => { chrome.kill(); setTimeout(() => { try { fs.rmSync(prof, { recursive: true, force: true }); } catch {} process.exit(code); }, 300); };
setTimeout(() => { console.log(JSON.stringify([{ HARNESS_TIMEOUT: true, partial: out }, { consoleErrors: errors }], null, 1)); finish(2); }, 150000);
ws.onmessage = e => { const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)){ pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
  if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errors.push(m.params.entry.text); };
const send = (method, params = {}) => new Promise(res => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable'); await send('Emulation.setFocusEmulationEnabled', { enabled: true });
const emulate = (width, height) => send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 768 });
await emulate(1500, 1000);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const evalJs = async expr => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || JSON.stringify(r.result.exceptionDetails)); return r.result.result.value; };
const shot = async (name, clip) => { const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, ...(clip ? { clip } : {}) }); fs.writeFileSync(name, Buffer.from(r.result.data, 'base64')); };
try {
  await send('Page.navigate', { url: process.argv[3] }); await sleep(2500);
  const mod = await import(pathToFileURL(path.resolve(process.argv[2])).href);
  await mod.run({ evalJs, sleep, shot, emulate, log: x => out.push(x) });
} catch (e) { out.push({ HARNESS_ERROR: String(e) }); }
out.push({ consoleErrors: errors });
console.log(JSON.stringify(out, null, 1));
finish(0);
