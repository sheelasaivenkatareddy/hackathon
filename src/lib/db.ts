// Patra Lens storage (IndexedDB). Photos are JPEG blobs; compare results are stored without the overlay masks.
import Dexie, { type Table, liveQuery } from "dexie";
import { useEffect, useState } from "react";
import type { AnswerLevel, Guess, Mode } from "./model";
import type { CropStage } from "./risk";
import type { CoachResult } from "./vision/coach";
import type { CompareResult } from "./vision/compare";

export type StoredCompare = Omit<CompareResult, "overlay" | "alignment"> & {
  alignment: { leafIou: number; method: CompareResult["alignment"]["method"]; quality: CompareResult["alignment"]["quality"] };
  olderVisitId: string;
  lowerAccuracy?: boolean; // OpenCV was not available
};

export interface Field { id: string; name: string; crop: string; stage: CropStage; cellId?: string; createdAt: string; synthetic?: boolean }
export interface Plant { id: string; fieldId: string; name: string; order: number; createdAt: string; synthetic?: boolean }
export interface Visit {
  id: string; plantId: string; date: string; photo: Blob; thumb: Blob; coach: CoachResult; usedAnyway: boolean;
  affectedPct: number; compare?: StoredCompare; diagnosisId?: string;
  askedExpert?: boolean; expertLabel?: string; expertNote?: string; checked?: boolean;
}
export interface Scan {
  id: string; date: string; photo: Blob; thumb: Blob; coach: CoachResult; usedAnyway: boolean; sampleFile?: string;
  prediction: { mode: Mode; top3: Guess[]; modelVersion?: string }; level: AnswerLevel; confirmed: boolean;
  askedExpert?: boolean; expertLabel?: string; expertNote?: string; fieldId?: string; plantId?: string; cellId?: string;
}
export interface Treatment { id: string; plantId: string; date: string; note: string }
export interface StoredReport { id: string; cell: string; disease: string; date: string; confirmed: boolean; source: "mine" | "sample" | "shared" }
export interface Setting { key: string; value: unknown }

class PatraDB extends Dexie {
  fields!: Table<Field, string>;
  plants!: Table<Plant, string>;
  visits!: Table<Visit, string>;
  scans!: Table<Scan, string>;
  treatments!: Table<Treatment, string>;
  reports!: Table<StoredReport, string>;
  settings!: Table<Setting, string>;
  constructor() {
    super("patra-lens");
    this.version(1).stores({
      fields: "id, createdAt",
      plants: "id, fieldId, order",
      visits: "id, plantId, date",
      scans: "id, date, plantId",
      treatments: "id, plantId, date",
      reports: "id, cell, disease, date",
      settings: "key",
    });
  }
}

export const db = new PatraDB();
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return row ? (row.value as T) : fallback;
}
export const setSetting = (key: string, value: unknown) => db.settings.put({ key, value });

/** Re-renders whenever the queried tables change. `undefined` means still loading. */
export function useLive<T>(query: () => Promise<T>, deps: unknown[] = []): T | undefined {
  const [value, setValue] = useState<T>();
  useEffect(() => {
    const sub = liveQuery(query).subscribe({ next: setValue, error: (e) => console.warn("Query failed", e) });
    return () => sub.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}

/** Object URL for a stored photo, revoked when no longer needed. */
export function useBlobUrl(blob?: Blob | null): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) { setUrl(undefined); return; }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

// ------------------------------------------------------------------ export / import (photos as base64)
const blobToDataUrl = (b: Blob) => new Promise<string>((res, rej) => {
  const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = () => rej(r.error); r.readAsDataURL(b);
});

const TABLES = ["fields", "plants", "visits", "scans", "treatments", "reports", "settings"] as const;

export async function exportAll(): Promise<Blob> {
  const out: Record<string, unknown[]> = {};
  for (const t of TABLES) {
    const rows = await (db as any)[t].toArray();
    out[t] = await Promise.all(rows.map(async (row: any) => {
      const copy = { ...row };
      for (const k of ["photo", "thumb"]) if (copy[k] instanceof Blob) copy[k] = await blobToDataUrl(copy[k]);
      return copy;
    }));
  }
  return new Blob([JSON.stringify({ app: "patra-lens", version: 1, exportedAt: new Date().toISOString(), tables: out })], { type: "application/json" });
}

export async function importAll(file: Blob): Promise<number> {
  const json = JSON.parse(await file.text());
  if (json.app !== "patra-lens" || !json.tables) throw new Error("This is not a Patra Lens export file.");
  let n = 0;
  for (const t of TABLES) {
    const rows = await Promise.all((json.tables[t] ?? []).map(async (row: any) => {
      const copy = { ...row };
      for (const k of ["photo", "thumb"]) if (typeof copy[k] === "string") copy[k] = await (await fetch(copy[k])).blob();
      return copy;
    }));
    await (db as any)[t].bulkPut(rows);
    n += rows.length;
  }
  return n;
}

/** Removes the synthetic test pairs and scans of bundled sample photos. Keeps the user's own data. */
export async function resetDemoData() {
  const fields = (await db.fields.toArray()).filter((f) => f.synthetic);
  const plants = (await db.plants.toArray()).filter((p) => p.synthetic);
  const plantIds = plants.map((p) => p.id);
  await db.visits.where("plantId").anyOf(plantIds).delete();
  await db.treatments.where("plantId").anyOf(plantIds).delete();
  await db.plants.bulkDelete(plantIds);
  await db.fields.bulkDelete(fields.map((f) => f.id));
  const samples = (await db.scans.toArray()).filter((s) => s.sampleFile).map((s) => s.id);
  await db.scans.bulkDelete(samples);
}

export async function deleteAllData() {
  await Promise.all(TABLES.map((t) => (db as any)[t].clear()));
}
