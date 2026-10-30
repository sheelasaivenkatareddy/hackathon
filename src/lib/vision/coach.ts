// Photo Coach: sharpness, light and leaf-in-frame checks, run before any diagnosis.
import { CONFIG } from "../../config";
import { hsvArrays, plantMask } from "./masks";
import { RGBAImage, countOn } from "./types";

export interface CoachResult {
  sharpness: { value: number; pass: boolean };
  light: { value: number; overexposedPct: number; pass: boolean; problem: "dark" | "bright" | null };
  leafInFrame: { value: number; pass: boolean };
  pass: boolean;
}

/** Run on the 512 px work image. */
export function photoCoach(img: RGBAImage): CoachResult {
  const c = CONFIG.coach, { width: w, height: h, data: d } = img;
  const y = new Float64Array(w * h);
  let sum = 0, over = 0;
  for (let i = 0, p = 0; i < y.length; i++, p += 4) {
    const v = 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2];
    y[i] = v; sum += v; if (v > 250) over++;
  }
  // variance of the 4-neighbour Laplacian over interior pixels
  let n = 0, m1 = 0, m2 = 0;
  for (let r = 1; r < h - 1; r++) for (let x = 1; x < w - 1; x++) {
    const i = r * w + x;
    const lap = y[i - w] + y[i + w] + y[i - 1] + y[i + 1] - 4 * y[i];
    n++; m1 += lap; m2 += lap * lap;
  }
  const mean = m1 / n, sharp = m2 / n - mean * mean;
  const luma = sum / y.length, overPct = (over / y.length) * 100;
  const leafPct = (countOn(plantMask(img, hsvArrays(img))) / y.length) * 100;
  const lightPass = luma >= c.minLuma && luma <= c.maxLuma && overPct <= c.maxOverexposedPct;
  const res: CoachResult = {
    sharpness: { value: round1(sharp), pass: sharp >= c.minSharpness },
    light: { value: round1(luma), overexposedPct: round2(overPct), pass: lightPass,
      problem: lightPass ? null : luma < c.minLuma ? "dark" : "bright" },
    leafInFrame: { value: round1(leafPct), pass: leafPct >= c.minLeafPct },
    pass: false,
  };
  res.pass = res.sharpness.pass && res.light.pass && res.leafInFrame.pass;
  return res;
}

const round1 = (v: number) => Math.round(v * 10) / 10;
const round2 = (v: number) => Math.round(v * 100) / 100;
