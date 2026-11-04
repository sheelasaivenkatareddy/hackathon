// Kisan Vani: talk to the farm AI. Speech to text in six Indian languages, the answer from Claude (ask-agent, voice mode),
// read back aloud. Greetings, the latest diagnosis, weather alerts and the crop plan are spoken even without the cloud.
import { AnimatePresence, motion } from "framer-motion";
import { CloudSun, Keyboard, Leaf, ListChecks, Mic, Send, Square, Trash2, Volume2, VolumeX } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChatMsg, askAgent, shareScanWithAgent } from "../../lib/agent";
import { cloudConfigured } from "../../lib/cloud";
import { bestSprayWindow, loadForecast, next24, sprayHours } from "../forecast";
import { answerQuestion } from "../answer";
import { VoiceLang, districtOf, getHubScans, setHubLang, useHubLang, useUser } from "../store";
import { Glass, LangPicker, PageHead, Pill } from "../ui";
import { GREETING, UI, VOICE_LANGS, askMic, canListen, canSpeak, isGreeting, listen, listenError, speak, stopSpeaking, unlockSpeech, voiceFor, voiceHelp, weatherSentence } from "../voice";

type Phase = "idle" | "listening" | "thinking" | "speaking";
interface Line extends ChatMsg { lang: VoiceLang; local?: boolean }

const SESSION = "hub:vani-chat";
const loadChat = (): Line[] => { try { return JSON.parse(sessionStorage.getItem(SESSION) ?? "[]"); } catch { return []; } };

export default function KisanVani() {
  const user = useUser()!;
  const lang = useHubLang();
  const [chat, setChat] = useState<Line[]>(loadChat);
  const [phase, setPhase] = useState<Phase>("idle");
  const [partial, setPartial] = useState("");
  const [typed, setTyped] = useState("");
  const [showKeys, setShowKeys] = useState(!canListen());
  const [mute, setMute] = useState(false);
  const [err, setErr] = useState("");
  const stopRef = useRef<() => void>(() => undefined);
  const endRef = useRef<HTMLDivElement>(null);
  const t = UI[lang];

  useEffect(() => { try { sessionStorage.setItem(SESSION, JSON.stringify(chat.slice(-30))); } catch { /* blocked */ } endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [chat, partial]);
  useEffect(() => {
    // After a reload the assistant has no scan in memory: give it the latest one from the phone.
    const last = getHubScans()[0];
    if (last) shareScanWithAgent(last.result);
    return () => stopSpeaking();
  }, []);
  // Voices load late in Chrome.
  const [, force] = useState(0);
  useEffect(() => { if (canSpeak()) speechSynthesis.onvoiceschanged = () => force((n) => n + 1); }, []);

  const say = (text: string, l: VoiceLang) => {
    if (mute) { setPhase("idle"); return; }
    setPhase("speaking");
    speak(text, l, () => setPhase("idle"));
  };
  const reply = (text: string, l: VoiceLang, local = false) => {
    setChat((c) => [...c, { role: "assistant", content: text, lang: l, local }]);
    say(text, l);
  };

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q) { setPhase("idle"); return; }
    setErr("");
    const history = [...chat, { role: "user" as const, content: q, lang }];
    setChat(history);
    if (isGreeting(q)) { reply(GREETING[lang], lang); return; }
    setPhase("thinking");
    // Claude, else the free AI (with the last scan), else the app's data, else Wikipedia.
    const a = await answerQuestion(history.map(({ role, content }) => ({ role, content })), lang, true);
    reply(a.text, a.lang, a.source === "App data" || a.source === "Wikipedia");
  };

  const mic = async () => {
    unlockSpeech(); // inside the tap, before any await: phones only speak after a tap
    if (phase === "listening") { stopRef.current(); return; }
    if (phase === "speaking") { stopSpeaking(); setPhase("idle"); return; }
    setErr(""); setPartial("");
    if (!canListen()) { setErr(listenError("unsupported")); setShowKeys(true); return; }
    if (!(await askMic())) { setErr(listenError("not-allowed")); setShowKeys(true); return; }
    setPhase("listening");
    try {
      const l = listen(lang, setPartial);
      stopRef.current = l.stop;
      const text = await l.done;
      setPartial("");
      await ask(text);
    } catch (e) {
      setPhase("idle");
      setErr(listenError((e as Error).message));
      setShowKeys(true);
    }
  };

  const submit = (e: FormEvent) => { e.preventDefault(); unlockSpeech(); const q = typed; setTyped(""); ask(q); };

  // ------------------------------------------------------------------ spoken without the AI
  const speakDiagnosis = () => {
    const s = getHubScans()[0];
    if (!s) { reply(t.noScan, lang); return; }
    const block = lang === "te" || lang === "hi" ? s.result.languages[lang] : s.result.languages.en;
    const l: VoiceLang = lang === "te" || lang === "hi" ? lang : "en";
    reply([`${s.crop}: ${block.problem}.`, block.reason, ...block.steps.slice(0, 3)].join(" "), l);
  };
  const speakWeather = async () => {
    unlockSpeech();
    const d = districtOf(user);
    setPhase("thinking");
    const { f } = await loadForecast(d.lat, d.lon);
    if (!f) { setPhase("idle"); setErr("Weather could not load. Check the internet connection."); return; }
    reply(weatherSentence(lang, { ...next24(f), sprayOk: bestSprayWindow(sprayHours(f)) }), lang);
  };
  const speakPlan = () => {
    const s = getHubScans()[0];
    if (!s) { reply(t.noScan, lang); return; }
    const c = s.result.care;
    const parts = [
      ...c.do_today.slice(0, 2), ...c.watering.slice(0, 1),
      ...c.fertilizer.slice(0, 1).map((f) => `${f.product}: ${f.dose}, ${f.when}`),
      ...c.chemical.slice(0, 1).map((x) => `${x.product}: ${x.dose}, ${x.interval}`),
    ];
    if (lang === "en" || !cloudConfigured) reply(`Crop plan for ${s.crop}. ${parts.join(". ")}.`, "en");
    else ask(`Explain my crop plan for ${s.crop} (${s.result.disease.name}) in simple words: ${parts.join("; ")}`);
  };

  const noVoice = canSpeak() && !voiceFor(lang);
  const ORB = { idle: "from-neon-cyan to-neon-teal", listening: "from-neon-pink to-neon-cyan", thinking: "from-neon-amber to-neon-pink", speaking: "from-neon-lime to-neon-cyan" }[phase];

  return (
    <div>
      <PageHead eyebrow="Real-time voice AI" title={<>Kisan <span className="neon-text">Vani</span></>}
        sub="Speak in your language. Kisan Vani listens, answers about your crop, and reads the answer aloud."
        right={<Pill tone="cyan">6 languages · uses your last scan</Pill>} />

      <div className="grid gap-5 lg:grid-cols-5">
        <Glass className="flex flex-col items-center lg:col-span-2">
          <LangPicker />
          <div className="relative my-8 flex h-56 w-56 items-center justify-center md:my-10">
            {(phase === "listening" || phase === "speaking") && [0, 0.5, 1].map((d) => (
              <span key={d} aria-hidden className={`mic-ring absolute inset-6 rounded-full border-2 ${phase === "listening" ? "border-neon-pink" : "border-neon-lime"}`} style={{ animationDelay: `${d}s` }} />
            ))}
            <motion.button onClick={mic} whileTap={{ scale: 0.94 }} aria-label={phase === "listening" ? "Stop listening" : phase === "speaking" ? "Stop speaking" : t.tap}
              animate={phase === "thinking" ? { rotate: 360 } : { rotate: 0 }} transition={phase === "thinking" ? { repeat: Infinity, duration: 2, ease: "linear" } : {}}
              className={`relative flex h-40 w-40 items-center justify-center rounded-full bg-gradient-to-br ${ORB} shadow-[0_0_60px_rgba(34,211,238,0.45)]`}>
              <span className="absolute inset-2 rounded-full bg-navy-950/40 backdrop-blur" aria-hidden />
              {phase === "listening" || phase === "speaking" ? <Square className="relative h-12 w-12 text-white" aria-hidden /> : <Mic className="relative h-16 w-16 text-white" aria-hidden />}
            </motion.button>
          </div>
          <p className="font-heading text-lg font-bold text-white" aria-live="polite">{phase === "idle" ? t.tap : t[phase]}</p>
          {partial && <p className="mt-2 max-w-xs text-center text-slate-300">"{partial}"</p>}
          {!canListen() && <p className="mt-2 text-center text-xs text-slate-400">This browser cannot hear speech. Use Chrome on Android, or type below.</p>}
          {noVoice && (
            <div className="mt-2 text-center">
              <p className="text-xs text-neon-amber">{voiceHelp(lang)}</p>
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {/Windows/.test(navigator.userAgent) && !/Edg\//.test(navigator.userAgent) && <a href={`microsoft-edge:${window.location.href}`} className="hub-btn-primary !min-h-[36px] !text-xs">Open in Edge</a>}
                {lang !== "en" && <button onClick={() => setHubLang("en")} className="hub-btn-ghost !min-h-[36px] !text-xs">Use English voice</button>}
              </div>
            </div>
          )}

          <div className="mt-6 grid w-full grid-cols-3 gap-2">
            <button onClick={speakDiagnosis} className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-3 text-xs font-bold text-slate-200 hover:border-neon-red/50"><Leaf className="h-5 w-5 text-neon-red" aria-hidden />My diagnosis</button>
            <button onClick={speakWeather} className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-3 text-xs font-bold text-slate-200 hover:border-neon-cyan/50"><CloudSun className="h-5 w-5 text-neon-cyan" aria-hidden />Weather alert</button>
            <button onClick={speakPlan} className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-3 text-xs font-bold text-slate-200 hover:border-neon-lime/50"><ListChecks className="h-5 w-5 text-neon-lime" aria-hidden />Crop plan</button>
          </div>
        </Glass>

        <Glass className="flex min-h-[520px] flex-col lg:col-span-3">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="hub-h3">Conversation</h2>
            <div className="flex gap-1">
              <button onClick={() => { setMute((m) => !m); stopSpeaking(); }} aria-label={mute ? "Turn voice on" : "Mute voice"} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white">{mute ? <VolumeX className="h-4 w-4" aria-hidden /> : <Volume2 className="h-4 w-4" aria-hidden />}</button>
              <button onClick={() => setShowKeys((k) => !k)} aria-label="Type instead" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"><Keyboard className="h-4 w-4" aria-hidden /></button>
              <button onClick={() => { setChat([]); stopSpeaking(); }} aria-label="Clear conversation" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"><Trash2 className="h-4 w-4" aria-hidden /></button>
            </div>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto pr-1" style={{ maxHeight: 460 }}>
            {!chat.length && (
              <div className="rounded-2xl border border-dashed border-white/15 p-5 text-center">
                <p className="font-semibold text-white">Try saying</p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {["హాయ్", "నా టమోటా ఆకులపై గోధుమ మచ్చలు ఉన్నాయి", "धान में झुलसा रोग का इलाज?", "How much urea for 2 acres of paddy?"].map((s) => (
                    <button key={s} onClick={() => ask(s)} className="rounded-full border border-neon-cyan/30 bg-neon-cyan/5 px-3 py-1.5 text-sm text-neon-cyan hover:bg-neon-cyan/15">{s}</button>
                  ))}
                </div>
              </div>
            )}
            <AnimatePresence initial={false}>
              {chat.map((m, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${m.role === "user" ? "rounded-br-sm bg-neon-cyan text-navy-950" : "rounded-bl-sm border border-white/10 bg-white/5 text-slate-100"}`}>
                    {m.content.replace(/\*\*/g, "")}
                    {m.role === "assistant" && (
                      <button onClick={() => say(m.content, m.lang)} className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-neon-cyan/80 hover:text-neon-cyan"><Volume2 className="h-3.5 w-3.5" aria-hidden />Play{m.local ? " · offline" : ""}</button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {phase === "thinking" && <div className="flex gap-1 px-2" aria-label="Thinking">{[0, 1, 2].map((d) => <motion.span key={d} className="h-2 w-2 rounded-full bg-neon-cyan" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: d * 0.2 }} />)}</div>}
            <div ref={endRef} />
          </div>
          {err && <p role="alert" className="mt-2 text-sm font-semibold text-neon-red">{err}</p>}
          {showKeys && (
            <form onSubmit={submit} className="mt-3 flex gap-2">
              <input className="hub-input" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type in any language…" aria-label="Your question" />
              <button type="submit" className="hub-btn-primary !px-3" aria-label="Send" disabled={!typed.trim() || phase === "thinking"}><Send className="h-5 w-5" aria-hidden /></button>
            </form>
          )}
          <p className="mt-3 text-xs text-slate-500">Kisan Vani can make mistakes. For serious problems call the Kisan Call Centre, 1800-180-1551 (free). <Link to="/hub/labs" className="text-neon-cyan">Find an expert →</Link></p>
        </Glass>
      </div>
    </div>
  );
}
