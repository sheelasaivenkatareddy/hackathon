// Open data for scientists: every scan in the database, without anything that identifies a farmer
// (no name, phone, village, device or photo; location rounded to about 1 km). Read through the open_scan_data()
// database function, so the raw tables stay private. Charts, a data dictionary, the full table and a CSV download.
import { Database, Download, FlaskConical, Lock, RefreshCw } from "lucide-react";
import { Fragment, ReactNode, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { cloudConfigured, supabase } from "../lib/cloud";
import AccuracyPanel from "../components/AccuracyPanel";

interface Row {
  scanned_at: string; plant: string; is_tomato: boolean | null; disease: string; severity: string; confidence: number;
  ai_source: string; affected_areas: number; lat_1km: number | null; lon_1km: number | null; sent_to_lab: boolean;
}

const fmtDate = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
const SEV_ORDER = ["None", "Mild", "Moderate", "Severe"];
const problem = (r: Row) => r.disease !== "Healthy" && r.disease !== "Not a leaf" && r.disease !== "No leaf found";

function count<T extends string>(rows: Row[], key: (r: Row) => T) {
  const m = new Map<T, number>();
  rows.forEach((r) => m.set(key(r), (m.get(key(r)) ?? 0) + 1));
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

const Tile = ({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) => (
  <div className="rounded-card border border-line bg-white p-4">
    <p className="small">{label}</p>
    <p className="mt-1 font-heading text-3xl font-extrabold text-forest">{value}</p>
    {sub && <p className="tiny mt-1">{sub}</p>}
  </div>
);

/** One series, one hue: a ranked horizontal bar list. Hover (or focus) a bar for its exact value and share. */
function BarList({ title, data, total }: { title: string; data: [string, number][]; total: number }) {
  const max = Math.max(1, ...data.map((d) => d[1]));
  return (
    <section className="rounded-card border border-line bg-white p-4 md:p-5">
      <h3 className="h3">{title}</h3>
      <ul className="mt-3 space-y-2" aria-label={title}>
        {data.map(([k, v]) => (
          <li key={k} tabIndex={0} title={`${k}: ${v} scans (${Math.round((v / total) * 100)}%)`} className="group grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-green">
            <span className="truncate text-sm text-ink">{k}</span>
            <span className="h-3 rounded-[4px] bg-surface">
              <span className="block h-3 rounded-[4px] bg-green transition group-hover:brightness-125" style={{ width: `${(v / max) * 100}%` }} />
            </span>
            <span className="w-14 text-right text-sm tabular-nums text-muted">{v}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Scans per day for the last 14 days: one series, vertical bars, hover for the day's count. */
function PerDay({ rows }: { rows: Row[] }) {
  const days = useMemo(() => {
    const out: { key: string; label: string; n: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000);
      const key = d.toISOString().slice(0, 10);
      out.push({ key, label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), n: rows.filter((r) => r.scanned_at.slice(0, 10) === key).length });
    }
    return out;
  }, [rows]);
  const max = Math.max(1, ...days.map((d) => d.n));
  return (
    <section className="rounded-card border border-line bg-white p-4 md:p-5">
      <h3 className="h3">Scans per day, last 14 days</h3>
      <div className="mt-4 flex h-40 items-end gap-[2px]" role="img" aria-label={`Scans per day: ${days.map((d) => `${d.label} ${d.n}`).join(", ")}`}>
        {days.map((d) => (
          <div key={d.key} className="group relative flex h-full flex-1 flex-col justify-end" title={`${d.label}: ${d.n} scans`}>
            <div className="rounded-t-[4px] bg-green transition group-hover:brightness-125" style={{ height: `${(d.n / max) * 100}%`, minHeight: d.n ? 4 : 0 }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted"><span>{days[0]?.label}</span><span>{days[days.length - 1]?.label}</span></div>
    </section>
  );
}

const COLUMNS: { key: keyof Row; label: string; meaning: string }[] = [
  { key: "scanned_at", label: "Scanned at", meaning: "Date and time the photo was scanned (India time)." },
  { key: "plant", label: "Plant", meaning: "Plant the AI read from the photo (Claude vision, or the on-phone model's best guess)." },
  { key: "is_tomato", label: "Tomato", meaning: "Whether the plant was identified as tomato." },
  { key: "disease", label: "Diagnosis", meaning: "Most likely problem. 'Likely …' means the AI was not fully sure; 'Healthy' means no disease seen." },
  { key: "severity", label: "Severity", meaning: "None, Mild, Moderate or Severe, from the area of the leaf affected." },
  { key: "confidence", label: "Confidence", meaning: "The AI's own confidence, 0 to 1 (calibrated for the on-phone model)." },
  { key: "ai_source", label: "AI", meaning: "'ai-vision' = cloud AI looked at the photo; 'on-device' = the phone's own model (works offline)." },
  { key: "affected_areas", label: "Areas", meaning: "Number of diseased or dried areas circled on the leaf." },
  { key: "lat_1km", label: "Lat (~1 km)", meaning: "Latitude rounded to 2 decimals (about 1 km), or empty if not shared." },
  { key: "lon_1km", label: "Lon (~1 km)", meaning: "Longitude rounded to 2 decimals (about 1 km)." },
  { key: "sent_to_lab", label: "Sent to lab", meaning: "Whether the farmer forwarded this scan to a lab, KVK, RBK or officer." },
];

function toCsv(rows: Row[]) {
  const esc = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [COLUMNS.map((c) => c.key).join(","), ...rows.map((r) => COLUMNS.map((c) => esc(r[c.key])).join(","))].join("\n");
}

export default function OpenData() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState("");
  const [at, setAt] = useState<Date | null>(null);
  const [q, setQ] = useState("");

  const load = async () => {
    if (!supabase) return;
    setErr("");
    const { data, error } = await supabase.rpc("open_scan_data");
    if (error) { setErr(error.message); return; }
    setRows((data ?? []) as Row[]); setAt(new Date());
  };
  useEffect(() => { load(); }, []);

  const shown = useMemo(() => (rows ?? []).filter((r) => `${r.plant} ${r.disease} ${r.severity} ${r.ai_source}`.toLowerCase().includes(q.toLowerCase())), [rows, q]);
  const stats = useMemo(() => {
    const r = rows ?? [];
    const dates = r.map((x) => x.scanned_at).sort();
    return {
      total: r.length, problems: r.filter(problem).length, healthy: r.filter((x) => x.disease === "Healthy").length,
      lab: r.filter((x) => x.sent_to_lab).length, located: r.filter((x) => x.lat_1km != null).length,
      from: dates[0], to: dates[dates.length - 1],
      diseases: count(r.filter(problem), (x) => x.disease.replace(/ \(not fully sure\)$/, "")).slice(0, 8),
      plants: count(r, (x) => x.plant).slice(0, 8),
      severity: SEV_ORDER.map((s) => [s, r.filter((x) => x.severity === s).length] as [string, number]),
      ai: count(r, (x) => (x.ai_source === "ai-vision" ? "Cloud AI vision" : "On-phone model (offline)")),
    };
  }, [rows]);

  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([toCsv(rows ?? [])], { type: "text/csv" }));
    a.download = `patra-lens-open-data-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };

  if (!cloudConfigured) return <div className="wrap py-10"><h1 className="page-title">Open data</h1><p className="mt-3">The database is not connected.</p></div>;

  return (
    <div className="wrap py-8 md:py-12">
      {/* 1. What this is */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Open data · for scientists and labs</p>
          <h1 className="page-title">Every leaf scan, in one place</h1>
          <p className="mt-2 max-w-2xl text-muted">Live from the Patra Chain - Blockchain-based crop disease verification system database. Farmers' names, phone numbers, villages, devices and photos are not shown; locations are rounded to about 1 km.</p>
          {at && <p className="tiny mt-1">Updated {fmtDate(at.toISOString())}{stats.from ? ` · scans from ${fmtDate(stats.from)} to ${fmtDate(stats.to)}` : ""}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={load} className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-line bg-white px-4 font-semibold text-forest hover:bg-surface"><RefreshCw className="h-4 w-4" aria-hidden />Refresh</button>
          <button onClick={download} disabled={!rows?.length} className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-green px-4 font-semibold text-white disabled:opacity-50"><Download className="h-4 w-4" aria-hidden />Download CSV</button>
        </div>
      </header>

      {err && <p role="alert" className="mt-6 rounded-xl bg-tomato-tint p-4 font-semibold text-tomato-dark">Could not load the data: {err}</p>}
      {!rows && !err && <p className="mt-8" role="status">Loading the data…</p>}

      {rows && (
        <>
          {/* 2. Summary */}
          <section aria-label="Summary" className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-5">
            <Tile label="Scans" value={stats.total} />
            <Tile label="With a problem" value={stats.problems} sub={stats.total ? `${Math.round((stats.problems / stats.total) * 100)}% of scans` : undefined} />
            <Tile label="Healthy leaves" value={stats.healthy} />
            <Tile label="Sent to a lab" value={stats.lab} />
            <Tile label="With location" value={stats.located} sub="rounded to ~1 km" />
          </section>

          {/* 3. Charts */}
          <section aria-label="Charts" className="mt-6 grid gap-4 lg:grid-cols-2">
            <BarList title="Most common problems" data={stats.diseases} total={Math.max(1, stats.problems)} />
            <BarList title="Plants scanned" data={stats.plants} total={Math.max(1, stats.total)} />
            <BarList title="Severity" data={stats.severity} total={Math.max(1, stats.total)} />
            <PerDay rows={rows} />
          </section>
          <p className="tiny mt-2">How the AI answered: {stats.ai.map(([k, v]) => `${k} ${v}`).join(" · ")}. Hover a bar for the exact count and share.</p>

          <section aria-label="AI accuracy" className="mt-6"><AccuracyPanel open /></section>

          {/* 4. The records */}
          <section aria-label="All records" className="mt-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="h2 !text-2xl md:!text-3xl">All records ({shown.length})</h2>
              <input className="field-input md:!w-72" placeholder="Filter: plant, disease, severity…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter records" />
            </div>
            <div className="mt-3 max-h-[560px] overflow-auto rounded-card border border-line bg-white">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="sticky top-0 bg-surface text-xs uppercase tracking-wider text-muted">
                  <tr>{COLUMNS.map((c) => <th key={c.key} scope="col" className="px-3 py-2.5 font-semibold">{c.label}</th>)}</tr>
                </thead>
                <tbody>
                  {shown.map((r, i) => (
                    <tr key={i} className="border-t border-line">
                      <td className="whitespace-nowrap px-3 py-2 text-muted">{fmtDate(r.scanned_at)}</td>
                      <td className="px-3 py-2 text-forest">{r.plant}</td>
                      <td className="px-3 py-2">{r.is_tomato == null ? "–" : r.is_tomato ? "Yes" : "No"}</td>
                      <td className="px-3 py-2 font-semibold text-forest">{r.disease}</td>
                      <td className="px-3 py-2">{r.severity}</td>
                      <td className="px-3 py-2 tabular-nums">{r.confidence.toFixed(2)}</td>
                      <td className="px-3 py-2 text-muted">{r.ai_source}</td>
                      <td className="px-3 py-2 tabular-nums">{r.affected_areas}</td>
                      <td className="px-3 py-2 tabular-nums text-muted">{r.lat_1km ?? "–"}</td>
                      <td className="px-3 py-2 tabular-nums text-muted">{r.lon_1km ?? "–"}</td>
                      <td className="px-3 py-2">{r.sent_to_lab ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 5. Data dictionary and access */}
          <section aria-label="About the data" className="mt-8 grid gap-4 lg:grid-cols-3">
            <div className="rounded-card border border-line bg-white p-4 md:p-5 lg:col-span-2">
              <h3 className="h3 flex items-center gap-2"><Database className="h-5 w-5 text-green" aria-hidden />What each column means</h3>
              <dl className="mt-3 grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
                {COLUMNS.map((c) => <Fragment key={c.key}><dt className="font-semibold text-forest">{c.label}</dt><dd className="text-muted">{c.meaning}</dd></Fragment>)}
              </dl>
            </div>
            <div className="rounded-card border border-line bg-white p-4 md:p-5">
              <h3 className="h3 flex items-center gap-2"><Lock className="h-5 w-5 text-amber" aria-hidden />Full records</h3>
              <p className="small mt-2">Photos with the circled spots, the full care plan and the farmer's contact are for approved labs and scientists only.</p>
              <div className="mt-4 flex flex-col gap-2">
                <Link to="/hub/expert-login" className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-green px-4 font-semibold text-white"><FlaskConical className="h-4 w-4" aria-hidden />Lab / scientist login</Link>
                <Link to="/admin" className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-line px-4 font-semibold text-forest hover:bg-surface">Expert console</Link>
              </div>
              <p className="tiny mt-3">The diagnosis is an AI estimate, not a lab result. Please confirm in the lab before citing.</p>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
