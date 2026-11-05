// Offline pack: the AI model, OpenCV, the ONNX runtime and sample photos, saved in the browser cache so scans work
// with no internet. Used by Settings ("Prepare for offline") and, on Wi-Fi, quietly by Kisan Hub.
import { SAMPLES } from "../components/PhotoFlow";
import { FIELD_HEAD, FIELD_MODEL, FIELD_REPORT } from "./diagnose";
import { TEST_PAIR_URLS } from "./watch";

export const OFFLINE_URLS = [
  FIELD_MODEL, FIELD_HEAD, FIELD_REPORT, "/opencv/opencv.js", "/ort/ort-wasm-simd-threaded.mjs", "/ort/ort-wasm-simd-threaded.wasm",
  "/model/labels.json", "/model/calibration.json", ...SAMPLES.map((s) => `/samples/${s.file}`), "/samples/field-row.jpg",
  "/samples/busy-background.jpg", "/samples/timeline/manifest.json", ...TEST_PAIR_URLS,
];

/** Saves every file ourselves and checks it. Returns how many could not be stored (0 = ready for offline). */
export async function cacheOfflinePack(): Promise<number> {
  if (!("caches" in window)) return OFFLINE_URLS.length;
  const cache = await caches.open("patra-runtime");
  await Promise.allSettled(OFFLINE_URLS.map(async (u) => { if (!(await cache.match(u, { ignoreVary: true }))) await cache.add(u); }));
  const stored = await Promise.all(OFFLINE_URLS.map((u) => cache.match(u, { ignoreVary: true })));
  return stored.filter((r) => !r).length;
}

export async function offlinePackReady(): Promise<boolean> {
  if (!("caches" in window)) return false;
  const cache = await caches.open("patra-runtime");
  return (await Promise.all(OFFLINE_URLS.map((u) => cache.match(u, { ignoreVary: true })))).every(Boolean);
}

/** Phone data costs money: do not download the 23 MB pack on mobile data or when the phone is in data-saver mode. */
export function onUnmeteredConnection(): boolean {
  const c = (navigator as unknown as { connection?: { type?: string; saveData?: boolean } }).connection;
  return !(c?.saveData || c?.type === "cellular");
}
