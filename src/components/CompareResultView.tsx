// The Leaf Watch result: status, rings on the new photo, real numbers, slider and "what was counted".
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Microscope, TriangleAlert, UserCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Diagnosis, diagnose } from "../lib/diagnose";
import { Visit, db, uid, useBlobUrl } from "../lib/db";
import { useI18n } from "../lib/i18n";
import { loadWorkImage, shrinkForStorage } from "../lib/vision/browser";
import { CompareResult, NewDamage } from "../lib/vision/compare";
import { andNot, erodeDisk } from "../lib/vision/morph";
import { maskToOverlay } from "../lib/vision/overlay";
import { daysBetween, fmtShort, isNewDamage, runCompare } from "../lib/watch";
import DiagnosisResult from "./DiagnosisResult";
import { Button, CountUp, StatusChip, SyntheticChip, Toggle, useToast } from "./ui";
import { CompareSlider, OverlayCanvas, SpotRings, Viewfinder } from "./viz";

export function ComparingAnimation({ older, newer, note }: { older?: string; newer?: string; note?: string }) {
  return (
    <div className="py-8 text-center" role="status">
      <div className="relative mx-auto h-28 w-52">
        <motion.img src={older} alt="" className="absolute left-0 top-0 h-28 w-28 rounded-xl object-cover shadow-soft" animate={{ x: [0, 40, 40] }} transition={{ duration: 1.2, repeat: Infinity, repeatType: "reverse" }} />
        <motion.img src={newer} alt="" className="absolute right-0 top-0 h-28 w-28 rounded-xl object-cover opacity-80 shadow-soft" animate={{ x: [0, -40, -40] }} transition={{ duration: 1.2, repeat: Infinity, repeatType: "reverse" }} />
      </div>
      <p className="mt-4 font-semibold text-forest">Comparing…</p>
      {note && <p className="small mt-1">{note}</p>}
    </div>
  );
}

interface Props {
  older: Visit; newer: Visit; plantName: string; synthetic?: boolean;
  initial?: { result: CompareResult; lowerAccuracy: boolean };
  onChecked?: () => void;
}

export default function CompareResultView({ older, newer, plantName, synthetic, initial, onChecked }: Props) {
  const { t } = useI18n();
  const toast = useToast();
  const olderUrl = useBlobUrl(older.photo), newerUrl = useBlobUrl(newer.photo);
  const [data, setData] = useState(initial ?? null);
  const [error, setError] = useState(false);
  const [counted, setCounted] = useState(false);
  const [zoom, setZoom] = useState<NewDamage | null>(null);
  const [diag, setDiag] = useState<Diagnosis | null>(null);
  const [naming, setNaming] = useState(false);

  useEffect(() => {
    if (initial) { setData(initial); return; }
    let live = true;
    setData(null);
    runCompare(older.photo, newer.photo, Math.max(1, Math.round(daysBetween(older.date, newer.date))))
      .then((r) => { if (live) setData(r); })
      .catch((e) => { console.warn(e); if (live) setError(true); });
    return () => { live = false; };
  }, [older.id, newer.id, initial]); // eslint-disable-line react-hooks/exhaustive-deps

  const layers = useMemo(() => {
    if (!data) return null;
    const o = data.result.overlay;
    return {
      oldOutline: maskToOverlay(andNot(o.oldDamage, erodeDisk(o.oldDamage, 1)), [217, 151, 15], 0.75),
      spot: maskToOverlay(o.spot, [255, 0, 200], 0.6),
      holes: maskToOverlay(o.holes, [0, 220, 255], 0.75),
      leaf: maskToOverlay(andNot(o.leaf, erodeDisk(o.leaf, 2)), [255, 255, 255], 0.95),
    };
  }, [data]);

  if (error) return <p role="alert" className="font-semibold text-tomato-dark">We could not compare these photos. Please try again.</p>;
  if (!data || !layers) return <ComparingAnimation older={olderUrl} newer={newerUrl} />;

  const r = data.result;
  const notComparable = r.status === "not_comparable";
  const alert = isNewDamage(r.status);
  const alertDate = fmtShort(older.date);

  const nameProblem = async () => {
    setNaming(true);
    const work = await loadWorkImage(newer.photo);
    const d = await diagnose(newer.photo, work, newer.coach, newer.usedAnyway);
    setDiag(d);
    const scanId = uid();
    await db.scans.put({
      id: scanId, date: new Date().toISOString(), photo: newer.photo, thumb: await shrinkForStorage(newer.photo, 256, 0.72), coach: newer.coach, usedAnyway: newer.usedAnyway,
      level: d.level, confirmed: false, plantId: newer.plantId, prediction: { mode: d.prediction.mode, top3: d.prediction.top3, modelVersion: d.prediction.modelVersion },
    });
    await db.visits.update(newer.id, { diagnosisId: scanId });
    setNaming(false);
  };

  return (
    <div className="space-y-4" aria-live="polite" data-testid="compare-result">
      <div className="flex flex-wrap items-center gap-2">
        <span data-status={r.status}><StatusChip status={r.status} big /></span>
        {synthetic && <SyntheticChip />}
      </div>

      <AnimatePresence>
        {alert && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} role="alert" className="flex gap-2 rounded-xl bg-tomato-tint px-4 py-3 font-semibold text-tomato-dark">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
            <span>Early alert: new damage on {plantName} since {alertDate}. Check nearby plants today.</span>
          </motion.div>
        )}
      </AnimatePresence>

      <Viewfinder className="overflow-hidden rounded-card bg-deep lit">
        <motion.div className="relative" animate={{ scale: zoom ? 2 : 1 }} transition={{ type: "spring", stiffness: 240, damping: 26 }}
          style={{ transformOrigin: zoom ? `${(zoom.x / r.workSize.width) * 100}% ${(zoom.y / r.workSize.height) * 100}%` : "50% 50%" }}
          onClick={() => { if (zoom) setZoom(null); }}>
          <img src={newerUrl} alt={`The new photo of ${plantName}, with new damage ringed`} className="block w-full" />
          <OverlayCanvas image={layers.oldOutline} className="absolute inset-0 h-full w-full" />
          {counted && <>
            <OverlayCanvas image={layers.spot} className="absolute inset-0 h-full w-full" />
            <OverlayCanvas image={layers.holes} className="absolute inset-0 h-full w-full" />
            <OverlayCanvas image={layers.leaf} className="absolute inset-0 h-full w-full" />
          </>}
          <SpotRings components={r.components} width={r.workSize.width} height={r.workSize.height} onRing={(c) => setZoom((z) => (z ? null : c))} />
        </motion.div>
      </Viewfinder>

      <p className="font-semibold text-forest" data-testid="compare-numbers">
        New spots: <CountUp to={r.newSpots} /> · New holes: <CountUp to={r.newHoles} /> · Affected: {r.affectedOldPct}% → {r.affectedNewPct}% ({r.changePer3Days} points per 3 days)
      </p>

      {notComparable
        ? <p className="rounded-xl bg-surface px-4 py-3 text-forest">We couldn't line up the two photos. Use the ghost outline and retake from the same angle.</p>
        : <p className="small">Photos lined up: {r.alignment.quality === "good" ? "Good" : "Fair"} · {r.alignment.method}</p>}
      {data.lowerAccuracy && <p className="small font-semibold text-amber-dark">Lower accuracy: comparing by leaf shape only.</p>}

      <CompareSlider a={olderUrl} b={newerUrl} labelA={fmtShort(older.date)} labelB={fmtShort(newer.date)} altA={`Older photo of ${plantName}`} altB={`Newer photo of ${plantName}`} />

      <Toggle checked={counted} onChange={setCounted} label="Show what was counted" hint="Magenta: spots. Cyan: holes. White: leaf outline." />

      <p className="rounded-xl bg-surface px-4 py-3 text-sm text-muted">Spot finding uses colour rules, not the AI model. Very faint spots can be missed and shadows can be counted. Always look at the leaf yourself.</p>

      <div className="flex flex-wrap gap-2">
        <Button onClick={nameProblem} loading={naming} disabled={!!diag}><Microscope className="h-5 w-5" aria-hidden />Name the problem</Button>
        <Button variant="secondary" disabled={newer.askedExpert} onClick={async () => { await db.visits.update(newer.id, { askedExpert: true }); toast("Sent to the expert queue."); }}><UserCheck className="h-5 w-5" aria-hidden />{t("expert.ask")}</Button>
        <Button variant="secondary" onClick={async () => { await db.visits.update(newer.id, { checked: true }); toast("Marked as checked."); onChecked?.(); }}><CheckCircle2 className="h-5 w-5" aria-hidden />Mark as checked</Button>
      </div>

      {diag && newerUrl && <div className="border-t border-line pt-4"><DiagnosisResult url={newerUrl} diagnosis={diag} lowReliability={newer.usedAnyway} /></div>}
    </div>
  );
}
