// Lab staff and scientists sign in with their email: Supabase emails a one-time sign-in link (or code).
// First sign-in creates an unapproved expert profile (name, organisation, phone); the admin approves it on /admin,
// then the expert console there shows farmers' scans and lab requests.
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, FlaskConical, Mail, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { cloudConfigured, supabase } from "../../lib/cloud";
import { cleanPhone, validPhone } from "../store";

const PENDING = "hub:expert-pending"; // profile typed before the email link was opened
interface Pending { name: string; organisation: string; phone: string }

export default function ExpertLogin() {
  const nav = useNavigate();
  const [f, setF] = useState({ name: "", organisation: "", email: "", phone: "" });
  const [step, setStep] = useState<"form" | "sent" | "done">("form");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"approved" | "pending" | null>(null);

  /** After the email is verified: save the profile once, then send approved experts to the console. */
  const afterSignIn = async () => {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    let pending: Pending | null = null;
    try { pending = JSON.parse(localStorage.getItem(PENDING) ?? "null"); } catch { /* blocked */ }
    const meta = (user.user_metadata ?? {}) as Partial<Pending>;
    const { data: row } = await supabase.from("experts").select("approved").eq("user_id", user.id).maybeSingle();
    if (!row) {
      await supabase.from("experts").insert({
        user_id: user.id, email: user.email,
        name: pending?.name || meta.name || null, organisation: pending?.organisation || meta.organisation || null, phone: pending?.phone || meta.phone || null,
      });
    }
    try { localStorage.removeItem(PENDING); } catch { /* blocked */ }
    setStatus(row?.approved ? "approved" : "pending");
    setStep("done");
    if (row?.approved) setTimeout(() => nav("/admin"), 1200);
  };

  // The email link brings the expert back here already signed in.
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => { if (data.session) afterSignIn(); });
    const { data } = supabase.auth.onAuthStateChange((e) => { if (e === "SIGNED_IN") afterSignIn(); });
    return () => data.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!f.name.trim()) { setErr("Please enter your name."); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim())) { setErr("Please enter a valid email address."); return; }
    if (f.phone && !validPhone(f.phone)) { setErr("Enter a 10-digit Indian mobile number, or leave it empty."); return; }
    if (!supabase) { setErr("The cloud is not connected."); return; }
    const profile: Pending = { name: f.name.trim(), organisation: f.organisation.trim(), phone: f.phone ? cleanPhone(f.phone) : "" };
    try { localStorage.setItem(PENDING, JSON.stringify(profile)); } catch { /* blocked */ }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: f.email.trim().toLowerCase(),
      options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/hub/expert-login`, data: profile },
    });
    setBusy(false);
    if (error) {
      setErr(/rate|security purposes|too many/i.test(error.message) ? "Too many emails were sent just now. Please wait a few minutes and try again." : error.message);
      return;
    }
    setStep("sent");
  };

  const verifyCode = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase || !code.trim()) return;
    setBusy(true); setErr("");
    const { error } = await supabase.auth.verifyOtp({ email: f.email.trim().toLowerCase(), token: code.trim(), type: "email" });
    setBusy(false);
    if (error) setErr("That code did not work. Open the link in the email instead, or ask for a new email.");
  };

  if (!cloudConfigured) return <div className="p-10 text-center text-white">The cloud database is not connected.</div>;

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4 py-10">
      <div aria-hidden className="hub-grid pointer-events-none absolute inset-0" />
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="hub-card relative w-full max-w-md !p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-neon-pink/40 bg-neon-pink/10"><FlaskConical className="h-6 w-6 text-neon-pink" aria-hidden /></span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-neon-pink">Labs & scientists</p>
            <h1 className="font-heading text-2xl font-extrabold text-white">Expert sign-in</h1>
          </div>
        </div>

        {step === "form" && (
          <form onSubmit={send} className="space-y-4">
            <p className="hub-muted">For pathology labs, ICAR and KVK scientists, RBK/RSK and agriculture officers who review farmers' leaf scans.</p>
            <label className="block"><span className="hub-label">Full name</span><input className="hub-input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Dr. Lakshmi Rao" autoComplete="name" /></label>
            <label className="block"><span className="hub-label">Lab / organisation</span><input className="hub-input" value={f.organisation} onChange={(e) => setF({ ...f, organisation: e.target.value })} placeholder="e.g. KVK Kurnool" autoComplete="organization" /></label>
            <label className="block"><span className="hub-label">Email</span><input className="hub-input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="name@lab.gov.in" autoComplete="email" /></label>
            <label className="block"><span className="hub-label">Mobile number</span>
              <div className="flex"><span className="flex items-center rounded-l-xl border border-r-0 border-white/10 bg-white/5 px-3 font-semibold text-slate-300">+91</span>
                <input className="hub-input !rounded-l-none" inputMode="numeric" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/[^\d ]/g, "").slice(0, 11) })} placeholder="98765 43210" autoComplete="tel-national" /></div>
            </label>
            {err && <p role="alert" className="text-sm font-semibold text-neon-red">{err}</p>}
            <button type="submit" className="hub-btn-primary w-full" disabled={busy}><Mail className="h-5 w-5" aria-hidden />{busy ? "Sending…" : "Email me a sign-in link"}</button>
            <p className="text-center text-xs text-slate-500">We email a one-time link to verify it is you. Your phone number is shared with the admin so farmers' cases can be followed up.</p>
          </form>
        )}

        {step === "sent" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-neon-cyan/30 bg-neon-cyan/10 p-4 text-sm text-slate-100">
              <p className="flex items-center gap-2 font-bold text-neon-cyan"><Mail className="h-4 w-4" aria-hidden />Check your email</p>
              <p className="mt-1">We sent a sign-in email to <strong className="text-white">{f.email}</strong>. Open it on this device and tap the link. Look in Spam if it does not arrive within a minute.</p>
            </div>
            <form onSubmit={verifyCode} className="space-y-2">
              <label className="block"><span className="hub-label">Or enter the code from the email (if it shows one)</span>
                <input className="hub-input text-center font-mono text-xl tracking-[0.4em]" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="••••••" /></label>
              <button className="hub-btn-ghost w-full" disabled={busy || code.length < 6}>Verify code<ArrowRight className="h-4 w-4" aria-hidden /></button>
            </form>
            {err && <p role="alert" className="text-sm font-semibold text-neon-red">{err}</p>}
            <button className="w-full text-center text-xs font-semibold text-slate-400 hover:text-white" onClick={() => setStep("form")}>Use a different email</button>
          </div>
        )}

        {step === "done" && (
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-neon-lime" aria-hidden />
            <p className="mt-3 font-heading text-xl font-bold text-white">Email verified</p>
            {status === "approved"
              ? <p className="hub-muted mt-1">Opening the expert console…</p>
              : <p className="hub-muted mt-1">Your account is waiting for the Patra Chain admin to approve it. Once approved, sign in again here to open the expert console with farmers' scans and lab requests.</p>}
            <Link to="/admin" className="hub-btn-primary mt-5"><ShieldCheck className="h-5 w-5" aria-hidden />Open expert console</Link>
          </div>
        )}

        <p className="mt-6 text-center text-xs text-slate-500">Farmer? <Link to="/hub/login" className="font-semibold text-neon-cyan">Sign in with your mobile number</Link></p>
      </motion.div>
    </div>
  );
}
