import { PNG } from "pngjs";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, "..", "public", "images", "numbers");

const lumOf = (r, g, b) => (r + g + b) / 3;
const chromaOf = (r, g, b) => Math.max(r, g, b) - Math.min(r, g, b);

// 完全な白〜薄いグレー背景（彩度がほぼ無い明るい部分）
const veryWhite = (r, g, b) => lumOf(r, g, b) >= 220 && chromaOf(r, g, b) <= 26;
// 縁取りのにじみ
const borderBg = (r, g, b) => lumOf(r, g, b) > 175 && chromaOf(r, g, b) < 40;
const softBg = (r, g, b) => lumOf(r, g, b) > 150 && chromaOf(r, g, b) < 55;

for (let n = 0; n <= 9; n++) {
  const path = join(dir, `${n}.png`);
  const png = PNG.sync.read(readFileSync(path));
  const { width: w, height: h, data } = png;
  const cleared = new Uint8Array(w * h);

  // 内側の穴も含めて、白背景を全消し
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    if (veryWhite(data[i], data[i + 1], data[i + 2])) cleared[p] = 1;
  }

  // 外周からのにじみグレーをフラッドで追加除去
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (cleared[p] === 2) return;
    const i = p * 4;
    if (cleared[p] === 1 || borderBg(data[i], data[i + 1], data[i + 2])) {
      cleared[p] = 2;
      stack.push(p);
    }
  };
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }
  while (stack.length) {
    const p = stack.pop();
    const x = p % w;
    const y = (p / w) | 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }

  for (let p = 0; p < w * h; p++) {
    if (cleared[p]) data[p * 4 + 3] = 0;
  }

  // 1pxフェザー
  const acopy = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) acopy[p] = data[p * 4 + 3];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (acopy[p] === 0) continue;
      const i = p * 4;
      if (!softBg(data[i], data[i + 1], data[i + 2])) continue;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx,
            ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (acopy[ny * w + nx] === 0) {
            near = true;
            break;
          }
        }
      if (near) data[i + 3] = 100;
    }
  }

  writeFileSync(path, PNG.sync.write(png));
}
console.log("numbers done");
