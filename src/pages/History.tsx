// My scans: everything scanned on this device, with simple totals.
import { motion } from "framer-motion";
import { ScanLine, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import FertilizerCard from "../components/FertilizerCard";
import { TreatmentCard } from "../components/Guidance";
import { ScanReport, humanSummary } from "../components/ScanInsights";
import { BottomSheet, Button, Card, Chip, CountUp, EmptyState, Reveal, SampleChip, Skeleton, useToast } from "../components/ui";
import { LeafIllustration } from "../components/viz";
import { Scan, db, useBlobUrl, useLive } from "../lib/db";
import { useI18n } from "../lib/i18n";
import { fmtDate } from "../lib/watch";

const TONE = { CLEAR: "green", CHECK: "amber", EXPERT: "tomato", RETAKE: "tomato" } as const;

function ScanRow({ scan, index, onOpen }: { scan: Scan; index: number; onOpen: () => void }) {
  const { disease } = useI18n();
  const url = useBlobUrl(scan.thumb);
  const top = scan.prediction.top3[0];
  return (
    <motion.li initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(index, 8) * 0.04 }}>
      <motion.button whileHover={{ x: 4 }} whileTap={{ scale: 0.99 }} onClick={onOpen} className="flex w-full items-center gap-3 border-t border-line py-3 text-left">
        <img src={url} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-forest">{top ? disease(top.name) : "No AI answer"}</span>
          <span className="small block">{fmtDate(scan.date)}{top ? ` · ${Math.round(top.p * 100)}% confidence` : ""}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <Chip tone={TONE[scan.level]}>{scan.level}</Chip>
          {scan.feedback && <span className="tiny">{scan.feedback === "right" ? "You: right" : "You: wrong"}</span>}
        </span>
      </motion.button>
    </motion.li>
  );
}

export default function History() {
  const { disease } = useI18n();
  const toast = useToast();
  const scans = useLive(async () => (await db.scans.toArray()).sort((a, b) => b.date.localeCompare(a.date)), []);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Scan | null>(null);
  const openUrl = useBlobUrl(open?.photo);

  const stats = useMemo(() => {
    const all = scans ?? [];
    const named = all.filter((s) => s.prediction.top3[0]);
    const counts = new Map<string, number>();
    for (const s of named) { const n = s.prediction.top3[0].name; counts.set(n, (counts.get(n) ?? 0) + 1); }
    const rated = all.filter((s) => s.feedback);
    return {
      total: all.length,
      healthy: named.filter((s) => s.prediction.top3[0].name.endsWith("Healthy")).length,
      unsure: all.filter((s) => s.level === "EXPERT" || s.level === "CHECK").length,
      rated: rated.length, right: rated.filter((s) => s.feedback === "right").length,
      top: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
    };
  }, [scans]);

  const shown = (scans ?? []).filter((s) => !query.trim() || disease(s.prediction.top3[0]?.name ?? "No AI answer").toLowerCase().includes(query.trim().toLowerCase()));
  const tiles = [["Scans", stats.total], ["Looked healthy", stats.healthy], ["Unsure answers", stats.unsure], ["You said right", stats.right]] as const;

  return (
    <div className="wrap py-8 md:py-12">
      <h1 className="page-title">My scans</h1>
      <p className="small mt-1">Everything you scan stays on this device.</p>

      {!scans && <Skeleton className="mt-6 h-48" />}
      {scans && !scans.length && (
        <div className="mt-6"><EmptyState title="You haven't scanned a leaf yet" text="Your scans will appear here, so you can look back at them." illustration={<LeafIllustration className="h-28 w-24" title="" />}><Button to="/scan"><ScanLine className="h-5 w-5" aria-hidden />Scan a leaf</Button></EmptyState></div>
      )}
      {!!scans?.length && (
        <div className="mt-6 space-y-5">
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="history-stats">
            {tiles.map(([label, value], i) => (
              <Reveal key={label} delay={i}><li className="rounded-card border border-line bg-white p-4 shadow-soft"><div className="font-heading text-3xl font-extrabold text-forest"><CountUp to={value} /></div><div className="small">{label}</div></li></Reveal>
            ))}
          </ul>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.6fr]">
            <Card className="min-w-0 !bg-white">
              <h2 className="h3">What you've found most</h2>
              <ul className="mt-3 space-y-3">
                {stats.top.map(([name, n]) => (
                  <li key={name}>
                    <div className="flex justify-between gap-3 text-sm"><span>{disease(name)}</span><strong className="text-forest">{n}</strong></div>
                    <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-surface" aria-hidden><motion.div className="h-full rounded-full bg-green" initial={{ width: 0 }} animate={{ width: `${(n / stats.top[0][1]) * 100}%` }} transition={{ type: "spring", stiffness: 70, damping: 16 }} /></div>
                  </li>
                ))}
                {!stats.top.length && <li className="small">Nothing named yet.</li>}
              </ul>
            </Card>
            <Card className="min-w-0 !bg-white">
              <label className="relative block">
                <span className="sr-only">Search your scans</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
                <input className="field-input !pl-9" placeholder="Search by disease" value={query} onChange={(e) => setQuery(e.target.value)} />
              </label>
              <ul className="mt-3" data-testid="history-list">
                {shown.map((s, i) => <ScanRow key={s.id} scan={s} index={i} onOpen={() => setOpen(s)} />)}
                {!shown.length && <li className="small border-t border-line py-4">No scans match that search.</li>}
              </ul>
            </Card>
          </div>
        </div>
      )}

      <BottomSheet open={!!open} onClose={() => setOpen(null)} title="Scan details">
        {open && (
          <div className="space-y-4">
            <img src={openUrl} alt="The leaf you scanned" className="w-full rounded-card" />
            {open.sampleFile && <SampleChip />}
            <p className="font-heading text-lg font-bold text-forest">{humanSummary(open.prediction.top3[0], open.prediction.top3[1], open.level, disease)}</p>
            <ScanReport top={open.prediction.top3[0]} level={open.level} mode={open.prediction.mode} coach={open.coach} affectedPct={open.affectedPct} seconds={open.seconds} />
            {open.level !== "RETAKE" && <FertilizerCard top={open.prediction.top3[0]} level={open.level} />}
            <TreatmentCard name={open.prediction.top3[0]?.name} level={open.level} />
            <Button variant="danger" onClick={async () => { await db.scans.delete(open.id); setOpen(null); toast("Scan deleted."); }}><Trash2 className="h-4 w-4" aria-hidden />Delete this scan</Button>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
