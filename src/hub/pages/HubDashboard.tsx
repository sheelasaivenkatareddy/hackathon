// Farmer dashboard: weather and advisories, scan history, mandi prices for the farmer's crops and lab requests.
import { motion } from "framer-motion";
import { AlertTriangle, ArrowRight, Building2, CloudSun, Leaf, Mic, ScanLine, Send, ShieldCheck, Sprout, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Forecast, bestSprayWindow, loadForecast, sprayHours, weatherAlerts, weatherLabel } from "../forecast";
import { COMMODITIES, PriceRow, loadPrices, trendOf } from "../mandi";
import { districtOf, useEscalations, useHubScans, useUser } from "../store";
import { Glass, PageHead, Pill, SamplePill, Sparkline, Stat, TrendBadge, rupees } from "../ui";

const greet = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };
const ALERT_TONE = { red: "red", amber: "amber", green: "lime" } as const;
const SEV_TONE = { None: "lime", Mild: "amber", Moderate: "red", Severe: "red" } as const;

export default function HubDashboard() {
  const user = useUser()!;
  const scans = useHubScans();
  const escalations = useEscalations();
  const [wx, setWx] = useState<Forecast | null>(null);
  const [prices, setPrices] = useState<{ rows: PriceRow[]; live: boolean } | null>(null);
  const place = districtOf(user);

  useEffect(() => {
    loadForecast(place.lat, place.lon).then((r) => setWx(r.f));
    loadPrices(user.state).then(setPrices);
  }, [place.lat, place.lon, user.state]);

  const alerts: Alert[] = wx ? weatherAlerts(wx) : [];
  const spray = wx ? bestSprayWindow(sprayHours(wx)) : null;
  const issues = scans.filter((s) => s.result.is_plant && !s.result.healthy).length;
  const last = scans[0];

  // One row per crop the farmer grows: the market with the best price today.
  const myPrices = useMemo(() => {
    if (!prices) return [];
    const crops = user.crops.length ? user.crops : [...COMMODITIES];
    return crops.flatMap((c) => {
      const rows = prices.rows.filter((r) => r.commodity === c);
      return rows.length ? [rows.reduce((a, b) => (b.modal > a.modal ? b : a))] : [];
    }).slice(0, 4);
  }, [prices, user.crops]);

  return (
    <div>
      <PageHead eyebrow={`${greet()} · ${place.name}`} title={<>Namaskaram, <span className="neon-text">{user.name.split(" ")[0]}</span></>}
        sub={`${user.acres} acres · ${user.crops.join(", ") || "No crops added"} · ${user.village}`}
        right={<Link to="/hub/vani" className="hub-btn-primary"><Mic className="h-5 w-5" aria-hidden />Ask Kisan Vani</Link>} />

      {user.role === "expert" && (
        <Glass className="mb-5 flex flex-wrap items-center justify-between gap-3 !border-neon-pink/30">
          <div className="flex items-center gap-3"><ShieldCheck className="h-6 w-6 text-neon-pink" aria-hidden /><div><p className="hub-h3">Expert console</p><p className="hub-muted">Scans farmers forward to labs arrive in the admin console under "Lab requests".</p></div></div>
          <Link to="/admin" className="hub-btn-ghost">Open console<ArrowRight className="h-4 w-4" aria-hidden /></Link>
        </Glass>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat delay={0} icon={<ScanLine className="h-5 w-5" aria-hidden />} label="Leaf scans" value={scans.length} sub={last ? `Last: ${new Date(last.date).toLocaleDateString("en-IN")}` : "None yet"} />
        <Stat delay={1} tone="red" icon={<AlertTriangle className="h-5 w-5" aria-hidden />} label="Problems found" value={issues} sub={issues ? "See advisories" : "All clear"} />
        <Stat delay={2} tone="pink" icon={<Send className="h-5 w-5" aria-hidden />} label="Lab requests" value={escalations.length} sub={escalations[0] ? escalations[0].labName : "Send from a scan"} />
        <Stat delay={3} tone="lime" icon={<CloudSun className="h-5 w-5" aria-hidden />} label="Now" value={wx ? `${Math.round(wx.current.temp)}°C` : "…"} sub={wx ? `${weatherLabel(wx.current.code).label} · RH ${Math.round(wx.current.rh)}%` : "Loading weather"} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        {/* advisories */}
        <Glass delay={2} className="lg:col-span-2">
          <div className="mb-3 flex items-center justify-between"><h2 className="hub-h3">Active advisories</h2><Link to="/hub/weather" className="text-xs font-bold text-neon-cyan">Weather details →</Link></div>
          <ul className="space-y-2">
            {last && last.result.is_plant && !last.result.healthy && (
              <li className="flex gap-3 rounded-xl border border-neon-red/30 bg-neon-red/5 p-3">
                <Leaf className="mt-0.5 h-5 w-5 shrink-0 text-neon-red" aria-hidden />
                <div className="min-w-0 text-sm">
                  <p className="font-bold text-white">{last.crop}: {last.result.disease.name} <Pill tone={SEV_TONE[last.result.disease.severity]} className="ml-1">{last.result.disease.severity}</Pill></p>
                  <p className="mt-0.5 text-slate-300">{last.result.care.do_today[0] ?? last.result.languages.en.steps[0]}</p>
                </div>
              </li>
            )}
            {alerts.map((a) => (
              <li key={a.title} className={`flex gap-3 rounded-xl border p-3 ${a.level === "red" ? "border-neon-red/30 bg-neon-red/5" : a.level === "amber" ? "border-neon-amber/30 bg-neon-amber/5" : "border-neon-lime/30 bg-neon-lime/5"}`}>
                <CloudSun className={`mt-0.5 h-5 w-5 shrink-0 ${a.level === "red" ? "text-neon-red" : a.level === "amber" ? "text-neon-amber" : "text-neon-lime"}`} aria-hidden />
                <div className="text-sm"><p className="font-bold text-white">{a.title} <Pill tone={ALERT_TONE[a.level]} className="ml-1">{a.level === "green" ? "OK" : a.level === "red" ? "Warning" : "Watch"}</Pill></p><p className="mt-0.5 text-slate-300">{a.text}</p></div>
              </li>
            ))}
            {wx && (
              <li className="flex gap-3 rounded-xl border border-neon-cyan/30 bg-neon-cyan/5 p-3 text-sm">
                <Sprout className="mt-0.5 h-5 w-5 shrink-0 text-neon-cyan" aria-hidden />
                <p className="text-slate-200"><strong className="text-white">Spray window: </strong>{spray ?? "No safe spray window in the next 48 hours."}</p>
              </li>
            )}
            {!wx && <li className="hub-muted">Loading the forecast for {place.name}…</li>}
          </ul>
        </Glass>

        {/* quick actions */}
        <Glass delay={3}>
          <h2 className="hub-h3 mb-3">Quick actions</h2>
          <div className="grid grid-cols-2 gap-2">
            {[
              { to: "/hub/scan", icon: ScanLine, t: "Scan a leaf", c: "text-neon-cyan" },
              { to: "/hub/vani", icon: Mic, t: "Talk in Telugu", c: "text-neon-pink" },
              { to: "/hub/mandi", icon: TrendingUp, t: "Mandi prices", c: "text-neon-lime" },
              { to: "/hub/labs", icon: Building2, t: "Call an expert", c: "text-neon-amber" },
            ].map((q) => (
              <motion.div key={q.to} whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}>
                <Link to={q.to} className="flex h-24 flex-col justify-between rounded-xl border border-white/10 bg-white/5 p-3 text-sm font-bold text-white hover:border-neon-cyan/40">
                  <q.icon className={`h-6 w-6 ${q.c}`} aria-hidden />{q.t}
                </Link>
              </motion.div>
            ))}
          </div>
        </Glass>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {/* scan history */}
        <Glass delay={4}>
          <div className="mb-3 flex items-center justify-between"><h2 className="hub-h3">Scan history</h2><Link to="/hub/scan" className="text-xs font-bold text-neon-cyan">New scan →</Link></div>
          {!scans.length ? (
            <div className="rounded-xl border border-dashed border-white/15 p-6 text-center">
              <ScanLine className="mx-auto h-8 w-8 text-slate-500" aria-hidden />
              <p className="mt-2 font-semibold text-white">No scans yet</p>
              <p className="hub-muted">Photograph one leaf of tomato or paddy to get a diagnosis.</p>
              <Link to="/hub/scan" className="hub-btn-primary mt-4">Scan a leaf</Link>
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {scans.slice(0, 5).map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-2.5">
                  <img src={s.thumb} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover ring-1 ring-white/10" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-white">{s.result.is_plant ? (s.result.healthy ? "Healthy" : s.result.disease.name) : "Not a leaf"}</p>
                    <p className="truncate text-xs text-slate-400">{s.crop} · {new Date(s.date).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} · {s.cloudId ? "Saved to cloud" : "On phone"}</p>
                  </div>
                  {s.result.is_plant && <Pill tone={SEV_TONE[s.result.disease.severity]}>{s.result.disease.severity}</Pill>}
                </li>
              ))}
            </ul>
          )}
        </Glass>

        {/* mandi snapshot */}
        <Glass delay={5}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="hub-h3">Best prices for your crops</h2>
            <span className="flex items-center gap-2">{prices && !prices.live && <SamplePill />}<Link to="/hub/mandi" className="text-xs font-bold text-neon-cyan">All →</Link></span>
          </div>
          {!prices ? <p className="hub-muted">Loading prices…</p> : !myPrices.length ? <p className="hub-muted">No market rows for your crops in {user.state}.</p> : (
            <ul className="space-y-2">
              {myPrices.map((r) => (
                <li key={r.market + r.commodity} className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white">{r.commodity}</p>
                    <p className="truncate text-xs text-slate-400">{r.market}</p>
                  </div>
                  <Sparkline values={r.series} w={70} />
                  <div className="text-right">
                    <p className="font-heading font-extrabold text-white">{rupees(r.modal)}<span className="text-xs font-semibold text-slate-400">/q</span></p>
                    <TrendBadge t={trendOf(r.series)} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Glass>
      </div>

      {escalations.length > 0 && (
        <Glass delay={6} className="mt-5">
          <h2 className="hub-h3 mb-3">Lab requests</h2>
          <ul className="divide-y divide-white/5">
            {escalations.slice(0, 5).map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span className="text-white"><strong>{e.labName}</strong><span className="text-slate-400"> · {new Date(e.date).toLocaleDateString("en-IN")}</span></span>
                <Pill tone={e.status === "sent" ? "lime" : "amber"}>{e.status === "sent" ? "Sent to lab" : "Saved on phone"}</Pill>
              </li>
            ))}
          </ul>
        </Glass>
      )}
    </div>
  );
}
