// Kisan Hub design pieces: glass cards, stat tiles, trend badges, sparklines and the language picker.
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, FlaskConical, Minus } from "lucide-react";
import type { ReactNode } from "react";
import type { Trend } from "./mandi";
import { setHubLang, useHubLang } from "./store";
import { VOICE_LANGS } from "./voice";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export const Glass = ({ className, children, delay = 0, hover }: { className?: string; children: ReactNode; delay?: number; hover?: boolean }) => (
  <motion.div className={cx("hub-card min-w-0", hover && "hub-card-hover", className)} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: delay * 0.06, ease: "easeOut" }}>
    {children}
  </motion.div>
);

export const PageHead = ({ eyebrow, title, sub, right }: { eyebrow: string; title: ReactNode; sub?: string; right?: ReactNode }) => (
  <div className="mb-5 flex flex-wrap items-end justify-between gap-3 md:mb-7">
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-neon-cyan">{eyebrow}</p>
      <h1 className="hub-title mt-1">{title}</h1>
      {sub && <p className="hub-muted mt-1 max-w-2xl">{sub}</p>}
    </div>
    {right}
  </div>
);

type Tone = "cyan" | "lime" | "red" | "amber" | "slate" | "pink";
const TONE: Record<Tone, string> = {
  cyan: "border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan",
  lime: "border-neon-lime/40 bg-neon-lime/10 text-neon-lime",
  red: "border-neon-red/40 bg-neon-red/10 text-neon-red",
  amber: "border-neon-amber/40 bg-neon-amber/10 text-neon-amber",
  slate: "border-white/15 bg-white/5 text-slate-300",
  pink: "border-neon-pink/40 bg-neon-pink/10 text-neon-pink",
};
export const Pill = ({ tone = "slate", children, className }: { tone?: Tone; children: ReactNode; className?: string }) => (
  <span className={cx("hub-chip", TONE[tone], className)}>{children}</span>
);
export const SamplePill = ({ children = "Sample data" }: { children?: ReactNode }) => (
  <Pill tone="amber"><FlaskConical className="h-3 w-3" aria-hidden />{children}</Pill>
);

export function Stat({ icon, label, value, sub, tone = "cyan", delay }: { icon: ReactNode; label: string; value: ReactNode; sub?: string; tone?: Tone; delay?: number }) {
  return (
    <Glass delay={delay} className="!p-4">
      <div className="flex items-center gap-3">
        <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border", TONE[tone])}>{icon}</span>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
          <p className="font-heading text-xl font-extrabold text-white md:text-2xl">{value}</p>
        </div>
      </div>
      {sub && <p className="mt-2 truncate text-xs text-slate-400">{sub}</p>}
    </Glass>
  );
}

export function TrendBadge({ t }: { t: Trend }) {
  if (t.kind === "bull") return <Pill tone="lime"><ArrowUpRight className="h-3 w-3" aria-hidden />Bullish +{t.pct}%</Pill>;
  if (t.kind === "bear") return <Pill tone="red"><ArrowDownRight className="h-3 w-3" aria-hidden />Bearish {t.pct}%</Pill>;
  return <Pill tone="slate"><Minus className="h-3 w-3" aria-hidden />Steady {t.pct > 0 ? "+" : ""}{t.pct}%</Pill>;
}

export function Sparkline({ values, w = 96, h = 28, color }: { values: number[]; w?: number; h?: number; color?: string }) {
  if (values.length < 2) return <span className="text-xs text-slate-500">—</span>;
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 2 - ((v - min) / span) * (h - 4)}`).join(" ");
  const up = values[values.length - 1] >= values[0];
  const c = color ?? (up ? "#A3E635" : "#F87171");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="overflow-visible">
      <polyline points={pts} fill="none" stroke={c} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 4px ${c}88)` }} />
    </svg>
  );
}

export function LangPicker({ compact }: { compact?: boolean }) {
  const lang = useHubLang();
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Voice language">
      {VOICE_LANGS.map((l) => (
        <button key={l.id} onClick={() => setHubLang(l.id)} aria-pressed={lang === l.id}
          className={cx("min-h-[36px] rounded-full border px-3 text-sm font-semibold transition", lang === l.id ? "border-neon-cyan bg-neon-cyan/15 text-neon-cyan shadow-[0_0_12px_rgba(34,211,238,0.35)]" : "border-white/10 text-slate-300 hover:border-white/30")}>
          {compact ? l.native.slice(0, 2) : l.native}
        </button>
      ))}
    </div>
  );
}

export const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
