// analyze-leaf: looks at a leaf photo with Claude vision, then saves the photo and the result to Supabase.
// POST { mode: "analyze" | "save", image_b64, media_type, device_id, profile?, location?, local? }
//  - "analyze": Claude decides what the photo shows, finds and boxes the problem spots, and writes a care plan.
//  - "save": stores a result the phone worked out itself (used when Claude is not set up or did not answer).
// Secrets: ANTHROPIC_API_KEY (optional), SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (set by Supabase).
import Anthropic from "npm:@anthropic-ai/sdk@1.4.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL = "claude-opus-5-5";
const MAX_IMAGE_B64 = 6_000_000; // about 4.5 MB of JPEG
const MAX_SCANS_PER_HOUR = 60; // per device, to keep API spend bounded

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const str = { type: "string" } as const;
const strList = { type: "array", items: str } as const;
const obj = (properties: Record<string, unknown>) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
const advice = obj({ problem: str, reason: str, steps: strList });

// Every field is required, so the page never has to guess what is missing.
const RESULT_SCHEMA = obj({
  subject: { type: "string", enum: ["leaf", "whole_plant", "flower", "fruit", "stem", "not_plant"] },
  is_plant: { type: "boolean" },
  plant: str,
  is_tomato: { type: "boolean" },
  plant_note: str,
  healthy: { type: "boolean" },
  disease: obj({
    name: str,
    latin: str,
    kind: { type: "string", enum: ["fungal", "oomycete", "bacterial", "viral", "insect_pest", "mite", "nutrient", "water_stress", "other_abiotic", "none", "unknown"] },
    severity: { type: "string", enum: ["None", "Mild", "Moderate", "Severe"] },
    confidence: { type: "number" },
    symptoms_seen: strList,
    cause: str,
    look_alikes: str,
    confirm_by: str,
  }),
  detections: {
    type: "array",
    items: obj({
      ymin: { type: "integer" }, xmin: { type: "integer" }, ymax: { type: "integer" }, xmax: { type: "integer" },
      type: { type: "string", enum: ["DISEASED", "DRY_DEHYDRATED"] },
      issue: str,
      reason: str,
    }),
  },
  care: obj({
    do_today: strList,
    precautions: strList,
    watering: strList,
    fertilizer: { type: "array", items: obj({ product: str, dose: str, when: str }) },
    chemical: { type: "array", items: obj({ product: str, dose: str, interval: str }) },
    organic: { type: "array", items: obj({ product: str, dose: str }) },
    recovery: str,
  }),
  languages: obj({ en: advice, te: advice, hi: advice }),
});

const SYSTEM = `You are an expert plant pathologist and agronomist advising small farmers in India through a phone app called Patra Lens.
You receive one photo. Work through it in this order.

1. What is in the photo? Set "subject". A flower, a fruit, a person, soil, a pot or any non-plant object must be named honestly. Set is_plant=false for anything that is not plant tissue.
2. Which plant is it? Set "plant" to the common English name (for example "Tomato", "Rose", "Chilli", "Unknown"). Set is_tomato=true only if you are confident the plant is tomato (Solanum lycopersicum). Use "plant_note" to explain in one or two plain sentences how you know, and, if it is not tomato, say clearly that it is not a tomato plant.
3. If it is plant tissue, diagnose it, whatever the plant. Give the most likely problem with its Latin name, the kind of cause, severity and your honest confidence from 0 to 1. Name the closest look-alike and one quick check the farmer can do to confirm (for example, look under the leaf for mould). If the leaf looks healthy, say so: healthy=true, severity "None", no detections. Never invent a disease you cannot see.
4. Detections: box every distinct problem area you can see, up to 12, as integers on a 0-1000 scale of the photo's height (y) and width (x). DISEASED = active infection (spots with halos, water-soaked patches, mould, rings, mosaic, curl from virus). DRY_DEHYDRATED = dead, dried, papery or scorched tissue, insect feeding holes and other non-infectious damage. "reason" names exactly what you see inside that box.
5. Care plan for this exact problem: what to do today, precautions to stop the spread, watering (method, time of day, how much, drainage), fertilizer changes (for example cut extra urea, add potash 13-0-45) with doses per litre or per plant, chemical sprays with active ingredient, formulation and dose per litre plus spray interval, organic or biological options with doses, and when the farmer should expect to see improvement. Use products registered in India. Keep every step short and practical. For a healthy plant, give upkeep advice and leave chemical empty. For a non-plant photo, leave every care list empty and set every language block to ask for a clear photo of one leaf.
6. languages: the same advice in simple English (en), Telugu (te) and Hindi (hi), each with a short problem name, why the circles were drawn, and 3-5 steps including fertilizer and spray doses.

Always remind the farmer, inside the precautions, to follow the product label and wear gloves and a mask when spraying.`;

type Body = {
  mode?: "analyze" | "save";
  image_b64?: string;
  media_type?: string;
  device_id?: string;
  profile?: { name?: string; phone?: string; village?: string };
  location?: { lat?: number; lon?: number } | null;
  local?: Record<string, unknown> | null;
};

const clean = (v: unknown, max = 120) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

async function analyze(imageB64: string, mediaType: string) {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: "medium", format: { type: "json_schema", schema: RESULT_SCHEMA } },
    system: SYSTEM,
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: mediaType as "image/jpeg", data: imageB64 } },
        { type: "text", text: "Analyse this photo and return the JSON." },
      ],
    }],
  });
  if (response.stop_reason === "refusal") throw new Error("The AI declined this photo.");
  if (response.stop_reason === "max_tokens") throw new Error("The AI answer was cut off.");
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("The AI sent no answer.");
  return JSON.parse(text.text);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  let body: Body;
  try { body = await req.json(); } catch { return json({ error: "Send JSON." }, 400); }
  const mode = body.mode === "save" ? "save" : "analyze";
  const deviceId = clean(body.device_id, 64);
  const mediaType = ["image/jpeg", "image/png", "image/webp"].includes(body.media_type ?? "") ? body.media_type! : "image/jpeg";
  if (!deviceId || !body.image_b64) return json({ error: "device_id and image_b64 are required." }, 400);
  if (body.image_b64.length > MAX_IMAGE_B64) return json({ error: "The photo is too large." }, 413);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await db.from("scans").select("id", { count: "exact", head: true }).eq("device_id", deviceId).gte("created_at", since);
  if ((count ?? 0) >= MAX_SCANS_PER_HOUR) return json({ error: "Too many scans from this phone in the last hour. Please try again later." }, 429);

  let result: Record<string, any>;
  let source: "ai-vision" | "on-device";
  if (mode === "analyze") {
    if (!Deno.env.get("ANTHROPIC_API_KEY")) return json({ error: "AI vision is not set up.", code: "no_ai" }, 503);
    try { result = await analyze(body.image_b64, mediaType); source = "ai-vision"; }
    catch (e) {
      console.error("analyze failed", e);
      return json({ error: "The AI could not check this photo.", code: "ai_failed" }, 502);
    }
  } else {
    if (!body.local || typeof body.local !== "object") return json({ error: "local result is required for save." }, 400);
    result = body.local as Record<string, any>;
    source = "on-device";
  }

  const id = crypto.randomUUID();
  const ext = mediaType === "image/png" ? "png" : mediaType === "image/webp" ? "webp" : "jpg";
  const photoPath = `${deviceId}/${id}.${ext}`;
  const bytes = Uint8Array.from(atob(body.image_b64), (c) => c.charCodeAt(0));
  const up = await db.storage.from("scan-photos").upload(photoPath, bytes, { contentType: mediaType, upsert: false });
  if (up.error) { console.error("upload failed", up.error); return json({ error: "Could not save the photo." }, 500); }

  const detections = Array.isArray(result.detections) ? result.detections : [];
  const row = {
    id,
    device_id: deviceId,
    user_name: clean(body.profile?.name),
    phone: clean(body.profile?.phone, 20),
    village: clean(body.profile?.village),
    lat: num(body.location?.lat),
    lon: num(body.location?.lon),
    photo_path: photoPath,
    source,
    is_plant: typeof result.is_plant === "boolean" ? result.is_plant : null,
    plant: clean(result.plant),
    is_tomato: typeof result.is_tomato === "boolean" ? result.is_tomato : null,
    disease: clean(result.healthy ? "Healthy" : result.disease?.name),
    severity: clean(result.disease?.severity, 20),
    confidence: num(result.disease?.confidence),
    detections,
    care_plan: result.care ?? null,
    result,
  };
  const ins = await db.from("scans").insert(row);
  if (ins.error) { console.error("insert failed", ins.error); return json({ error: "Could not save the scan." }, 500); }

  return json({ id, source, result });
});
