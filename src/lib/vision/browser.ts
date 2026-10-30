// Browser helpers: decode photos (EXIF-corrected), downscale with good quality, read pixels.
import { CONFIG } from "../../config";
import type { RGBAImage } from "./types";

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

function makeCanvas(w: number, h: number): AnyCanvas {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas"); c.width = w; c.height = h; return c;
}
const ctx2d = (c: AnyCanvas) => c.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;

export async function toBitmap(src: Blob | string): Promise<ImageBitmap> {
  const blob = typeof src === "string" ? await (await fetch(src)).blob() : src;
  return createImageBitmap(blob, { imageOrientation: "from-image" });
}

/** Downscale so the long side is at most maxSide, halving step by step for smooth results. */
export function drawScaled(bmp: ImageBitmap | AnyCanvas, maxSide: number): AnyCanvas {
  let w = bmp.width, h = bmp.height;
  const s = Math.min(1, maxSide / Math.max(w, h));
  const tw = Math.max(1, Math.round(w * s)), th = Math.max(1, Math.round(h * s));
  let cur: ImageBitmap | AnyCanvas = bmp;
  while (w / 2 >= tw && h / 2 >= th) {
    const c = makeCanvas(Math.round(w / 2), Math.round(h / 2)), g = ctx2d(c);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
    g.drawImage(cur as CanvasImageSource, 0, 0, c.width, c.height);
    cur = c; w = c.width; h = c.height;
  }
  const out = makeCanvas(tw, th), g = ctx2d(out);
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
  g.drawImage(cur as CanvasImageSource, 0, 0, tw, th);
  return out;
}

export function canvasPixels(c: AnyCanvas): RGBAImage {
  const id = ctx2d(c).getImageData(0, 0, c.width, c.height);
  return { width: id.width, height: id.height, data: id.data };
}

/** 512 px work image for Photo Coach, masks and compare. */
export async function loadWorkImage(src: Blob | string, longSide: number = CONFIG.workSize): Promise<RGBAImage> {
  const bmp = await toBitmap(src);
  try { return canvasPixels(drawScaled(bmp, longSide)); } finally { bmp.close(); }
}

/** JPEG for storage (default 1024 px long side). */
export async function shrinkForStorage(src: Blob, maxSide: number = CONFIG.storeMaxSide, quality = 0.85): Promise<Blob> {
  const bmp = await toBitmap(src);
  try {
    const c = drawScaled(bmp, maxSide);
    if ("convertToBlob" in c) return (c as OffscreenCanvas).convertToBlob({ type: "image/jpeg", quality });
    return await new Promise<Blob>((res, rej) => (c as HTMLCanvasElement).toBlob((b) => (b ? res(b) : rej(new Error("toBlob failed"))), "image/jpeg", quality));
  } finally { bmp.close(); }
}

/** Full pixels of a stored photo (used for the model, which crops and resizes itself). */
export async function loadPixels(src: Blob | string, maxSide: number = CONFIG.storeMaxSide): Promise<RGBAImage> {
  return loadWorkImage(src, maxSide);
}
