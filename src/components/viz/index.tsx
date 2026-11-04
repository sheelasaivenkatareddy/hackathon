// Visual pieces: PhoneFrame, Viewfinder, CompareSlider, SpotRings, OverlayCanvas, WPattern, HeroLeaf.
import { AnimatePresence, animate, motion, useMotionTemplate, useMotionValue, useReducedMotion } from "framer-motion";
import { ReactNode, useEffect, useRef, useState } from "react";
import type { NewDamage } from "../../lib/vision/compare";
import type { RGBAImage } from "../../lib/vision/types";
import { LeafIllustration, SpotState } from "./LeafIllustration";

export const PhoneFrame = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={`relative mx-auto w-[260px] rounded-[40px] border-[8px] border-black/80 bg-black/80 shadow-2xl md:w-[300px] ${className ?? ""}`}>
    <div className="relative aspect-[9/17] overflow-hidden rounded-[32px] bg-deep lit">{children}</div>
  </div>
);

/** The four corners from the logo, around any photo or focus element. */
export const Viewfinder = ({ children, className, color = "#E3B04B" }: { children?: ReactNode; className?: string; color?: string }) => (
  <div className={`relative ${className ?? ""}`}>
    {children}
    <svg className="pointer-events-none absolute inset-2 h-[calc(100%-16px)] w-[calc(100%-16px)]" aria-hidden>
      {[["0%", "0%", 1, 1], ["100%", "0%", -1, 1], ["100%", "100%", -1, -1], ["0%", "100%", 1, -1]].map(([x, y, sx, sy]) => (
        <svg key={`${x}${y}`} x={x as string} y={y as string} overflow="visible">
          <path d={`M 0 ${28 * (sy as number)} V 0 H ${28 * (sx as number)}`} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ))}
    </svg>
  </div>
);

// ------------------------------------------------------------------ CompareSlider
export function CompareSlider({ a, b, labelA, labelB, altA, altB, aspect = "4 / 3" }: { a?: string; b?: string; labelA: string; labelB: string; altA: string; altB: string; aspect?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const pos = useMotionValue(50);
  const [now, setNow] = useState(50);
  const clip = useMotionTemplate`inset(0 0 0 ${pos}%)`;
  const left = useMotionTemplate`${pos}%`;
  const dragging = useRef(false);
  const set = (v: number, spring = false) => {
    const clamped = Math.max(0, Math.min(100, v));
    setNow(Math.round(clamped));
    if (spring) animate(pos, clamped, { type: "spring", stiffness: 300, damping: 25 }); else pos.set(clamped);
  };
  const fromEvent = (x: number) => { const r = box.current!.getBoundingClientRect(); return ((x - r.left) / r.width) * 100; };
  return (
    <div ref={box} className="relative w-full touch-pan-y select-none overflow-hidden rounded-card bg-surface" style={{ aspectRatio: aspect }}
      onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); set(fromEvent(e.clientX), true); }}
      onPointerMove={(e) => { if (dragging.current) set(fromEvent(e.clientX)); }}
      onPointerUp={() => { dragging.current = false; }}>
      {a && <img src={a} alt={altA} className="absolute inset-0 h-full w-full object-cover" draggable={false} />}
      {b && <motion.img src={b} alt={altB} className="absolute inset-0 h-full w-full object-cover" style={{ clipPath: clip }} draggable={false} />}
      <span className="absolute left-2 top-2 rounded-full bg-deep/85 lit px-3 py-1 text-xs font-semibold text-white">{labelA}</span>
      <span className="absolute right-2 top-2 rounded-full bg-deep/85 lit px-3 py-1 text-xs font-semibold text-white">{labelB}</span>
      <motion.div className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white" style={{ left }} aria-hidden />
      <motion.div role="slider" tabIndex={0} aria-label="Compare the two photos" aria-valuemin={0} aria-valuemax={100} aria-valuenow={now}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") { e.preventDefault(); set(now - 5, true); }
          if (e.key === "ArrowRight") { e.preventDefault(); set(now + 5, true); }
        }}
        className="absolute top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full bg-white text-forest shadow-soft" style={{ left }}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M7 5 L2 10 L7 15" /><path d="M13 5 L18 10 L13 15" /></svg>
      </motion.div>
    </div>
  );
}

// ------------------------------------------------------------------ OverlayCanvas
export function OverlayCanvas({ image, className, style }: { image: RGBAImage; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = image.width; c.height = image.height;
    c.getContext("2d")?.putImageData(new ImageData(new Uint8ClampedArray(image.data), image.width, image.height), 0, 0);
  }, [image]);
  return <canvas ref={ref} className={className} style={style} aria-hidden />;
}

// ------------------------------------------------------------------ SpotRings: drawn in the photo's 512 px space
export function SpotRings({ components, width, height, onRing }: { components: NewDamage[]; width: number; height: number; onRing?: (c: NewDamage) => void }) {
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 ${width} ${height}`} role="group" aria-label={`${components.length} new damage marks`}>
      {components.map((c, i) => {
        const r = Math.max(10, c.r * 1.8);
        return (
          <motion.circle key={`${c.x}-${c.y}`} cx={c.x} cy={c.y} r={r} fill="transparent" stroke="#B94A2C" strokeWidth={Math.max(2.5, width / 170)}
            style={{ transformOrigin: `${c.x}px ${c.y}px`, cursor: onRing ? "zoom-in" : undefined }}
            initial={{ scale: 0, opacity: 0 }} animate={{ scale: [0, 1.25, 1, 1.25, 1], opacity: 1 }} transition={{ duration: 1.3, delay: 0.15 * i, ease: "easeOut" }}
            onClick={onRing && (() => onRing(c))} role={onRing ? "button" : undefined} tabIndex={onRing ? 0 : undefined}
            aria-label={onRing ? `Zoom to new ${c.kind}` : undefined} onKeyDown={onRing && ((e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onRing(c); } })} />
        );
      })}
    </svg>
  );
}

// ------------------------------------------------------------------ WPattern: draws itself, then the plants pop in
export function WPattern({ count = 5 }: { count?: number }) {
  // Evenly spaced along the W, so any plant number from 3 to 10 still follows the pattern.
  const W: [number, number][] = [[30, 30], [95, 150], [160, 50], [225, 150], [290, 30]];
  const at = (t: number): [number, number] => {
    const s = Math.min(0.9999, t) * (W.length - 1), i = Math.floor(s), f = s - i;
    return [W[i][0] + (W[i + 1][0] - W[i][0]) * f, W[i][1] + (W[i + 1][1] - W[i][1]) * f];
  };
  const dots = Array.from({ length: count }, (_, i) => at(count === 1 ? 0 : i / (count - 1)));
  return (
    <svg viewBox="0 0 320 180" className="w-full max-w-md rounded-card bg-green-tint" role="img" aria-label={`Field with ${count} sentinel plants placed along a W pattern`}>
      <rect x="10" y="10" width="300" height="160" rx="12" fill="none" stroke="#2DD4BF" strokeWidth="2" strokeDasharray="6 6" />
      <motion.polyline key={count} points={W.map((p) => p.join(",")).join(" ")} fill="none" stroke="#22D3EE" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: "easeInOut" }} />
      {dots.map(([x, y], i) => (
        <motion.circle key={`${count}-${i}`} cx={x} cy={y} r="8" fill="#B94A2C" stroke="#fff" strokeWidth="2" style={{ transformOrigin: `${x}px ${y}px` }}
          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 15, delay: 0.3 + (i * 0.9) / count }} />
      ))}
    </svg>
  );
}

// ------------------------------------------------------------------ HeroLeaf: 9 s loop from the spec
type Phase = { day: string; spots: Record<number, SpotState>; toast?: string; card?: boolean; scan?: boolean };
const DAY1: Phase = { day: "Day 1", spots: {} };
const TIMELINE: [number, Phase][] = [
  [0, DAY1],
  [800, { ...DAY1, scan: true }],
  [3000, { day: "Day 3", spots: { 1: { scale: 1, ring: true } }, toast: "New spot found · Day 3" }],
  [5000, { day: "Day 5", spots: { 1: { scale: 1.25, ring: true }, 2: { scale: 1, ring: true }, 3: { scale: 1, ring: true } }, toast: "Spreading · 2 more" }],
  [7000, { day: "Day 5", spots: { 1: { scale: 1.25 }, 2: { scale: 1 }, 3: { scale: 1 } }, card: true }],
];

export function HeroLeaf() {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>(reduce ? TIMELINE[2][1] : DAY1);
  const [cycle, setCycle] = useState(0);
  useEffect(() => {
    if (reduce) { setPhase(TIMELINE[2][1]); return; }
    const timers = TIMELINE.map(([at, p]) => setTimeout(() => setPhase(p), at));
    timers.push(setTimeout(() => setPhase(DAY1), 8600));
    timers.push(setTimeout(() => setCycle((c) => c + 1), 9000));
    return () => timers.forEach(clearTimeout);
  }, [cycle, reduce]);
  return (
    <PhoneFrame>
      <div className="absolute inset-0 bg-gradient-to-b from-[#0A2A3F] to-deep" />
      <AnimatePresence mode="popLayout">
        <motion.span key={phase.day} initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} className="absolute left-3 top-4 z-10 rounded-full bg-lime px-3 py-1 text-xs font-bold text-forest">{phase.day}</motion.span>
      </AnimatePresence>
      <LeafIllustration key={cycle} spots={phase.spots} showFinder className="absolute inset-x-0 top-10 h-[78%] w-full" title="Illustration: a tomato leaf developing its first spots over five days" />
      {phase.scan && !reduce && (
        <motion.div className="absolute inset-x-6 h-0.5 bg-lime shadow-[0_0_12px_#E3B04B]" initial={{ top: "12%" }} animate={{ top: "84%" }} transition={{ duration: 1.8, ease: "linear" }} />
      )}
      <AnimatePresence>
        {phase.toast && (
          <motion.div key={phase.toast} initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-x-3 bottom-4 rounded-xl bg-white px-3 py-2 text-center text-xs font-bold text-tomato-dark shadow-soft">{phase.toast}</motion.div>
        )}
        {phase.card && (
          <motion.div key="card" initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 240, damping: 22 }} className="absolute inset-x-3 bottom-4 rounded-2xl bg-white p-3 text-center text-sm font-bold text-forest shadow-soft">Early alert sent to Leaf Watch</motion.div>
        )}
      </AnimatePresence>
    </PhoneFrame>
  );
}

// Re-export so pages import from one place.
export { LeafIllustration } from "./LeafIllustration";
