// Screenshot the running Lumen app on the TV, optionally pressing remote
// keys first. Usage: node tools/tvshot.mjs out.jpg [keyCode ...]
//   e.g. node tools/tvshot.mjs home.jpg 40 39   (down, right, then capture)
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const cfg = JSON.parse(readFileSync(join(process.env.APPDATA, '.webos', 'tv', 'novacom-devices.json'), 'utf8'));
const host = cfg.find((d) => d.name === (process.env.LUMEN_DEVICE || 'tv')).host;
const [out, ...keys] = process.argv.slice(2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const page = (await (await fetch(`http://${host}:9998/json`)).json()).find((p) => p.description === 'com.avinash.lumen');
if (!page) { console.error('Lumen is not running on the TV'); process.exit(1); }
const ws = new WebSocket(page.webSocketDebuggerUrl.replace(/^ws:\/\/[^/]+/, `ws://${host}:9998`));
let id = 0;
const send = (method, params = {}) => new Promise((resolve) => {
  const i = ++id;
  const h = (m) => { const d = JSON.parse(m.data); if (d.id === i) { ws.removeEventListener('message', h); resolve(d.result); } };
  ws.addEventListener('message', h);
  ws.send(JSON.stringify({ id: i, method, params }));
});
ws.onopen = async () => {
  for (const k of keys) {
    await send('Runtime.evaluate', { expression: `var ev=new KeyboardEvent('keydown',{bubbles:true});Object.defineProperty(ev,'keyCode',{value:${+k}});document.dispatchEvent(ev);1` });
    await sleep(450);
  }
  await sleep(1200);
  const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 82 });
  writeFileSync(out, Buffer.from(r.data, 'base64'));
  console.log('saved', out);
  ws.close();
};
