// Mandi price tracker: APMC prices per quintal across AP, Telangana and Karnataka, with trend badges and MSP alerts.
import { motion } from "framer-motion";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, BadgeIndianRupee, RefreshCw, Search, Store } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { COMMODITIES, Commodity, MSP, MSP_SOURCE, PriceRow, loadPrices, trendOf } from "../mandi";
import { STATES, StateId, useUser } from "../store";
import { Glass, PageHead, Pill, SamplePill, Sparkline, Stat, TrendBadge, rupees } from "../ui";

export default function Mandi() {
  const user = useUser()!;
  const [state, setState] = useState<StateId>(user.state);
  const [crop, setCrop] = useState<Commodity | "All">("All");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"modal" | "trend" | "market">("trend");
  const [data, setData] = useState<{ rows: PriceRow[]; live: boolean; cachedAt?: number } | null>(null);
  const [loading, setLoading] = useState(false);

  const load = () => { setLoading(true); loadPrices(state).then((d) => { setData(d); setLoading(false); }); };
  useEffect(load, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => {
    let r = (data?.rows ?? []).filter((x) => (crop === "All" || x.commodity === crop) && `${x.market} ${x.district} ${x.commodity}`.toLowerCase().includes(q.toLowerCase()));
    r = [...r].sort((a, b) => sort === "modal" ? b.modal - a.modal : sort === "market" ? a.market.localeCompare(b.market) : trendOf(b.series).pct - trendOf(a.series).pct);
    return r;
  }, [data, crop, q, sort]);

  const all = data?.rows ?? [];
  const withTrend = all.map((r) => ({ r, t: trendOf(r.series) }));
  const gainer = withTrend.reduce<typeof withTrend[0] | null>((a, b) => (!a || b.t.pct > a.t.pct ? b : a), null);
  const loser = withTrend.reduce<typeof withTrend[0] | null>((a, b) => (!a || b.t.pct < a.t.pct ? b : a), null);
  const belowMsp = all.filter((r) => MSP[r.commodity] && r.modal < MSP[r.commodity]!.price);
  const myCrops = new Set(user.crops);

  return (
    <div>
      <PageHead eyebrow="Live market intelligence" title={<>Mandi <span className="neon-text">price tracker</span></>}
        sub="APMC prices in ₹ per quintal (100 kg). Modal price is the rate most lots sold at."
        right={<div className="flex items-center gap-2">{data && (data.live ? <Pill tone="lime">● Live · Agmarknet</Pill> : data.cachedAt ? <Pill tone="amber">Saved {new Date(data.cachedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</Pill> : <SamplePill>Sample prices</SamplePill>)}<button onClick={load} className="hub-btn-ghost !min-h-[36px]" aria-label="Refresh"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden /></button></div>} />

      {data && !data.live && data.cachedAt && <p role="note" className="mb-4 rounded-xl border border-neon-amber/30 bg-neon-amber/5 px-4 py-3 text-sm text-slate-200">You are offline or the price service is busy. These are the <strong className="text-neon-amber">last live prices saved on this phone</strong>. They refresh when you are online.</p>}
      {data && !data.live && !data.cachedAt && (
        <p role="note" className="mb-4 rounded-xl border border-neon-amber/30 bg-neon-amber/5 px-4 py-3 text-sm text-slate-200">
          These are <strong className="text-neon-amber">sample prices</strong> for the demo, not today's market rates. Live Agmarknet prices appear when the data.gov.in key is added to the cloud setup.
        </p>
      )}

      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="State">
        {(Object.keys(STATES) as StateId[]).map((s) => (
          <button key={s} role="tab" aria-selected={state === s} onClick={() => setState(s)}
            className={`min-h-[40px] rounded-xl border px-4 text-sm font-bold transition ${state === s ? "border-neon-cyan bg-neon-cyan/10 text-neon-cyan" : "border-white/10 text-slate-300 hover:border-white/30"}`}>{STATES[s].name}</button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={<Store className="h-5 w-5" aria-hidden />} label="Market rows" value={all.length} sub={all[0] ? `As of ${new Date(all[0].date).toLocaleDateString("en-IN")}` : "…"} />
        <Stat tone="lime" icon={<ArrowUpRight className="h-5 w-5" aria-hidden />} label="Top gainer" value={gainer ? `+${gainer.t.pct}%` : "—"} sub={gainer ? `${gainer.r.commodity}, ${gainer.r.market}` : ""} />
        <Stat tone="red" icon={<ArrowDownRight className="h-5 w-5" aria-hidden />} label="Top loser" value={loser ? `${loser.t.pct}%` : "—"} sub={loser ? `${loser.r.commodity}, ${loser.r.market}` : ""} />
        <Stat tone="amber" icon={<AlertTriangle className="h-5 w-5" aria-hidden />} label="Below MSP" value={belowMsp.length} sub={belowMsp.length ? "Sell at govt procurement" : "None"} />
      </div>

      {belowMsp.length > 0 && (
        <Glass className="mt-5 !border-neon-amber/30">
          <h2 className="hub-h3 flex items-center gap-2"><BadgeIndianRupee className="h-5 w-5 text-neon-amber" aria-hidden />MSP alerts</h2>
          <p className="hub-muted mt-1">These markets are paying less than the Minimum Support Price. Government procurement centres (via your RBK/RSK or PACS) buy at MSP for fair-quality produce.</p>
          <ul className="mt-3 grid gap-2 md:grid-cols-2">
            {belowMsp.map((r) => (
              <li key={r.market + r.commodity} className="flex items-center justify-between gap-2 rounded-xl border border-white/5 bg-white/[0.03] p-3 text-sm">
                <span><strong className="text-white">{r.commodity}</strong> <span className="text-slate-400">· {r.market}</span></span>
                <span className="text-right"><span className="font-bold text-neon-red">{rupees(r.modal)}</span><span className="text-slate-400"> vs MSP {rupees(MSP[r.commodity]!.price)}</span></span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">MSP: kharif 2025-26, Government of India. <a href={MSP_SOURCE} target="_blank" rel="noreferrer" className="text-neon-cyan">CACP</a></p>
        </Glass>
      )}

      <Glass className="mt-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {(["All", ...COMMODITIES] as const).map((c) => (
              <button key={c} onClick={() => setCrop(c)} aria-pressed={crop === c}
                className={`min-h-[36px] shrink-0 rounded-full border px-3 text-sm font-semibold ${crop === c ? "border-neon-cyan bg-neon-cyan/15 text-neon-cyan" : "border-white/10 text-slate-300 hover:border-white/30"}`}>
                {c}{c !== "All" && myCrops.has(c) ? " ★" : ""}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <label className="relative flex-1 md:w-56"><span className="sr-only">Search market</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
              <input className="hub-input !min-h-[40px] !pl-9" placeholder="Search market" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <select className="hub-input !min-h-[40px] !w-auto" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort">
              <option value="trend">Trend</option><option value="modal">Price</option><option value="market">Market</option>
            </select>
          </div>
        </div>

        {!data ? <p className="hub-muted mt-4">Loading prices…</p> : !rows.length ? <p className="hub-muted mt-4">No markets match.</p> : (
          <>
            {/* desktop table */}
            <div className="mt-4 hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead><tr className="border-b border-white/10 text-xs uppercase tracking-wider text-slate-500">
                  <th className="py-2 pr-3">Commodity</th><th className="pr-3">Market</th><th className="pr-3 text-right">Min</th><th className="pr-3 text-right">Max</th><th className="pr-3 text-right">Modal</th><th className="pr-3 text-right">₹/kg</th><th className="pr-3">7 days</th><th>Trend</th>
                </tr></thead>
                <tbody>
                  {rows.map((r, i) => {
                    const msp = MSP[r.commodity];
                    return (
                      <motion.tr key={r.market + r.commodity} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.015 }} className="border-b border-white/5 hover:bg-white/[0.03]">
                        <td className="py-2.5 pr-3"><span className="font-bold text-white">{r.commodity}</span><span className="block text-xs text-slate-500">{r.variety}</span></td>
                        <td className="pr-3 text-slate-200">{r.market}<span className="block text-xs text-slate-500">{r.district}</span></td>
                        <td className="pr-3 text-right text-slate-400">{rupees(r.min)}</td>
                        <td className="pr-3 text-right text-slate-400">{rupees(r.max)}</td>
                        <td className="pr-3 text-right"><span className="font-heading font-extrabold text-white">{rupees(r.modal)}</span>{msp && <span className={`block text-[11px] font-semibold ${r.modal < msp.price ? "text-neon-red" : "text-neon-lime"}`}>{r.modal < msp.price ? "Below" : "Above"} MSP</span>}</td>
                        <td className="pr-3 text-right text-slate-300">₹{(r.modal / 100).toFixed(1)}</td>
                        <td className="pr-3"><Sparkline values={r.series} /></td>
                        <td><TrendBadge t={trendOf(r.series)} /></td>
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* phone cards */}
            <ul className="mt-4 space-y-2 md:hidden">
              {rows.map((r) => {
                const msp = MSP[r.commodity];
                return (
                  <li key={r.market + r.commodity} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0"><p className="font-bold text-white">{r.commodity}</p><p className="truncate text-xs text-slate-400">{r.market} · {r.district}</p></div>
                      <div className="text-right"><p className="font-heading text-lg font-extrabold text-white">{rupees(r.modal)}<span className="text-xs text-slate-400">/q</span></p><p className="text-xs text-slate-400">₹{(r.modal / 100).toFixed(1)}/kg</p></div>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <TrendBadge t={trendOf(r.series)} />
                      {msp && <Pill tone={r.modal < msp.price ? "red" : "lime"}>{r.modal < msp.price ? "Below" : "Above"} MSP</Pill>}
                      <Sparkline values={r.series} w={80} />
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-500">Range {rupees(r.min)} – {rupees(r.max)}</p>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Glass>
      <p className="mt-3 text-xs text-slate-500">Source when live: Agmarknet, Directorate of Marketing & Inspection, via data.gov.in. Prices vary by quality and arrival; check with your commission agent before selling.</p>
    </div>
  );
}
