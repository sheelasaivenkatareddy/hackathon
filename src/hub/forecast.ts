// 7-day forecast from Open-Meteo (free, no key) and the spray advisory worked out from it.
// Spray rules: wind under 15 km/h, rain chance under 40% now and for the next 3 hours, 10-35 °C, daylight only.

export interface Forecast {
  at: number; lat: number; lon: number;
  current: { temp: number; rh: number; wind: number; code: number; rain: number };
  hourly: { time: string[]; temp: number[]; rh: number[]; pop: number[]; rain: number[]; wind: number[] };
  daily: { time: string[]; code: number[]; tmax: number[]; tmin: number[]; rain: number[]; pop: number[] };
}

const TTL = 30 * 60_000;

export async function loadForecast(lat: number, lon: number): Promise<{ f: Forecast | null; stale: boolean }> {
  const key = `hub:wx:${lat.toFixed(2)},${lon.toFixed(2)}`;
  let cached: Forecast | null = null;
  try { cached = JSON.parse(localStorage.getItem(key) ?? "null"); } catch { /* blocked */ }
  if (cached && Date.now() - cached.at < TTL) return { f: cached, stale: false };
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
    + "&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,precipitation"
    + "&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,wind_speed_10m"
    + "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max"
    + "&forecast_days=7&timezone=auto";
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    const f: Forecast = {
      at: Date.now(), lat, lon,
      current: { temp: j.current.temperature_2m, rh: j.current.relative_humidity_2m, wind: j.current.wind_speed_10m, code: j.current.weather_code, rain: j.current.precipitation },
      hourly: { time: j.hourly.time, temp: j.hourly.temperature_2m, rh: j.hourly.relative_humidity_2m, pop: j.hourly.precipitation_probability.map((v: number | null) => v ?? 0), rain: j.hourly.precipitation, wind: j.hourly.wind_speed_10m },
      daily: { time: j.daily.time, code: j.daily.weather_code, tmax: j.daily.temperature_2m_max, tmin: j.daily.temperature_2m_min, rain: j.daily.precipitation_sum, pop: j.daily.precipitation_probability_max.map((v: number | null) => v ?? 0) },
    };
    try { localStorage.setItem(key, JSON.stringify(f)); } catch { /* full */ }
    return { f, stale: false };
  } catch {
    return { f: cached, stale: true };
  }
}

export function weatherLabel(code: number): { label: string; emoji: string } {
  if (code === 0) return { label: "Clear sky", emoji: "☀️" };
  if (code <= 2) return { label: "Partly cloudy", emoji: "⛅" };
  if (code === 3) return { label: "Cloudy", emoji: "☁️" };
  if (code === 45 || code === 48) return { label: "Fog", emoji: "🌫️" };
  if (code >= 51 && code <= 57) return { label: "Drizzle", emoji: "🌦️" };
  if (code >= 61 && code <= 67) return { label: "Rain", emoji: "🌧️" };
  if (code >= 80 && code <= 82) return { label: "Showers", emoji: "🌦️" };
  if (code >= 95) return { label: "Thunderstorm", emoji: "⛈️" };
  return { label: "Mixed", emoji: "🌤️" };
}

/** Index of the current hour in the hourly arrays (they are in the place's local time). */
function nowIndex(f: Forecast) {
  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T${String(now.getHours()).padStart(2, "0")}:00`;
  const i = f.hourly.time.indexOf(stamp);
  return i >= 0 ? i : 0;
}

export interface SprayHour { time: string; ok: boolean; why: string }
export function sprayHours(f: Forecast, hours = 48): SprayHour[] {
  const start = nowIndex(f), out: SprayHour[] = [];
  for (let i = start; i < Math.min(f.hourly.time.length, start + hours); i++) {
    const h = Number(f.hourly.time[i].slice(11, 13));
    const nextPop = Math.max(...f.hourly.pop.slice(i, i + 4));
    let why = "";
    if (h < 6 || h > 18) why = "Dark";
    else if (f.hourly.wind[i] >= 15) why = `Wind ${Math.round(f.hourly.wind[i])} km/h`;
    else if (nextPop >= 40 || f.hourly.rain[i] > 0.2) why = `Rain chance ${Math.round(nextPop)}%`;
    else if (f.hourly.temp[i] > 35) why = `Too hot (${Math.round(f.hourly.temp[i])}°C)`;
    else if (f.hourly.temp[i] < 10) why = "Too cold";
    out.push({ time: f.hourly.time[i], ok: !why, why: why || "Good to spray" });
  }
  return out;
}

const hourText = (t: string) => {
  const h = Number(t.slice(11, 13));
  return `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`;
};
const dayText = (t: string) => {
  const n = new Date(), today = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  const d = t.slice(0, 10);
  if (d === today) return "Today";
  return new Date(`${d}T12:00`).toLocaleDateString("en-IN", { weekday: "short" });
};

/** The first good spray window of at least 2 hours, like "Today 7 AM – 10 AM". */
export function bestSprayWindow(hours: SprayHour[]): string | null {
  for (let i = 0; i < hours.length; i++) {
    if (!hours[i].ok) continue;
    let j = i;
    while (j + 1 < hours.length && hours[j + 1].ok && hours[j + 1].time.slice(0, 10) === hours[i].time.slice(0, 10)) j++;
    if (j - i >= 1) {
      const endH = Number(hours[j].time.slice(11, 13)) + 1;
      return `${dayText(hours[i].time)} ${hourText(hours[i].time)} – ${hourText(`${hours[j].time.slice(0, 11)}${String(endH).padStart(2, "0")}`)}`;
    }
    i = j;
  }
  return null;
}

export interface Alert { level: "red" | "amber" | "green"; title: string; text: string }
export function weatherAlerts(f: Forecast): Alert[] {
  const s = nowIndex(f), next = (arr: number[], n: number) => arr.slice(s, s + n);
  const rain24 = next(f.hourly.rain, 24).reduce((a, b) => a + b, 0);
  const wetHours = next(f.hourly.rh, 48).filter((v, k) => v >= 90 && f.hourly.temp[s + k] >= 10 && f.hourly.temp[s + k] <= 30).length;
  const tmax = Math.max(...next(f.hourly.temp, 24)), wind = Math.max(...next(f.hourly.wind, 24));
  const out: Alert[] = [];
  if (rain24 >= 10) out.push({ level: "red", title: `Heavy rain: ${Math.round(rain24)} mm in 24 h`, text: "Hold fertilizer and sprays, they will wash off. Open field drains so water does not stand around roots." });
  else if (rain24 >= 2) out.push({ level: "amber", title: `Light rain: ${rain24.toFixed(1)} mm in 24 h`, text: "Spray only in the dry window below. Skip irrigation if the soil is already moist." });
  if (wetHours >= 6) out.push({ level: "amber", title: `Humid for ${wetHours} hours`, text: "Leaf wetness favours late blight (tomato) and blast (paddy). Scout leaves tomorrow morning and keep a protective spray ready." });
  if (tmax >= 38) out.push({ level: "red", title: `Heat: up to ${Math.round(tmax)}°C`, text: "Irrigate early morning or evening, mulch the soil, and do not spray in the afternoon." });
  if (wind >= 25) out.push({ level: "amber", title: `Strong wind: ${Math.round(wind)} km/h`, text: "Spray drift is likely. Stake tall plants such as tomato." });
  if (!out.length) out.push({ level: "green", title: "Good farming weather", text: "No rain, heat or humidity warnings for the next day." });
  return out;
}

export function next24(f: Forecast) {
  const s = nowIndex(f);
  return {
    rainMm: Math.round(f.hourly.rain.slice(s, s + 24).reduce((a, b) => a + b, 0) * 10) / 10,
    rh: Math.round(f.current.rh),
    tmax: Math.round(Math.max(...f.hourly.temp.slice(s, s + 24))),
  };
}
