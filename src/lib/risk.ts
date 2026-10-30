// Early-Warning Risk Score: transparent rules on Open-Meteo hourly weather + nearby confirmed reports.
// Fetch: https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}
//        &hourly=temperature_2m,relative_humidity_2m,precipitation&past_days=3&forecast_days=3&timezone=auto
import { CONFIG } from "../config";

export interface OpenMeteo {
  utc_offset_seconds: number;
  hourly: { time: string[]; temperature_2m: number[]; relative_humidity_2m: number[]; precipitation: number[] };
}
export type CropStage = "seedling" | "vegetative" | "flowering" | "fruiting";
export type Level = "low" | "medium" | "high";
export interface Rule { id: string; text: string; points: number; met: boolean }
export interface DiseaseRisk { id: "late_blight" | "leaf_spots"; title: string; diseases: string[]; score: number; level: Level; rules: Rule[] }
export interface DayOutlook { date: string; humidHours: number; minTempC: number | null; rainMm: number; past: boolean }
export interface RiskResult { today: string; groups: DiseaseRisk[]; overall: { score: number; level: Level; title: string }; scoutEveryDays: number; days: DayOutlook[] }

const levelOf = (s: number): Level => (s >= CONFIG.risk.levels.highFrom ? "high" : s >= CONFIG.risk.levels.mediumFrom ? "medium" : "low");
const addDays = (date: string, n: number) => new Date(Date.parse(date + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);

/** nearby = confirmed reports this week in your area, by disease name (from radar.ts nearbyThisWeek). */
export function computeRisk(w: OpenMeteo, stage: CropStage, nearby: Record<string, number>, now: Date = new Date()): RiskResult {
  const r = CONFIG.risk, h = w.hourly;
  const localNow = new Date(now.getTime() + w.utc_offset_seconds * 1000).toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"
  const today = localNow.slice(0, 10);
  // daily summaries
  const byDay = new Map<string, { humid: number; min: number; rain: number }>();
  h.time.forEach((t, i) => {
    const d = t.slice(0, 10), e = byDay.get(d) ?? { humid: 0, min: Infinity, rain: 0 };
    if (h.relative_humidity_2m[i] >= r.huttonHumidRH) e.humid++;
    if (h.temperature_2m[i] != null) e.min = Math.min(e.min, h.temperature_2m[i]);
    e.rain += h.precipitation[i] ?? 0;
    byDay.set(d, e);
  });
  const hutton = (d: string) => { const e = byDay.get(d); return !!e && e.min >= r.huttonMinTempC && e.humid >= r.huttonHumidHours; };
  const huttonPeriod = (d1: string, d2: string) => hutton(d1) && hutton(d2);
  const recentHutton = huttonPeriod(addDays(today, -2), addDays(today, -1));
  const forecastHutton = huttonPeriod(today, addDays(today, 1)) || huttonPeriod(addDays(today, 1), addDays(today, 2));

  // last 48 h warm and wet, last 72 h rain
  const nowIdx = h.time.reduce((best, t, i) => (t <= localNow ? i : best), -1);
  let warmWet = 0, rain72 = 0;
  for (let i = Math.max(0, nowIdx - 71); i <= nowIdx; i++) {
    rain72 += h.precipitation[i] ?? 0;
    if (i > nowIdx - 48 && h.relative_humidity_2m[i] >= r.warmWetRH && h.temperature_2m[i] >= r.warmWetTempMin && h.temperature_2m[i] <= r.warmWetTempMax) warmWet++;
  }
  const lb = nearby["Late blight"] ?? 0, ls = (nearby["Early blight"] ?? 0) + (nearby["Septoria leaf spot"] ?? 0);
  const late: Rule[] = [
    { id: "hutton_recent", points: r.lateBlight.huttonRecent, met: recentHutton,
      text: `Hutton period in the last 2 days (2 days in a row, minimum ≥ ${r.huttonMinTempC} °C and ≥ ${r.huttonHumidHours} h at ≥ ${r.huttonHumidRH}% humidity)` },
    { id: "hutton_forecast", points: r.lateBlight.huttonForecast, met: forecastHutton, text: "Hutton period in the next 3 days (forecast)" },
    { id: "late_nearby", points: r.lateBlight.nearbyReports, met: lb >= r.nearbyMinReports, text: `${lb} confirmed late blight report${lb === 1 ? "" : "s"} nearby this week (needs ${r.nearbyMinReports})` },
  ];
  const spots: Rule[] = [
    { id: "warm_wet", points: r.leafSpot.warmWetHours, met: warmWet >= r.warmWetMinHours,
      text: `${warmWet} hours in the last 48 h with humidity ≥ ${r.warmWetRH}% and ${r.warmWetTempMin}–${r.warmWetTempMax} °C (needs ${r.warmWetMinHours})` },
    { id: "rain", points: r.leafSpot.rain, met: rain72 >= r.rainMm3Days, text: `${rain72.toFixed(1)} mm rain in the last 3 days (needs ${r.rainMm3Days} mm; rain splash spreads spores)` },
    { id: "stage", points: r.leafSpot.cropStage, met: stage === "flowering" || stage === "fruiting", text: `Crop stage: ${stage} (flowering or fruiting adds risk)` },
    { id: "spots_nearby", points: r.leafSpot.nearbyReports, met: ls >= r.nearbyMinReports, text: `${ls} confirmed early blight or Septoria report${ls === 1 ? "" : "s"} nearby this week (needs ${r.nearbyMinReports})` },
  ];
  const score = (rules: Rule[]) => Math.min(100, rules.reduce((s, x) => s + (x.met ? x.points : 0), 0));
  const groups: DiseaseRisk[] = [
    { id: "late_blight", title: "Late blight (cool and wet)", diseases: ["Late blight"], score: score(late), level: levelOf(score(late)), rules: late },
    { id: "leaf_spots", title: "Early blight and Septoria leaf spot (warm and wet)", diseases: ["Early blight", "Septoria leaf spot"], score: score(spots), level: levelOf(score(spots)), rules: spots },
  ];
  const top = groups.reduce((a, b) => (b.score > a.score ? b : a));
  const days: DayOutlook[] = [-2, -1, 0, 1, 2].map((k) => {
    const d = addDays(today, k), e = byDay.get(d);
    return { date: d, humidHours: e?.humid ?? 0, minTempC: e && isFinite(e.min) ? Math.round(e.min * 10) / 10 : null, rainMm: Math.round((e?.rain ?? 0) * 10) / 10, past: k < 0 };
  });
  return { today, groups, overall: { score: top.score, level: top.level, title: top.title }, scoutEveryDays: r.scoutEveryDays[top.level], days };
}
