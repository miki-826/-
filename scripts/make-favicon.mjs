import { PNG } from "pngjs";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const size = 32;
const png = new PNG({ width: size, height: size });

// ネオン配色（シアン→マゼンタ）の角丸アイコン + 中央に "D"
const cyan = [45, 226, 255];
const magenta = [255, 61, 240];
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

function rounded(x, y, r) {
  const cx = Math.min(x, size - 1 - x);
  const cy = Math.min(y, size - 1 - y);
  if (cx >= r || cy >= r) return true;
  const dx = r - cx;
  const dy = r - cy;
  return dx * dx + dy * dy <= r * r;
}

// "D" の形（太い縦棒＋右の弧）
function isD(x, y) {
  const left = 9;
  const top = 7;
  const bottom = 24;
  const inH = y >= top && y <= bottom;
  if (x >= left && x <= left + 3 && inH) return true; // 縦棒
  const ccx = left + 3;
  const ccy = (top + bottom) / 2;
  const rx = 11;
  const ry = (bottom - top) / 2;
  const nx = (x - ccx) / rx;
  const ny = (y - ccy) / ry;
  const d = nx * nx + ny * ny;
  return x >= ccx && d <= 1 && d >= 0.42;
}

for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    const idx = (y * size + x) * 4;
    const inside = rounded(x, y, 7);
    if (!inside) {
      png.data[idx + 3] = 0;
      continue;
    }
    const t = (x + y) / (size * 2);
    const bg = mix([14, 8, 40], mix(cyan, magenta, t), 0.32);
    const [r, g, b] = isD(x, y) ? [255, 255, 255] : bg;
    png.data[idx] = r;
    png.data[idx + 1] = g;
    png.data[idx + 2] = b;
    png.data[idx + 3] = 255;
  }
}

const pngBuf = PNG.sync.write(png);

// ICOコンテナ（PNGを埋め込むVista以降の形式）
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // count
const entry = Buffer.alloc(16);
entry.writeUInt8(size === 256 ? 0 : size, 0); // width
entry.writeUInt8(size === 256 ? 0 : size, 1); // height
entry.writeUInt8(0, 2); // colors
entry.writeUInt8(0, 3); // reserved
entry.writeUInt16LE(1, 4); // planes
entry.writeUInt16LE(32, 6); // bpp
entry.writeUInt32LE(pngBuf.length, 8); // size
entry.writeUInt32LE(6 + 16, 12); // offset

const ico = Buffer.concat([header, entry, pngBuf]);
writeFileSync(join(here, "..", "app", "favicon.ico"), ico);
console.log(`favicon.ico written (${ico.length} bytes)`);
