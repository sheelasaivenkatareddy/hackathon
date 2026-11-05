// "How accurate is this AI?": accuracy, top-3, per-disease recall / precision and the confusion matrix,
// measured on held-out test photos (public/model/accuracy.json, made by ml/field-head/make_accuracy.py).
// Shown after a scan and on the open data page, for teachers, scientists and judges.
import { BarChart3 } from "lucide-react";
import { useEffect, useState } from "react";

interface PerClass { name: string; photos: number; recall: number; precision: number; f1: number }
interface SetReport {
  n: number; accuracy: number; top3: number; ci: [number, number]; macroF1: number; perClass: PerClass[];
  confusion?: { labels: string[]; columns: string[]; matrix: number[][] };
}
interface Accuracy { model: string; note: string; field: SetReport; fieldTomato: SetReport; closeup: SetReport; before: { field: number; closeup: number } }

const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;
let cache: Promise<Accuracy | null> | null = null;
const loadAccuracy = () => (cache ??= fetch("/model/accuracy.json").then((r) => (r.ok ? r.json() : null)).catch(() => null));

/** Rows = true disease, columns = what the AI said. Darker cyan = more photos; the diagonal is "right". */
function Confusion({ c, title }: { c: NonNullable<SetReport["confusion"]>; title: string }) {
  const max = Math.max(1, ...c.matrix.flat());
  return (
    <figure className="overflow-x-auto">
      <figcaption className="mb-2 text-sm font-semibold text-white">{title}</figcaption>
      <table className="border-separate border-spacing-[2px] text-center text-[11px]">
        <thead>
          <tr>
            <th className="p-1 text-left font-semibold text-slate-400">True ↓ / AI said →</th>
            {c.columns.map((h) => <th key={h} scope="col" className="w-16 p-1 align-bottom font-semibold leading-tight text-slate-300">{h}</th>)}
            <th scope="col" className="w-14 p-1 align-bottom font-semibold text-slate-300">Recall</th>
          </tr>
        </thead>
        <tbody>
          {c.matrix.map((row, i) => {
            const total = row.reduce((a, b) => a + b, 0);
            return (
              <tr key={c.labels[i]}>
                <th scope="row" className="whitespace-nowrap p-1 text-left font-semibold text-slate-200">{c.labels[i]}</th>
                {row.map((v, j) => {
                  const a = v / max;
                  const diag = c.columns[j] === c.labels[i];
                  return (
                    <td key={j} title={`${c.labels[i]} → ${c.columns[j]}: ${v} photos`}
                      className={`h-9 rounded-[4px] tabular-nums ${diag ? "font-bold" : ""}`}
                      style={{ background: v ? `rgba(34, 211, 238, ${0.12 + a * 0.78})` : "rgba(255,255,255,0.04)", color: a > 0.55 ? "#040A18" : "#E2E8F0", outline: diag ? "1px solid rgba(255,255,255,0.35)" : undefined }}>
                      {v}
                    </td>
                  );
                })}
                <td className="p-1 font-semibold tabular-nums text-white">{total ? pct(row[c.columns.indexOf(c.labels[i])] / total) : "–"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </figure>
  );
}

function PerClassTable({ rows, title }: { rows: PerClass[]; title: string }) {
  return (
    <div className="overflow-x-auto">
      <p className="mb-2 text-sm font-semibold text-white">{title}</p>
      <table className="w-full min-w-[380px] text-left text-xs">
        <thead><tr className="text-slate-400"><th className="py-1.5 pr-2">Disease</th><th className="pr-2 text-right">Test photos</th><th className="pr-2 text-right">Recall</th><th className="pr-2 text-right">Precision</th><th className="text-right">F1</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-t border-white/10">
              <td className="py-1.5 pr-2 font-semibold text-slate-100">{r.name}</td>
              <td className="pr-2 text-right tabular-nums text-slate-400">{r.photos}</td>
              <td className="pr-2 text-right tabular-nums text-white">{pct(r.recall)}</td>
              <td className="pr-2 text-right tabular-nums text-white">{pct(r.precision)}</td>
              <td className="text-right tabular-nums text-slate-300">{r.f1.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AccuracyPanel({ open = false }: { open?: boolean }) {
  const [a, setA] = useState<Accuracy | null>(null);
  useEffect(() => { loadAccuracy().then(setA); }, []);
  if (!a) return null;
  const tiles: [string, string, string][] = [
    ["Accuracy, close-up tomato photos", pct(a.closeup.accuracy), `${a.closeup.n} test photos · before retraining ${pct(a.before.closeup)}`],
    ["Accuracy, field photos (27 conditions)", pct(a.field.accuracy), `${a.field.n} photos · 95% range ${pct(a.field.ci[0])}–${pct(a.field.ci[1])}`],
    ["Right answer in the top 3, field", pct(a.field.top3), `macro F1 ${a.field.macroF1.toFixed(2)}`],
    ["Tomato field photos", pct(a.fieldTomato.accuracy), `${a.fieldTomato.n} photos: the hardest case`],
  ];
  return (
    <details open={open} className="lit rounded-2xl border border-white/10 bg-[#0D172B] p-4 text-slate-200 md:p-5">
      <summary className="flex cursor-pointer items-center gap-2 font-heading text-lg font-bold text-white">
        <BarChart3 className="h-5 w-5 text-[#22D3EE]" aria-hidden />How accurate is this AI? Accuracy, recall and confusion matrix
      </summary>
      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        {tiles.map(([l, v, sub]) => (
          <div key={l} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <p className="text-[11px] font-semibold text-slate-400">{l}</p>
            <p className="mt-1 font-heading text-2xl font-extrabold text-white">{v}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <PerClassTable rows={a.closeup.perClass} title="Per disease, close-up tomato photos" />
        <PerClassTable rows={a.fieldTomato.perClass} title="Per disease, tomato field photos" />
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        {a.closeup.confusion && <Confusion c={a.closeup.confusion} title={`Confusion matrix: close-up tomato photos (${a.closeup.n})`} />}
        {a.fieldTomato.confusion && <Confusion c={a.fieldTomato.confusion} title={`Confusion matrix: tomato field photos (${a.fieldTomato.n})`} />}
      </div>
      <p className="mt-4 text-xs text-slate-400">
        <strong className="text-slate-200">How to read it:</strong> recall = of the leaves that really had this disease, how many the AI found.
        Precision = when the AI named this disease, how often it was right. In the matrix, the outlined diagonal cells are correct answers.
      </p>
      <p className="mt-2 text-xs text-slate-500">{a.note} Model: {a.model}. Training data: PlantDoc (field) and a PlantVillage-style tomato set (close-up). An AI estimate, not a lab result.</p>
    </details>
  );
}
