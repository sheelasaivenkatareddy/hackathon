// Admin: signs in with Supabase and shows every scan from every user, with the photo, result and contact details.
import type { Session } from "@supabase/supabase-js";
import { Download, LogOut, RefreshCw, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import LeafReport from "../components/LeafReport";
import { BottomSheet, Button, Chip, useToast } from "../components/ui";
import { CloudEscalation, CloudScan, cloudConfigured, isAdminSession, supabase } from "../lib/cloud";

const PAGE = 100;
const fmt = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

function SignIn({ onError }: { onError: string }) {
  const [email, setEmail] = useState(""), [password, setPassword] = useState(""), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  return (
    <form className="mx-auto mt-6 max-w-sm space-y-3 rounded-card border border-line bg-white p-5" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setErr("");
      const { error } = await supabase!.auth.signInWithPassword({ email: email.trim(), password });
      setBusy(false);
      if (error) setErr(error.message);
    }}>
      <label className="block"><span className="field-label">Email</span><input className="field-input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
      <label className="block"><span className="field-label">Password</span><input className="field-input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
      {(err || onError) && <p role="alert" className="text-sm font-semibold text-tomato-dark">{err || onError}</p>}
      <Button type="submit" loading={busy} className="w-full">Sign in</Button>
    </form>
  );
}

interface Chat { id: string; created_at: string; device_id: string; user_name: string | null; lang: string | null; question: string; answer: string }

function Questions() {
  const [rows, setRows] = useState<Chat[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    supabase!.from("agent_chats").select("*").order("created_at", { ascending: false }).limit(200)
      .then(({ data, error }) => { if (error) setErr(error.message); else setRows((data ?? []) as Chat[]); });
  }, []);
  if (err) return <p role="alert" className="mt-6 font-semibold text-tomato-dark">Could not load questions: {err}</p>;
  if (!rows) return <p className="mt-6" role="status">Loading…</p>;
  if (!rows.length) return <p className="mt-8 text-center">No questions yet.</p>;
  return (
    <ul className="mt-6 space-y-3">
      {rows.map((c) => (
        <li key={c.id} className="rounded-card border border-line bg-white p-4">
          <p className="tiny">{fmt(c.created_at)} · {c.user_name || "No name"} · {c.lang?.toUpperCase()} · device {c.device_id.slice(0, 8)}</p>
          <p className="mt-1 font-semibold text-forest">{c.question}</p>
          <details className="mt-1"><summary className="cursor-pointer text-sm font-semibold text-green-dark">Answer</summary><p className="mt-2 whitespace-pre-line text-sm">{c.answer}</p></details>
        </li>
      ))}
    </ul>
  );
}

const STATUS_LABEL = { new: "New", in_review: "In review", resolved: "Resolved" } as const;

/** Scans farmers forwarded from Kisan Hub to a lab, KVK, RBK/RSK or officer. */
function LabRequests() {
  const toast = useToast();
  const [rows, setRows] = useState<CloudEscalation[] | null>(null);
  const [err, setErr] = useState("");
  const [replies, setReplies] = useState<Record<string, string>>({});
  const load = useCallback(() => {
    supabase!.from("escalations").select("*").order("created_at", { ascending: false }).limit(200)
      .then(({ data, error }) => { if (error) setErr(error.message); else setRows((data ?? []) as CloudEscalation[]); });
  }, []);
  useEffect(load, [load]);
  const update = async (id: string, patch: Partial<CloudEscalation>) => {
    const { error } = await supabase!.from("escalations").update(patch).eq("id", id);
    if (error) toast(`Could not save: ${error.message}`); else { toast("Saved."); load(); }
  };
  if (err) return <p role="alert" className="mt-6 font-semibold text-tomato-dark">Could not load lab requests: {err}. Run npm run setup:supabase again to add the table.</p>;
  if (!rows) return <p className="mt-6" role="status">Loading…</p>;
  if (!rows.length) return <p className="mt-8 text-center">No lab requests yet. Farmers send them from Kisan Hub → Labs & RBK.</p>;
  return (
    <ul className="mt-6 space-y-3">
      {rows.map((r) => (
        <li key={r.id} className="rounded-card border border-line bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="tiny">{fmt(r.created_at)} · to <strong>{r.lab_name}</strong></p>
            <Chip tone={r.status === "resolved" ? "green" : r.status === "in_review" ? "amber" : "tomato"}>{STATUS_LABEL[r.status]}</Chip>
          </div>
          <p className="mt-1 font-semibold text-forest">{r.crop ?? "Crop not given"}: {r.disease ?? "No diagnosis"}</p>
          <p className="small">{r.user_name || "No name"}{r.phone ? <> · <a className="underline" href={`tel:${r.phone}`}>+91 {r.phone}</a></> : null}{r.village ? ` · ${r.village}` : ""}{r.scan_id ? " · photo in Scans tab" : ""}</p>
          {r.note && <p className="mt-2 rounded-xl bg-surface p-3 text-sm">"{r.note}"</p>}
          <div className="mt-3 flex flex-col gap-2 md:flex-row">
            <input className="field-input" placeholder="Reply / advice for the farmer" value={replies[r.id] ?? r.lab_reply ?? ""} onChange={(e) => setReplies({ ...replies, [r.id]: e.target.value })} />
            <select className="field-input md:!w-40" value={r.status} onChange={(e) => update(r.id, { status: e.target.value as CloudEscalation["status"] })} aria-label="Status">
              {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <Button variant="secondary" onClick={() => update(r.id, { lab_reply: replies[r.id] ?? r.lab_reply ?? "" })}>Save reply</Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

interface ExpertRow { user_id: string; created_at: string; email: string; name: string | null; phone: string | null; organisation: string | null; approved: boolean }

/** Admin: approve or remove lab staff and scientists who signed up with their email. */
function Experts() {
  const toast = useToast();
  const [rows, setRows] = useState<ExpertRow[] | null>(null);
  const load = useCallback(() => {
    supabase!.from("experts").select("*").order("created_at", { ascending: false })
      .then(({ data, error }) => { if (error) toast(error.message); else setRows((data ?? []) as ExpertRow[]); });
  }, [toast]);
  useEffect(load, [load]);
  const setApproved = async (r: ExpertRow, approved: boolean) => {
    const { error } = await supabase!.from("experts").update({ approved }).eq("user_id", r.user_id);
    if (error) toast(error.message); else { toast(approved ? "Approved." : "Access removed."); load(); }
  };
  if (!rows) return <p className="mt-6" role="status">Loading…</p>;
  if (!rows.length) return <p className="mt-8 text-center">No experts yet. Labs and scientists sign up at <a className="underline" href="/hub/expert-login">/hub/expert-login</a>.</p>;
  return (
    <ul className="mt-6 space-y-3">
      {rows.map((r) => (
        <li key={r.user_id} className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-white p-4">
          <div>
            <p className="font-semibold text-forest">{r.name || "No name"} <span className="small">· {r.organisation || "No organisation"}</span></p>
            <p className="small">{r.email}{r.phone ? ` · ${r.phone}` : ""} · joined {fmt(r.created_at)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Chip tone={r.approved ? "green" : "amber"}>{r.approved ? "Approved" : "Waiting"}</Chip>
            {r.approved
              ? <Button variant="secondary" onClick={() => setApproved(r, false)}>Remove access</Button>
              : <Button onClick={() => setApproved(r, true)}>Approve</Button>}
          </div>
        </li>
      ))}
    </ul>
  );
}

function toCsv(rows: CloudScan[]) {
  const cols: (keyof CloudScan)[] = ["created_at", "user_name", "phone", "village", "device_id", "source", "is_plant", "plant", "is_tomato", "disease", "severity", "confidence", "feedback", "admin_note", "photo_path", "id"];
  const esc = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

export default function Admin() {
  const toast = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<CloudScan[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [more, setMore] = useState(true);
  const [q, setQ] = useState(""), [filter, setFilter] = useState<"all" | "diseased" | "healthy" | "not-tomato" | "not-plant">("all");
  const [open, setOpen] = useState<CloudScan | null>(null);
  const [tab, setTab] = useState<"scans" | "questions" | "labs" | "experts">("scans");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  const admin = isAdminSession(session);
  // Lab staff and scientists: approved experts see scans and lab requests (read, reply), nothing else.
  const [expert, setExpert] = useState<"unknown" | "approved" | "pending" | "none">("unknown");
  useEffect(() => {
    if (!supabase || !session || admin) { setExpert("none"); return; }
    supabase.from("experts").select("approved").eq("user_id", session.user.id).maybeSingle()
      .then(({ data }) => setExpert(data ? (data.approved ? "approved" : "pending") : "none"));
  }, [session, admin]);
  const staff = admin || expert === "approved";

  const load = useCallback(async (reset: boolean) => {
    if (!supabase) return;
    setLoading(true);
    const from = reset ? 0 : rows.length;
    const { data, error } = await supabase.from("scans").select("*").order("created_at", { ascending: false }).range(from, from + PAGE - 1);
    setLoading(false);
    if (error) { toast(`Could not load scans: ${error.message}`); return; }
    const got = (data ?? []) as CloudScan[];
    setRows((r) => (reset ? got : [...r, ...got]));
    setMore(got.length === PAGE);
    const paths = got.map((s) => s.photo_path);
    if (paths.length) {
      const signed = await supabase.storage.from("scan-photos").createSignedUrls(paths, 3600);
      const map: Record<string, string> = {};
      for (const s of signed.data ?? []) if (s.signedUrl && s.path) map[s.path] = s.signedUrl;
      setUrls((u) => ({ ...(reset ? {} : u), ...map }));
    }
  }, [rows.length, toast]);

  useEffect(() => { if (staff) load(true); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [staff]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === "diseased" && (r.disease === "Healthy" || !r.is_plant)) return false;
      if (filter === "healthy" && r.disease !== "Healthy") return false;
      if (filter === "not-tomato" && (r.is_tomato !== false || !r.is_plant)) return false;
      if (filter === "not-plant" && r.is_plant !== false && r.result?.subject !== "flower") return false;
      if (!term) return true;
      return [r.user_name, r.phone, r.village, r.disease, r.plant, r.device_id].some((v) => v?.toLowerCase().includes(term));
    });
  }, [rows, q, filter]);

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    return {
      total: rows.length,
      users: new Set(rows.map((r) => r.device_id)).size,
      today: rows.filter((r) => new Date(r.created_at).toDateString() === today).length,
      diseased: rows.filter((r) => r.is_plant && r.disease && r.disease !== "Healthy").length,
      notTomato: rows.filter((r) => r.is_tomato === false).length,
      top: Object.entries(rows.reduce<Record<string, number>>((m, r) => { if (r.is_plant && r.disease && r.disease !== "Healthy") m[r.disease] = (m[r.disease] ?? 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5),
    };
  }, [rows]);

  if (!cloudConfigured || !supabase) {
    return <div className="wrap py-10"><h1 className="page-title">Admin</h1><p className="mt-3">The cloud database is not connected yet. Run <code>npm run setup:supabase</code> once, then rebuild the site.</p></div>;
  }
  if (!ready || (session && !admin && expert === "unknown")) return <div className="wrap py-10" role="status">Loading…</div>;
  if (session && expert === "pending") {
    return (
      <div className="wrap max-w-xl py-14 text-center">
        <p className="eyebrow">Expert console</p>
        <h1 className="page-title">Waiting for approval</h1>
        <p className="mt-3">Your email ({session.user.email}) is verified. The Patra Chain admin will approve your account, then this page shows farmers' scans and lab requests.</p>
        <div className="mt-5"><Button variant="ghost" onClick={() => supabase!.auth.signOut()}><LogOut className="h-4 w-4" aria-hidden />Sign out</Button></div>
      </div>
    );
  }
  if (!session || !staff) {
    return (
      <div className="wrap py-10">
        <h1 className="page-title text-center">Admin sign-in</h1>
        <p className="mt-2 text-center">See every scan your users have taken.</p>
        <SignIn onError={session && !staff ? "This account is not an admin or approved expert." : ""} />
        {session && !staff && <div className="mt-3 text-center"><Button variant="ghost" onClick={() => supabase!.auth.signOut()}>Sign out</Button></div>}
        <p className="mt-6 text-center small">Lab, KVK or scientist? <a href="/hub/expert-login" className="font-semibold text-green-dark underline">Sign in with your email</a></p>
      </div>
    );
  }

  const saveNote = async () => {
    if (!open) return;
    const { error } = await supabase!.from("scans").update({ admin_note: note || null }).eq("id", open.id);
    if (error) { toast(error.message); return; }
    setRows((r) => r.map((x) => (x.id === open.id ? { ...x, admin_note: note || null } : x)));
    toast("Note saved.");
  };
  const remove = async (s: CloudScan) => {
    if (!confirm("Delete this scan and its photo? This cannot be undone.")) return;
    await supabase!.storage.from("scan-photos").remove([s.photo_path]);
    const { error } = await supabase!.from("scans").delete().eq("id", s.id);
    if (error) { toast(error.message); return; }
    setRows((r) => r.filter((x) => x.id !== s.id)); setOpen(null); toast("Deleted.");
  };
  const exportCsv = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([toCsv(shown)], { type: "text/csv" }));
    a.download = `patra-scans-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  };

  return (
    <div className="wrap py-8 md:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="eyebrow">{admin ? "Admin" : "Expert console"}</p><h1 className="page-title">{admin ? "All scans" : "Farmers' scans"}</h1><p className="small">Signed in as {session.user.email}</p></div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => load(true)} loading={loading}><RefreshCw className="h-4 w-4" aria-hidden />Refresh</Button>
          <Button variant="secondary" onClick={exportCsv} disabled={!shown.length}><Download className="h-4 w-4" aria-hidden />CSV</Button>
          <Button variant="ghost" onClick={() => supabase!.auth.signOut()}><LogOut className="h-4 w-4" aria-hidden />Sign out</Button>
        </div>
      </div>

      <div role="tablist" aria-label="Admin sections" className="mt-6 inline-flex flex-wrap gap-1 rounded-xl bg-surface p-1">
        {((admin ? [["scans", "Scans"], ["labs", "Lab requests"], ["questions", "Farmer questions"], ["experts", "Experts"]] : [["scans", "Scans"], ["labs", "Lab requests"]]) as [typeof tab, string][]).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`min-h-[44px] rounded-lg px-4 text-sm font-semibold ${tab === id ? "bg-white text-forest shadow-soft" : "text-muted hover:text-forest"}`}>{label}</button>
        ))}
      </div>
      {tab === "questions" ? <Questions /> : tab === "labs" ? <LabRequests /> : tab === "experts" ? <Experts /> : <>
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[["Scans loaded", stats.total], ["Users (phones)", stats.users], ["Today", stats.today], ["With a problem", stats.diseased], ["Not tomato", stats.notTomato]].map(([l, v]) => (
          <div key={l} className="rounded-card border border-line bg-white p-4"><p className="small">{l}</p><p className="font-heading text-3xl font-extrabold text-forest">{v}</p></div>
        ))}
      </div>
      {stats.top.length > 0 && <div className="mt-3 flex flex-wrap gap-2"><span className="small font-semibold">Most common:</span>{stats.top.map(([d, n]) => <Chip key={d} tone="tomato">{d}: {n}</Chip>)}</div>}

      <div className="mt-6 flex flex-col gap-3 md:flex-row">
        <label className="relative flex-1"><span className="sr-only">Search</span>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input className="field-input pl-9" placeholder="Search name, phone, village, disease" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <select className="field-input md:w-56" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} aria-label="Filter">
          <option value="all">All scans</option><option value="diseased">With a problem</option><option value="healthy">Healthy</option>
          <option value="not-tomato">Not tomato</option><option value="not-plant">Not a leaf / flower</option>
        </select>
      </div>

      {!shown.length && !loading && <p className="mt-8 text-center">No scans yet.</p>}
      <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((s) => (
          <li key={s.id}>
            <button className="w-full overflow-hidden rounded-card border border-line bg-white text-left hover:shadow-soft" onClick={() => { setOpen(s); setNote(s.admin_note ?? ""); }}>
              <div className="aspect-[4/3] bg-surface">{urls[s.photo_path] && <img src={urls[s.photo_path]} alt="" className="h-full w-full object-cover" loading="lazy" />}</div>
              <div className="space-y-1 p-3">
                <p className="font-heading font-bold text-forest">{s.is_plant === false ? (s.result?.subject === "flower" ? "Flower, not a leaf" : "Not a plant") : s.disease ?? "Unknown"}</p>
                <div className="flex flex-wrap gap-1.5">
                  {s.plant && <Chip tone={s.is_tomato ? "green" : "amber"}>{s.plant}</Chip>}
                  {s.severity && s.severity !== "None" && <Chip tone="tomato">{s.severity}</Chip>}
                  <Chip tone="muted">{s.source === "ai-vision" ? "AI vision" : "On phone"}</Chip>
                </div>
                <p className="small">{s.user_name || "No name"}{s.village ? ` · ${s.village}` : ""}{s.phone ? ` · ${s.phone}` : ""}</p>
                <p className="tiny">{fmt(s.created_at)}</p>
              </div>
            </button>
          </li>
        ))}
      </ul>
      {more && rows.length > 0 && <div className="mt-6 text-center"><Button variant="secondary" onClick={() => load(false)} loading={loading}>Load more</Button></div>}
      </>}

      <BottomSheet open={!!open} onClose={() => setOpen(null)} title={open ? `${open.user_name || "No name"} · ${fmt(open.created_at)}` : ""}>
        {open && (
          <div className="space-y-4">
            <p className="small">Phone: {open.phone || "–"} · Village: {open.village || "–"} · Device: {open.device_id.slice(0, 8)}{open.feedback ? ` · Farmer said: ${open.feedback}` : ""}</p>
            {urls[open.photo_path] && <LeafReport url={urls[open.photo_path]} result={open.result} source={open.source} />}
            {admin && <>
              <label className="block"><span className="field-label">Admin note</span><textarea className="field-input min-h-[80px]" value={note} onChange={(e) => setNote(e.target.value)} /></label>
              <div className="flex flex-wrap gap-2">
                <Button onClick={saveNote}>Save note</Button>
                <Button variant="danger" onClick={() => remove(open)}><Trash2 className="h-4 w-4" aria-hidden />Delete</Button>
              </div>
            </>}
            {!admin && open.admin_note && <p className="rounded-xl bg-surface p-3 text-sm"><strong>Admin note:</strong> {open.admin_note}</p>}
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
