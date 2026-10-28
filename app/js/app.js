(function () {
  'use strict';

  var C = window.LUMEN_CONFIG;
  var STAGE_W = 1920, STAGE_H = 1080, PAD_X = 96;

  var KEY = {
    LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13,
    BACK: 461, ESC: 27, BACKSPACE: 8,
    RED: 403, GREEN: 404, YELLOW: 405, BLUE: 406
  };

  var $ = function (id) { return document.getElementById(id); };
  var stage = $('stage');

  // ---------- storage ----------
  function load(key, fallback) {
    try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
  }

  var settings = Object.assign({}, C.defaults, load('lumen.settings', {}));

  var state = {
    apps: load('lumen.apps', null),       // installed apps from the TV (cached)
    icons: load('lumen.icons', {}),        // id -> {file, data}: saved copies of app icons
    appsFresh: false,                      // icon URLs from the TV are only valid per session
    favorites: load('lumen.favorites', null),
    inputDevices: [],
    inputSig: '',
    scope: 'home',                         // home | panel | picker | inputs
    focusEl: null,
    homeKey: null,                         // last focused key on the home screen
    moving: false,
    panelIndex: 0
  };

  // ---------- helpers ----------
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function fitStage() {
    var s = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
    stage.style.transform = s === 1 ? '' : 'scale(' + s + ')';
  }

  var toastTimer;
  function toast(msg, ms) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, ms || 2600);
  }

  var ICON = {
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
    palette: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 0 18c1 0 1.6-.8 1.6-1.6 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5c0-4-4-7.4-9-7.4z"/><circle cx="7.5" cy="11" r="1" fill="currentColor"/><circle cx="10.5" cy="7.5" r="1" fill="currentColor"/><circle cx="15" cy="7.5" r="1" fill="currentColor"/></svg>',
    input: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4M10 9l3 2-3 2"/></svg>',
    wifi: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19" r=".8" fill="currentColor"/></svg>',
    wired: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="3" width="12" height="10" rx="1.5"/><path d="M9 13v3h6v-3M12 16v5M9 7h.01M12 7h.01M15 7h.01"/></svg>',
    offline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 9a14 14 0 0 1 5-3M12 5a14 14 0 0 1 9.5 4M8.5 16a5 5 0 0 1 7 0M3 3l18 18"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 11 12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5M10 20v-5.5h4V20"/></svg>',
    store: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8h14l-1 12H6z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
  };

  // ---------- data: apps ----------
  function installedApps() {
    return state.apps || (Luna.onTV ? [] : C.previewApps);
  }
  function appInfo(id) {
    var list = installedApps();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function isInputId(id) { return /^com\.webos\.app\.(hdmi|externalinput)/.test(id); }

  function appItem(id) {
    var a = appInfo(id) || {};
    var b = C.brands[id] || {};
    var color = a.iconColor && !/^#f{3,6}$/i.test(a.iconColor) ? a.iconColor : '#1c1c1e';
    return {
      key: 'app:' + id,
      kind: 'app',
      id: id,
      title: a.title || id,
      kicker: 'App',
      icon: iconFor(a),
      bg: b.bg || color,
      logo: b.logo,
      logoColor: b.logoColor,
      accent: b.accent || color
    };
  }

  function favoriteIds() {
    if (state.favorites) return state.favorites;
    var installed = state.apps;
    return C.defaultFavorites.filter(function (id) { return !installed || appInfo(id); });
  }
  function setFavorites(ids) {
    state.favorites = ids;
    save('lumen.favorites', ids);
  }

  function favoriteItems() {
    var items = [];
    favoriteIds().forEach(function (id) {
      if (isInputId(id)) {
        var dev = state.inputDevices.filter(function (d) { return d.appId === id; })[0];
        if (dev) items.push(Object.assign(inputItem(dev), { key: 'app:' + id }));
      } else if (!state.apps || appInfo(id)) {
        items.push(appItem(id));
      }
    });
    items.push({ key: 'add', kind: 'add', title: 'Add apps', kicker: 'Favorites', accent: '#8e8e93' });
    return items;
  }

  // ---------- data: inputs ----------
  function isPlugged(dev) {
    if (dev.hdmiPlugIn === true || dev.hdmiSignalExist === true) return true;
    return dev.hdmiPlugIn === undefined && dev.connected === true;
  }
  function inputItem(dev) {
    var type = String(dev.icon || '').replace(/\.png$/i, '').toLowerCase();
    var style = C.inputs.styles[type] || C.inputs.styles['default'];
    var port = dev.port ? 'HDMI ' + dev.port : String(dev.id || '').replace(/_/g, ' ');
    return {
      key: 'input:' + dev.appId,
      kind: 'input',
      id: dev.appId,
      title: dev.label || port,
      kicker: port,
      badge: port,
      bg: style.bg,
      glyph: style.glyph,
      accent: style.accent,
      dim: !isPlugged(dev)
    };
  }
  function inputItems(all) {
    var list = state.inputDevices
      .filter(function (d) { return d.appId && (all || C.inputs.showDisconnected || isPlugged(d)); })
      .sort(function (a, b) { return (a.port || 99) - (b.port || 99); })
      .map(inputItem);
    var m = C.inputs.media;
    list.push({ key: 'input:' + m.id, kind: 'input', id: m.id, title: m.title, kicker: m.kicker, bg: m.bg, glyph: m.glyph, accent: m.accent });
    return list;
  }

  // ---------- tiles ----------
  function logoSvg(name, color) {
    var L = window.LUMEN_LOGOS[name];
    return '<svg class="tile-logo logo-' + name + '" viewBox="0 0 24 24"><path fill="' + color + '" d="' + L.d + '"/></svg>';
  }

  function tileEl(item) {
    var t = el('div', 'tile tile-' + item.kind + (item.dim ? ' dim' : ''));
    t.dataset.f = '1';
    t.dataset.key = item.key;
    t._item = item;

    var face = el('div', 'tile-face');
    if (item.kind === 'add') {
      face.innerHTML = '<div class="tile-plus">' + ICON.plus + '</div>';
    } else if (item.kind === 'input') {
      face.style.background = item.bg;
      face.innerHTML = '<div class="tile-glyph">' + item.glyph + '</div><div class="tile-name">' + esc(item.title) + '</div>';
      if (item.badge) face.appendChild(el('span', 'tile-badge', esc(item.badge)));
    } else {
      var brand = settings.tiles === 'brand';
      if (brand) face.style.background = item.bg;
      if (item.logo && window.LUMEN_LOGOS[item.logo]) {
        var color = brand && settings.logoColor === 'brand' ? (item.logoColor || '#fff') : '#fff';
        face.insertAdjacentHTML('beforeend', logoSvg(item.logo, color));
      } else if (item.icon) {
        if (brand) {
          // stretch the icon's corner pixel to extend its own colour across the tile
          var fill = el('div', 'tile-fill');
          fill.style.backgroundImage = 'url("' + item.icon + '")';
          face.appendChild(fill);
        }
        var img = el('img', 'tile-icon');
        img.alt = '';
        img.onerror = function () { img.replaceWith(el('div', 'tile-name', esc(item.title))); };
        img.src = item.icon;
        face.appendChild(img);
      } else {
        face.appendChild(el('div', 'tile-name', esc(item.title)));
      }
    }
    face.appendChild(el('div', 'tile-sheen'));
    t.appendChild(face);
    t.appendChild(el('div', 'tile-label', esc(item.title)));

    t.addEventListener('mouseenter', function () { if (!state.moving) setFocus(t); });
    t.addEventListener('click', function () { setFocus(t); activate(); });
    return t;
  }

  // ---------- home rendering ----------
  function section(title, cls, items) {
    var sec = el('section', 'sec ' + cls);
    if (title) sec.appendChild(el('h2', 'sec-title', esc(title)));
    var track = el('div', 'track');
    track._x = 0;
    items.forEach(function (item) { track.appendChild(tileEl(item)); });
    sec.appendChild(track);
    return sec;
  }

  function renderHome() {
    var content = $('content');
    content.textContent = '';
    content.style.transform = '';
    content._y = 0;
    var favs = favoriteItems();
    var inputs = inputItems(false);
    if (settings.layout === 'rows') {
      content.appendChild(section('Favorites', 'row lg', favs));
      content.appendChild(section('Inputs', 'row md', inputs));
    } else if (settings.layout === 'mosaic') {
      content.appendChild(section(null, 'mosaic', favs));
      content.appendChild(section('Inputs', 'grid small', inputs));
    } else {
      content.appendChild(section(null, 'grid', favs));
      content.appendChild(section('Inputs', 'grid small', inputs));
    }
    if (state.scope !== 'home') return;
    var target = (state.homeKey && $('home').querySelector('[data-key="' + state.homeKey + '"]')) ||
      content.querySelector('[data-f]');
    state.focusEl = null;
    setFocus(target);
  }

  function applySettings() {
    var cls = ['layout-' + settings.layout, 'tiles-' + settings.tiles, 'labels-' + settings.labels,
      'font-' + settings.font, 'dim-' + settings.dim];
    if (settings.clock === 'hide') cls.push('no-clock');
    if (settings.weather === 'hide') cls.push('no-weather');
    if (state.moving) cls.push('moving');
    stage.className = cls.join(' ');
  }

  // ---------- focus & spatial navigation ----------
  function scopeRoot() {
    if (state.scope === 'picker') return $('picker');
    if (state.scope === 'inputs') return $('inputs-sheet');
    if (state.scope === 'panel') return $('panel');
    return $('home');
  }

  function setFocus(target) {
    if (!target || target === state.focusEl) return;
    if (state.focusEl) state.focusEl.classList.remove('focused');
    state.focusEl = target;
    target.classList.add('focused');
    if (state.scope === 'home') {
      state.homeKey = target.dataset.key;
      reveal(target);
      if (target._item) updateHero(target._item);
    } else {
      revealInScroller(target);
    }
    if (state.scope === 'panel') state.panelIndex = target._index;
    renderHints();
  }

  function offsetWithin(node, ancestor) {
    var y = 0;
    while (node && node !== ancestor) { y += node.offsetTop; node = node.offsetParent; }
    return y;
  }

  function reveal(t) {
    var track = t.parentNode;
    if (track.classList.contains('track') && track.parentNode.classList.contains('row')) {
      var x = track._x || 0;
      var left = t.offsetLeft, right = left + t.offsetWidth;
      if (left - PAD_X < x) x = left - PAD_X;
      if (right + PAD_X > x + STAGE_W) x = right + PAD_X - STAGE_W;
      x = Math.max(0, x);
      if (x !== track._x) { track._x = x; track.style.transform = 'translateX(' + -x + 'px)'; }
    }
    var content = $('content');
    if (!content.contains(t)) return;
    var viewH = content.parentNode.clientHeight;
    var maxY = Math.max(0, content.offsetHeight - viewH);
    var y;
    if (settings.layout === 'rows') {
      y = Math.min(t.closest('.sec').offsetTop, maxY);
    } else {
      var pos = offsetWithin(t, content);
      y = content._y || 0;
      if (pos - 40 < y) y = pos - 40;
      if (pos + t.offsetHeight + 80 > y + viewH) y = pos + t.offsetHeight + 80 - viewH;
      y = clamp(y, 0, maxY);
    }
    if (y !== content._y) { content._y = y; content.style.transform = 'translateY(' + -y + 'px)'; }
  }

  function revealInScroller(t) {
    var sc = t.closest('.scroller');
    if (!sc) return;
    var inner = sc.firstElementChild;
    var pos = offsetWithin(t, inner);
    var y = inner._y || 0, viewH = sc.clientHeight;
    if (pos - 30 < y) y = pos - 30;
    if (pos + t.offsetHeight + 60 > y + viewH) y = pos + t.offsetHeight + 60 - viewH;
    y = clamp(y, 0, Math.max(0, inner.offsetHeight - viewH));
    inner._y = y;
    inner.style.transform = 'translateY(' + -y + 'px)';
  }

  // Picks the nearest focusable in the pressed direction. Left/right stay
  // within the current row; up/down favour the tile closest horizontally.
  function moveFocus(dx, dy) {
    var cur = state.focusEl;
    var all = Array.prototype.slice.call(scopeRoot().querySelectorAll('[data-f]'));
    if (!cur || all.indexOf(cur) === -1) { setFocus(all[0]); return; }
    var r = cur.getBoundingClientRect();
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var best = null, bestScore = Infinity;
    all.forEach(function (e) {
      if (e === cur) return;
      var b = e.getBoundingClientRect();
      var ex = b.left + b.width / 2, ey = b.top + b.height / 2;
      var primary, secondary, weight;
      if (dx) {
        primary = (ex - cx) * dx;
        if (primary <= 8) return;
        if (b.bottom < r.top + 4 || b.top > r.bottom - 4) return;
        secondary = Math.abs(ey - cy); weight = 3;
      } else {
        primary = (ey - cy) * dy;
        if (primary <= 8) return;
        secondary = Math.abs(ex - cx); weight = 1.2;
      }
      var score = primary + secondary * weight;
      if (score < bestScore) { bestScore = score; best = e; }
    });
    if (best) setFocus(best);
  }

  // ---------- hero ----------
  var heroTimer, heroItem;
  function updateHero(item) {
    if (item === heroItem) return;
    heroItem = item;
    $('glow').style.color = item.accent || '#5e5ce6';
    if (settings.layout !== 'rows') return;
    var hero = $('hero');
    hero.classList.add('swap');
    clearTimeout(heroTimer);
    heroTimer = setTimeout(function () {
      $('hero-kicker').textContent = item.kicker || '';
      $('hero-title').textContent = item.title;
      $('hero-sub').textContent = state.moving ? 'Use ◀ ▶ to move, OK to finish'
        : item.kind === 'add' ? 'Choose apps for your home screen' : 'Press OK to open';
      hero.classList.remove('swap');
    }, 120);
  }

  // ---------- actions ----------
  function launch(id, title, params) {
    Luna.launch(id, params).then(function (res) {
      if (res && res.preview) toast('Preview: would open ' + title);
    }).catch(function (e) {
      console.warn('launch failed', id, e);
      toast('Couldn’t open ' + title);
    });
  }

  function activate() {
    var t = state.focusEl;
    if (!t) return;
    if (state.moving) { setMoving(false); return; }
    if (t._action) { t._action(); return; }
    var item = t._item;
    if (!item) return;
    if (item.kind === 'add') { openPicker(); return; }
    t.classList.remove('pressed');
    void t.offsetWidth;
    t.classList.add('pressed');
    launch(item.id, item.title);
  }

  function setMoving(on) {
    state.moving = on;
    if (state.focusEl) state.focusEl.classList.toggle('lifted', on);
    applySettings();
    heroItem = null;
    if (state.focusEl && state.focusEl._item) updateHero(state.focusEl._item);
    renderHints();
  }

  function reorder(step) {
    var item = state.focusEl && state.focusEl._item;
    var ids = favoriteIds().slice();
    var i = ids.indexOf(item.id), n = i + step;
    if (i < 0 || n < 0 || n >= ids.length) return;
    ids[i] = ids[n]; ids[n] = item.id;
    setFavorites(ids);
    renderHome();
    state.focusEl.classList.add('lifted');
  }

  function isFavoriteTile(t) {
    return !!(t && t._item && t._item.key === 'app:' + t._item.id && favoriteIds().indexOf(t._item.id) !== -1);
  }

  function onColorKey(code) {
    var t = state.focusEl;
    if (code === KEY.GREEN) { if (state.scope === 'picker') closeOverlay(); else openPicker(); return; }
    if (code === KEY.BLUE) { togglePanel(); return; }
    if (state.scope !== 'home' || !t || !t._item) return;
    var item = t._item;
    if (code === KEY.RED) {
      if (isFavoriteTile(t)) { setMoving(!state.moving); return; }
      if (item.kind === 'input') {
        var ids = favoriteIds().slice();
        if (ids.indexOf(item.id) === -1) {
          ids.push(item.id);
          setFavorites(ids);
          toast(item.title + ' pinned to Favorites');
          renderHome();
        }
      }
    } else if (code === KEY.YELLOW && isFavoriteTile(t) && !state.moving) {
      setFavorites(favoriteIds().filter(function (id) { return id !== item.id; }));
      toast(item.title + ' removed');
      renderHome();
    }
  }

  function renderHints() {
    var h = [];
    var t = state.focusEl;
    if (state.scope === 'picker') {
      h.push(['', 'OK  Add or remove'], ['', 'BACK  Done']);
    } else if (state.scope === 'panel') {
      h.push(['', '◀ ▶  Change'], ['', 'BACK  Close']);
    } else if (state.scope === 'name') {
      h.push(['', 'OK  Save'], ['', 'BACK  Cancel']);
    } else if (state.scope === 'inputs') {
      h.push(['', 'OK  Switch'], ['', 'BACK  Close']);
    } else if (state.moving) {
      h.push(['red', 'Done']);
    } else if (isFavoriteTile(t)) {
      h.push(['red', 'Move'], ['yellow', 'Remove'], ['green', 'Add apps'], ['blue', 'Customize']);
    } else if (t && t._item && t._item.kind === 'input') {
      h.push(['red', 'Pin to Favorites'], ['green', 'Add apps'], ['blue', 'Customize']);
    } else {
      h.push(['green', 'Add apps'], ['blue', 'Customize']);
    }
    $('hints').innerHTML = h.map(function (x) {
      return '<span class="hint">' + (x[0] ? '<i class="dot ' + x[0] + '"></i>' : '') + x[1] + '</span>';
    }).join('');
  }

  // ---------- top bar ----------
  function topButton(key, icon, label, action) {
    var b = el('div', 'icon-btn', icon + '<span class="icon-tip">' + label + '</span>');
    b.dataset.f = '1';
    b.dataset.key = 'top:' + key;
    b._action = action;
    b.addEventListener('mouseenter', function () { setFocus(b); });
    b.addEventListener('click', function () { setFocus(b); action(); });
    return b;
  }

  function renderTopButtons() {
    var host = $('top-buttons');
    host.textContent = '';
    var wifi = topButton('wifi', ICON.wifi, 'Network', function () {
      launch('com.palm.app.settings', 'Network settings', { target: 'network' });
    });
    wifi.id = 'wifi-btn';
    host.appendChild(wifi);
    host.appendChild(topButton('inputs', ICON.input, 'Inputs', openInputs));
    host.appendChild(topButton('store', ICON.store, 'LG Apps store', function () {
      launch('com.webos.app.discovery', 'LG Apps');
    }));
    host.appendChild(topButton('lghome', ICON.home, 'LG Home', function () {
      homeService('allowLgHome', {}).then(function () { launch('com.webos.app.home', 'LG Home'); });
    }));
    host.appendChild(topButton('add', ICON.plus, 'Add apps', openPicker));
    host.appendChild(topButton('customize', ICON.palette, 'Customize', togglePanel));
    host.appendChild(topButton('settings', ICON.gear, 'Settings', function () {
      launch('com.palm.app.settings', 'Settings');
    }));
  }

  function renderNetwork(res) {
    var b = $('wifi-btn');
    if (!b) return;
    var wifi = res.wifi || {}, wired = res.wired || {};
    var icon, label;
    if (wired.state === 'connected') { icon = ICON.wired; label = 'Ethernet'; }
    else if (wifi.state === 'connected') { icon = ICON.wifi; label = wifi.ssid || 'Wi-Fi'; }
    else { icon = ICON.offline; label = 'Not connected'; }
    b.classList.toggle('warn', icon === ICON.offline);
    b.innerHTML = icon + '<span class="icon-tip">' + esc(label) + '</span>';
  }

  // ---------- overlays ----------
  // Start the slide only after the panel's content has been laid out and
  // painted, so the TV does that work before the motion instead of during it.
  function slideIn(node) {
    void node.offsetWidth;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { node.classList.add('open'); });
    });
  }

  function enterScope(scope) {
    if (state.moving) setMoving(false);
    if (state.focusEl) state.focusEl.classList.remove('focused');
    state.focusEl = null;
    state.scope = scope;
    stage.classList.add('overlay-' + scope);
  }
  function closeOverlay() {
    ['picker', 'inputs-sheet', 'panel', 'name-sheet'].forEach(function (id) { $(id).classList.remove('open'); });
    stage.classList.remove('overlay-picker', 'overlay-inputs', 'overlay-panel');
    if (state.focusEl) state.focusEl.classList.remove('focused');
    state.scope = 'home';
    state.focusEl = null;
    // the home screen is kept up to date while panels are open, so closing
    // only has to restore focus (rebuilding it here caused a visible hitch)
    var content = $('content');
    var target = (state.homeKey && $('home').querySelector('[data-key="' + state.homeKey + '"]')) ||
      content.querySelector('[data-f]');
    if (target) setFocus(target); else renderHome();
    renderHints();
  }

  // Add apps: every installed app; a tick means it's on the home screen.
  function openPicker() {
    if (state.scope !== 'home') closeOverlay();
    enterScope('picker');
    var grid = $('picker-grid');
    grid._y = 0;
    grid.style.transform = '';
    var favs = favoriteIds();
    var apps = installedApps().filter(function (a) { return C.hiddenApps.indexOf(a.id) === -1 && !isInputId(a.id); });
    // Build the grid once and reuse it; rebuilding re-decoded every icon (~0.7 s on the TV).
    var sig = apps.map(function (a) { return a.id + (iconFor(a) ? '+' : '-'); }).join(',');
    if (grid._sig === sig && apps.length) {
      Array.prototype.forEach.call(grid.children, function (c) {
        c.classList.toggle('on', favs.indexOf(c._appId) !== -1);
        c.classList.remove('focused');
      });
      slideIn($('picker'));
      setFocus(grid.querySelector('[data-f]'));
      return;
    }
    grid._sig = sig;
    grid.textContent = '';
    if (!apps.length) {
      grid.appendChild(el('div', 'picker-empty', 'Loading your apps… If the TV shows an “Allow” prompt, accept it.'));
      loadApps();
    }
    apps.forEach(function (a) {
      var c = el('div', 'pick' + (favs.indexOf(a.id) !== -1 ? ' on' : ''));
      c._appId = a.id;
      c.dataset.f = '1';
      c.dataset.key = 'pick:' + a.id;
      var src = iconFor(a);
      var face = src ? '<img src="' + esc(src) + '" alt="" decoding="async">' : '<div class="pick-name">' + esc(a.title) + '</div>';
      c.innerHTML = '<div class="pick-face">' + face + '<span class="pick-check">' + ICON.check + '</span></div>' +
        '<div class="pick-label">' + esc(a.title) + '</div>';
      c._action = function () {
        var ids = favoriteIds().slice();
        var i = ids.indexOf(a.id);
        if (i === -1) ids.push(a.id); else ids.splice(i, 1);
        setFavorites(ids);
        c.classList.toggle('on', i === -1);
        renderHome();      // favourites update live behind the panel
      };
      c.addEventListener('mouseenter', function () { setFocus(c); });
      c.addEventListener('click', function () { setFocus(c); c._action(); });
      grid.appendChild(c);
    });
    slideIn($('picker'));
    setFocus(grid.querySelector('[data-f]'));
  }

  function openInputs() {
    if (state.scope !== 'home') closeOverlay();
    enterScope('inputs');
    var list = $('inputs-list');
    list.textContent = '';
    inputItems(true).forEach(function (item) {
      var r = el('div', 'sheet-row' + (item.dim ? ' dim' : ''));
      r.dataset.f = '1';
      r.dataset.key = item.key;
      r.innerHTML = '<span class="sheet-glyph" style="background:' + item.bg + '">' + item.glyph + '</span>' +
        '<span class="sheet-title">' + esc(item.title) + '</span><span class="sheet-meta">' +
        esc(item.dim ? item.kicker + ' · not connected' : item.kicker) + '</span>';
      r._action = function () { closeOverlay(); launch(item.id, item.title); };
      r.addEventListener('mouseenter', function () { setFocus(r); });
      r.addEventListener('click', function () { setFocus(r); r._action(); });
      list.appendChild(r);
    });
    $('inputs-sheet').classList.add('open');
    setFocus(list.querySelector('[data-f]'));
  }

  // ---------- customize panel ----------
  function opts(map) { return Object.keys(map).map(function (k) { return [k, map[k]]; }); }
  var PANEL = [
    { key: 'defaultHome', label: 'Home button opens Lumen', options: function () { return opts({ on: 'On', off: 'Off' }); } },
    { key: 'design', label: 'Design', options: function () {
      return Object.keys(C.designs).map(function (k) { return [k, C.designs[k].name]; }).concat([['custom', 'Custom']]);
    } },
    { key: 'background', label: 'Background', options: function () {
      return C.backgrounds.map(function (b) { return [b.id, b.name]; });
    } },
    { key: 'layout', label: 'Layout', options: function () { return opts({ rows: 'Rows', grid: 'App icons', mosaic: 'Mosaic' }); } },
    { key: 'tiles', label: 'Tiles', options: function () { return opts({ brand: 'Brand colors', glass: 'Glass', dark: 'Dark' }); } },
    { key: 'labels', label: 'Labels', options: function () { return opts({ focus: 'Name on focus', both: 'Logo and name', none: 'Logo only' }); } },
    { key: 'logoColor', label: 'Logo color', options: function () { return opts({ brand: 'Brand colors', white: 'White' }); } },
    { key: 'font', label: 'Font', options: function () { return opts({ modern: 'Modern', light: 'Light', bold: 'Bold' }); } },
    { key: 'greeting', label: 'Welcome text', options: function () {
      return opts({ time: 'Good morning…', welcome: 'Welcome…', name: 'Name only', hide: 'Hide' });
    } },
    { action: 'name', label: 'Name', value: function () { return settings.name; } },
    { key: 'clock', label: 'Clock', options: function () { return opts({ show: 'Show', hide: 'Hide' }); } },
    { key: 'weather', label: 'Weather', options: function () { return opts({ show: 'Show', hide: 'Hide' }); } },
    { key: 'dim', label: 'Background dimming', options: function () { return opts({ low: 'Low', medium: 'Medium', high: 'High' }); } },
    { key: 'screensaver', label: 'Screensaver', options: function () { return opts({ 3: 'After 3 min', 5: 'After 5 min', 10: 'After 10 min', 0: 'Off' }); } },
    { action: 'apps', label: 'Choose apps' },
    { action: 'reset', label: 'Reset appearance' }
  ];
  var DESIGN_KEYS = ['layout', 'tiles', 'labels', 'logoColor', 'font'];

  function togglePanel() {
    if (state.scope === 'panel') { closeOverlay(); return; }
    if (state.scope !== 'home') closeOverlay();
    enterScope('panel');
    renderPanel();
    slideIn($('panel'));
  }

  function renderPanel() {
    var list = $('panel-list');
    list.textContent = '';
    PANEL.forEach(function (row, i) {
      var r = el('div', 'panel-row' + (row.action ? ' action' : ''));
      r.dataset.f = '1';
      r.dataset.key = 'panel:' + i;
      r._index = i;
      if (row.action) {
        r.innerHTML = '<span class="panel-label">' + row.label + '</span><span class="panel-value"><span>' +
          (row.value ? esc(row.value()) : '') + '</span>›</span>';
        r._action = function () { panelAction(row.action); };
      } else {
        var options = row.options();
        var cur = options.filter(function (o) { return String(o[0]) === String(settings[row.key]); })[0] || options[0];
        r.innerHTML = '<span class="panel-label">' + row.label + '</span><span class="panel-value">' +
          '<i class="chev">‹</i><span>' + esc(cur[1]) + '</span><i class="chev">›</i></span>';
        r._action = function () { changeSetting(row, 1); };
      }
      r.addEventListener('mouseenter', function () { setFocus(r); });
      r.addEventListener('click', function () { setFocus(r); r._action(); });
      list.appendChild(r);
    });
    state.focusEl = null;
    setFocus(list.children[clamp(state.panelIndex || 0, 0, PANEL.length - 1)]);
  }

  function changeSetting(row, step) {
    var options = row.options();
    var i = 0;
    for (var k = 0; k < options.length; k++) if (String(options[k][0]) === String(settings[row.key])) i = k;
    var value = options[(i + step + options.length) % options.length][0];
    settings[row.key] = value;
    if (row.key === 'design' && C.designs[value]) {
      DESIGN_KEYS.forEach(function (k) { settings[k] = C.designs[value][k]; });
    } else if (DESIGN_KEYS.indexOf(row.key) !== -1) {
      settings.design = 'custom';
    }
    save('lumen.settings', settings);
    applySettings();
    stage.classList.add('overlay-panel');
    if (row.key === 'background') applyBackground();
    if (row.key === 'greeting') renderGreeting();
    if (row.key === 'defaultHome') {
      syncHomeService();
      toast(value === 'on' ? 'Home button now opens Lumen' : 'Home button opens LG Home again');
    }
    if (row.key === 'screensaver') saver.poke();
    renderHome();          // re-renders behind the panel (scope stays 'panel')
    heroItem = null;
    var first = $('content').querySelector('[data-f]');
    if (first && first._item) updateHero(first._item);
    renderPanel();
  }

  function panelAction(action) {
    if (action === 'apps') { openPicker(); return; }
    if (action === 'name') { openNameEditor(); return; }
    if (action === 'reset') {
      settings = Object.assign({}, C.defaults);
      save('lumen.settings', settings);
      applySettings();
      stage.classList.add('overlay-panel');
      applyBackground();
      renderHome();
      renderPanel();
      toast('Appearance reset');
    }
  }

  // ---------- default home (background service) ----------
  function homeService(method, params) {
    if (!Luna.onTV) return Promise.resolve(null);
    // service errors come back as {returnValue:false, errorText} so callers can react
    return Luna.call('luna://com.avinash.lumen.service/' + method, params || {}).catch(function (e) {
      console.warn('home service', method, e);
      return e && typeof e === 'object' ? e : { returnValue: false, errorText: String(e) };
    });
  }

  function syncHomeService() {
    return homeService('configure', { enabled: settings.defaultHome === 'on' });
  }

  // ---------- welcome text ----------
  function renderGreeting(d) {
    d = d || new Date();
    var name = (settings.name || '').trim();
    var h = d.getHours();
    var text = '';
    if (settings.greeting === 'time') {
      var part = h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
      text = name ? part + ', ' + name : part;
    } else if (settings.greeting === 'welcome') {
      text = name ? 'Welcome, ' + name : 'Welcome';
    } else if (settings.greeting === 'name') {
      text = name;
    }
    $('greeting').textContent = text;
    $('greeting').hidden = !text;
  }

  function openNameEditor() {
    $('panel').classList.remove('open');
    var sheet = $('name-sheet'), input = $('name-input');
    input.value = settings.name || '';
    sheet.classList.add('open');
    state.scope = 'name';
    renderHints();
    setTimeout(function () {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }, 50);
  }

  function closeNameEditor(saveIt) {
    var input = $('name-input');
    if (saveIt) {
      settings.name = input.value.trim();
      save('lumen.settings', settings);
      renderGreeting();
      toast(settings.name ? 'Saved “' + settings.name + '”' : 'Name cleared');
    }
    input.blur();
    $('name-sheet').classList.remove('open');
    state.scope = 'panel';
    slideIn($('panel'));
    renderPanel();
  }

  // ---------- background ----------
  var bgReq = 0;
  function applyBackground() {
    var req = ++bgReq;
    LumenBackgrounds.resolve(settings.background).then(function (src) {
      if (req !== bgReq) return null;
      return LumenBackgrounds.show($('wall'), src);
    }).then(function (shown) {
      if (req !== bgReq) return;
      $('photo-credit').textContent = shown && shown.credit ? shown.credit : '';
    });
  }

  // ---------- input handling ----------
  function onKey(e) {
    if (saver && saver.dismiss()) { e.preventDefault(); return; }
    if (document.activeElement === $('name-input')) {
      if (e.keyCode === KEY.ENTER) { e.preventDefault(); closeNameEditor(true); }
      else if (e.keyCode === KEY.BACK || e.keyCode === KEY.ESC) { e.preventDefault(); closeNameEditor(false); }
      return;
    }
    var code = e.keyCode, handled = true;
    if (state.scope === 'panel' && (code === KEY.LEFT || code === KEY.RIGHT)) {
      var row = PANEL[state.focusEl ? state.focusEl._index : -1];
      if (row && !row.action) changeSetting(row, code === KEY.RIGHT ? 1 : -1);
      e.preventDefault();
      return;
    }
    switch (code) {
      case KEY.LEFT: if (state.moving) reorder(-1); else moveFocus(-1, 0); break;
      case KEY.RIGHT: if (state.moving) reorder(1); else moveFocus(1, 0); break;
      case KEY.UP: if (!state.moving) moveFocus(0, -1); break;
      case KEY.DOWN: if (!state.moving) moveFocus(0, 1); break;
      case KEY.ENTER: activate(); break;
      case KEY.RED: case KEY.GREEN: case KEY.YELLOW: case KEY.BLUE: onColorKey(code); break;
      case KEY.BACK: case KEY.ESC: case KEY.BACKSPACE:
        if (state.moving) setMoving(false);
        else if (state.scope !== 'home') closeOverlay();
        break;
      default: handled = false;
    }
    if (handled) {
      e.preventDefault();
      document.body.classList.remove('cursor');
    }
  }
  document.addEventListener('keydown', onKey);

  var wheelLock = 0;
  document.addEventListener('wheel', function (e) {
    if (saver && saver.dismiss()) return;
    var now = Date.now();
    if (now < wheelLock || Math.abs(e.deltaY) < 1) return;
    wheelLock = now + 200;
    moveFocus(0, e.deltaY > 0 ? 1 : -1);
  }, { passive: true });

  var lastMove = 0;
  document.addEventListener('mousemove', function () {
    var now = Date.now();
    if (now - lastMove < 500) return;
    lastMove = now;
    if (saver) saver.dismiss();
  });
  document.addEventListener('cursorStateChange', function (e) {
    document.body.classList.toggle('cursor', !!(e.detail && e.detail.visibility));
  });

  // ---------- clock & weather ----------
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];

  // Formatted by hand: the TV's Intl/ICU data costs ~150 ms on first use.
  function tick() {
    var d = new Date();
    var h = d.getHours(), m = d.getMinutes();
    var ampm = '';
    if (!C.clock24) { ampm = h < 12 ? 'AM' : 'PM'; h = h % 12 || 12; }
    var time = (C.clock24 && h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
    var date = DAYS[d.getDay()] + ', ' + d.getDate() + ' ' + MONTHS[d.getMonth()];
    $('time').textContent = $('saver-time').textContent = time;
    $('ampm').textContent = $('saver-ampm').textContent = ampm;
    $('date').textContent = $('saver-date').textContent = date;
    renderGreeting(d);
    setTimeout(tick, 60000 - d.getSeconds() * 1000 - d.getMilliseconds() + 50);
  }

  function renderWeather(w) {
    $('weather').hidden = false;
    $('weather-icon').innerHTML = LumenWeather.icons[w.icon] || '';
    $('weather-temp').textContent = w.temp + '°';
    $('weather-cond').textContent = w.label;
    $('saver-weather').textContent = w.temp + '° · ' + w.label + ' · ' + C.weather.place;
  }

  // ---------- TV data ----------
  function applyInputs(devices) {
    var sig = JSON.stringify(devices.map(function (d) { return [d.appId, d.label, isPlugged(d), d.icon]; }));
    if (sig === state.inputSig) return false;
    state.inputSig = sig;
    state.inputDevices = devices;
    return true;
  }

  // Icon URLs from the TV expire with the connection, so keep a saved copy
  // (data URL) of each icon and only re-download when an app's icon file changes.
  function iconFile(url) { return String(url || '').split('/').pop(); }

  function iconFor(a) {
    if (!a || !a.icon) return null;
    var saved = state.icons[a.id];
    if (saved && saved.file === iconFile(a.icon)) return saved.data;
    return state.appsFresh ? a.icon : (saved ? saved.data : null);
  }

  function cacheIcons(apps) {
    var todo = apps.filter(function (a) {
      var saved = state.icons[a.id];
      return a.icon && !(saved && saved.file === iconFile(a.icon));
    });
    var changed = false;
    function next() {
      var a = todo.shift();
      if (!a) {
        if (changed) save('lumen.icons', state.icons);
        return;
      }
      fetch(a.icon).then(function (r) { return r.blob(); }).then(function (blob) {
        return new Promise(function (resolve) {
          var fr = new FileReader();
          fr.onload = function () { resolve(fr.result); };
          fr.readAsDataURL(blob);
        });
      }).then(function (data) {
        if (/^data:image\//.test(data) || /^data:application\/octet-stream/.test(data)) {
          state.icons[a.id] = { file: iconFile(a.icon), data: data.replace(/^data:[^;]+/, 'data:image/png') };
          changed = true;
        }
      }).catch(function (e) { console.warn('icon cache failed', a.id, e); }).then(next);
    }
    // two at a time: the TV's resource server drops bursts of requests
    next();
    next();
  }

  // The installed-app list comes from Lumen's background service, which holds
  // the pairing with the TV's control service (the key never enters this page).
  var pairing = false;
  function loadApps(attempt) {
    if (!Luna.onTV) return;
    attempt = attempt || 0;
    homeService('listApps').then(function (r) {
      if (!r || !r.returnValue) throw new Error((r && r.errorText) || 'service unavailable');
      state.apps = r.apps;
      state.appsFresh = true;
      save('lumen.apps', r.apps);
      if (state.scope === 'home') renderHome();
      cacheIcons(r.apps);
    }).catch(function (e) {
      console.warn('app list unavailable', e.message);
      if (/not paired|denied|cancel|pairing/i.test(e.message)) { pairTv(); return; }
      if (attempt < 4) setTimeout(function () { loadApps(attempt + 1); }, 2500 * (attempt + 1));
    });
  }

  // One-time "Allow" prompt on the TV; afterwards the service remembers it.
  function pairTv() {
    if (pairing) return;
    pairing = true;
    toast('Select “Allow” on the TV prompt so Lumen can show your apps', 12000);
    homeService('pair').then(function (r) {
      pairing = false;
      if (r && r.returnValue) { syncHomeService(); loadApps(); }
      else toast('Lumen wasn’t allowed. Open Customize › Choose apps to try again.');
    });
  }

  // ---------- boot ----------
  var saver = null;
  fitStage();
  window.addEventListener('resize', fitStage);
  applySettings();
  tick();
  applyInputs(C.inputs.fallback);
  renderTopButtons();
  renderHome();
  applyBackground();

  saver = new LumenBackgrounds.Screensaver({
    el: $('saver'),
    layer: $('saver-layer'),
    caption: $('saver-caption'),
    minutes: function () { return +settings.screensaver || 0; },
    onShow: function () { if (state.moving) setMoving(false); }
  });

  Luna.watchInputs(function (devices) {
    if (applyInputs(devices) && state.scope === 'home') renderHome();
  }, function (e) { console.warn('input list unavailable', e); });
  Luna.subscribe('luna://com.webos.service.connectionmanager/getStatus', {}, renderNetwork,
    function () { /* keep the generic icon */ });
  // the pairing key used to live in the page; it now stays inside the service
  try { localStorage.removeItem('lumen.ssapKey'); } catch (e) { /* ignore */ }
  syncHomeService();
  var weather = LumenWeather.start(Object.assign({ enabled: true }, C.weather), renderWeather);
  loadApps();

  document.addEventListener('webOSRelaunch', function () {
    saver.dismiss();
    if (state.scope !== 'home') closeOverlay();
    loadApps();
    weather.refresh();
  });
  document.addEventListener('visibilitychange', function () {
    saver.dismiss();
    if (!document.hidden) { weather.refresh(); loadApps(); }
  });

  // Preview only: index.html#keys=40,39 replays remote keys; #saver shows the screensaver.
  if (!Luna.onTV) {
    if (/#saver/.test(location.hash)) saver.show();
    var replay = /#keys=([\d,]+)/.exec(location.hash);
    if (replay) {
      replay[1].split(',').forEach(function (k, i) {
        setTimeout(function () {
          var ev = new KeyboardEvent('keydown', { bubbles: true, cancelable: true });
          Object.defineProperty(ev, 'keyCode', { value: +k });
          document.dispatchEvent(ev);
        }, 400 * (i + 1));
      });
    }
  }
})();
