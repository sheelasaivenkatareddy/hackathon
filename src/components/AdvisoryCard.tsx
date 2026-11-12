// Ask the library, call the farmer helpline, or send a scan to an expert.
import { motion } from "framer-motion";
import { ExternalLink, MessageCircleQuestion, Phone, Search, UserCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { Answer, askLibrary } from "../lib/ask";
import { KCC } from "../lib/guidance";
import { useI18n } from "../lib/i18n";
import { Button, Card, useToast } from "./ui";

export default function AdvisoryCard() {
  const { disease } = useI18n();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [answers, setAnswers] = useState<Answer[] | null>(null);
  const [busy, setBusy] = useState(false);

  const ask = async (e: FormEvent) => {
    e.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    try { setAnswers(await askLibrary(q)); }
    catch { toast("The library could not be searched. Please try again."); }
    finally { setBusy(false); }
  };

  return (
    <Card className="!bg-white" >
      <div data-testid="advisory">
        <h3 className="h3 flex items-center gap-2"><MessageCircleQuestion className="h-5 w-5 text-green" aria-hidden />Need advice?</h3>
        <form onSubmit={ask} className="mt-3 flex gap-2" role="search">
          <label className="relative flex-1"><span className="sr-only">Ask about a plant problem</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <input className="field-input !pl-9" placeholder="Ask, for example: white powder on leaves" value={q} onChange={(e) => setQ(e.target.value)} data-testid="ask-input" />
          </label>
          <Button type="submit" loading={busy}>Search</Button>
        </form>
        <p className="tiny mt-1">This searches the Patra Chain - Blockchain-based crop disease verification system disease library. It is not an AI chatbot.</p>
        {answers && (
          <ul className="mt-3 space-y-2" aria-live="polite" data-testid="ask-results">
            {answers.map((a, i) => (
              <motion.li key={a.name} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
                <Link to={a.to} className="block rounded-xl border border-line p-3 hover:border-green"><strong className="text-forest">{disease(a.name)}</strong><span className="small mt-0.5 block">{a.snippet}</span></Link>
              </motion.li>
            ))}
            {!answers.length && <li className="small" data-testid="ask-none">I couldn't find that in the library. Try different words, or call the helpline below.</li>}
          </ul>
        )}
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl bg-green-tint p-4">
            <p className="flex items-center gap-2 font-heading font-bold text-forest"><Phone className="h-4 w-4" aria-hidden />Kisan Call Centre</p>
            <a href={`tel:${KCC.tel}`} className="mt-1 block font-heading text-2xl font-extrabold text-green-dark underline-offset-4 hover:underline">{KCC.number}</a>
            <p className="small mt-1">Free. Agriculture experts answer in your language, {KCC.hours}.</p>
            <a href={KCC.source.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex min-h-[32px] items-center gap-1 text-sm font-semibold text-green-dark underline">Source: {KCC.source.name}<ExternalLink className="h-3.5 w-3.5" aria-hidden /></a>
          </div>
          <div className="rounded-xl bg-surface p-4">
            <p className="flex items-center gap-2 font-heading font-bold text-forest"><UserCheck className="h-4 w-4" aria-hidden />Send a scan to an expert</p>
            <p className="small mt-1">Open a scan in My scans and choose Ask an expert. Your report can also be shared with your agriculture officer.</p>
            <Button variant="secondary" to="/history" className="mt-2 !text-sm">Open my scans</Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
