// Colour rules: plant pixels, spot pixels, leaf region, holes and damage.
import { CONFIG } from "../../config";
import { andNot, closeSquare, fillHoles, label, largestComponent, or, and } from "./morph";
import { Mask, RGBAImage, countOn, newMask } from "./types";

export interface LeafMasks {
  plant: Mask; // green leaf pixels
  spot: Mask; // brown/tan/purple spot pixels inside the leaf
  holes: Mask; // small enclosed gaps (feeding holes, tears)
  gaps: Mask; // all enclosed gaps (holes + space between leaves)
  leaf: Mask; // leaf region (largest component, holes filled)
  damage: Mask; // spot | holes (used to find NEW damage)
  leafPx: number;
  affectedPct: number; // discoloured (spot) area as % of leaf: used for trends and "was it clean?"
  holesPct: number; // holes as % of leaf (shown for information)
}

/** H in degrees 0-360, S and V in 0-1. Writes into the three arrays. */
export function hsvArrays(img: RGBAImage) {
  const n = img.width * img.height, H = new Float64Array(n), S = new Float64Array(n), V = new Float64Array(n);
  const d = img.data;
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const r = d[p] / 255, g = d[p + 1] / 255, b = d[p + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), c = mx - mn;
    let h = 0;
    if (c > 1e-6) {
      if (mx === r) h = (60 * ((g - b) / c) + 360) % 360;
      else if (mx === g) h = 60 * ((b - r) / c) + 120;
      else h = 60 * ((r - g) / c) + 240;
    }
    H[i] = h; S[i] = mx > 0 ? c / mx : 0; V[i] = mx;
  }
  return { H, S, V };
}

export function plantMask(img: RGBAImage, hsv = hsvArrays(img)): Mask {
  const p = CONFIG.colour.plant, m = newMask(img.width, img.height);
  for (let i = 0; i < m.data.length; i++) {
    const h = hsv.H[i], s = hsv.S[i], v = hsv.V[i];
    m.data[i] = h >= p.hMin && h <= p.hMax && s >= p.sMin && v >= p.vMin && v <= p.vMax ? 1 : 0;
  }
  return m;
}

export function spotMask(img: RGBAImage, hsv = hsvArrays(img)): Mask {
  const p = CONFIG.colour.spot, m = newMask(img.width, img.height);
  for (let i = 0; i < m.data.length; i++) {
    const h = hsv.H[i], s = hsv.S[i], v = hsv.V[i];
    m.data[i] = (h < p.hBelow || h > p.hAbove) && s >= p.sMin && v >= p.vMin && v <= p.vMax ? 1 : 0;
  }
  return m;
}

export function leafMasks(img: RGBAImage): LeafMasks {
  const hsv = hsvArrays(img);
  const plant = plantMask(img, hsv), spotAll = spotMask(img, hsv);
  const closed = closeSquare(or(plant, spotAll), CONFIG.colour.closePx);
  const region = largestComponent(closed);
  const leaf = fillHoles(region);
  const leafPx = Math.max(countOn(leaf), 1);
  const gaps = andNot(leaf, closed);
  const { labels, sizes, count } = label(gaps, true);
  const maxHole = (CONFIG.colour.holeMaxLeafPct / 100) * leafPx;
  const keep = new Uint8Array(count + 1);
  for (let k = 1; k <= count; k++) keep[k] = sizes[k] <= maxHole ? 1 : 0;
  const holes = newMask(img.width, img.height);
  for (let i = 0; i < labels.length; i++) holes.data[i] = keep[labels[i]];
  const spot = and(spotAll, leaf);
  const damage = or(spot, holes);
  return { plant, spot, holes, gaps, leaf, damage, leafPx,
    affectedPct: (countOn(spot) / leafPx) * 100, holesPct: (countOn(holes) / leafPx) * 100 };
}
