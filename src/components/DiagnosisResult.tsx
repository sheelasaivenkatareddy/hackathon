// Shows a diagnosis: top 3 bars, answer badge, confidence, heatmap and what to check next.
import { motion } from "framer-motion";
import { ClipboardCheck } from "lucide-react";
import { useState } from "react";
import { Diagnosis } from "../lib/diagnose";
import { useI18n } from "../lib/i18n";
import { confidenceWord } from "../lib/model";
import FertilizerCard from "./FertilizerCard";
import { AnswerBadge, CountUp, DemoBanner, ModelStatusChip, Toggle } from "./ui";
import { OverlayCanvas, Viewfinder } from "./viz";

const wipe = { initial: { clipPath: "circle(0% at 50% 50%)" }, animate: { clipPath: "circle(75% at 50% 50%)" }, transition: { duration: 0.9, ease: "easeOut" as const } };

export default function DiagnosisResult({ url, diagnosis, lowReliability, hideModelChip }: { url: string; diagnosis: Diagnosis; lowReliability?: boolean; hideModelChip?: boolean }) {
  const { t, disease } = useI18n();
  const { prediction: p, level, heatmap } = diagnosis;
  const top = p.top3[0];
  const [showOverlay, setShowOverlay] = useState(true);
  return (
    <div className="space-y-5" aria-live="polite">
      {!hideModelChip && <div className="flex flex-wrap items-center gap-2"><ModelStatusChip mode={p.mode} /></div>}
      {p.mode === "demo" && <DemoBanner />}
      {p.mode === "none" && <p role="note" className="rounded-xl bg-surface px-4 py-3 font-semibold text-forest">Model not connected yet. Photo checks only.</p>}
      {lowReliability && <p role="note" className="rounded-xl bg-amber-tint px-4 py-3 text-sm font-semibold text-amber-dark">Low reliability: this photo did not pass the photo checks.</p>}

      <div className="grid gap-5 md:grid-cols-2">
        <figure>
          <Viewfinder className="overflow-hidden rounded-card bg-deep lit">
            <div className="relative">
              <img src={url} alt="The scanned leaf" className="block w-full" />
              {showOverlay && heatmap && heatmap.kind !== "model-png" && (
                <motion.div className="absolute inset-0" {...wipe}><OverlayCanvas image={heatmap.overlay} className="h-full w-full" /></motion.div>
              )}
              {showOverlay && heatmap?.kind === "model-png" && <motion.img src={heatmap.png} alt="" className="absolute inset-0 h-full w-full" {...wipe} />}
            </div>
          </Viewfinder>
          {heatmap && (
            <figcaption className="mt-2">
              <Toggle checked={showOverlay} onChange={setShowOverlay} label={heatmap.kind === "colour" ? t("result.colourSpots") : t("result.heatmap")} />
              <span className="sr-only" data-testid="heatmap-label">{heatmap.kind === "colour" ? t("result.colourSpots") : t("result.heatmap")}</span>
            </figcaption>
          )}
        </figure>

        <div>
          <AnswerBadge level={level} />
          {top && (
            <>
              <p className="tiny mt-4 font-semibold uppercase tracking-wide">{t("result.topAnswer")}</p>
              <p className="font-heading text-2xl font-extrabold text-forest">{disease(top.name)}</p>
              <p className="small">{t(`result.confidence.${confidenceWord(top.p)}`)}</p>
              <ul className="mt-4 space-y-3">
                {p.top3.map((g, i) => (
                  <li key={g.label}>
                    <div className="flex justify-between gap-3 text-sm font-semibold text-forest">
                      <span>{disease(g.name)}</span>
                      <span><CountUp to={g.p * 100} suffix="%" /></span>
                    </div>
                    <div className="mt-1 h-3 overflow-hidden rounded-full bg-surface" aria-hidden>
                      <motion.div className={`h-full rounded-full ${i === 0 ? "bg-green" : "bg-muted/50"}`} initial={{ width: 0 }} animate={{ width: `${g.p * 100}%` }} transition={{ type: "spring", stiffness: 70, damping: 16, delay: i * 0.1 }} />
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <div className="rounded-card bg-green-tint/60 p-4">
        <h3 className="h3 flex items-center gap-2"><ClipboardCheck className="h-5 w-5" aria-hidden />{t("result.next.title")}</h3>
        <ol className="mt-2 list-inside list-decimal space-y-1">
          <li>{t("result.next.1")}</li>
          <li>{t("result.next.2")}</li>
          <li>{t("result.next.3")}</li>
        </ol>
        <p className="small mt-3 font-semibold">{t("result.noAdvice")}</p>
      </div>

      {level !== "RETAKE" && <FertilizerCard top={top} level={level} />}
    </div>
  );
}
