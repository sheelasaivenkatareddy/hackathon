// The side-panel assistant: sends the chat to the ask-agent function (Claude), and shares the latest scan with it.
// Without the cloud it falls back to searching the disease library on the phone.
import { useEffect, useState } from "react";
import { askLibrary } from "./ask";
import { type LeafResult, getProfile, supabase } from "./cloud";
import { getSetting, setSetting, uid } from "./db";
import { KCC } from "./guidance";

export interface ChatMsg { role: "user" | "assistant"; content: string }

// ------------------------------------------------------------------ the latest scan, so the assistant can talk about it
let latestScan: LeafResult | null = null;
const listeners = new Set<(s: LeafResult | null) => void>();
export function shareScanWithAgent(s: LeafResult | null) { latestScan = s; listeners.forEach((l) => l(s)); }
export function useLatestScan() {
  const [s, setS] = useState(latestScan);
  useEffect(() => { listeners.add(setS); return () => { listeners.delete(setS); }; }, []);
  return s;
}

async function deviceId(): Promise<string> {
  let id = await getSetting<string>("deviceId", "");
  if (!id) { id = uid(); await setSetting("deviceId", id); }
  return id;
}

/** A short summary of a scan, small enough to send with every question. */
function scanSummary(s: LeafResult) {
  return {
    subject: s.subject, plant: s.plant, is_tomato: s.is_tomato, healthy: s.healthy,
    disease: s.disease.name, latin: s.disease.latin, severity: s.disease.severity, confidence: s.disease.confidence,
    spots: s.detections.map((d) => `${d.type}: ${d.issue}`).slice(0, 8),
    care: { do_today: s.care.do_today, chemical: s.care.chemical, fertilizer: s.care.fertilizer, watering: s.care.watering },
  };
}

export type AgentReply = { ok: true; answer: string; offline?: boolean } | { ok: false; message: string };

async function offlineAnswer(question: string): Promise<string> {
  const hits = await askLibrary(question);
  const lines = hits.map((h) => `- **${h.plant && !h.name.includes(":") ? `${h.plant}: ` : ""}${h.name}**: ${h.snippet}`);
  return [
    hits.length ? "Here is what the disease library says:" : "I could not find that in the disease library on this phone.",
    ...lines,
    "",
    `For more help, call the Kisan Call Centre on **${KCC.number}** (free, ${KCC.hours}).`,
  ].join("\n");
}

export async function askAgent(messages: ChatMsg[], lang: string, withScan: boolean): Promise<AgentReply> {
  const question = messages[messages.length - 1]?.content ?? "";
  if (!supabase) return { ok: true, answer: await offlineAnswer(question), offline: true };
  const [device_id, profile] = await Promise.all([deviceId(), getProfile()]);
  const { data, error } = await supabase.functions.invoke("ask-agent", {
    body: { device_id, messages, lang, profile: { name: profile.name }, scan: withScan && latestScan ? scanSummary(latestScan) : undefined },
  });
  if (error) {
    let code = "";
    try { code = (await (error as { context?: Response }).context?.json())?.code ?? ""; } catch { /* not JSON */ }
    if (code === "no_ai" || !(error as { context?: Response }).context) return { ok: true, answer: await offlineAnswer(question), offline: true };
    if (code === "limit") return { ok: false, message: "Too many questions in the last hour. Please try again later." };
    return { ok: false, message: "The assistant could not answer right now. Please try again." };
  }
  return { ok: true, answer: String(data.answer ?? "") };
}
