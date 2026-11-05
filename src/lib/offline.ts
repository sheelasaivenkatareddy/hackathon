// Offline pack: the AI model, OpenCV, the ONNX runtime and sample photos, saved in the browser cache so scans work
// with no internet. Kisan Hub saves it by itself right after sign-in (about 23 MB, once) and shows the progress,
// because a farmer who goes offline before it finishes would otherwise get no AI diagnosis.
import { useEffect, useState } from "react";
import { SAMPLES } from "../components/PhotoFlow";
import { FIELD_HEAD, FIELD_MODEL, FIELD_REPORT } from "./diagnose";
import { TEST_PAIR_URLS } from "./watch";

export const OFFLINE_URLS = [
  FIELD_MODEL, FIELD_HEAD, FIELD_REPORT, "/opencv/opencv.js", "/ort/ort-wasm-simd-threaded.mjs", "/ort/ort-wasm-simd-threaded.wasm",
  "/model/labels.json", "/model/calibration.json", ...SAMPLES.map((s) => `/samples/${s.file}`), "/samples/field-row.jpg",
  "/samples/busy-background.jpg", "/samples/timeline/manifest.json", ...TEST_PAIR_URLS,
];

export type PackState = { phase: "unknown" | "ready" | "missing" | "busy"; done: number; total: number; failed: number };
let state: PackState = { phase: "unknown", done: 0, total: OFFLINE_URLS.length, failed: 0 };
const listeners = new Set<(s: PackState) => void>();
const set = (s: Partial<PackState>) => { state = { ...state, ...s }; listeners.forEach((l) => l(state)); };

const hasCache = () => typeof window !== "undefined" && "caches" in window;

export async function offlinePackReady(): Promise<boolean> {
  if (!hasCache()) return false;
  const cache = await caches.open("patra-runtime");
  const ok = (await Promise.all(OFFLINE_URLS.map((u) => cache.match(u, { ignoreVary: true })))).every(Boolean);
  set({ phase: ok ? "ready" : state.phase === "busy" ? "busy" : "missing", done: ok ? OFFLINE_URLS.length : state.done });
  return ok;
}

/** Saves every file ourselves and checks it. Returns how many could not be stored (0 = ready for offline). */
export async function cacheOfflinePack(): Promise<number> {
  if (!hasCache()) return OFFLINE_URLS.length;
  if (state.phase === "busy") return state.failed;
  const cache = await caches.open("patra-runtime");
  set({ phase: "busy", done: 0, failed: 0 });
  let done = 0;
  await Promise.allSettled(OFFLINE_URLS.map(async (u) => {
    try { if (!(await cache.match(u, { ignoreVary: true }))) await cache.add(u); } finally { set({ done: ++done }); }
  }));
  const stored = await Promise.all(OFFLINE_URLS.map((u) => cache.match(u, { ignoreVary: true })));
  const failed = stored.filter((r) => !r).length;
  set({ phase: failed ? "missing" : "ready", failed, done: OFFLINE_URLS.length - failed });
  return failed;
}

/** Saves the pack once per session when online; skipped only in the phone's data-saver mode. */
let ensuring = false;
export async function ensureOfflinePack() {
  if (ensuring || typeof navigator === "undefined" || !navigator.onLine) return;
  ensuring = true;
  try {
    if (await offlinePackReady()) return;
    const c = (navigator as unknown as { connection?: { saveData?: boolean } }).connection;
    if (c?.saveData) return; // the farmer asked the phone to save data: they can press the button instead
    await cacheOfflinePack();
  } finally { ensuring = false; }
}

export function usePackState(): PackState {
  const [s, setS] = useState(state);
  useEffect(() => { listeners.add(setS); offlinePackReady().catch(() => undefined); return () => { listeners.delete(setS); }; }, []);
  return s;
}
