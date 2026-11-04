// Shared capture + Photo Coach flow, used by Scan, Add visit and field setup.
import { motion, useReducedMotion } from "framer-motion";
import { Camera, Check, Eye, EyeOff, ImagePlus, Loader2, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "../lib/i18n";
import { loadWorkImage, shrinkForStorage } from "../lib/vision/browser";
import { CoachResult, photoCoach } from "../lib/vision/coach";
import type { RGBAImage } from "../lib/vision/types";
import { AnswerBadge, Button, Chip, ProgressRing, SampleChip } from "./ui";
import { Viewfinder } from "./viz";

export const SAMPLES: { file: string; alt: string }[] = [
  { file: "early-blight-closeup.jpg", alt: "Early blight, close-up" },
  { file: "early-blight-field.jpg", alt: "Early blight, in the field" },
  { file: "septoria-closeup.jpg", alt: "Septoria leaf spot, close-up" },
  { file: "septoria-field.jpg", alt: "Septoria leaf spot, in the field" },
  { file: "late-blight-field.jpg", alt: "Late blight, in the field" },
  { file: "healthy-leaf.jpg", alt: "Healthy tomato leaf" },
  { file: "early-blight-lab.jpg", alt: "Early blight, lab photo" },
  { file: "blurry-photo.jpg", alt: "A blurry leaf photo" },
  { file: "dark-photo.jpg", alt: "A dark leaf photo" },
];

// ------------------------------------------------------------------ Camera
export function CameraCapture({ hint, ghostUrl, onPhoto, showSamples = false }: { hint: string; ghostUrl?: string; onPhoto: (blob: Blob, sampleFile?: string) => void; showSamples?: boolean }) {
  const { t } = useI18n();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [live, setLive] = useState(false);
  const [error, setError] = useState("");
  const [ghost, setGhost] = useState(true);
  const [dragging, setDragging] = useState(false);

  const stop = useCallback(() => { stream.current?.getTracks().forEach((tr) => tr.stop()); stream.current = null; setLive(false); }, []);
  useEffect(() => stop, [stop]);

  const start = async () => {
    setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("no camera");
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      stream.current = s; setLive(true);
      requestAnimationFrame(() => { if (video.current) { video.current.srcObject = s; video.current.play().catch(() => undefined); } });
    } catch {
      setError("The live camera is not available here. Use “Take a photo” or upload one from your gallery.");
    }
  };
  const snap = () => {
    const v = video.current;
    if (!v?.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    c.toBlob((b) => { if (b) { stop(); onPhoto(b); } }, "image/jpeg", 0.92);
  };
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) { stop(); onPhoto(f); }
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const f = [...e.dataTransfer.files].find((x) => x.type.startsWith("image/"));
    if (f) { setError(""); stop(); onPhoto(f); } else setError("Please drop a photo (JPG or PNG).");
  };
  const useSample = async (file: string) => {
    stop();
    const r = await fetch(`/samples/${file}`);
    if (!r.ok) { setError("This sample photo is missing."); return; }
    onPhoto(await r.blob(), file);
  };

  return (
    <div onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop} data-testid="dropzone">
      <Viewfinder className="overflow-hidden rounded-card bg-deep lit">
        <div className="relative aspect-[4/3] w-full">
          {live && <video ref={video} playsInline muted className="absolute inset-0 h-full w-full object-cover" aria-label="Live camera view" />}
          {ghostUrl && ghost && <img src={ghostUrl} alt="Your last photo of this leaf, shown faintly" className="absolute inset-0 h-full w-full object-cover" style={{ opacity: 0.35 }} />}
          <div className="absolute inset-x-0 bottom-3 flex justify-center px-4 text-center">
            <span className="rounded-full bg-deep/80 lit px-3 py-1 text-sm font-semibold text-white">{hint}</span>
          </div>
          {!live && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <Button variant="lime" onClick={start}><Camera className="h-5 w-5" aria-hidden />Open camera</Button>
              <p className="hidden text-sm text-white/80 md:block">or drag a photo here</p>
            </div>
          )}
          {dragging && <div className="absolute inset-0 z-10 flex items-center justify-center bg-deep/85 lit font-heading text-xl font-bold text-lime" aria-hidden>Drop your photo here</div>}
        </div>
      </Viewfinder>
      {error && <p role="alert" className="mt-2 text-sm font-semibold text-tomato-dark">{error}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {live && <Button onClick={snap}><Camera className="h-5 w-5" aria-hidden />{t("scan.takePhoto")}</Button>}
        <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border border-line bg-white px-5 py-2 font-semibold text-forest focus-within:outline focus-within:outline-2 focus-within:outline-lime hover:bg-surface">
          <Camera className="h-5 w-5" aria-hidden />Take a photo
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={onFile} />
        </label>
        <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border border-line bg-white px-5 py-2 font-semibold text-forest focus-within:outline focus-within:outline-2 focus-within:outline-lime hover:bg-surface">
          <ImagePlus className="h-5 w-5" aria-hidden />Upload from gallery
          <input type="file" accept="image/*" className="sr-only" onChange={onFile} data-testid="gallery-input" />
        </label>
        {ghostUrl && (
          <Button variant="ghost" onClick={() => setGhost((g) => !g)} aria-label={ghost ? "Hide the last photo" : "Show the last photo"}>
            {ghost ? <EyeOff className="h-5 w-5" aria-hidden /> : <Eye className="h-5 w-5" aria-hidden />}Ghost {ghost ? "on" : "off"}
          </Button>
        )}
      </div>
      {showSamples && (
        <div className="mt-6">
          <div className="mb-2 flex items-center gap-2"><h2 className="h3">Try a sample</h2><SampleChip /></div>
          <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
            {SAMPLES.map((s) => (
              <li key={s.file} className="shrink-0">
                <button onClick={() => useSample(s.file)} data-sample={s.file} className="block w-24 overflow-hidden rounded-xl border border-line bg-white text-left hover:border-green">
                  <img src={`/samples/${s.file}`} alt={s.alt} loading="lazy" className="h-20 w-24 object-cover" />
                  <span className="block px-2 py-1 text-xs leading-tight text-ink">{s.alt}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Photo Coach checklist
function coachRows(c: CoachResult, t: (k: string) => string) {
  return [
    { key: "sharp", label: "Sharpness", value: `${Math.round(c.sharpness.value)}`, pass: c.sharpness.pass, fail: t("coach.sharp.fail") },
    { key: "light", label: "Light", value: `${Math.round(c.light.value)}`, pass: c.light.pass, fail: c.light.problem === "bright" ? t("coach.light.bright") : t("coach.light.dark") },
    { key: "leaf", label: "Leaf in frame", value: `${Math.round(c.leafInFrame.value)}%`, pass: c.leafInFrame.pass, fail: t("coach.leaf.fail") },
  ];
}

export function CoachChecklist({ coach, onDone }: { coach: CoachResult; onDone?: () => void }) {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const rows = coachRows(coach, t);
  const [done, setDone] = useState(reduce ? rows.length : 0);
  useEffect(() => {
    if (reduce) { onDone?.(); return; }
    const ts = rows.map((_, i) => setTimeout(() => setDone(i + 1), 300 * (i + 1)));
    ts.push(setTimeout(() => onDone?.(), 300 * rows.length + 150));
    return () => ts.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coach]);
  return (
    <div className="flex items-start gap-4">
      <ProgressRing value={(done / rows.length) * 100} color={done === rows.length && !coach.pass ? "var(--tomato)" : "var(--green)"} />
      <ul className="flex-1 space-y-2" aria-live="polite" aria-label={t("coach.checking")}>
        {rows.map((r, i) => {
          const finished = i < done;
          return (
            <motion.li key={r.key} className="flex items-start gap-2" animate={finished && !r.pass ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }} transition={{ duration: 0.35 }}>
              <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${!finished ? "bg-surface" : r.pass ? "bg-green text-white" : "bg-tomato text-white"}`}>
                {!finished ? <Loader2 className="h-4 w-4 animate-spin text-muted" aria-hidden /> : r.pass ? <Check className="h-4 w-4" aria-hidden /> : <X className="h-4 w-4" aria-hidden />}
              </span>
              {finished
                ? <span data-coach={r.key}><strong className="font-semibold text-forest">{r.label} {r.value}</strong> · {r.pass ? "Good" : <span className="text-tomato-dark">{r.fail}</span>}</span>
                : <span className="text-muted">{r.label}…</span>}
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------------ The whole step
export interface AcceptedPhoto { photo: Blob; work: RGBAImage; coach: CoachResult; usedAnyway: boolean; sampleFile?: string; url: string }

/**
 * Take a photo, run the Photo Coach, and hand back the photo once it passes or the user chooses "Use anyway".
 * `extra` shows a chip when a sample is used.
 */
export function PhotoFlow({ hint, ghostUrl, showSamples, acceptNonLeaf, onAccepted, onStart }: { hint: string; ghostUrl?: string; showSamples?: boolean; acceptNonLeaf?: boolean; onAccepted: (p: AcceptedPhoto) => void; onStart?: () => void }) {
  const { t } = useI18n();
  const [checked, setChecked] = useState<AcceptedPhoto | null>(null);
  const [animDone, setAnimDone] = useState(false);
  const [error, setError] = useState("");

  const onPhoto = async (blob: Blob, sampleFile?: string) => {
    setError(""); setAnimDone(false); onStart?.();
    try {
      // Measure the original: a re-encoded JPEG reads 20-50% sharper, which would let blurry photos pass.
      const work = await loadWorkImage(blob);
      const coach = photoCoach(work);
      const photo = await shrinkForStorage(blob);
      setChecked({ photo, work, coach, usedAnyway: false, sampleFile, url: URL.createObjectURL(photo) });
    } catch (e) {
      console.warn(e);
      setError("We could not read this photo. Please try another one.");
    }
  };

  // A passing photo moves on by itself, after a pause long enough to read the measured values.
  // With acceptNonLeaf, a sharp, well-lit photo with little leaf in it (a flower, a fruit, no plant) also moves on,
  // so the scan can say what it is instead of asking for a retake.
  useEffect(() => {
    if (!checked || !animDone) return;
    const c = checked.coach, onlyLeafFailed = acceptNonLeaf && c.sharpness.pass && c.light.pass && !c.leafInFrame.pass;
    if (!c.pass && !onlyLeafFailed) return;
    const timer = setTimeout(() => onAccepted(onlyLeafFailed ? { ...checked, usedAnyway: true } : checked), 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked, animDone]);

  if (!checked) return <>
    {error && <p role="alert" className="mb-3 font-semibold text-tomato-dark">{error}</p>}
    <CameraCapture hint={hint} ghostUrl={ghostUrl} onPhoto={onPhoto} showSamples={showSamples} />
  </>;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Viewfinder className="self-start overflow-hidden rounded-card bg-deep lit">
        <img src={checked.url} alt="The photo you just took" className="block aspect-[4/3] w-full object-cover" />
      </Viewfinder>
      <div className="space-y-4">
        <h2 className="h3">{t("coach.checking")}</h2>
        <CoachChecklist coach={checked.coach} onDone={() => setAnimDone(true)} />
        {checked.sampleFile && <SampleChip />}
        {animDone && !checked.coach.pass && !(acceptNonLeaf && checked.coach.sharpness.pass && checked.coach.light.pass) && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <AnswerBadge level="RETAKE" />
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setChecked(null)}><RotateCcw className="h-4 w-4" aria-hidden />{t("scan.retake")}</Button>
              <Button variant="secondary" onClick={() => onAccepted({ ...checked, usedAnyway: true })}>{t("scan.useAnyway")}</Button>
            </div>
            <Chip tone="amber">“Use anyway” marks this photo as low reliability</Chip>
          </motion.div>
        )}
      </div>
    </div>
  );
}
