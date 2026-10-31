// Model adapter: on-device ONNX (preferred) -> server API -> demo values for bundled sample photos only.
import { CONFIG } from "../config";
import type { RGBAImage } from "./vision/types";
import type { CropBox } from "./vision/overlay";

export interface Label { index: number; label: string; name: string; plant?: string }
export interface Guess { label: string; name: string; p: number }
export type AnswerLevel = "CLEAR" | "CHECK" | "RETAKE" | "EXPERT";
export type Mode = "on-device" | "server" | "demo" | "none";

export interface Prediction {
  mode: Mode;
  top3: Guess[];
  cam?: { data: Float32Array; classes: number; w: number; h: number }; // Grad-CAM for every class
  cropBox?: CropBox; // where the model looked, in the input photo's pixels
  heatmapPng?: string; // server mode may send a ready heatmap instead
  modelVersion?: string;
}

// ----------------------------------------------------------------------------- pure helpers
export function softmax(logits: ArrayLike<number>, temperature = 1): Float32Array {
  let mx = -Infinity;
  for (let i = 0; i < logits.length; i++) mx = Math.max(mx, logits[i] / temperature);
  const out = new Float32Array(logits.length);
  let sum = 0;
  for (let i = 0; i < logits.length; i++) { out[i] = Math.exp(logits[i] / temperature - mx); sum += out[i]; }
  for (let i = 0; i < out.length; i++) out[i] /= sum;
  return out;
}

export function topK(probs: ArrayLike<number>, labels: Label[], k = 3): Guess[] {
  return Array.from(probs, (p, i) => ({ p, i })).sort((a, b) => b.p - a.p).slice(0, k)
    .map(({ p, i }) => ({ label: labels[i].label, name: labels[i].name, p: Math.round(p * 1000) / 1000 }));
}

/** coachPass = Photo Coach passed; usedAnyway = the user chose "Use anyway" after a failed check. */
export function answerLevel(top3: Guess[], coachPass: boolean, usedAnyway = false): AnswerLevel {
  const d = CONFIG.diagnosis;
  if (!coachPass && !usedAnyway) return "RETAKE";
  if (!top3.length || top3[0].p < d.expertBelow) return "EXPERT";
  if (top3.length > 1 && top3[0].p - top3[1].p < d.checkGapBelow) return "CHECK";
  return "CLEAR";
}

export function confidenceWord(p: number): "high" | "medium" | "low" {
  const d = CONFIG.diagnosis;
  return p >= d.highFrom ? "high" : p >= d.mediumFrom ? "medium" : "low";
}

const roundHalfEven = (v: number) => {
  const f = Math.floor(v), diff = v - f;
  if (diff > 0.5) return f + 1;
  if (diff < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
};

/** PIL-style bilinear (triangle) resampling with antialiasing, separable. Returns RGB floats 0..255. */
function resizeRGB(img: RGBAImage, outW: number, outH: number): Float32Array {
  const pass = (inLen: number, outLen: number) => {
    const scale = inLen / outLen, fs = Math.max(scale, 1), support = fs;
    const idx: number[][] = [], wts: number[][] = [];
    for (let o = 0; o < outLen; o++) {
      const center = (o + 0.5) * scale;
      const lo = Math.max(Math.trunc(center - support + 0.5), 0), hi = Math.min(Math.trunc(center + support + 0.5), inLen);
      const ii: number[] = [], ww: number[] = [];
      let sum = 0;
      for (let i = lo; i < hi; i++) {
        const t = Math.abs((i - center + 0.5) / fs), w = t < 1 ? 1 - t : 0;
        ii.push(i); ww.push(w); sum += w;
      }
      idx.push(ii); wts.push(ww.map((w) => (sum ? w / sum : 0)));
    }
    return { idx, wts };
  };
  const H = pass(img.width, outW), V = pass(img.height, outH);
  const tmp = new Float32Array(outW * img.height * 3);
  for (let y = 0; y < img.height; y++) for (let x = 0; x < outW; x++) {
    let r = 0, g = 0, b = 0;
    const ii = H.idx[x], ww = H.wts[x];
    for (let k = 0; k < ii.length; k++) {
      const p = (y * img.width + ii[k]) * 4, w = ww[k];
      r += img.data[p] * w; g += img.data[p + 1] * w; b += img.data[p + 2] * w;
    }
    const q = (y * outW + x) * 3; tmp[q] = r; tmp[q + 1] = g; tmp[q + 2] = b;
  }
  const out = new Float32Array(outW * outH * 3);
  for (let y = 0; y < outH; y++) {
    const ii = V.idx[y], ww = V.wts[y];
    for (let x = 0; x < outW; x++) {
      let r = 0, g = 0, b = 0;
      for (let k = 0; k < ii.length; k++) {
        const q = (ii[k] * outW + x) * 3, w = ww[k];
        r += tmp[q] * w; g += tmp[q + 1] * w; b += tmp[q + 2] * w;
      }
      const o = (y * outW + x) * 3; out[o] = r; out[o + 1] = g; out[o + 2] = b;
    }
  }
  return out;
}

/** Same as torchvision Resize(256) + CenterCrop(224) + ToTensor + Normalize. Returns NCHW data and the crop box. */
export function preprocess(img: RGBAImage): { data: Float32Array; cropBox: CropBox } {
  const d = CONFIG.diagnosis, S = d.inputSize;
  const short = Math.min(img.width, img.height), long = Math.max(img.width, img.height);
  const newShort = d.resizeShort, newLong = Math.trunc((newShort * long) / short);
  const rw = img.width <= img.height ? newShort : newLong, rh = img.width <= img.height ? newLong : newShort;
  const rgb = resizeRGB(img, rw, rh);
  const top = roundHalfEven((rh - S) / 2), left = roundHalfEven((rw - S) / 2);
  const data = new Float32Array(3 * S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const q = ((y + top) * rw + (x + left)) * 3, o = y * S + x;
    for (let c = 0; c < 3; c++) data[c * S * S + o] = (rgb[q + c] / 255 - d.mean[c]) / d.std[c];
  }
  const sx = img.width / rw, sy = img.height / rh;
  return { data, cropBox: { x: left * sx, y: top * sy, w: S * sx, h: S * sy } };
}

// ----------------------------------------------------------------------------- on-device (onnxruntime-web)
export interface OnDeviceModel { session: any; labels: Label[]; temperature: number; ort: any }

/** /ort/ is a copy of node_modules/onnxruntime-web/dist/*.wasm and *.mjs. The Vite dev server will not import from public/. */
export const ORT_FILES = (import.meta as any).env?.DEV ? "/node_modules/onnxruntime-web/dist/" : "/ort/";

/** ort = await import("onnxruntime-web"). Returns null if public/model/patra.onnx is not there. */
export async function loadOnDeviceModel(ort: any, base = "/model/"): Promise<OnDeviceModel | null> {
  const head = await fetch(base + "patra.onnx", { method: "HEAD" }).catch(() => null);
  if (!head || !head.ok) return null;
  ort.env.wasm.wasmPaths = ORT_FILES;
  ort.env.wasm.numThreads = 1; // no cross-origin isolation needed
  const [labels, cal] = await Promise.all([
    fetch(base + "labels.json").then((r) => r.json()),
    fetch(base + "calibration.json").then((r) => r.json()).catch(() => ({ temperature: 1 })),
  ]);
  const session = await ort.InferenceSession.create(base + "patra.onnx", { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
  return { session, labels, temperature: Number(cal.temperature) || 1, ort };
}

export async function predictOnDevice(m: OnDeviceModel, img: RGBAImage): Promise<Prediction> {
  const { data, cropBox } = preprocess(img);
  const S = CONFIG.diagnosis.inputSize;
  const out = await m.session.run({ input: new m.ort.Tensor("float32", data, [1, 3, S, S]) });
  const probs = softmax(out.logits.data as Float32Array, m.temperature);
  const [, classes, h, w] = out.cam.dims as number[];
  return { mode: "on-device", top3: topK(probs, m.labels), cam: { data: out.cam.data as Float32Array, classes, w, h }, cropBox };
}

/** Grad-CAM values (h*w) for one class index. */
export function camFor(p: Prediction, classIndex: number): Float32Array | null {
  if (!p.cam) return null;
  const n = p.cam.w * p.cam.h;
  return p.cam.data.slice(classIndex * n, (classIndex + 1) * n);
}

// ----------------------------------------------------------------------------- server
export async function predictServer(apiUrl: string, photo: Blob): Promise<Prediction> {
  const fd = new FormData(); fd.append("image", photo, "leaf.jpg");
  const r = await fetch(apiUrl.replace(/\/$/, "") + "/predict", { method: "POST", body: fd });
  if (!r.ok) throw new Error(`Server error ${r.status}`);
  const j = await r.json();
  return { mode: "server", top3: j.top3, heatmapPng: j.heatmap_png, modelVersion: j.model_version };
}

// ----------------------------------------------------------------------------- demo (bundled sample photos only)
const g = (name: string, p: number): Guess => ({ label: "Tomato___" + name.replace(/ /g, "_"), name, p });
export const DEMO_RESULTS: Record<string, Guess[]> = {
  "early-blight-closeup.jpg": [g("Early blight", 0.86), g("Target spot", 0.08), g("Septoria leaf spot", 0.03)],
  "early-blight-field.jpg": [g("Early blight", 0.67), g("Septoria leaf spot", 0.18), g("Target spot", 0.09)],
  "septoria-closeup.jpg": [g("Septoria leaf spot", 0.55), g("Early blight", 0.38), g("Bacterial spot", 0.04)],
  "septoria-field.jpg": [g("Septoria leaf spot", 0.72), g("Early blight", 0.14), g("Bacterial spot", 0.07)],
  "late-blight-field.jpg": [g("Late blight", 0.41), g("Early blight", 0.33), g("Leaf mold", 0.12)],
  "healthy-leaf.jpg": [g("Healthy", 0.91), g("Leaf mold", 0.04), g("Early blight", 0.02)],
  "early-blight-lab.jpg": [g("Early blight", 0.95), g("Target spot", 0.03), g("Septoria leaf spot", 0.01)],
};

/** Only for the bundled sample photos. Returns null for anything else: never invent a diagnosis. */
export function predictDemo(sampleFileName: string | undefined): Prediction | null {
  const top3 = sampleFileName ? DEMO_RESULTS[sampleFileName] : undefined;
  return top3 ? { mode: "demo", top3 } : null;
}
