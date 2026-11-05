// One answer flow for Kisan Vani, the voice agent and the Ask AI panel:
// 1. Claude (ask-agent), when the key is set  2. the free open AI, with the last scan as context
// 3. the app's own data (prices, weather, fertilizer, last scan)  4. Wikipedia, for general facts.
import { isOnlineMode } from "../lib/mode";
import { ChatMsg, askAgent, getLatestScan } from "../lib/agent";
import { cloudConfigured } from "../lib/cloud";
import { askFreeAI, scanContext } from "../lib/freeAI";
import { answerOffline, intentsOf, langOf } from "./offlineBrain";
import { VoiceLang, getHubScans, getUser } from "./store";

export type AnswerSource = "Claude AI" | "AI" | "App data" | "Wikipedia";
export interface Answer { text: string; lang: VoiceLang; source: AnswerSource }

// Questions the app answers exactly from its own data (prices, forecast, calculator, guides): answered instantly,
// so the rate-limited free AI is kept for photo, disease and open questions.
const DATA_INTENTS = new Set(["price", "weather", "fertilizer", "stage", "water", "scheme", "expert", "help"]);

// Repeated questions (same words, language and scan) answer instantly from memory for a day.
const CACHE = "hub:answers";
const cacheKey = (q: string, lang: string, scanId: string) => `${lang}|${scanId}|${q.trim().toLowerCase()}`;
function cached(key: string): Answer | null {
  try { const c = JSON.parse(localStorage.getItem(CACHE) ?? "{}")[key]; return c && Date.now() - c.at < 86_400_000 ? c.a : null; } catch { return null; }
}
function remember(key: string, a: Answer) {
  try {
    const all = JSON.parse(localStorage.getItem(CACHE) ?? "{}");
    all[key] = { at: Date.now(), a };
    const keys = Object.keys(all);
    if (keys.length > 80) keys.sort((x, y) => all[x].at - all[y].at).slice(0, keys.length - 80).forEach((k) => delete all[k]);
    localStorage.setItem(CACHE, JSON.stringify(all));
  } catch { /* storage blocked: no cache */ }
}

export async function answerQuestion(history: ChatMsg[], chosen: VoiceLang, voice: boolean): Promise<Answer> {
  const q = history[history.length - 1]?.content ?? "";
  const lang = langOf(q, chosen);
  const hub = getHubScans()[0];
  const intents = intentsOf(q);
  // Follow-up questions depend on the chat, so only a first question is answered from data or memory.
  const firstTurn = history.filter((m) => m.role === "user").length <= 1;
  if (firstTurn && intents.length && intents.every((i) => DATA_INTENTS.has(i))) {
    const o = await answerOffline(q, lang, getUser());
    return { text: o.text, lang: o.lang, source: "App data" };
  }
  const key = cacheKey(q, lang, hub?.id ?? "none");
  const hit = firstTurn ? cached(key) : null;
  if (hit) return hit;
  const online = isOnlineMode();
  if (cloudConfigured && online) {
    const res = await askAgent(history, lang, true, voice);
    if (res.ok && !res.offline) { const a: Answer = { text: res.answer, lang, source: "Claude AI" }; if (firstTurn) remember(key, a); return a; }
  }
  // The newest scan: this session's (main scanner or Kisan Hub), else the last one saved in Kisan Hub.
  const scan = getLatestScan() ?? hub?.result;
  const free = online ? await askFreeAI(history, lang, voice, scanContext(scan, hub?.crop)) : null;
  if (free) { const a: Answer = { text: free, lang, source: "AI" }; if (firstTurn) remember(key, a); return a; }
  const o = await answerOffline(q, lang, getUser());
  return { text: o.text, lang: o.lang, source: o.source === "wikipedia" ? "Wikipedia" : "App data" };
}
