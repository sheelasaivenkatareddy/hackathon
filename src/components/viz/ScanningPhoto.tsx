// Shown while the AI works: the photo under a moving scan line, with steps that tick along.
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { Viewfinder } from ".";

export default function ScanningPhoto({ url, steps }: { url: string; steps: string[] }) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), 1100);
    return () => clearInterval(t);
  }, [reduce, steps.length]);
  return (
    <div className="mx-auto max-w-xl" role="status" aria-label={steps[step]}>
      <Viewfinder className="overflow-hidden rounded-card bg-forest">
        <div className="relative">
          <img src={url} alt="Your leaf, being checked" className="block w-full" />
          <div className="scan-grid absolute inset-0 bg-forest/25" aria-hidden />
          {!reduce && (
            <motion.div aria-hidden className="absolute inset-x-0 h-16 bg-gradient-to-b from-transparent to-lime/50" style={{ borderBottom: "2px solid #E3B04B", boxShadow: "0 6px 18px #E3B04B" }}
              initial={{ top: "-15%" }} animate={{ top: "100%" }} transition={{ duration: 1.7, ease: "easeInOut", repeat: Infinity, repeatType: "reverse" }} />
          )}
        </div>
      </Viewfinder>
      <div className="mt-4 h-7 text-center font-heading font-bold text-forest">
        <AnimatePresence mode="wait">
          <motion.p key={step} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>{steps[step]}</motion.p>
        </AnimatePresence>
      </div>
      <div className="mx-auto mt-2 flex max-w-[160px] gap-1.5" aria-hidden>
        {steps.map((s, i) => <span key={s} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${i <= step ? "bg-green" : "bg-line"}`} />)}
      </div>
    </div>
  );
}
