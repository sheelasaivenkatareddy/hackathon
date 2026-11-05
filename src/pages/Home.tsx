// The home page: what Patra Lens is, how it works, and how well it does.
import { AnimatePresence, motion, useInView, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Aperture, BookOpen, Building2, Calculator, Camera, ChevronDown, CloudSun, FlaskConical, Gift, HeartPulse, ImageOff, Languages, Mic, Microscope, RadioTower, ScanLine, Sprout, TrendingUp, TriangleAlert, UserCheck, Wheat, Zap } from "lucide-react";
import { ReactNode, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Card, Chip, CountUp, Reveal } from "../components/ui";
import LiveDemo from "../components/LiveDemo";
import { ModeSwitch, useOnline } from "../components/OfflineGate";
import { CompareSlider, HeroLeaf, LeafIllustration, Viewfinder } from "../components/viz";
import type { SpotState } from "../components/viz/LeafIllustration";
import { CONFIG } from "../config";
import { PLANTS } from "../lib/diagnose";
import { useI18n } from "../lib/i18n";

const pct = (v: number | null) => (v === null ? null : `${Math.round(v * 100)}%`);

const PROBLEMS = [
  { icon: Camera, title: "One photo is a snapshot", text: "Most apps judge a single photo, usually after symptoms are clear." },
  { icon: ImageOff, title: "Field photos are messy", text: "Blur, shade and clutter mislead models trained on clean lab photos." },
  { icon: TriangleAlert, title: "Confident mistakes cost money", text: "A wrong answer shown as certain can lead to the wrong spray." },
];
const STEPS = [
  { icon: CloudSun, title: "Predict", text: "Weather risk sets how often to check." },
  { icon: ScanLine, title: "Watch", text: "Photograph the same sentinel leaves every 2–3 days." },
  { icon: Microscope, title: "Detect", text: "New spots are flagged. The AI names the problem, or says 'not sure'." },
  { icon: RadioTower, title: "Warn", text: "Confirmed cases alert nearby farms, with consent." },
];
const FEATURES = [
  { icon: Sprout, title: "Leaf Watch", text: "Same leaves, every few days. New spots, holes and feeding marks are flagged.", to: "/watch" },
  { icon: Aperture, title: "Photo Coach", text: "Checks blur, light and leaf size before any answer.", to: "/scan" },
  { icon: Microscope, title: "Honest Diagnosis", text: "Top 3 answers with confidence, or 'not sure'.", to: "/scan" },
  { icon: Wheat, title: "Your action plan", text: "After a diagnosis, see what to use, approximately how much for your field, and what to expect.", to: "/scan" },
  { icon: HeartPulse, title: "Recovery Tracker", text: "After treatment, see whether the plant is improving.", to: "/watch" },
  { icon: CloudSun, title: "Risk Score", text: "Weather and nearby reports show when to check more often.", to: "/risk" },
  { icon: RadioTower, title: "Disease Radar", text: "A sudden rise in nearby confirmed cases triggers an early alert.", to: "/radar" },
  { icon: BookOpen, title: "Disease library", text: "Search every condition the AI knows, with its real test results.", to: "/diseases" },
  { icon: UserCheck, title: "Expert in the loop", text: "Unsure cases go to an expert. Their labels improve the model.", to: "/expert" },
];
const COMPARE = [
  ["Change over time", "Not tracked", "New spots flagged between visits"],
  ["Bad photo", "Answers anyway", "Asks for a retake"],
  ["Unclear case", "One label", "Top 3 or \"not sure\""],
  ["Why this answer", "Not shown", "Spots marked on the leaf"],
  ["After treatment", "Not tracked", "Improving or not yet"],
  ["Before symptoms", "Nothing", "Weather risk estimate"],
  ["Neighbour risk", "Not shown", "Area-level early alert"],
];
const HONEST = [
  { title: "No pesticide advice", text: "Patra Lens never names pesticides or pesticide doses. It tells you what to check and who to ask." },
  { title: "Private by default", text: "Location is shared only if you turn it on, and only as an approximate 1 km area." },
  { title: "Estimates, not promises", text: "Risk scores are estimates from weather and reports, not predictions." },
  { title: "Measured, not claimed", text: "Accuracy is measured on held-out field photos, not lab photos. Anything we have not measured yet shows 'To be measured'." },
];
const STACK = ["React", "OpenCV.js", "ONNX Runtime Web", "DINOv2", "Open-Meteo", "OpenStreetMap", "IndexedDB"];
const ROADMAP = [
  { title: "Now", items: ["13 plants + paddy", "Leaf Watch", "Voice agent in 6 languages", "Kisan Hub: mandi, labs, schemes"] },
  { title: "Next", items: ["Offline install", "More Indian crops", "Live Agmarknet prices"] },
  { title: "Later", items: ["Field validation with local experts", "Extension-officer dashboard", "Pest trap photos"] },
];
const FAQ = [
  ["Does Patra Lens tell me which pesticide to use?", "No. It suggests what to check and who to ask. Treatment decisions stay with the farmer and local experts."],
  ["Does it suggest fertilizer?", "Yes. After a diagnosis it shows what to use and what to avoid. For tomato, potato and corn, enter your field size to see approximate amounts from university recommendations. A soil test gives better numbers. Fertilizer supports the plant but does not cure disease."],
  ["How accurate is it?", `On ${CONFIG.measured.fieldTestPhotos} public field photos it had never seen, the top answer was right ${pct(CONFIG.measured.fieldAccuracy)} of the time, and the right answer was in the top 3 ${pct(CONFIG.measured.fieldTop3)} of the time. Tomato alone was lower, at ${pct(CONFIG.measured.tomatoFieldAccuracy)}. These are not local farm photos yet, so always confirm with an expert.`],
  ["Does it need internet?", "Photo checks, spot comparison and the on-device model run in the browser. Weather and the shared radar need internet."],
  ["What happens to my location?", "It is shared only if you turn it on, and only as an approximate 1 km area. Exact locations are never stored."],
  ["Which crops?", "The AI knows 27 conditions across 13 plants: tomato, apple, bell pepper, blueberry, cherry, corn, grape, peach, potato, raspberry, soybean, squash and strawberry. Any other plant can get a wrong answer."],
];

const Section = ({ id, tint, children }: { id?: string; tint?: boolean; children: ReactNode }) => (
  <section id={id} className={`section ${tint ? "bg-surface" : "bg-white"}`}><Reveal className="wrap">{children}</Reveal></section>
);
const IconBox = ({ children }: { children: ReactNode }) => <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-green-tint text-green-dark">{children}</span>;

const HeroWord = ({ children, delay, className }: { children: ReactNode; delay: number; className?: string }) => (
  <motion.span aria-hidden className={`mr-[0.25em] inline-block ${className ?? ""}`} initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 120, damping: 16, delay }}>{children}</motion.span>
);

function StatsBand() {
  const m = CONFIG.measured;
  const stats = [
    { to: Math.round((m.fieldAccuracy ?? 0) * 100), suffix: "%", label: "Top answer right on field photos" },
    { to: Math.round((m.fieldTop3 ?? 0) * 100), suffix: "%", label: "Right answer in the top 3" },
    { to: 13, label: "Plants, 27 conditions" },
    { to: m.secondsPerPhoto ?? 0, prefix: "About ", suffix: " s", label: "Per scan on a laptop" },
  ];
  return (
    <section className="wrap relative z-10 -mt-10 md:-mt-14">
      <div className="grid grid-cols-2 divide-line overflow-hidden rounded-2xl border border-line bg-white shadow-soft lg:grid-cols-4 lg:divide-x">
        {stats.map((s) => (
          <div key={s.label} className="p-5 md:p-6">
            <div className="font-heading text-2xl font-extrabold text-forest md:text-4xl">{s.prefix && <span className="text-base font-bold md:text-lg">{s.prefix}</span>}<InViewCount to={s.to} suffix={s.suffix} /></div>
            <p className="mt-1 text-sm text-muted">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function PlantStrip() {
  const row = [...PLANTS, ...PLANTS];
  return (
    <section className="py-10 md:py-12" aria-label={`Works on ${PLANTS.join(", ")}`}>
      <p className="eyebrow text-center">Works on 13 plants</p>
      <div className="marquee mt-4 overflow-hidden" aria-hidden>
        <div className="marquee-track gap-3 px-2">
          {row.map((p, i) => <span key={`${p}-${i}`} className="whitespace-nowrap rounded-full border border-line bg-surface px-5 py-2 font-semibold text-forest">{p}</span>)}
        </div>
      </div>
    </section>
  );
}

function IdeaPanels() {
  const panels: { day: string; spots: Record<number, SpotState>; chip: string | null }[] = [
    { day: "Day 1", spots: {}, chip: null },
    { day: "Day 3", spots: { 1: { scale: 1, ring: true } }, chip: "New spot" },
    { day: "Day 5", spots: { 1: { scale: 1.25 }, 2: { scale: 1, ring: true }, 3: { scale: 1, ring: true } }, chip: "Spreading" },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {panels.map((p, i) => (
        <Reveal key={p.day} delay={i}>
          <Viewfinder className="rounded-card bg-deep lit p-3" color="#E3B04B">
            <div className="flex items-center justify-between px-1 text-sm font-bold text-white">
              <span>{p.day}</span>
              {p.chip && <span className="rounded-full bg-tomato px-2.5 py-0.5 text-xs text-white">{p.chip}</span>}
            </div>
            <LeafIllustration spots={p.spots} className="mx-auto mt-1 h-56 w-full" title={`Illustration: the leaf on ${p.day}${p.chip ? `, ${p.chip}` : ", clean"}`} />
          </Viewfinder>
        </Reveal>
      ))}
    </div>
  );
}

function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 85%", "end 55%"] });
  const line = useTransform(scrollYProgress, [0, 1], [0, 1]);
  const [reached, setReached] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => setReached(Math.ceil(v * STEPS.length + 0.01)));
  return (
    <div ref={ref} className="relative mt-10">
      <svg className="absolute left-7 top-0 h-full w-1 md:hidden" preserveAspectRatio="none" viewBox="0 0 2 100" aria-hidden>
        <line x1="1" y1="0" x2="1" y2="100" stroke="var(--line)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <motion.line x1="1" y1="0" x2="1" y2="100" stroke="var(--green)" strokeWidth="3" vectorEffect="non-scaling-stroke" style={{ pathLength: line }} />
      </svg>
      <svg className="absolute left-[12%] top-7 hidden h-1 w-[76%] md:block" preserveAspectRatio="none" viewBox="0 0 100 2" aria-hidden>
        <line x1="0" y1="1" x2="100" y2="1" stroke="var(--line)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <motion.line x1="0" y1="1" x2="100" y2="1" stroke="var(--green)" strokeWidth="3" vectorEffect="non-scaling-stroke" style={{ pathLength: line }} />
      </svg>
      <ol className="relative grid gap-8 md:grid-cols-4 md:gap-6">
        {STEPS.map((s, i) => {
          const on = reached > i;
          return (
            <li key={s.title} className="flex gap-4 md:flex-col md:items-center md:text-center">
              <motion.span animate={{ scale: on ? 1 : 0.85 }} transition={{ type: "spring", stiffness: 400, damping: 14 }}
                className={`z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full transition-colors ${on ? "bg-green text-white" : "bg-white text-muted border border-line"}`}>
                <s.icon className="h-6 w-6" aria-hidden />
              </motion.span>
              <div>
                <h3 className="h3">{s.title}</h3>
                <p className="mt-1 text-muted">{s.text}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-line">
      <h3>
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex min-h-[56px] w-full items-center justify-between gap-4 py-3 text-left font-heading font-bold text-forest">
          {q}
          <motion.span animate={{ rotate: open ? 180 : 0 }}><ChevronDown className="h-5 w-5" aria-hidden /></motion.span>
        </button>
      </h3>
      <AnimatePresence initial={false}>
        {open && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden"><p className="pb-4 text-muted">{a}</p></motion.div>}
      </AnimatePresence>
    </div>
  );
}

function FieldResults() {
  const m = CONFIG.measured;
  const bars = [
    { label: "Free model, as downloaded", value: m.offTheShelfFieldAccuracy ?? 0, colour: "bg-white/40" },
    { label: "After retraining on field photos", value: m.fieldAccuracy ?? 0, colour: "bg-lime" },
  ];
  const stats = [
    { value: Math.round((m.fieldTop3 ?? 0) * 100), suffix: "%", label: "Right answer in the top 3" },
    { value: m.eceAfterCalibration ?? 0, decimals: 2, label: "Confidence error (0 is perfect)" },
    { value: m.fieldTestPhotos ?? 0, label: "Field photos, never seen in training" },
  ];
  return (
    <section className="hero-mesh section text-white">
      <div className="wrap">
        <Chip tone="lime">Measured on field photos</Chip>
        <h2 className="mt-4 max-w-3xl font-heading text-[28px] font-extrabold leading-tight tracking-tight md:text-[40px]">Lab scores do not survive the field. So we retrained it.</h2>
        <p className="mt-3 max-w-3xl text-white/85">A free plant model reports over 98% on clean lab photos. On real field photos, its top answer was right far less often, and it was still sure of itself. We kept its vision and retrained its last layer on field photos.</p>
        <div className="mt-8 space-y-5">
          {bars.map((b, i) => (
            <div key={b.label}>
              <div className="flex items-baseline justify-between gap-3 font-semibold"><span>{b.label}</span><span className="font-heading text-2xl font-extrabold md:text-3xl"><InViewCount to={b.value * 100} suffix="%" /></span></div>
              <div className="mt-2 h-4 overflow-hidden rounded-full bg-white/10" aria-hidden>
                <motion.div className={`h-full rounded-full ${b.colour}`} initial={{ width: 0 }} whileInView={{ width: `${b.value * 100}%` }} viewport={{ once: true }} transition={{ type: "spring", stiffness: 45, damping: 16, delay: i * 0.25 }} />
              </div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-sm text-white/70">Top answer right. Range for the retrained model: {pct(m.fieldAccuracyLow)} to {pct(m.fieldAccuracyHigh)}.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-card border border-white/15 bg-white/5 p-5">
              <div className="font-heading text-3xl font-extrabold text-lime md:text-4xl"><InViewCount to={s.value} decimals={s.decimals} suffix={s.suffix} /></div>
              <p className="mt-1 text-sm text-white/85">{s.label}</p>
            </div>
          ))}
        </div>
        <p className="mt-6 max-w-3xl text-sm text-white/75">The limits: these are public photos (PlantDoc), not local farms. Tomato alone scored lower, at {pct(m.tomatoFieldAccuracy)}. That is why Patra Lens shows its top 3, says “not sure”, and sends unsure cases to an expert.</p>
      </div>
    </section>
  );
}

const InViewCount = ({ to, decimals, suffix }: { to: number; decimals?: number; suffix?: string }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true });
  return <span ref={ref}>{seen ? <CountUp to={to} decimals={decimals} suffix={suffix} /> : <span className="opacity-0">0</span>}</span>;
};

function MeasuredValues() {
  const m = CONFIG.measured;
  const rows: [string, string | number | null][] = [["Field accuracy", pct(m.fieldAccuracy)], ["Field macro F1", pct(m.fieldMacroF1)], ["Seconds per photo (laptop)", m.secondsPerPhoto]];
  return (
    <dl className="mt-3 space-y-1 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3 border-t border-line pt-1"><dt className="text-muted">{k}</dt><dd className="font-semibold text-forest">{v ?? "To be measured"}</dd></div>
      ))}
    </dl>
  );
}


// Kisan Hub, the farmer's main app, shown first: every module one tap away, plus the way in for labs and scientists.
const HUB_MODULES = [
  { to: "/hub/vani", icon: Mic, title: "Kisan Vani voice AI", text: "Ask in Telugu, Hindi, Tamil, Kannada, Malayalam or English and hear the answer.", tone: "text-[#F472B6]" },
  { to: "/hub/scan", icon: ScanLine, title: "Crop disease scanner", text: "Tomato and paddy. Red circles on infected spots, yellow on dry leaf, with sprays and doses.", tone: "text-[#22D3EE]" },
  { to: "/hub/mandi", icon: TrendingUp, title: "Mandi prices", text: "APMC rates in AP, Telangana and Karnataka, with rising/falling trends and MSP alerts.", tone: "text-[#A3E635]" },
  { to: "/hub/labs", icon: Building2, title: "Labs & RBK connect", text: "Call or WhatsApp ICAR institutes, KVKs, RBKs and officers, or send a scan for review.", tone: "text-[#FBBF24]" },
  { to: "/hub/weather", icon: CloudSun, title: "Weather & spray planner", text: "7-day forecast, rain and disease-weather alerts, and the safe hours to spray.", tone: "text-[#2DD4BF]" },
  { to: "/hub/schemes", icon: Gift, title: "Schemes & insurance", text: "Check PM-KISAN, PMFBY, KCC and state schemes in six quick questions.", tone: "text-[#F472B6]" },
  { to: "/hub/npk", icon: Calculator, title: "NPK calculator", text: "Bags of DAP, urea and potash for your acres and soil, with timing and cost.", tone: "text-[#A3E635]" },
  { to: "/watch", icon: Sprout, title: "Leaf Watch", text: "Photograph the same leaves every few days and see new spots ringed early.", tone: "text-[#22D3EE]" },
];

function KisanHubSection() {
  return (
    <section className="section">
      <div className="wrap">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow mb-2">Kisan Hub</p>
            <h2 className="h2 max-w-3xl">Everything a farmer needs, in one app</h2>
            <p className="mt-3 max-w-2xl text-muted">Sign in with your mobile number. Your scans, prices and advice stay on your phone and in your language.</p>
          </div>
          <Button to="/hub" variant="lime"><Zap className="h-5 w-5" aria-hidden />Open Kisan Hub</Button>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {HUB_MODULES.map((m, i) => (
            <Reveal key={m.to} delay={i}>
              <Link to={m.to} className="lift-card flex h-full flex-col rounded-card border border-line bg-white p-5">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface"><m.icon className={`h-6 w-6 ${m.tone}`} aria-hidden /></span>
                <h3 className="h3 mt-4">{m.title}</h3>
                <p className="small mt-1 flex-1">{m.text}</p>
                <span className="mt-4 text-sm font-bold text-green-dark">Open →</span>
              </Link>
            </Reveal>
          ))}
        </div>
        <Reveal>
          <div className="hero-mesh mt-8 flex flex-col gap-5 overflow-hidden rounded-3xl p-6 text-white md:flex-row md:items-center md:justify-between md:p-8">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10"><FlaskConical className="h-6 w-6 text-[#F472B6]" aria-hidden /></span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#F472B6]">For labs & scientists</p>
                <h3 className="mt-1 font-heading text-2xl font-extrabold">Review farmers' cases from your lab</h3>
                <p className="mt-1 max-w-xl text-white/80">Pathology labs, ICAR and KVK scientists and agriculture officers sign in with their email and phone. After approval, see every scan with its photo and answer lab requests.</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button to="/hub/expert-login" variant="lime">Lab / scientist login</Button>
              <Button to="/admin" variant="outline-light">Expert console</Button>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export default function Home() {
  const online = useOnline();
  const { setSheetOpen } = useI18n();
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const phoneY = useTransform(scrollY, [0, 700], [0, reduce ? 0 : -70]);
  // Offline: the front page shows only the mode choice and the way to the scanner.
  if (!online) return <ModeSwitch />;
  return (
    <>
      <ModeSwitch />
      <section className="hero-mesh text-white lg:min-h-[calc(100vh-4rem)]">
        <div aria-hidden className="hero-dots pointer-events-none absolute inset-0 -z-[1]" />
        <div className="wrap grid min-h-[640px] items-center gap-10 pb-24 pt-12 md:pb-28 lg:min-h-[calc(100vh-4rem)] lg:grid-cols-[1.2fr_1fr]">
          <div>
            <Chip tone="lime">Free · Voice AI in 6 languages · Tomato & paddy</Chip>
            <h1 className="display mt-5" aria-label="Catch the first spot.">
              {["Catch", "the"].map((w, i) => <HeroWord key={w} delay={i * 0.12}>{w}</HeroWord>)}
              <HeroWord delay={0.24} className="text-glow">first</HeroWord>
              <HeroWord delay={0.36} className="text-glow">spot.</HeroWord>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-white/90 md:text-xl">Patra Lens is every farmer's AI crop doctor. Photograph a leaf to find disease early, ask Kisan Vani in Telugu or Hindi, check today's mandi price, and send the case to a lab or RBK, all from one phone.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button to="/hub" variant="lime">Open Kisan Hub</Button>
              <Button to="/hub/scan" variant="outline-light">Scan a leaf</Button>
            </div>
            <p className="mt-6 text-sm text-white/75">Runs on your phone · No app to install · Free to use · <a href="/hub/expert-login" className="underline">Lab / scientist login</a></p>
          </div>
          <div className="relative text-center">
            <motion.div style={{ y: phoneY }}>
              <HeroLeaf />
              </motion.div>
            <motion.div initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7, type: "spring", stiffness: 90, damping: 16 }} className="absolute left-0 top-[18%] hidden xl:block">
              <div className="glass float-soft px-4 py-3 text-left"><div className="font-heading text-xl font-extrabold text-lime">{pct(CONFIG.measured.fieldTop3)}</div><div className="text-xs text-white/85">Right answer in top 3</div></div>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.95, type: "spring", stiffness: 90, damping: 16 }} className="absolute bottom-[20%] right-0 hidden xl:block">
              <div className="glass float-soft px-4 py-3 text-left" style={{ animationDelay: "2s" }}><div className="font-heading text-sm font-bold">AI on the device</div><div className="text-xs text-white/85">Works with no internet</div></div>
            </motion.div>
          </div>
        </div>
      </section>

      <StatsBand />
      <KisanHubSection />
      <PlantStrip />

      <Section tint>
        <p className="eyebrow mb-2">Try it now</p>
        <h2 className="h2">See a real answer in seconds</h2>
        <p className="mt-3 max-w-2xl text-muted">Pick an example leaf. The same AI that runs in the app looks at it on your device, with nothing uploaded.</p>
        <div className="mt-8"><LiveDemo /></div>
      </Section>

      <Section>
        <p className="eyebrow mb-2">The problem</p>
        <h2 className="h2 max-w-3xl">By the time a disease is easy to see, it has often spread.</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {PROBLEMS.map((p, i) => (
            <Reveal key={p.title} delay={i}><Card className="h-full"><IconBox><p.icon className="h-6 w-6" aria-hidden /></IconBox><h3 className="h3">{p.title}</h3><p className="mt-1 text-muted">{p.text}</p></Card></Reveal>
          ))}
        </div>
        <Reveal className="mx-auto mt-10 max-w-3xl">
          <CompareSlider a="/samples/early-blight-lab.jpg" b="/samples/early-blight-field.jpg" labelA="Lab photo · PlantVillage" labelB="Field photo · PlantDoc" altA="Early blight on a single leaf on a plain lab background" altB="Early blight on a leaf photographed in a field" />
          <p className="small mt-2 text-center">Same disease, very different photos.</p>
        </Reveal>
      </Section>

      <Section tint>
        <p className="eyebrow mb-2">The idea</p>
        <h2 className="h2">A follow-up visit for every plant</h2>
        <p className="mt-4 max-w-3xl text-muted">Like a doctor comparing today's scan with last week's, Patra Lens compares each sentinel leaf with its last photo. New spots, holes and feeding marks stand out, even when they are too small or faint for a one-photo diagnosis.</p>
        <div className="mt-8"><IdeaPanels /></div>
        <div className="mt-4 flex flex-col justify-between gap-2 text-sm font-semibold sm:flex-row">
          <span className="text-tomato-dark">Patra Lens: alert at the first new spot</span>
          <span className="text-muted">One-photo apps: when symptoms are clear</span>
        </div>
      </Section>

      <Section>
        <p className="eyebrow mb-2">The process</p>
        <h2 className="h2">How it works</h2>
        <HowItWorks />
      </Section>

      <Section tint>
        <p className="eyebrow mb-2">The product</p>
        <h2 className="h2">Everything from first spot to early warning</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i % 3}>
              <Link to={f.to} className="lift-card block h-full rounded-card border border-line bg-white p-5 shadow-soft">
                <IconBox><f.icon className="h-6 w-6" aria-hidden /></IconBox>
                <h3 className="h3">{f.title}</h3><p className="mt-1 text-base text-muted">{f.text}</p>
              </Link>
            </Reveal>
          ))}
          <Reveal delay={3}>
            <button onClick={() => setSheetOpen(true)} className="lift-card block h-full w-full rounded-card border border-line bg-white p-5 text-left shadow-soft">
              <IconBox><Languages className="h-6 w-6" aria-hidden /></IconBox>
              <h3 className="h3">Your language</h3><p className="mt-1 text-base text-muted">English, Telugu and Kannada.</p>
            </button>
          </Reveal>
        </div>
      </Section>

      <Section>
        <p className="eyebrow mb-2">The difference</p>
        <h2 className="h2 mb-8">More than a one-photo answer</h2>
        <div className="overflow-x-auto rounded-card border border-line">
          <table className="w-full min-w-[320px] text-left text-sm md:text-base">
            <thead className="bg-deep lit text-white">
              <tr><th className="p-3 md:p-4"><span className="sr-only">Compared item</span></th><th scope="col" className="p-3 font-heading md:p-4">Basic photo-ID app</th><th scope="col" className="p-3 font-heading text-lime md:p-4">Patra Lens</th></tr>
            </thead>
            <tbody>
              {COMPARE.map(([k, a, b]) => (
                <tr key={k} className="border-t border-line">
                  <th scope="row" className="p-3 font-semibold text-forest md:p-4">{k}</th>
                  <td className="p-3 text-muted md:p-4">{a}</td>
                  <td className="bg-green-tint/60 p-3 font-semibold text-forest md:p-4">{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <FieldResults />

      <Section tint>
        <p className="eyebrow mb-2">Our promise</p>
        <h2 className="h2">Honest by design</h2>
        <div className="mt-8 grid items-stretch gap-6 lg:grid-cols-[1fr_1.4fr]">
          <Viewfinder className="min-h-[240px] overflow-hidden rounded-card">
            <img src="/samples/field-row.jpg" alt="A row of tomato plants in a field" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          </Viewfinder>
          <div className="grid gap-4 sm:grid-cols-2">
            {HONEST.map((h, i) => (
              <Reveal key={h.title} delay={i}>
                <Card className="h-full !bg-white"><h3 className="h3">{h.title}</h3><p className="mt-1 text-base text-muted">{h.text}</p>{h.title === "Measured, not claimed" && <MeasuredValues />}</Card>
              </Reveal>
            ))}
          </div>
        </div>
      </Section>

      <Section>
        <p className="eyebrow mb-2">The technology</p>
        <h2 className="h2">Under the hood</h2>
        <div className="mt-6 flex flex-wrap gap-2">{STACK.map((s) => <Chip key={s} tone="forest">{s}</Chip>)}</div>
        <p className="mt-4 text-muted">Photo checks, spot comparison and the AI model run on the phone, in the browser.</p>
      </Section>

      <Section tint>
        <p className="eyebrow mb-2">What's next</p>
        <h2 className="h2">Roadmap</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {ROADMAP.map((r, i) => (
            <Reveal key={r.title} delay={i}>
              <Card className="h-full !bg-white"><h3 className="h3">{r.title}</h3><ul className="mt-2 space-y-1 text-muted">{r.items.map((it) => <li key={it} className="flex gap-2"><span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-lime" aria-hidden />{it}</li>)}</ul></Card>
            </Reveal>
          ))}
        </div>
      </Section>

      <Section>
        <div className="grid gap-8 lg:grid-cols-[1fr_2fr]">
          <div><p className="eyebrow">Questions</p><h2 className="h2 mt-2">Answers, plainly</h2></div>
          <div>{FAQ.map(([q, a]) => <FaqItem key={q} q={q} a={a} />)}</div>
        </div>
      </Section>

      <section className="wrap pb-16 md:pb-24">
        <Reveal>
          <div className="hero-mesh overflow-hidden rounded-3xl px-6 py-12 text-center text-white md:px-12 md:py-16">
            <h2 className="font-heading text-[28px] font-extrabold leading-tight tracking-tight md:text-[40px]">See it on a real leaf.</h2>
            <p className="mx-auto mt-3 max-w-xl text-white/85">Scan a photo now. There is nothing to install and no account to create.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Button to="/hub" variant="lime">Open Kisan Hub</Button>
              <Button to="/hub/scan" variant="outline-light">Scan a leaf</Button>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}
