// Line up the older photo with the newer one: leaf-shape moments, then ORB + RANSAC (OpenCV.js) when available.
import { CONFIG } from "../../config";
import { dilateDiamond } from "./morph";
import { Mask, Mat3, RGBAImage, newMask } from "./types";

export interface Alignment { M: Mat3; leafIou: number; method: "moments" | "orb+homography"; quality: "good" | "fair" | "poor" }

function moments(m: Mask) {
  let n = 0, sx = 0, sy = 0;
  for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) if (m.data[y * m.width + x]) { n++; sx += x; sy += y; }
  const cx = sx / n, cy = sy / n;
  let mu20 = 0, mu02 = 0, mu11 = 0;
  for (let y = 0; y < m.height; y++) for (let x = 0; x < m.width; x++) if (m.data[y * m.width + x]) {
    const dx = x - cx, dy = y - cy; mu20 += dx * dx; mu02 += dy * dy; mu11 += dx * dy;
  }
  return { cx, cy, theta: 0.5 * Math.atan2(2 * mu11 / n, mu20 / n - mu02 / n), area: n };
}

function similarity(cxa: number, cya: number, cxb: number, cyb: number, rot: number, scale: number): Mat3 {
  const c = Math.cos(rot) * scale, s = Math.sin(rot) * scale;
  return [c, -s, cxb - (c * cxa - s * cya), s, c, cyb - (s * cxa + c * cya), 0, 0, 1];
}

export function invert3(m: Mat3): Mat3 {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det,
    B / det, (a * i - c * g) / det, -(a * f - c * d) / det,
    C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
}

/** Warp a mask from the older photo into the newer photo's frame (nearest neighbour). */
export function warpMask(m: Mask, M: Mat3, outW: number, outH: number): Mask {
  const inv = invert3(M), o = newMask(outW, outH);
  for (let y = 0; y < outH; y++) for (let x = 0; x < outW; x++) {
    const w = inv[6] * x + inv[7] * y + inv[8];
    const sx = Math.round((inv[0] * x + inv[1] * y + inv[2]) / w), sy = Math.round((inv[3] * x + inv[4] * y + inv[5]) / w);
    if (sx >= 0 && sx < m.width && sy >= 0 && sy < m.height) o.data[y * outW + x] = m.data[sy * m.width + sx];
  }
  return o;
}

/** Pixels of the newer photo that were also inside the older photo's frame. */
export function visibleInBoth(aw: number, ah: number, M: Mat3, bw: number, bh: number): Mask {
  const ones = newMask(aw, ah); ones.data.fill(1);
  return warpMask(ones, M, bw, bh);
}

export function iou(a: Mask, b: Mask, valid?: Mask): number {
  let inter = 0, uni = 0;
  for (let i = 0; i < a.data.length; i++) {
    if (valid && !valid.data[i]) continue;
    inter += a.data[i] & b.data[i]; uni += a.data[i] | b.data[i];
  }
  return uni ? inter / uni : 0;
}

/** cv = the OpenCV.js module (already initialised) or null to skip the ORB step. */
export function align(a: RGBAImage, b: RGBAImage, leafA: Mask, leafB: Mask, cv: any | null): Alignment {
  const ma = moments(leafA), mb = moments(leafB);
  const scale = Math.sqrt(mb.area / Math.max(ma.area, 1));
  let best: { M: Mat3; score: number; method: Alignment["method"] } | null = null;
  for (const extra of [0, Math.PI]) {
    const M = similarity(ma.cx, ma.cy, mb.cx, mb.cy, mb.theta - ma.theta + extra, scale);
    const score = iou(warpMask(leafA, M, b.width, b.height), leafB, visibleInBoth(a.width, a.height, M, b.width, b.height));
    if (!best || score > best.score) best = { M, score, method: "moments" };
  }
  if (cv) {
    const H = orbHomography(cv, a, b, leafA, leafB);
    if (H) {
      const score = iou(warpMask(leafA, H, b.width, b.height), leafB, visibleInBoth(a.width, a.height, H, b.width, b.height));
      best = { M: H, score, method: "orb+homography" }; // feature matches beat leaf-shape moments
    }
  }
  const c = CONFIG.compare;
  const quality = best!.score >= c.alignGood ? "good" : best!.score >= c.alignFair ? "fair" : "poor";
  return { M: best!.M, leafIou: Math.round(best!.score * 1000) / 1000, method: best!.method, quality };
}

function toGray(cv: any, img: RGBAImage) {
  const rgba = cv.matFromImageData({ data: img.data, width: img.width, height: img.height });
  const gray = new cv.Mat();
  cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
  rgba.delete();
  return gray;
}

function maskMat(cv: any, m: Mask) {
  const grown = dilateDiamond(m, 5);
  const mat = new cv.Mat(m.height, m.width, cv.CV_8UC1);
  for (let i = 0; i < grown.data.length; i++) mat.data[i] = grown.data[i] ? 255 : 0;
  return mat;
}

function orbHomography(cv: any, a: RGBAImage, b: RGBAImage, leafA: Mask, leafB: Mask): Mat3 | null {
  const o = CONFIG.compare.orb;
  const ga = toGray(cv, a), gb = toGray(cv, b), mka = maskMat(cv, leafA), mkb = maskMat(cv, leafB);
  const orb = new cv.ORB(o.features);
  const ka = new cv.KeyPointVector(), kb = new cv.KeyPointVector(), da = new cv.Mat(), db = new cv.Mat();
  const matcher = new cv.BFMatcher(cv.NORM_HAMMING, false), knn = new cv.DMatchVectorVector();
  const toFree: any[] = [ga, gb, mka, mkb, orb, ka, kb, da, db, matcher, knn];
  try {
    orb.detectAndCompute(ga, mka, ka, da);
    orb.detectAndCompute(gb, mkb, kb, db);
    if (ka.size() < 8 || kb.size() < 8 || da.rows === 0 || db.rows === 0) return null;
    matcher.knnMatch(da, db, knn, 2);
    const src: number[] = [], dst: number[] = [];
    for (let i = 0; i < knn.size(); i++) {
      const pair = knn.get(i);
      if (pair.size() === 2) {
        const m0 = pair.get(0), m1 = pair.get(1);
        if (m0.distance < o.ratio * m1.distance) {
          const pa = ka.get(m0.queryIdx).pt, pb = kb.get(m0.trainIdx).pt;
          src.push(pa.x, pa.y); dst.push(pb.x, pb.y);
        }
      }
    }
    const nGood = src.length / 2;
    if (nGood < o.minInliers) return null;
    const sm = cv.matFromArray(nGood, 1, cv.CV_32FC2, src), dm = cv.matFromArray(nGood, 1, cv.CV_32FC2, dst);
    const inl = new cv.Mat();
    toFree.push(sm, dm, inl);
    const Hm = cv.findHomography(sm, dm, cv.RANSAC, o.ransacPx, inl);
    toFree.push(Hm);
    if (Hm.empty()) return null;
    let nIn = 0;
    for (let i = 0; i < inl.rows; i++) nIn += inl.data[i] ? 1 : 0;
    const h = Array.from(Hm.data64F) as number[];
    const H: Mat3 = h.map((v) => v / h[8]) as Mat3;
    // near-similar check: singular values of the 2x2 part, small perspective terms
    const [p, q, , r, s] = H;
    const S1 = p * p + q * q + r * r + s * s, det = p * s - q * r;
    const disc = Math.sqrt(Math.max(S1 * S1 - 4 * det * det, 0));
    const sMax = Math.sqrt((S1 + disc) / 2), sMin = Math.sqrt(Math.max((S1 - disc) / 2, 0));
    const ok = nIn >= o.minInliers && nIn / nGood >= o.minInlierRatio && sMin >= o.scaleMin && sMax <= o.scaleMax &&
      Math.abs(H[6]) < 2e-3 && Math.abs(H[7]) < 2e-3;
    return ok ? H : null;
  } finally {
    for (const m of toFree) { try { m.delete(); } catch { /* already freed */ } }
  }
}
