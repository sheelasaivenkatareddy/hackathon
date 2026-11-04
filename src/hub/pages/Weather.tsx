// Local weather with microclimate spray advisories: alerts for rain, humidity (disease), heat and wind,
// a 48-hour spray timeline and the 7-day forecast. Open-Meteo, no key.
import { motion } from "framer-motion";
import { CloudRain, Crosshair, Droplets, MapPin, Sprout, Thermometer, Volume2, Wind } from "lucide-react";
import { useEffect, useState } from "react";
import { Forecast, bestSprayWindow, loadForecast, next24, sprayHours, weatherAlerts, weatherLabel } from "../forecast";
import { districtOf, useHubLang, useUser } from "../store";
import { Glass, PageHead, Pill, Stat } from "../ui";
import { speak, weatherSentence } from "../voice";

export default function Weather() {
  const user = useUser()!;
  const lang = useHubLang();
  const home = districtOf(user);
  const [place, setPlace] = useState({ lat: home.lat, lon: home.lon, name: `${home.name} (district centre)` });
  const [wx, setWx] = useState<{ f: Forecast | null; stale: boolean } | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => { setWx(null); loadForecast(place.lat, place.lon).then(setWx); }, [place.lat, place.lon]);

  const useGps = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => { setLocating(false); setPlace({ lat: Math.round(p.coords.latitude * 100) / 100, lon: Math.round(p.coords.longitude * 100) / 100, name: "Your location (about 1 km)" }); },
      () => setLocating(false), { timeout: 8000 },
    );
  };

  const f = wx?.f;
  const hours = f ? sprayHours(f) : [];
  const best = bestSprayWindow(hours);
  const alerts = f ? weatherAlerts(f) : [];
  const now = f ? weatherLabel(f.current.code) : null;

  return (
    <div>
      <PageHead eyebrow="Microclimate advisory" title={<>Weather & <span className="neon-text">spray planner</span></>}
        sub="Rain, humidity and wind decide when a spray works and when disease spreads."
        right={<div className="flex flex-wrap gap-2">
          <button onClick={useGps} className="hub-btn-ghost !min-h-[40px]"><Crosshair className={`h-4 w-4 ${locating ? "animate-spin" : ""}`} aria-hidden />Use my location</button>
          {f && <button onClick={() => speak(weatherSentence(lang, { ...next24(f), sprayOk: best }), lang)} className="hub-btn-primary !min-h-[40px]"><Volume2 className="h-4 w-4" aria-hidden />Speak alert</button>}
        </div>} />

      <p className="mb-4 flex items-center gap-1.5 text-sm text-slate-400"><MapPin className="h-4 w-4 text-neon-cyan" aria-hidden />{place.name} · {place.lat.toFixed(2)}, {place.lon.toFixed(2)}{wx?.stale && f ? " · offline copy" : ""}</p>

      {!wx ? <Glass><p className="hub-muted">Loading the forecast…</p></Glass> : !f ? <Glass><p className="text-neon-red">The forecast could not load. Check the internet connection and try again.</p></Glass> : (
        <>
          <div className="grid gap-5 lg:grid-cols-3">
            <Glass className="relative overflow-hidden">
              <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-neon-cyan/20 blur-3xl" />
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Right now</p>
              <p className="mt-1 font-heading text-6xl font-extrabold text-white">{Math.round(f.current.temp)}°<span className="text-2xl text-slate-400">C</span></p>
              <p className="font-semibold text-neon-cyan">{now!.emoji} {now!.label}</p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-xl bg-white/5 p-2"><Droplets className="mx-auto h-4 w-4 text-neon-cyan" aria-hidden /><p className="mt-1 font-bold text-white">{Math.round(f.current.rh)}%</p><p className="text-slate-400">Humidity</p></div>
                <div className="rounded-xl bg-white/5 p-2"><Wind className="mx-auto h-4 w-4 text-neon-teal" aria-hidden /><p className="mt-1 font-bold text-white">{Math.round(f.current.wind)}</p><p className="text-slate-400">km/h</p></div>
                <div className="rounded-xl bg-white/5 p-2"><CloudRain className="mx-auto h-4 w-4 text-neon-pink" aria-hidden /><p className="mt-1 font-bold text-white">{next24(f).rainMm}</p><p className="text-slate-400">mm / 24 h</p></div>
              </div>
            </Glass>

            <Glass className="lg:col-span-2">
              <h2 className="hub-h3 mb-3">Alerts</h2>
              <ul className="space-y-2">
                {alerts.map((a) => (
                  <li key={a.title} className={`rounded-xl border p-3 ${a.level === "red" ? "border-neon-red/40 bg-neon-red/5" : a.level === "amber" ? "border-neon-amber/40 bg-neon-amber/5" : "border-neon-lime/40 bg-neon-lime/5"}`}>
                    <p className="flex items-center gap-2 font-bold text-white">{a.title}<Pill tone={a.level === "red" ? "red" : a.level === "amber" ? "amber" : "lime"}>{a.level === "red" ? "Warning" : a.level === "amber" ? "Watch" : "OK"}</Pill></p>
                    <p className="mt-0.5 text-sm text-slate-300">{a.text}</p>
                  </li>
                ))}
              </ul>
            </Glass>
          </div>

          <Glass className="mt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="hub-h3 flex items-center gap-2"><Sprout className="h-5 w-5 text-neon-lime" aria-hidden />Spray timeline, next 48 hours</h2>
              <Pill tone={best ? "lime" : "red"}>{best ? `Best: ${best}` : "No safe window"}</Pill>
            </div>
            <div className="mt-4 flex h-16 items-end gap-[2px]" role="img" aria-label={best ? `Best spray window ${best}` : "No safe spray window in the next 48 hours"}>
              {hours.map((h, i) => (
                <motion.div key={h.time} title={`${h.time.slice(5, 10)} ${h.time.slice(11, 16)}: ${h.why}`} initial={{ height: 0 }} animate={{ height: h.why === "Dark" ? "30%" : "100%" }} transition={{ delay: i * 0.01 }}
                  className={`flex-1 rounded-sm ${h.ok ? "bg-neon-lime shadow-[0_0_8px_rgba(163,230,53,0.6)]" : h.why === "Dark" ? "bg-white/10" : "bg-neon-red/70"}`} />
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-slate-500"><span>Now</span><span>+24 h</span><span>+48 h</span></div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-neon-lime" />Good to spray</span>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-neon-red/70" />Rain, wind or heat</span>
              <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-white/10" />Night</span>
            </div>
            <p className="mt-3 text-xs text-slate-500">Rule: wind under 15 km/h, rain chance under 40% for the next 3 hours, 10–35 °C, daylight. Spray early morning or late afternoon when bees are less active.</p>
          </Glass>

          <h2 className="hub-h3 mb-3 mt-6">7-day forecast</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {f.daily.time.map((d, i) => {
              const w = weatherLabel(f.daily.code[i]);
              return (
                <Glass key={d} delay={i} className="!p-3 text-center">
                  <p className="text-xs font-bold uppercase text-slate-400">{i === 0 ? "Today" : new Date(`${d}T12:00`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric" })}</p>
                  <p className="my-1 text-3xl" aria-hidden>{w.emoji}</p>
                  <p className="text-xs text-slate-300">{w.label}</p>
                  <p className="mt-1 font-bold text-white">{Math.round(f.daily.tmax[i])}° <span className="text-slate-500">{Math.round(f.daily.tmin[i])}°</span></p>
                  <p className={`mt-1 text-xs font-semibold ${f.daily.pop[i] >= 60 ? "text-neon-pink" : "text-slate-400"}`}>💧 {f.daily.pop[i]}% · {f.daily.rain[i].toFixed(1)} mm</p>
                </Glass>
              );
            })}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat icon={<Thermometer className="h-5 w-5" aria-hidden />} label="Max next 24 h" value={`${next24(f).tmax}°C`} />
            <Stat tone="pink" icon={<CloudRain className="h-5 w-5" aria-hidden />} label="Rain 7 days" value={`${Math.round(f.daily.rain.reduce((a, b) => a + b, 0))} mm`} />
            <Stat tone="lime" icon={<Sprout className="h-5 w-5" aria-hidden />} label="Spray hours" value={hours.filter((h) => h.ok).length} sub="in the next 48 h" />
            <Stat tone="amber" icon={<Droplets className="h-5 w-5" aria-hidden />} label="Humid hours" value={f.hourly.rh.slice(0, 48).filter((v) => v >= 90).length} sub="RH ≥ 90%, disease risk" />
          </div>
          <p className="mt-3 text-xs text-slate-500">Forecast: Open-Meteo. Only the rounded location is sent.</p>
        </>
      )}
    </div>
  );
}
