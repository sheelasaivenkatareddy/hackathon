// The leaf from public/illustrations/leaf-first-spot.svg, split into groups so the spots and rings can animate.
import { motion } from "framer-motion";
import raw from "../../../public/illustrations/leaf-first-spot.svg?raw";

const doc = new DOMParser().parseFromString(raw, "image/svg+xml");
const inner = (id: string) => doc.getElementById(id)?.innerHTML ?? "";
const DEFS = doc.querySelector("defs")?.innerHTML ?? "";
const LEAF = doc.getElementById("leaf")?.outerHTML ?? "";
export const SPOTS = [1, 2, 3].map((n) => {
  const g = doc.getElementById(`spot-${n}`), ring = doc.getElementById(`ring-${n}`);
  return { n, html: inner(`spot-${n}`), cx: Number(g?.getAttribute("data-cx")), cy: Number(g?.getAttribute("data-cy")), ringR: Number(ring?.getAttribute("r")) };
});

export interface SpotState { scale: number; ring?: boolean }

export function LeafIllustration({ spots = {}, showFinder = false, className, title = "Illustration of a tomato leaflet" }: { spots?: Record<number, SpotState>; showFinder?: boolean; className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 400 520" className={className} role="img" aria-label={title}>
      <defs dangerouslySetInnerHTML={{ __html: DEFS }} />
      <g dangerouslySetInnerHTML={{ __html: LEAF }} />
      {SPOTS.map((s) => {
        const st = spots[s.n];
        return (
          <g key={s.n}>
            <motion.g style={{ transformOrigin: `${s.cx}px ${s.cy}px` }} initial={false} animate={{ scale: st?.scale ?? 0, opacity: st ? 1 : 0 }} transition={{ type: "spring", stiffness: 260, damping: 18 }} dangerouslySetInnerHTML={{ __html: s.html }} />
            {st?.ring && <Ring cx={s.cx} cy={s.cy} r={s.ringR} />}
          </g>
        );
      })}
      {showFinder && <Finder />}
    </svg>
  );
}

const Ring = ({ cx, cy, r }: { cx: number; cy: number; r: number }) => (
  <motion.circle cx={cx} cy={cy} r={r} fill="none" stroke="#B94A2C" strokeWidth={4} style={{ transformOrigin: `${cx}px ${cy}px` }}
    initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: [0.6, 1.25, 1, 1.25, 1], opacity: [0, 1, 1, 1, 1] }} transition={{ duration: 1.3, ease: "easeOut" }} />
);

const CORNERS = [
  { d: "M 94 64 V 30 H 128", x: -30, y: -30 }, { d: "M 324 30 H 358 V 64", x: 30, y: -30 },
  { d: "M 358 450 V 484 H 324", x: 30, y: 30 }, { d: "M 128 484 H 94 V 450", x: -30, y: 30 },
];
const Finder = () => (
  <g fill="none" stroke="#E3B04B" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round">
    {CORNERS.map((c) => <motion.path key={c.d} d={c.d} initial={{ x: c.x, y: c.y, opacity: 0 }} animate={{ x: 0, y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 240, damping: 16 }} />)}
  </g>
);
