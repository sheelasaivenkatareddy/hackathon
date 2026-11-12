// Plant detail: timeline, compare any two, trend, treatment log and the Crop Recovery Twin.
import { ArrowLeft, Plus } from "lucide-react";
import { Suspense, lazy, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import CompareResultView from "../components/CompareResultView";
import { BottomSheet, Button, Card, Chip, EmptyState, Skeleton, StatusChip, SyntheticChip, useToast } from "../components/ui";
import { LeafIllustration } from "../components/viz";
import RecoveryTwin from "../components/viz/RecoveryTwin";
import { Visit, db, uid, useBlobUrl, useLive } from "../lib/db";
import { fmtDate, fmtShort, nextCheckDate, plantVisits, recoveryStatus } from "../lib/watch";
import { scoutEveryDays } from "../lib/weather";
import { useEffect } from "react";

const TrendChart = lazy(() => import("../components/viz/TrendChart"));

function ThumbButton({ visit, selected, onClick }: { visit: Visit; selected: boolean; onClick: () => void }) {
  const url = useBlobUrl(visit.thumb);
  return (
    <button onClick={onClick} aria-pressed={selected} className={`relative shrink-0 overflow-hidden rounded-xl border-2 ${selected ? "border-tomato" : "border-transparent"}`}>
      <img src={url} alt={`Photo from ${fmtShort(visit.date)}`} className="h-24 w-24 object-cover" />
      <span className="absolute inset-x-1 bottom-1 rounded-full bg-deep/85 lit px-2 py-0.5 text-center text-xs font-semibold text-white">{fmtShort(visit.date)}</span>
    </button>
  );
}

const RECOVERY_TONE = { Recovering: "green", "Not improving yet": "tomato", "Too early to tell": "amber" } as const;

export default function PlantDetail() {
  const { plantId = "" } = useParams();
  const toast = useToast();
  const plant = useLive(async () => (await db.plants.get(plantId)) ?? null, [plantId]);
  const field = useLive(async () => (plant ? db.fields.get(plant.fieldId) : undefined), [plant?.fieldId]);
  const visits = useLive(() => plantVisits(plantId), [plantId]);
  const treatments = useLive(async () => (await db.treatments.where("plantId").equals(plantId).toArray()).sort((a, b) => a.date.localeCompare(b.date)), [plantId]);
  const [picked, setPicked] = useState<string[]>([]);
  const [pair, setPair] = useState<[Visit, Visit] | null>(null);
  const [every, setEvery] = useState(3);
  const [tDate, setTDate] = useState(new Date().toISOString().slice(0, 10));
  const [tNote, setTNote] = useState("");

  useEffect(() => { if (field) scoutEveryDays(field).then(setEvery); }, [field]);

  const last = visits?.[visits.length - 1];
  const recovery = useMemo(() => (visits && treatments ? recoveryStatus(visits, treatments) : null), [visits, treatments]);

  if (plant === null) return <div className="wrap py-10"><p>This plant was not found.</p><Button to="/watch" className="mt-3">Back to Leaf Watch</Button></div>;
  if (!plant || !visits || !treatments) return <div className="wrap py-10"><Skeleton className="h-64" /></div>;

  const pick = (v: Visit) => {
    const next = picked.includes(v.id) ? picked.filter((x) => x !== v.id) : [...picked, v.id];
    if (next.length === 2) {
      const [a, b] = next.map((id) => visits.find((x) => x.id === id)!).sort((x, y) => x.date.localeCompare(y.date));
      setPair([a, b]); setPicked([]);
    } else setPicked(next);
  };

  const addTreatment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tNote.trim()) return;
    await db.treatments.put({ id: uid(), plantId, date: new Date(`${tDate}T00:00:00`).toISOString(), note: tNote.trim() });
    setTNote(""); toast("Treatment added.");
  };

  const lastOlder = last?.compare ? visits.find((v) => v.id === last.compare!.olderVisitId) : undefined;

  return (
    <div className="wrap py-8 md:py-12">
      <Link to="/watch" className="small inline-flex min-h-[44px] items-center gap-1 font-semibold hover:text-forest"><ArrowLeft className="h-4 w-4" aria-hidden />Leaf Watch</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">{plant.name}</h1>
          <p className="small">{field?.name}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {last?.compare && <StatusChip status={last.compare.status} />}
            {plant.synthetic && <SyntheticChip />}
            <Chip>Next check: {fmtDate(nextCheckDate(last?.date, every))}</Chip>
          </div>
        </div>
        <Button to={`/watch/${plantId}/visit`}><Plus className="h-5 w-5" aria-hidden />Add visit</Button>
      </div>

      {!visits.length ? (
        <div className="mt-6"><EmptyState title="No photos yet" text="Take the first photo of the marked leaf." illustration={<LeafIllustration className="h-28 w-24" title="" />}><Button to={`/watch/${plantId}/visit`}>Add visit</Button></EmptyState></div>
      ) : (
        <div className="mt-6 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-5">
            <Card className="!bg-white">
              <h2 className="h3">Timeline</h2>
              <p className="small">{visits.length >= 2 ? "Tap any two photos to compare them." : "Add another visit to compare photos."}</p>
              <div className="-mx-1 mt-3 flex gap-3 overflow-x-auto px-1 pb-2">
                {visits.map((v) => <ThumbButton key={v.id} visit={v} selected={picked.includes(v.id)} onClick={() => pick(v)} />)}
              </div>
              {last && lastOlder && <Button variant="secondary" className="mt-2" onClick={() => setPair([lastOlder, last])}>See the latest result</Button>}
            </Card>
            <Card className="!bg-white">
              <h2 className="h3">Affected area</h2>
              <div className="mt-3">
                <Suspense fallback={<Skeleton className="h-64" />}><TrendChart visits={visits} treatments={treatments} /></Suspense>
              </div>
            </Card>
          </div>
          <div className="space-y-5">
            <Card className="!bg-white">
              <h2 className="h3">Crop Recovery Twin</h2>
              <div className="mt-3"><RecoveryTwin visits={visits} /></div>
            </Card>
            <Card className="!bg-white">
              <h2 className="h3">Treatment log</h2>
              {recovery && <div className="mt-2"><Chip tone={RECOVERY_TONE[recovery]}>{recovery}</Chip></div>}
              {!!treatments.length && (
                <ul className="mt-3 space-y-2">
                  {treatments.map((t) => <li key={t.id} className="rounded-xl bg-surface px-3 py-2 text-sm"><strong className="text-forest">{fmtShort(t.date)}</strong> · {t.note}</li>)}
                </ul>
              )}
              <form className="mt-3 space-y-2" onSubmit={addTreatment}>
                <h3 className="text-sm font-semibold text-forest">Add treatment given</h3>
                <input type="date" aria-label="Treatment date" className="field-input" value={tDate} onChange={(e) => setTDate(e.target.value)} />
                <textarea aria-label="Treatment note" className="field-input" rows={2} placeholder="What was done, in your own words" value={tNote} onChange={(e) => setTNote(e.target.value)} />
                <Button type="submit" variant="secondary" disabled={!tNote.trim()}>Add treatment given</Button>
              </form>
              <p className="tiny mt-2">Patra Chain - Blockchain-based crop disease verification system never suggests treatments. Ask your agriculture officer or KVK.</p>
            </Card>
          </div>
        </div>
      )}

      <BottomSheet open={!!pair} onClose={() => setPair(null)} title="Compare result">
        {pair && <CompareResultView older={pair[0]} newer={pair[1]} plantName={plant.name} synthetic={plant.synthetic} onChecked={() => setPair(null)} />}
      </BottomSheet>
    </div>
  );
}
