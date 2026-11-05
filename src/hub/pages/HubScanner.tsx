// Crop disease scanner for tomato and paddy: drag and drop or camera, then the same pipeline as /scan
// (Claude vision in the cloud, the on-device model as backup), red/yellow circles with box coordinates,
// and every scan saved with the farmer's contact, time and location for lab follow-up.
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Camera, CheckCircle2, CloudOff, Database, Droplets, FlaskConical, ImagePlus, Leaf, MapPin, Mic, RotateCcw, Send, ShieldAlert, Sprout, Volume2 } from "lucide-react";
import { DragEvent, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SpotCircles } from "../../components/LeafReport";
import { SAMPLES } from "../../components/PhotoFlow";
import { shareScanWithAgent } from "../../lib/agent";
import { GENERAL_CARE, localResult } from "../../lib/careplan";
import { calculate } from "../npk";
import { LeafResult, Place, analyzeInCloud, cloudConfigured, saveToCloud } from "../../lib/cloud";
import { diagnose } from "../../lib/diagnose";
import { db, uid } from "../../lib/db";
import { loadWorkImage, shrinkForStorage } from "../../lib/vision/browser";
import { photoCoach } from "../../lib/vision/coach";
import { leafMasks } from "../../lib/vision/masks";
import { photoKind, spotRegions } from "../../lib/vision/regions";
import { HubScan, addHubScan, districtOf, useHubLang, useUser } from "../store";
import { usePackState } from "../../lib/offline";
import { useSyncState } from "../sync";
import { Glass, PageHead, Pill } from "../ui";
import { speak, stopSpeaking } from "../voice";

const CROPS = [
  { id: "Tomato", emoji: "🍅", hint: "Early & late blight, leaf spot, curl virus" },
  { id: "Paddy", emoji: "🌾", hint: "Blast, brown spot, leaf blight" },
  { id: "Other", emoji: "🌿", hint: "Chilli, cotton and more (online AI)" },
] as const;
type Crop = (typeof CROPS)[number]["id"];

const STEPS = ["Checking photo quality", "Finding the leaf", "Locating lesions", "Writing the care plan", "Saving to database"];
const SEV = { None: "lime", Mild: "amber", Moderate: "red", Severe: "red" } as const;

const toDataUrl = (b: Blob) => new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(b); });

/** Rounded to about 1 km, so the farm itself is not pinpointed. Falls back to the district centre. */
function approxLocation(fallback: Place): Promise<Place & { gps: boolean }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve({ ...fallback, gps: false }); return; }
    const t = setTimeout(() => resolve({ ...fallback, gps: false }), 4000);
    navigator.geolocation.getCurrentPosition(
      (p) => { clearTimeout(t); resolve({ lat: Math.round(p.coords.latitude * 100) / 100, lon: Math.round(p.coords.longitude * 100) / 100, gps: true }); },
      () => { clearTimeout(t); resolve({ ...fallback, gps: false }); },
      { maximumAge: 600_000, timeout: 3500 },
    );
  });
}

interface Done { scan: HubScan; url: string; synced: boolean; note: string; place: Place & { gps: boolean }; lowQuality: boolean }

export default function HubScanner() {
  const user = useUser()!;
  const lang = useHubLang();
  const nav = useNavigate();
  const [crop, setCrop] = useState<Crop>(user.crops.includes("Paddy") && !user.crops.includes("Tomato") ? "Paddy" : "Tomato");
  const [busy, setBusy] = useState<{ url: string; step: number } | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState<number | null>(null);
  const [tab, setTab] = useState<"en" | "te" | "hi">(lang === "te" || lang === "hi" ? lang : "en");
  const fileRef = useRef<HTMLInputElement>(null), camRef = useRef<HTMLInputElement>(null);
  const pack = usePackState(), net = useSyncState();

  const run = async (blob: Blob, sampleFile?: string) => {
    if (!blob.type.startsWith("image/")) { setError("Please choose a photo (JPG or PNG)."); return; }
    setError(""); setDone(null); setPicked(null);
    const preview = URL.createObjectURL(blob);
    setBusy({ url: preview, step: 0 });
    try {
      const work = await loadWorkImage(blob);
      const coach = photoCoach(work); // measured on the original, before re-encoding
      const photo = await shrinkForStorage(blob);
      setBusy({ url: preview, step: 1 });
      const place = await approxLocation(districtOf(user));
      const cloud = cloudConfigured ? analyzeInCloud(photo, place) : null;
      setBusy({ url: preview, step: 2 });
      const d = await diagnose(photo, work, coach, !coach.pass, sampleFile);
      const kind = photoKind(work), regions = spotRegions(work);
      let local: LeafResult = localResult(d, kind, regions);
      if (crop !== "Tomato" && kind === "leaf") {
        // The phone's model knows 13 crops, not paddy or chilli: keep the colour circles, but do not guess a disease.
        const base = localResult({ ...d, level: "CHECK" }, kind, regions);
        local = {
          ...base, plant: crop === "Paddy" ? "Rice (paddy)" : "Unknown", is_tomato: false,
          plant_note: `You chose ${crop.toLowerCase()}. The phone's own model is trained on other crops, so only discoloured areas are marked. The online AI gives the ${crop.toLowerCase()} diagnosis.`,
          disease: { ...base.disease, name: "Needs the online AI check", confidence: 0 },
          // The phone model was not trained on this crop, so its disease guess (and that plan) would be wrong.
          care: { ...GENERAL_CARE, fertilizer: crop === "Paddy" ? paddyFeed() : GENERAL_CARE.fertilizer },
        };
      }
      setBusy({ url: preview, step: 3 });
      const ai = cloud ? await cloud : null;
      setBusy({ url: preview, step: 4 });
      let result = local, source: HubScan["source"] = "on-device", cloudId: string | undefined, note = "";
      if (ai?.ok) { result = ai.result; source = "ai-vision"; cloudId = ai.id; }
      else if (ai && ai.code !== "off") {
        const saved = ai.code === "limit" ? ai : await saveToCloud(photo, local, place);
        if (saved.ok) cloudId = saved.id; else note = saved.message;
      } else note = "Cloud database is not connected yet, so this scan is saved on this phone.";
      shareScanWithAgent(result);
      const thumb = await toDataUrl(await shrinkForStorage(photo, 160, 0.7));
      const scan: HubScan = { id: uid(), cloudId, date: new Date().toISOString(), crop, thumb, source, result, lat: place.lat, lon: place.lon };
      addHubScan(scan);
      // Also in the main app's history, so My scans and the expert queue see it.
      await db.scans.put({
        id: scan.id, date: scan.date, photo, thumb: await shrinkForStorage(photo, 256, 0.72), coach, usedAnyway: !coach.pass, sampleFile,
        level: d.level, confirmed: false, affectedPct: leafMasks(work).affectedPct,
        prediction: { mode: d.prediction.mode, top3: d.prediction.top3, modelVersion: d.prediction.modelVersion },
      });
      setDone({ scan, url: URL.createObjectURL(photo), synced: !!cloudId, note, place, lowQuality: !coach.pass });
    } catch (e) {
      console.warn(e);
      setError("We could not read this photo. Please try another one.");
    } finally {
      setBusy(null);
    }
  };

  const onDrop = (e: DragEvent) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) run(f); };
  const sample = async (file: string) => { const r = await fetch(`/samples/${file}`); run(await r.blob(), file); };
  const reset = () => { stopSpeaking(); setDone(null); setError(""); };

  const r = done?.scan.result;
  const advice = r?.languages[tab];
  const speakAdvice = () => advice && speak([advice.problem, advice.reason, ...advice.steps].join(". "), tab);

  return (
    <div>
      <PageHead eyebrow="AI Crop Doctor" title={<>Visual <span className="neon-text">disease scanner</span></>}
        sub="Photograph one leaf in daylight. Red circles mark infected lesions, yellow circles mark dried or nutrient-starved tissue."
        right={<Pill tone={cloudConfigured ? "lime" : "amber"}>{cloudConfigured ? <><Database className="h-3 w-3" aria-hidden />Cloud sync on</> : <><CloudOff className="h-3 w-3" aria-hidden />Phone only</>}</Pill>} />

      {!done && !busy && pack.phase !== "unknown" && pack.phase !== "ready" && (
        <p role="status" className="mb-4 rounded-xl border border-neon-amber/40 bg-neon-amber/10 px-4 py-3 text-sm text-slate-100">
          {pack.phase === "busy"
            ? <>Saving the AI on this phone so scans work with <strong className="text-neon-amber">no internet</strong>: {pack.done} of {pack.total} files. Keep the app open for a minute.</>
            : net.online
              ? <>The offline AI is not saved on this phone yet. It saves by itself; you can also tap <strong className="text-neon-amber">"Offline AI not saved yet"</strong> in the menu.</>
              : <>You are offline and the AI was not saved on this phone before. Scans will only mark spots by leaf colour. Connect once to save the AI (23 MB).</>}
        </p>
      )}
      {!done && !busy && pack.phase === "ready" && !net.online && (
        <p role="status" className="mb-4 rounded-xl border border-neon-lime/30 bg-neon-lime/10 px-4 py-3 text-sm text-slate-100">You are offline. The AI is saved on this phone, so you can scan as normal. Results upload by themselves when you are back online.</p>
      )}
      {!done && !busy && (
        <>
          <div className="mb-4 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Crop">
            {CROPS.map((c) => (
              <button key={c.id} role="radio" aria-checked={crop === c.id} onClick={() => setCrop(c.id)}
                className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${crop === c.id ? "border-neon-cyan bg-neon-cyan/10 shadow-[0_0_20px_rgba(34,211,238,0.2)]" : "border-white/10 bg-white/[0.03] hover:border-white/25"}`}>
                <span className="text-3xl" aria-hidden>{c.emoji}</span>
                <span><span className="block font-bold text-white">{c.id}</span><span className="block text-xs text-slate-400">{c.hint}</span></span>
              </button>
            ))}
          </div>

          <motion.div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}
            animate={{ scale: drag ? 1.01 : 1 }}
            className={`relative overflow-hidden rounded-3xl border-2 border-dashed p-8 text-center transition md:p-14 ${drag ? "border-neon-cyan bg-neon-cyan/10" : "border-white/15 bg-white/[0.03]"}`}>
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.12),transparent_60%)]" />
            <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 3, repeat: Infinity }} className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-neon-cyan/40 bg-neon-cyan/10 shadow-[0_0_40px_rgba(34,211,238,0.3)]">
              <Leaf className="h-10 w-10 text-neon-cyan" aria-hidden />
            </motion.div>
            <p className="relative mt-5 font-heading text-xl font-bold text-white">Drop a {crop === "Other" ? "leaf" : crop.toLowerCase()} leaf photo here</p>
            <p className="relative mt-1 text-sm text-slate-400">or use the camera. JPG or PNG, one leaf filling the frame.</p>
            <div className="relative mt-6 flex flex-wrap justify-center gap-3">
              <button className="hub-btn-primary" onClick={() => camRef.current?.click()}><Camera className="h-5 w-5" aria-hidden />Open camera</button>
              <button className="hub-btn-ghost" onClick={() => fileRef.current?.click()}><ImagePlus className="h-5 w-5" aria-hidden />Upload photo</button>
            </div>
            <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) run(f); e.target.value = ""; }} />
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) run(f); e.target.value = ""; }} />
          </motion.div>
          {error && <p role="alert" className="mt-3 text-sm font-semibold text-neon-red">{error}</p>}

          <div className="mt-5">
            <p className="hub-label">Or try a sample tomato leaf</p>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {SAMPLES.slice(0, 7).map((s) => (
                <button key={s.file} onClick={() => { setCrop("Tomato"); sample(s.file); }} className="shrink-0 overflow-hidden rounded-xl border border-white/10 hover:border-neon-cyan/50">
                  <img src={`/samples/${s.file}`} alt={s.alt} loading="lazy" className="h-20 w-28 object-cover" />
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {busy && (
        <Glass className="grid gap-6 md:grid-cols-2">
          <div className="relative overflow-hidden rounded-2xl">
            <img src={busy.url} alt="Your photo being scanned" className="block w-full" />
            <motion.div aria-hidden className="absolute inset-x-0 h-1 bg-neon-cyan shadow-[0_0_24px_6px_rgba(34,211,238,0.7)]" animate={{ top: ["0%", "100%", "0%"] }} transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }} />
            <div aria-hidden className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.12)_1px,transparent_1px)] bg-[size:28px_28px]" />
          </div>
          <div className="flex flex-col justify-center" role="status" aria-live="polite">
            <p className="hub-h3 mb-4">Analysing your {crop.toLowerCase()} leaf…</p>
            <ol className="space-y-3">
              {STEPS.map((s, i) => (
                <li key={s} className={`flex items-center gap-3 text-sm font-semibold ${i < busy.step ? "text-neon-lime" : i === busy.step ? "text-white" : "text-slate-500"}`}>
                  {i < busy.step ? <CheckCircle2 className="h-5 w-5" aria-hidden /> : i === busy.step ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-neon-cyan border-t-transparent" aria-hidden /> : <span className="h-5 w-5 rounded-full border border-white/15" aria-hidden />}
                  {s}
                </li>
              ))}
            </ol>
          </div>
        </Glass>
      )}

      <AnimatePresence>
        {done && r && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-5">
              {/* photo + overlay */}
              <Glass className="lg:col-span-3">
                <div className="relative overflow-hidden rounded-2xl ring-1 ring-neon-cyan/30">
                  <SpotCircles url={done.url} detections={r.detections} onPick={setPicked} picked={picked} />
                  {["left-2 top-2 border-l-2 border-t-2", "right-2 top-2 border-r-2 border-t-2", "bottom-2 left-2 border-b-2 border-l-2", "bottom-2 right-2 border-b-2 border-r-2"].map((c) => <span key={c} aria-hidden className={`pointer-events-none absolute h-6 w-6 border-neon-cyan ${c}`} />)}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-300">
                  <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border-2 border-[#E11D1D]" />Infected lesion</span>
                  <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full border-2 border-[#FACC15]" />Dry / nutrient-deficient</span>
                  {done.scan.source === "on-device" && <Pill tone="amber">Rough circles from leaf colour</Pill>}
                </div>
                {r.detections.length > 0 && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[480px] text-left text-xs">
                      <thead><tr className="text-slate-500"><th className="py-1.5 pr-2">#</th><th className="pr-2">Type</th><th className="pr-2">Issue</th><th className="pr-2">Box (y1, x1, y2, x2 / 1000)</th></tr></thead>
                      <tbody>
                        {r.detections.map((d, i) => (
                          <tr key={i} onClick={() => setPicked(i)} className={`cursor-pointer border-t border-white/5 ${picked === i ? "bg-neon-cyan/10" : "hover:bg-white/5"}`}>
                            <td className="py-1.5 pr-2 font-bold text-white">{i + 1}</td>
                            <td className="pr-2"><span className={`font-bold ${d.type === "DISEASED" ? "text-[#F87171]" : "text-[#FACC15]"}`}>{d.type === "DISEASED" ? "Diseased" : "Dry"}</span></td>
                            <td className="pr-2 text-slate-200">{d.issue}</td>
                            <td className="pr-2 font-mono text-slate-400">{Math.round(d.ymin)}, {Math.round(d.xmin)}, {Math.round(d.ymax)}, {Math.round(d.xmax)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Glass>

              {/* diagnosis */}
              <div className="min-w-0 space-y-5 lg:col-span-2">
                {(!r.is_plant || r.subject === "flower" || r.subject === "not_plant") && (
                  <Glass className="!border-neon-amber/40"><p className="flex items-center gap-2 font-bold text-neon-amber"><AlertTriangle className="h-5 w-5" aria-hidden />{r.subject === "flower" ? "This is a flower, not a leaf" : "No plant leaf found"}</p><p className="mt-1 text-sm text-slate-300">{r.plant_note}</p></Glass>
                )}
                {r.is_plant && r.subject !== "flower" && crop === "Tomato" && !r.is_tomato && r.plant !== "Unknown" && (
                  <Glass className="!border-neon-amber/40"><p className="flex items-center gap-2 font-bold text-neon-amber"><AlertTriangle className="h-5 w-5" aria-hidden />Not a tomato plant</p><p className="mt-1 text-sm text-slate-300">{r.plant_note}</p></Glass>
                )}
                <Glass>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{r.plant} · {done.scan.source === "ai-vision" ? "Claude vision" : "On-device AI"}</p>
                  <h2 className="mt-1 font-heading text-2xl font-extrabold text-white">{r.healthy ? "Healthy leaf" : r.disease.name}</h2>
                  {r.disease.latin && <p className="text-sm italic text-slate-400">{r.disease.latin}</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Pill tone={SEV[r.disease.severity]}>Severity: {r.disease.severity}</Pill>
                    {r.disease.kind !== "unknown" && r.disease.kind !== "none" && <Pill tone="cyan">{r.disease.kind.replace("_", " ")}</Pill>}
                    <Pill tone="slate">{r.detections.length} area{r.detections.length === 1 ? "" : "s"} marked</Pill>
                  </div>
                  <div className="mt-4">
                    <div className="flex justify-between text-xs font-semibold text-slate-400"><span>AI confidence</span><span className="text-white">{Math.round(r.disease.confidence * 100)}%</span></div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10"><motion.div className="h-full rounded-full bg-gradient-to-r from-neon-teal to-neon-cyan" initial={{ width: 0 }} animate={{ width: `${Math.round(r.disease.confidence * 100)}%` }} transition={{ duration: 0.9 }} /></div>
                  </div>
                  {r.disease.symptoms_seen.length > 0 && <ul className="mt-4 space-y-1 text-sm text-slate-300">{r.disease.symptoms_seen.slice(0, 4).map((s) => <li key={s}>• {s}</li>)}</ul>}
                  {r.disease.confirm_by && <p className="mt-3 rounded-xl bg-white/5 p-3 text-xs text-slate-300"><strong className="text-white">Confirm: </strong>{r.disease.confirm_by}</p>}
                  {done.lowQuality && <p className="mt-3 text-xs font-semibold text-neon-amber">The photo was a little blurry or dark, so treat this answer with care.</p>}
                </Glass>

                {/* database sync */}
                <Glass className={done.synced ? "!border-neon-lime/30" : "!border-neon-amber/30"}>
                  <p className={`flex items-center gap-2 text-sm font-bold ${done.synced ? "text-neon-lime" : "text-neon-amber"}`}>{done.synced ? <Database className="h-4 w-4" aria-hidden /> : <CloudOff className="h-4 w-4" aria-hidden />}{done.synced ? "Saved to the Patra Lens database" : "Saved on this phone"}</p>
                  <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
                    <dt className="text-slate-500">Farmer</dt><dd className="truncate text-slate-200">{user.name} · +91 {user.phone}</dd>
                    <dt className="text-slate-500">Time</dt><dd className="text-slate-200">{new Date(done.scan.date).toLocaleString("en-IN")}</dd>
                    <dt className="text-slate-500">Location</dt><dd className="flex items-center gap-1 text-slate-200"><MapPin className="h-3 w-3" aria-hidden />{done.place.lat.toFixed(2)}, {done.place.lon.toFixed(2)} {done.place.gps ? "(GPS, ~1 km)" : `(${user.district})`}</dd>
                    {done.scan.cloudId && <><dt className="text-slate-500">Record</dt><dd className="truncate font-mono text-slate-400">{done.scan.cloudId}</dd></>}
                  </dl>
                  {done.note && <p className="mt-2 text-xs text-slate-400">{done.note}</p>}
                </Glass>
              </div>
            </div>

            {/* care plan */}
            {r.is_plant && r.subject !== "flower" && (
              <div className="grid gap-5 md:grid-cols-2">
                <Glass>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex gap-1" role="tablist" aria-label="Language">
                      {([["en", "English"], ["te", "తెలుగు"], ["hi", "हिन्दी"]] as const).map(([id, l]) => (
                        <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`min-h-[36px] rounded-lg px-3 text-sm font-bold ${tab === id ? "bg-neon-cyan text-navy-950" : "text-slate-300 hover:bg-white/10"}`}>{l}</button>
                      ))}
                    </div>
                    <button onClick={speakAdvice} className="hub-btn-ghost !min-h-[36px] !py-1"><Volume2 className="h-4 w-4" aria-hidden />Speak</button>
                  </div>
                  {advice && (
                    <div className="mt-3">
                      <p className="font-heading text-lg font-bold text-white">{advice.problem}</p>
                      <p className="mt-1 text-sm text-slate-300">{advice.reason}</p>
                      <ol className="mt-3 space-y-2">{advice.steps.map((s, i) => <li key={i} className="flex gap-2 text-sm text-slate-200"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neon-cyan/15 text-[11px] font-bold text-neon-cyan">{i + 1}</span>{s}</li>)}</ol>
                    </div>
                  )}
                </Glass>
                <Glass>
                  <h3 className="hub-h3 flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-neon-red" aria-hidden />Do today & precautions</h3>
                  <ul className="mt-2 space-y-1.5 text-sm text-slate-200">{[...r.care.do_today, ...r.care.precautions].slice(0, 7).map((s) => <li key={s}>• {s}</li>)}</ul>
                  {r.care.watering.length > 0 && <>
                    <h3 className="hub-h3 mt-4 flex items-center gap-2"><Droplets className="h-5 w-5 text-neon-cyan" aria-hidden />Watering</h3>
                    <ul className="mt-2 space-y-1.5 text-sm text-slate-200">{r.care.watering.slice(0, 4).map((s) => <li key={s}>• {s}</li>)}</ul>
                  </>}
                </Glass>
                {(r.care.fertilizer.length > 0 || r.care.chemical.length > 0 || r.care.organic.length > 0) && (
                  <Glass className="md:col-span-2">
                    <h3 className="hub-h3 flex items-center gap-2"><FlaskConical className="h-5 w-5 text-neon-amber" aria-hidden />Fertilizer & sprays</h3>
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      {[
                        { t: "Fertilizer", rows: r.care.fertilizer.map((f) => [f.product, f.dose, f.when]) },
                        { t: "Chemical spray", rows: r.care.chemical.map((c) => [c.product, c.dose, c.interval]) },
                        { t: "Organic option", rows: r.care.organic.map((o) => [o.product, o.dose, ""]) },
                      ].filter((b) => b.rows.length).map((b) => (
                        <div key={b.t} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{b.t}</p>
                          <ul className="mt-2 space-y-2">{b.rows.map(([p, d, w]) => <li key={p} className="text-sm"><p className="font-bold text-white">{p}</p><p className="text-slate-300">{d}{w ? ` · ${w}` : ""}</p></li>)}</ul>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-slate-400">Follow the product label. Wear gloves and a mask when spraying, and keep to the waiting time before harvest.</p>
                    {r.care.recovery && <p className="mt-2 flex items-start gap-2 text-sm text-slate-200"><Sprout className="mt-0.5 h-4 w-4 shrink-0 text-neon-lime" aria-hidden />{r.care.recovery}</p>}
                  </Glass>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {r.is_plant && <button className="hub-btn-primary" onClick={() => nav(`/hub/labs?scan=${done.scan.id}`)}><Send className="h-5 w-5" aria-hidden />Send to a lab / RBK</button>}
              <Link to="/hub/vani" className="hub-btn-ghost"><Mic className="h-5 w-5" aria-hidden />Ask Kisan Vani about it</Link>
              <button className="hub-btn-ghost" onClick={reset}><RotateCcw className="h-5 w-5" aria-hidden />Scan another</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Paddy's main feed for one acre, from the NPK calculator (medium soil). */
function paddyFeed() {
  const r = calculate({ crop: "Paddy", acres: 1, soil: { n: "medium", p: "medium", k: "medium" }, organic: false });
  const [dap, urea, mop] = r.products;
  return [{ product: "Main feed for 1 acre of paddy (whole season)", dose: `DAP ${dap.kg} kg + Urea ${urea.kg} kg + Potash (MOP) ${mop.kg} kg`, when: r.rdf.splits }];
}
