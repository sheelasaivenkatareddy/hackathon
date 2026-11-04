// Floating voice agent on every page: tap the orb and talk. It answers aloud in the farmer's language (Claude via
// ask-agent in voice mode), opens screens by voice ("open mandi", "మండి ధరలు చూపించు"), reads the current screen
// aloud as a voice-over, and in hands-free mode keeps listening after each answer.
import { AnimatePresence, motion } from "framer-motion";
import { AudioLines, BookOpenText, Mic, Repeat, Square, Volume2, Wrench, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { ChatMsg } from "../lib/agent";
import { answerQuestion } from "../hub/answer";
import { VoiceLang, setHubLang, useHubLang } from "../hub/store";
import { GREETING, UI, VOICE_LANGS, VoiceCheck, askMic, canListen, checkVoice, isGreeting, listen, listenError, noVoiceFor, speak, stopSpeaking, unlockSpeech, voiceHelp } from "../hub/voice";
import { INTRO, ROUTE, STOP_REPLY, openingSentence, pageText, parseCommand } from "../hub/voiceAgent";

type Phase = "idle" | "listening" | "thinking" | "speaking";

const pref = (k: string) => { try { return localStorage.getItem(k) === "1"; } catch { return false; } };
const savePref = (k: string, v: boolean) => { try { localStorage.setItem(k, v ? "1" : "0"); } catch { /* blocked */ } };
const isWindowsNotEdge = () => /Windows/.test(navigator.userAgent) && !/Edg\//.test(navigator.userAgent);
const introFor =(path: string, l: VoiceLang) => (INTRO[path] ?? INTRO[path.replace(/\/$/, "")])?.[l];

/** `lift` raises the orb above the chat button on the main site. */
export default function VoiceAgent({ lift = false }: { lift?: boolean }) {
  const lang = useHubLang();
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [heard, setHeard] = useState("");
  const [said, setSaid] = useState("");
  const [err, setErr] = useState("");
  const [handsFree, setHandsFree] = useState(() => pref("va:handsfree"));
  const [narrate, setNarrate] = useState(() => pref("va:narrate"));
  const [source, setSource] = useState("");

  // Refs, because the hands-free loop outlives a render.
  const live = useRef(false), handsRef = useRef(handsFree), langRef = useRef(lang), stopRef = useRef<() => void>(() => undefined);
  const history = useRef<ChatMsg[]>([]);
  useEffect(() => { handsRef.current = handsFree; savePref("va:handsfree", handsFree); }, [handsFree]);
  useEffect(() => { savePref("va:narrate", narrate); }, [narrate]);
  useEffect(() => { langRef.current = lang; }, [lang]);

  const sayAsync = (text: string, l: VoiceLang) => new Promise<void>((resolve) => {
    setSaid(text);
    setPhase("speaking");
    speak(text, l, resolve);
  });

  /** The voice-over: the AI explains the screen in the farmer's language; offline, the built-in intro or the page text. */
  const voiceOver = useCallback(async (l: VoiceLang): Promise<{ text: string; lang: VoiceLang }> => {
    const text = pageText();
    const intro = introFor(pathname, l);
    if (text) {
      setPhase("thinking");
      const res = await answerQuestion([{ role: "user", content: `Explain this app screen to me in 3 or 4 short spoken sentences: what it shows and what I can do here. Screen text: ${text}` }], l, true);
      if (res.source === "Claude AI" || res.source === "AI") return { text: res.text, lang: l };
    }
    if (intro) return { text: intro, lang: l };
    return { text: text || "This screen has no text to read.", lang: "en" };
  }, [pathname]);

  const handle = async (q: string): Promise<{ text: string; lang: VoiceLang; end?: boolean }> => {
    const l = langRef.current;
    const cmd = parseCommand(q);
    if (cmd?.kind === "stop") return { text: STOP_REPLY[l], lang: l, end: true };
    if (cmd?.kind === "go") { nav(ROUTE[cmd.dest]); return { text: openingSentence(cmd.dest, l), lang: l }; }
    if (cmd?.kind === "read") return voiceOver(l);
    if (isGreeting(q)) return { text: GREETING[l], lang: l };
    setPhase("thinking");
    history.current = [...history.current, { role: "user" as const, content: q }].slice(-12);
    const answer = await answerQuestion(history.current, l, true);
    setSource(answer.source);
    history.current = [...history.current, { role: "assistant" as const, content: answer.text }];
    return answer;
  };

  const turn = async (emptyTries = 0): Promise<void> => {
    if (!live.current) return;
    setPhase("listening"); setHeard(""); setErr("");
    let q = "";
    try {
      const l = listen(langRef.current, setHeard);
      stopRef.current = l.stop;
      q = await l.done;
    } catch (e) {
      live.current = false; setPhase("idle");
      setErr(listenError((e as Error).message));
      return;
    }
    if (!live.current) return;
    if (!q) {
      if (handsRef.current && emptyTries < 1) return turn(emptyTries + 1);
      live.current = false; setPhase("idle"); return;
    }
    const r = await handle(q);
    if (!live.current) return;
    await sayAsync(r.text, r.lang);
    if (live.current && handsRef.current && !r.end) return turn();
    live.current = false; setPhase("idle");
  };

  const start = async () => {
    unlockSpeech(); // must run inside the tap, before any await, or phones stay silent
    if (!canListen()) { setErr(listenError("unsupported")); setOpen(true); return; }
    stopSpeaking();
    // One tap = start listening. The settings panel stays closed; a small bubble shows what was heard and said.
    live.current = true; setSaid(""); setHeard("");
    // Ask for the microphone first, so a blocked mic shows a clear message instead of silence.
    if (!(await askMic())) { live.current = false; setErr(listenError("not-allowed")); setOpen(true); return; }
    turn();
  };

  const [check, setCheck] = useState<VoiceCheck | null>(null);
  const runCheck = async () => {
    unlockSpeech();
    stopAll(); setErr("");
    const c = await checkVoice(langRef.current);
    if (c.mic !== "granted" && (await askMic())) c.mic = "granted";
    setCheck(c);
    await sayAsync(GREETING[langRef.current], langRef.current);
    setPhase("idle");
  };
  const stopAll = () => { live.current = false; stopRef.current(); stopSpeaking(); setPhase("idle"); };
  const readPage = async () => {
    unlockSpeech();
    stopAll(); setOpen(true);
    live.current = true;
    const r = await voiceOver(langRef.current);
    if (!live.current) return;
    await sayAsync(r.text, r.lang);
    live.current = false; setPhase("idle");
  };

  // Narrate each screen as it opens.
  useEffect(() => {
    if (!narrate || live.current) return;
    const intro = introFor(pathname, langRef.current);
    if (!intro) return;
    const t = setTimeout(() => { setSaid(intro); speak(intro, langRef.current); }, 700);
    return () => clearTimeout(t);
  }, [pathname, narrate]);
  useEffect(() => () => { live.current = false; stopSpeaking(); }, []);

  const t = UI[lang];
  const busy = phase !== "idle";
  const pos = lift ? "bottom-[10.5rem] md:bottom-24" : "bottom-24 lg:bottom-6";
  const ring = phase === "listening" ? "from-neon-pink to-neon-cyan" : phase === "thinking" ? "from-neon-amber to-neon-pink" : phase === "speaking" ? "from-neon-lime to-neon-cyan" : "from-neon-cyan to-neon-teal";

  return (
    <div data-voice-agent className={`lit fixed right-4 ${lift ? "z-[660]" : "z-50"} flex flex-col items-end gap-3 md:right-6 ${pos}`}>
      <AnimatePresence>
        {open && (
          <motion.div role="dialog" aria-label="Voice agent" initial={{ opacity: 0, y: 12, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.96 }}
            className="w-[min(340px,calc(100vw-2rem))] rounded-3xl border border-white/10 bg-[#081226]/95 p-4 text-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.5),0_0_0_1px_rgba(34,211,238,0.15)] backdrop-blur-xl">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 font-heading text-base font-extrabold text-white"><AudioLines className="h-5 w-5 text-[#22D3EE]" aria-hidden />Voice Agent</p>
              <button onClick={() => { stopAll(); setOpen(false); }} aria-label="Close voice agent" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" aria-hidden /></button>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Language">
              {VOICE_LANGS.map((l) => (
                <button key={l.id} onClick={() => setHubLang(l.id)} aria-pressed={lang === l.id}
                  className={`min-h-[32px] rounded-full border px-2.5 text-xs font-bold ${lang === l.id ? "border-[#22D3EE] bg-[#22D3EE]/15 text-[#22D3EE]" : "border-white/10 text-slate-300 hover:border-white/30"}`}>{l.native}</button>
              ))}
            </div>

            <div className="mt-4 min-h-[88px] rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm" aria-live="polite">
              <p className="text-xs font-bold uppercase tracking-wider text-[#22D3EE]">{phase === "idle" ? t.tap : t[phase]}</p>
              {heard && <p className="mt-1.5 text-slate-300">“{heard}”</p>}
              {said && <p className="mt-1.5 max-h-40 overflow-y-auto whitespace-pre-wrap text-white">{said.replace(/\*\*/g, "")}</p>}
              {!heard && !said && <p className="mt-1.5 text-slate-400">Try: “హాయ్”, “మండి ధరలు చూపించు”, “open weather”, “read this page”, or ask about your crop.</p>}
              {err && <p role="alert" className="mt-1.5 font-semibold text-[#F87171]">{err}</p>}
              {noVoiceFor(lang) && (
                <div className="mt-1.5">
                  <p className="text-xs text-[#FBBF24]">{voiceHelp(lang)}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {isWindowsNotEdge() && (
                      <a href={`microsoft-edge:${window.location.href}`} className="inline-flex min-h-[36px] items-center rounded-lg bg-[#22D3EE] px-3 text-xs font-bold text-[#040A18] hover:brightness-110">Open in Edge</a>
                    )}
                    {lang !== "en" && <button onClick={() => setHubLang("en")} className="inline-flex min-h-[36px] items-center rounded-lg border border-white/15 px-3 text-xs font-bold text-white hover:bg-white/10">Use English voice</button>}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={readPage} className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 text-xs font-bold text-slate-100 hover:border-[#22D3EE]/50"><BookOpenText className="h-4 w-4 text-[#22D3EE]" aria-hidden />Read this page</button>
              <button onClick={() => said && sayAsync(said, lang).then(() => setPhase("idle"))} disabled={!said} className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 text-xs font-bold text-slate-100 hover:border-[#22D3EE]/50 disabled:opacity-40"><Volume2 className="h-4 w-4 text-[#A3E635]" aria-hidden />Say again</button>
            </div>
            <button onClick={runCheck} className="mt-2 flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-xl border border-[#FBBF24]/40 bg-[#FBBF24]/10 text-xs font-bold text-[#FBBF24] hover:bg-[#FBBF24]/20">
              <Wrench className="h-4 w-4" aria-hidden />Test voice on this device
            </button>
            {check && (
              <ul className="mt-2 space-y-1 rounded-xl border border-white/10 bg-white/[0.03] p-2.5 text-[11px]">
                {[
                  [check.canListen, check.canListen ? `Voice input works in ${check.browser}` : `${check.browser} cannot hear speech: use Chrome or Edge`],
                  [check.mic === "granted", check.mic === "granted" ? "Microphone allowed" : "Microphone blocked: lock icon in the address bar → Microphone → Allow, then reload"],
                  [!!check.voice, check.voice ? `Speaking voice: ${check.voice}. You should hear the greeting now.` : voiceHelp(lang)],
                ].map(([ok, text]) => (
                  <li key={String(text)} className={`flex gap-1.5 ${ok ? "text-[#A3E635]" : "text-[#F87171]"}`}><span aria-hidden>{ok ? "✓" : "✗"}</span><span>{text as string}</span></li>
                ))}
              </ul>
            )}
            <div className="mt-3 space-y-1.5 text-xs">
              <label className="flex min-h-[36px] cursor-pointer items-center justify-between gap-2 rounded-lg px-1">
                <span className="flex items-center gap-1.5 font-semibold text-slate-200"><Repeat className="h-3.5 w-3.5 text-[#F472B6]" aria-hidden />Hands-free (keep listening)</span>
                <input type="checkbox" checked={handsFree} onChange={(e) => setHandsFree(e.target.checked)} className="h-4 w-4 accent-[#22D3EE]" />
              </label>
              <label className="flex min-h-[36px] cursor-pointer items-center justify-between gap-2 rounded-lg px-1">
                <span className="flex items-center gap-1.5 font-semibold text-slate-200"><AudioLines className="h-3.5 w-3.5 text-[#FBBF24]" aria-hidden />Narrate each screen</span>
                <input type="checkbox" checked={narrate} onChange={(e) => setNarrate(e.target.checked)} className="h-4 w-4 accent-[#22D3EE]" />
              </label>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">{source ? `Last answer from: ${source}.` : "Answers from Claude AI when connected; otherwise from the app's data, your last scan and Wikipedia."}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Compact bubble while talking (the settings panel stays closed). */}
      <AnimatePresence>
        {!open && (busy || said || err) && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} aria-live="polite"
            className="w-[min(300px,calc(100vw-2rem))] rounded-2xl border border-white/10 bg-[#081226]/95 p-3 text-sm text-slate-100 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-xl">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#22D3EE]">{phase === "idle" ? (source || "Voice agent") : t[phase]}</p>
              {!busy && <button onClick={() => { setSaid(""); setErr(""); setHeard(""); }} aria-label="Close" className="text-slate-500 hover:text-white"><X className="h-3.5 w-3.5" aria-hidden /></button>}
            </div>
            {heard && <p className="mt-1 text-slate-300">“{heard}”</p>}
            {said && <p className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap text-white">{said.replace(/\*\*/g, "")}</p>}
            {err && <p role="alert" className="mt-1 font-semibold text-[#F87171]">{err}</p>}
            {noVoiceFor(lang) && said && <button onClick={() => setOpen(true)} className="mt-1.5 text-[11px] font-semibold text-[#FBBF24] underline">No {VOICE_LANGS.find((v) => v.id === lang)!.label} voice here: fix it</button>}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative">
        {(phase === "listening" || phase === "speaking") && [0, 0.6].map((d) => (
          <span key={d} aria-hidden className={`mic-ring absolute inset-0 rounded-full border-2 ${phase === "listening" ? "border-[#F472B6]" : "border-[#A3E635]"}`} style={{ animationDelay: `${d}s` }} />
        ))}
        <motion.button whileTap={{ scale: 0.92 }} onClick={busy ? stopAll : start} onContextMenu={(e) => { e.preventDefault(); setOpen((o) => !o); }}
          aria-label={busy ? "Stop voice agent" : "Talk to the voice agent"}
          className={`relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br ${ring} text-[#040A18] shadow-[0_0_28px_rgba(34,211,238,0.55)] ring-2 ring-white/20`}>
          {busy ? <Square className="h-6 w-6" aria-hidden /> : <Mic className="h-7 w-7" aria-hidden />}
        </motion.button>
        {!open && !busy && (
          <button onClick={() => setOpen(true)} aria-label="Open voice agent options" className="absolute -left-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-[#081226] text-[10px] font-bold text-[#22D3EE]">
            {VOICE_LANGS.find((v) => v.id === lang)!.native.slice(0, 2)}
          </button>
        )}
      </div>
    </div>
  );
}
