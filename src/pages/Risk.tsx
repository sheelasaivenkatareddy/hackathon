// Early-Warning Risk Score. Every rule is listed with its real value.
import { motion } from "framer-motion";
import { Check, CloudOff, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Card, Chip, Gauge, SampleChip, Skeleton } from "../components/ui";
import { db, useLive } from "../lib/db";
import { useI18n } from "../lib/i18n";
import type { CropStage, Level } from "../lib/risk";
import { RiskView, WEATHER_RULES, loadRisk } from "../lib/weather";

const TONE: Record<Level, "green" | "amber" | "tomato"> = { low: "green", medium: "amber", high: "tomato" };
const STAGES: CropStage[] = ["seedling", "vegetative", "flowering", "fruiting"];
const dayName = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

export default function Risk() {
  const { t } = useI18n();
  const fields = useLive(() => db.fields.toArray(), []);
  const [fieldId, setFieldId] = useState("");
  const [stage, setStage] = useState<CropStage>("vegetative");
  const [view, setView] = useState<RiskView | null>(null);
  const field = fields?.find((f) => f.id === fieldId);

  useEffect(() => { if (fields?.length && !fieldId) setFieldId(fields[0].id); }, [fields, fieldId]);
  useEffect(() => {
    if (!fields) return;
    let live = true;
    setView(null);
    loadRisk(field ?? { stage }).then((v) => { if (live) setView(v); });
    return () => { live = false; };
  }, [fields, field, stage]);

  const noWeather = view && !view.weather.json;
  const today = view?.risk.today;

  return (
    <div className="wrap py-8 md:py-12">
      <h1 className="page-title">Early-Warning Risk Score</h1>
      <div className="mt-4 flex flex-wrap gap-3">
        {!!fields?.length && (
          <label className="block min-w-[200px]"><span className="field-label">Field</span>
            <select className="field-input" value={fieldId} onChange={(e) => setFieldId(e.target.value)}>
              {fields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </label>
        )}
        {fields && !fields.length && (
          <label className="block min-w-[200px]"><span className="field-label">Crop stage</span>
            <select className="field-input capitalize" value={stage} onChange={(e) => setStage(e.target.value as CropStage)}>
              {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        )}
      </div>

      {!view && <div className="mt-6 space-y-4" role="status" aria-label="Loading risk"><Skeleton className="h-56" /><Skeleton className="h-40" /></div>}

      {view && (
        <div className="mt-6 space-y-5" aria-live="polite">
          {view.usingDefaultLocation && <p className="small rounded-xl bg-surface px-4 py-3">Using Bengaluru. Share your approximate area for local weather.</p>}
          {field && field.crop !== "Tomato" && field.crop !== "Potato" && <p role="note" className="small rounded-xl bg-amber-tint px-4 py-3 text-amber-dark">These rules were written for tomato and potato diseases. For {field.crop.toLowerCase()}, treat this score as a rough guide.</p>}
          {noWeather && <p role="alert" className="flex items-center gap-2 rounded-xl bg-amber-tint px-4 py-3 font-semibold text-amber-dark"><CloudOff className="h-5 w-5 shrink-0" aria-hidden />Weather could not be loaded. This score uses nearby reports and crop stage only.</p>}
          {view.weather.stale && view.weather.json && view.weather.fetchedAt && <p className="small rounded-xl bg-amber-tint px-4 py-3 text-amber-dark">Showing saved weather from {new Date(view.weather.fetchedAt).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}.</p>}

          <Card className="!bg-white">
            <Gauge score={view.risk.overall.score} label={t(`risk.${view.risk.overall.level}`)} />
            <p className="mt-3 text-center font-semibold text-forest" data-testid="check-every">{t("risk.checkEvery", { days: view.risk.scoutEveryDays })}</p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              {view.usedSampleReports && <SampleChip />}
            </div>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            {view.risk.groups.map((g) => {
              const rules = noWeather ? g.rules.filter((r) => !WEATHER_RULES.has(r.id)) : g.rules;
              return (
                <Card key={g.id} className="!bg-white">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="h3">{g.title}</h2>
                    <Chip tone={TONE[g.level]}>{g.score} · {t(`risk.${g.level}`)}</Chip>
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-forest">Why this score</h3>
                  <ul className="mt-2 space-y-2">
                    {rules.map((r, i) => (
                      <motion.li key={r.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 * i }} className="flex items-start gap-2 text-sm">
                        <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${r.met ? "bg-green text-white" : "bg-surface text-muted"}`}>
                          {r.met ? <Check className="h-3.5 w-3.5" aria-label="Met" /> : <X className="h-3.5 w-3.5" aria-label="Not met" />}
                        </span>
                        <span className="flex-1">{r.text}</span>
                        <span className={`shrink-0 font-semibold ${r.met ? "text-forest" : "text-muted"}`}>{r.met ? "+" : ""}{r.met ? r.points : 0}</span>
                      </motion.li>
                    ))}
                  </ul>
                </Card>
              );
            })}
          </div>

          {!noWeather && (
            <Card className="!bg-white">
              <h2 className="h3">5-day outlook</h2>
              <ul className="-mx-1 mt-3 flex gap-3 overflow-x-auto px-1 pb-1 md:grid md:grid-cols-5">
                {view.risk.days.map((d) => (
                  <li key={d.date} className={`min-w-[132px] rounded-xl p-3 ${d.date === today ? "bg-forest text-white" : "bg-surface"}`}>
                    <p className="font-semibold">{d.date === today ? "Today" : dayName(d.date)}</p>
                    <p className={`text-xs ${d.date === today ? "text-white/80" : "text-muted"}`}>{d.past ? "Past" : d.date === today ? dayName(d.date) : "Forecast"}</p>
                    <dl className="mt-2 space-y-0.5 text-sm">
                      <div>Humid hours: <strong>{d.humidHours}</strong></div>
                      <div>Min temp: <strong>{d.minTempC ?? "–"} °C</strong></div>
                      <div>Rain: <strong>{d.rainMm} mm</strong></div>
                    </dl>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <div className="space-y-1">
            <p className="font-semibold text-forest">{t("risk.estimate")}</p>
            <p className="small">Simplified rules, adjustable in settings.</p>
            <p className="tiny">Weather data by <a className="underline" href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo.com</a> (CC BY 4.0)</p>
          </div>
        </div>
      )}
    </div>
  );
}
