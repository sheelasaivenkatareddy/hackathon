// Under a result: a symptom checklist that tests the answer, and treatment options in three tabs.
import { AnimatePresence, motion } from "framer-motion";
import { Check, ExternalLink, FlaskConical, Leaf, ShieldAlert, Sprout } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { KCC, symptomsFor, treatmentFor } from "../lib/guidance";
import type { AnswerLevel } from "../lib/model";
import { InfoTip } from "./ui";

export function SymptomChecklist({ name, level }: { name?: string; level: AnswerLevel }) {
  const items = useMemo(() => (level === "RETAKE" ? undefined : symptomsFor(name)), [name, level]);
  const [ticked, setTicked] = useState<Set<number>>(new Set());
  useEffect(() => setTicked(new Set()), [name]);
  if (!items || !name) return null;
  const healthy = name.endsWith("Healthy");
  const n = ticked.size, total = items.length;
  const verdict = n === 0 ? "Tick what you can see on the leaf." : n >= Math.ceil(total * 0.75) ? (healthy ? "This fits a healthy leaf." : "Most signs match. This supports the answer.") : n <= 1 ? (healthy ? "Few of these fit. Look closer for problems." : "Few signs match. Treat this answer with care, and ask an expert.") : "Some signs match. Look closer at the leaf.";
  return (
    <section className="rounded-card border border-line bg-white p-4 md:p-6" data-testid="symptom-checklist">
      <h3 className="h3 flex items-center gap-2"><Leaf className="h-5 w-5 text-green" aria-hidden />Does this match your leaf?<InfoTip text="Look at the leaf next to this list. If few signs match, the AI may be wrong." /></h3>
      <ul className="mt-3 space-y-2">
        {items.map((s, i) => {
          const on = ticked.has(i);
          return (
            <li key={s}>
              <label className={`flex min-h-[48px] cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors ${on ? "border-green bg-green-tint" : "border-line hover:border-green/50"}`}>
                <input type="checkbox" className="peer sr-only" checked={on} onChange={() => setTicked((t) => { const c = new Set(t); if (c.has(i)) c.delete(i); else c.add(i); return c; })} />
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 border-line bg-white peer-checked:border-green peer-checked:bg-green peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-lime" aria-hidden>
                  <AnimatePresence>{on && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Check className="h-4 w-4 text-white" /></motion.span>}</AnimatePresence>
                </span>
                <span>{s}</span>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="mt-3" aria-live="polite">
        <div className="h-2.5 overflow-hidden rounded-full bg-surface" aria-hidden><motion.div className="h-full rounded-full bg-green" animate={{ width: `${(n / total) * 100}%` }} transition={{ type: "spring", stiffness: 120, damping: 18 }} /></div>
        <p className="mt-2 font-semibold text-forest" data-testid="symptom-verdict">{n > 0 && `${n} of ${total} match. `}{verdict}</p>
      </div>
      <p className="tiny mt-2">These are general descriptions. A real leaf can look different.</p>
    </section>
  );
}

const TABS = [
  { id: "cultural", label: "Cultural", icon: Sprout },
  { id: "organic", label: "Organic", icon: Leaf },
  { id: "chemical", label: "Chemical", icon: FlaskConical },
] as const;

export function TreatmentCard({ name, level }: { name?: string; level: AnswerLevel }) {
  const t = useMemo(() => treatmentFor(name, level), [name, level]);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("cultural");
  useEffect(() => setTab("cultural"), [name]);
  if (!t) return null;
  const block = t[tab];
  return (
    <section className="rounded-card border border-line bg-white p-4 md:p-6" data-testid="treatment-card">
      <h3 className="h3">What can you do?</h3>
      <div role="tablist" aria-label="Treatment options" className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-surface p-1">
        {TABS.map((x) => (
          <button key={x.id} role="tab" id={`tab-${x.id}`} aria-selected={tab === x.id} aria-controls="treatment-panel" onClick={() => setTab(x.id)} className={`relative flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-semibold ${tab === x.id ? "text-forest" : "text-muted hover:text-forest"}`}>
            {tab === x.id && <motion.span layoutId="treatment-pill" className="absolute inset-0 rounded-lg bg-white shadow-soft" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
            <span className="relative flex items-center gap-1.5"><x.icon className="h-4 w-4" aria-hidden />{x.label}</span>
          </button>
        ))}
      </div>
      <div role="tabpanel" id="treatment-panel" aria-labelledby={`tab-${tab}`} className="mt-4">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
            <h4 className="font-heading font-bold text-forest">{block.title}</h4>
            <ul className="mt-2 space-y-2">
              {block.items.map((it) => <li key={it} className="flex gap-2"><span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green" aria-hidden />{it}</li>)}
            </ul>
            {block.note && <p className="small mt-3 rounded-xl bg-surface px-3 py-2">{block.note}</p>}
            {block.source && <a href={block.source.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-[32px] items-center gap-1 text-sm font-semibold text-green-dark underline underline-offset-2">Source: {block.source.name}<ExternalLink className="h-3.5 w-3.5" aria-hidden /></a>}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="mt-4 flex gap-2 rounded-xl bg-amber-tint px-3 py-3 text-sm text-amber-dark" role="note">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>This is general guidance, not a prescription. Check with your Krishi Vigyan Kendra or call the Kisan Call Centre on <a className="font-semibold underline" href={`tel:${KCC.tel}`}>{KCC.number}</a> before you act.</p>
      </div>
    </section>
  );
}
