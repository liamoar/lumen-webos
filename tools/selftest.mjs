// On-TV self test: asks the running Lumen app to launch each tile's app id,
// records whether webOS accepted it, then brings Lumen back to the front.
// Usage: node tools/selftest.mjs [app-id ...]   (default: every tile)
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const cfg = JSON.parse(readFileSync(join(process.env.APPDATA, '.webos', 'tv', 'novacom-devices.json'), 'utf8'));
const host = cfg.find((d) => d.name === (process.env.LUMEN_DEVICE || 'tv')).host;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function evaluate(expression) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const pages = await (await fetch(`http://${host}:9998/json`)).json().catch(() => []);
    const page = pages.find((p) => p.description === 'com.avinash.lumen');
    if (page) {
      return await new Promise((resolve, reject) => {
        const ws = new WebSocket(page.webSocketDebuggerUrl.replace(/^ws:\/\/[^/]+/, `ws://${host}:9998`));
        const t = setTimeout(() => { ws.close(); reject(new Error('timeout')); }, 15000);
        ws.onopen = () => ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
        ws.onmessage = (m) => {
          const msg = JSON.parse(m.data);
          if (msg.id !== 1) return;
          clearTimeout(t); ws.close();
          resolve(msg.result?.result?.value);
        };
        ws.onerror = (e) => { clearTimeout(t); reject(e); };
      });
    }
    await sleep(1500);
  }
  throw new Error('Lumen page not found');
}

const ids = await evaluate(`[].concat(
  JSON.parse(localStorage.getItem('lumen.favorites') || 'null') || LUMEN_CONFIG.defaultFavorites,
  LUMEN_CONFIG.inputs.media ? [LUMEN_CONFIG.inputs.media.id] : [],
  ['com.webos.app.discovery', 'com.webos.app.home', 'com.palm.app.settings']
)`);
const inputs = await evaluate(`Luna.call('luna://com.webos.service.eim/getAllInputStatus',{}).then(r => r.devices.filter(d => d.hdmiPlugIn).map(d => d.appId))`);
const only = process.argv.slice(2);
const all = only.length ? only : [...new Set([...ids, ...inputs])];

const results = [];
for (const id of all) {
  // Store the reply on window and read it back, since the page can be
  // suspended before an awaited evaluation returns.
  await evaluate(`window.__lr = 'PENDING'; Luna.launch(${JSON.stringify(id)}).then(() => { window.__lr = 'OK'; }, e => { window.__lr = 'FAIL ' + (e.errorText || JSON.stringify(e)); }); 1`);
  let res = 'PENDING';
  for (let i = 0; i < 6 && res === 'PENDING'; i++) {
    await sleep(250);
    res = await evaluate('window.__lr').catch(() => undefined) ?? 'NO REPLY (app switched)';
  }
  results.push([id, res]);
  console.log(`${id.padEnd(34)} ${res}`);
  await sleep(res === 'OK' ? 6000 : 500);
  execSync('npx ares-launch -d tv com.avinash.lumen', { stdio: 'ignore' });
  await sleep(4000);
}
const failed = results.filter(([, r]) => r.startsWith('FAIL'));
console.log(failed.length ? `\n${failed.length} failed` : '\nall launches accepted');
process.exit(failed.length ? 1 : 0);
