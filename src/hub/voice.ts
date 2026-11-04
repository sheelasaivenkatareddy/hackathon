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

/** Listens once. Calls onText with partial text while the farmer speaks; resolves with the final text ("" if nothing). */
export function listen(lang: VoiceLang, onText: (t: string) => void): { done: Promise<string>; stop: () => void } {
  const Ctor = RecognitionCtor();
  if (!Ctor) return { done: Promise.reject(new Error("no-speech")), stop: () => undefined };
  const r = new Ctor();
  r.lang = bcpOf(lang); r.interimResults = true; r.continuous = false;
  let text = "";
  const done = new Promise<string>((resolve, reject) => {
    r.onresult = (e) => {
      text = Array.from(e.results).map((res) => res[0].transcript).join(" ").trim();
      onText(text);
    };
    r.onerror = (e) => (e.error === "no-speech" || e.error === "aborted" ? resolve(text) : reject(new Error(e.error)));
    r.onend = () => resolve(text);
  });
  r.start();
  return { done, stop: () => r.stop() };
}

// ------------------------------------------------------------------ text to speech
export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;

export function voiceFor(lang: VoiceLang): SpeechSynthesisVoice | undefined {
  if (!canSpeak()) return undefined;
  const all = speechSynthesis.getVoices(), bcp = bcpOf(lang).toLowerCase(), base = bcp.slice(0, 2);
  return all.find((v) => v.lang.toLowerCase() === bcp) ?? all.find((v) => v.lang.toLowerCase().startsWith(base));
}

/** Markdown and emoji read badly aloud, so they are stripped first. */
export const plain = (s: string) =>
  s.replace(/\*\*|__|`|#+\s/g, "").replace(/^\s*[-*]\s+/gm, "").replace(/\[(.*?)\]\(.*?\)/g, "$1").replace(/[\u{1F300}-\u{1FAFF}]/gu, "").trim();

export function speak(text: string, lang: VoiceLang, onEnd?: () => void) {
  if (!canSpeak()) { onEnd?.(); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(plain(text));
  u.lang = bcpOf(lang);
  const v = voiceFor(lang);
  if (v) u.voice = v;
  u.rate = 0.95;
  u.onend = () => onEnd?.();
  u.onerror = () => onEnd?.();
  speechSynthesis.speak(u);
}
export const stopSpeaking = () => { if (canSpeak()) speechSynthesis.cancel(); };

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
