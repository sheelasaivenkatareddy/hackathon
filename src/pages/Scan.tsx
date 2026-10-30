// Scan a leaf: capture -> Photo Coach -> diagnosis. Scans are saved so unsure cases reach the expert queue.
import { CheckCircle2, Plus, RotateCcw, Save, UserCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DiagnosisResult from "../components/DiagnosisResult";
import { AcceptedPhoto, PhotoFlow } from "../components/PhotoFlow";
import { BottomSheet, Button, Chip, ModelStatusChip, useToast } from "../components/ui";
import ScanningPhoto from "../components/viz/ScanningPhoto";
import { Diagnosis, PLANTS, diagnose, modelStatus } from "../lib/diagnose";
import { Scan as ScanRow, db, getSetting, uid, useLive } from "../lib/db";
import { useI18n } from "../lib/i18n";
import type { Mode } from "../lib/model";
import { shrinkForStorage } from "../lib/vision/browser";
import { saveVisit } from "../lib/watch";

export default function Scan() {
  const { t } = useI18n();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>("demo");
  const [accepted, setAccepted] = useState<AcceptedPhoto | null>(null);
  const [diag, setDiag] = useState<Diagnosis | null>(null);
  const [scanId, setScanId] = useState<string | null>(null);
  const [flowKey, setFlowKey] = useState(0);
  const [sheet, setSheet] = useState<null | "save" | "sentinel">(null);
  const [fieldId, setFieldId] = useState("");
  const [plantId, setPlantId] = useState("");
  const scan = useLive(async () => (scanId ? db.scans.get(scanId) : undefined), [scanId]);
  const fields = useLive(() => db.fields.toArray(), []);
  const plants = useLive(() => (fieldId ? db.plants.where("fieldId").equals(fieldId).toArray() : Promise.resolve([])), [fieldId]);

  useEffect(() => { modelStatus().then(setMode); }, []);

  const onAccepted = async (a: AcceptedPhoto) => {
    setAccepted(a);
    const d = await diagnose(a.photo, a.work, a.coach, a.usedAnyway, a.sampleFile);
    setDiag(d);
    setMode(d.prediction.mode);
    const row: ScanRow = {
      id: uid(), date: new Date().toISOString(), photo: a.photo, thumb: await shrinkForStorage(a.photo, 256, 0.72), coach: a.coach,
      usedAnyway: a.usedAnyway, sampleFile: a.sampleFile, level: d.level, confirmed: false,
      prediction: { mode: d.prediction.mode, top3: d.prediction.top3, modelVersion: d.prediction.modelVersion },
    };
    await db.scans.put(row);
    setScanId(row.id);
  };

  const again = () => { setAccepted(null); setDiag(null); setScanId(null); setFlowKey((k) => k + 1); };

  const confirm = async () => {
    if (!scan) return;
    const top = scan.prediction.top3[0];
    const field = scan.fieldId ? await db.fields.get(scan.fieldId) : undefined;
    const consent = await getSetting<string | null>("radarCell", null);
    const cell = field?.cellId ?? consent ?? undefined;
    await db.scans.update(scan.id, { confirmed: true, cellId: cell });
    if (cell && top && !top.name.endsWith("Healthy")) {
      await db.reports.put({ id: `scan-${scan.id}`, cell, disease: top.name, date: new Date().toISOString(), confirmed: true, source: "mine" });
      toast("Confirmed. Added to the radar for your approximate area.");
    } else toast(cell ? "Confirmed." : "Confirmed. Turn on area sharing in Radar to add reports.");
  };

  const saveToField = async () => {
    if (!scan || !fieldId) return;
    await db.scans.update(scan.id, { fieldId, plantId: plantId || undefined });
    setSheet(null); toast("Saved to field.");
  };
  const addSentinel = async () => {
    if (!scan || !fieldId || !accepted) return;
    const count = await db.plants.where("fieldId").equals(fieldId).count();
    const id = uid();
    await db.plants.put({ id, fieldId, name: `Plant ${count + 1}`, order: count, createdAt: new Date().toISOString() });
    await saveVisit({ plantId: id, date: new Date().toISOString(), photo: accepted.photo, work: accepted.work, coach: accepted.coach, usedAnyway: accepted.usedAnyway });
    await db.scans.update(scan.id, { fieldId, plantId: id });
    setSheet(null); toast(`Added as Plant ${count + 1}. This photo is its first visit.`);
  };

  const canConfirm = diag && (diag.level === "CLEAR" || diag.level === "CHECK");

  return (
    <div className="wrap py-8 md:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Scan a leaf</h1>
        <ModelStatusChip mode={mode} />
      </div>

      {!accepted && (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-forest">Plants:</span>
            {PLANTS.map((p) => <Chip key={p} tone={p === "Tomato" ? "green" : "muted"}>{p}</Chip>)}
          </div>
          <div className="mt-5"><PhotoFlow key={flowKey} hint={t("scan.fillFrame")} showSamples onAccepted={onAccepted} /></div>
        </>
      )}

      {accepted && !diag && <div className="mt-6"><ScanningPhoto url={accepted.url} steps={["Getting the AI ready on your phone…", "Looking at the leaf…", "Comparing with known plant problems…", "Working out how sure it is…"]} /></div>}

      {accepted && diag && (
        <div className="mt-6">
          <DiagnosisResult url={accepted.url} diagnosis={diag} lowReliability={accepted.usedAnyway} hideModelChip />
          <p className="small mt-3">Photo checks: Sharpness {Math.round(accepted.coach.sharpness.value)} · Light {Math.round(accepted.coach.light.value)} · Leaf in frame {Math.round(accepted.coach.leafInFrame.value)}%</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {canConfirm && <Button onClick={confirm} disabled={!scan || scan.confirmed}><CheckCircle2 className="h-5 w-5" aria-hidden />{scan?.confirmed ? "Confirmed" : "Confirm"}</Button>}
            <Button variant="secondary" onClick={async () => { if (scan) { await db.scans.update(scan.id, { askedExpert: true }); toast("Sent to the expert queue."); } }} disabled={!scan || scan.askedExpert}><UserCheck className="h-5 w-5" aria-hidden />{t("expert.ask")}</Button>
            <Button variant="secondary" onClick={() => setSheet("save")} disabled={!scan}><Save className="h-5 w-5" aria-hidden />Save to field</Button>
            <Button variant="secondary" onClick={() => setSheet("sentinel")} disabled={!scan}><Plus className="h-5 w-5" aria-hidden />Add as sentinel plant</Button>
            <Button variant="ghost" onClick={again}><RotateCcw className="h-5 w-5" aria-hidden />Scan another</Button>
          </div>
          {canConfirm && <p className="tiny mt-2">Only confirmed scans become radar reports and count as nearby reports for risk.</p>}
        </div>
      )}

      <BottomSheet open={!!sheet} onClose={() => setSheet(null)} title={sheet === "save" ? "Save to field" : "Add as sentinel plant"}>
        {!fields?.length ? (
          <div><p className="mb-3">You have no fields yet.</p><Button to="/watch/new">Set up your first field</Button></div>
        ) : (
          <div className="space-y-3">
            <label className="block"><span className="field-label">Field</span>
              <select className="field-input" value={fieldId} onChange={(e) => { setFieldId(e.target.value); setPlantId(""); }}>
                <option value="">Choose a field</option>
                {fields.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </label>
            {sheet === "save" && (
              <label className="block"><span className="field-label">Plant (optional)</span>
                <select className="field-input" value={plantId} onChange={(e) => setPlantId(e.target.value)} disabled={!fieldId}>
                  <option value="">No plant</option>
                  {plants?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
            )}
            <Button disabled={!fieldId} onClick={sheet === "save" ? saveToField : addSentinel}>{sheet === "save" ? "Save" : "Add plant"}</Button>
          </div>
        )}
      </BottomSheet>

      {!accepted && <p className="tiny mt-8">Unsure answers go to the <Link to="/expert" className="underline">expert queue</Link>.</p>}
    </div>
  );
}
