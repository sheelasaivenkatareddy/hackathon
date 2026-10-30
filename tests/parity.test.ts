// Node test: the TypeScript vision code must match the Python reference.
// Run:  npx tsx tests/parity.test.ts <folder with *.png work images and python.json>
// Needs: npm i -D sharp @techstark/opencv-js tsx
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { photoCoach } from "../src/lib/vision/coach";
import { compareVisits } from "../src/lib/vision/compare";
import { leafMasks } from "../src/lib/vision/masks";
import type { RGBAImage } from "../src/lib/vision/types";

const dir = process.argv[2];
const py = JSON.parse(fs.readFileSync(path.join(dir, "python.json"), "utf8"));

async function load(file: string): Promise<RGBAImage> {
  const { data, info } = await sharp(path.join(dir, file)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data: new Uint8ClampedArray(data) };
}

// The OpenCV.js module is "thenable": never return it from an async function or await it directly
// (the promise would try to unwrap it forever). Wrap it in an object instead.
async function getCv(): Promise<{ cv: any }> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const cv = require("@techstark/opencv-js");
  await new Promise<void>((res) => { if (cv.Mat) return res(); if (typeof cv.then === "function") { cv.then(() => res()); return; } cv.onRuntimeInitialized = () => res(); });
  return { cv };
}

let failures = 0;
const check = (ok: boolean, msg: string) => { console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`); if (!ok) failures++; };
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

(async () => {
  for (const [name, exp] of Object.entries<any>(py.coach)) {
    const img = await load(name.replace(".jpg", ".png"));
    const c = photoCoach(img), m = leafMasks(img);
    check(c.pass === exp.pass && near(c.sharpness.value, exp.sharp, Math.max(0.5, exp.sharp * 0.01)) &&
      near(c.light.value, exp.luma, 0.2) && near(c.leafInFrame.value, exp.leaf, 0.3) && near(m.affectedPct, exp.affected, 0.3),
      `coach ${name}: TS sharp ${c.sharpness.value} luma ${c.light.value} leaf ${c.leafInFrame.value} affected ${m.affectedPct.toFixed(2)} pass ${c.pass}` +
      ` | PY ${exp.sharp} ${exp.luma} ${exp.leaf} ${exp.affected} ${exp.pass}`);
  }
  const { cv } = await getCv();
  for (const [key, exp] of Object.entries<any>(py.compare)) {
    const [n, order] = [key.slice(0, key.lastIndexOf("-")), key.slice(key.lastIndexOf("-") + 1)];
    const f1 = `synthetic-${n}-visit-${order === "fwd" ? 1 : 2}.png`, f2 = `synthetic-${n}-visit-${order === "fwd" ? 2 : 1}.png`;
    const t0 = Date.now();
    const r = compareVisits(await load(f1), await load(f2), 2, cv);
    check(r.status === exp.status && r.newSpots === exp.new_spots && r.newHoles === exp.new_holes,
      `compare ${key}: TS ${r.status} spots ${r.newSpots} holes ${r.newHoles} affected ${r.affectedOldPct}->${r.affectedNewPct} align ${r.alignment.method} ${r.alignment.quality} ${r.alignment.leafIou}` +
      ` | PY ${exp.status} ${exp.new_spots} ${exp.new_holes} ${exp.affected_old_pct}->${exp.affected_new_pct} ${exp.align.method} ${exp.align.quality} ${exp.align.leaf_iou}  (${Date.now() - t0} ms)`);
  }
  for (const name of Object.keys(py.coach).slice(0, 4)) {
    const img = await load(name.replace(".jpg", ".png"));
    const r = compareVisits(img, img, 3, cv);
    check(r.status === "stable" && r.components.length === 0, `self-compare ${name}: ${r.status}, ${r.components.length} new`);
  }
  console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
})();
