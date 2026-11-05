// Mandi (APMC) prices. Live rows come from Agmarknet on data.gov.in through the kisan-hub function, when its
// DATA_GOV_API_KEY secret is set. Otherwise the page shows SAMPLE prices, clearly labelled, so the demo still works.
import { supabase } from "../lib/cloud";
import type { StateId } from "./store";

export const COMMODITIES = ["Paddy", "Tomato", "Cotton", "Dry Chilli", "Onion", "Maize", "Groundnut", "Turmeric"] as const;
export type Commodity = (typeof COMMODITIES)[number];

/** Minimum Support Price, kharif 2025-26, ₹ per quintal (Government of India, CACP). Crops without an MSP are left out. */
export const MSP: Partial<Record<Commodity, { price: number; note: string }>> = {
  Paddy: { price: 2369, note: "Common paddy, KMS 2025-26 (Grade A ₹2,389)" },
  Cotton: { price: 7710, note: "Medium staple, 2025-26 (long staple ₹8,110)" },
  Maize: { price: 2400, note: "2025-26" },
  Groundnut: { price: 7263, note: "2025-26" },
};
export const MSP_SOURCE = "https://cacp.dacnet.nic.in/";

export interface PriceRow {
  state: StateId; district: string; market: string; commodity: Commodity; variety: string;
  min: number; max: number; modal: number; date: string; series: number[]; // series: modal price, oldest first (sample data only)
}

// Real APMC markets known for each crop. Sample prices are generated for these.
const MARKETS: Record<StateId, { district: string; market: string; crops: Commodity[] }[]> = {
  AP: [
    { district: "Guntur", market: "Guntur", crops: ["Dry Chilli", "Cotton", "Maize"] },
    { district: "Annamayya", market: "Madanapalle", crops: ["Tomato"] },
    { district: "Kurnool", market: "Kurnool", crops: ["Onion", "Groundnut", "Paddy", "Cotton"] },
    { district: "Kurnool", market: "Pattikonda", crops: ["Tomato"] },
    { district: "Kurnool", market: "Adoni", crops: ["Cotton", "Groundnut"] },
    { district: "Guntur", market: "Duggirala", crops: ["Turmeric"] },
    { district: "West Godavari", market: "Tadepalligudem", crops: ["Paddy"] },
  ],
  TS: [
    { district: "Warangal", market: "Warangal (Enumamula)", crops: ["Cotton", "Dry Chilli", "Maize"] },
    { district: "Khammam", market: "Khammam", crops: ["Dry Chilli", "Cotton"] },
    { district: "Nizamabad", market: "Nizamabad", crops: ["Turmeric", "Paddy", "Maize"] },
    { district: "Hyderabad", market: "Bowenpally", crops: ["Tomato", "Onion"] },
    { district: "Suryapet", market: "Suryapet", crops: ["Paddy"] },
  ],
  KA: [
    { district: "Kolar", market: "Kolar", crops: ["Tomato"] },
    { district: "Bengaluru", market: "Bengaluru (Yeshwanthpur)", crops: ["Onion", "Tomato"] },
    { district: "Haveri", market: "Byadgi", crops: ["Dry Chilli"] },
    { district: "Raichur", market: "Raichur", crops: ["Paddy", "Cotton", "Groundnut"] },
    { district: "Dharwad", market: "Hubballi", crops: ["Onion", "Groundnut", "Cotton", "Maize"] },
    { district: "Davanagere", market: "Davanagere", crops: ["Maize"] },
  ],
};

const BASE: Record<Commodity, { price: number; vol: number; variety: string }> = {
  Paddy: { price: 2350, vol: 0.012, variety: "Common / BPT" },
  Tomato: { price: 1800, vol: 0.11, variety: "Local / Hybrid" },
  Cotton: { price: 7300, vol: 0.015, variety: "Medium staple" },
  "Dry Chilli": { price: 14500, vol: 0.03, variety: "Teja / Byadgi" },
  Onion: { price: 2200, vol: 0.06, variety: "Red" },
  Maize: { price: 2150, vol: 0.015, variety: "Yellow" },
  Groundnut: { price: 6200, vol: 0.02, variety: "Bold" },
  Turmeric: { price: 13000, vol: 0.025, variety: "Finger" },
};

// Deterministic random numbers, so the sample prices are the same all day for every viewer.
function rand(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100000) / 100000;
}
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export function samplePrices(state: StateId): PriceRow[] {
  const today = new Date(), rows: PriceRow[] = [];
  for (const m of MARKETS[state]) {
    for (const c of m.crops) {
      const b = BASE[c];
      const level = b.price * (0.9 + rand(`${m.market}|${c}`) * 0.2); // each market sits a little above or below
      const series: number[] = [];
      let p = level;
      for (let k = 13; k >= 0; k--) {
        const d = new Date(today.getTime() - k * 86400_000);
        p = p * (1 + (rand(`${m.market}|${c}|${dayKey(d)}`) - 0.5) * 2 * b.vol);
        p = p * 0.85 + level * 0.15; // drift back towards the market level
        series.push(Math.round(p / 10) * 10);
      }
      const modal = series[series.length - 1];
      rows.push({
        state, district: m.district, market: m.market, commodity: c, variety: b.variety,
        min: Math.round((modal * (0.86 + rand(`${m.market}${c}min`) * 0.06)) / 10) * 10,
        max: Math.round((modal * (1.05 + rand(`${m.market}${c}max`) * 0.07)) / 10) * 10,
        modal, date: dayKey(today), series: series.slice(-7),
      });
    }
  }
  return rows;
}

export type Trend = { kind: "bull" | "bear" | "flat"; pct: number };
export function trendOf(series: number[]): Trend {
  if (series.length < 2) return { kind: "flat", pct: 0 };
  const last = series[series.length - 1];
  const before = series.slice(0, -1).reduce((a, b) => a + b, 0) / (series.length - 1);
  const pct = ((last - before) / before) * 100;
  return { kind: pct > 3 ? "bull" : pct < -3 ? "bear" : "flat", pct: Math.round(pct * 10) / 10 };
}

// ------------------------------------------------------------------ live prices
const STATE_NAME: Record<StateId, string> = { AP: "Andhra Pradesh", TS: "Telangana", KA: "Karnataka" };
const AGMARK_NAME: Record<Commodity, string> = { Paddy: "Paddy(Dhan)(Common)", Tomato: "Tomato", Cotton: "Cotton", "Dry Chilli": "Dry Chillies", Onion: "Onion", Maize: "Maize", Groundnut: "Groundnut", Turmeric: "Turmeric" };

/** Live prices from Agmarknet. Keeps yesterday's modal price on the phone so a trend can be shown. */
async function livePrices(state: StateId): Promise<PriceRow[] | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.functions.invoke("kisan-hub", { body: { action: "mandi", state: STATE_NAME[state], commodities: COMMODITIES.map((c) => AGMARK_NAME[c]) } });
  if (error || !data?.live || !Array.isArray(data.records) || !data.records.length) return null;
  const byName = Object.fromEntries(Object.entries(AGMARK_NAME).map(([k, v]) => [v.toLowerCase(), k as Commodity]));
  let memory: Record<string, number[]> = {};
  try { memory = JSON.parse(localStorage.getItem("hub:mandi-memory") ?? "{}"); } catch { /* blocked */ }
  const rows = (data.records as Record<string, string>[]).flatMap((r): PriceRow[] => {
    const commodity = byName[String(r.commodity).toLowerCase()];
    if (!commodity) return [];
    const modal = Number(r.modal_price), key = `${r.market}|${commodity}`;
    const seen = memory[key] ?? [];
    if (seen[seen.length - 1] !== modal) memory[key] = [...seen, modal].slice(-7);
    return [{ state, district: r.district, market: r.market, commodity, variety: r.variety, min: Number(r.min_price), max: Number(r.max_price), modal, date: r.arrival_date, series: memory[key] }];
  });
  try { localStorage.setItem("hub:mandi-memory", JSON.stringify(memory)); } catch { /* full */ }
  return rows.length ? rows : null;
}

const lastKey = (state: StateId) => `hub:mandi-last:${state}`;

/** Live rows when online; otherwise the last live rows saved on this phone; otherwise labelled sample prices. */
export async function loadPrices(state: StateId): Promise<{ rows: PriceRow[]; live: boolean; cachedAt?: number }> {
  try {
    const live = await livePrices(state);
    if (live) {
      try { localStorage.setItem(lastKey(state), JSON.stringify({ at: Date.now(), rows: live })); } catch { /* storage full */ }
      return { rows: live, live: true };
    }
  } catch { /* offline or the service is down: use what is saved */ }
  try {
    const saved = JSON.parse(localStorage.getItem(lastKey(state)) ?? "null") as { at: number; rows: PriceRow[] } | null;
    if (saved?.rows?.length) return { rows: saved.rows, live: false, cachedAt: saved.at };
  } catch { /* blocked */ }
  return { rows: samplePrices(state), live: false };
}
