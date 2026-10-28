/*
 * Lumen configuration. Most of this can be changed on the TV itself in
 * Customize (palette button / Blue key); this file holds the defaults.
 * After editing: npm run deploy (and npm run tv:selftest if app ids changed).
 */
window.LUMEN_CONFIG = {
  clock24: false,

  weather: {
    place: 'Dubai South',
    latitude: 24.896,
    longitude: 55.161,
    unit: 'celsius',          // 'celsius' | 'fahrenheit'
    refreshMinutes: 15
  },

  // First-run favorites (apps not installed are skipped). After that the
  // list is edited on the TV: Green = add apps, Red = rearrange, Yellow = remove.
  defaultFavorites: ['netflix', 'youtube.leanback.v4', 'amazon', 'com.apple.appletv'],

  // Never offered in "Add apps".
  hiddenApps: ['com.avinash.lumen', 'com.palmdts.devmode'],

  // Tile look for specific apps. `logo` refers to a vector mark in logos.js
  // (crisp at 4K); other apps use the TV's own icon on their brand colour.
  brands: {
    'netflix':             { bg: '#000000', logo: 'netflix',     logoColor: '#E50914', accent: '#E50914' },
    'youtube.leanback.v4': { bg: '#FF0000', logo: 'youtube',     logoColor: '#FFFFFF', accent: '#FF2D2D' },
    'com.apple.appletv':   { bg: '#000000', logo: 'appletv',     logoColor: '#FFFFFF', accent: '#A1A1AA' },
    'amazon':              { accent: '#1A98FF' },
    'com.crunchyroll.webapp': { bg: '#FF5E00', logo: 'crunchyroll', logoColor: '#FFFFFF', accent: '#FF5E00' }
  },

  // Settings defaults (Customize panel).
  defaults: {
    defaultHome: 'on',        // Home button returns to Lumen (background service)
    design: 'cinema',
    background: 'bing',
    layout: 'rows',
    tiles: 'brand',
    labels: 'focus',
    logoColor: 'brand',
    font: 'modern',
    name: 'Avinash and Aanchal',
    greeting: 'time',         // time | welcome | name | hide
    clock: 'show',
    weather: 'show',
    dim: 'medium',
    screensaver: '3'
  },

  // "Design" presets set several options at once.
  designs: {
    cinema:  { name: 'Cinema',  layout: 'rows',   tiles: 'brand', labels: 'focus', logoColor: 'brand', font: 'modern' },
    icons:   { name: 'Icons',   layout: 'grid',   tiles: 'brand', labels: 'both',  logoColor: 'brand', font: 'modern' },
    mosaic:  { name: 'Mosaic',  layout: 'mosaic', tiles: 'brand', labels: 'both',  logoColor: 'brand', font: 'modern' },
    minimal: { name: 'Minimal', layout: 'grid',   tiles: 'glass', labels: 'focus', logoColor: 'white', font: 'light' }
  },

  // Backgrounds: Bing's photo of the day (4K, changes daily), a curated set
  // of free 4K landscapes (Unsplash photos via picsum.photos), ambient
  // animated scenes (offline) and black.
  backgrounds: [
    { id: 'bing', name: 'Photo of the day' },
    { id: 'p:1015', name: 'Norwegian fjord' },
    { id: 'p:916', name: 'Alpine lake' },
    { id: 'p:906', name: 'Matterhorn' },
    { id: 'p:902', name: 'Golden peaks' },
    { id: 'p:1016', name: 'Red canyon' },
    { id: 'p:1018', name: 'Green highlands' },
    { id: 'p:1043', name: 'Valley forest' },
    { id: 'p:1039', name: 'Waterfall' },
    { id: 'p:1022', name: 'Northern lights' },
    { id: 'p:903', name: 'Milky Way' },
    { id: 'p:184', name: 'Desert dunes' },
    { id: 'p:1051', name: 'Lake pier' },
    { id: 'ambient:midnight', name: 'Ambient midnight' },
    { id: 'ambient:aurora', name: 'Ambient aurora' },
    { id: 'ambient:dune', name: 'Ambient dune' },
    { id: 'black', name: 'Black' }
  ],

  inputs: {
    showDisconnected: false,
    styles: {
      gameconsole: {
        accent: '#2f6bff',
        bg: 'linear-gradient(140deg, #00071a 0%, #00256b 55%, #0049c4 100%)',
        glyph: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 8h10a4 4 0 0 1 3.9 4.9l-.9 4a2 2 0 0 1-3.5.8L15 16H9l-1.5 1.7A2 2 0 0 1 4 16.9l-.9-4A4 4 0 0 1 7 8z"/><path d="M8 11v3M6.5 12.5h3"/><circle cx="16" cy="11.5" r=".6" fill="#fff"/><circle cx="17.5" cy="13" r=".6" fill="#fff"/></svg>'
      },
      settopbox: {
        accent: '#ff3b2f',
        bg: 'linear-gradient(140deg, #1a0000 0%, #520400 55%, #c81200 100%)',
        glyph: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="9" width="18" height="7" rx="1.5"/><path d="M6 12.5h4M16.5 12.5h.01M6 16v2M18 16v2"/></svg>'
      },
      pc: {
        accent: '#30c48d',
        bg: 'linear-gradient(140deg, #00140d 0%, #003d2a 55%, #08795a 100%)',
        glyph: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M9 20h6M12 16v4"/></svg>'
      },
      default: {
        accent: '#8e8e93',
        bg: 'linear-gradient(140deg, #141418 0%, #24242a 55%, #3a3a42 100%)',
        glyph: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8h12v5a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3z"/><path d="M9 8V4M15 8V4M12 16v4"/></svg>'
      }
    },
    // Always offered after the HDMI inputs: LG's media player (USB drives,
    // home-network media). webOS doesn't let apps detect USB storage.
    media: {
      id: 'com.webos.app.mediadiscovery', title: 'USB & Media', kicker: 'Photos, videos & music',
      accent: '#a259ff',
      bg: 'linear-gradient(140deg, #0e0618 0%, #2a1250 55%, #5b2aa8 100%)',
      glyph: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="9" width="10" height="12" rx="2"/><path d="M9 9V3h6v6M11 5.5h.01M13 5.5h.01"/></svg>'
    },
    // Used only when the TV can't report inputs (desktop preview).
    fallback: [
      { id: 'HDMI_1', label: 'Etisalat Set-Top Box', port: 1, appId: 'com.webos.app.hdmi1', icon: 'settopbox.png', hdmiPlugIn: true },
      { id: 'HDMI_4', label: 'PS5 Game Console', port: 4, appId: 'com.webos.app.hdmi4', icon: 'gameconsole.png', hdmiPlugIn: true }
    ]
  },

  // Desktop preview only: stand-in for the TV's installed-app list.
  previewApps: [
    { id: 'netflix', title: 'Netflix', iconColor: '#000000' },
    { id: 'youtube.leanback.v4', title: 'YouTube', iconColor: '#FF0000' },
    { id: 'amazon', title: 'Prime Video', iconColor: '#1A98FF' },
    { id: 'com.apple.appletv', title: 'Apple TV', iconColor: '#000000' },
    { id: 'disneyplus', title: 'Disney+', iconColor: '#054553' },
    { id: 'com.osn.go', title: 'OSN+', iconColor: '#000000' },
    { id: 'net.mbc.shahid-lgapp', title: 'Shahid', iconColor: '#000d21' },
    { id: 'com.crunchyroll.webapp', title: 'Crunchyroll', iconColor: '#ff5e00' },
    { id: 'webos.tod.tv', title: 'TOD', iconColor: '#000000' },
    { id: 'com.webos.app.browser', title: 'Web Browser', iconColor: '#5C75B8' },
    { id: 'com.webos.app.discovery', title: 'Apps', iconColor: '#000000' },
    { id: 'com.webos.app.livetv', title: 'Live TV', iconColor: '#E55E78' }
  ]
};
