import { PNG } from "pngjs";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, "..", "public", "images", "numbers");

// 各数字の透明でない領域(bbox)に切り詰めて、表示サイズを揃えやすくする
for (let n = 0; n <= 9; n++) {
  const path = join(dir, `${n}.png`);
  const src = PNG.sync.read(readFileSync(path));
  const { width: w, height: h, data } = src;
  let minx = w,
    miny = h,
    maxx = -1,
    maxy = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 20) {
        if (x < minx) minx = x;
        if (x > maxx) maxx = x;
        if (y < miny) miny = y;
        if (y > maxy) maxy = y;
      }
    }
  }
  const pad = 6;
  minx = Math.max(0, minx - pad);
  miny = Math.max(0, miny - pad);
  maxx = Math.min(w - 1, maxx + pad);
  maxy = Math.min(h - 1, maxy + pad);
  const nw = maxx - minx + 1;
  const nh = maxy - miny + 1;
  const out = new PNG({ width: nw, height: nh });
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const si = ((y + miny) * w + (x + minx)) * 4;
      const di = (y * nw + x) * 4;
      out.data[di] = data[si];
      out.data[di + 1] = data[si + 1];
      out.data[di + 2] = data[si + 2];
      out.data[di + 3] = data[si + 3];
    }
  }
  writeFileSync(path, PNG.sync.write(out));
  console.log(`${n}: ${nw}x${nh}`);
}
