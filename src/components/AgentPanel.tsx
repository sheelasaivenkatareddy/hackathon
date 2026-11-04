// The AI farm assistant: a button on every page that opens a chat panel at the side of the screen.
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Leaf, Mic, MicOff, Send, Trash2, Volume2, X } from "lucide-react";
import { Fragment, ReactNode, useEffect, useRef, useState } from "react";
import { ChatMsg, askAgent, useLatestScan } from "../lib/agent";
import { useI18n } from "../lib/i18n";

const STORE_KEY = "patra-agent-chat";
const AGENT_LANGS = [
  { id: "en", label: "EN", speech: "en-IN" },
  { id: "te", label: "తె", speech: "te-IN" },
  { id: "hi", label: "हि", speech: "hi-IN" },
  { id: "kn", label: "ಕ", speech: "kn-IN" },
] as const;
type AgentLang = (typeof AGENT_LANGS)[number]["id"];

const SUGGESTIONS: Record<AgentLang, string[]> = {
  en: ["What is wrong with my tomato leaf?", "How much urea should I give tomato plants?", "How often should I water tomatoes?", "Which spray works for early blight?"],
  te: ["నా టమోటా ఆకుకు ఏమైంది?", "టమోటా మొక్కలకు ఎంత యూరియా వేయాలి?", "టమోటాకు ఎన్ని రోజులకు నీరు పెట్టాలి?"],
  hi: ["मेरी टमाटर की पत्ती को क्या हुआ है?", "टमाटर के पौधों को कितना यूरिया दें?", "टमाटर को कितनी बार पानी दें?"],
  kn: ["ನನ್ನ ಟೊಮೆಟೊ ಎಲೆಗೆ ಏನಾಗಿದೆ?", "ಟೊಮೆಟೊಗೆ ಎಷ್ಟು ಯೂರಿಯಾ ಹಾಕಬೇಕು?"],
};

const load = (): ChatMsg[] => { try { return JSON.parse(sessionStorage.getItem(STORE_KEY) ?? "[]"); } catch { return []; } };
const save = (m: ChatMsg[]) => { try { sessionStorage.setItem(STORE_KEY, JSON.stringify(m.slice(-40))); } catch { /* chat still works until reload */ } };

/** Bold (**x**), bullets (- x) and numbered lines, which is all the assistant uses. */
function Formatted({ text }: { text: string }) {
  const inline = (s: string) => s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <Fragment key={i}>{p}</Fragment>));
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const Tag = list.ordered ? "ol" : "ul";
    blocks.push(<Tag key={blocks.length} className={`my-1 space-y-1 pl-5 ${list.ordered ? "list-decimal" : "list-disc"}`}>{list.items.map((it, i) => <li key={i}>{inline(it)}</li>)}</Tag>);
    list = null;
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const bullet = line.match(/^[-*•]\s+(.*)/), num = line.match(/^\d+[.)]\s+(.*)/);
    if (bullet || num) {
      const ordered = !!num;
      if (!list || list.ordered !== ordered) { flush(); list = { ordered, items: [] }; }
      list.items.push((bullet ?? num)![1]);
      continue;
    }
    flush();
    if (line) blocks.push(<p key={blocks.length} className="my-1">{inline(line.replace(/^#+\s*/, ""))}</p>);
  }
  flush();
  return <>{blocks}</>;
}

export default function AgentPanel() {
  const { lang: appLang } = useI18n();
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState<AgentLang>(appLang === "te" || appLang === "kn" ? appLang : "en");
  const [msgs, setMsgs] = useState<ChatMsg[]>(load);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const [listening, setListening] = useState(false);
  const [useScan, setUseScan] = useState(true);
  const scan = useLatestScan();
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recRef = useRef<any>(null);

  useEffect(() => { save(msgs); endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 250); }, [open]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const speechLang = AGENT_LANGS.find((l) => l.id === lang)!.speech;
  const SpeechRec = typeof window !== "undefined" ? (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition : undefined;

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    const next: ChatMsg[] = [...msgs, { role: "user", content: q }];
    setMsgs(next); setInput(""); setError(""); setBusy(true);
    const r = await askAgent(next, lang, useScan && !!scan);
    setBusy(false);
    if (r.ok) { setMsgs([...next, { role: "assistant", content: r.answer }]); setOffline(!!r.offline); }
    else { setError(r.message); setMsgs(msgs); setInput(q); }
  };

  const toggleMic = () => {
    if (!SpeechRec) return;
    if (listening) { recRef.current?.stop(); return; }
    const rec = new SpeechRec();
    rec.lang = speechLang; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onresult = (e: any) => { const t = e.results[0][0].transcript; setInput((v) => (v ? `${v} ${t}` : t)); };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec; setListening(true); rec.start();
  };
  const speak = (text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/\*\*/g, "").replace(/^[-*•]\s+/gm, ""));
    u.lang = speechLang;
    window.speechSynthesis.speak(u);
  };

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button key="fab" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
            onClick={() => setOpen(true)} aria-label="Ask the AI farm assistant"
            className="fixed bottom-24 right-4 z-[650] flex min-h-[56px] items-center gap-2 rounded-full bg-forest px-4 py-3 font-semibold text-white shadow-soft ring-2 ring-lime/70 hover:brightness-110 md:bottom-6 md:right-6">
            <Bot className="h-6 w-6" aria-hidden /><span className="hidden sm:inline">Ask AI</span>
            {scan && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-lime" aria-hidden />}
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <>
            <motion.div key="backdrop" className="fixed inset-0 z-[690] bg-forest/30 md:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
            <motion.aside key="panel" role="dialog" aria-label="AI farm assistant"
              className="fixed inset-y-0 right-0 z-[700] flex w-full flex-col border-l border-line bg-white shadow-2xl sm:w-[420px]"
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 320, damping: 34 }}>
              <header className="flex items-center gap-3 bg-forest px-4 py-3 text-white">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-lime text-forest"><Bot className="h-6 w-6" aria-hidden /></span>
                <div className="min-w-0 flex-1">
                  <p className="font-heading font-bold leading-tight">Patra Lens Assistant</p>
                  <p className="truncate text-xs text-white/75">{offline ? "Offline: searching the disease library" : "AI crop doctor · diseases, fertilizer, watering"}</p>
                </div>
                <div className="flex rounded-full bg-white/10 p-0.5" role="group" aria-label="Answer language">
                  {AGENT_LANGS.map((l) => (
                    <button key={l.id} onClick={() => setLang(l.id)} aria-pressed={lang === l.id} className={`h-8 min-w-[32px] rounded-full px-1.5 text-xs font-bold ${lang === l.id ? "bg-lime text-forest" : "text-white/80 hover:text-white"}`}>{l.label}</button>
                  ))}
                </div>
                <button onClick={() => setOpen(false)} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10"><X className="h-5 w-5" aria-hidden /></button>
              </header>

              {scan && (
                <label className="flex cursor-pointer items-center gap-2 border-b border-line bg-green-tint/60 px-4 py-2 text-sm">
                  <input type="checkbox" checked={useScan} onChange={(e) => setUseScan(e.target.checked)} className="h-4 w-4 accent-green" />
                  <Leaf className="h-4 w-4 text-green" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">Use my last scan: <strong>{scan.is_plant ? `${scan.plant} · ${scan.disease.name}` : "not a leaf"}</strong></span>
                </label>
              )}

              <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
                {!msgs.length && (
                  <div className="space-y-3">
                    <div className="rounded-2xl rounded-tl-sm bg-surface px-4 py-3">
                      <p className="font-semibold text-forest">Namaste! I'm your crop doctor.</p>
                      <p className="mt-1 text-sm">Ask me about plant diseases, fertilizer doses, sprays and watering, in English, Telugu, Hindi or Kannada. Scan a leaf first and I can explain your result.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(scan?.is_plant ? [`Explain my scan: ${scan.disease.name}`, ...SUGGESTIONS[lang].slice(1)] : SUGGESTIONS[lang]).map((s) => (
                        <button key={s} onClick={() => send(s)} className="rounded-full border border-green/40 bg-white px-3 py-1.5 text-left text-sm text-green-dark hover:bg-green-tint">{s}</button>
                      ))}
                    </div>
                  </div>
                )}
                {msgs.map((m, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                    <div className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${m.role === "user" ? "rounded-tr-sm bg-green text-white" : "rounded-tl-sm bg-surface text-ink"}`}>
                      {m.role === "assistant" ? <Formatted text={m.content} /> : m.content}
                      {m.role === "assistant" && "speechSynthesis" in window && (
                        <button onClick={() => speak(m.content)} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-green-dark hover:underline"><Volume2 className="h-3.5 w-3.5" aria-hidden />Read aloud</button>
                      )}
                    </div>
                  </motion.div>
                ))}
                {busy && (
                  <div className="flex justify-start" role="status" aria-label="The assistant is typing">
                    <div className="flex gap-1 rounded-2xl rounded-tl-sm bg-surface px-4 py-3">
                      {[0, 1, 2].map((d) => <motion.span key={d} className="h-2 w-2 rounded-full bg-green" animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.9, delay: d * 0.15 }} />)}
                    </div>
                  </div>
                )}
                {error && <p role="alert" className="rounded-xl bg-tomato-tint px-3 py-2 text-sm font-semibold text-tomato-dark">{error}</p>}
                <div ref={endRef} />
              </div>

              <form className="border-t border-line p-3" onSubmit={(e) => { e.preventDefault(); send(input); }}>
                <div className="flex items-end gap-2">
                  <textarea ref={inputRef} rows={1} value={input} onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                    placeholder="Ask about your crop…" aria-label="Your question"
                    className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border border-line px-4 py-2.5 focus:border-green focus:outline-none" />
                  {SpeechRec && (
                    <button type="button" onClick={toggleMic} aria-label={listening ? "Stop listening" : "Speak your question"} aria-pressed={listening}
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${listening ? "animate-pulse border-tomato bg-tomato-tint text-tomato-dark" : "border-line text-forest hover:bg-surface"}`}>
                      {listening ? <MicOff className="h-5 w-5" aria-hidden /> : <Mic className="h-5 w-5" aria-hidden />}
                    </button>
                  )}
                  <button type="submit" disabled={!input.trim() || busy} aria-label="Send" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green text-white disabled:opacity-40"><Send className="h-5 w-5" aria-hidden /></button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <p className="tiny">AI advice can be wrong. Follow product labels and ask your KVK.</p>
                  {msgs.length > 0 && <button type="button" onClick={() => { setMsgs([]); setError(""); }} className="flex items-center gap-1 text-xs font-semibold text-muted hover:text-forest"><Trash2 className="h-3.5 w-3.5" aria-hidden />Clear</button>}
                </div>
              </form>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
