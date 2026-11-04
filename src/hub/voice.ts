// Kisan Vani voice: speech-to-text and text-to-speech in the browser, plus the few phrases it says without the AI
// (greetings, weather alerts) in six languages.
import type { VoiceLang } from "./store";

export const VOICE_LANGS: { id: VoiceLang; label: string; native: string; bcp: string }[] = [
  { id: "te", label: "Telugu", native: "తెలుగు", bcp: "te-IN" },
  { id: "hi", label: "Hindi", native: "हिन्दी", bcp: "hi-IN" },
  { id: "en", label: "English", native: "English", bcp: "en-IN" },
  { id: "ta", label: "Tamil", native: "தமிழ்", bcp: "ta-IN" },
  { id: "kn", label: "Kannada", native: "ಕನ್ನಡ", bcp: "kn-IN" },
  { id: "ml", label: "Malayalam", native: "മലയാളം", bcp: "ml-IN" },
];
export const bcpOf = (l: VoiceLang) => VOICE_LANGS.find((v) => v.id === l)!.bcp;

// ------------------------------------------------------------------ speech to text
type Recognition = {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null;
  start: () => void; stop: () => void;
};
const RecognitionCtor = (): (new () => Recognition) | null => {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};
export const canListen = () => typeof window !== "undefined" && !!RecognitionCtor();

/** Plain-language reason for a speech recognition error code. */
export function listenError(code: string): string {
  switch (code) {
    case "not-allowed": case "service-not-allowed":
      return "The microphone is blocked. Click the lock icon in the address bar, set Microphone to Allow, then reload the page.";
    case "audio-capture": return "No microphone was found. Plug in a headset or check the Windows sound settings.";
    case "network": return "Speech recognition needs the internet. Check the connection and try again.";
    case "language-not-supported": return "This browser cannot understand this language by voice. Try English, or use Chrome.";
    case "unsupported": return "This browser cannot hear speech. Use Google Chrome or Microsoft Edge.";
    default: return `Voice input stopped (${code}). Tap the microphone and try again.`;
  }
}

/** Listens once. Calls onText with partial text while the farmer speaks; resolves with the final text ("" if nothing).
 *  Rejects with an Error whose message is the browser's error code (see listenError). */
export function listen(lang: VoiceLang, onText: (t: string) => void): { done: Promise<string>; stop: () => void } {
  const Ctor = RecognitionCtor();
  if (!Ctor) return { done: Promise.reject(new Error("unsupported")), stop: () => undefined };
  const r = new Ctor();
  r.lang = bcpOf(lang); r.interimResults = true; r.continuous = false;
  let text = "", settled = false;
  const done = new Promise<string>((resolve, reject) => {
    const ok = (t: string) => { if (!settled) { settled = true; resolve(t); } };
    const fail = (c: string) => { if (!settled) { settled = true; reject(new Error(c)); } };
    r.onresult = (e) => {
      text = Array.from(e.results).map((res) => res[0].transcript).join(" ").trim();
      onText(text);
    };
    r.onerror = (e) => (e.error === "no-speech" || e.error === "aborted" ? ok(text) : fail(e.error));
    r.onend = () => ok(text);
    // Some browsers never fire onend if the mic is cut off: give up after 20 s.
    setTimeout(() => { try { r.stop(); } catch { /* already stopped */ } ok(text); }, 20_000);
  });
  // Speech must stop before listening, or the agent hears itself.
  stopSpeaking();
  try { r.start(); } catch { return { done: Promise.reject(new Error("busy")), stop: () => undefined }; }
  return { done, stop: () => { try { r.stop(); } catch { /* already stopped */ } } };
}

// ------------------------------------------------------------------ text to speech
export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;

/** Voices load late (Chrome, Edge): wait for them, at most 1.5 s. */
export function voicesReady(): Promise<SpeechSynthesisVoice[]> {
  if (!canSpeak()) return Promise.resolve([]);
  const now = speechSynthesis.getVoices();
  if (now.length) return Promise.resolve(now);
  return new Promise((resolve) => {
    const done = () => resolve(speechSynthesis.getVoices());
    speechSynthesis.addEventListener?.("voiceschanged", done, { once: true });
    setTimeout(done, 1500);
  });
}

/** Edge's natural (online) voices arrive a moment after the local ones: wait up to 3 s for this language's voice. */
export async function voiceReadyFor(lang: VoiceLang): Promise<void> {
  await voicesReady();
  if (!canSpeak() || voiceFor(lang)) return;
  await new Promise<void>((resolve) => {
    const t = setTimeout(done, 3000);
    function done() { clearTimeout(t); speechSynthesis.removeEventListener?.("voiceschanged", check); resolve(); }
    function check() { if (voiceFor(lang)) done(); }
    speechSynthesis.addEventListener?.("voiceschanged", check);
  });
}

/** Best voice for the language: natural/online voices first (Edge "Online (Natural)", Google voices). */
export function voiceFor(lang: VoiceLang): SpeechSynthesisVoice | undefined {
  if (!canSpeak()) return undefined;
  const all = speechSynthesis.getVoices(), bcp = bcpOf(lang).toLowerCase(), base = bcp.slice(0, 2);
  const match = all.filter((v) => v.lang.toLowerCase().replace("_", "-") === bcp || v.lang.toLowerCase().startsWith(`${base}-`) || v.lang.toLowerCase() === base);
  const score = (v: SpeechSynthesisVoice) => (/natural/i.test(v.name) ? 3 : 0) + (/online|google/i.test(v.name) ? 2 : 0) + (v.lang.toLowerCase().replace("_", "-") === bcp ? 1 : 0);
  return match.sort((a, b) => score(b) - score(a))[0];
}

/** Markdown and emoji read badly aloud, so they are stripped first. */
export const plain = (s: string) =>
  s.replace(/\*\*|__|`|#+\s/g, "").replace(/^\s*[-*]\s+/gm, "").replace(/\[(.*?)\]\(.*?\)/g, "$1").replace(/[\u{1F300}-\u{1FAFF}]/gu, "").trim();

/** Short pieces: Chrome stops reading a long utterance after about 15 seconds. */
function chunks(text: string, max = 180): string[] {
  const parts = text.split(/(?<=[.!?।॥\n])\s+/).flatMap((s) => {
    if (s.length <= max) return [s];
    const out: string[] = []; let cur = "";
    for (const w of s.split(/\s+/)) { if ((cur + " " + w).length > max && cur) { out.push(cur); cur = w; } else cur = cur ? `${cur} ${w}` : w; }
    if (cur) out.push(cur);
    return out;
  });
  return parts.map((p) => p.trim()).filter(Boolean);
}

export const isPhone = () => typeof navigator !== "undefined" && /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);

let unlocked = false;
/** Phones only allow speech that starts from a tap. Call this inside the tap handler, before any await. */
export function unlockSpeech() {
  if (!canSpeak() || unlocked) return;
  try {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    speechSynthesis.speak(u);
    unlocked = true;
  } catch { /* not supported */ }
}

let speakToken = 0;
let keepAlive: ReturnType<typeof setInterval> | undefined;

/** True when the browser has no voice for the language: answers are then shown as text only. */
export const noVoiceFor = (lang: VoiceLang) => !canSpeak() || (!voiceFor(lang) && !isPhone());

/** Where to get a voice for the language, for the device the farmer is on. */
export function voiceHelp(lang: VoiceLang): string {
  const name = VOICE_LANGS.find((v) => v.id === lang)!.label;
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  if (/Android/i.test(ua)) return `No ${name} voice on this phone yet. Open Settings → Text-to-speech → Google speech services → Install voice data → ${name}. Then reload.`;
  if (/Edg\//.test(ua)) return `No ${name} voice found. Check the internet connection (Edge's natural voices are online), then reload.`;
  if (/iPhone|iPad|Mac/i.test(ua)) return `No ${name} voice on this device. Settings → Accessibility → Spoken Content → Voices → add ${name}.`;
  return `This browser has no ${name} voice, so answers are shown as text. Open this site in Microsoft Edge (it has natural Telugu, Hindi, Tamil, Kannada and Malayalam voices), or use Chrome on an Android phone.`;
}

/** Speaks in pieces, with a keep-alive for Chrome and a safety timer, so onEnd always fires once. */
export function speak(text: string, lang: VoiceLang, onEnd?: () => void) {
  const token = ++speakToken;
  if (!canSpeak()) { onEnd?.(); return; }
  speechSynthesis.cancel();
  clearInterval(keepAlive);
  let finished = false;
  const finish = () => { if (finished) return; finished = true; clearInterval(keepAlive); if (token === speakToken) onEnd?.(); };
  const pieces = chunks(plain(text));
  if (!pieces.length) { finish(); return; }
  // Rough reading time, plus slack: if the browser never reports the end, carry on anyway.
  const safety = setTimeout(finish, pieces.join(" ").length * 110 + 4000);
  voiceReadyFor(lang).then(() => {
    if (token !== speakToken) return;
    const v = voiceFor(lang);
    // No listed voice for this language. Phones (Google / Apple speech) usually still speak it when asked by language,
    // so try there. On a computer an English voice would read Telugu script as noise, so stay silent (text is shown).
    if (!v && lang !== "en" && !isPhone()) { clearTimeout(safety); finish(); return; }
    pieces.forEach((p, i) => {
      const u = new SpeechSynthesisUtterance(p);
      u.lang = v?.lang ?? bcpOf(lang);
      try { if (v) u.voice = v; } catch { /* lang alone still picks a voice */ }
      u.rate = 0.95;
      if (i === pieces.length - 1) { u.onend = () => { clearTimeout(safety); finish(); }; }
      u.onerror = (e) => { if (e.error !== "interrupted" && e.error !== "canceled") { clearTimeout(safety); finish(); } };
      speechSynthesis.speak(u);
    });
    keepAlive = setInterval(() => { if (speechSynthesis.speaking && !speechSynthesis.paused) { speechSynthesis.pause(); speechSynthesis.resume(); } }, 10_000);
  });
}
export const stopSpeaking = () => {
  speakToken++; clearInterval(keepAlive);
  if (canSpeak()) speechSynthesis.cancel();
};

// ------------------------------------------------------------------ device check
export interface VoiceCheck { canListen: boolean; canSpeak: boolean; mic: "granted" | "denied" | "prompt" | "unknown"; voice: string | null; browser: string }
export async function checkVoice(lang: VoiceLang): Promise<VoiceCheck> {
  await voiceReadyFor(lang);
  let mic: VoiceCheck["mic"] = "unknown";
  try { mic = (await navigator.permissions.query({ name: "microphone" as PermissionName })).state as VoiceCheck["mic"]; } catch { /* not supported */ }
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Other";
  const v = voiceFor(lang);
  return { canListen: canListen(), canSpeak: canSpeak(), mic, voice: v ? v.name : null, browser };
}

/** Asks for the microphone straight away, so the browser shows its Allow prompt. */
export async function askMic(): Promise<boolean> {
  try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach((t) => t.stop()); return true; } catch { return false; }
}

// ------------------------------------------------------------------ phrases said without the AI
const GREETING_WORDS = [
  "hi", "hello", "hey", "namaste", "namaskar", "namaskaram", "vanakkam", "namaskara",
  "హాయ్", "హలో", "నమస్తే", "నమస్కారం", "हाय", "हेलो", "हैलो", "नमस्ते", "नमस्कार",
  "வணக்கம்", "ஹாய்", "ಹಾಯ್", "ನಮಸ್ಕಾರ", "ನಮಸ್ತೆ", "ഹായ്", "നമസ്കാരം", "ഹലോ",
];
export const isGreeting = (s: string) => {
  const t = s.toLowerCase().replace(/[!.,?।]/g, "").trim();
  return t.length < 24 && GREETING_WORDS.some((g) => t === g || t.startsWith(`${g} `));
};

export const GREETING: Record<VoiceLang, string> = {
  te: "నమస్కారం రైతు సోదరా, నేను మీకు ఎలా సహాయపడగలను?",
  hi: "नमस्ते किसान भाई, मैं आपकी कैसे मदद कर सकता हूँ?",
  en: "Namaste, farmer friend. How can I help you today?",
  ta: "வணக்கம் விவசாய நண்பரே, நான் உங்களுக்கு எப்படி உதவ முடியும்?",
  kn: "ನಮಸ್ಕಾರ ರೈತ ಸಹೋದರ, ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?",
  ml: "നമസ്കാരം കർഷക സുഹൃത്തേ, ഞാൻ നിങ്ങളെ എങ്ങനെ സഹായിക്കാം?",
};

export const UI: Record<VoiceLang, { tap: string; listening: string; thinking: string; speaking: string; noScan: string }> = {
  te: { tap: "మాట్లాడటానికి నొక్కండి", listening: "వింటున్నాను…", thinking: "ఆలోచిస్తున్నాను…", speaking: "చెబుతున్నాను…", noScan: "ఇంకా స్కాన్ లేదు. ముందు ఆకు ఫోటో తీయండి." },
  hi: { tap: "बोलने के लिए दबाएँ", listening: "सुन रहा हूँ…", thinking: "सोच रहा हूँ…", speaking: "बोल रहा हूँ…", noScan: "अभी कोई स्कैन नहीं है। पहले पत्ते की फोटो लें।" },
  en: { tap: "Tap to speak", listening: "Listening…", thinking: "Thinking…", speaking: "Speaking…", noScan: "No scan yet. Take a photo of a leaf first." },
  ta: { tap: "பேச அழுத்தவும்", listening: "கேட்கிறேன்…", thinking: "யோசிக்கிறேன்…", speaking: "சொல்கிறேன்…", noScan: "இன்னும் ஸ்கேன் இல்லை. முதலில் இலையின் படம் எடுக்கவும்." },
  kn: { tap: "ಮಾತನಾಡಲು ಒತ್ತಿ", listening: "ಕೇಳುತ್ತಿದ್ದೇನೆ…", thinking: "ಯೋಚಿಸುತ್ತಿದ್ದೇನೆ…", speaking: "ಹೇಳುತ್ತಿದ್ದೇನೆ…", noScan: "ಇನ್ನೂ ಸ್ಕ್ಯಾನ್ ಇಲ್ಲ. ಮೊದಲು ಎಲೆಯ ಫೋಟೋ ತೆಗೆಯಿರಿ." },
  ml: { tap: "സംസാരിക്കാൻ അമർത്തുക", listening: "കേൾക്കുന്നു…", thinking: "ആലോചിക്കുന്നു…", speaking: "പറയുന്നു…", noScan: "ഇതുവരെ സ്കാൻ ഇല്ല. ആദ്യം ഇലയുടെ ഫോട്ടോ എടുക്കുക." },
};

/** Weather alert sentences. Numbers are filled in from the forecast. */
export function weatherSentence(lang: VoiceLang, w: { rainMm: number; rh: number; tmax: number; sprayOk: string | null }): string {
  const spray = w.sprayOk;
  const T: Record<VoiceLang, string> = {
    te: `రాబోయే 24 గంటల్లో సుమారు ${w.rainMm} మి.మీ. వర్షం. గాలిలో తేమ ${w.rh}%. గరిష్ట ఉష్ణోగ్రత ${w.tmax}°C. ${spray ? `పిచికారీకి మంచి సమయం: ${spray}.` : "ఈ రోజు పిచికారీ వద్దు."}${w.rh >= 90 ? " తేమ ఎక్కువ, ఆకు మచ్చ తెగుళ్ల ప్రమాదం ఉంది." : ""}`,
    hi: `अगले 24 घंटों में लगभग ${w.rainMm} मिमी बारिश। नमी ${w.rh}%। अधिकतम तापमान ${w.tmax}°C। ${spray ? `छिड़काव का अच्छा समय: ${spray}।` : "आज छिड़काव न करें।"}${w.rh >= 90 ? " नमी ज़्यादा है, पत्ती के रोगों का खतरा है।" : ""}`,
    en: `About ${w.rainMm} mm of rain in the next 24 hours. Humidity ${w.rh} percent. Highest temperature ${w.tmax} degrees. ${spray ? `Best time to spray: ${spray}.` : "Do not spray today."}${w.rh >= 90 ? " Humidity is high, so leaf disease risk is high." : ""}`,
    ta: `அடுத்த 24 மணி நேரத்தில் சுமார் ${w.rainMm} மி.மீ மழை. ஈரப்பதம் ${w.rh}%. அதிகபட்ச வெப்பம் ${w.tmax}°C. ${spray ? `தெளிக்க நல்ல நேரம்: ${spray}.` : "இன்று தெளிக்க வேண்டாம்."}${w.rh >= 90 ? " ஈரப்பதம் அதிகம், இலை நோய் அபாயம் உள்ளது." : ""}`,
    kn: `ಮುಂದಿನ 24 ಗಂಟೆಗಳಲ್ಲಿ ಸುಮಾರು ${w.rainMm} ಮಿ.ಮೀ ಮಳೆ. ತೇವಾಂಶ ${w.rh}%. ಗರಿಷ್ಠ ತಾಪಮಾನ ${w.tmax}°C. ${spray ? `ಸಿಂಪಡಣೆಗೆ ಒಳ್ಳೆಯ ಸಮಯ: ${spray}.` : "ಇಂದು ಸಿಂಪಡಣೆ ಬೇಡ."}${w.rh >= 90 ? " ತೇವಾಂಶ ಹೆಚ್ಚು, ಎಲೆ ರೋಗದ ಅಪಾಯವಿದೆ." : ""}`,
    ml: `അടുത്ത 24 മണിക്കൂറിൽ ഏകദേശം ${w.rainMm} മി.മീ മഴ. ഈർപ്പം ${w.rh}%. കൂടിയ താപനില ${w.tmax}°C. ${spray ? `തളിക്കാൻ നല്ല സമയം: ${spray}.` : "ഇന്ന് തളിക്കരുത്."}${w.rh >= 90 ? " ഈർപ്പം കൂടുതലാണ്, ഇല രോഗ സാധ്യതയുണ്ട്." : ""}`,
  };
  return T[lang];
}
