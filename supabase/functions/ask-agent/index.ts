// ask-agent: the Patra Lens farm assistant in the side panel. Answers crop questions with Claude and logs them for the admin.
// POST { device_id, messages: [{ role: "user" | "assistant", content }], scan?: object, lang?: "en" | "te" | "hi", profile? }
// Secrets: ANTHROPIC_API_KEY, SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (set by Supabase).
import Anthropic from "npm:@anthropic-ai/sdk@1.4.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = "claude-opus-5-5";
const MAX_TURNS = 20; // older turns are dropped
const MAX_CHARS = 4000; // per message
const MAX_QUESTIONS_PER_HOUR = 40; // per device

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const LANG_NAME = { en: "English", te: "Telugu", hi: "Hindi", kn: "Kannada" } as const;

const SYSTEM = `You are Patra Lens Assistant, a friendly crop doctor and agronomist inside the Patra Lens app, helping small farmers in India.

What you help with: plant diseases and pests, what a scan result means, fertilizer (urea, DAP, potash, NPK grades, micronutrients) with doses, watering and drainage, sprays (active ingredient, formulation, dose per litre, interval, waiting period before harvest), organic and biological options, weather risk, and when to call an expert. Tomato first, but any crop.

How you answer:
- Short and practical: a one-line answer first, then at most 5 short steps. Use plain words a farmer understands; explain any technical word.
- Give doses per litre of water or per plant/acre when you recommend a product. Use products registered in India. Always add: follow the product label, wear gloves and a mask.
- If the farmer shares a scan result, use it, but say so if the scan looks unsure.
- If you are not sure what the problem is, say so and tell them what to check or to scan a clear photo of one leaf.
- For serious or spreading problems, suggest the Kisan Call Centre (1800-180-1551, free, 6 AM to 10 PM) or their Krishi Vigyan Kendra.
- Politely decline topics that have nothing to do with farming, gardening, plants or this app, and steer back to crops.
- Never invent prices, government schemes or numbers you do not know.
- Reply in the language the farmer writes in. If unsure, use the preferred language given below.`;

type Msg = { role: "user" | "assistant"; content: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  let body: { device_id?: string; messages?: Msg[]; scan?: unknown; lang?: string; profile?: { name?: string } };
  try { body = await req.json(); } catch { return json({ error: "Send JSON." }, 400); }
  const deviceId = typeof body.device_id === "string" ? body.device_id.slice(0, 64) : "";
  const messages = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!deviceId || !messages.length || messages[messages.length - 1].role !== "user") return json({ error: "device_id and a user message are required." }, 400);
  if (!Deno.env.get("ANTHROPIC_API_KEY")) return json({ error: "The assistant is not set up.", code: "no_ai" }, 503);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await db.from("agent_chats").select("id", { count: "exact", head: true }).eq("device_id", deviceId).gte("created_at", since);
  if ((count ?? 0) >= MAX_QUESTIONS_PER_HOUR) return json({ error: "Too many questions from this phone in the last hour. Please try again later.", code: "limit" }, 429);

  const lang = LANG_NAME[(body.lang ?? "en") as keyof typeof LANG_NAME] ?? "English";
  // The farmer's context goes after the cached instructions, so the stable prefix still caches.
  const context = [`Preferred language: ${lang}.`, body.scan ? `The farmer's latest scan result (JSON): ${JSON.stringify(body.scan).slice(0, 6000)}` : "No scan shared."].join("\n");

  let answer = "";
  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: "low" },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }, { type: "text", text: context }],
      messages,
    });
    if (response.stop_reason === "refusal") answer = "Sorry, I can't help with that. Ask me about your crop, a disease, fertilizer or watering.";
    else answer = response.content.filter((b) => b.type === "text").map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    if (!answer) throw new Error("empty answer");
  } catch (e) {
    console.error("assistant failed", e);
    return json({ error: "The assistant could not answer right now.", code: "ai_failed" }, 502);
  }

  const question = messages[messages.length - 1].content;
  const log = await db.from("agent_chats").insert({ device_id: deviceId, user_name: body.profile?.name?.slice(0, 120) || null, lang: body.lang ?? "en", question, answer });
  if (log.error) console.error("log failed", log.error);

  return json({ answer });
});
