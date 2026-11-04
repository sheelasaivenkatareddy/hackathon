// Government subsidy and crop insurance quick-eligibility guide (PM-KISAN, PMFBY, KCC, state schemes).
import { motion } from "framer-motion";
import { CheckCircle2, ExternalLink, HelpCircle, Info, XCircle } from "lucide-react";
import { useState } from "react";
import { Answers, SCHEMES } from "../schemes";
import { STATES, StateId, useUser } from "../store";
import { Glass, PageHead, Pill } from "../ui";

function YesNo({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div>
      <p className="hub-label">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        {[true, false].map((v) => (
          <button key={String(v)} onClick={() => onChange(v)} aria-pressed={value === v}
            className={`min-h-[42px] rounded-xl border text-sm font-bold ${value === v ? "border-neon-cyan bg-neon-cyan/10 text-neon-cyan" : "border-white/10 text-slate-300"}`}>{v ? "Yes" : "No"}</button>
        ))}
      </div>
    </div>
  );
}

export default function Schemes() {
  const user = useUser()!;
  const [a, setA] = useState<Answers>({ state: user.state, land: "owner", acres: user.acres, taxpayer: false, govtEmployee: false, bankAadhaar: true, growsNotifiedCrop: true });
  const results = SCHEMES.filter((s) => s.who === "Central" || s.who === a.state).map((s) => ({ s, r: s.check(a) }));
  const yes = results.filter((x) => x.r.ok === true).length;

  return (
    <div>
      <PageHead eyebrow="Subsidies & insurance" title={<>Scheme <span className="neon-text">eligibility check</span></>}
        sub="Answer 6 quick questions to see which schemes you can apply for." />

      <div className="grid gap-5 lg:grid-cols-5">
        <Glass className="space-y-4 lg:col-span-2">
          <label className="block"><span className="hub-label">State</span>
            <select className="hub-input" value={a.state} onChange={(e) => setA({ ...a, state: e.target.value as StateId })}>
              {(Object.keys(STATES) as StateId[]).map((s) => <option key={s} value={s}>{STATES[s].name}</option>)}
            </select>
          </label>
          <div>
            <p className="hub-label">Farm land</p>
            <div className="grid grid-cols-3 gap-2">
              {([["owner", "I own it"], ["tenant", "Tenant / lease"], ["none", "No land"]] as const).map(([id, l]) => (
                <button key={id} onClick={() => setA({ ...a, land: id })} aria-pressed={a.land === id} className={`min-h-[42px] rounded-xl border px-2 text-xs font-bold ${a.land === id ? "border-neon-cyan bg-neon-cyan/10 text-neon-cyan" : "border-white/10 text-slate-300"}`}>{l}</button>
              ))}
            </div>
          </div>
          <label className="block"><span className="hub-label">Land in acres</span><input className="hub-input" type="number" min={0} step={0.5} value={a.acres} onChange={(e) => setA({ ...a, acres: Math.max(0, Number(e.target.value)) })} /></label>
          <YesNo label="Do you pay income tax?" value={a.taxpayer} onChange={(v) => setA({ ...a, taxpayer: v })} />
          <YesNo label="Government employee or pensioner in the family?" value={a.govtEmployee} onChange={(v) => setA({ ...a, govtEmployee: v })} />
          <YesNo label="Is Aadhaar linked to your bank account?" value={a.bankAadhaar} onChange={(v) => setA({ ...a, bankAadhaar: v })} />
          <YesNo label="Is your crop notified for insurance in your area?" value={a.growsNotifiedCrop} onChange={(v) => setA({ ...a, growsNotifiedCrop: v })} />
        </Glass>

        <div className="min-w-0 space-y-3 lg:col-span-3">
          <Glass className="flex items-center gap-4 !border-neon-lime/30">
            <span className="font-heading text-5xl font-extrabold text-neon-lime">{yes}</span>
            <div><p className="font-bold text-white">schemes you look eligible for</p><p className="hub-muted">{results.length - yes} more need a check or do not apply.</p></div>
          </Glass>
          {results.map(({ s, r }, i) => (
            <motion.div key={s.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className={`hub-card ${r.ok === true ? "!border-neon-lime/30" : r.ok === "maybe" ? "!border-neon-amber/30" : "opacity-70"}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {r.ok === true ? <CheckCircle2 className="h-5 w-5 text-neon-lime" aria-hidden /> : r.ok === "maybe" ? <HelpCircle className="h-5 w-5 text-neon-amber" aria-hidden /> : <XCircle className="h-5 w-5 text-slate-500" aria-hidden />}
                  <h3 className="hub-h3">{s.name}</h3>
                </div>
                <div className="flex gap-1.5">
                  <Pill tone="slate">{s.who === "Central" ? "Central" : STATES[s.who as StateId].name}</Pill>
                  <Pill tone={r.ok === true ? "lime" : r.ok === "maybe" ? "amber" : "slate"}>{r.ok === true ? "Eligible" : r.ok === "maybe" ? "Check" : "Not eligible"}</Pill>
                </div>
              </div>
              <p className="mt-2 text-sm text-slate-200">{s.benefit}</p>
              <p className="mt-1 text-sm font-semibold text-neon-cyan">{r.why}</p>
              {r.ok !== false && <p className="mt-2 text-xs text-slate-400"><strong className="text-slate-300">How to apply: </strong>{s.apply}</p>}
              {s.link && <a href={s.link} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-neon-cyan">Official portal<ExternalLink className="h-3 w-3" aria-hidden /></a>}
            </motion.div>
          ))}
          <p className="flex items-start gap-2 text-xs text-slate-500"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />A quick guide, not an official decision. Amounts and rules change every season: confirm at your RBK/RSK, bank or the official portal before applying.</p>
        </div>
      </div>
    </div>
  );
}
