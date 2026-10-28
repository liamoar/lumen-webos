// Evaluate JavaScript inside the running Lumen app on the TV via its
// remote debugger (dev-mode apps expose it on port 9998).
// Usage: node tools/tveval.mjs "<expression>"   (promises are awaited)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DEVICE = process.env.LUMEN_DEVICE || 'tv';
const cfg = JSON.parse(readFileSync(join(process.env.APPDATA, '.webos', 'tv', 'novacom-devices.json'), 'utf8'));
const host = cfg.find((d) => d.name === DEVICE).host;

const pages = await (await fetch(`http://${host}:9998/json`)).json();
const page = pages.find((p) => p.description === 'com.avinash.lumen');
if (!page) { console.error('Lumen is not running on the TV (npm run launch)'); process.exit(1); }

const ws = new WebSocket(page.webSocketDebuggerUrl.replace(/^ws:\/\/[^/]+/, `ws://${host}:9998`));
ws.onopen = () => ws.send(JSON.stringify({
  id: 1,
  method: 'Runtime.evaluate',
  params: { expression: process.argv.slice(2).join(' '), awaitPromise: true, returnByValue: true }
}));
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id !== 1) return;
  const r = msg.result || {};
  if (r.exceptionDetails) console.error('ERROR', JSON.stringify(r.exceptionDetails.exception?.value ?? r.exceptionDetails.text));
  else console.log(JSON.stringify(r.result?.value, null, 1));
  ws.close();
};
ws.onerror = (e) => { console.error('websocket error', e.message || e); process.exit(1); };
