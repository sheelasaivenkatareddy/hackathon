// Sign in with a mobile number and OTP (simulated for the demo: the code is shown on screen, no SMS is sent),
// then a one-time profile: name, role, state, district, village, land and crops.
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CheckCircle2, FlaskConical, Mic, ScanLine, ShieldCheck, Smartphone, TrendingUp, UserCheck, Wheat } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Role, STATES, StateId, cleanPhone, getUser, sendOtp, signIn, validPhone, verifyOtp } from "../store";

const CROPS = ["Paddy", "Tomato", "Cotton", "Dry Chilli", "Maize", "Groundnut", "Onion"];

export default function HubLogin() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next")?.startsWith("/hub") ? params.get("next")! : "/hub";
  const [step, setStep] = useState<"phone" | "otp" | "profile">("phone");
  const [role, setRole] = useState<Role>("farmer");
  const [phone, setPhone] = useState("");
  const [demoCode, setDemoCode] = useState("");
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [err, setErr] = useState("");
  const [p, setP] = useState({ name: "", state: "AP" as StateId, district: STATES.AP.districts[0].name, village: "", acres: 2, crops: ["Tomato"] as string[] });
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => { if (getUser()) nav(next, { replace: true }); }, [nav, next]);

  const send = (e?: FormEvent) => {
    e?.preventDefault();
    if (!validPhone(phone)) { setErr("Enter a 10-digit Indian mobile number starting with 6, 7, 8 or 9."); return; }
    setErr(""); setDemoCode(sendOtp(cleanPhone(phone))); setOtp(["", "", "", ""]); setStep("otp");
    setTimeout(() => boxes.current[0]?.focus(), 50);
  };
  const verify = (code = otp.join("")) => {
    if (!verifyOtp(cleanPhone(phone), code)) { setErr("That code is not right. Check the code and try again."); return; }
    setErr(""); setStep("profile");
  };
  const typeDigit = (i: number, v: string) => {
    const d = v.replace(/\D/g, "").slice(-1);
    const nextOtp = otp.map((x, k) => (k === i ? d : x));
    setOtp(nextOtp);
    if (d && i < 3) boxes.current[i + 1]?.focus();
    if (nextOtp.every(Boolean)) verify(nextOtp.join(""));
  };
  const finish = (e: FormEvent) => {
    e.preventDefault();
    if (!p.name.trim()) { setErr("Please enter your name."); return; }
    signIn({ phone: cleanPhone(phone), role, name: p.name.trim(), state: p.state, district: p.district, village: p.village.trim() || p.district, acres: Math.max(0.1, p.acres), crops: p.crops, since: new Date().toISOString() });
    nav(next, { replace: true });
  };

  return (
    <div className="relative grid min-h-screen lg:grid-cols-2">
      <div aria-hidden className="hub-grid pointer-events-none absolute inset-0" />
      {/* pitch side */}
      <section className="relative hidden flex-col justify-between overflow-hidden border-r border-white/10 p-10 lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-neon-cyan to-neon-teal shadow-[0_0_24px_rgba(34,211,238,0.5)]"><img src="/logo.svg" alt="" className="h-7 w-7 brightness-0" /></span>
          <span className="font-heading text-xl font-extrabold text-white">Kisan Hub</span>
        </div>
        <div>
          <h1 className="font-heading text-5xl font-extrabold leading-[1.05] tracking-tight text-white">Every farmer's<br /><span className="neon-text">AI crop doctor</span>,<br />in their own language.</h1>
          <p className="mt-5 max-w-md text-lg text-slate-300">Scan a leaf, talk to Kisan Vani in Telugu or Hindi, check today's mandi price and send the case to a lab, all from one phone.</p>
          <ul className="mt-8 grid max-w-md grid-cols-2 gap-3">
            {[[ScanLine, "Leaf disease scanner"], [Mic, "Voice AI in 6 languages"], [TrendingUp, "APMC mandi prices"], [UserCheck, "Labs & RBK connect"]].map(([I, t]) => {
              const Icon = I as typeof ScanLine;
              return <li key={t as string} className="hub-card !p-3 flex items-center gap-2 text-sm font-semibold text-slate-200"><Icon className="h-5 w-5 text-neon-cyan" aria-hidden />{t as string}</li>;
            })}
          </ul>
        </div>
        <p className="text-xs text-slate-500">Chip to Crop 2026 · Team Smart Revolution</p>
      </section>

      {/* form side */}
      <section className="relative flex items-center justify-center p-4 py-10 md:p-10">
        <div className="w-full max-w-md">
          <div className="mb-6 lg:hidden">
            <h1 className="font-heading text-3xl font-extrabold text-white">Welcome to <span className="neon-text">Kisan Hub</span></h1>
            <p className="hub-muted mt-1">AI crop doctor, mandi prices and expert help.</p>
          </div>
          <div className="hub-card !p-6">
            <ol className="mb-6 flex items-center gap-2" aria-label="Steps">
              {["Mobile", "OTP", "Profile"].map((s, i) => {
                const idx = ["phone", "otp", "profile"].indexOf(step);
                return (
                  <li key={s} className="flex flex-1 items-center gap-2">
                    <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${i < idx ? "bg-neon-lime text-navy-950" : i === idx ? "bg-neon-cyan text-navy-950 shadow-[0_0_12px_rgba(34,211,238,0.6)]" : "border border-white/15 text-slate-500"}`}>{i < idx ? "✓" : i + 1}</span>
                    <span className={`text-xs font-semibold ${i === idx ? "text-white" : "text-slate-500"}`}>{s}</span>
                    {i < 2 && <span className={`h-px flex-1 ${i < idx ? "bg-neon-lime" : "bg-white/10"}`} />}
                  </li>
                );
              })}
            </ol>

            <AnimatePresence mode="wait">
              {step === "phone" && (
                <motion.form key="phone" onSubmit={send} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <p className="hub-label">I am a</p>
                  <div className="grid grid-cols-2 gap-2">
                    {([["farmer", "Farmer", Wheat], ["expert", "Expert / Lab", ShieldCheck]] as const).map(([id, label, Icon]) => (
                      <button type="button" key={id} onClick={() => (id === "expert" ? nav("/hub/expert-login") : setRole(id))} aria-pressed={role === id}
                        className={`flex min-h-[56px] items-center justify-center gap-2 rounded-xl border text-sm font-bold transition ${role === id ? "border-neon-cyan bg-neon-cyan/10 text-neon-cyan shadow-[0_0_16px_rgba(34,211,238,0.25)]" : "border-white/10 text-slate-300 hover:border-white/30"}`}>
                        <Icon className="h-5 w-5" aria-hidden />{label}
                      </button>
                    ))}
                  </div>
                  <label className="mt-5 block">
                    <span className="hub-label">Mobile number</span>
                    <div className="flex">
                      <span className="flex items-center rounded-l-xl border border-r-0 border-white/10 bg-white/5 px-3 font-semibold text-slate-300">+91</span>
                      <input className="hub-input !rounded-l-none" inputMode="numeric" autoComplete="tel-national" placeholder="98765 43210" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d ]/g, "").slice(0, 11))} />
                    </div>
                  </label>
                  {err && <p role="alert" className="mt-2 text-sm font-semibold text-neon-red">{err}</p>}
                  <button type="submit" className="hub-btn-primary mt-5 w-full"><Smartphone className="h-5 w-5" aria-hidden />Send OTP</button>
                  <p className="mt-3 text-center text-xs text-slate-500">Demo login: the OTP is shown on screen. No SMS is sent.</p>
                </motion.form>
              )}

              {step === "otp" && (
                <motion.div key="otp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <div role="status" className="mb-5 flex items-start gap-3 rounded-xl border border-neon-amber/30 bg-neon-amber/10 p-3">
                    <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-neon-amber" aria-hidden />
                    <div className="text-sm">
                      <p className="font-bold text-neon-amber">Demo SMS</p>
                      <p className="text-slate-200">Your Kisan Hub OTP is <strong className="font-mono text-lg tracking-widest text-white">{demoCode}</strong>. Valid for 5 minutes.</p>
                    </div>
                  </div>
                  <p className="hub-label">Enter the 4-digit code sent to +91 {cleanPhone(phone)}</p>
                  <div className="flex gap-3">
                    {otp.map((d, i) => (
                      <input key={i} ref={(el) => { boxes.current[i] = el; }} value={d} inputMode="numeric" maxLength={1} aria-label={`Digit ${i + 1}`}
                        onChange={(e) => typeDigit(i, e.target.value)} onKeyDown={(e) => { if (e.key === "Backspace" && !d && i > 0) boxes.current[i - 1]?.focus(); }}
                        className="h-14 w-full rounded-xl border border-white/10 bg-navy-900/80 text-center font-mono text-2xl font-bold text-white focus:border-neon-cyan focus:outline-none focus:shadow-[0_0_16px_rgba(34,211,238,0.35)]" />
                    ))}
                  </div>
                  {err && <p role="alert" className="mt-2 text-sm font-semibold text-neon-red">{err}</p>}
                  <div className="mt-5 flex gap-2">
                    <button className="hub-btn-ghost flex-1" onClick={() => { setOtp(demoCode.split("")); verify(demoCode); }}>Auto-fill code</button>
                    <button className="hub-btn-primary flex-1" onClick={() => verify()} disabled={!otp.every(Boolean)}>Verify<ArrowRight className="h-4 w-4" aria-hidden /></button>
                  </div>
                  <button className="mt-3 w-full text-center text-xs font-semibold text-slate-400 hover:text-white" onClick={() => setStep("phone")}>Change number</button>
                </motion.div>
              )}

              {step === "profile" && (
                <motion.form key="profile" onSubmit={finish} className="space-y-4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <p className="flex items-center gap-2 text-sm font-semibold text-neon-lime"><CheckCircle2 className="h-4 w-4" aria-hidden />Number verified</p>
                  <label className="block"><span className="hub-label">Your name</span><input className="hub-input" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} placeholder="e.g. Ramesh Reddy" autoFocus /></label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block"><span className="hub-label">State</span>
                      <select className="hub-input" value={p.state} onChange={(e) => { const s = e.target.value as StateId; setP({ ...p, state: s, district: STATES[s].districts[0].name }); }}>
                        {(Object.keys(STATES) as StateId[]).map((s) => <option key={s} value={s}>{STATES[s].name}</option>)}
                      </select>
                    </label>
                    <label className="block"><span className="hub-label">District</span>
                      <select className="hub-input" value={p.district} onChange={(e) => setP({ ...p, district: e.target.value })}>
                        {STATES[p.state].districts.map((d) => <option key={d.name}>{d.name}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block"><span className="hub-label">Village</span><input className="hub-input" value={p.village} onChange={(e) => setP({ ...p, village: e.target.value })} /></label>
                    <label className="block"><span className="hub-label">Land (acres)</span><input className="hub-input" type="number" min={0.1} step={0.1} value={p.acres} onChange={(e) => setP({ ...p, acres: Number(e.target.value) })} /></label>
                  </div>
                  <div>
                    <p className="hub-label">Crops you grow</p>
                    <div className="flex flex-wrap gap-2">
                      {CROPS.map((c) => {
                        const on = p.crops.includes(c);
                        return <button type="button" key={c} aria-pressed={on} onClick={() => setP({ ...p, crops: on ? p.crops.filter((x) => x !== c) : [...p.crops, c] })}
                          className={`min-h-[36px] rounded-full border px-3 text-sm font-semibold ${on ? "border-neon-lime bg-neon-lime/10 text-neon-lime" : "border-white/10 text-slate-300"}`}>{c}</button>;
                      })}
                    </div>
                  </div>
                  {err && <p role="alert" className="text-sm font-semibold text-neon-red">{err}</p>}
                  <button type="submit" className="hub-btn-primary w-full">Enter Kisan Hub<ArrowRight className="h-4 w-4" aria-hidden /></button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>
    </div>
  );
}
