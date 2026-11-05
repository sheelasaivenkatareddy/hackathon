// On-device fallback for the AI circles and the "is this a leaf?" check, from the colour masks.
import type { Detection } from "../cloud";
import { hsvArrays } from "./masks";
import { and, closeSquare, dilateSquare, fillHoles, label } from "./morph";
import { type RGBAImage, countOn, newMask } from "./types";

const MAX_REGIONS = 30; // mark every affected area, not just the biggest few
const LEAF_CLOSE_PX = 15; // bridges a lesion that bites into the leaf edge, so it still counts as leaf
const MIN_LEAF_IMAGE_PCT = 3; // a leaf blob smaller than this is a stray patch of green
const MIN_REGION_LEAF_PCT = 0.05; // smaller blobs are speckle, not a spot worth circling
const MAX_REGION_LEAF_PCT = 95; // a big blighted patch is the most important thing to circle; only "the whole leaf" is rejected

/**
 * Finds off-colour patches inside the leaves and boxes them on a 0-1000 scale.
 * The leaf area is true green closed over small gaps and filled, so stakes, pots and soil behind the leaves stay outside it.
 * Inside it, brown/tan spots, bright yellow (chlorotic) patches and grey (collapsed) tissue are problems.
 * This is a rough fallback for when AI vision is not available.
 */
export function spotRegions(img: RGBAImage): Detection[] {
  const { width: w, height: h } = img, n = w * h, { H, S, V } = hsvArrays(img);
  const green = newMask(w, h), odd = newMask(w, h), pale = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const hh = H[i], s = S[i], v = V[i];
    // Leaf green, including pale or shiny green (low saturation), so the leaf outline closes around big lesions.
    if (hh >= 65 && hh <= 170 && s > 0.1 && v > 0.15) { green.data[i] = 1; continue; }
    // Brown lesions run from orange-brown (hue < 50) round to dull purple-brown (hue 290-360, low saturation).
    const brown = (hh < 50 || hh >= 290) && s >= 0.1 && v >= 0.12 && v <= 0.9;
    const yellow = hh >= 45 && hh < 65 && s > 0.4 && v > 0.5;
    // Collapsed tissue is grey; brighter grey is usually sky or a wall. Pale, shiny green (glare on a healthy leaf) is not grey.
    const greenish = hh >= 65 && hh <= 170 && s > 0.08;
    const grey = !greenish && s > 0.05 && s < 0.18 && v > 0.3 && v < 0.7;
    if (brown || yellow || grey) { odd.data[i] = 1; pale[i] = (s < 0.3 && v > 0.5) || grey ? 1 : 0; }
  }
  const filled = fillHoles(closeSquare(green, LEAF_CLOSE_PX));
  const comps = label(filled, true), leaf = newMask(w, h), minLeaf = (MIN_LEAF_IMAGE_PCT / 100) * n;
  for (let i = 0; i < n; i++) leaf.data[i] = comps.labels[i] && comps.sizes[comps.labels[i]] >= minLeaf ? 1 : 0;
  // A big lesion can reach the photo edge (or a halo can), so it is not a "hole" in the leaf and the fill misses it.
  // Add any off-colour patch whose outline mostly borders the leaf: soil or sky beside a leaf borders it far less.
  const oddComps = label(odd, false);
  const edge = new Float64Array(oddComps.count + 1), touch = new Float64Array(oddComps.count + 1);
  for (let i = 0; i < n; i++) {
    const k = oddComps.labels[i];
    if (!k) continue;
    const x = i % w;
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
      if (j < 0 || j >= n || oddComps.labels[j] === k) continue;
      edge[k]++;
      if (leaf.data[j]) touch[k]++;
    }
  }
  for (let i = 0; i < n; i++) {
    const k = oddComps.labels[i];
    if (k && !leaf.data[i] && edge[k] > 0 && touch[k] / edge[k] >= 0.5) leaf.data[i] = 1;
  }
  const leafPx = Math.max(countOn(leaf), 1);
  const problem = and(odd, leaf);

  const { labels, sizes, count } = label(dilateSquare(problem, 4), true);
  const box = Array.from({ length: count + 1 }, () => ({ x0: w, y0: h, x1: 0, y1: 0, n: 0, pale: 0 }));
  for (let i = 0; i < n; i++) {
    const k = labels[i];
    if (!k) continue;
    const b = box[k], x = i % w, y = (i - x) / w;
    if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x; if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y;
    if (problem.data[i]) { b.n++; b.pale += pale[i]; }
  }
  const minPx = (MIN_REGION_LEAF_PCT / 100) * leafPx, maxPx = (MAX_REGION_LEAF_PCT / 100) * leafPx;
  return box
    .map((b, k) => ({ ...b, k, size: sizes[k] ?? 0 }))
    .filter((b) => b.k > 0 && b.n >= minPx && b.size <= maxPx)
    .sort((a, b) => b.n - a.n)
    .slice(0, MAX_REGIONS)
    .map((b) => {
      // Mostly pale, washed-out or grey pixels read as dead or dried tissue; saturated brown or yellow as active spotting.
      // A large patch is a spreading lesion even when its centre has dried pale, so only small pale patches are "dry".
      const big = b.n > leafPx * 0.03;
      const dry = b.pale > b.n * 0.6 && !big;
      return {
        ymin: Math.round((b.y0 / h) * 1000), xmin: Math.round((b.x0 / w) * 1000),
        ymax: Math.round(((b.y1 + 1) / h) * 1000), xmax: Math.round(((b.x1 + 1) / w) * 1000),
        type: dry ? "DRY_DEHYDRATED" : "DISEASED",
        issue: dry ? "Dried tissue" : big ? "Large lesion" : "Discoloured spot",
        reason: dry ? "Pale, papery, dried leaf tissue" : big ? "Large brown patch spreading over the leaf" : "Brown or yellow patch on green leaf",
      } satisfies Detection;
    });
}

export type PhotoKind = "leaf" | "flower" | "not_plant";

/** Share of the photo, in %, that is petal-coloured, bright yellow, and true leaf green. */
export function colourShares(img: RGBAImage) {
  const { H, S, V } = hsvArrays(img);
  let petal = 0, yellow = 0, green = 0;
  for (let i = 0; i < H.length; i++) {
    const hh = H[i], s = S[i], v = V[i];
    // Skin and soil are orange-red at middling saturation, so red petals must be vivid and bright.
    if ((hh >= 320 || hh < 6) && s > 0.6 && v > 0.55) petal++; // red, pink, magenta
    else if (hh >= 210 && hh < 320 && s > 0.35 && v > 0.4) petal++; // purple, violet, blue
    else if (hh >= 40 && hh <= 60 && s > 0.6 && v > 0.7) yellow++; // bright yellow petals
    else if (hh >= 65 && hh <= 170 && s > 0.2 && v > 0.15) green++;
  }
  const pct = (n: number) => (n / H.length) * 100;
  return { petalPct: pct(petal), yellowPct: pct(yellow), greenPct: pct(green) };
}

/** A rough colour check: petal colours outweighing leaf green means a flower; almost no green means no plant. */
export function photoKind(img: RGBAImage): PhotoKind {
  const { petalPct, yellowPct, greenPct } = colourShares(img);
  if ((petalPct > 10 && petalPct > greenPct * 0.4) || (yellowPct > 12 && yellowPct > greenPct * 0.4)) return "flower";
  if (greenPct < 8) return "not_plant";
  return "leaf";
}
