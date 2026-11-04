// The full answer for one photo: circled problem spots, the plant check, the diagnosis and the care plan in three languages.
import { motion } from "framer-motion";
import { AlertTriangle, CalendarCheck, Droplets, FlaskConical, Leaf, ShieldAlert, ShieldCheck, Sparkles, Sprout } from "lucide-react";
import { ReactNode, useState } from "react";
import type { Detection, LeafResult } from "../lib/cloud";
import { KCC } from "../lib/guidance";
import { Chip } from "./ui";
import { Viewfinder } from "./viz";

const RED = "#E11D1D", YELLOW = "#FACC15";

/** The photo with a red circle on each diseased area and a yellow circle on each dried or damaged area. */
export function SpotCircles({ url, detections, onPick, picked }: { url: string; detections: Detection[]; onPick?: (i: number) => void; picked?: number | null }) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  return (
    <div className="relative">
      <img src={url} alt="The scanned photo, with problem areas circled" className="block w-full" onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })} />
      {size && (
        <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${size.w} ${size.h}`} aria-hidden={!onPick}>
          {detections.map((d, i) => {
            const cx = ((d.xmin + d.xmax) / 2000) * size.w, cy = ((d.ymin + d.ymax) / 2000) * size.h;
            const r = Math.max(((d.xmax - d.xmin) / 1000) * size.w, ((d.ymax - d.ymin) / 1000) * size.h) / 2 + Math.max(size.w, size.h) * 0.012;
            const stroke = d.type === "DISEASED" ? RED : YELLOW;
            const sw = Math.max(size.w, size.h) * (picked === i ? 0.009 : 0.0055);
            return (
              <motion.circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={stroke} strokeWidth={sw}
                style={{ filter: "drop-shadow(0 0 2px rgba(0,0,0,.6))", cursor: onPick ? "pointer" : undefined, pointerEvents: onPick ? "stroke" : "none" }}
                initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: 0.6, delay: 0.15 * i }}
                onClick={() => onPick?.(i)}>
                <title>{`${d.issue}: ${d.reason}`}</title>
              </motion.circle>
            );
          })}
        </svg>
      )}
    </div>
  );
}

const Section = ({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) => (
  <section className="rounded-card border border-line bg-white p-4 md:p-6">
    <h3 className="h3 flex items-center gap-2">{icon}{title}</h3>
    <div className="mt-3">{children}</div>
  </section>
);
const Bullets = ({ items }: { items: string[] }) => (
  <ul className="space-y-2">{items.map((it) => <li key={it} className="flex gap-2"><span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green" aria-hidden />{it}</li>)}</ul>
);
function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  if (!rows.length) return <p className="small">Nothing needed.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] text-left text-sm">
        <thead><tr className="border-b border-line text-muted">{head.map((h) => <th key={h} className="py-2 pr-3 font-semibold">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i} className="border-b border-line/60 last:border-0">{r.map((c, j) => <td key={j} className={`py-2 pr-3 align-top ${j === 0 ? "font-semibold text-forest" : ""}`}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

const LANGS = [{ id: "en", label: "English" }, { id: "te", label: "తెలుగు" }, { id: "hi", label: "हिन्दी" }] as const;
const SEVERITY_TONE = { None: "green", Mild: "amber", Moderate: "tomato", Severe: "tomato" } as const;

export default function LeafReport({ url, result, source }: { url: string; result: LeafResult; source: "ai-vision" | "on-device" }) {
  const [lang, setLang] = useState<(typeof LANGS)[number]["id"]>("en");
  const [picked, setPicked] = useState<number | null>(null);
  const r = result, notLeaf = !r.is_plant || r.subject === "not_plant" || r.subject === "flower";
  const diseased = r.detections.filter((d) => d.type === "DISEASED").length, dry = r.detections.length - diseased;
  const advice = r.languages[lang];

  return (
    <div className="space-y-5" aria-live="polite">
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={source === "ai-vision" ? "green" : "muted"}>{source === "ai-vision" ? <><Sparkles className="h-3.5 w-3.5" aria-hidden />Checked by AI vision</> : "Checked on this phone"}</Chip>
        {!notLeaf && <Chip tone={r.is_tomato ? "green" : "amber"}>{r.is_tomato ? "Tomato plant" : `Not tomato: ${r.plant}`}</Chip>}
      </div>

      {(notLeaf || !r.is_tomato) && (
        <div role="alert" className={`flex gap-3 rounded-card px-4 py-3 ${notLeaf ? "bg-tomato-tint text-tomato-dark" : "bg-amber-tint text-amber-dark"}`}>
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <div>
            <p className="font-heading font-bold">{notLeaf ? (r.subject === "flower" ? "This is a flower, not a tomato leaf" : r.subject === "fruit" ? "This is a fruit, not a leaf" : "No plant leaf found") : `This does not look like a tomato plant (${r.plant})`}</p>
            <p className="text-sm">{r.plant_note}</p>
          </div>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <figure>
          <Viewfinder className="overflow-hidden rounded-card bg-deep lit"><SpotCircles url={url} detections={r.detections} onPick={setPicked} picked={picked} /></Viewfinder>
          <figcaption className="mt-2 flex flex-wrap gap-3 text-sm">
            <span className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded-full border-[3px]" style={{ borderColor: RED }} aria-hidden />Disease ({diseased})</span>
            <span className="flex items-center gap-1.5"><span className="h-3.5 w-3.5 rounded-full border-[3px]" style={{ borderColor: YELLOW }} aria-hidden />Dried or damaged ({dry})</span>
            {source === "on-device" && r.detections.length > 0 && <span className="tiny w-full">Rough circles from leaf colour only. Some may be on background.</span>}
          </figcaption>
        </figure>

        <div>
          {!notLeaf && (
            <>
              <p className="tiny font-semibold uppercase tracking-wide">{r.healthy ? "Result" : "Most likely problem"}</p>
              <p className="font-heading text-2xl font-extrabold text-forest">{r.disease.name}</p>
              {r.disease.latin && <p className="small italic">{r.disease.latin}</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                <Chip tone={SEVERITY_TONE[r.disease.severity] ?? "muted"}>Severity: {r.disease.severity}</Chip>
                {r.disease.confidence > 0 && <Chip tone="muted">Confidence: {Math.round(r.disease.confidence * 100)}%</Chip>}
              </div>
              {r.disease.cause && <p className="mt-3">{r.disease.cause}</p>}
              {r.disease.symptoms_seen.length > 0 && <div className="mt-3"><p className="font-semibold text-forest">What we see</p><Bullets items={r.disease.symptoms_seen} /></div>}
              {r.disease.confirm_by && <p className="small mt-3 rounded-xl bg-surface px-3 py-2"><strong>Check to be sure:</strong> {r.disease.confirm_by}{r.disease.look_alikes && ` Could also be: ${r.disease.look_alikes}.`}</p>}
            </>
          )}
          {r.detections.length > 0 && (
            <ol className="mt-4 space-y-1.5 text-sm">
              {r.detections.map((d, i) => (
                <li key={i}>
                  <button onClick={() => setPicked(i === picked ? null : i)} className={`flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left ${picked === i ? "bg-surface" : "hover:bg-surface"}`}>
                    <span className="mt-1 h-3 w-3 shrink-0 rounded-full border-[3px]" style={{ borderColor: d.type === "DISEASED" ? RED : YELLOW }} aria-hidden />
                    <span><strong>{d.issue}</strong>: {d.reason}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {!notLeaf && (
        <>
          {r.care.do_today.length > 0 && <Section icon={<CalendarCheck className="h-5 w-5 text-green" aria-hidden />} title="Do this today"><Bullets items={r.care.do_today} /></Section>}
          {r.care.precautions.length > 0 && <Section icon={<ShieldCheck className="h-5 w-5 text-green" aria-hidden />} title="Precautions"><Bullets items={r.care.precautions} /></Section>}
          {r.care.watering.length > 0 && <Section icon={<Droplets className="h-5 w-5 text-green" aria-hidden />} title="Watering"><Bullets items={r.care.watering} /></Section>}
          <Section icon={<Sprout className="h-5 w-5 text-green" aria-hidden />} title="Fertilizer">
            <Table head={["Use", "Dose", "When"]} rows={r.care.fertilizer.map((f) => [f.product, f.dose, f.when])} />
          </Section>
          {!r.healthy && (
            <Section icon={<FlaskConical className="h-5 w-5 text-green" aria-hidden />} title="Sprays">
              <h4 className="font-heading font-bold text-forest">Chemical</h4>
              <Table head={["Product", "Dose", "Repeat"]} rows={r.care.chemical.map((c) => [c.product, c.dose, c.interval])} />
              <h4 className="mt-4 font-heading font-bold text-forest">Organic and biological</h4>
              <Table head={["Product", "Dose"]} rows={r.care.organic.map((o) => [o.product, o.dose])} />
              <div className="mt-4 flex gap-2 rounded-xl bg-amber-tint px-3 py-3 text-sm text-amber-dark" role="note">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <p>Doses are common label rates. Always follow the label of the product you buy, and confirm with your Krishi Vigyan Kendra or the Kisan Call Centre on <a className="font-semibold underline" href={`tel:${KCC.tel}`}>{KCC.number}</a>.</p>
              </div>
            </Section>
          )}
          {r.care.recovery && <p className="rounded-card bg-green-tint/60 px-4 py-3"><strong>When will it get better?</strong> {r.care.recovery}</p>}
        </>
      )}

      <Section icon={<Leaf className="h-5 w-5 text-green" aria-hidden />} title="Advice in your language">
        <div role="tablist" aria-label="Language" className="grid grid-cols-3 gap-1 rounded-xl bg-surface p-1">
          {LANGS.map((l) => (
            <button key={l.id} role="tab" aria-selected={lang === l.id} onClick={() => setLang(l.id)} className={`min-h-[44px] rounded-lg px-2 text-sm font-semibold ${lang === l.id ? "bg-white text-forest shadow-soft" : "text-muted hover:text-forest"}`}>{l.label}</button>
          ))}
        </div>
        <div className="mt-4" lang={lang}>
          <p className="font-heading text-lg font-bold text-forest">{advice.problem}</p>
          <p className="mt-1">{advice.reason}</p>
          {advice.steps.length > 0 && <ol className="mt-3 list-inside list-decimal space-y-1">{advice.steps.map((s) => <li key={s}>{s}</li>)}</ol>}
        </div>
      </Section>
    </div>
  );
}
