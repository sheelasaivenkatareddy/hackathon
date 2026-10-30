// Diagnosis order: on-device model -> server -> demo values (bundled samples only) -> none. Never invents a result.
import { CONFIG } from "../config";
import { Label, Mode, ORT_FILES, OnDeviceModel, Prediction, answerLevel, camFor, loadOnDeviceModel, predictDemo, predictOnDevice, predictServer, preprocess, softmax, topK } from "./model";
import { loadPixels } from "./vision/browser";
import type { CoachResult } from "./vision/coach";
import { leafMasks } from "./vision/masks";
import { camToOverlay, maskToOverlay } from "./vision/overlay";
import type { RGBAImage } from "./vision/types";

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) || "";

let modelLoad: Promise<OnDeviceModel | null> | null = null;

// Hosts with an SPA rewrite answer 200 with index.html for a missing file, so check the content type too.
async function modelFileExists() {
  const r = await fetch("/model/patra.onnx", { method: "HEAD" }).catch(() => null);
  return !!r && r.ok && !(r.headers.get("content-type") ?? "").includes("text/html");
}

export function getOnDeviceModel(): Promise<OnDeviceModel | null> {
  if (!modelLoad) {
    modelLoad = (async () => {
      if (!(await modelFileExists())) return null;
      const ort = await import("onnxruntime-web/wasm");
      return loadOnDeviceModel(ort);
    })().catch((e) => { console.warn("On-device model did not load", e); return null; });
  }
  return modelLoad;
}

// ------------------------------------------------------------------ free field-tuned model
// DINOv2-small (rodynaemad/plant-disease-dinov2-small, CC BY-SA 4.0) gives 768 features.
// A linear head trained on PlantDoc field photos turns them into 27 plant conditions.
export const FIELD_MODEL = "/model/field-dino-int8.onnx";
export const FIELD_HEAD = "/model/field-head.json";
export const PLANTS = ["Tomato", "Apple", "Bell pepper", "Blueberry", "Cherry", "Corn", "Grape", "Peach", "Potato", "Raspberry", "Soybean", "Squash", "Strawberry"];

export interface FieldHead {
  version: string; temperature: number; labels: Label[]; weights: number[][]; bias: number[];
  metrics: { fieldTop1: number; fieldTop3: number; fieldMacroF1: number; ece: number; ci: [number, number]; n: number; baselineTop1: number; trainPhotos: number };
}
interface FieldModel { session: any; ort: any; head: FieldHead }

let headLoad: Promise<FieldHead | null> | null = null;
export function getFieldHead(): Promise<FieldHead | null> {
  if (!headLoad) {
    headLoad = fetch(FIELD_HEAD).then(async (r) => (r.ok && !(r.headers.get("content-type") ?? "").includes("text/html") ? ((await r.json()) as FieldHead) : null)).catch(() => null);
  }
  return headLoad;
}

let fieldLoad: Promise<FieldModel | null> | null = null;
export function getFieldModel(): Promise<FieldModel | null> {
  if (!fieldLoad) {
    fieldLoad = (async () => {
      const head = await getFieldHead();
      if (!head) return null;
      const ort = await import("onnxruntime-web/wasm");
      ort.env.wasm.wasmPaths = ORT_FILES;
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.proxy = true; // run in a worker, so the scanning animation keeps moving
      const session = await ort.InferenceSession.create(FIELD_MODEL, { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
      return { session, ort, head };
    })().catch((e) => { console.warn("Field model did not load", e); fieldLoad = null; return null; });
  }
  return fieldLoad;
}

async function predictField(m: FieldModel, img: RGBAImage): Promise<Prediction> {
  const { data } = preprocess(img);
  const S = CONFIG.diagnosis.inputSize;
  const out = await m.session.run({ pixel_values: new m.ort.Tensor("float32", data, [1, 3, S, S]) });
  const f = out.features.data as Float32Array;
  const logits = m.head.weights.map((w, c) => w.reduce((sum, v, i) => sum + v * f[i], m.head.bias[c]));
  return { mode: "on-device", top3: topK(softmax(logits, m.head.temperature), m.head.labels), modelVersion: m.head.version };
}

/** What the model chip says before any photo is scanned. */
export async function modelStatus(): Promise<Mode> {
  if ((await modelFileExists()) || (await getFieldHead())) return "on-device";
  return API_URL ? "server" : "demo";
}

export type Heatmap =
  | { kind: "model"; overlay: RGBAImage }
  | { kind: "model-png"; png: string }
  | { kind: "colour"; overlay: RGBAImage };

export interface Diagnosis { prediction: Prediction; level: ReturnType<typeof answerLevel>; heatmap: Heatmap | null }

export async function diagnose(photo: Blob, work: RGBAImage, coach: CoachResult, usedAnyway: boolean, sampleFile?: string): Promise<Diagnosis> {
  let prediction: Prediction | null = null;
  let heatmap: Heatmap | null = null;

  const model = await getOnDeviceModel();
  if (model) {
    try {
      const pixels = await loadPixels(photo);
      prediction = await predictOnDevice(model, pixels);
      const top = model.labels.findIndex((l) => l.label === prediction!.top3[0].label);
      const cam = camFor(prediction, top);
      if (cam && prediction.cam && prediction.cropBox) {
        heatmap = { kind: "model", overlay: camToOverlay(cam, prediction.cam.w, prediction.cam.h, prediction.cropBox, pixels.width, pixels.height) };
      }
    } catch (e) { console.warn("On-device prediction failed", e); prediction = null; }
  }
  if (!prediction) {
    const field = await getFieldModel();
    if (field) {
      try { prediction = await predictField(field, await loadPixels(photo)); }
      catch (e) { console.warn("Field model prediction failed", e); prediction = null; }
    }
  }
  if (!prediction && API_URL) {
    try {
      prediction = await predictServer(API_URL, photo);
      if (prediction.heatmapPng) heatmap = { kind: "model-png", png: prediction.heatmapPng };
    } catch (e) { console.warn("Server prediction failed", e); prediction = null; }
  }
  if (!prediction) prediction = predictDemo(sampleFile);
  if (!prediction) prediction = { mode: "none", top3: [] };
  if (!heatmap) heatmap = { kind: "colour", overlay: maskToOverlay(leafMasks(work).spot, [225, 29, 72], 0.4) };

  return { prediction, level: answerLevel(prediction.top3, coach.pass, usedAnyway), heatmap };
}
