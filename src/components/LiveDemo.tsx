// A real diagnosis on the home page: pick an example leaf, and the same on-device AI used in the app answers.
import { motion } from "framer-motion";
import { ArrowRight, Loader2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { diagnose } from "../lib/diagnose";
import { useI18n } from "../lib/i18n";
import { loadWorkImage } from "../lib/vision/browser";
import { photoCoach } from "../lib/vision/coach";
import type { Diagnosis } from "../lib/diagnose";
import { humanSummary } from "./ScanInsights";
import { Button, Chip, CountUp } from "./ui";

const EXAMPLES = [
  { file: "early-blight-field.jpg", label: "Spotted leaf", alt: "A tomato leaf with brown spots and yellowing" },
  { file: "septoria-closeup.jpg", label: "Small spots", alt: "A tomato leaf covered in small round spots" },
  { file: "healthy-leaf.jpg", label: "Healthy leaf", alt: "A healthy green tomato leaf" },
];

export default function LiveDemo() {
  const { disease } = useI18n();
  const [file, setFile] = useState<string | null>(null);
  const [result, setResult] = useState<Diagnosis | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async (f: string) => {
    setFile(f); setResult(null); setError(""); setBusy(true);
    try {
      const blob = await (await fetch(`/samples/${f}`)).blob();
      const work = await loadWorkImage(blob);
      setResult(await diagnose(blob, work, photoCoach(work), false, f));
    } catch (e) {
      console.warn(e);
      setError("The AI could not run here. Try the Scan page instead.");
    } finally { setBusy(false); }
  };
  const top = result?.prediction.top3[0];

  return (
    <div className="grid items-start gap-6 lg:grid-cols-2" data-testid="live-demo">
      <div>
        <ul className="grid grid-cols-3 gap-3" aria-label="Example leaves">
          {EXAMPLES.map((e) => (
            <li key={e.file}>
              <motion.button whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }} onClick={() => run(e.file)} aria-pressed={file === e.file} data-demo={e.file} className={`block w-full overflow-hidden rounded-xl border-2 bg-white text-left ${file === e.file ? "border-green" : "border-line"}`}>
                <img src={`/samples/${e.file}`} alt={e.alt} loading="lazy" className="aspect-square w-full object-cover" />
                <span className="block px-2 py-1.5 text-sm font-semibold text-forest">{e.label}</span>
              </motion.button>
            </li>
          ))}
        </ul>
        <p className="small mt-3">Example photos. Tap one and the AI runs right here, on your device.</p>
      </div>
      <div className="min-h-[220px] rounded-card border border-line bg-white p-5 shadow-soft" aria-live="polite">
        {!file && <p className="text-muted">Pick a leaf to see an answer.</p>}
        {busy && <p className="flex items-center gap-2 font-semibold text-forest" role="status"><Loader2 className="h-5 w-5 animate-spin" aria-hidden />Looking at the leaf…</p>}
        {error && <p role="alert" className="font-semibold text-tomato-dark">{error}</p>}
        {result && top && (
          <div data-testid="demo-result">
            <Chip tone={result.level === "CLEAR" ? "green" : "amber"}>{result.level === "CLEAR" ? "One answer stands out" : result.level === "CHECK" ? "Two answers are close" : "Not sure"}</Chip>
            <p className="mt-2 font-heading text-2xl font-extrabold text-forest">{disease(top.name)}</p>
            <p className="mt-1">{humanSummary(top, result.prediction.top3[1], result.level, disease)}</p>
            <ul className="mt-3 space-y-2">
              {result.prediction.top3.map((g, i) => (
                <li key={g.label}>
                  <div className="flex justify-between text-sm font-semibold text-forest"><span>{disease(g.name)}</span><span><CountUp to={g.p * 100} suffix="%" /></span></div>
                  <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-surface" aria-hidden><motion.div className={`h-full rounded-full ${i === 0 ? "bg-green" : "bg-muted/40"}`} initial={{ width: 0 }} animate={{ width: `${g.p * 100}%` }} transition={{ type: "spring", stiffness: 70, damping: 16, delay: i * 0.08 }} /></div>
                </li>
              ))}
            </ul>
            <Button to="/scan" className="mt-4">Scan your own leaf<ArrowRight className="h-4 w-4" aria-hidden /></Button>
          </div>
        )}
        {result && !top && <p>The AI isn't available here. <Link className="font-semibold text-green-dark underline" to="/scan">Open the Scan page</Link>.</p>}
      </div>
    </div>
  );
}
