// Weather alerts from the same Open-Meteo forecast the risk score uses. Thresholds live in config.ts.
import { CONFIG } from "../config";
import type { OpenMeteo } from "./risk";

export type AlertKind = "heat" | "rain" | "humid";
export interface WeatherAlert { id: string; kind: AlertKind; title: string; text: string; date: string }

const dayName = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

/** Today and the next two days. Hours with a missing reading are skipped. */
export function weatherAlerts(w: OpenMeteo, now: Date = new Date()): WeatherAlert[] {
  const a = CONFIG.alerts;
  const today = new Date(now.getTime() + w.utc_offset_seconds * 1000).toISOString().slice(0, 10);
  const last = new Date(Date.parse(today + "T00:00:00Z") + 2 * 86400000).toISOString().slice(0, 10);
  const days = new Map<string, { max: number; rain: number; humid: number }>();
  w.hourly.time.forEach((t, i) => {
    const d = t.slice(0, 10);
    if (d < today || d > last) return;
    const e = days.get(d) ?? { max: -Infinity, rain: 0, humid: 0 };
    const temp = w.hourly.temperature_2m[i], rh = w.hourly.relative_humidity_2m[i], mm = w.hourly.precipitation[i];
    if (temp != null) e.max = Math.max(e.max, temp);
    if (mm != null) e.rain += mm;
    if (rh != null && rh >= a.humidRH) e.humid++;
    days.set(d, e);
  });
  const out: WeatherAlert[] = [];
  for (const [d, e] of [...days.entries()].sort()) {
    const label = d === today ? "today" : dayName(d);
    if (e.max >= a.heatC) out.push({ id: `heat-${d}`, kind: "heat", date: d, title: "Very hot", text: `It may reach ${Math.round(e.max)} °C ${label}. Water early in the morning, so plants are not stressed.` });
    if (e.rain >= a.rainMmDay) out.push({ id: `rain-${d}`, kind: "rain", date: d, title: "Heavy rain", text: `About ${Math.round(e.rain)} mm of rain is forecast ${label}. Check that water can drain away, and look for leaf diseases afterwards.` });
    if (e.humid >= a.humidHoursDay) out.push({ id: `humid-${d}`, kind: "humid", date: d, title: "Long humid spell", text: `${e.humid} hours of very humid air are forecast ${label}. Leaf diseases spread faster in these conditions. Check your plants.` });
  }
  return out;
}
