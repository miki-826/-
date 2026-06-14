import { PNG } from "pngjs";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, "..", "public", "images", "buttons");

const files = ["btn-cyan", "btn-purple", "btn-cyan2", "btn-purple2", "frame"];

// 背景判定：明るくて彩度が低い（白〜ライトグレー）ピクセル
function isBg(r, g, b) {
  const lum = (r + g + b) / 3;
  const chroma = Math.max(r, g, b) - Math.min(r, g, b);
  return lum > 180 && chroma < 38;
}

function softBg(r, g, b) {
  const lum = (r + g + b) / 3;
  const chroma = Math.max(r, g, b) - Math.min(r, g, b);
  return lum > 150 && chroma < 55;
}

for (const name of files) {
  const path = join(dir, `${name}.png`);
  const png = PNG.sync.read(readFileSync(path));
  const { width: w, height: h, data } = png;
  const idx = (x, y) => (y * w + x) * 4;
  const visited = new Uint8Array(w * h);
  const stack = [];

  const pushIfBg = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (visited[p]) return;
    const i = p * 4;
    if (isBg(data[i], data[i + 1], data[i + 2])) {
      visited[p] = 1;
      stack.push(p);
    }
  };

  for (let x = 0; x < w; x++) {
    pushIfBg(x, 0);
    pushIfBg(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    pushIfBg(0, y);
    pushIfBg(w - 1, y);
  }

  while (stack.length) {
    const p = stack.pop();
    const x = p % w;
    const y = (p / w) | 0;
    pushIfBg(x + 1, y);
    pushIfBg(x - 1, y);
    pushIfBg(x, y + 1);
    pushIfBg(x, y - 1);
  }

  // 背景を透過に
  let cleared = 0;
  for (let p = 0; p < w * h; p++) {
    if (visited[p]) {
      data[p * 4 + 3] = 0;
      cleared++;
    }
  }

  // エッジを1pxフェザー：透過に隣接する「 softBg」な縁を半透明化
  const alphaCopy = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) alphaCopy[p] = data[p * 4 + 3];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (alphaCopy[p] === 0) continue;
      const i = p * 4;
      if (!softBg(data[i], data[i + 1], data[i + 2])) continue;
      let nearTrans = false;
      for (let dy = -1; dy <= 1 && !nearTrans; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx,
            ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (alphaCopy[ny * w + nx] === 0) {
            nearTrans = true;
            break;
          }
        }
      }
      if (nearTrans) data[i + 3] = 90;
    }
  }

  writeFileSync(path, PNG.sync.write(png));
  console.log(`${name}: ${Math.round((cleared / (w * h)) * 100)}% cleared`);
}
