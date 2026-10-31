// Home base for returning users: alerts, risk, recent scans, today's checks and where to get advice.
import { motion } from "framer-motion";
import { CloudRain, Flame, Droplets, ScanLine, ShieldCheck, Sprout, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AdvisoryCard from "../components/AdvisoryCard";
import { LiveConditions } from "../components/ScanInsights";
import { Button, Card, Chip, CountUp, EmptyState, Reveal, Skeleton } from "../components/ui";
import { LeafIllustration } from "../components/viz";
import { Scan, db, useBlobUrl, useLive } from "../lib/db";
import { WeatherAlert, weatherAlerts } from "../lib/alerts";
import { useI18n } from "../lib/i18n";
import type { Level } from "../lib/risk";
import { daysUntil, fmtShort, nextCheckDate, plantVisits } from "../lib/watch";
import { RiskView, loadRisk } from "../lib/weather";

const TONE: Record<Level, "green" | "amber" | "tomato"> = { low: "green", medium: "amber", high: "tomato" };
const ALERT_ICON = { heat: Flame, rain: CloudRain, humid: Droplets } as const;
const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };

function RecentScan({ scan, index }: { scan: Scan; index: number }) {
  const { disease } = useI18n();
  const url = useBlobUrl(scan.thumb);
  const top = scan.prediction.top3[0];
  return (
    <motion.li initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.07 }}>
      <Link to="/history" className="lift-card block overflow-hidden rounded-card border border-line bg-white">
        <img src={url} alt="" className="aspect-[4/3] w-full object-cover" />
        <div className="p-3">
          <p className="truncate font-semibold text-forest">{top ? disease(top.name) : "No AI answer"}</p>
          <p className="small">{fmtShort(scan.date)}{top ? ` · ${Math.round(top.p * 100)}%` : ""}</p>
        </div>
      </Link>
    </motion.li>
  );
}

export default function Dashboard() {
  const scans = useLive(async () => (await db.scans.toArray()).sort((a, b) => b.date.localeCompare(a.date)), []);
  const field = useLive(async () => (await db.fields.toArray())[0] ?? null, []);
  const due = useLive(async () => {
    const fields = await db.fields.toArray();
    let n = 0, plants = 0;
    for (const f of fields) for (const p of await db.plants.where("fieldId").equals(f.id).toArray()) {
      plants++;
      const vs = await plantVisits(p.id);
      if (daysUntil(nextCheckDate(vs[vs.length - 1]?.date, 3)) <= 0) n++;
    }
    return { due: n, plants };
  }, []);
  const [risk, setRisk] = useState<RiskView | null | "failed">(null);
  const [alerts, setAlerts] = useState<WeatherAlert[]>([]);

  useEffect(() => {
    if (field === undefined) return;
    let live = true;
    loadRisk(field).then((v) => { if (!live) return; setRisk(v); setAlerts(v.weather.json ? weatherAlerts(v.weather.json) : []); }).catch(() => { if (live) setRisk("failed"); });
    return () => { live = false; };
  }, [field]);

  const cards = risk && risk !== "failed" ? [
    { title: "Late blight", sub: "Cool and wet weather", g: risk.risk.groups[0] },
    { title: "Leaf spots", sub: "Early blight and Septoria", g: risk.risk.groups[1] },
  ] : [];

  return (
    <div className="wrap py-8 md:py-12">
      <p className="eyebrow">{greeting()}</p>
      <h1 className="page-title">Your dashboard</h1>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button to="/scan"><ScanLine className="h-5 w-5" aria-hidden />Scan a leaf</Button>
        <Button to="/watch" variant="secondary"><Sprout className="h-5 w-5" aria-hidden />Leaf Watch</Button>
        <Button to="/risk" variant="secondary">Full risk details</Button>
      </div>

      {alerts.length > 0 && (
        <ul className="mt-6 space-y-2" aria-label="Weather alerts" data-testid="weather-alerts">
          {alerts.map((a, i) => { const Icon = ALERT_ICON[a.kind]; return (
            <motion.li key={a.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }} className="flex gap-3 rounded-xl bg-amber-tint px-4 py-3 text-amber-dark">
              <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden /><p><strong>{a.title}.</strong> {a.text}</p>
            </motion.li>
          ); })}
        </ul>
      )}

      <section className="mt-8" aria-labelledby="risk-h">
        <h2 id="risk-h" className="h2 !text-[22px] md:!text-[28px]">Risk radar</h2>
        {risk === null && <div className="mt-3 grid gap-4 md:grid-cols-3"><Skeleton className="h-36" /><Skeleton className="h-36" /><Skeleton className="h-36" /></div>}
        {risk === "failed" && <p className="small mt-3" role="alert">Risk could not load right now. Check your internet and try again.</p>}
        {risk && risk !== "failed" && (
          <div className="mt-3 grid gap-4 md:grid-cols-3" data-testid="risk-cards">
            {cards.map((c, i) => (
              <Reveal key={c.title} delay={i}>
                <Card className="h-full !bg-white">
                  <p className="small font-semibold">{c.sub}</p>
                  <h3 className="h3">{c.title}</h3>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="font-heading text-4xl font-extrabold text-forest"><CountUp to={c.g.score} /></span>
                    <Chip tone={TONE[c.g.level]}>{c.g.level === "low" ? "Low risk" : c.g.level === "medium" ? "Medium risk" : "High risk"}</Chip>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface" aria-hidden><motion.div className={`h-full rounded-full ${c.g.level === "high" ? "bg-tomato" : c.g.level === "medium" ? "bg-amber" : "bg-green"}`} initial={{ width: 0 }} animate={{ width: `${c.g.score}%` }} transition={{ type: "spring", stiffness: 70, damping: 16 }} /></div>
                </Card>
              </Reveal>
            ))}
            <Reveal delay={2}>
              <Card className="h-full !bg-white">
                <p className="small font-semibold">Next 3 days</p>
                <h3 className="h3">Weather alerts</h3>
                <div className="mt-3 flex items-center gap-3">
                  {alerts.length ? <TriangleAlert className="h-8 w-8 text-amber" aria-hidden /> : <ShieldCheck className="h-8 w-8 text-green" aria-hidden />}
                  <p className="font-semibold text-forest">{alerts.length ? `${alerts.length} to read above` : "Nothing unusual in the forecast"}</p>
                </div>
                <p className="small mt-3">Check your plants every {risk.risk.scoutEveryDays} days.</p>
              </Card>
            </Reveal>
          </div>
        )}
        <p className="tiny mt-2">Estimates from weather and nearby reports, not a confirmed prediction.</p>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section aria-labelledby="scans-h">
          <div className="flex items-center justify-between gap-3"><h2 id="scans-h" className="h2 !text-[22px] md:!text-[28px]">Recent scans</h2>{!!scans?.length && <Link to="/history" className="text-sm font-semibold text-green-dark underline">See all</Link>}</div>
          {!scans && <Skeleton className="mt-3 h-40" />}
          {scans && !scans.length && <div className="mt-3"><EmptyState title="No scans yet" text="Your scans and their reports will appear here." illustration={<LeafIllustration className="h-24 w-20" title="" />}><Button to="/scan">Scan a leaf</Button></EmptyState></div>}
          {!!scans?.length && <ul className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3" data-testid="recent-scans">{scans.slice(0, 6).map((s, i) => <RecentScan key={s.id} scan={s} index={i} />)}</ul>}
        </section>
        <section aria-labelledby="plants-h">
          <h2 id="plants-h" className="h2 !text-[22px] md:!text-[28px]">Your plants</h2>
          <Card className="mt-3 !bg-white">
            {!due && <Skeleton className="h-16" />}
            {due && !due.plants && <><p>You haven't set up Leaf Watch yet.</p><Button to="/watch/new" className="mt-3">Set up a field</Button></>}
            {due && !!due.plants && (
              <div data-testid="due-card">
                <p className="font-heading text-3xl font-extrabold text-forest"><CountUp to={due.due} /> <span className="text-base font-semibold text-muted">of {due.plants} plants due for a check</span></p>
                <Button to="/watch" variant="secondary" className="mt-3">Open Leaf Watch</Button>
              </div>
            )}
          </Card>
        </section>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2"><LiveConditions /><AdvisoryCard /></div>
    </div>
  );
}
