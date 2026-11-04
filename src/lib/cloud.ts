// Supabase: sends each scan to the analyze-leaf function (Claude vision + storage) and signs the admin in.
// Without VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY the app works as before, on the device only.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSetting, setSetting, uid } from "./db";

const URL_ = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || "";
const KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || "";
export const cloudConfigured = !!(URL_ && KEY);
export const supabase: SupabaseClient | null = cloudConfigured ? createClient(URL_, KEY) : null;

// ------------------------------------------------------------------ the AI result (same shape the edge function returns)
export type DetectionType = "DISEASED" | "DRY_DEHYDRATED";
export interface Detection { ymin: number; xmin: number; ymax: number; xmax: number; type: DetectionType; issue: string; reason: string }
export interface Advice { problem: string; reason: string; steps: string[] }
export interface LeafResult {
  subject: "leaf" | "whole_plant" | "flower" | "fruit" | "stem" | "not_plant";
  is_plant: boolean;
  plant: string;
  is_tomato: boolean;
  plant_note: string;
  healthy: boolean;
  disease: { name: string; latin: string; kind: string; severity: "None" | "Mild" | "Moderate" | "Severe"; confidence: number; symptoms_seen: string[]; cause: string; look_alikes: string; confirm_by: string };
  detections: Detection[];
  care: {
    do_today: string[]; precautions: string[]; watering: string[];
    fertilizer: { product: string; dose: string; when: string }[];
    chemical: { product: string; dose: string; interval: string }[];
    organic: { product: string; dose: string }[];
    recovery: string;
  };
  languages: { en: Advice; te: Advice; hi: Advice };
}

export interface Profile { name: string; phone: string; village: string }
export const getProfile = () => getSetting<Profile>("profile", { name: "", phone: "", village: "" });
export const saveProfile = (p: Profile) => setSetting("profile", p);

async function deviceId(): Promise<string> {
  let id = await getSetting<string>("deviceId", "");
  if (!id) { id = uid(); await setSetting("deviceId", id); }
  return id;
}

const toBase64 = (b: Blob) => new Promise<string>((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(",")[1] ?? "");
  r.onerror = () => rej(r.error);
  r.readAsDataURL(b);
});

export type CloudOutcome =
  | { ok: true; id: string; source: "ai-vision" | "on-device"; result: LeafResult }
  | { ok: false; code: "off" | "no_ai" | "ai_failed" | "limit" | "network" | "error"; message: string };

export interface Place { lat: number; lon: number }

async function call(mode: "analyze" | "save", photo: Blob, local?: unknown, location?: Place | null): Promise<CloudOutcome> {
  if (!supabase) return { ok: false, code: "off", message: "Cloud is not set up." };
  const [image_b64, device_id, profile] = await Promise.all([toBase64(photo), deviceId(), getProfile()]);
  const { data, error } = await supabase.functions.invoke("analyze-leaf", {
    body: { mode, image_b64, media_type: photo.type || "image/jpeg", device_id, profile, local, location },
  });
  if (error) {
    let body: { code?: string; error?: string } = {};
    try { body = await (error as { context?: Response }).context?.json(); } catch { /* not JSON */ }
    const status = (error as { context?: Response }).context?.status;
    const code = body.code === "no_ai" || body.code === "ai_failed" ? body.code : status === 429 ? "limit" : status ? "error" : "network";
    return { ok: false, code, message: body.error ?? error.message };
  }
  return { ok: true, id: data.id, source: data.source, result: data.result as LeafResult };
}

/** Claude vision looks at the photo; the photo and answer are saved for the admin. */
export const analyzeInCloud = (photo: Blob, location?: Place | null) => call("analyze", photo, undefined, location);
/** Saves a result worked out on the phone, so the admin still sees the scan. */
export const saveToCloud = (photo: Blob, local: LeafResult, location?: Place | null) => call("save", photo, local, location);

/** Forwards a scan to a lab, KVK, RBK/RSK or officer (kisan-hub function, escalations table). */
export async function escalateInCloud(e: { scanId?: string; lab: { id: string; name: string }; crop?: string; disease?: string; note?: string; summary?: unknown }): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: "Cloud is not set up." };
  const [device_id, profile] = await Promise.all([deviceId(), getProfile()]);
  const { data, error } = await supabase.functions.invoke("kisan-hub", {
    body: { action: "escalate", device_id, scan_id: e.scanId, lab: e.lab, crop: e.crop, disease: e.disease, note: e.note, summary: e.summary, profile },
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, id: data.id };
}

export interface CloudEscalation {
  id: string; created_at: string; scan_id: string | null; user_name: string | null; phone: string | null; village: string | null;
  lab_id: string; lab_name: string; crop: string | null; disease: string | null; note: string | null;
  status: "new" | "in_review" | "resolved"; lab_reply: string | null;
}

// ------------------------------------------------------------------ admin
export interface CloudScan {
  id: string; created_at: string; device_id: string; user_name: string | null; phone: string | null; village: string | null;
  lat: number | null; lon: number | null; photo_path: string; source: "ai-vision" | "on-device";
  is_plant: boolean | null; plant: string | null; is_tomato: boolean | null; disease: string | null; severity: string | null;
  confidence: number | null; detections: Detection[]; care_plan: LeafResult["care"] | null; result: LeafResult;
  feedback: "right" | "wrong" | null; admin_note: string | null;
}

export const isAdminSession = (s: { user?: { app_metadata?: Record<string, unknown> } } | null) => s?.user?.app_metadata?.role === "admin";
