// "Ask" box: searches the disease library, symptom lists and fertilizer notes. It is a search, not an AI chatbot.
import { getFieldHead } from "./diagnose";
import { symptomsFor } from "./guidance";
import { fertilizerAdvice } from "./nutrition";

export interface Answer { name: string; plant: string; snippet: string; to: string; score: number }

const STOP = new Set(["the", "and", "for", "are", "with", "what", "why", "how", "does", "can", "has", "have", "this", "that", "my", "is", "it", "on", "in", "of", "to", "a", "an", "i", "me", "do", "get", "from", "plant", "plants", "leaf", "leaves"]);
const stem = (w: string) => w.replace(/(ing|es|s)$/, "");
const tokens = (q: string) => q.toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 3 && !STOP.has(w)).map(stem);

export async function askLibrary(q: string): Promise<Answer[]> {
  const words = tokens(q);
  if (!words.length) return [];
  const head = await getFieldHead();
  if (!head) return [];
  const out: Answer[] = [];
  for (const l of head.labels) {
    const symptoms = symptomsFor(l.name) ?? [];
    const advice = fertilizerAdvice(l.name, "CLEAR");
    const title = `${l.plant ?? ""} ${l.name}`.toLowerCase();
    const body = `${symptoms.join(" ")} ${advice.headline} ${advice.useThis} ${advice.why}`.toLowerCase();
    let score = 0;
    for (const w of words) { if (title.includes(w)) score += 3; else if (body.includes(w)) score += 1; }
    if (score > 0) out.push({ name: l.name, plant: l.plant ?? "", score, to: `/diseases?q=${encodeURIComponent(l.name)}`, snippet: symptoms[0] ?? advice.headline });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 3);
}
