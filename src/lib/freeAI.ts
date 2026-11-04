// Free AI chat for when the Claude key is not set: Pollinations (open models, no key).
// Limit on the free tier: about 1 reply every 45 seconds per internet connection, and replies take 5-20 s.
// When it is busy or limited, the caller falls back to the app's own answers.
// The farmer's question, recent chat and a summary of their last scan are sent; nothing else.
// Replace with the Claude ask-agent function in production by adding ANTHROPIC_API_KEY.
import type { ChatMsg } from "./agent";
import type { LeafResult } from "./cloud";

const URL_ = "https://text.pollinations.ai/openai";
const LANG_NAME: Record<string, string> = { en: "English", te: "Telugu", hi: "Hindi", ta: "Tamil", kn: "Kannada", ml: "Malayalam" };

const SYSTEM = (lang: string, voice: boolean) => `You are Kisan Vani, a friendly crop doctor and agronomist for small farmers in India, inside the Patra Lens app.
Always reply in ${LANG_NAME[lang] ?? "English"}, in that language's own script, even if the question mixes languages or uses English words.
${voice ? "Your reply is read aloud: 2 to 5 short spoken sentences, no markdown, no lists, no symbols. Say doses in simple words." : "Keep it short and practical: one line answer, then at most 5 short steps."}
If the farmer asks about "this", "the photo", "my leaf", "the disease" or precautions, answer from THEIR LAST SCAN below: name the problem, how serious it is, and the exact precautions, sprays with doses, organic options, watering and fertilizer from that scan. Do not talk about anything else.
For sprays give the active ingredient and dose per litre, and remind them to follow the label and wear gloves and a mask.
If you are not sure, say so and suggest the Kisan Call Centre, 1800-180-1551 (free).
Never invent prices or government scheme amounts. For anything unrelated to farming, answer briefly and correctly.`;

/** The scan details the AI needs to answer questions about the photo. */
export function scanContext(s: LeafResult | null | undefined, crop?: string): string {
  if (!s) return "The farmer has not scanned a leaf yet.";
  if (!s.is_plant) return "The last photo did not show a plant leaf.";
  return `THEIR LAST SCAN: crop ${crop ?? s.plant}; ${s.healthy ? "healthy leaf" : `problem: ${s.disease.name}${s.disease.latin ? ` (${s.disease.latin})` : ""}`}; severity ${s.disease.severity}; confidence ${Math.round(s.disease.confidence * 100)}%; ${s.detections.length} affected areas.
Do today: ${s.care.do_today.join("; ") || "none"}.
Precautions: ${s.care.precautions.join("; ") || "none"}.
Watering: ${s.care.watering.join("; ") || "none"}.
Fertilizer: ${s.care.fertilizer.map((f) => `${f.product} ${f.dose} ${f.when}`).join("; ") || "none"}.
Sprays: ${s.care.chemical.map((c) => `${c.product} ${c.dose} ${c.interval}`).join("; ") || "none"}.
Organic: ${s.care.organic.map((o) => `${o.product} ${o.dose}`).join("; ") || "none"}.
Recovery: ${s.care.recovery || "not given"}.`;
}

export async function askFreeAI(messages: ChatMsg[], lang: string, voice: boolean, context: string): Promise<string | null> {
  try {
    const r = await fetch(URL_, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        model: "openai",
        messages: [{ role: "system", content: `${SYSTEM(lang, voice)}\n\n${context}` }, ...messages.slice(-10).map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }))],
      }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const text = String(j?.choices?.[0]?.message?.content ?? "").trim();
    return text || null;
  } catch {
    return null;
  }
}
