// Expert queue: unsure scans and visits. Expert labels confirm a case and feed retraining.
import { Download, Lock, LogOut } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BottomSheet, Button, Card, Chip, EmptyState, SampleChip, Skeleton, StatusChip, useToast } from "../components/ui";
import { LeafIllustration } from "../components/viz";
import { CONFIG } from "../config";
import GoogleAdminSignIn from "../components/GoogleAdminSignIn";
import { GOOGLE_CLIENT_ID, clearSession, restoreSession } from "../lib/auth";
import { getFieldHead } from "../lib/diagnose";
import { Scan, Visit, db, useBlobUrl, useLive } from "../lib/db";
import { useI18n } from "../lib/i18n";
import { downloadBlob } from "../lib/ics";
import type { Label } from "../lib/model";
import { fmtShort } from "../lib/watch";

type Item = { kind: "scan"; row: Scan } | { kind: "visit"; row: Visit };
const OTHER = "Other / unsure";

const inQueue = (s: Scan) => s.level === "EXPERT" || s.level === "CHECK" || s.askedExpert;
const topOf = (it: Item, scans: Scan[]) => {
  const scan = it.kind === "scan" ? it.row : scans.find((s) => s.id === it.row.diagnosisId);
  return scan?.prediction.top3[0];
};
const csv = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

function QueueRow({ item, scans, onOpen }: { item: Item; scans: Scan[]; onOpen: () => void }) {
  const { disease } = useI18n();
  const url = useBlobUrl(item.row.thumb);
  const top = topOf(item, scans);
  return (
    <li className="flex flex-wrap items-center gap-3 border-t border-line py-3">
      <img src={url} alt="Leaf photo waiting for an expert" className="h-16 w-16 rounded-xl object-cover" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-forest">{top ? disease(top.name) : "No model answer"}</p>
        <p className="small">{fmtShort(item.row.date)} · {item.kind === "scan" ? "Scan" : "Leaf Watch visit"}</p>
        <div className="mt-1 flex flex-wrap gap-1">
          {item.row.expertLabel ? <Chip tone="green">Confirmed</Chip> : <Chip tone="amber">Waiting</Chip>}
          {item.kind === "scan" && item.row.sampleFile && <SampleChip />}
        </div>
      </div>
      <Button variant="secondary" onClick={onOpen} className="!text-sm">Review</Button>
    </li>
  );
}

export default function Expert() {
  const { disease } = useI18n();
  const toast = useToast();
  const scans = useLive(() => db.scans.toArray(), []);
  const visits = useLive(() => db.visits.toArray(), []);
  const [unlocked, setUnlocked] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [wrong, setWrong] = useState(false);
  const [labels, setLabels] = useState<Label[]>([]);
  const [open, setOpen] = useState<Item | null>(null);
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [zipping, setZipping] = useState(false);
  const url = useBlobUrl(open?.row.photo);

  useEffect(() => {
    getFieldHead().then(async (head) => setLabels(head?.labels ?? await fetch("/model/labels.json").then((r) => r.json()).catch(() => []))).catch(() => setLabels([]));
  }, []);

  useEffect(() => {
    if (GOOGLE_CLIENT_ID) restoreSession().then((email) => { if (email) { setAdminEmail(email); setUnlocked(true); } });
  }, []);

  const signOut = () => {
    clearSession();
    (window as any).google?.accounts?.id?.disableAutoSelect();
    setAdminEmail(null); setUnlocked(false);
  };

  const queue = useMemo<Item[]>(() => {
    if (!scans || !visits) return [];
    const a: Item[] = scans.filter(inQueue).map((row) => ({ kind: "scan", row }));
    const b: Item[] = visits.filter((v) => v.askedExpert).map((row) => ({ kind: "visit", row }));
    return [...a, ...b].sort((x, y) => y.row.date.localeCompare(x.row.date));
  }, [scans, visits]);

  const review = (it: Item) => { setOpen(it); setLabel(it.row.expertLabel ?? ""); setNote(it.row.expertNote ?? ""); };

  const save = async () => {
    if (!open || !label) return;
    if (open.kind === "scan") {
      await db.scans.update(open.row.id, { expertLabel: label, expertNote: note, confirmed: true });
      const cell = open.row.cellId;
      if (cell && label !== OTHER && !label.endsWith("Healthy")) {
        await db.reports.put({ id: `scan-${open.row.id}`, cell, disease: label, date: new Date().toISOString(), confirmed: true, source: "mine" });
      }
    } else {
      await db.visits.update(open.row.id, { expertLabel: label, expertNote: note });
    }
    setOpen(null); toast("Expert label saved. Marked as confirmed.");
  };

  const download = async () => {
    setZipping(true);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      const lines = ["id,date,cell,model top-1,expert label,sharpness,light,leaf %"];
      for (const it of queue.filter((q) => q.row.expertLabel)) {
        const cell = it.kind === "scan" ? it.row.cellId : undefined;
        const c = it.row.coach;
        lines.push([it.row.id, it.row.date, cell, topOf(it, scans ?? [])?.name, it.row.expertLabel, c.sharpness.value, c.light.value, c.leafInFrame.value].map(csv).join(","));
        zip.file(`photos/${it.row.id}.jpg`, it.row.photo);
      }
      zip.file("labels.csv", lines.join("\n") + "\n");
      downloadBlob(await zip.generateAsync({ type: "blob" }), "patra-labelled-data.zip");
    } finally { setZipping(false); }
  };

  const openTop = open && topOf(open, scans ?? []);
  const labelled = queue.filter((q) => q.row.expertLabel).length;

  return (
    <div className="wrap max-w-4xl py-8 md:py-12">
      <h1 className="page-title">Expert queue</h1>
      <p className="small mt-1">Scans and visits with an unsure answer, or sent with “Ask an expert”.</p>

      {adminEmail && (
        <Card className="mt-5 !bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-semibold text-forest" data-testid="admin-signed-in">Signed in as admin: {adminEmail}</p>
            <Button variant="secondary" onClick={signOut} className="!text-sm"><LogOut className="h-4 w-4" aria-hidden />Sign out</Button>
          </div>
        </Card>
      )}

      {!unlocked && GOOGLE_CLIENT_ID && (
        <Card className="mt-5 !bg-white"><GoogleAdminSignIn onAdmin={(email) => { setAdminEmail(email); setUnlocked(true); }} /></Card>
      )}

      {!unlocked && !GOOGLE_CLIENT_ID && (
        <Card className="mt-5 !bg-white">
          <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); if (code === CONFIG.expert.passcode) { setUnlocked(true); setWrong(false); } else setWrong(true); }}>
            <label className="min-w-[200px] flex-1"><span className="field-label"><Lock className="mr-1 inline h-4 w-4" aria-hidden />Expert mode passcode</span>
              <input type="password" autoComplete="off" className="field-input" value={code} onChange={(e) => setCode(e.target.value)} aria-invalid={wrong} />
            </label>
            <Button type="submit">Open expert mode</Button>
          </form>
          {wrong && <p role="alert" className="mt-2 text-sm font-semibold text-tomato-dark">That passcode is not right.</p>}
        </Card>
      )}

      <div className="mt-5">
        {(!scans || !visits) && <Skeleton className="h-40" />}
        {scans && visits && !queue.length && <EmptyState title="Nothing is waiting" text="Unsure scans will appear here." illustration={<LeafIllustration className="h-28 w-24" title="" />}><Button to="/scan">Scan a leaf</Button></EmptyState>}
        {!!queue.length && (
          <Card className="!bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="h3">{queue.length} in the queue · {labelled} confirmed</h2>
              {unlocked && <Button variant="secondary" loading={zipping} disabled={!labelled} onClick={download} className="!text-sm"><Download className="h-4 w-4" aria-hidden />Download labelled data</Button>}
            </div>
            <ul className="mt-3">
              {queue.map((it) => <QueueRow key={it.row.id} item={it} scans={scans ?? []} onOpen={() => (unlocked ? review(it) : toast(GOOGLE_CLIENT_ID ? "Sign in as admin to review." : "Enter the passcode to review."))} />)}
            </ul>
          </Card>
        )}
      </div>

      <BottomSheet open={!!open} onClose={() => setOpen(null)} title="Review">
        {open && (
          <div className="space-y-4">
            <img src={url} alt="Leaf photo under review" className="w-full rounded-card" />
            <div>
              <h3 className="text-sm font-semibold text-forest">Model answer</h3>
              {openTop ? <p>{disease(openTop.name)} ({Math.round(openTop.p * 100)}%)</p> : <p className="small">No model answer.</p>}
              {open.kind === "scan" && <ul className="small mt-1">{open.row.prediction.top3.slice(1).map((g) => <li key={g.label}>{disease(g.name)} ({Math.round(g.p * 100)}%)</li>)}</ul>}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-forest">Photo checks</h3>
              <p className="small">Sharpness {open.row.coach.sharpness.value} · Light {open.row.coach.light.value} · Leaf in frame {open.row.coach.leafInFrame.value}%{open.row.usedAnyway ? " · Used anyway" : ""}</p>
            </div>
            {open.kind === "visit" && open.row.compare && (
              <div>
                <h3 className="text-sm font-semibold text-forest">Compare result</h3>
                <div className="mt-1"><StatusChip status={open.row.compare.status} /></div>
                <p className="small mt-1">New spots: {open.row.compare.newSpots} · New holes: {open.row.compare.newHoles} · Affected: {open.row.compare.affectedOldPct}% → {open.row.compare.affectedNewPct}%</p>
              </div>
            )}
            <label className="block"><span className="field-label">Correct class</span>
              <select className="field-input" value={label} onChange={(e) => setLabel(e.target.value)}>
                <option value="">Choose</option>
                {labels.map((l) => <option key={l.label} value={l.name}>{disease(l.name)}</option>)}
                <option value={OTHER}>{OTHER}</option>
              </select>
            </label>
            <label className="block"><span className="field-label">Note</span>
              <textarea rows={2} className="field-input" value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            <Button disabled={!label} onClick={save}>Save expert label</Button>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
