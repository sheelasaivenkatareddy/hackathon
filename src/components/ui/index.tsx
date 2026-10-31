// Design system: buttons, cards, chips, badges, rings, stepper, sheet, toast, skeleton, empty state.
import { AnimatePresence, animate, motion, useReducedMotion } from "framer-motion";
import { ArrowDown, ArrowUp, Check, FlaskConical, Info, Loader2, Minus, X } from "lucide-react";
import { ButtonHTMLAttributes, ReactNode, createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../../lib/i18n";
import type { AnswerLevel, Mode } from "../../lib/model";
import type { WatchStatus } from "../../lib/vision/compare";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// ------------------------------------------------------------------ Button
type Variant = "primary" | "secondary" | "ghost" | "danger" | "lime" | "outline-light";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-green text-white hover:bg-green-dark",
  secondary: "bg-white text-forest border border-line hover:bg-surface",
  ghost: "bg-transparent text-green-dark hover:bg-green-tint",
  danger: "bg-tomato text-white hover:bg-tomato-dark",
  lime: "bg-lime text-forest hover:brightness-105",
  "outline-light": "bg-transparent text-white border border-white/70 hover:bg-white/10",
};
const BTN = "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-5 py-2 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant; loading?: boolean; to?: string }
export function Button({ variant = "primary", loading, to, className, children, disabled, onClick, type, ...rest }: BtnProps) {
  const cls = cx(BTN, VARIANTS[variant], className);
  if (to) {
    return (
      <motion.span whileTap={{ scale: 0.97 }} className="inline-flex">
        <Link to={to} className={cls}>{children}</Link>
      </motion.span>
    );
  }
  return (
    <motion.button whileTap={{ scale: 0.97 }} className={cls} disabled={disabled || loading} onClick={onClick} type={type ?? "button"} aria-label={rest["aria-label"]} aria-busy={loading || undefined} data-testid={(rest as Record<string, unknown>)["data-testid"] as string | undefined}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </motion.button>
  );
}

// ------------------------------------------------------------------ Card, Chip
export const Card = ({ className, children }: { className?: string; children: ReactNode }) => (
  <motion.div className={cx("rounded-card border border-line bg-surface p-4 shadow-soft md:p-6", className)} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-20px" }} transition={{ duration: 0.35, ease: "easeOut" }}>{children}</motion.div>
);

type Tone = "green" | "tomato" | "amber" | "muted" | "forest" | "lime";
const TONES: Record<Tone, string> = {
  green: "bg-green-tint text-green-dark",
  tomato: "bg-tomato-tint text-tomato-dark",
  amber: "bg-amber-tint text-amber-dark",
  muted: "bg-surface text-muted border border-line",
  forest: "bg-forest text-white",
  lime: "bg-lime text-forest",
};
export const Chip = ({ tone = "muted", className, children }: { tone?: Tone; className?: string; children: ReactNode }) => (
  <span className={cx("inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold md:text-sm", TONES[tone], className)}>{children}</span>
);

export function SampleChip({ children }: { children?: ReactNode }) {
  const { t } = useI18n();
  return <Chip tone="amber"><FlaskConical className="h-3.5 w-3.5" aria-hidden />{children ?? t("common.sample")}</Chip>;
}
export const SyntheticChip = () => <SampleChip>Synthetic test pair (spots added digitally)</SampleChip>;

export function DemoBanner() {
  const { t } = useI18n();
  return <div role="note" className="flex items-center gap-2 rounded-xl bg-amber-tint px-4 py-3 text-sm font-semibold text-amber-dark"><FlaskConical className="h-4 w-4 shrink-0" aria-hidden />{t("common.demo")}</div>;
}

const MODE_TEXT: Record<Mode, string> = { "on-device": "Model: on-device", server: "Model: server", demo: "Demo mode", none: "Model not connected" };
export const ModelStatusChip = ({ mode }: { mode: Mode }) => <Chip tone={mode === "on-device" || mode === "server" ? "green" : mode === "demo" ? "amber" : "muted"}>{MODE_TEXT[mode]}</Chip>;

// ------------------------------------------------------------------ AnswerBadge, StatusChip
const LEVEL_TONE: Record<AnswerLevel, Tone> = { CLEAR: "green", CHECK: "amber", RETAKE: "tomato", EXPERT: "tomato" };
export function AnswerBadge({ level }: { level: AnswerLevel }) {
  const { t } = useI18n();
  return (
    <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 320, damping: 20 }} className="inline-flex flex-wrap items-center gap-2">
      <Chip tone={LEVEL_TONE[level]} className="!text-sm"><strong>{level}</strong></Chip>
      <span className="font-semibold text-forest">{t(`level.${level}`)}</span>
    </motion.div>
  );
}

const STATUS: Record<WatchStatus, { tone: Tone; icon?: ReactNode; short: string }> = {
  first_spots_found: { tone: "tomato", short: "First spots found" },
  new_spots_found: { tone: "tomato", short: "New spots found" },
  spreading: { tone: "tomato", icon: <ArrowUp className="h-3.5 w-3.5" aria-hidden />, short: "Spreading" },
  stable: { tone: "amber", icon: <Minus className="h-3.5 w-3.5" aria-hidden />, short: "Stable" },
  improving: { tone: "green", icon: <ArrowDown className="h-3.5 w-3.5" aria-hidden />, short: "Improving" },
  not_comparable: { tone: "muted", short: "Not comparable" },
};
export function StatusChip({ status, big }: { status: WatchStatus; big?: boolean }) {
  const { t } = useI18n();
  const s = STATUS[status];
  // Short label in lists. The big chip uses the full translated status text.
  const text = big ? t(`status.${status}`) : status === "not_comparable" ? s.short : t(`status.${status}`);
  return (
    <motion.span initial={big ? { scale: 0.6 } : false} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 18 }} className="inline-flex">
      <Chip tone={s.tone} className={big ? "!px-4 !py-2 !text-base" : undefined}>
        {status === "first_spots_found" && (
          <motion.span className="h-2 w-2 rounded-full bg-tomato" animate={{ opacity: [1, 0.3, 1], scale: [1, 1.3, 1] }} transition={{ duration: 1.6, repeat: Infinity }} aria-hidden />
        )}
        {s.icon}{text}
      </Chip>
    </motion.span>
  );
}

// ------------------------------------------------------------------ Count up
export function CountUp({ to, decimals = 0, suffix = "" }: { to: number; decimals?: number; suffix?: string }) {
  const reduce = useReducedMotion();
  const [v, setV] = useState(reduce ? to : 0);
  useEffect(() => {
    if (reduce) { setV(to); return; }
    const c = animate(0, to, { duration: 0.8, ease: "easeOut", onUpdate: setV });
    return () => c.stop();
  }, [to, reduce]);
  return <>{v.toFixed(decimals)}{suffix}</>;
}

// ------------------------------------------------------------------ ProgressRing
export function ProgressRing({ value, size = 56, stroke = 6, color = "var(--green)", children }: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c}
          initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - Math.min(100, Math.max(0, value)) / 100) }} transition={{ type: "spring", stiffness: 90, damping: 18 }} />
      </svg>
      {children && <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-forest">{children}</div>}
    </div>
  );
}

// ------------------------------------------------------------------ Gauge (half circle)
export function Gauge({ score, label }: { score: number; label: string }) {
  const R = 90, C = Math.PI * R;
  const colour = score >= 65 ? "var(--tomato)" : score >= 35 ? "var(--amber)" : "var(--green)";
  return (
    <div className="mx-auto w-full max-w-[320px]" role="img" aria-label={`Overall risk score ${score} out of 100, ${label}`}>
      <svg viewBox="0 0 220 128" className="w-full">
        <path d="M 20 110 A 90 90 0 0 1 200 110" fill="none" stroke="var(--line)" strokeWidth="18" strokeLinecap="round" />
        <motion.path d="M 20 110 A 90 90 0 0 1 200 110" fill="none" strokeWidth="18" strokeLinecap="round" strokeDasharray={C}
          initial={{ strokeDashoffset: C, stroke: "#047857" }} animate={{ strokeDashoffset: C * (1 - score / 100), stroke: colour.includes("tomato") ? "#B94A2C" : colour.includes("amber") ? "#D97706" : "#047857" }} transition={{ duration: 1 }} />
        {/* The invisible half centres the group's box on the pivot, because SVG motion rotates around that centre. */}
        <motion.g initial={{ rotate: -90 }} animate={{ rotate: -90 + (score / 100) * 180 }} transition={{ type: "spring", stiffness: 70, damping: 10 }}>
          <line x1="110" y1="184" x2="110" y2="110" stroke="transparent" strokeWidth="4" />
          <line x1="110" y1="110" x2="110" y2="36" stroke="var(--forest)" strokeWidth="4" strokeLinecap="round" />
        </motion.g>
        <circle cx="110" cy="110" r="8" fill="var(--forest)" />
      </svg>
      <div className="-mt-1 text-center">
        <div className="font-heading text-5xl font-extrabold text-forest"><CountUp to={score} /></div>
        <div className="small">out of 100 · {label}</div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ Stepper
export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Steps">
      {steps.map((s, i) => (
        <li key={s} className="flex flex-1 items-center gap-2" aria-current={i === current ? "step" : undefined}>
          <span className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold", i < current ? "bg-green text-white" : i === current ? "bg-forest text-white" : "bg-surface text-muted border border-line")}>
            {i < current ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
          </span>
          <span className={cx("hidden text-sm font-semibold sm:inline", i === current ? "text-forest" : "text-muted")}>{s}</span>
          {i < steps.length - 1 && <span className={cx("h-0.5 flex-1 rounded", i < current ? "bg-green" : "bg-line")} />}
        </li>
      ))}
    </ol>
  );
}

// ------------------------------------------------------------------ BottomSheet
export function BottomSheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !panel.current) return;
      const items = panel.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,select,textarea,[tabindex="0"]');
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; before?.focus?.(); };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[1000] flex items-end justify-center bg-forest/50 md:items-center md:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-4 pb-8 shadow-soft outline-none md:rounded-3xl md:p-6"
            initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }} transition={{ type: "spring", stiffness: 320, damping: 30 }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="h3">{title}</h2>
              <button onClick={onClose} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface"><X className="h-5 w-5" aria-hidden /></button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ------------------------------------------------------------------ Toast
const ToastCtx = createContext<(msg: string) => void>(() => undefined);
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<{ id: number; text: string } | null>(null);
  const show = useCallback((text: string) => {
    const id = Date.now();
    setMsg({ id, text });
    setTimeout(() => setMsg((m) => (m?.id === id ? null : m)), 3500);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-[1100] flex justify-center px-4 md:bottom-8">
        <AnimatePresence>
          {msg && <motion.div key={msg.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }} className="rounded-full bg-forest px-5 py-3 text-sm font-semibold text-white shadow-soft">{msg.text}</motion.div>}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

// ------------------------------------------------------------------ Skeleton, EmptyState, Info, Reveal, Toggle
export const Skeleton = ({ className }: { className?: string }) => <div className={cx("animate-pulse rounded-card bg-surface", className)} aria-hidden />;

export const EmptyState = ({ title, text, illustration, children }: { title: string; text?: string; illustration: ReactNode; children?: ReactNode }) => (
  <div className="flex flex-col items-center rounded-card border border-dashed border-line px-6 py-10 text-center">
    <div className="mb-4">{illustration}</div>
    <h2 className="h3">{title}</h2>
    {text && <p className="small mt-1 max-w-md">{text}</p>}
    <div className="mt-5 flex flex-wrap justify-center gap-3">{children}</div>
  </div>
);

export function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex align-middle">
      <button type="button" onClick={() => setOpen((o) => !o)} onBlur={() => setOpen(false)} aria-label={text} aria-expanded={open} className="flex h-6 w-6 items-center justify-center rounded-full text-muted hover:bg-green-tint">
        <Info className="h-4 w-4" aria-hidden />
      </button>
      {open && <span role="tooltip" className="absolute bottom-full left-1/2 z-20 mb-1 w-56 -translate-x-1/2 rounded-xl bg-forest p-3 text-xs font-medium text-white shadow-soft">{text}</span>}
    </span>
  );
}

export const Reveal = ({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) => (
  <motion.div className={className} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.4, delay: delay * 0.08 }}>{children}</motion.div>
);

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex min-h-[44px] cursor-pointer items-start justify-between gap-4">
      <span>
        <span className="block font-semibold text-forest">{label}</span>
        {hint && <span className="small mt-0.5 block">{hint}</span>}
      </span>
      <span className="relative mt-1 inline-flex shrink-0">
        <input type="checkbox" role="switch" className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className={cx("flex h-7 w-12 items-center rounded-full p-1 transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-lime", checked ? "bg-green" : "bg-muted/60")}>
          <motion.span layout className={cx("h-5 w-5 rounded-full bg-white", checked && "ml-auto")} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
        </span>
      </span>
    </label>
  );
}

/** Shown when a file from the kit is missing. Never replaced by a stock photo. */
export const PhotoPlaceholder = ({ label }: { label: string }) => (
  <div className="flex h-full w-full items-center justify-center bg-surface p-4 text-center text-sm text-muted">{label}</div>
);
