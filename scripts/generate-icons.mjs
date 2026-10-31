import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * Generates the PWA icons without external image dependencies.
 * Run with: node scripts/generate-icons.mjs
 */

const BRAND = [0xfa, 0x8f, 0x40, 0xff];
const INK = [0x1c, 0x1f, 0x23, 0xff];
const WHITE = [0xff, 0xff, 0xff, 0xff];

const FONT = {
  "4": ["00100", "00100", "01010", "10010", "11111", "00010", "00010"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
};

function crc32(buffer) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) crc = table[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    rgba.copy(raw, row + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function drawIcon(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const set = (x, y, color) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    pixels[i] = color[0];
    pixels[i + 1] = color[1];
    pixels[i + 2] = color[2];
    pixels[i + 3] = color[3];
  };
  const fillRect = (x0, y0, w, h, color) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(x, y, color);
  };

  // Brand background with a subtle inner ink disc for depth.
  fillRect(0, 0, size, size, BRAND);
  const radius = size * 0.36;
  const cx = size / 2;
  const cy = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx + 0.5;
      const dy = y - cy + 0.5;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < radius && d > radius - Math.max(2, size * 0.012)) {
        set(x, y, INK);
      }
    }
  }

  // 5x7 bitmap text "4AB", centered.
  const glyphs = ["4", "A", "B"];
  const gap = 1;
  const unitsWide = glyphs.length * 5 + (glyphs.length - 1) * gap;
  const scale = Math.max(2, Math.floor((size * 0.62) / unitsWide));
  const textW = unitsWide * scale;
  const textH = 7 * scale;
  const startX = Math.floor((size - textW) / 2);
  const startY = Math.floor((size - textH) / 2);
  glyphs.forEach((glyph, glyphIndex) => {
    const rows = FONT[glyph];
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        if (row[x] === "1") {
          fillRect(
            startX + (glyphIndex * (5 + gap) + x) * scale,
            startY + y * scale,
            scale,
            scale,
            WHITE,
          );
        }
      }
    });
  });

  return encodePng(size, size, pixels);
}

const outDir = path.join(process.cwd(), "public", "icons");
mkdirSync(outDir, { recursive: true });
for (const size of [32, 180, 192, 512]) {
  const file = path.join(outDir, `icon-${size}.png`);
  writeFileSync(file, drawIcon(size));
  console.log(`wrote ${path.relative(process.cwd(), file)}`);
}
