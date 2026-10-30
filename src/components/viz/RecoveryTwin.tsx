// Crop Recovery Twin: 5 leaves whose colour follows the affected % at the chosen visit.
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { Visit } from "../../lib/db";
import { fmtShort } from "../../lib/watch";
import { CountUp, ProgressRing } from "../ui";

const mix = (a: number[], b: number[], t: number) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`;
const GREEN = [62, 155, 75], SICK = [150, 110, 40];
const LEAVES = [
  { d: "M100 150 C 70 140 45 120 35 90 C 70 90 95 115 100 150 Z", w: 1.4 },
  { d: "M100 150 C 130 140 155 120 165 90 C 130 90 105 115 100 150 Z", w: 1.2 },
  { d: "M100 110 C 75 100 55 82 50 55 C 80 58 98 80 100 110 Z", w: 1 },
  { d: "M100 110 C 125 100 145 82 150 55 C 120 58 102 80 100 110 Z", w: 0.8 },
  { d: "M100 75 C 85 60 80 35 100 12 C 120 35 115 60 100 75 Z", w: 0.5 },
];

export default function RecoveryTwin({ visits }: { visits: Visit[] }) {
  const [idx, setIdx] = useState(Math.max(0, visits.length - 1));
  useEffect(() => setIdx(Math.max(0, visits.length - 1)), [visits.length]);
  const v = visits[idx];
  const affected = v?.affectedPct ?? 0;
  const health = Math.round(Math.max(0, 100 - affected));
  // Lower leaves show damage first. Colour scale reaches full brown at 50% affected.
  const leafColour = (w: number) => mix(GREEN, SICK, Math.min(1, (affected * w) / 50));
  return (
    <div>
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 200 200" className="h-44 w-44 shrink-0" role="img" aria-label={`Plant illustration at ${health} percent health`}>
          <path d="M100 195 L100 15" stroke="#0F766E" strokeWidth="5" strokeLinecap="round" />
          <ellipse cx="100" cy="195" rx="50" ry="5" fill="#E2E8F0" />
          {LEAVES.map((l) => <motion.path key={l.d} d={l.d} initial={false} animate={{ fill: leafColour(l.w) }} transition={{ duration: 0.6 }} />)}
        </svg>
        <div>
          <ProgressRing value={health} size={84} stroke={8}><span className="text-base"><CountUp to={health} suffix="%" /></span></ProgressRing>
          <div className="small mt-1">Health ring: 100 − affected %</div>
        </div>
      </div>
      {visits.length > 1 && (
        <label className="mt-4 block">
          <span className="field-label">Visit: {v ? fmtShort(v.date) : ""} · {affected}% affected</span>
          <input type="range" min={0} max={visits.length - 1} value={idx} onChange={(e) => setIdx(Number(e.target.value))} className="h-11 w-full accent-[#0F766E]" />
        </label>
      )}
      <p className="tiny mt-2">Built only from your photos. No sensors in this prototype.</p>
    </div>
  );
}
