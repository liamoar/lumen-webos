// Run a shell command on the TV over SSH and print its output reliably
// (ares-novacom --run sometimes drops output). Uses the device registered
// with ares-setup-device. Usage: node tools/tvsh.mjs "<command>"
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { Client } = require('../node_modules/@webos-tools/cli/node_modules/ssh2');

const DEVICE = process.env.LUMEN_DEVICE || 'tv';
const cfgPath = join(process.env.APPDATA || join(homedir(), '.config'), '.webos', 'tv', 'novacom-devices.json');
const dev = JSON.parse(readFileSync(cfgPath, 'utf8')).find((d) => d.name === DEVICE);
if (!dev) { console.error(`device "${DEVICE}" not found in ${cfgPath}`); process.exit(1); }

const cmd = process.argv.slice(2).join(' ');
const conn = new Client();
conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) { console.error(err.message); conn.end(); process.exit(1); }
    stream.on('data', (d) => process.stdout.write(d));
    stream.stderr.on('data', (d) => process.stderr.write(d));
    stream.on('close', (code) => { conn.end(); process.exitCode = code || 0; });
  });
}).on('error', (e) => { console.error(e.message); process.exit(1); }).connect({
  host: dev.host,
  port: dev.port,
  username: dev.username,
  privateKey: readFileSync(join(homedir(), '.ssh', dev.privateKey.openSsh || dev.privateKey)),
  passphrase: dev.passphrase,
  readyTimeout: 15000
});
