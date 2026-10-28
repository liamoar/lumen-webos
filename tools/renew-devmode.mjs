// Developer Mode on LG TVs expires after ~50 hours and then removes
// sideloaded apps. This reads the session token from the TV and asks LG's
// developer server to reset the timer (what the Developer Mode app's
// "Extend" button does).
import { execSync } from 'node:child_process';

const DEVICE = process.env.LUMEN_DEVICE || 'tv';

let out;
try {
  out = execSync(`npx ares-novacom -d ${DEVICE} --run "cat /var/luna/preferences/devmode_enabled"`,
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
} catch (e) {
  console.error(`${new Date().toISOString()}  Could not reach the TV (is it on, and is Developer Mode still active?)`);
  console.error(e.stderr || e.message);
  process.exit(1);
}

const token = out.trim().split(/\s+/).pop();
if (!/^[A-Za-z0-9]+$/.test(token || '')) {
  console.error('Unexpected token output from TV:', JSON.stringify(out));
  process.exit(1);
}

const res = await fetch(`https://developer.lge.com/secure/ResetDevModeSession.dev?sessionToken=${token}`);
const body = (await res.text()).trim();
console.log(`${new Date().toISOString()}  HTTP ${res.status}  ${body.slice(0, 200)}`);
if (!res.ok) process.exit(1);
