// Generates app/icon.png (80x80) and app/largeIcon.png (130x130) with no
// image dependencies: a soft gradient ring on a dark tile, rendered per pixel.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = (buf) => {
  let c = -1;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const chunk = (type, data) => {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
};

const mix = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

function icon(size) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(size * stride);
  const c = size / 2, R = size * 0.27, w = size * 0.055;
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // PNG filter: none
    for (let x = 0; x < size; x++) {
      const px = x + 0.5, py = y + 0.5, v = py / size;
      let r = mix(30, 6, v), g = mix(31, 6, v), b = mix(38, 9, v);

      const d = Math.hypot(px - c, py - c);
      const glow = Math.exp(-(((d - R) / (size * 0.12)) ** 2)) * 0.35;
      const t = (Math.atan2(py - c, px - c) / Math.PI + 1) / 2; // violet -> cyan sweep
      const ring = 1 - smooth(w * 0.5, w * 0.5 + 1.2, Math.abs(d - R));
      const a = Math.min(1, ring + glow);
      r = mix(r, mix(140, 60, t), a); g = mix(g, mix(110, 200, t), a); b = mix(b, 255, a);

      const dot = 1 - smooth(size * 0.06, size * 0.06 + 1.2, d);
      r = mix(r, 245, dot); g = mix(g, 245, dot); b = mix(b, 247, dot);

      const i = y * stride + 1 + x * 4;
      raw[i] = r; raw[i + 1] = g; raw[i + 2] = b; raw[i + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))
  ]);
}

// Launch splash: shown by webOS the moment Lumen starts, before the page
// loads, so returning home doesn't linger on LG's screen. Matches Lumen's
// dark background with a soft glow.
function splash(w, h) {
  const stride = w * 3 + 1;
  const raw = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    raw[y * stride] = 0;
    for (let x = 0; x < w; x++) {
      const dx = (x - w * 0.18) / w, dy = (y + h * 0.25) / h;
      const g = Math.exp(-(dx * dx + dy * dy) * 3.2) * 0.32;
      const v = 1 - (y / h) * 0.6;
      const i = y * stride + 1 + x * 3;
      raw[i] = Math.min(255, 6 * v + 70 * g);
      raw[i + 1] = Math.min(255, 6 * v + 60 * g);
      raw[i + 2] = Math.min(255, 10 * v + 120 * g);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))
  ]);
}

writeFileSync(new URL('../app/splash.png', import.meta.url), splash(1920, 1080));
writeFileSync(new URL('../app/icon.png', import.meta.url), icon(80));
writeFileSync(new URL('../app/largeIcon.png', import.meta.url), icon(130));
console.log('icons written');
