// Set up a field: 3 steps. Only the rounded area cell is ever stored, never the coordinates.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AcceptedPhoto, PhotoFlow } from "../components/PhotoFlow";
import { Button, Stepper, Toggle, useToast } from "../components/ui";
import { WPattern } from "../components/viz";
import { Plant } from "../lib/db";
import { PLANTS } from "../lib/diagnose";
import { cellId } from "../lib/radar";
import type { CropStage } from "../lib/risk";
import { createField, saveVisit } from "../lib/watch";

const STEPS = ["Your field", "Choose sentinel plants", "First photos"];
const STAGES: { id: CropStage; label: string }[] = [
  { id: "seedling", label: "Seedling" }, { id: "vegetative", label: "Vegetative" }, { id: "flowering", label: "Flowering" }, { id: "fruiting", label: "Fruiting" },
];

export default function WatchNew() {
  const nav = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [crop, setCrop] = useState("Tomato");
  const [stage, setStage] = useState<CropStage>("vegetative");
  const [share, setShare] = useState(false);
  const [cell, setCell] = useState<string>();
  const [count, setCount] = useState(5);
  const [names, setNames] = useState<string[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [idx, setIdx] = useState(0);
  const [saving, setSaving] = useState(false);

  const plantName = (i: number) => names[i] ?? `Plant ${i + 1}`;

  const onShare = (on: boolean) => {
    setShare(on);
    if (!on) { setCell(undefined); return; }
    if (!navigator.geolocation) { setShare(false); toast("Location is not available on this device."); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => setCell(cellId(p.coords.latitude, p.coords.longitude)),
      () => { setShare(false); toast("Location was not shared."); },
      { enableHighAccuracy: false, timeout: 15000 },
    );
  };

  const create = async () => {
    const { plants: created } = await createField({ name: name.trim() || "Home plot", crop, stage, cellId: cell }, Array.from({ length: count }, (_, i) => plantName(i).trim() || `Plant ${i + 1}`));
    setPlants(created);
    setStep(2);
  };

  const next = () => { if (idx + 1 >= plants.length) { nav("/watch"); return; } setIdx(idx + 1); };

  const onBaseline = async (a: AcceptedPhoto) => {
    setSaving(true);
    await saveVisit({ plantId: plants[idx].id, date: new Date().toISOString(), photo: a.photo, work: a.work, coach: a.coach, usedAnyway: a.usedAnyway });
    setSaving(false);
    next();
  };

  return (
    <div className="wrap max-w-3xl py-8 md:py-12">
      <h1 className="page-title">Set up a field</h1>
      <div className="mt-5"><Stepper steps={STEPS} current={step} /></div>
      <h2 className="h3 mt-6">{STEPS[step]}</h2>

      {step === 0 && (
        <form className="mt-4 space-y-5" onSubmit={(e) => { e.preventDefault(); setStep(1); }}>
          <label className="block"><span className="field-label">Field name</span>
            <input className="field-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Home plot" />
          </label>
          <label className="block"><span className="field-label">Crop</span>
            <select className="field-input" value={crop} onChange={(e) => setCrop(e.target.value)}>
              {PLANTS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="block"><span className="field-label">Stage</span>
            <select className="field-input" value={stage} onChange={(e) => setStage(e.target.value as CropStage)}>
              {STAGES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
          <Toggle checked={share} onChange={onShare} label="Share my approximate area" hint="Off by default. If you turn it on, your location is rounded to a 1 km area before anything is stored. Exact coordinates are never kept." />
          {share && cell && <p className="small font-semibold text-green-dark">Approximate area saved.</p>}
          <Button type="submit">Next</Button>
        </form>
      )}

      {step === 1 && (
        <div className="mt-4 space-y-5">
          <p>Pick 5 plants spread across the field in a W pattern. Tie a thread or clip on one leaf of each plant so you can find the same leaf again.</p>
          <WPattern count={count} />
          <label className="block max-w-xs"><span className="field-label">Number of plants</span>
            <input type="number" min={3} max={10} className="field-input" value={count} onChange={(e) => setCount(Math.max(3, Math.min(10, Number(e.target.value) || 3)))} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: count }, (_, i) => (
              <label key={i} className="block"><span className="field-label">Plant {i + 1} name</span>
                <input className="field-input" value={plantName(i)} onChange={(e) => { const copy = Array.from({ length: count }, (_, k) => plantName(k)); copy[i] = e.target.value; setNames(copy); }} />
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setStep(0)}>Back</Button>
            <Button onClick={create}>Next</Button>
          </div>
        </div>
      )}

      {step === 2 && plants[idx] && (
        <div className="mt-4 space-y-4">
          <p className="font-semibold text-forest">{plants[idx].name} ({idx + 1} of {plants.length})</p>
          {saving ? <p role="status">Saving…</p> : <PhotoFlow key={plants[idx].id} hint="Fill the frame with the marked leaf" onAccepted={onBaseline} />}
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" onClick={next}>Skip this plant</Button>
            <Button variant="secondary" onClick={() => nav("/watch")}>Done</Button>
          </div>
        </div>
      )}
    </div>
  );
}
