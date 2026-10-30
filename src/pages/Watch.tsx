// Leaf Watch: fields and their sentinel plants.
import { Bell, CalendarPlus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Card, Chip, EmptyState, InfoTip, Skeleton, StatusChip, SyntheticChip, useToast } from "../components/ui";
import { LeafIllustration } from "../components/viz";
import { Field, Plant, Visit, db, setSetting, useBlobUrl, useLive } from "../lib/db";
import { useI18n } from "../lib/i18n";
import { downloadIcs } from "../lib/ics";
import type { Level } from "../lib/risk";
import { ManifestVisit, daysUntil, dueLabel, fmtDate, fmtShort, loadDemoPlant, loadTestPairs, nextCheckDate, plantVisits, summarise, timelineManifest } from "../lib/watch";
import { loadRisk } from "../lib/weather";

const STAGE = { seedling: "Seedling", vegetative: "Vegetative", flowering: "Flowering", fruiting: "Fruiting" };
const RISK_TONE: Record<Level, "green" | "amber" | "tomato"> = { low: "green", medium: "amber", high: "tomato" };

function PlantRow({ plant, visits, every }: { plant: Plant; visits: Visit[]; every: number }) {
  const last = visits[visits.length - 1];
  const url = useBlobUrl(last?.thumb);
  const due = nextCheckDate(last?.date, every);
  return (
    <li className="flex flex-wrap items-center gap-3 border-t border-line py-3">
      <Link to={`/watch/${plant.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-green-tint">
          {url ? <img src={url} alt={`Latest photo of ${plant.name}`} className="h-full w-full object-cover" /> : <LeafIllustration className="h-full w-full p-1" title="" />}
        </span>
        <span className="min-w-0">
          <span className="block truncate font-semibold text-forest">{plant.name}</span>
          <span className="small block">{last ? `Last visit ${fmtShort(last.date)}` : "No visits yet"}</span>
        </span>
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        {last?.compare && <StatusChip status={last.compare.status} />}
        <Chip tone={daysUntil(due) <= 0 ? "tomato" : "muted"}>{dueLabel(due)}</Chip>
        <Button variant="secondary" to={`/watch/${plant.id}/visit`} className="!px-4 !text-sm">Add visit</Button>
      </div>
    </li>
  );
}

function FieldCard({ field }: { field: Field }) {
  const toast = useToast();
  const data = useLive(async () => {
    const plants = (await db.plants.where("fieldId").equals(field.id).toArray()).sort((a, b) => a.order - b.order);
    const visits = await Promise.all(plants.map((p) => plantVisits(p.id)));
    return { plants, visits };
  }, [field.id]);
  const [risk, setRisk] = useState<{ level: Level; every: number } | null>(null);
  useEffect(() => { loadRisk(field).then((r) => setRisk({ level: r.risk.overall.level, every: r.risk.scoutEveryDays })).catch(() => setRisk(null)); }, [field]);
  const { t } = useI18n();
  const every = risk?.every ?? 3;

  if (!data) return <Skeleton className="h-48" />;
  const latest = data.visits.map((v) => v[v.length - 1]);
  const s = summarise(latest);
  const nexts = latest.map((l) => nextCheckDate(l?.date, every)).sort((a, b) => a.getTime() - b.getTime());
  const next = nexts[0] ?? new Date();

  const remindMe = async () => {
    if (!("Notification" in window)) { toast("This browser does not support notifications."); return; }
    const p = await Notification.requestPermission();
    if (p === "granted") { await setSetting("remind", true); toast("We will remind you when you open the app on a due day."); }
    else toast("Notifications are off.");
  };

  return (
    <Card className="!bg-white" >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="h3">{field.name}</h2>
          <p className="small">{field.crop} · {STAGE[field.stage]}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {field.synthetic && <SyntheticChip />}
          {risk && <Link to="/risk"><Chip tone={RISK_TONE[risk.level]}>{t(`risk.${risk.level}`)}</Chip></Link>}
        </div>
      </div>
      <p className="mt-3 font-semibold text-forest">Next check: {fmtDate(next)}</p>
      <p className="mt-1">
        Incidence: {s.withDamage} of {s.checked} plants with new damage at the last check ({s.incidencePct}%)
        <InfoTip text="Plants whose latest compare shows first spots, new spots or spreading, divided by the plants compared." />
      </p>
      <p>
        Severity: {s.severity === null ? "No compare yet" : `${s.severity}% affected`}
        <InfoTip text="The mean affected area of the plants at their latest compare." />
      </p>
      <ul className="mt-3">{data.plants.map((p, i) => <PlantRow key={p.id} plant={p} visits={data.visits[i]} every={every} />)}</ul>
      <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
        <Button variant="ghost" onClick={() => downloadIcs(next, every)} className="!text-sm"><CalendarPlus className="h-4 w-4" aria-hidden />Add reminders to calendar</Button>
        <Button variant="ghost" onClick={remindMe} className="!text-sm"><Bell className="h-4 w-4" aria-hidden />Remind me</Button>
      </div>
    </Card>
  );
}

export default function Watch() {
  const toast = useToast();
  const fields = useLive(() => db.fields.toArray(), []);
  const [manifest, setManifest] = useState<{ name: string; visits: ManifestVisit[] } | null>(null);
  const [busy, setBusy] = useState<"" | "pair" | "demo">("");
  useEffect(() => { timelineManifest().then(setManifest); }, []);

  const run = async (kind: "pair" | "demo", fn: () => Promise<void>) => {
    setBusy(kind);
    try { await fn(); } catch (e) { console.warn(e); toast("That could not be loaded. Please try again."); } finally { setBusy(""); }
  };
  const loaders = (
    <>
      {manifest && <Button variant="secondary" loading={busy === "demo"} onClick={() => run("demo", () => loadDemoPlant(manifest))}>Load demo plant</Button>}
      <Button variant="secondary" loading={busy === "pair"} onClick={() => run("pair", loadTestPairs)}>Load test pair</Button>
    </>
  );

  return (
    <div className="wrap py-8 md:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Leaf Watch</h1>
          <p className="small mt-1">Same leaves, every few days.</p>
        </div>
        {!!fields?.length && <Button to="/watch/new"><Plus className="h-5 w-5" aria-hidden />New field</Button>}
      </div>
      <div className="mt-6 space-y-5">
        {busy && <p role="status" data-testid="loading-photos" className="rounded-xl bg-green-tint px-4 py-3 font-semibold text-green-dark">Loading the photos and comparing them…</p>}
        {!fields && <Skeleton className="h-48" />}
        {fields && !fields.length && (
          <EmptyState title="Set up your first field" text="Mark a few sentinel plants and photograph the same leaves every 2–3 days." illustration={<LeafIllustration className="h-32 w-28" title="" />}>
            <Button to="/watch/new">Set up your first field</Button>
            {loaders}
          </EmptyState>
        )}
        {fields && !fields.length && <p className="tiny text-center">“Load test pair” is a synthetic test pair, for testing only.</p>}
        {fields?.map((f) => <FieldCard key={f.id} field={f} />)}
        {!!fields?.length && !fields.some((f) => f.synthetic) && <div className="flex flex-wrap gap-2">{loaders}</div>}
      </div>
    </div>
  );
}
