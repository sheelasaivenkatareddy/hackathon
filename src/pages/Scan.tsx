// Scan a leaf: capture -> Photo Coach -> diagnosis. Scans are saved so unsure cases reach the expert queue.
import { isOnlineMode } from "../lib/mode";
import { CheckCircle2, Plus, RotateCcw, Save, UserCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DiagnosisResult from "../components/DiagnosisResult";
import { SymptomChecklist } from "../components/Guidance";
import AccuracyPanel from "../components/AccuracyPanel";
import LeafReport from "../components/LeafReport";
import { LiveConditions, ScanReport, SummaryBar, humanSummary } from "../components/ScanInsights";
import { AcceptedPhoto, PhotoFlow } from "../components/PhotoFlow";
import { BottomSheet, Button, Chip, ModelStatusChip, useToast } from "../components/ui";
import ScanningPhoto from "../components/viz/ScanningPhoto";
import { shareScanWithAgent } from "../lib/agent";
import { localResult } from "../lib/careplan";
import { LeafResult, Profile, analyzeInCloud, cloudConfigured, getProfile, saveProfile, saveToCloud } from "../lib/cloud";
import { Diagnosis, PLANTS, diagnose, modelStatus } from "../lib/diagnose";
import { Scan as ScanRow, db, getSetting, uid, useLive } from "../lib/db";
import { useI18n } from "../lib/i18n";
import type { Mode } from "../lib/model";
import { fertilizerAdvice, outlookFor } from "../lib/nutrition";
import { shrinkForStorage } from "../lib/vision/browser";
import { leafMasks } from "../lib/vision/masks";
import { photoKind, spotRegions } from "../lib/vision/regions";
import { saveVisit } from "../lib/watch";

function ProfileCard() {
  const [p, setP] = useState<Profile | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => { getProfile().then((v) => { setP(v); setSaved(!!v.name); }); }, []);
  if (!p || saved) return null;
  const field = (k: keyof Profile, label: string, type = "text") => (
    <label className="block flex-1"><span className="field-label">{label}</span>
      <input className="field-input" type={type} value={p[k]} onChange={(e) => setP({ ...p, [k]: e.target.value })} />
    </label>
  );
  return (
    <form className="mt-5 rounded-card border border-line bg-white p-4" onSubmit={async (e) => { e.preventDefault(); await saveProfile(p); setSaved(true); }}>
      <p className="font-semibold text-forest">Tell us who you are (optional)</p>
      <p className="small">Your name and village are saved with your scans so an expert can follow up.</p>
      <div className="mt-3 flex flex-col gap-3 md:flex-row">{field("name", "Name")}{field("phone", "Phone", "tel")}{field("village", "Village")}</div>
      <Button type="submit" className="mt-3" disabled={!p.name.trim()}>Save</Button>
    </form>
  );
}

const greeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };

export default function Scan() {
  const { t, disease } = useI18n();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>("demo");
  const [accepted, setAccepted] = useState<AcceptedPhoto | null>(null);
  const [diag, setDiag] = useState<Diagnosis | null>(null);
  const [report, setReport] = useState<{ result: LeafResult; source: "ai-vision" | "on-device" } | null>(null);
  const [cloudNote, setCloudNote] = useState("");
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
    setCloudNote("");
    const started = performance.now();
    const cloud = cloudConfigured && isOnlineMode() ? analyzeInCloud(a.photo) : null;
    const d = await diagnose(a.photo, a.work, a.coach, a.usedAnyway, a.sampleFile);
    const seconds = (performance.now() - started) / 1000;
    const affectedPct = leafMasks(a.work).affectedPct;
    const local = localResult(d, photoKind(a.work), spotRegions(a.work));
    const ai = cloud ? await cloud : null;
    shareScanWithAgent(ai?.ok ? ai.result : local);
    if (ai?.ok) setReport({ result: ai.result, source: "ai-vision" });
    else {
      setReport({ result: local, source: "on-device" });
      if (ai && ai.code !== "off") {
        // AI vision is not set up or did not answer: still save the phone's own answer for the admin.
        const saved = ai.code === "limit" ? ai : await saveToCloud(a.photo, local);
        setCloudNote(saved.ok ? "" : saved.message);
      }
    }
    setDiag(d);
    setMode(d.prediction.mode);
    const row: ScanRow = {
      id: uid(), date: new Date().toISOString(), photo: a.photo, thumb: await shrinkForStorage(a.photo, 256, 0.72), coach: a.coach,
      usedAnyway: a.usedAnyway, sampleFile: a.sampleFile, level: d.level, confirmed: false, seconds, affectedPct,
      prediction: { mode: d.prediction.mode, top3: d.prediction.top3, modelVersion: d.prediction.modelVersion },
    };
    await db.scans.put(row);
    setScanId(row.id);
  };

  const again = () => { setAccepted(null); setDiag(null); setReport(null); setScanId(null); setFlowKey((k) => k + 1); };

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

  const summary = diag ? humanSummary(diag.prediction.top3[0], diag.prediction.top3[1], diag.level, disease) : "";
  const sendFeedback = async (f: "right" | "wrong") => {
    if (!scan) return;
    await db.scans.update(scan.id, f === "wrong" ? { feedback: f, askedExpert: true } : { feedback: f });
    toast(f === "wrong" ? "Thanks. I've sent this to the expert queue." : "Thanks for telling me.");
  };
  const reportText = () => {
    if (!diag || !accepted) return "";
    const top = diag.prediction.top3[0];
    const plan = fertilizerAdvice(top?.name, diag.level), outlook = outlookFor(top?.name, diag.level);
    return [
      "Patra Lens scan report", new Date().toLocaleString("en-GB"), "", summary, "",
      ...diag.prediction.top3.map((g) => `${disease(g.name)}: ${Math.round(g.p * 100)}%`), "",
      `Photo checks: sharpness ${Math.round(accepted.coach.sharpness.value)}, light ${Math.round(accepted.coach.light.value)}, leaf in frame ${Math.round(accepted.coach.leafInFrame.value)}%`, "",
      `Use this: ${plan.useThis}`, plan.headline, `Avoid: ${plan.avoid.join("; ")}`, "",
      `When will it go away? ${outlook.headline}`, ...outlook.steps.map((st) => `${st.when}: ${st.what}`), "",
      "Fertilizer supports the plant. It does not cure disease. Confirm with your KVK or a soil test.",
    ].join("\n");
  };

  const canConfirm = diag && (diag.level === "CLEAR" || diag.level === "CHECK");

  return (
    <div className="wrap py-8 md:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow">{greeting()}</p>
          <h1 className="page-title">Let's look at your leaf</h1>
        </div>
        <ModelStatusChip mode={mode} />
      </div>

      {!accepted && (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-forest">Plants:</span>
            {PLANTS.map((p) => <Chip key={p} tone={p === "Tomato" ? "green" : "muted"}>{p}</Chip>)}
          </div>
          {cloudConfigured && <ProfileCard />}
          <div className="mt-5"><PhotoFlow key={flowKey} hint={t("scan.fillFrame")} showSamples acceptNonLeaf onAccepted={onAccepted} /></div>
          {cloudConfigured && <p className="tiny mt-3">Your photo and its result are saved to the Patra Lens database, so our team can check answers and help farmers nearby.</p>}
        </>
      )}

      {accepted && !diag && <div className="mt-6"><ScanningPhoto url={accepted.url} steps={["Getting the AI ready…", "Checking what is in the photo…", "Finding the problem spots…", "Writing your care plan…"]} /></div>}

      {accepted && diag && report && (
        <div className="mt-6">
          {report.result.is_plant && report.result.subject !== "flower" && (
            <div className="mb-5">
              <SummaryBar text={report.source === "ai-vision" ? report.result.languages.en.reason : summary} report={reportText()} feedback={scan?.feedback} onFeedback={sendFeedback} />
            </div>
          )}
          {cloudNote && <p role="note" className="mb-4 rounded-xl bg-amber-tint px-4 py-3 text-sm font-semibold text-amber-dark">Not saved online: {cloudNote}</p>}
          <LeafReport url={accepted.url} result={report.result} source={report.source} />
          {report.result.subject === "leaf" && (
            <div className="mt-5 space-y-5">
              {report.source === "on-device" && <SymptomChecklist name={diag.prediction.top3[0]?.name} level={diag.level} />}
              <details className="rounded-card border border-line bg-white p-4 md:p-6">
                <summary className="cursor-pointer font-heading font-bold text-forest">How the on-device AI saw it</summary>
                <div className="mt-4"><DiagnosisResult url={accepted.url} diagnosis={diag} lowReliability={accepted.usedAnyway} hideModelChip /></div>
              </details>
              <ScanReport top={diag.prediction.top3[0]} level={diag.level} mode={diag.prediction.mode} coach={accepted.coach} affectedPct={scan?.affectedPct} seconds={scan?.seconds} />
              <LiveConditions />
            </div>
          )}
          <div className="mt-5"><AccuracyPanel /></div>
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
