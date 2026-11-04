// One answer flow for Kisan Vani, the voice agent and the Ask AI panel:
// 1. Claude (ask-agent), when the key is set  2. the free open AI, with the last scan as context
// 3. the app's own data (prices, weather, fertilizer, last scan)  4. Wikipedia, for general facts.
import { ChatMsg, askAgent, getLatestScan } from "../lib/agent";
import { cloudConfigured } from "../lib/cloud";
import { askFreeAI, scanContext } from "../lib/freeAI";
import { answerOffline, langOf } from "./offlineBrain";
import { VoiceLang, getHubScans, getUser } from "./store";

export type AnswerSource = "Claude AI" | "AI" | "App data" | "Wikipedia";
export interface Answer { text: string; lang: VoiceLang; source: AnswerSource }

export async function answerQuestion(history: ChatMsg[], chosen: VoiceLang, voice: boolean): Promise<Answer> {
  const q = history[history.length - 1]?.content ?? "";
  const lang = langOf(q, chosen);
  if (cloudConfigured) {
    const res = await askAgent(history, lang, true, voice);
    if (res.ok && !res.offline) return { text: res.answer, lang, source: "Claude AI" };
  }
  // The newest scan: this session's (main scanner or Kisan Hub), else the last one saved in Kisan Hub.
  const hub = getHubScans()[0];
  const scan = getLatestScan() ?? hub?.result;
  const free = await askFreeAI(history, lang, voice, scanContext(scan, hub?.crop));
  if (free) return { text: free, lang, source: "AI" };
  const o = await answerOffline(q, lang, getUser());
  return { text: o.text, lang: o.lang, source: o.source === "wikipedia" ? "Wikipedia" : "App data" };
}
