/*
 * Home-screen background and screensaver slideshow.
 *   bing        Bing photo of the day (3840x2160), new every day
 *   p:<id>      a curated 4K landscape from picsum.photos (Unsplash photos)
 *   ambient:<t> animated light scene (offline)
 *   black       plain black
 * Photos are decoded off-screen and cross-faded in, so a slow network
 * never shows a half-loaded image.
 */
(function () {
  'use strict';

  var BING_KEY = 'lumen.bing';
  var BING_TTL = 6 * 3600 * 1000;

  function picsum(id) { return 'https://picsum.photos/id/' + id + '/3840/2160.jpg'; }

  // Latest Bing photos, cached so startup doesn't wait on the network.
  function bingList() {
    var cached = null;
    try { cached = JSON.parse(localStorage.getItem(BING_KEY)); } catch (e) { /* ignore */ }
    if (cached && Date.now() - cached.at < BING_TTL) return Promise.resolve(cached.images);
    return fetch('https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=8&mkt=en-US')
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var images = j.images.map(function (i) {
          return { url: 'https://www.bing.com' + i.urlbase + '_UHD.jpg', title: i.title, credit: i.copyright };
        });
        try { localStorage.setItem(BING_KEY, JSON.stringify({ at: Date.now(), images: images })); } catch (e) { /* ignore */ }
        return images;
      })
      .catch(function () { return cached ? cached.images : []; });
  }

  // -> Promise<{url, title, credit} | {ambient: theme} | null>
  function resolve(id) {
    if (id === 'bing') {
      return bingList().then(function (imgs) { return imgs[0] || { ambient: 'midnight' }; });
    }
    if (/^p:/.test(id)) return Promise.resolve({ url: picsum(id.slice(2)) });
    if (/^ambient:/.test(id)) return Promise.resolve({ ambient: id.slice(8) });
    return Promise.resolve(null);
  }

  function loadImage(url) {
    return new Promise(function (ok, fail) {
      var img = new Image();
      img.className = 'bg-photo';
      img.onload = function () {
        (img.decode ? img.decode() : Promise.resolve()).then(function () { ok(img); }, function () { ok(img); });
      };
      img.onerror = function () { fail(new Error('image failed')); };
      img.src = url;
    });
  }

  // Cross-fades a new layer in over the old one, then removes the old one,
  // so at most two full-screen images are ever in memory.
  function swapLayer(host, node) {
    node.classList.add('bg-layer', 'entering');
    host.appendChild(node);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { node.classList.remove('entering'); });
    });
    setTimeout(function () {
      while (host.children.length > 1) host.removeChild(host.firstChild);
    }, 1400);
  }

  function show(host, source) {
    if (!source) {
      swapLayer(host, document.createElement('div'));
      return Promise.resolve(null);
    }
    if (source.ambient) {
      swapLayer(host, LumenAmbient.scene(source.ambient, 0.75));
      return Promise.resolve(source);
    }
    return loadImage(source.url).then(function (img) {
      swapLayer(host, img);
      return source;
    }, function () {
      swapLayer(host, LumenAmbient.scene('midnight', 0.75));
      return null;
    });
  }

  // ---------- screensaver ----------
  function Screensaver(opts) {
    this.opts = opts;      // { el, layer, minutes(fn), onShow }
    this.active = false;
    this.timer = null;
    this.slideTimer = null;
    this.index = 0;
    this.poke();
  }
  Screensaver.prototype.poke = function () {
    clearTimeout(this.timer);
    var mins = this.opts.minutes();
    if (!mins) return;
    var self = this;
    this.timer = setTimeout(function () { self.show(); }, mins * 60000);
  };
  Screensaver.prototype.show = function () {
    if (this.active || document.hidden) return;
    this.active = true;
    this.opts.el.classList.add('on');
    if (this.opts.onShow) this.opts.onShow();
    var self = this;
    bingList().then(function (bing) {
      var named = LUMEN_CONFIG.backgrounds.filter(function (b) { return /^p:/.test(b.id); })
        .map(function (b) { return { url: picsum(b.id.slice(2)), title: b.name }; });
      self.slides = bing.concat(named);
      self.next();
      self.slideTimer = setInterval(function () { self.next(); }, 45000);
    });
  };
  Screensaver.prototype.next = function () {
    if (!this.active) return;
    var slides = this.slides || [];
    var src = slides.length ? slides[this.index++ % slides.length] : { ambient: 'aurora' };
    var layer = this.opts.layer, caption = this.opts.caption;
    show(layer, src).then(function (s) {
      var last = layer.lastChild;
      if (last && last.tagName === 'IMG') last.classList.add('kenburns');
      caption.textContent = (s && (s.credit || s.title)) || '';
    });
  };
  Screensaver.prototype.dismiss = function () {
    var was = this.active;
    if (was) {
      this.active = false;
      clearInterval(this.slideTimer);
      this.opts.el.classList.remove('on');
      var layer = this.opts.layer;
      setTimeout(function () { layer.textContent = ''; }, 900);
    }
    this.poke();
    return was;
  };

  window.LumenBackgrounds = { resolve: resolve, show: show, Screensaver: Screensaver };
})();
