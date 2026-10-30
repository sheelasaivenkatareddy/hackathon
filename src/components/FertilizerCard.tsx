import { motion } from "framer-motion";
import { Check, ExternalLink, Sprout, TriangleAlert } from "lucide-react";
import type { AnswerLevel } from "../lib/model";
import { fertilizerAdvice } from "../lib/nutrition";

const list = { hidden: {}, show: { transition: { staggerChildren: 0.12, delayChildren: 0.5 } } };
const item = { hidden: { opacity: 0, x: -10 }, show: { opacity: 1, x: 0 } };

export default function FertilizerCard({ name, level }: { name?: string; level: AnswerLevel }) {
  const a = fertilizerAdvice(name, level);
  return (
    <motion.section data-testid="fertilizer-card" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.4 }} className="rounded-card border border-amber/40 bg-amber-tint/50 p-4 md:p-6">
      <h3 className="h3 flex items-center gap-2"><Sprout className="h-5 w-5 text-green" aria-hidden />Fertilizer suggestions</h3>
      <p className="mt-1 font-heading text-lg font-bold text-forest">{a.headline}</p>
      {!a.specific && level !== "CLEAR" && <p className="small mt-1">The answer is not certain yet, so this is general soil care, not advice for one disease.</p>}
      <motion.div variants={list} initial="hidden" animate="show" className="mt-3 grid gap-4 md:grid-cols-2">
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
      <p className="mt-3 text-sm">{a.why}</p>
      {a.source && <a href={a.source.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex min-h-[32px] items-center gap-1 text-sm font-semibold text-green-dark underline underline-offset-2">Source: {a.source.name}<ExternalLink className="h-3.5 w-3.5" aria-hidden /></a>}
      <p className="mt-3 border-t border-amber/30 pt-3 text-sm font-semibold text-forest">Fertilizer supports the plant. It does not cure disease. Get the amount from a soil test (Soil Health Card) or your Krishi Vigyan Kendra (KVK).</p>
    </motion.section>
  );
}
