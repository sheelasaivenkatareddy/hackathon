// The action plan after a diagnosis: use this, approximately how much, and when to expect a change.
import { AnimatePresence, motion } from "framer-motion";
import { CalendarClock, Check, ExternalLink, Scale, Sprout, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import type { AnswerLevel, Guess } from "../lib/model";
import { AREA_UNITS, CROP_DOSES, doseFor, fertilizerAdvice, outlookFor, plantOf } from "../lib/nutrition";
import { CountUp } from "./ui";

const list = { hidden: {}, show: { transition: { staggerChildren: 0.14, delayChildren: 0.4 } } };
const item = { hidden: { opacity: 0, x: -10 }, show: { opacity: 1, x: 0 } };
const SOURCE = "inline-flex min-h-[32px] items-center gap-1 text-sm font-semibold text-green-dark underline underline-offset-2";

function DoseCalculator({ plant }: { plant?: string }) {
  const [crop, setCrop] = useState(CROP_DOSES.some((d) => d.crop === plant) ? plant! : "");
  const [size, setSize] = useState("1");
  const [unit, setUnit] = useState<(typeof AREA_UNITS)[number]["id"]>("acre");
  const dose = CROP_DOSES.find((d) => d.crop === crop);
  const area = Number(size);
  const valid = Number.isFinite(area) && area > 0;
  const hectares = valid ? area * AREA_UNITS.find((u) => u.id === unit)!.hectares : 0;
  const rows = useMemo(() => (dose && valid ? doseFor(dose, hectares) : []), [dose, valid, hectares]);
  return (
    <section className="rounded-2xl border border-line bg-white p-4 md:p-5" data-testid="dose-calculator">
      <h4 className="flex items-center gap-2 font-heading font-bold text-forest"><Scale className="h-5 w-5 text-green" aria-hidden />How much? Approximate amounts for your field</h4>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label><span className="field-label">Crop</span>
          <select className="field-input" value={crop} onChange={(e) => setCrop(e.target.value)} data-testid="dose-crop">
            <option value="">{plant && !CROP_DOSES.some((d) => d.crop === plant) ? plant : "Choose a crop"}</option>
            {CROP_DOSES.map((d) => <option key={d.crop} value={d.crop}>{d.label}</option>)}
          </select>
        </label>
        <label><span className="field-label">Field size</span>
          <input className="field-input" type="number" inputMode="decimal" min="0" step="any" value={size} onChange={(e) => setSize(e.target.value)} data-testid="dose-size" />
        </label>
        <label><span className="field-label">Unit</span>
          <select className="field-input" value={unit} onChange={(e) => setUnit(e.target.value as typeof unit)} data-testid="dose-unit">
            {AREA_UNITS.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
          </select>
        </label>
      </div>
      {!dose && <p className="small mt-3" data-testid="dose-none">We have checked amounts for tomato, potato and corn only. For {plant && !CROP_DOSES.some((d) => d.crop === plant) ? plant.toLowerCase() : "other crops"}, ask your KVK.</p>}
      {dose && !valid && <p className="small mt-3">Enter your field size to see the amounts.</p>}
      {dose && valid && (
        <>
          <ul className="mt-3 grid gap-3 sm:grid-cols-3" data-testid="dose-rows">
            {rows.map((r) => (
              <li key={r.product} className="rounded-xl bg-green-tint/60 p-3">
                <div className="font-heading text-2xl font-extrabold text-forest"><CountUp key={r.kg} to={r.kg} decimals={r.kg < 5 ? 1 : 0} /> <span className="text-base">kg</span></div>
                <div className="text-sm text-ink">{r.product}</div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm"><strong className="text-forest">When:</strong> {dose.timing}</p>
          <p className="small mt-2">Approximate total for the whole crop, for a normal season. This is not an extra dose for the disease. Skip what you have already given. Tamil Nadu recommendation, so a soil test or your KVK gives better numbers for your land.</p>
          <a href={dose.source.url} target="_blank" rel="noreferrer" className={SOURCE}>Source: {dose.source.name}<ExternalLink className="h-3.5 w-3.5" aria-hidden /></a>
        </>
      )}
    </section>
  );
}

export default function FertilizerCard({ top, level }: { top?: Guess; level: AnswerLevel }) {
  const a = fertilizerAdvice(top?.name, level);
  const o = outlookFor(top?.name, level);
  return (
    <motion.section data-testid="fertilizer-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.4 }} className="space-y-4 rounded-card border border-amber/40 bg-amber-tint/40 p-4 md:p-6">
      <h3 className="h3">Your action plan</h3>

      <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.35, type: "spring", stiffness: 180, damping: 18 }} className="rounded-2xl bg-forest p-4 text-white md:p-5" data-testid="use-this">
        <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-lime"><Sprout className="h-4 w-4" aria-hidden />Use this</p>
        <p className="mt-1 font-heading text-xl font-extrabold md:text-2xl">{a.useThis}</p>
        <p className="mt-1 text-white/85">{a.headline}</p>
      </motion.div>
      {!a.specific && level !== "CLEAR" && <p className="small">The answer is not certain yet, so this is general soil care, not advice for one disease.</p>}

      <motion.div variants={list} initial="hidden" animate="show" className="grid gap-4 md:grid-cols-2">
        <div>
          <h4 className="text-sm font-semibold text-forest">Consider</h4>
          <ul className="mt-1 space-y-1.5">
            {a.consider.map((c) => <motion.li key={c} variants={item} className="flex gap-2"><Check className="mt-1 h-4 w-4 shrink-0 text-green" aria-hidden />{c}</motion.li>)}
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-forest">Avoid</h4>
          <ul className="mt-1 space-y-1.5">
            {a.avoid.map((c) => <motion.li key={c} variants={item} className="flex gap-2"><TriangleAlert className="mt-1 h-4 w-4 shrink-0 text-tomato" aria-hidden />{c}</motion.li>)}
          </ul>
        </div>
      </motion.div>
      <div>
        <p className="text-sm">{a.why}</p>
        {a.source && <a href={a.source.url} target="_blank" rel="noreferrer" className={`${SOURCE} mt-1`}>Source: {a.source.name}<ExternalLink className="h-3.5 w-3.5" aria-hidden /></a>}
      </div>

      <DoseCalculator plant={plantOf(top)} />

      <section className="rounded-2xl border border-line bg-white p-4 md:p-5" data-testid="outlook">
        <h4 className="flex items-center gap-2 font-heading font-bold text-forest"><CalendarClock className="h-5 w-5 text-green" aria-hidden />When will it go away?</h4>
        <p className="mt-1 font-semibold text-forest" data-testid="outlook-headline">{o.headline}</p>
        <AnimatePresence>
          <motion.ol variants={list} initial="hidden" animate="show" className="mt-3 space-y-3 border-l-2 border-green/30 pl-4">
            {o.steps.map((s) => (
              <motion.li key={s.when} variants={item} className="relative">
                <span className="absolute -left-[23px] top-1.5 h-3 w-3 rounded-full bg-green ring-4 ring-white" aria-hidden />
                <strong className="text-forest">{s.when}:</strong> {s.what}
              </motion.li>
            ))}
          </motion.ol>
        </AnimatePresence>
        {o.kind === "spots" && <p className="small mt-3">Old spots stay on the leaf, because a damaged leaf does not heal. Fertilizer alone will not stop the disease. This timeline is our estimate, not a promise: it depends on weather and on how the disease is controlled.</p>}
      </section>

      <p className="text-sm font-semibold text-forest">Fertilizer supports the plant. It does not cure disease. Confirm with your Krishi Vigyan Kendra (KVK) or a soil test (Soil Health Card).</p>
    </motion.section>
  );
}
