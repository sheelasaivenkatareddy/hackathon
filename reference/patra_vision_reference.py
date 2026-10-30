"""
Patra Lens vision reference (Python).

This is the reference for the browser code in src/lib/vision/. Port it to TypeScript
and check that both give the same numbers on the sample photos (see EXPECTED_RESULTS.md).

  python patra_vision_reference.py coach  photo.jpg
  python patra_vision_reference.py masks  photo.jpg   [--overlay out.png]
  python patra_vision_reference.py compare older.jpg newer.jpg --days 2 [--overlay out.png]

Needs: numpy, pillow, scipy. Optional: opencv-python (ORB refinement of the alignment).
Every threshold below matches src/config.ts in the build spec.
"""
from __future__ import annotations

import argparse
import json
import math
import sys

import numpy as np
from PIL import Image, ImageOps
from scipy import ndimage as ndi

try:  # optional, only for the ORB refinement step
    import cv2  # type: ignore
except Exception:  # pragma: no cover
    cv2 = None

# ----------------------------------------------------------------------------- config
CFG = {
    "work_size": 512,             # long side used for all pixel maths
    "coach": {
        "min_sharpness": 40.0,    # variance of the Laplacian on luma
        "min_luma": 60.0,         # mean luma, 0-255
        "max_luma": 200.0,
        "max_overexposed_pct": 5.0,   # % of pixels with luma > 250
        "min_leaf_pct": 30.0,     # % of plant-like pixels
    },
    "plant": {"h_min": 25.0, "h_max": 195.0, "s_min": 0.20, "v_min": 0.15, "v_max": 0.95},  # 170-195 = bluish-green leaf in shade
    "spot": {"h_below": 50.0, "h_above": 290.0, "s_min": 0.10, "v_min": 0.08, "v_max": 0.85},
    "close_px": 7,                # square closing size for the leaf region
    "hole_max_leaf_pct": 2.0,     # a hole bigger than this is a gap between leaves, not damage
    "compare": {
        "tolerance_px": 7,        # old damage is dilated by this many pixels
        "new_overlap_max": 0.20,  # a component is NEW if < 20% of it overlaps old damage
        "min_component_px": 15,   # smallest damage blob counted (about 2 px radius at 512 px)
        "common_erode_px": 3,     # shrink the shared leaf area a little to ignore edge effects
        "min_inside_common": 0.8, # a blob must lie mostly inside the shared leaf area
        "min_was_green": 0.6,     # ...and the older photo must show green leaf under most of it
        "align_good": 0.80,       # leaf IoU after alignment
        "align_fair": 0.65,
        "first_spot_max_old_pct": 1.0,
        "spreading_new_count": 3,
        "change_points_per_3_days": 2.0,
        "orb": {"features": 1000, "ratio": 0.75, "ransac_px": 5.0, "min_inliers": 25,
                "min_inlier_ratio": 0.30, "scale_min": 0.7, "scale_max": 1.4},
    },
}

# ----------------------------------------------------------------------------- basics
def load_work(path_or_img, size: int = CFG["work_size"]) -> np.ndarray:
    """EXIF-correct, RGB, long side = size (never upscale). Returns float32 HxWx3 in 0..255."""
    im = path_or_img if isinstance(path_or_img, Image.Image) else Image.open(path_or_img)
    im = ImageOps.exif_transpose(im).convert("RGB")
    w, h = im.size
    s = size / max(w, h)
    if s < 1:
        im = im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.BILINEAR)
    return np.asarray(im).astype(np.float32)


def luma(a: np.ndarray) -> np.ndarray:
    a = a.astype(np.float64)
    return 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]


def rgb_to_hsv(a: np.ndarray):
    """H in degrees 0..360, S and V in 0..1 (same maths as the usual JS rgbToHsv)."""
    a = a.astype(np.float64)  # float64 so results match the TypeScript version exactly
    r, g, b = a[..., 0] / 255.0, a[..., 1] / 255.0, a[..., 2] / 255.0
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    d = mx - mn
    h = np.zeros_like(mx)
    nz = d > 1e-6
    rm = nz & (mx == r)
    gm = nz & (mx == g) & ~rm
    bm = nz & ~rm & ~gm
    h[rm] = (60.0 * ((g - b)[rm] / d[rm])) % 360.0
    h[gm] = 60.0 * ((b - r)[gm] / d[gm]) + 120.0
    h[bm] = 60.0 * ((r - g)[bm] / d[bm]) + 240.0
    s = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0.0)
    return h, s, mx


# ----------------------------------------------------------------------------- Photo Coach
def photo_coach(a: np.ndarray) -> dict:
    c = CFG["coach"]
    y = luma(a)
    lap = y[:-2, 1:-1] + y[2:, 1:-1] + y[1:-1, :-2] + y[1:-1, 2:] - 4.0 * y[1:-1, 1:-1]
    sharp = float(lap.var())
    mean_l = float(y.mean())
    over = float((y > 250).mean() * 100)
    leaf = float(plant_mask(a).mean() * 100)
    checks = {
        "sharpness": {"value": round(sharp, 1), "pass": sharp >= c["min_sharpness"]},
        "light": {"value": round(mean_l, 1), "overexposed_pct": round(over, 2),
                  "pass": c["min_luma"] <= mean_l <= c["max_luma"] and over <= c["max_overexposed_pct"]},
        "leaf_in_frame": {"value": round(leaf, 1), "pass": leaf >= c["min_leaf_pct"]},
    }
    checks["pass"] = all(v["pass"] for v in checks.values() if isinstance(v, dict))
    return checks


# ----------------------------------------------------------------------------- masks
def plant_mask(a: np.ndarray) -> np.ndarray:
    p = CFG["plant"]
    h, s, v = rgb_to_hsv(a)
    return (h >= p["h_min"]) & (h <= p["h_max"]) & (s >= p["s_min"]) & (v >= p["v_min"]) & (v <= p["v_max"])


def spot_mask(a: np.ndarray) -> np.ndarray:
    p = CFG["spot"]
    h, s, v = rgb_to_hsv(a)
    return ((h < p["h_below"]) | (h > p["h_above"])) & (s >= p["s_min"]) & (v >= p["v_min"]) & (v <= p["v_max"])


EIGHT = np.ones((3, 3), bool)


def largest_component(m: np.ndarray) -> np.ndarray:
    lab, n = ndi.label(m, structure=EIGHT)
    if n == 0:
        return np.zeros_like(m)
    sizes = ndi.sum(m, lab, range(1, n + 1))
    return lab == (1 + int(np.argmax(sizes)))


def disk(r: int) -> np.ndarray:
    y, x = np.ogrid[-r:r + 1, -r:r + 1]
    return (x * x + y * y) <= r * r


def masks(a: np.ndarray) -> dict:
    plant = plant_mask(a)
    spot = spot_mask(a)
    k = CFG["close_px"]
    closed = ndi.binary_closing(plant | spot, structure=np.ones((k, k), bool))
    region = largest_component(closed)
    filled = ndi.binary_fill_holes(region)
    leaf_px = max(int(filled.sum()), 1)
    gaps = filled & ~closed
    lab, n = ndi.label(gaps, structure=EIGHT)
    holes = np.zeros_like(gaps)
    if n:
        sizes = ndi.sum(gaps, lab, range(1, n + 1))
        keep = [i + 1 for i, sz in enumerate(sizes) if sz <= CFG["hole_max_leaf_pct"] / 100 * leaf_px]
        holes = np.isin(lab, keep)
    spots_in = spot & filled
    damage = spots_in | holes
    return {
        "plant": plant, "spot": spots_in, "holes": holes, "gaps": gaps, "leaf": filled, "damage": damage,
        "leaf_px": leaf_px,
        # affected area = discoloured (spot) area only: steadier than holes, which depend on photo framing
        "affected_pct": float(spots_in.sum() / leaf_px * 100),
        "holes_pct": float(holes.sum() / leaf_px * 100),
    }


# ----------------------------------------------------------------------------- alignment
def mask_moments(m: np.ndarray):
    ys, xs = np.nonzero(m)
    cx, cy = xs.mean(), ys.mean()
    dx, dy = xs - cx, ys - cy
    mu20, mu02, mu11 = (dx * dx).mean(), (dy * dy).mean(), (dx * dy).mean()
    theta = 0.5 * math.atan2(2 * mu11, mu20 - mu02)
    return cx, cy, theta, float(m.sum())


def similarity_matrix(cxa, cya, cxb, cyb, rot, scale) -> np.ndarray:
    """2x3 matrix mapping A pixel coords to B pixel coords."""
    c, s = math.cos(rot) * scale, math.sin(rot) * scale
    return np.array([[c, -s, cxb - (c * cxa - s * cya)],
                     [s, c, cyb - (s * cxa + c * cya)]], dtype=np.float64)


def warp_mask(m: np.ndarray, M: np.ndarray, out_shape) -> np.ndarray:
    """Warp a boolean mask from A into B's frame (nearest neighbour). M is 2x3 or 3x3 (A->B)."""
    H = np.vstack([M, [0, 0, 1]]) if M.shape == (2, 3) else M
    Hinv = np.linalg.inv(H)
    hh, ww = out_shape
    ys, xs = np.mgrid[0:hh, 0:ww]
    pts = np.stack([xs.ravel(), ys.ravel(), np.ones(xs.size)])
    src = Hinv @ pts
    sx = np.rint(src[0] / src[2]).astype(int)
    sy = np.rint(src[1] / src[2]).astype(int)
    ok = (sx >= 0) & (sx < m.shape[1]) & (sy >= 0) & (sy < m.shape[0])
    out = np.zeros(xs.size, bool)
    out[ok] = m[sy[ok], sx[ok]]
    return out.reshape(hh, ww)


def iou(a: np.ndarray, b: np.ndarray, valid: np.ndarray | None = None) -> float:
    if valid is not None:
        a, b = a & valid, b & valid
    u = (a | b).sum()
    return float((a & b).sum() / u) if u else 0.0


def visible_in_both(a_shape, M, b_shape) -> np.ndarray:
    """Pixels of B that were also inside photo A's frame."""
    return warp_mask(np.ones(a_shape[:2], bool), M, b_shape)


def align(a_img, b_img, leaf_a, leaf_b):
    cxa, cya, ta, area_a = mask_moments(leaf_a)
    cxb, cyb, tb, area_b = mask_moments(leaf_b)
    scale = math.sqrt(area_b / max(area_a, 1.0))
    best = None
    for extra in (0.0, math.pi):
        M = similarity_matrix(cxa, cya, cxb, cyb, (tb - ta) + extra, scale)
        score = iou(warp_mask(leaf_a, M, leaf_b.shape), leaf_b, visible_in_both(leaf_a.shape, M, leaf_b.shape))
        if best is None or score > best[1]:
            best = (M, score, "moments")
    if cv2 is not None:
        o = CFG["compare"]["orb"]
        ga = cv2.cvtColor(a_img.astype(np.uint8), cv2.COLOR_RGB2GRAY)
        gb = cv2.cvtColor(b_img.astype(np.uint8), cv2.COLOR_RGB2GRAY)
        orb = cv2.ORB_create(o["features"])
        ka, da = orb.detectAndCompute(ga, ndi.binary_dilation(leaf_a, iterations=5).astype(np.uint8) * 255)
        kb, db = orb.detectAndCompute(gb, ndi.binary_dilation(leaf_b, iterations=5).astype(np.uint8) * 255)
        if da is not None and db is not None and len(ka) >= 8 and len(kb) >= 8:
            matches = cv2.BFMatcher(cv2.NORM_HAMMING).knnMatch(da, db, k=2)
            good = [m[0] for m in matches if len(m) == 2 and m[0].distance < o["ratio"] * m[1].distance]
            if len(good) >= o["min_inliers"]:
                src = np.float32([ka[m.queryIdx].pt for m in good]).reshape(-1, 1, 2)
                dst = np.float32([kb[m.trainIdx].pt for m in good]).reshape(-1, 1, 2)
                H, inl = cv2.findHomography(src, dst, cv2.RANSAC, o["ransac_px"])
                if H is not None and inl is not None:
                    n_in = int(inl.sum())
                    sv = np.linalg.svd(H[:2, :2] / H[2, 2], compute_uv=False)
                    near_similar = (o["scale_min"] <= sv.min() and sv.max() <= o["scale_max"]
                                    and abs(H[2, 0]) < 2e-3 and abs(H[2, 1]) < 2e-3)
                    if n_in >= o["min_inliers"] and n_in / len(good) >= o["min_inlier_ratio"] and near_similar:
                        # feature matches are more precise than leaf-shape moments, so prefer them
                        score = iou(warp_mask(leaf_a, H, leaf_b.shape), leaf_b,
                                    visible_in_both(leaf_a.shape, H, leaf_b.shape))
                        best = (H, score, "orb+homography")
    c = CFG["compare"]
    quality = "good" if best[1] >= c["align_good"] else "fair" if best[1] >= c["align_fair"] else "poor"
    return best[0], round(best[1], 3), best[2], quality


# ----------------------------------------------------------------------------- compare
def compare(a_img: np.ndarray, b_img: np.ndarray, days: float) -> dict:
    c = CFG["compare"]
    ma, mb = masks(a_img), masks(b_img)
    M, score, method, quality = align(a_img, b_img, ma["leaf"], mb["leaf"])
    # reference = everything that was already not healthy leaf in the older photo
    # (spots, holes, and also bigger gaps, so a gap that changes size is not called new)
    old = warp_mask(ma["damage"] | ma["gaps"], M, mb["damage"].shape)
    old_tol = ndi.binary_dilation(old, structure=disk(c["tolerance_px"]))
    # only compare leaf that is visible in BOTH photos
    common = warp_mask(ma["leaf"], M, mb["leaf"].shape) & mb["leaf"] & visible_in_both(ma["leaf"].shape, M, mb["leaf"].shape)
    common = ndi.binary_erosion(common, structure=disk(c["common_erode_px"]))
    was_green = warp_mask(ma["plant"], M, mb["leaf"].shape)
    lab, n = ndi.label(mb["damage"], structure=EIGHT)
    min_px = c["min_component_px"]
    comps = []
    for i in range(1, n + 1):
        comp = lab == i
        size = int(comp.sum())
        if size < min_px or (comp & common).sum() < c["min_inside_common"] * size:
            continue
        if (comp & was_green).sum() < c["min_was_green"] * size:
            continue  # it was not healthy green leaf before (shadow, gap or old damage)
        overlap = float((comp & old_tol).sum() / size)
        if overlap < c["new_overlap_max"]:
            ys, xs = np.nonzero(comp)
            kind = "hole" if (comp & mb["holes"]).sum() > (comp & mb["spot"]).sum() else "spot"
            comps.append({"x": round(float(xs.mean()), 1), "y": round(float(ys.mean()), 1),
                          "r": round(math.sqrt(size / math.pi), 1), "px": size, "kind": kind})
    a_pct, b_pct = ma["affected_pct"], mb["affected_pct"]
    delta3 = (b_pct - a_pct) * 3.0 / max(1.0, float(days))
    n_new = len(comps)
    if quality == "poor":
        status = "not_comparable"
    elif a_pct < c["first_spot_max_old_pct"] and n_new >= 1:
        status = "first_spots_found"
    elif n_new >= c["spreading_new_count"] or delta3 >= c["change_points_per_3_days"]:
        status = "spreading"
    elif n_new >= 1:
        status = "new_spots_found"
    elif delta3 <= -c["change_points_per_3_days"]:
        status = "improving"
    else:
        status = "stable"
    return {
        "status": status,
        "new_spots": sum(1 for x in comps if x["kind"] == "spot"),
        "new_holes": sum(1 for x in comps if x["kind"] == "hole"),
        "components": comps,
        "affected_old_pct": round(a_pct, 2), "affected_new_pct": round(b_pct, 2),
        "change_per_3_days": round(delta3, 2),
        "alignment": {"quality": quality, "leaf_iou": score, "method": method},
        "_masks": mb, "_old": old,
    }


# ----------------------------------------------------------------------------- overlays
def overlay_masks(a: np.ndarray, m: dict) -> Image.Image:
    o = a.copy()
    o[~m["leaf"]] *= 0.35
    o[m["spot"]] = [255, 40, 200]
    o[m["holes"]] = [40, 220, 255]
    return Image.fromarray(o.clip(0, 255).astype(np.uint8))


def overlay_compare(b: np.ndarray, res: dict) -> Image.Image:
    from PIL import ImageDraw
    m = res["_masks"]
    o = b.copy()
    o[~m["leaf"]] *= 0.45
    o[res["_old"] & m["leaf"]] = o[res["_old"] & m["leaf"]] * 0.5 + np.array([217, 151, 15]) * 0.5
    im = Image.fromarray(o.clip(0, 255).astype(np.uint8))
    d = ImageDraw.Draw(im)
    for comp in res["components"]:
        r = max(10.0, comp["r"] * 1.8)
        d.ellipse([comp["x"] - r, comp["y"] - r, comp["x"] + r, comp["y"] + r], outline=(198, 75, 34), width=3)
    return im


# ----------------------------------------------------------------------------- CLI
def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    p1 = sub.add_parser("coach"); p1.add_argument("photo")
    p2 = sub.add_parser("masks"); p2.add_argument("photo"); p2.add_argument("--overlay")
    p3 = sub.add_parser("compare"); p3.add_argument("older"); p3.add_argument("newer")
    p3.add_argument("--days", type=float, default=3.0); p3.add_argument("--overlay")
    args = ap.parse_args(argv)
    if args.cmd == "coach":
        print(json.dumps(photo_coach(load_work(args.photo)), indent=2))
    elif args.cmd == "masks":
        a = load_work(args.photo); m = masks(a)
        print(json.dumps({"affected_pct": round(m["affected_pct"], 2),
                          "leaf_pct_of_photo": round(m["leaf"].mean() * 100, 1)}, indent=2))
        if args.overlay:
            overlay_masks(a, m).save(args.overlay)
    else:
        a, b = load_work(args.older), load_work(args.newer)
        res = compare(a, b, args.days)
        print(json.dumps({k: v for k, v in res.items() if not k.startswith("_")}, indent=2))
        if args.overlay:
            overlay_compare(b, res).save(args.overlay)


if __name__ == "__main__":
    main()
