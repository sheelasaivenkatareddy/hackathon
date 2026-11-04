// Expert Labs & RBK Connect: a searchable directory of labs, ICAR institutes, KVKs, RBKs/RSKs and officers across
// AP, Telangana and Karnataka, with Call and WhatsApp buttons and a channel to forward a leaf scan for review.
import { AnimatePresence, motion } from "framer-motion";
import { BadgeCheck, CheckCircle2, ExternalLink, Info, MessageCircle, Phone, Search, Send, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { escalateInCloud } from "../../lib/cloud";
import { uid } from "../../lib/db";
import { DIRECTORY, DirEntry, DirType, TYPE_LABEL, telOf } from "../directory";
import { HubScan, STATES, StateId, addEscalation, useEscalations, useHubScans, useUser } from "../store";
import { Glass, PageHead, Pill } from "../ui";

const TYPES: DirType[] = ["Helpline", "ICAR", "University", "Lab", "KVK", "RBK", "RSK", "Officer"];
const TYPE_TONE: Record<DirType, "cyan" | "lime" | "pink" | "amber" | "slate"> = { Helpline: "lime", ICAR: "cyan", University: "cyan", Lab: "pink", KVK: "amber", RBK: "lime", RSK: "lime", Officer: "slate" };

const scanText = (s: HubScan | undefined, who: { name: string; phone: string; village: string; district: string }) => s
  ? `Patra Lens leaf scan\nCrop: ${s.crop}\nResult: ${s.result.healthy ? "Healthy" : s.result.disease.name} (${s.result.disease.severity}, ${Math.round(s.result.disease.confidence * 100)}% sure)\nDate: ${new Date(s.date).toLocaleString("en-IN")}\nFarmer: ${who.name}, +91 ${who.phone}, ${who.village}, ${who.district}\nPlease advise.`
  : `Namaskaram, I am ${who.name} from ${who.village}, ${who.district}. I need advice on my crop. Phone +91 ${who.phone}.`;

export default function Labs() {
  const user = useUser()!;
  const scans = useHubScans();
  const escalations = useEscalations();
  const [params] = useSearchParams();
  const [q, setQ] = useState("");
  const [state, setState] = useState<StateId | "all">(user.state);
  const [type, setType] = useState<DirType | "all">(params.get("scan") ? "all" : "all");
  const [target, setTarget] = useState<DirEntry | null>(null);
  const [scanId, setScanId] = useState(params.get("scan") ?? scans[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const fromScan = !!params.get("scan");
  const scan = scans.find((s) => s.id === scanId);

  const list = useMemo(() => DIRECTORY.filter((e) =>
    (state === "all" || e.state === state || e.state === "IN") &&
    (type === "all" || e.type === type) &&
    (!fromScan || e.acceptsScans || e.type === "Helpline") &&
    `${e.name} ${e.district} ${e.place} ${e.services.join(" ")} ${(e.crops ?? []).join(" ")}`.toLowerCase().includes(q.toLowerCase()),
  ).sort((a, b) => Number(b.state === user.state && b.district === user.district) - Number(a.state === user.state && a.district === user.district)), [q, state, type, fromScan, user.state, user.district]);

  const send = async () => {
    if (!target) return;
    setSending(true);
    const res = await escalateInCloud({
      scanId: scan?.cloudId, lab: { id: target.id, name: target.name }, crop: scan?.crop,
      disease: scan ? (scan.result.healthy ? "Healthy" : scan.result.disease.name) : undefined, note,
      summary: scan ? { plant: scan.result.plant, disease: scan.result.disease, detections: scan.result.detections.length, lat: scan.lat, lon: scan.lon, date: scan.date } : undefined,
    });
    addEscalation({ id: uid(), scanId: scan?.id ?? "", labId: target.id, labName: target.name, date: new Date().toISOString(), note, status: res.ok ? "sent" : "saved-on-phone", cloudId: res.ok ? res.id : undefined });
    setSending(false); setSent(res.ok ? "sent" : "local"); setNote("");
  };

  const who = { name: user.name, phone: user.phone, village: user.village, district: user.district };

  return (
    <div>
      <PageHead eyebrow="Expert Labs & RBK Connect" title={<>Talk to a <span className="neon-text">real expert</span></>}
        sub="Pathology labs, ICAR institutes, KVKs, Rythu Bharosa Kendras, Raitha Samparka Kendras and agriculture officers. Forward a scan for review, or call and WhatsApp directly." />

      {fromScan && scan && (
        <Glass className="mb-5 flex flex-wrap items-center gap-3 !border-neon-cyan/40">
          <img src={scan.thumb} alt="" className="h-14 w-14 rounded-xl object-cover ring-1 ring-white/10" />
          <div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-wider text-neon-cyan">Scan ready to forward</p><p className="truncate font-bold text-white">{scan.crop}: {scan.result.healthy ? "Healthy" : scan.result.disease.name}</p><p className="text-xs text-slate-400">Choose a lab or RBK below and tap "Send scan".</p></div>
        </Glass>
      )}

      <Glass className="mb-5">
        <div className="flex flex-col gap-3 md:flex-row">
          <label className="relative flex-1"><span className="sr-only">Search</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden />
            <input className="hub-input !pl-9" placeholder="Search by name, district, crop or service" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <select className="hub-input md:!w-56" value={state} onChange={(e) => setState(e.target.value as StateId | "all")} aria-label="State">
            <option value="all">All states</option>
            {(Object.keys(STATES) as StateId[]).map((s) => <option key={s} value={s}>{STATES[s].name}</option>)}
          </select>
        </div>
        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
          {(["all", ...TYPES] as const).map((t) => (
            <button key={t} onClick={() => setType(t)} aria-pressed={type === t} className={`min-h-[34px] shrink-0 rounded-full border px-3 text-xs font-bold ${type === t ? "border-neon-cyan bg-neon-cyan/15 text-neon-cyan" : "border-white/10 text-slate-300"}`}>{t === "all" ? "All" : TYPE_LABEL[t]}</button>
          ))}
        </div>
      </Glass>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map((e, i) => {
          const tel = telOf(e), direct = !!e.phone;
          const wa = e.whatsapp ? `https://wa.me/91${e.whatsapp.replace(/\D/g, "").slice(-10)}?text=${encodeURIComponent(scanText(scan, who))}` : `https://wa.me/?text=${encodeURIComponent(`To: ${e.name}, ${e.place}\n${scanText(scan, who)}`)}`;
          return (
            <Glass key={e.id} delay={Math.min(i, 8)} hover className="flex flex-col">
              <div className="flex flex-wrap items-center gap-1.5">
                <Pill tone={TYPE_TONE[e.type]}>{TYPE_LABEL[e.type]}</Pill>
                {e.verified ? <Pill tone="lime"><BadgeCheck className="h-3 w-3" aria-hidden />Verified number</Pill> : <Pill tone="slate">Listing to verify</Pill>}
                {e.state === user.state && e.district === user.district && <Pill tone="pink">Near you</Pill>}
              </div>
              <h3 className="hub-h3 mt-2">{e.name}</h3>
              <p className="text-xs text-slate-400">{e.place}{e.state !== "IN" ? ` · ${STATES[e.state].name}` : ""}</p>
              <ul className="mt-2 flex-1 space-y-0.5 text-sm text-slate-300">{e.services.map((s) => <li key={s}>• {s}</li>)}</ul>
              {e.hours && <p className="mt-2 text-xs text-slate-400">{e.hours}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={`tel:${tel}`} className="hub-btn-ghost !min-h-[40px] flex-1 !border-neon-lime/40 !text-neon-lime"><Phone className="h-4 w-4" aria-hidden />{direct ? `Call ${e.phone}` : "Call via KCC"}</a>
                {e.type !== "Helpline" && <a href={wa} target="_blank" rel="noreferrer" className="hub-btn-ghost !min-h-[40px] flex-1 !border-[#25D366]/50 !text-[#25D366]"><MessageCircle className="h-4 w-4" aria-hidden />WhatsApp</a>}
                {e.acceptsScans && <button onClick={() => { setTarget(e); setSent(null); }} className="hub-btn-primary !min-h-[40px] w-full"><Send className="h-4 w-4" aria-hidden />Send scan for review</button>}
                {e.website && <a href={e.website} target="_blank" rel="noreferrer" className="flex w-full items-center justify-center gap-1 text-xs font-semibold text-neon-cyan">Website<ExternalLink className="h-3 w-3" aria-hidden /></a>}
              </div>
            </Glass>
          );
        })}
      </div>
      {!list.length && <p className="hub-muted mt-6 text-center">Nothing matches. Try another search or "All states".</p>}

      <p className="mt-5 flex items-start gap-2 text-xs text-slate-500"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />Office numbers change often, so listings without a verified number call the free Kisan Call Centre (1800-180-1551), which connects you to the local officer. WhatsApp opens with the scan details ready to send to a contact you choose.</p>

      {escalations.length > 0 && (
        <Glass className="mt-5">
          <h2 className="hub-h3 mb-2">My requests</h2>
          <ul className="divide-y divide-white/5 text-sm">
            {escalations.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-slate-200"><strong className="text-white">{x.labName}</strong> · {new Date(x.date).toLocaleString("en-IN")}{x.note ? ` · "${x.note}"` : ""}</span>
                <Pill tone={x.status === "sent" ? "lime" : "amber"}>{x.status === "sent" ? "Delivered" : "Saved on phone"}</Pill>
              </li>
            ))}
          </ul>
        </Glass>
      )}

      <AnimatePresence>
        {target && (
          <motion.div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm md:items-center md:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setTarget(null)}>
            <motion.div role="dialog" aria-label="Send scan" className="hub w-full max-w-lg rounded-t-3xl border border-white/10 p-5 md:rounded-3xl" initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }} onClick={(ev) => ev.stopPropagation()}>
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-xs font-bold uppercase tracking-wider text-neon-cyan">Send for review</p><h2 className="hub-h3 mt-1">{target.name}</h2></div>
                <button onClick={() => setTarget(null)} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-300 hover:bg-white/10"><X className="h-5 w-5" aria-hidden /></button>
              </div>
              {sent ? (
                <div className="mt-5 text-center">
                  <CheckCircle2 className="mx-auto h-14 w-14 text-neon-lime" aria-hidden />
                  <p className="mt-3 font-heading text-xl font-bold text-white">{sent === "sent" ? "Request delivered" : "Saved on your phone"}</p>
                  <p className="hub-muted mt-1">{sent === "sent" ? "The lab team sees it in their console with your photo, diagnosis and phone number." : "The cloud database is not connected yet. Use WhatsApp or Call to reach them now."}</p>
                  <button className="hub-btn-primary mt-5" onClick={() => setTarget(null)}>Done</button>
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  {scans.length ? (
                    <label className="block"><span className="hub-label">Scan to send</span>
                      <select className="hub-input" value={scanId} onChange={(e) => setScanId(e.target.value)}>
                        {scans.map((s) => <option key={s.id} value={s.id}>{s.crop}: {s.result.healthy ? "Healthy" : s.result.disease.name} · {new Date(s.date).toLocaleDateString("en-IN")}</option>)}
                      </select>
                    </label>
                  ) : <p className="rounded-xl border border-neon-amber/30 bg-neon-amber/5 p-3 text-sm text-slate-200">No scans yet. You can still send a question with your contact details.</p>}
                  <label className="block"><span className="hub-label">Note for the expert (optional)</span>
                    <textarea className="hub-input min-h-[90px]" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Spots spreading fast after last week's rain, 1 acre affected" maxLength={1000} />
                  </label>
                  <p className="text-xs text-slate-400">Shared with the lab: your name, +91 {user.phone}, {user.village}, the photo and the AI diagnosis.</p>
                  <button className="hub-btn-primary w-full" onClick={send} disabled={sending}><Send className="h-4 w-4" aria-hidden />{sending ? "Sending…" : "Send now"}</button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
