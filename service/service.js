/*
 * Lumen background service.
 *
 *  - Default home: webOS closes Developer Mode apps when another app opens,
 *    so the Lumen app can't react to the Home button itself. This service
 *    keeps running, watches which app is in front and brings Lumen back
 *    whenever LG's home screen comes up, and when the TV wakes from standby.
 *  - Owns the pairing with the TV's local control service (SSAP). The pairing
 *    key lives only in this service's private folder, never in the web app,
 *    and it asks for the minimum permissions Lumen needs.
 *  - Only the Lumen app may call it (every method checks the caller).
 */
'use strict';

const Service = require('webos-service');
const net = require('net');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const APP_ID = 'com.avinash.lumen';
const LG_HOME = ['com.webos.app.home'];
const KEY_FILE = path.join(__dirname, '.pairing');
const CONF_FILE = path.join(__dirname, '.config');

// Least privilege: launch apps, list them, see what's in front, power state.
const MANIFEST = {
  manifestVersion: 1,
  appVersion: '1.0',
  localizedAppNames: { '': 'Lumen home screen' },
  localizedVendorNames: { '': 'Lumen' },
  permissions: ['LAUNCH', 'READ_INSTALLED_APPS', 'READ_RUNNING_APPS', 'READ_POWER_STATE']
};

const service = new Service('com.avinash.lumen.service');

const state = {
  enabled: false,
  clientKey: null,
  allowHomeUntil: 0,
  foreground: null,
  power: null,
  connected: false,
  promptPending: false,
  returns: 0,
  startedAt: Date.now(),
  log: []
};

function log(msg) {
  state.log.push(new Date().toISOString().slice(11, 23) + ' ' + msg);
  if (state.log.length > 40) state.log.shift();
}

// ---------- private storage (owner-only file permissions) ----------
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; }
}
function writeJson(file, obj) {
  try { fs.writeFileSync(file, JSON.stringify(obj), { mode: 0o600 }); } catch (e) { log('write failed ' + e.code); }
}
const savedKey = readJson(KEY_FILE);
if (savedKey && savedKey.clientKey) state.clientKey = savedKey.clientKey;
const savedConf = readJson(CONF_FILE);
if (savedConf) state.enabled = !!savedConf.enabled;

// ---------- keep alive while default home is on ----------
let keepAlive = null;
function holdKeepAlive() {
  if (keepAlive) return;
  service.activityManager.create('lumenHomeWatcher', (activity) => { keepAlive = activity; });
}
function releaseKeepAlive() {
  if (!keepAlive) return;
  service.activityManager.complete(keepAlive, () => {});
  keepAlive = null;
}

// ---------- start again after the TV restarts ----------
// Developer Mode services aren't started at boot. A persistent activity
// (survives reboots) fires when the network comes up and calls boot() below,
// which starts this service again and brings Lumen to the front.
function armBootActivity() {
  if (state.bootArmed) return;
  state.bootArmed = true;
  service.call('luna://com.webos.service.activitymanager/create', {
    activity: {
      name: 'lumen-boot',
      description: 'Start the Lumen home service after the TV starts',
      type: { foreground: true, persist: true },
      trigger: {
        method: 'luna://com.webos.service.connectionmanager/getStatus',
        params: { subscribe: true },
        where: { prop: 'isInternetConnectionAvailable', op: '=', val: true }
      },
      callback: { method: 'luna://com.avinash.lumen.service/boot', params: {} }
    },
    start: true,
    replace: true,
    subscribe: false
  }, (m) => {
    const p = m.payload || {};
    state.bootArmed = !!p.returnValue;
    log(p.returnValue ? 'boot activity armed' : 'boot activity failed: ' + (p.errorText || JSON.stringify(p)));
  });
}

function disarmBootActivity() {
  service.call('luna://com.webos.service.activitymanager/cancel', { activityName: 'lumen-boot' }, (m) => {
    state.bootArmed = false;
    log('boot activity cancelled ' + JSON.stringify(m.payload || {}).slice(0, 80));
  });
}

// ---------- minimal WebSocket client for ws://127.0.0.1:3000 (local only) ----------
function WsClient(onMessage, onClose) {
  const sock = net.connect(3000, '127.0.0.1');
  const key = crypto.randomBytes(16).toString('base64');
  let buf = Buffer.alloc(0);
  let upgraded = false;
  let openCb = null;

  sock.on('connect', () => {
    sock.write('GET / HTTP/1.1\r\nHost: 127.0.0.1:3000\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
      'Sec-WebSocket-Key: ' + key + '\r\nSec-WebSocket-Version: 13\r\n\r\n');
  });
  sock.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    if (!upgraded) {
      const end = buf.indexOf('\r\n\r\n');
      if (end === -1) return;
      if (!/^HTTP\/1\.1 101/.test(buf.slice(0, end).toString())) { sock.destroy(); return; }
      upgraded = true;
      buf = buf.slice(end + 4);
      if (openCb) openCb();
    }
    for (;;) {
      if (buf.length < 2) return;
      const op = buf[0] & 0x0f;
      let len = buf[1] & 0x7f, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      if (buf.length < off + len) return;
      const payload = buf.slice(off, off + len);
      buf = buf.slice(off + len);
      if (op === 1) onMessage(payload.toString());
      else if (op === 9) send(payload, 0x0a);
      else if (op === 8) sock.end();
    }
  });
  sock.on('close', onClose);
  sock.on('error', (e) => log('socket error ' + e.code));

  function send(data, opcode) {
    const payload = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const mask = crypto.randomBytes(4);
    let header;
    if (payload.length < 126) header = Buffer.from([0x80 | opcode, 0x80 | payload.length]);
    else { header = Buffer.alloc(4); header[0] = 0x80 | opcode; header[1] = 0x80 | 126; header.writeUInt16BE(payload.length, 2); }
    const masked = Buffer.alloc(payload.length);
    for (let i = 0; i < payload.length; i++) masked[i] = payload[i] ^ mask[i % 4];
    sock.write(Buffer.concat([header, mask, masked]));
  }

  return {
    onOpen(cb) { openCb = cb; },
    sendText(text) { send(text, 0x01); },
    close() { sock.destroy(); }
  };
}

// ---------- control-service session ----------
let ws = null;
let seq = 0;
const pending = {};
let readyWaiters = [];
let retryTimer = null;

function whenReady() {
  if (state.connected) return Promise.resolve();
  return new Promise((resolve, reject) => {
    readyWaiters.push({ resolve, reject });
    connect();
  });
}

function settleWaiters(err) {
  const w = readyWaiters;
  readyWaiters = [];
  w.forEach((x) => (err ? x.reject(err) : x.resolve()));
}

// Pairing prompts are only allowed when the Lumen app explicitly asks (pair()).
let allowPrompt = false;

function connect() {
  if (ws) return;
  if (!state.clientKey && !allowPrompt) { settleWaiters(new Error('not paired')); return; }
  ws = WsClient(onMessage, () => {
    state.connected = false;
    ws = null;
    Object.keys(pending).forEach((id) => { pending[id].reject(new Error('disconnected')); delete pending[id]; });
    settleWaiters(new Error('disconnected'));
    if (state.enabled && state.clientKey) retryTimer = setTimeout(connect, 3000);
  });
  ws.onOpen(() => {
    const payload = { pairingType: 'PROMPT', manifest: MANIFEST };
    if (state.clientKey) payload['client-key'] = state.clientKey;
    ws.sendText(JSON.stringify({ id: 'reg', type: 'register', payload }));
  });
}

function request(uri, payload) {
  return whenReady().then(() => new Promise((resolve, reject) => {
    const id = 'q' + (++seq);
    const timer = setTimeout(() => { delete pending[id]; reject(new Error('timeout')); }, 8000);
    pending[id] = {
      resolve: (p) => { clearTimeout(timer); resolve(p); },
      reject: (e) => { clearTimeout(timer); reject(e); }
    };
    ws.sendText(JSON.stringify({ id, type: 'request', uri, payload: payload || {} }));
  }));
}

function onMessage(text) {
  let msg;
  try { msg = JSON.parse(text); } catch (e) { return; }
  if (msg.id === 'reg') {
    if (msg.type === 'response' && msg.payload && msg.payload.pairingType === 'PROMPT') {
      state.promptPending = true;
      log('pairing prompt shown on TV');
    } else if (msg.type === 'registered') {
      state.promptPending = false;
      allowPrompt = false;
      const key = msg.payload && msg.payload['client-key'];
      if (key && key !== state.clientKey) {
        state.clientKey = key;
        writeJson(KEY_FILE, { clientKey: key });
        log('paired');
      }
      state.connected = true;
      log('connected');
      subscribeWatchers();
      if (state.openOnConnect) { const r = state.openOnConnect; state.openOnConnect = null; openLumen(r); }
      settleWaiters();
    } else if (msg.type === 'error') {
      state.promptPending = false;
      log('register failed: ' + msg.error);
      if (state.clientKey && !allowPrompt) {
        // the TV no longer accepts this pairing; drop it so Lumen can ask again
        state.clientKey = null;
        try { fs.unlinkSync(KEY_FILE); } catch (e) { /* ignore */ }
      }
      allowPrompt = false;
      settleWaiters(new Error(msg.error || 'pairing failed'));
      if (ws) ws.close();
    }
    return;
  }
  if (msg.id === 'fg' && msg.payload) { onForeground(msg.payload.appId || ''); return; }
  if (msg.id === 'pw' && msg.payload) { onPower(msg.payload.state || ''); return; }
  const p = pending[msg.id];
  if (p) {
    delete pending[msg.id];
    if (msg.type === 'error' || (msg.payload && msg.payload.returnValue === false)) p.reject(new Error(msg.error || 'request failed'));
    else p.resolve(msg.payload || {});
  }
}

function subscribeWatchers() {
  ws.sendText(JSON.stringify({ id: 'fg', type: 'subscribe', uri: 'ssap://com.webos.applicationManager/getForegroundAppInfo' }));
  ws.sendText(JSON.stringify({ id: 'pw', type: 'subscribe', uri: 'ssap://com.webos.service.tvpower/power/getPowerState' }));
}

function openLumen(reason) {
  if (!ws || !state.connected) { state.openOnConnect = reason; return; }
  state.returns++;
  log(reason + ' -> opening Lumen');
  ws.sendText(JSON.stringify({ id: 'launch' + state.returns, type: 'request', uri: 'ssap://system.launcher/launch', payload: { id: APP_ID } }));
}

// While the TV is off the foreground is empty. Between ordinary app switches
// it's empty for about a second, so a long gap followed by any app or input
// (LG Home, HDMI, last app) means the TV was just turned on.
const POWER_GAP_MS = 6000;

function onForeground(appId) {
  if (appId === state.foreground) return;
  const now = Date.now();
  if (!appId) state.emptySince = now;
  const wasOff = !!appId && state.emptySince && now - state.emptySince > POWER_GAP_MS;
  if (appId) state.emptySince = 0;
  state.foreground = appId;
  log('foreground: ' + (appId || '(none)'));
  if (wasOff && state.enabled && appId !== APP_ID) {
    state.allowHomeUntil = 0;
    openLumen('TV turned on');
    return;
  }
  const isHome = LG_HOME.indexOf(appId) !== -1;
  // the one-time LG Home pass ends as soon as an app is opened from it
  if (!isHome && appId && appId !== APP_ID) state.allowHomeUntil = 0;
  if (!state.enabled || !isHome) return;
  if (Date.now() < state.allowHomeUntil) { log('LG Home allowed (requested)'); return; }
  openLumen('LG Home');
}

function onPower(power) {
  const was = state.power;
  if (power === was) return;
  state.power = power;
  log('power: ' + power);
  if (state.enabled && power === 'Active' && was && was !== 'Active') {
    state.allowHomeUntil = 0;
    openLumen('TV turned on');
  }
}

// ---------- Luna API: Lumen app only ----------
function guard(handler) {
  return (msg) => {
    if (msg.sender !== APP_ID) {
      msg.respond({ returnValue: false, errorText: 'not allowed' });
      return;
    }
    handler(msg);
  };
}

function status() {
  return {
    returnValue: true,
    paired: !!state.clientKey,
    enabled: state.enabled,
    connected: state.connected,
    promptPending: state.promptPending,
    foreground: state.foreground,
    power: state.power,
    returns: state.returns,
    keepAlive: !!keepAlive,
    bootArmed: !!state.bootArmed,
    uptimeSec: Math.round((Date.now() - state.startedAt) / 1000),
    log: state.log
  };
}

service.register('status', guard((msg) => msg.respond(status())));

service.register('configure', guard((msg) => {
  const p = msg.payload || {};
  if (typeof p.enabled === 'boolean' && p.enabled !== state.enabled) {
    state.enabled = p.enabled;
    writeJson(CONF_FILE, { enabled: state.enabled });
    log('default home ' + (state.enabled ? 'ON' : 'OFF'));
  }
  if (state.enabled) {
    holdKeepAlive();
    armBootActivity();
    if (state.clientKey) connect();
  } else {
    clearTimeout(retryTimer);
    releaseKeepAlive();
    disarmBootActivity();
  }
  msg.respond(status());
}));

// Starts pairing (shows the Allow prompt on the TV) if not paired yet.
service.register('pair', guard((msg) => {
  if (!state.clientKey) allowPrompt = true;
  whenReady().then(
    () => msg.respond({ returnValue: true, paired: true }),
    (e) => msg.respond({ returnValue: false, errorText: e.message })
  );
}));

service.register('listApps', guard((msg) => {
  request('ssap://com.webos.applicationManager/listLaunchPoints').then((r) => {
    const apps = (r.launchPoints || []).map((p) => ({
      id: p.id, title: p.title, icon: p.largeIcon || p.icon, iconColor: p.iconColor || p.bgColor
    }));
    msg.respond({ returnValue: true, apps });
  }, (e) => msg.respond({ returnValue: false, errorText: e.message }));
}));

// Let LG Home stay open this once (Lumen's own "LG Home" button). The pass
// ends when an app is opened from LG Home, or after 30 minutes.
service.register('allowLgHome', guard((msg) => {
  state.allowHomeUntil = Date.now() + 30 * 60 * 1000;
  log('LG Home pass granted');
  msg.respond(status());
}));

// Called by the persistent activity. It fires once right after it's armed
// (the network is already up) and again after every TV restart, when the
// activity manager restores it and starts this service. The activity is never
// completed, so it stays armed and can't loop. Only a freshly started service
// (i.e. after a restart) opens Lumen; it only opens Lumen, so it doesn't need
// the Lumen-only check.
const BOOT_WINDOW_MS = 30000;
service.register('boot', (msg) => {
  const fresh = Date.now() - state.startedAt < BOOT_WINDOW_MS;
  log('boot trigger (' + (fresh ? 'service just started' : 'already running') + ')');
  msg.respond({ returnValue: true });
  if (!fresh || state.bootHandled || !state.enabled || !state.clientKey) return;
  state.bootHandled = true;
  state.bootArmed = true;
  holdKeepAlive();
  openLumen('TV started');
  connect();
});

log('service started' + (state.clientKey ? ' (paired)' : ''));
if (state.enabled && state.clientKey) { holdKeepAlive(); connect(); }
