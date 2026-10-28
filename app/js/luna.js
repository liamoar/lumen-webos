/*
 * Minimal Luna service bridge (what webOSTV.js does under the hood),
 * so the app ships with zero dependencies. Off-TV it falls back to a
 * mock so the UI can be previewed in a desktop browser.
 */
(function () {
  'use strict';

  var onTV = typeof window.PalmServiceBridge !== 'undefined';
  var pending = new Set(); // keep bridges alive until they answer

  function call(uri, params) {
    return new Promise(function (resolve, reject) {
      if (!onTV) { reject(new Error('Luna unavailable (not on a webOS TV)')); return; }
      var bridge = new window.PalmServiceBridge();
      pending.add(bridge);
      bridge.onservicecallback = function (msg) {
        pending.delete(bridge);
        var res;
        try { res = JSON.parse(msg); } catch (e) { reject(e); return; }
        if (res.returnValue === false) reject(res); else resolve(res);
      };
      bridge.call(uri, JSON.stringify(params || {}));
    });
  }

  // Long-lived subscription: cb runs on every update. Returns a cancel fn.
  function subscribe(uri, params, cb, onError) {
    if (!onTV) { if (onError) onError(new Error('Luna unavailable')); return function () {}; }
    var bridge = new window.PalmServiceBridge();
    pending.add(bridge);
    bridge.onservicecallback = function (msg) {
      var res;
      try { res = JSON.parse(msg); } catch (e) { return; }
      if (res.returnValue === false) { if (onError) onError(res); return; }
      cb(res);
    };
    var p = Object.assign({}, params || {}, { subscribe: true });
    bridge.call(uri, JSON.stringify(p));
    return function () { bridge.cancel(); pending.delete(bridge); };
  }

  window.Luna = {
    onTV: onTV,
    call: call,
    subscribe: subscribe,

    launch: function (id, params) {
      if (!onTV) {
        console.info('[preview] launch', id, params || {});
        return Promise.resolve({ preview: true });
      }
      return call('luna://com.webos.applicationManager/launch', { id: id, params: params || {} });
    },

    // Live list of HDMI/AV inputs with the names set in LG's input menu.
    watchInputs: function (cb, onError) {
      return subscribe('luna://com.webos.service.eim/getAllInputStatus', {}, function (res) {
        cb(res.devices || []);
      }, onError);
    },

    // May be denied for developer-mode apps on newer firmware; callers
    // must treat failure as "unknown" and fall back to config.
    listLaunchPoints: function () {
      return call('luna://com.webos.applicationManager/listLaunchPoints', {})
        .then(function (res) { return res.launchPoints || []; });
    }
  };
})();
