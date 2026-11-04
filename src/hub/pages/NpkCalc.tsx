// Smart fertilizer & NPK dosage calculator: crop + acres + soil test levels -> kg of N, P, K, bags of DAP, urea and potash,
// approximate cost and the split schedule.
import { motion } from "framer-motion";
import { Calculator, Info, Package, Volume2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { RDF, SoilLevel, calculate } from "../npk";
import { useUser } from "../store";
import { Glass, PageHead, rupees } from "../ui";
import { speak } from "../voice";

const LEVELS: SoilLevel[] = ["low", "medium", "high"];
const NUT = [
  { k: "n", label: "Nitrogen (N)", color: "#22D3EE" },
  { k: "p", label: "Phosphorus (P₂O₅)", color: "#F472B6" },
  { k: "k", label: "Potash (K₂O)", color: "#A3E635" },
] as const;

export default function NpkCalc() {
  const user = useUser()!;
  const first = RDF.find((r) => user.crops.includes(r.crop))?.crop ?? "Paddy";
  const [crop, setCrop] = useState(first);
  const [acres, setAcres] = useState(user.acres || 1);
  const [soil, setSoil] = useState<{ n: SoilLevel; p: SoilLevel; k: SoilLevel }>({ n: "medium", p: "medium", k: "medium" });
  const [organic, setOrganic] = useState(false);
  const res = useMemo(() => calculate({ crop, acres, soil, organic }), [crop, acres, soil, organic]);
  const maxN = Math.max(res.nutrient.n, res.nutrient.p, res.nutrient.k, 1);

  const sayIt = () => speak(`For ${acres} acres of ${crop}: ${res.products.map((p) => `${p.name.split(" (")[0]} ${p.kg} kilos, about ${p.bags} bags`).join(". ")}. ${res.rdf.splits}`, "en");

  return (
    <div>
      <PageHead eyebrow="Smart fertilizer planner" title={<>NPK <span className="neon-text">dosage calculator</span></>}
        sub="Enter your crop, land and soil test result. Get the fertilizer to buy, in bags, with the timing." />

      <div className="grid gap-5 lg:grid-cols-5">
        <Glass className="space-y-5 lg:col-span-2">
          <div>
            <p className="hub-label">Crop</p>
            <div className="flex flex-wrap gap-2">
              {RDF.map((r) => (
                <button key={r.crop} onClick={() => setCrop(r.crop)} aria-pressed={crop === r.crop} className={`min-h-[38px] rounded-full border px-3 text-sm font-semibold ${crop === r.crop ? "border-neon-cyan bg-neon-cyan/15 text-neon-cyan" : "border-white/10 text-slate-300"}`}>{r.crop}</button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="hub-label">Land: <strong className="text-white">{acres} acres</strong> ({(acres * 0.4047).toFixed(2)} ha)</span>
            <input type="range" min={0.25} max={20} step={0.25} value={acres} onChange={(e) => setAcres(Number(e.target.value))} className="w-full accent-[#22D3EE]" />
            <input className="hub-input mt-2" type="number" min={0.1} step={0.1} value={acres} onChange={(e) => setAcres(Math.max(0.1, Number(e.target.value) || 0.1))} aria-label="Acres" />
          </label>
          <div>
            <p className="hub-label">Soil test level (from your Soil Health Card)</p>
            {NUT.map((n) => (
              <div key={n.k} className="mt-2">
                <p className="mb-1 text-xs font-semibold text-slate-300">{n.label}</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {LEVELS.map((l) => (
                    <button key={l} onClick={() => setSoil({ ...soil, [n.k]: l })} aria-pressed={soil[n.k] === l}
                      className={`min-h-[36px] rounded-lg border text-xs font-bold capitalize ${soil[n.k] === l ? "text-navy-950" : "border-white/10 text-slate-300"}`}
                      style={soil[n.k] === l ? { background: n.color, borderColor: n.color } : undefined}>{l}</button>
                  ))}
                </div>
              </div>
            ))}
            <p className="mt-2 text-xs text-slate-500">No soil test? Leave all on medium. Low adds 25%, high takes 25% off.</p>
          </div>
          <label className="flex min-h-[44px] cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3">
            <span className="text-sm font-semibold text-slate-200">I add farmyard manure or compost (about 4 t/acre)</span>
            <input type="checkbox" checked={organic} onChange={(e) => setOrganic(e.target.checked)} className="h-5 w-5 accent-[#A3E635]" />
          </label>
        </Glass>

        <div className="min-w-0 space-y-5 lg:col-span-3">
          <Glass>
            <div className="flex items-center justify-between gap-2">
              <h2 className="hub-h3 flex items-center gap-2"><Calculator className="h-5 w-5 text-neon-cyan" aria-hidden />Nutrients for {acres} acres of {crop}</h2>
              <button onClick={sayIt} className="hub-btn-ghost !min-h-[36px]" aria-label="Read aloud"><Volume2 className="h-4 w-4" aria-hidden /></button>
            </div>
            <div className="mt-4 space-y-3">
              {NUT.map((n) => (
                <div key={n.k}>
                  <div className="flex justify-between text-sm"><span className="text-slate-300">{n.label}</span><span className="font-bold text-white">{res.nutrient[n.k]} kg</span></div>
                  <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-white/10">
                    <motion.div className="h-full rounded-full" style={{ background: n.color, boxShadow: `0 0 12px ${n.color}` }} animate={{ width: `${(res.nutrient[n.k] / maxN) * 100}%` }} transition={{ type: "spring", stiffness: 120, damping: 20 }} />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">Base dose {res.rdf.n}:{res.rdf.p}:{res.rdf.k} kg/ha · {res.rdf.source}</p>
          </Glass>

          <div className="grid gap-3 sm:grid-cols-3">
            {res.products.map((p, i) => (
              <Glass key={p.name} delay={i} className="text-center">
                <Package className="mx-auto h-6 w-6 text-neon-cyan" aria-hidden />
                <p className="mt-2 text-xs font-bold uppercase tracking-wider text-slate-400">{p.name}</p>
                <motion.p key={p.kg} initial={{ scale: 0.85, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }} className="font-heading text-3xl font-extrabold text-white">{p.kg}<span className="text-base text-slate-400"> kg</span></motion.p>
                <p className="text-sm font-semibold text-neon-lime">≈ {p.bags} bags</p>
                <p className="mt-1 text-xs text-slate-400">~{rupees(p.cost)}</p>
              </Glass>
            ))}
          </div>

          <Glass className="flex items-center justify-between gap-3 !border-neon-lime/30">
            <span className="text-sm text-slate-300">Approximate cost at subsidised MRP</span>
            <span className="font-heading text-2xl font-extrabold text-neon-lime">{rupees(res.total)}</span>
          </Glass>

          <Glass>
            <h3 className="hub-h3">When to apply</h3>
            <p className="mt-2 text-sm text-slate-200">{res.rdf.splits}</p>
            <ul className="mt-3 space-y-1 text-xs text-slate-400">
              <li>• DAP gives all the phosphorus and some nitrogen; urea makes up the rest of the nitrogen.</li>
              <li>• Do not give fertilizer just before heavy rain. Check the <Link to="/hub/weather" className="text-neon-cyan">weather planner</Link>.</li>
              <li>• Fertilizer feeds the plant; it does not cure disease. For spots on leaves, <Link to="/hub/scan" className="text-neon-cyan">scan a leaf</Link>.</li>
            </ul>
          </Glass>
          <p className="flex items-start gap-2 text-xs text-slate-500"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />General recommendations. Your Soil Health Card and the state university's package of practices come first. Bag MRP: urea ₹266.50 / 45 kg, DAP ~₹1,350 / 50 kg, MOP varies.</p>
        </div>
      </div>
    </div>
  );
}
