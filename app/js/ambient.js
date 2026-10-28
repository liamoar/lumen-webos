/*
 * Ambient scenes: large soft light fields that drift slowly. Pure CSS
 * gradients animated with transform, so they work offline and stay smooth
 * on the TV's GPU. Used as backgrounds and as the offline screensaver.
 */
(function () {
  'use strict';

  var THEMES = {
    midnight: { name: 'Midnight', base: '#04050a', blobs: ['#27307e', '#56287a', '#0b4766', '#1b1d4a'] },
    aurora:   { name: 'Aurora',   base: '#02090b', blobs: ['#0d7a68', '#3a2a92', '#0a5c7d', '#6e2a6a'] },
    dune:     { name: 'Dune',     base: '#0b0603', blobs: ['#8f4a10', '#5c2a0a', '#b87a2c', '#3c1a2c'] },
    ocean:    { name: 'Ocean',    base: '#01060d', blobs: ['#0a3c80', '#08708e', '#132a5e', '#2a5ca6'] },
    graphite: { name: 'Graphite', base: '#060607', blobs: ['#2c2c34', '#3c3c48', '#1c1c22', '#50505c'] }
  };

  // Size, start position and drift period for each of the four lights.
  var LAYOUT = [
    { s: 1300, x: -200, y: -300, d: 46 },
    { s: 1100, x: 900,  y: -200, d: 58 },
    { s: 1200, x: 300,  y: 350,  d: 52 },
    { s: 900,  x: 1200, y: 450,  d: 64 }
  ];

  function scene(themeKey, intensity) {
    var t = THEMES[themeKey] || THEMES.midnight;
    var root = document.createElement('div');
    root.className = 'scene';
    root.style.background = t.base;
    t.blobs.forEach(function (color, i) {
      var L = LAYOUT[i];
      var b = document.createElement('div');
      b.className = 'scene-light';
      b.style.cssText =
        'width:' + L.s + 'px;height:' + L.s + 'px;left:' + L.x + 'px;top:' + L.y + 'px;' +
        'background:radial-gradient(closest-side,' + color + ' 0%,transparent 100%);' +
        'opacity:' + intensity + ';' +
        'animation-duration:' + L.d + 's;animation-delay:' + (-i * 11) + 's;' +
        'animation-name:drift' + (i % 2);
      root.appendChild(b);
    });
    root.appendChild(Object.assign(document.createElement('div'), { className: 'scene-vignette' }));
    return root;
  }

  window.LumenAmbient = { themes: THEMES, scene: scene };
})();
