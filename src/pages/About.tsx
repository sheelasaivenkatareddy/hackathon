import { PHOTO_CREDIT, REFERENCES } from "../components/Footer";
import { Card } from "../components/ui";
import { CONFIG } from "../config";

const STEPS = [
  ["Photo Coach", "Before any answer, the app measures sharpness, light and how much of the photo is leaf. A bad photo gets a retake request."],
  ["Lining up two visits", "The new photo is lined up with the last one using image features. If they cannot be lined up, the app says so and asks for a retake."],
  ["Finding new damage", "Colour rules find spots and holes on the leaf. Anything that was not there in the last photo is ringed. This part does not use the AI model."],
  ["Naming the problem", "A free DINOv2 model runs in the browser. Its last layer was retrained on field photos, because off-the-shelf models trained on lab photos did poorly in the field. It gives its top 3 answers with confidence. If it is unsure, it says so."],
  ["When to check", "Open-Meteo weather and nearby confirmed reports go through simple, visible rules. The score sets how often to check: every " + `${CONFIG.risk.scoutEveryDays.high}, ${CONFIG.risk.scoutEveryDays.medium} or ${CONFIG.risk.scoutEveryDays.low} days.`],
  ["Warning neighbours", "With consent, confirmed cases are shared as a rounded 1 km area. An unusual rise in an area triggers an alert."],
];
const HONEST = [
  "Patra Lens never names pesticides or doses. It tells you what to check and who to ask.",
  "Location is shared only if you turn it on, and only as an approximate 1 km area.",
  "Risk scores are estimates from weather and reports, not predictions.",
  "Sample, demo and synthetic items always carry a visible chip.",
  "This is a hackathon prototype. It has not been validated on local farms.",
];
const pct = (v: number | null) => (v === null ? null : `${Math.round(v * 100)}%`);
const METRICS: [string, string | number | null][] = [
  ["Field photo accuracy (top answer)", pct(CONFIG.measured.fieldAccuracy)],
  ["Field photo accuracy (top 3)", pct(CONFIG.measured.fieldTop3)],
  ["Tomato field photos only", pct(CONFIG.measured.tomatoFieldAccuracy)],
  ["Field photo macro F1", pct(CONFIG.measured.fieldMacroF1)],
  ["Lab photo macro F1", CONFIG.measured.labMacroF1],
  ["Lab-to-field gap", CONFIG.measured.labToFieldGap],
  ["Calibration error (ECE)", CONFIG.measured.eceAfterCalibration],
  ["Seconds per photo (laptop)", CONFIG.measured.secondsPerPhoto],
];

export default function About() {
  return (
      <div className="wrap max-w-3xl space-y-6 py-8 md:py-12">
        <h1 className="page-title">About Patra Lens</h1>
        <p>Patra Lens is a prototype for Chip to Crop 2026 by Team Smart Revolution. “Patra” means leaf.</p>
        <Card className="!bg-white">
          <h2 className="h3">How it works</h2>
          <ol className="mt-3 space-y-3">
            {STEPS.map(([t, d], i) => <li key={t} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-forest text-sm font-bold text-white">{i + 1}</span><span><strong className="text-forest">{t}.</strong> {d}</span></li>)}
          </ol>
        </Card>
        <Card className="!bg-white">
          <h2 className="h3">Honesty</h2>
          <ul className="mt-2 list-inside list-disc space-y-1">{HONEST.map((h) => <li key={h}>{h}</li>)}</ul>
        </Card>
        <Card className="!bg-white">
          <h2 className="h3">Measured results</h2>
          <dl className="mt-2 text-sm">
            {METRICS.map(([k, v]) => <div key={k} className="flex justify-between gap-4 border-t border-line py-1.5"><dt className="text-muted">{k}</dt><dd className="font-semibold text-forest">{v ?? "To be measured"}</dd></div>)}
          </dl>
        </Card>
        <Card className="!bg-white">
          <h2 className="h3">References</h2>
          <ul className="mt-2 space-y-1">{REFERENCES.map(([n, h]) => <li key={h}><a className="text-green-dark underline" href={h} target="_blank" rel="noreferrer">{n}</a></li>)}</ul>
        </Card>
        <Card className="!bg-white">
          <h2 className="h3">Credits</h2>
          <p className="mt-2 text-sm">{PHOTO_CREDIT}</p>
          <p className="mt-2 text-sm">Weather data by Open-Meteo.com (CC BY 4.0). Map data © OpenStreetMap contributors.</p>
          <p className="mt-2 text-sm">AI model: <a className="text-green-dark underline" href="https://huggingface.co/rodynaemad/plant-disease-dinov2-small" target="_blank" rel="noreferrer">plant-disease-dinov2-small</a> by rodynaemad (CC BY-SA 4.0), built on DINOv2 by Meta. Its last layer was retrained by Team Smart Revolution on the PlantDoc dataset. The retrained layer is shared under the same licence.</p>
        </Card>
      </div>
  );
}
