// Language, model status, thresholds (read only), data export/import and reset.
import { Download, Trash2, Upload, WifiOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { LanguageSwitch } from "../app/Layout";
import { BottomSheet, Button, Card, ModelStatusChip, useToast } from "../components/ui";
import { CONFIG } from "../config";
import { modelStatus } from "../lib/diagnose";
import { cacheOfflinePack } from "../lib/offline";
import { deleteAllData, exportAll, importAll, resetDemoData } from "../lib/db";
import { downloadBlob } from "../lib/ics";
import type { Mode } from "../lib/model";

const THRESHOLDS: [string, [string, unknown][]][] = [
  ["Photo Coach", [
    ["Minimum sharpness", CONFIG.coach.minSharpness],
    ["Light range (mean luma)", `${CONFIG.coach.minLuma}–${CONFIG.coach.maxLuma}`],
    ["Maximum over-exposed", `${CONFIG.coach.maxOverexposedPct}%`],
    ["Minimum leaf in frame", `${CONFIG.coach.minLeafPct}%`],
  ]],
  ["Leaf Watch", [
    ["Spreading from new marks", CONFIG.compare.spreadingNewCount],
    ["Change that counts (points per 3 days)", CONFIG.compare.changePointsPer3Days],
    ["Alignment good / fair (leaf overlap)", `${CONFIG.compare.alignGood} / ${CONFIG.compare.alignFair}`],
  ]],
  ["Diagnosis", [
    ["\"Not sure\" below", CONFIG.diagnosis.expertBelow],
    ["\"Check both\" when the gap is below", CONFIG.diagnosis.checkGapBelow],
    ["High / medium confidence from", `${CONFIG.diagnosis.highFrom} / ${CONFIG.diagnosis.mediumFrom}`],
  ]],
  ["Risk", [
    ["Medium / high from", `${CONFIG.risk.levels.mediumFrom} / ${CONFIG.risk.levels.highFrom}`],
    ["Check every (low / medium / high)", `${CONFIG.risk.scoutEveryDays.low} / ${CONFIG.risk.scoutEveryDays.medium} / ${CONFIG.risk.scoutEveryDays.high} days`],
    ["Nearby reports needed", CONFIG.risk.nearbyMinReports],
  ]],
  ["Radar", [
    ["Cell size", `${CONFIG.radar.cellDeg}° (about 1 km)`],
    ["Show a number from", `${CONFIG.radar.minReportsToShowNumber} reports`],
    ["Unusual rise", `at least ${CONFIG.radar.riseMinThisWeek} reports and ${CONFIG.radar.riseFactor}× the average of the previous ${CONFIG.radar.previousWeeks} weeks`],
  ]],
];

export default function Settings() {
  const toast = useToast();
  const [mode, setMode] = useState<Mode>("demo");
  const [ask, setAsk] = useState<null | "demo" | "all">(null);
  const [offline, setOffline] = useState<"" | "busy" | "done">("");
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => { modelStatus().then(setMode); }, []);

  const doExport = async () => { downloadBlob(await exportAll(), `patra-lens-data-${new Date().toISOString().slice(0, 10)}.json`); };
  const doImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try { const n = await importAll(f); toast(`Imported ${n} records.`); }
    catch (err) { toast(err instanceof Error ? err.message : "That file could not be imported."); }
  };
  const prepareOffline = async () => {
    setOffline("busy");
    // Each file is saved and checked, so "Ready" is only shown when everything is really stored.
    const missing = await cacheOfflinePack();
    if (missing) { setOffline(""); toast(`${missing} files could not be saved. Check your connection and try again.`); return; }
    setOffline("done");
  };

  return (
    <div className="wrap max-w-3xl space-y-5 py-8 md:py-12">
      <h1 className="page-title">Settings</h1>
      <Card className="!bg-white">
        <h2 className="h3">Language</h2>
        <LanguageSwitch />
        <p className="small mt-1">Telugu and Kannada are drafts, checked by native speakers before release.</p>
      </Card>
      <Card className="!bg-white">
        <h2 className="h3">Model status</h2>
        <div className="mt-2"><ModelStatusChip mode={mode} /></div>
        <p className="small mt-2">{mode === "demo" ? "No trained model is connected. Sample photos show labelled demo results, and your own photos get photo checks only." : "The AI runs on this device when you scan a leaf. The first scan downloads about 23 MB."}</p>
      </Card>
      <Card className="!bg-white">
        <h2 className="h3">Your data</h2>
        <p className="small mt-1">Everything stays on this device unless you export it.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={doExport}><Download className="h-4 w-4" aria-hidden />Export all data</Button>
          <Button variant="secondary" onClick={() => file.current?.click()}><Upload className="h-4 w-4" aria-hidden />Import</Button>
          <input ref={file} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-hidden onChange={doImport} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
          <Button variant="secondary" onClick={() => setAsk("demo")}>Reset demo data</Button>
          <Button variant="danger" onClick={() => setAsk("all")}><Trash2 className="h-4 w-4" aria-hidden />Delete all my data</Button>
        </div>
      </Card>
      <Card className="!bg-white">
        <h2 className="h3">Use it offline</h2>
        <p className="small mt-1">Downloads the AI model (about 23 MB), the comparison engine (about 11 MB), the model runtime (about 15 MB) and the sample photos, so the demo works without internet. Use Wi-Fi.</p>
        <Button variant="secondary" className="mt-3" loading={offline === "busy"} disabled={offline === "done"} onClick={prepareOffline}><WifiOff className="h-4 w-4" aria-hidden />{offline === "done" ? "Ready for offline" : "Prepare for offline"}</Button>
      </Card>
      <Card className="!bg-white">
        <h2 className="h3">Thresholds (read only)</h2>
        <p className="small mt-1">To change them, edit src/config.ts.</p>
        {THRESHOLDS.map(([group, rows]) => (
          <div key={group} className="mt-4">
            <h3 className="text-sm font-semibold text-forest">{group}</h3>
            <dl className="mt-1 text-sm">
              {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-4 border-t border-line py-1.5"><dt className="text-muted">{k}</dt><dd className="text-right font-semibold text-forest">{String(v)}</dd></div>)}
            </dl>
          </div>
        ))}
      </Card>

      <BottomSheet open={!!ask} onClose={() => setAsk(null)} title={ask === "all" ? "Delete all your data?" : "Reset demo data?"}>
        <p>{ask === "all" ? "This deletes every field, plant, photo, scan and setting on this device. It cannot be undone. Export first if you want a copy." : "This removes the synthetic test pairs and scans of sample photos. Your own fields and photos stay."}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="danger" onClick={async () => { if (ask === "all") await deleteAllData(); else await resetDemoData(); setAsk(null); toast("Done."); }}>{ask === "all" ? "Delete everything" : "Reset"}</Button>
          <Button variant="secondary" onClick={() => setAsk(null)}>Cancel</Button>
        </div>
      </BottomSheet>
    </div>
  );
}
