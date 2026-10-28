/*
 * Weather via Open-Meteo (free, no API key). The last reading is cached
 * on the TV so the widget paints instantly on startup.
 */
(function () {
  'use strict';

  var CACHE_KEY = 'lumen.weather';

  var S = 'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';
  var CLOUD = '<path d="M7 18.5h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 11.6 3.5 3.5 0 0 0 7 18.5z"/>';
  var ICONS = {
    sun: '<svg viewBox="0 0 24 24" ' + S + '><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24" ' + S + '><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>',
    partly: '<svg viewBox="0 0 24 24" ' + S + '><path d="M8.5 3.5v1.2M3.6 8.5h1.2M5 5l.9.9M12 5l-.9.9"/><path d="M5.6 11.2a3.2 3.2 0 0 1 5.9-2.4"/>' + CLOUD + '</svg>',
    cloud: '<svg viewBox="0 0 24 24" ' + S + '>' + CLOUD + '</svg>',
    fog: '<svg viewBox="0 0 24 24" ' + S + '><path d="M4 9h16M3 13h18M5 17h14"/></svg>',
    rain: '<svg viewBox="0 0 24 24" ' + S + '><path d="M7 15.5h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 8.6 3.5 3.5 0 0 0 7 15.5z"/><path d="M9 18l-1 2.5M13 18l-1 2.5M17 18l-1 2.5"/></svg>',
    snow: '<svg viewBox="0 0 24 24" ' + S + '><path d="M7 15.5h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 8.6 3.5 3.5 0 0 0 7 15.5z"/><path d="M9 19h.01M12 20.5h.01M15 19h.01"/></svg>',
    storm: '<svg viewBox="0 0 24 24" ' + S + '><path d="M7 15.5h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 8.6 3.5 3.5 0 0 0 7 15.5z"/><path d="M12.5 15l-2 3.5h3l-2 3.5"/></svg>'
  };

  // WMO weather codes -> [label, icon]
  function describe(code, isDay) {
    if (code === 0) return ['Clear', isDay ? 'sun' : 'moon'];
    if (code === 1 || code === 2) return ['Partly cloudy', isDay ? 'partly' : 'cloud'];
    if (code === 3) return ['Cloudy', 'cloud'];
    if (code === 45 || code === 48) return ['Fog', 'fog'];
    if (code >= 51 && code <= 67) return ['Rain', 'rain'];
    if (code >= 71 && code <= 77) return ['Snow', 'snow'];
    if (code >= 80 && code <= 82) return ['Showers', 'rain'];
    if (code >= 95) return ['Thunderstorms', 'storm'];
    return ['—', 'cloud'];
  }

  function load() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch (e) { return null; }
  }

  function fetchNow(cfg) {
    var url = 'https://api.open-meteo.com/v1/forecast' +
      '?latitude=' + cfg.latitude + '&longitude=' + cfg.longitude +
      '&current=temperature_2m,weather_code,is_day' +
      '&daily=temperature_2m_max,temperature_2m_min' +
      '&temperature_unit=' + (cfg.unit || 'celsius') +
      '&timezone=auto&forecast_days=1';
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('weather ' + r.status);
      return r.json();
    }).then(function (j) {
      var d = describe(j.current.weather_code, j.current.is_day === 1);
      var data = {
        temp: Math.round(j.current.temperature_2m),
        hi: Math.round(j.daily.temperature_2m_max[0]),
        lo: Math.round(j.daily.temperature_2m_min[0]),
        label: d[0],
        icon: d[1],
        at: Date.now()
      };
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
      return data;
    });
  }

  window.LumenWeather = {
    icons: ICONS,
    start: function (cfg, render) {
      if (!cfg || !cfg.enabled) return { refresh: function () {} };
      var cached = load();
      if (cached) render(cached);

      function refresh() {
        fetchNow(cfg).then(render).catch(function (e) { console.warn(e); });
      }
      var stale = !cached || Date.now() - cached.at > cfg.refreshMinutes * 60000;
      if (stale) refresh();
      setInterval(refresh, cfg.refreshMinutes * 60000);
      return { refresh: refresh };
    }
  };
})();
