// Leaf Watch logic around the kit's compare code: saving visits, schedule, incidence and recovery status.
import { Plant, Field, StoredCompare, Treatment, Visit, db, uid } from "./db";
import { loadWorkImage, shrinkForStorage } from "./vision/browser";
import { photoCoach } from "./vision/coach";
import type { CoachResult } from "./vision/coach";
import { CompareResult, WatchStatus, compareVisits } from "./vision/compare";
import { leafMasks } from "./vision/masks";
import { loadOpenCv } from "./vision/opencv";
import type { RGBAImage } from "./vision/types";

const DAY = 86400000;
export const NEW_DAMAGE: WatchStatus[] = ["first_spots_found", "new_spots_found", "spreading"];
export const isNewDamage = (s?: WatchStatus) => !!s && NEW_DAMAGE.includes(s);
export const daysBetween = (a: string, b: string) => Math.abs(Date.parse(b) - Date.parse(a)) / DAY;

/** Loads OpenCV once. Returns { cv: null } if it fails (the compare then uses leaf shape only). */
export async function getCv(): Promise<{ cv: any | null }> {
  try { return await loadOpenCv(); } catch (e) { console.warn(e); return { cv: null }; }
}

/** Runs after a short delay so the "Comparing..." animation starts first. */
export async function runCompare(older: Blob, newer: Blob, days: number): Promise<{ result: CompareResult; lowerAccuracy: boolean }> {
  const { cv } = await getCv();
  await new Promise((r) => setTimeout(r, 60));
  const [a, b] = await Promise.all([loadWorkImage(older), loadWorkImage(newer)]);
  if (cv) {
    try { return { result: compareVisits(a, b, days, cv), lowerAccuracy: false }; }
    catch (e) { console.warn("OpenCV compare failed, using leaf shape only", e); }
  }
  return { result: compareVisits(a, b, days, null), lowerAccuracy: true };
}

export function storedCompare(r: CompareResult, olderVisitId: string, lowerAccuracy: boolean): StoredCompare {
  const { overlay: _overlay, alignment, ...rest } = r;
  return { ...rest, alignment: { leafIou: alignment.leafIou, method: alignment.method, quality: alignment.quality }, olderVisitId, lowerAccuracy };
}

export const plantVisits = async (plantId: string) => (await db.visits.where("plantId").equals(plantId).toArray()).sort((a, b) => a.date.localeCompare(b.date));

export interface SaveVisitInput { plantId: string; date: string; photo: Blob; work: RGBAImage; coach: CoachResult; usedAnyway: boolean }

/** Saves the visit and compares it with the visit before it. An imported older visit also refreshes the one after it. */
export async function saveVisit(input: SaveVisitInput): Promise<{ visit: Visit; older?: Visit; result?: CompareResult; lowerAccuracy: boolean }> {
  const { plantId, date, photo, work, coach, usedAnyway } = input;
  const thumb = await shrinkForStorage(photo, 256, 0.72);
  const visit: Visit = { id: uid(), plantId, date, photo, thumb, coach, usedAnyway, affectedPct: Math.round(leafMasks(work).affectedPct * 100) / 100 };
  const all = await plantVisits(plantId);
  const older = [...all].reverse().find((v) => v.date <= date);
  const later = all.find((v) => v.date > date);
  let result: CompareResult | undefined, lowerAccuracy = false;
  if (older) {
    const r = await runCompare(older.photo, photo, Math.max(1, Math.round(daysBetween(older.date, date))));
    result = r.result; lowerAccuracy = r.lowerAccuracy;
    visit.compare = storedCompare(result, older.id, lowerAccuracy);
  }
  await db.visits.put(visit);
  if (later) {
    const r = await runCompare(photo, later.photo, Math.max(1, Math.round(daysBetween(date, later.date))));
    await db.visits.update(later.id, { compare: storedCompare(r.result, visit.id, r.lowerAccuracy) });
  }
  return { visit, older, result, lowerAccuracy };
}

async function fetchPhoto(url: string): Promise<Blob> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Could not load ${url}`);
  return r.blob();
}

/** Used for the test pair and the demo plant. */
async function saveVisitFromBlob(plantId: string, blob: Blob, date: string) {
  const photo = await shrinkForStorage(blob);
  const work = await loadWorkImage(photo);
  return saveVisit({ plantId, date, photo, work, coach: photoCoach(work), usedAnyway: false });
}

export async function createField(input: Omit<Field, "id" | "createdAt" | "crop"> & { crop?: string }, plantNames: string[], synthetic = false) {
  const now = new Date().toISOString();
  const field: Field = { crop: "Tomato", ...input, id: uid(), createdAt: now, synthetic: synthetic || undefined };
  const plants: Plant[] = plantNames.map((name, order) => ({ id: uid(), fieldId: field.id, name, order, createdAt: now, synthetic: synthetic || undefined }));
  await db.fields.put(field);
  await db.plants.bulkPut(plants);
  return { field, plants };
}

export const TEST_PAIR_URLS = ["first-spot-visit-1", "first-spot-visit-2", "spreading-visit-1", "spreading-visit-2"].map((n) => `/samples/test-pair/synthetic-${n}.jpg`);

export async function loadTestPairs() {
  // Fetch first, so a failed download does not leave an empty field behind.
  const [a1, a2, b1, b2] = await Promise.all(TEST_PAIR_URLS.map(fetchPhoto));
  const { plants } = await createField({ name: "Test field", stage: "vegetative" }, ["First spot pair", "Spreading pair"], true);
  const now = Date.now(), d1 = new Date(now - 2 * DAY).toISOString(), d2 = new Date(now).toISOString();
  await saveVisitFromBlob(plants[0].id, a1, d1);
  await saveVisitFromBlob(plants[0].id, a2, d2);
  await saveVisitFromBlob(plants[1].id, b1, d1);
  await saveVisitFromBlob(plants[1].id, b2, d2);
}

// ------------------------------------------------------------------ the real timeline photos from the team
export interface ManifestVisit { date: string; file: string }
export async function timelineManifest(): Promise<{ name: string; visits: ManifestVisit[] } | null> {
  try {
    const m = await (await fetch("/samples/timeline/manifest.json")).json();
    const plant = m.plants?.find((p: any) => p.visits?.length >= 2);
    return plant ?? null;
  } catch { return null; }
}
export async function loadDemoPlant(manifest: { name: string; visits: ManifestVisit[] }) {
  const visits = [...manifest.visits].sort((a, b) => a.date.localeCompare(b.date));
  const blobs = await Promise.all(visits.map((v) => fetchPhoto(v.file.startsWith("/") ? v.file : `/samples/timeline/${v.file}`)));
  const { plants } = await createField({ name: "Demo plot", stage: "fruiting" }, [manifest.name]);
  for (let i = 0; i < visits.length; i++) await saveVisitFromBlob(plants[0].id, blobs[i], new Date(visits[i].date).toISOString());
}

// ------------------------------------------------------------------ schedule
export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const nextCheckDate = (lastVisit: string | undefined, every: number) => (lastVisit ? addDays(new Date(lastVisit), every) : startOfDay(new Date()));
export const daysUntil = (d: Date) => Math.round((startOfDay(d).getTime() - startOfDay(new Date()).getTime()) / DAY);
export const fmtDate = (d: Date | string) => new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
export const fmtShort = (d: Date | string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
export const dueLabel = (d: Date) => { const n = daysUntil(d); return n <= 0 ? "Due today" : `Due in ${n} day${n === 1 ? "" : "s"}`; };

// ------------------------------------------------------------------ field figures
export interface FieldSummary { checked: number; withDamage: number; incidencePct: number; severity: number | null }

/** Incidence = plants whose latest compare shows new damage / plants checked. Severity = mean latest affected %. */
export function summarise(latest: (Visit | undefined)[]): FieldSummary {
  const seen = latest.filter((v): v is Visit => !!v);
  const compared = seen.filter((v) => v.compare);
  const withDamage = compared.filter((v) => isNewDamage(v.compare!.status)).length;
  const severity = compared.length ? compared.reduce((s, v) => s + v.compare!.affectedNewPct, 0) / compared.length : null;
  return { checked: compared.length, withDamage, incidencePct: compared.length ? Math.round((withDamage / compared.length) * 100) : 0, severity: severity === null ? null : Math.round(severity * 10) / 10 };
}

// ------------------------------------------------------------------ recovery status
export type Recovery = "Recovering" | "Not improving yet" | "Too early to tell";
export function recoveryStatus(visits: Visit[], treatments: Treatment[]): Recovery | null {
  if (!treatments.length) return null;
  const from = treatments.map((t) => t.date).sort()[0];
  const after = visits.filter((v) => v.date > from && v.compare && v.compare.status !== "not_comparable").map((v) => v.compare!);
  if (!after.length) return "Too early to tell";
  if (after.every((c) => c.changePer3Days <= -2 && !isNewDamage(c.status))) return "Recovering";
  if (after.filter((c) => c.changePer3Days >= 0 || isNewDamage(c.status)).length >= 2) return "Not improving yet";
  return "Too early to tell";
}
