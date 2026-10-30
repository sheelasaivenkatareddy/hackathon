// Turn masks and heatmaps into RGBA overlays you can draw on a canvas over the photo.
import type { Mask, RGBAImage } from "./types";

export function maskToOverlay(mask: Mask, rgb: [number, number, number], alpha = 0.6): RGBAImage {
  const out = new Uint8ClampedArray(mask.width * mask.height * 4);
  const a = Math.round(alpha * 255);
  for (let i = 0; i < mask.data.length; i++) if (mask.data[i]) {
    out[i * 4] = rgb[0]; out[i * 4 + 1] = rgb[1]; out[i * 4 + 2] = rgb[2]; out[i * 4 + 3] = a;
  }
  return { width: mask.width, height: mask.height, data: out };
}

/** Blue -> cyan -> yellow -> red, t in 0..1. */
export function heatColor(t: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, t));
  const r = Math.min(1, Math.max(0, 1.5 - Math.abs(4 * x - 3)));
  const g = Math.min(1, Math.max(0, 1.5 - Math.abs(4 * x - 2)));
  const b = Math.min(1, Math.max(0, 1.5 - Math.abs(4 * x - 1)));
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

export interface CropBox { x: number; y: number; w: number; h: number } // in the photo's own pixels

/**
 * Grad-CAM (h x w, e.g. 7x7) for one class -> RGBA overlay the size of the photo.
 * Only the model's centre crop is coloured; the rest stays transparent.
 */
export function camToOverlay(cam: Float32Array | number[], camW: number, camH: number, box: CropBox,
  photoW: number, photoH: number, maxAlpha = 0.55): RGBAImage {
  let mx = 0;
  for (let i = 0; i < camW * camH; i++) mx = Math.max(mx, cam[i]);
  const out = new Uint8ClampedArray(photoW * photoH * 4);
  if (mx <= 0) return { width: photoW, height: photoH, data: out };
  for (let y = Math.max(0, Math.floor(box.y)); y < Math.min(photoH, Math.ceil(box.y + box.h)); y++) {
    for (let x = Math.max(0, Math.floor(box.x)); x < Math.min(photoW, Math.ceil(box.x + box.w)); x++) {
      // bilinear sample, cell centres at (i + 0.5) / camW
      const u = ((x - box.x) / box.w) * camW - 0.5, v = ((y - box.y) / box.h) * camH - 0.5;
      const x0 = Math.max(0, Math.min(camW - 1, Math.floor(u))), y0 = Math.max(0, Math.min(camH - 1, Math.floor(v)));
      const x1 = Math.min(camW - 1, x0 + 1), y1 = Math.min(camH - 1, y0 + 1);
      const fx = Math.min(1, Math.max(0, u - x0)), fy = Math.min(1, Math.max(0, v - y0));
      const val = (cam[y0 * camW + x0] * (1 - fx) + cam[y0 * camW + x1] * fx) * (1 - fy) +
        (cam[y1 * camW + x0] * (1 - fx) + cam[y1 * camW + x1] * fx) * fy;
      const t = val / mx, [r, g, b] = heatColor(t), i = (y * photoW + x) * 4;
      out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = Math.round(Math.min(1, t * 1.5) * maxAlpha * 255);
    }
  }
  return { width: photoW, height: photoH, data: out };
}
