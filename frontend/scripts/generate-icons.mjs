// Generates the PWA / Apple touch icons.
//
// Deliberately dependency-free: the PNGs are encoded by hand on top of
// node:zlib, so no image library (sharp, canvas, …) is needed and the
// project stays installable with `npm install` only.
//
// Run: node scripts/generate-icons.mjs
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

const INDIGO = [99, 102, 241]; // #6366F1 — the brand accent
const WHITE = [255, 255, 255];

// ---------------------------------------------------------------- PNG encoder
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter type: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// -------------------------------------------------------------------- drawing
const SS = 4; // supersampling factor → smooth edges without a rasteriser

function drawIcon(size) {
  const w = size * SS;
  const buf = Buffer.alloc(w * w * 4);

  const set = (x, y, rgb) => {
    const i = (y * w + x) * 4;
    buf[i] = rgb[0];
    buf[i + 1] = rgb[1];
    buf[i + 2] = rgb[2];
    buf[i + 3] = 255;
  };

  const fill = (x0, y0, x1, y1, rgb) => {
    for (let y = Math.round(y0 * w); y < Math.round(y1 * w); y += 1) {
      for (let x = Math.round(x0 * w); x < Math.round(x1 * w); x += 1) set(x, y, rgb);
    }
  };

  const roundRect = (x0, y0, x1, y1, radius, rgb) => {
    const px0 = Math.round(x0 * w);
    const py0 = Math.round(y0 * w);
    const px1 = Math.round(x1 * w);
    const py1 = Math.round(y1 * w);
    const pr = Math.round(radius * w);
    for (let y = py0; y < py1; y += 1) {
      for (let x = px0; x < px1; x += 1) {
        const dx = Math.max(px0 + pr - x, x - (px1 - 1 - pr), 0);
        const dy = Math.max(py0 + pr - y, y - (py1 - 1 - pr), 0);
        if (dx * dx + dy * dy <= pr * pr) set(x, y, rgb);
      }
    }
  };

  // Full-bleed indigo (iOS/Android mask the corners themselves).
  fill(0, 0, 1, 1, INDIGO);
  // White "sheet" of paper.
  roundRect(0.2, 0.24, 0.8, 0.78, 0.07, WHITE);
  // Four indigo blocks = the events on the schedule.
  roundRect(0.3, 0.33, 0.45, 0.47, 0.02, INDIGO);
  roundRect(0.55, 0.33, 0.7, 0.47, 0.02, INDIGO);
  roundRect(0.3, 0.55, 0.45, 0.69, 0.02, INDIGO);
  roundRect(0.55, 0.55, 0.7, 0.69, 0.02, INDIGO);

  // Downsample the supersampled buffer → anti-aliased edges.
  const out = Buffer.alloc(size * size * 4);
  const n = SS * SS;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const i = ((y * SS + sy) * w + (x * SS + sx)) * 4;
          r += buf[i];
          g += buf[i + 1];
          b += buf[i + 2];
          a += buf[i + 3];
        }
      }
      const o = (y * size + x) * 4;
      out[o] = Math.round(r / n);
      out[o + 1] = Math.round(g / n);
      out[o + 2] = Math.round(b / n);
      out[o + 3] = Math.round(a / n);
    }
  }
  return out;
}

mkdirSync(OUT_DIR, { recursive: true });
for (const [name, size] of [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180],
]) {
  writeFileSync(join(OUT_DIR, name), encodePng(size, size, drawIcon(size)));
  console.log(`wrote public/${name} (${size}×${size})`);
}
