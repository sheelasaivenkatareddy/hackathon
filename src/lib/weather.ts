// Open-Meteo weather (cached for 1 hour) + risk scoring for a field or the default location.
import { CONFIG } from "../config";
import { Field, db, getSetting, setSetting } from "./db";
import { Report, cellCentre, cellId, nearbyThisWeek } from "./radar";
import { CropStage, OpenMeteo, RiskResult, computeRisk } from "./risk";
import { ForecastSchema, parse } from "./schemas";

const HOUR = 3600 * 1000;
interface CachedWeather { at: number; json: OpenMeteo }

export interface WeatherResult { json: OpenMeteo | null; fetchedAt: number | null; stale: boolean }

export async function loadWeather(lat: number, lon: number): Promise<WeatherResult> {
  const key = `weather:${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = await getSetting<CachedWeather | null>(key, null);
  if (cached && Date.now() - cached.at < HOUR) return { json: cached.json, fetchedAt: cached.at, stale: false };
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relative_humidity_2m,precipitation&past_days=3&forecast_days=3&timezone=auto`;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Weather error ${r.status}`);
    const json = parse(ForecastSchema, await r.json(), "The forecast") as OpenMeteo;
    const at = Date.now();
    await setSetting(key, { at, json });
    return { json, fetchedAt: at, stale: false };
  } catch (e) {
    console.warn("Weather did not load", e);
    return cached ? { json: cached.json, fetchedAt: cached.at, stale: true } : { json: null, fetchedAt: null, stale: true };
  }
}

/** Sample reports (shown with a chip) + the user's own confirmed reports, in the kit's Report shape. */
export async function loadReports(includeSample: boolean): Promise<Report[]> {
  const mine = (await db.reports.toArray()).map((r): Report => ({ id: r.id, cell: r.cell, disease: r.disease, confirmed: r.confirmed, date: r.date }));
  if (!includeSample) return mine;
  const sample = await fetch("/data/sample-reports.json").then((r) => r.json()).catch(() => ({ reports: [] }));
  return [...mine, ...(sample.reports as Report[])];
}

const EMPTY_WEATHER: OpenMeteo = { utc_offset_seconds: 0, hourly: { time: [], temperature_2m: [], relative_humidity_2m: [], precipitation: [] } };
export const WEATHER_RULES = new Set(["hutton_recent", "hutton_forecast", "warm_wet", "rain"]);

export interface RiskView {
  risk: RiskResult; weather: WeatherResult; cell: string; centre: [number, number];
  usingDefaultLocation: boolean; usedSampleReports: boolean; stage: CropStage;
}

export async function loadRisk(field?: Pick<Field, "cellId" | "stage"> | null): Promise<RiskView> {
  const usingDefaultLocation = !field?.cellId;
  const centre = field?.cellId ? cellCentre(field.cellId) : CONFIG.radar.defaultCentre;
  const cell = field?.cellId ?? cellId(centre[0], centre[1]);
  const stage = field?.stage ?? "vegetative";
  const showSample = await getSetting("radarShowSample", false);
  const [weather, withSample, mine] = await Promise.all([loadWeather(centre[0], centre[1]), loadReports(showSample), loadReports(false)]);
  const nearby = nearbyThisWeek(withSample, cell);
  const nearbyMine = nearbyThisWeek(mine, cell);
  const usedSampleReports = Object.keys(nearby).some((d) => nearby[d] !== (nearbyMine[d] ?? 0));
  const risk = computeRisk(weather.json ?? EMPTY_WEATHER, stage, nearby);
  return { risk, weather, cell, centre, usingDefaultLocation, usedSampleReports, stage };
}

/** How often to check, for scheduling. With no risk data yet: 3 days. */
export async function scoutEveryDays(field?: Field | null): Promise<number> {
  try { return (await loadRisk(field)).risk.scoutEveryDays; } catch { return 3; }
}
