// Disease library: every condition the AI knows, with its measured accuracy, plan and a short description.
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ExternalLink, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button, Chip, Skeleton } from "../components/ui";
import { loadWikiSummary } from "../lib/conditions";
import { FieldHead, FieldReport, PLANTS, getFieldHead, getFieldReport } from "../lib/diagnose";
import { useI18n } from "../lib/i18n";
import type { Label } from "../lib/model";
import { fertilizerAdvice, outlookFor } from "../lib/nutrition";

function Details({ name, stat }: { name: string; stat?: { photos: number; right: number } }) {
  const [wiki, setWiki] = useState<{ text: string; url: string } | null | "loading">("loading");
  useEffect(() => { loadWikiSummary(name).then(setWiki).catch(() => setWiki(null)); }, [name]);
  const a = fertilizerAdvice(name, "CLEAR"), o = outlookFor(name, "CLEAR");
  return (
    <div className="space-y-3 pb-4" data-testid="disease-details">
      {wiki === "loading" && <Skeleton className="h-16" />}
      {wiki && wiki !== "loading" && (
        <p data-testid="wiki-text">{wiki.text} <a href={wiki.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-green-dark underline">Wikipedia<ExternalLink className="h-3 w-3" aria-hidden /></a></p>
      )}
      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-surface p-3"><dt className="tiny font-semibold">AI test result</dt><dd className="mt-1 font-semibold text-forest">{stat ? `${stat.right} of ${stat.photos} field photos right` : "Not measured"}</dd></div>
        <div className="rounded-xl bg-surface p-3"><dt className="tiny font-semibold">Fertilizer</dt><dd className="mt-1 font-semibold text-forest">{a.useThis}</dd></div>
        <div className="rounded-xl bg-surface p-3"><dt className="tiny font-semibold">What to expect</dt><dd className="mt-1 font-semibold text-forest">{o.headline}</dd></div>
      </dl>
    </div>
  );
}

export default function Diseases() {
  const { disease } = useI18n();
  const [head, setHead] = useState<FieldHead | null>(null);
  const [report, setReport] = useState<FieldReport | null>(null);
  const [query, setQuery] = useState("");
  const [plant, setPlant] = useState("All");
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { getFieldHead().then(setHead); getFieldReport().then(setReport); }, []);

  const labels = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ((head?.labels ?? []) as (Label & { plant?: string })[])
      .filter((l) => (plant === "All" || l.plant === plant) && (!q || disease(l.name).toLowerCase().includes(q) || (l.plant ?? "").toLowerCase().includes(q)))
      .sort((a, b) => Number(a.name.endsWith("Healthy")) - Number(b.name.endsWith("Healthy")) || disease(a.name).localeCompare(disease(b.name)));
  }, [head, query, plant, disease]);

  return (
    <div className="wrap max-w-4xl py-8 md:py-12">
      <h1 className="page-title">Disease library</h1>
      <p className="small mt-1">Everything the AI can recognise, and how it did on real field photos.</p>
      <label className="relative mt-5 block">
        <span className="sr-only">Search diseases</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        <input className="field-input !pl-9" placeholder="Search, for example blight" value={query} onChange={(e) => setQuery(e.target.value)} data-testid="disease-search" />
      </label>
      <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-2 md:mx-0 md:flex-wrap md:px-0" role="group" aria-label="Filter by plant">
        {["All", ...PLANTS].map((p) => (
          <motion.button key={p} whileTap={{ scale: 0.94 }} onClick={() => setPlant(p)} aria-pressed={plant === p} className={`min-h-[40px] shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors ${plant === p ? "border-green bg-green text-white" : "border-line bg-white text-forest hover:border-green"}`}>{p}</motion.button>
        ))}
      </div>
      {!head && <Skeleton className="mt-4 h-64" />}
      <p className="small mt-3" aria-live="polite" data-testid="disease-count">{head ? `${labels.length} of ${head.labels.length} conditions` : ""}</p>
      <ul className="mt-2 border-b border-line" data-testid="disease-list">
        {labels.map((l) => {
          const isOpen = open === l.name, stat = report?.conditions[l.name];
          return (
            <li key={l.label} className="border-t border-line">
              <button onClick={() => setOpen(isOpen ? null : l.name)} aria-expanded={isOpen} className="flex min-h-[56px] w-full items-center justify-between gap-3 py-2 text-left">
                <span className="font-heading font-bold text-forest">{disease(l.name)}</span>
                <span className="flex shrink-0 items-center gap-2">
                  {l.name.endsWith("Healthy") && <Chip tone="green">Healthy</Chip>}
                  <motion.span animate={{ rotate: isOpen ? 180 : 0 }}><ChevronDown className="h-5 w-5 text-muted" aria-hidden /></motion.span>
                </span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden"><Details name={l.name} stat={stat} /></motion.div>}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>
      <div className="mt-6"><Button to="/scan">Scan a leaf</Button></div>
    </div>
  );
}
