// Free, no-key data for the farmer's approximate area. Only the rounded 1 km area is ever sent, or Bengaluru by default.
// Every response is checked against a schema first. Results are saved, so they keep working offline.
import { CONFIG } from "../config";
import { getSetting, setSetting } from "./db";
import { cellCentre } from "./radar";
import { CurrentSchema, PlaceSchema, SoilGridsSchema, WikiSchema, parse } from "./schemas";

const HOUR = 3600 * 1000;

async function cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
  const hit = await getSetting<{ at: number; value: T } | null>(key, null);
  if (hit && Date.now() - hit.at < ttl) return hit.value;
  try {
    const value = await load();
    await setSetting(key, { at: Date.now(), value });
    return value;
  } catch (e) {
    if (hit) return hit.value; // older data beats no data
    throw e;
  }
}

async function getJson(url: string): Promise<unknown> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`The service answered ${r.status}`);
  return r.json();
}

export async function getArea(): Promise<{ lat: number; lon: number; isDefault: boolean }> {
  const cell = await getSetting<string | null>("radarCell", null);
  if (cell) { const [lat, lon] = cellCentre(cell); return { lat, lon, isDefault: false }; }
  const [lat, lon] = CONFIG.radar.defaultCentre;
  return { lat, lon, isDefault: true };
}
const key = (name: string, lat: number, lon: number) => `${name}:${lat.toFixed(2)},${lon.toFixed(2)}`;

export interface LiveWeather { tempC: number; humidity: number; rainMm: number; windKmh: number; soilMoisture: number | null; soilTempC: number | null }
export const loadLiveWeather = (lat: number, lon: number) => cached<LiveWeather>(key("now", lat, lon), HOUR / 2, async () => {
  const j = parse(CurrentSchema, await getJson(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m&hourly=soil_moisture_0_to_1cm,soil_temperature_6cm&forecast_days=1&timezone=auto`), "Live weather");
  const i = Math.max(0, j.hourly.time.findIndex((t) => t.slice(0, 13) === j.current.time.slice(0, 13)));
  return {
    tempC: j.current.temperature_2m, humidity: j.current.relative_humidity_2m, rainMm: j.current.precipitation, windKmh: j.current.wind_speed_10m,
    soilMoisture: j.hourly.soil_moisture_0_to_1cm?.[i] ?? null, soilTempC: j.hourly.soil_temperature_6cm?.[i] ?? null,
  };
});

export const loadPlace = (lat: number, lon: number) => cached<string>(key("place", lat, lon), 24 * 30 * HOUR, async () => {
  const j = parse(PlaceSchema, await getJson(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`), "The place lookup");
  return [j.city || j.locality, j.principalSubdivision].filter(Boolean).join(", ");
});

export interface SoilData { ph: number | null; nitrogenGKg: number | null; carbonGKg: number | null }
/** Only called when the farmer asks, because this free service is often down. */
export const loadSoil = (lat: number, lon: number) => cached<SoilData>(key("soil", lat, lon), 24 * 30 * HOUR, async () => {
  const j = parse(SoilGridsSchema, await getJson(`https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lon}&lat=${lat}&property=phh2o&property=nitrogen&property=soc&depth=0-5cm&value=mean`), "Soil data");
  const read = (name: string) => {
    const layer = j.properties.layers.find((l) => l.name === name);
    const v = layer?.depths[0]?.values.mean;
    return layer && typeof v === "number" ? Math.round((v / layer.unit_measure.d_factor) * 10) / 10 : null;
  };
  return { ph: read("phh2o"), nitrogenGKg: read("nitrogen"), carbonGKg: read("soc") };
});

// ------------------------------------------------------------------ Wikipedia, for the disease library
export const WIKI_TITLES: Record<string, string> = {
  "Early blight": "Alternaria_solani", "Potato: Early blight": "Alternaria_solani",
  "Late blight": "Phytophthora_infestans", "Potato: Late blight": "Phytophthora_infestans",
  "Septoria leaf spot": "Septoria_lycopersici",
  "Leaf mold": "Tomato_leaf_mold", "Tomato mosaic virus": "Tomato_mosaic_virus", "Tomato yellow leaf curl virus": "Tomato_yellow_leaf_curl_virus",
  "Apple: Apple scab": "Apple_scab", "Apple: Cedar apple rust": "Gymnosporangium_juniperi-virginianae", "Grape: Black rot": "Black_rot_(grape_disease)",
  "Corn: Gray leaf spot": "Corn_grey_leaf_spot", "Corn: Northern leaf blight": "Northern_corn_leaf_blight", "Corn: Common rust": "Puccinia_sorghi",
  "Squash: Powdery mildew": "Powdery_mildew",
};

export const loadWikiSummary = (name: string) => cached<{ text: string; url: string } | null>(`wiki:${name}`, 24 * 30 * HOUR, async () => {
  const title = WIKI_TITLES[name];
  if (!title) return null;
  const j = parse(WikiSchema, await getJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`), "The description");
  // The first two sentences describe the disease. Later ones can name chemical treatments, which Patra Chain - Blockchain-based crop disease verification system never shows.
  const text = (j.extract.match(/[^.!?]+[.!?]+(\s|$)/g) ?? []).slice(0, 2).join("").trim();
  return { text, url: j.content_urls?.desktop.page ?? `https://en.wikipedia.org/wiki/${title}` };
});
