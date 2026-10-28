// Thin wrapper around the webOS CLI so npm scripts don't hard-code the
// app id/version. Usage: node tools/tv.mjs <build|deploy|launch|uninstall|inspect|status>
import { execSync } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';

const info = JSON.parse(readFileSync(new URL('../app/appinfo.json', import.meta.url)));
const DEVICE = process.env.LUMEN_DEVICE || 'tv';
const ipk = `dist/${info.id}_${info.version}_all.ipk`;
const run = (cmd) => {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: ['ignore', 'inherit', 'inherit'] });
};

const actions = {
  build() {
    run('node tools/make-icons.mjs');
    mkdirSync('dist', { recursive: true });
    run('npx ares-package app service -o dist --no-minify');
  },
  deploy() {
    actions.build();
    run(`npx ares-install -d ${DEVICE} ${ipk}`);
    actions.launch();
  },
  launch() { run(`npx ares-launch -d ${DEVICE} ${info.id}`); },
  uninstall() { run(`npx ares-install -d ${DEVICE} --remove ${info.id}`); },
  inspect() { run(`npx ares-inspect -d ${DEVICE} --app ${info.id} --open`); },
  status() {
    run(`npx ares-device -d ${DEVICE} --system-info`);
    run(`npx ares-install -d ${DEVICE} --list`);
  }
};

const action = actions[process.argv[2]];
if (!action) {
  console.error(`usage: node tools/tv.mjs <${Object.keys(actions).join('|')}>`);
  process.exit(1);
}
try { action(); } catch { process.exit(1); }
