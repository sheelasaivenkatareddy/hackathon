// The human side of a result: a plain sentence, read aloud, share, feedback, measured accuracy data and live conditions.
import { motion } from "framer-motion";
import { CloudRain, Droplets, Gauge as GaugeIcon, MapPin, Share2, Sprout, Thermometer, ThumbsDown, ThumbsUp, Timer, Volume2, VolumeX, Wind } from "lucide-react";
import { ReactNode, useEffect, useState } from "react";
import { LiveWeather, SoilData, getArea, loadLiveWeather, loadPlace, loadSoil } from "../lib/conditions";
import { FieldReport, getFieldReport } from "../lib/diagnose";
import { downloadBlob } from "../lib/ics";
import { useI18n } from "../lib/i18n";
import { AnswerLevel, Guess, Mode, confidenceWord } from "../lib/model";
import type { CoachResult } from "../lib/vision/coach";
import { Button, Card, CountUp, ProgressRing, Skeleton, useToast } from "./ui";

export function humanSummary(top: Guess | undefined, second: Guess | undefined, level: AnswerLevel, name: (s: string) => string): string {
  if (!top) return "I can't name the problem on this device right now, but the photo checks below still help.";
  if (level === "EXPERT") return `I'm not sure about this one. My best guess is ${name(top.name)}, so please ask an expert before you act.`;
  if (level === "CHECK" && second) return `This could be ${name(top.name)} or ${name(second.name)}. They look alike, so please check for both.`;
  const sure = confidenceWord(top.p) === "high" ? "quite sure" : "fairly sure";
  if (top.name.endsWith("Healthy")) return `Good news: I'm ${sure} this leaf is healthy. Keep checking it every few days.`;
  return `This looks like ${name(top.name)}. I'm ${sure}, but please look at the leaf yourself too.`;
}

export function SummaryBar({ text, report, feedback, onFeedback }: { text: string; report: string; feedback?: "right" | "wrong"; onFeedback?: (f: "right" | "wrong") => void }) {
  const toast = useToast();
  const [speaking, setSpeaking] = useState(false);
  const canSpeak = "speechSynthesis" in window;
  useEffect(() => () => { if (canSpeak) window.speechSynthesis.cancel(); }, [canSpeak]);

  const speak = () => {
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-IN"; u.rate = 0.95;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  };
  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "Patra Chain scan report", text: report }); return; } catch (e) { if ((e as Error).name === "AbortError") return; }
    }
    downloadBlob(new Blob([report], { type: "text/plain" }), "patra-lens-report.txt");
    toast("Report saved. Show it to your KVK or agriculture officer.");
  };
  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-card bg-deep lit p-4 text-white md:p-6" data-testid="human-summary">
      <p className="font-heading text-lg font-bold leading-snug md:text-2xl">{text}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {canSpeak && <Button variant="outline-light" onClick={speak} className="!text-sm">{speaking ? <VolumeX className="h-4 w-4" aria-hidden /> : <Volume2 className="h-4 w-4" aria-hidden />}{speaking ? "Stop" : "Read aloud"}</Button>}
        <Button variant="outline-light" onClick={share} className="!text-sm"><Share2 className="h-4 w-4" aria-hidden />Share report</Button>
        {onFeedback && (
          <div className="ml-auto flex items-center gap-2" data-testid="feedback">
            <span className="text-sm text-white/85">{feedback ? "Thanks for telling me." : "Was I right?"}</span>
            <motion.button whileTap={{ scale: 0.85 }} aria-label="Yes, this was right" aria-pressed={feedback === "right"} onClick={() => onFeedback("right")} className={`flex h-11 w-11 items-center justify-center rounded-full border border-white/40 ${feedback === "right" ? "bg-lime text-forest" : "hover:bg-white/10"}`}><ThumbsUp className="h-5 w-5" aria-hidden /></motion.button>
            <motion.button whileTap={{ scale: 0.85 }} aria-label="No, this was wrong" aria-pressed={feedback === "wrong"} onClick={() => onFeedback("wrong")} className={`flex h-11 w-11 items-center justify-center rounded-full border border-white/40 ${feedback === "wrong" ? "bg-tomato text-white" : "hover:bg-white/10"}`}><ThumbsDown className="h-5 w-5" aria-hidden /></motion.button>
          </div>
        )}
      </div>
    </motion.section>
  );
}

const StatBar = ({ label, right, total }: { label: string; right: number; total: number }) => {
  const pct = total ? (right / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm"><span>{label}</span><strong className="whitespace-nowrap text-forest">{right} of {total}</strong></div>
      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-surface" aria-hidden>
        <motion.div className="h-full rounded-full bg-green" initial={{ width: 0 }} whileInView={{ width: `${pct}%` }} viewport={{ once: true }} transition={{ type: "spring", stiffness: 60, damping: 16 }} />
      </div>
    </div>
  );
};

const LEVEL_WORDS: Record<string, string> = { CLEAR: "one answer stands out", CHECK: "two answers are close", EXPERT: "I'm not sure" };

export function ScanReport({ top, level, mode, coach, affectedPct, seconds }: { top?: Guess; level: AnswerLevel; mode: Mode; coach: CoachResult; affectedPct?: number; seconds?: number }) {
  const { disease } = useI18n();
  const [report, setReport] = useState<FieldReport | null>(null);
  useEffect(() => { getFieldReport().then(setReport); }, []);
  const lv = report?.levels[level];
  const cond = top ? report?.conditions[top.name] : undefined;
  const measured = mode === "on-device" && !!report;
  return (
    <Card className="!bg-white">
      <div data-testid="scan-report">
        <h3 className="h3 flex items-center gap-2"><GaugeIcon className="h-5 w-5 text-green" aria-hidden />Your scan report</h3>
        <div className="mt-4 grid gap-6 md:grid-cols-2">
          <div>
            <h4 className="text-sm font-semibold text-forest">This photo</h4>
            <div className="mt-2 flex items-center gap-4">
              {top ? <ProgressRing value={top.p * 100} size={84} stroke={8}><span className="text-base"><CountUp to={top.p * 100} suffix="%" /></span></ProgressRing> : <ProgressRing value={0} size={84} stroke={8}>–</ProgressRing>}
              <p className="text-sm">{top ? <>AI confidence in <strong className="text-forest">{disease(top.name)}</strong>. Confidence is the AI's own estimate. The test results beside this show how it really did.</> : "No AI answer for this photo."}</p>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <div className="flex justify-between gap-2"><dt className="text-muted">Sharpness</dt><dd className="font-semibold text-forest">{Math.round(coach.sharpness.value)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted">Light</dt><dd className="font-semibold text-forest">{Math.round(coach.light.value)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted">Leaf in frame</dt><dd className="font-semibold text-forest">{Math.round(coach.leafInFrame.value)}%</dd></div>
              {affectedPct !== undefined && <div className="flex justify-between gap-2"><dt className="text-muted">Discoloured area</dt><dd className="font-semibold text-forest">{affectedPct.toFixed(1)}%</dd></div>}
              {seconds !== undefined && <div className="flex justify-between gap-2"><dt className="flex items-center gap-1 text-muted"><Timer className="h-3.5 w-3.5" aria-hidden />Time taken</dt><dd className="font-semibold text-forest">{seconds.toFixed(1)} s</dd></div>}
            </dl>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-forest">How accurate is this?</h4>
            {!measured && <p className="small mt-2">There are no accuracy figures for this result, because the AI model did not run on it.</p>}
            {measured && (
              <div className="mt-2 space-y-3" data-testid="accuracy-data">
                {lv && LEVEL_WORDS[level] && <StatBar label={`Right when I say "${LEVEL_WORDS[level]}"`} right={lv.top1} total={lv.photos} />}
                {lv && LEVEL_WORDS[level] && <StatBar label="Right answer was in my top 3" right={lv.top3} total={lv.photos} />}
                {cond && top && <StatBar label={`For ${disease(top.name)} photos`} right={cond.right} total={cond.photos} />}
                <p className="small">Measured on {report!.testPhotos} public field photos the AI had not seen. The numbers for one disease come from only a few photos, so treat them as a rough guide. These are not local farm photos.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

const Tile = ({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) => (
  <motion.div whileHover={{ y: -3 }} className="rounded-xl bg-surface p-3">
    <div className="flex items-center gap-1.5 text-xs font-semibold text-muted">{icon}{label}</div>
    <div className="mt-1 font-heading text-xl font-extrabold text-forest">{value}</div>
  </motion.div>
);

export function LiveConditions() {
  const [place, setPlace] = useState<string | null>(null);
  const [isDefault, setIsDefault] = useState(false);
  const [weather, setWeather] = useState<LiveWeather | null | "failed">(null);
  const [soil, setSoil] = useState<SoilData | null | "failed" | "idle">("idle");
  const [where, setWhere] = useState<{ lat: number; lon: number } | null>(null);
  useEffect(() => {
    let live = true;
    getArea().then(({ lat, lon, isDefault: d }) => {
      if (!live) return;
      setIsDefault(d);
      setWhere({ lat, lon });
      loadPlace(lat, lon).then((p) => { if (live) setPlace(p); }).catch(() => undefined);
      loadLiveWeather(lat, lon).then((w) => { if (live) setWeather(w); }).catch(() => { if (live) setWeather("failed"); });
    });
    return () => { live = false; };
  }, []);
  const loadSoilNow = () => {
    if (!where) return;
    setSoil(null);
    loadSoil(where.lat, where.lon).then(setSoil).catch(() => setSoil("failed"));
  };
  const hasSoil = soil && soil !== "failed" && soil !== "idle" && (soil.ph !== null || soil.nitrogenGKg !== null || soil.carbonGKg !== null);
  return (
    <Card className="!bg-white">
      <div data-testid="live-conditions">
        <h3 className="h3">Conditions right now</h3>
        <p className="small mt-1 flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden />{place ?? "Your area"}{isDefault && " (default). Turn on area sharing in Radar for your own area."}</p>
        {weather === null && <Skeleton className="mt-3 h-20" />}
        {weather === "failed" && <p className="small mt-3" data-testid="weather-failed">Live weather can't load right now. Check your internet. Everything else still works.</p>}
        {weather && weather !== "failed" && (
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile icon={<Thermometer className="h-3.5 w-3.5" aria-hidden />} label="Temperature" value={<><CountUp to={weather.tempC} decimals={1} /> °C</>} />
            <Tile icon={<Droplets className="h-3.5 w-3.5" aria-hidden />} label="Humidity" value={<><CountUp to={weather.humidity} /> %</>} />
            <Tile icon={<CloudRain className="h-3.5 w-3.5" aria-hidden />} label="Rain now" value={<><CountUp to={weather.rainMm} decimals={1} /> mm</>} />
            <Tile icon={<Wind className="h-3.5 w-3.5" aria-hidden />} label="Wind" value={<><CountUp to={weather.windKmh} decimals={0} /> km/h</>} />
          </div>
        )}
        {weather && weather !== "failed" && weather.humidity >= 90 && <p className="mt-2 rounded-xl bg-amber-tint px-3 py-2 text-sm font-semibold text-amber-dark">It's very humid right now. Wet leaves help many leaf diseases spread.</p>}
        <h4 className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-forest"><Sprout className="h-4 w-4 text-green" aria-hidden />Soil in your area</h4>
        <div data-testid="soil-data">
          {soil === null && <Skeleton className="mt-2 h-16" />}
          {(soil === "idle" || soil === "failed") && <Button variant="secondary" onClick={loadSoilNow} className="mt-2 !text-sm" data-testid="load-soil">{soil === "failed" ? "Try soil nutrients again" : "Show soil nutrients (pH, nitrogen, carbon)"}</Button>}
          {soil === "failed" && !(weather && weather !== "failed" && weather.soilMoisture !== null) && <p className="small mt-1" data-testid="soil-failed">Soil data can't load right now. That service is sometimes down. A soil test is better anyway.</p>}
          {soil !== null && (
            <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
              {weather && weather !== "failed" && weather.soilMoisture !== null && <Tile icon={<Droplets className="h-3.5 w-3.5" aria-hidden />} label="Topsoil moisture" value={<>{Math.round(weather.soilMoisture * 100)} %</>} />}
              {weather && weather !== "failed" && weather.soilTempC !== null && <Tile icon={<Thermometer className="h-3.5 w-3.5" aria-hidden />} label="Soil temperature" value={<>{weather.soilTempC} °C</>} />}
              {hasSoil && (soil as SoilData).ph !== null && <Tile icon={<Sprout className="h-3.5 w-3.5" aria-hidden />} label="Soil pH" value={(soil as SoilData).ph} />}
              {hasSoil && (soil as SoilData).nitrogenGKg !== null && <Tile icon={<Sprout className="h-3.5 w-3.5" aria-hidden />} label="Nitrogen" value={<>{(soil as SoilData).nitrogenGKg} g/kg</>} />}
              {hasSoil && (soil as SoilData).carbonGKg !== null && <Tile icon={<Sprout className="h-3.5 w-3.5" aria-hidden />} label="Organic carbon" value={<>{(soil as SoilData).carbonGKg} g/kg</>} />}
            </div>
          )}
          {soil === "failed" && weather && weather !== "failed" && weather.soilMoisture !== null && <p className="small mt-2" data-testid="soil-failed">Soil nutrient data can't load right now. That service is sometimes down.</p>}
        </div>
        <p className="tiny mt-3">These are estimates for your wider area, not measurements of your field. Use a soil test for decisions. Data: Open-Meteo (CC BY 4.0){hasSoil ? ", SoilGrids (CC BY 4.0)" : ""}, BigDataCloud. Only your approximate area is sent.</p>
      </div>
    </Card>
  );
}
