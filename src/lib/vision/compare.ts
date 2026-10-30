// "Catch the First Spot": compare a sentinel leaf with its previous photo and find NEW damage.
import { CONFIG } from "../../config";
import { align, Alignment, visibleInBoth, warpMask } from "./align";
import { leafMasks, LeafMasks } from "./masks";
import { and, dilateDisk, erodeDisk, label, or } from "./morph";
import { Mask, RGBAImage, newMask } from "./types";

export type WatchStatus = "first_spots_found" | "new_spots_found" | "spreading" | "stable" | "improving" | "not_comparable";

export interface NewDamage { x: number; y: number; r: number; px: number; kind: "spot" | "hole" }

export interface CompareResult {
  status: WatchStatus;
  newSpots: number;
  newHoles: number;
  components: NewDamage[]; // in the newer photo's 512 px coordinates
  affectedOldPct: number;
  affectedNewPct: number;
  changePer3Days: number; // percentage points
  alignment: Alignment;
  overlay: { leaf: Mask; oldDamage: Mask; newDamage: Mask; spot: Mask; holes: Mask }; // for drawing
  workSize: { width: number; height: number };
}

/**
 * older/newer: 512 px work images (see browser.ts loadWorkImage).
 * days: days between the two photos.
 * cv: initialised OpenCV.js module, or null (alignment then uses leaf shape only and is less reliable).
 */
export function compareVisits(older: RGBAImage, newer: RGBAImage, days: number, cv: any | null): CompareResult {
  const c = CONFIG.compare;
  const ma: LeafMasks = leafMasks(older), mb: LeafMasks = leafMasks(newer);
  const al = align(older, newer, ma.leaf, mb.leaf, cv);
  const W = newer.width, H = newer.height;
  // reference = everything that was already not healthy leaf in the older photo
  const old = warpMask(or(ma.damage, ma.gaps), al.M, W, H);
  const oldTol = dilateDisk(old, c.tolerancePx);
  const visible = visibleInBoth(older.width, older.height, al.M, W, H);
  const common = erodeDisk(and(and(warpMask(ma.leaf, al.M, W, H), mb.leaf), visible), c.commonErodePx);
  const wasGreen = warpMask(ma.plant, al.M, W, H);

  const { labels, sizes, count } = label(mb.damage, true);
  const stats = Array.from({ length: count + 1 }, () => ({ inCommon: 0, overlapOld: 0, green: 0, holes: 0, spots: 0, sx: 0, sy: 0 }));
  for (let i = 0; i < labels.length; i++) {
    const k = labels[i];
    if (!k) continue;
    const s = stats[k], x = i % W, y = (i - x) / W;
    s.inCommon += common.data[i]; s.overlapOld += oldTol.data[i]; s.green += wasGreen.data[i];
    s.holes += mb.holes.data[i]; s.spots += mb.spot.data[i]; s.sx += x; s.sy += y;
  }
  const keep = new Uint8Array(count + 1);
  const comps: NewDamage[] = [];
  for (let k = 1; k <= count; k++) {
    const size = sizes[k], s = stats[k];
    if (size < c.minComponentPx) continue;
    if (s.inCommon < c.minInsideCommon * size) continue;
    if (s.green < c.minWasGreen * size) continue; // older photo did not show green leaf here
    if (s.overlapOld / size >= c.newOverlapMax) continue; // already there before
    keep[k] = 1;
    comps.push({ x: round1(s.sx / size), y: round1(s.sy / size), r: round1(Math.sqrt(size / Math.PI)), px: size,
      kind: s.holes > s.spots ? "hole" : "spot" });
  }
  const newDamage = newMask(W, H);
  for (let i = 0; i < labels.length; i++) newDamage.data[i] = keep[labels[i]];

  const aPct = ma.affectedPct, bPct = mb.affectedPct;
  const delta3 = ((bPct - aPct) * 3) / Math.max(1, days);
  const n = comps.length;
  let status: WatchStatus;
  if (al.quality === "poor") status = "not_comparable";
  else if (aPct < c.firstSpotMaxOldPct && n >= 1) status = "first_spots_found";
  else if (n >= c.spreadingNewCount || delta3 >= c.changePointsPer3Days) status = "spreading";
  else if (n >= 1) status = "new_spots_found";
  else if (delta3 <= -c.changePointsPer3Days) status = "improving";
  else status = "stable";

  return {
    status,
    newSpots: comps.filter((d) => d.kind === "spot").length,
    newHoles: comps.filter((d) => d.kind === "hole").length,
    components: comps,
    affectedOldPct: round2(aPct), affectedNewPct: round2(bPct), changePer3Days: round2(delta3),
    alignment: al,
    overlay: { leaf: mb.leaf, oldDamage: and(old, mb.leaf), newDamage, spot: mb.spot, holes: mb.holes },
    workSize: { width: W, height: H },
  };
}

const round1 = (v: number) => Math.round(v * 10) / 10;
const round2 = (v: number) => Math.round(v * 100) / 100;
