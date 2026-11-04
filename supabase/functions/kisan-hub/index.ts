// kisan-hub: server side of Kisan Hub.
// POST { action: "mandi", state, commodities }  -> live APMC prices from Agmarknet (data.gov.in), when DATA_GOV_API_KEY is set.
// POST { action: "escalate", device_id, scan_id?, lab: { id, name }, crop?, disease?, note?, summary?, profile? }
//   -> saves a scan forwarded to a lab or RBK in the escalations table.
// Secrets: DATA_GOV_API_KEY (optional), SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (set by Supabase).
import { createClient } from "npm:@supabase/supabase-js@2";

const AGMARKNET = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070";
const MAX_ESCALATIONS_PER_HOUR = 20; // per device
const MANDI_CACHE_MS = 30 * 60_000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const clean = (v: unknown, max = 120) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// One warm instance serves many phones, so a short cache keeps data.gov.in calls low.
const mandiCache = new Map<string, { at: number; records: unknown[] }>();

async function mandi(state: string, commodities: string[]) {
  const key = Deno.env.get("DATA_GOV_API_KEY");
  if (!key) return { live: false, records: [] };
  const cacheKey = `${state}|${commodities.join(",")}`;
  const hit = mandiCache.get(cacheKey);
  if (hit && Date.now() - hit.at < MANDI_CACHE_MS) return { live: true, records: hit.records };
  const records: unknown[] = [];
  await Promise.all(commodities.slice(0, 10).map(async (c) => {
    const url = `${AGMARKNET}?api-key=${encodeURIComponent(key)}&format=json&limit=60&filters[state]=${encodeURIComponent(state)}&filters[commodity]=${encodeURIComponent(c)}`;
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) return;
      const j = await r.json();
      if (Array.isArray(j.records)) records.push(...j.records);
    } catch (e) { console.warn("agmarknet", c, e); }
  }));
  if (records.length) mandiCache.set(cacheKey, { at: Date.now(), records });
  return { live: records.length > 0, records };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  let body: Record<string, any>;
  try { body = await req.json(); } catch { return json({ error: "Send JSON." }, 400); }

  if (body.action === "mandi") {
    const state = clean(body.state, 40);
    const commodities = Array.isArray(body.commodities) ? body.commodities.map((c: unknown) => clean(c, 40)).filter(Boolean) as string[] : [];
    if (!state || !commodities.length) return json({ error: "state and commodities are required." }, 400);
    return json(await mandi(state, commodities));
  }

  if (body.action === "escalate") {
    const deviceId = clean(body.device_id, 64);
    const labId = clean(body.lab?.id, 40), labName = clean(body.lab?.name, 160);
    if (!deviceId || !labId || !labName) return json({ error: "device_id and lab are required." }, 400);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await db.from("escalations").select("id", { count: "exact", head: true }).eq("device_id", deviceId).gte("created_at", since);
    if ((count ?? 0) >= MAX_ESCALATIONS_PER_HOUR) return json({ error: "Too many requests from this phone in the last hour.", code: "limit" }, 429);
    const scanId = typeof body.scan_id === "string" && UUID.test(body.scan_id) ? body.scan_id : null;
    // Only link a scan that this phone saved itself.
    let linked: string | null = null;
    if (scanId) {
      const { data } = await db.from("scans").select("id").eq("id", scanId).eq("device_id", deviceId).maybeSingle();
      linked = data?.id ?? null;
    }
    const summary = body.summary && typeof body.summary === "object" && JSON.stringify(body.summary).length <= 8000 ? body.summary : null;
    const row = {
      device_id: deviceId, scan_id: linked, lab_id: labId, lab_name: labName,
      user_name: clean(body.profile?.name), phone: clean(body.profile?.phone, 20), village: clean(body.profile?.village, 200),
      crop: clean(body.crop, 60), disease: clean(body.disease, 160), note: clean(body.note, 1000), summary,
    };
    const { data, error } = await db.from("escalations").insert(row).select("id").single();
    if (error) { console.error("escalate failed", error); return json({ error: "Could not save the request." }, 500); }
    return json({ id: data.id });
  }

  return json({ error: "Unknown action." }, 400);
});
