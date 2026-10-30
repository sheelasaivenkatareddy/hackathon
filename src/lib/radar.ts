// Neighbourhood Disease Radar: approximate 1 km cells, consent only, and the unusual-rise rule.
import { CONFIG } from "../config";

export interface Report {
  id: string;
  cell: string; // "floor(lat*100)_floor(lon*100)"; exact coordinates are never stored
  disease: string;
  confirmed: boolean;
  date?: string; // ISO date, for real reports
  weeksAgo?: number; // sample data uses this instead of a date
  sample?: boolean;
}

const k = () => 1 / CONFIG.radar.cellDeg;

/** Round a location to its cell BEFORE storing anything. */
export const cellId = (lat: number, lon: number) => `${Math.floor(lat * k())}_${Math.floor(lon * k())}`;

export function cellBounds(id: string): [[number, number], [number, number]] {
  const [a, b] = id.split("_").map(Number), s = CONFIG.radar.cellDeg;
  return [[a * s, b * s], [(a + 1) * s, (b + 1) * s]];
}
export function cellCentre(id: string): [number, number] {
  const [[la0, lo0], [la1, lo1]] = cellBounds(id);
  return [(la0 + la1) / 2, (lo0 + lo1) / 2];
}
/** The cell and its 8 neighbours (about 3 x 3 km). */
export function area(id: string): string[] {
  const [a, b] = id.split("_").map(Number), out: string[] = [];
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) out.push(`${a + i}_${b + j}`);
  return out;
}

export function weeksAgo(r: Report, now: Date = new Date()): number {
  if (r.date) return Math.floor((now.getTime() - Date.parse(r.date)) / (7 * 86400000));
  return r.weeksAgo ?? 0;
}

/** Show a number only from 3 reports up; fewer shows "A few reports". */
export const displayCount = (n: number): number | "A few reports" => (n < CONFIG.radar.minReportsToShowNumber ? "A few reports" : n);

export function cellCountsThisWeek(reports: Report[], now?: Date): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of reports) if (r.confirmed && weeksAgo(r, now) === 0) m.set(r.cell, (m.get(r.cell) ?? 0) + 1);
  return m;
}

/** Confirmed reports this week in the 3 x 3 km area around a cell, by disease (input for risk.ts). */
export function nearbyThisWeek(reports: Report[], cell: string, now?: Date): Record<string, number> {
  const near = new Set(area(cell)), out: Record<string, number> = {};
  for (const r of reports) if (r.confirmed && near.has(r.cell) && weeksAgo(r, now) === 0) out[r.disease] = (out[r.disease] ?? 0) + 1;
  return out;
}

export interface Rise { disease: string; centreCell: string; thisWeek: number; previousWeeklyAverage: number; cells: string[] }

/**
 * Unusual rise: an area (cell + 8 neighbours) with >= 3 confirmed reports of one disease this week
 * AND >= 2x the weekly average of the previous 3 weeks. One result per disease (the busiest area).
 */
export function unusualRises(reports: Report[], now?: Date): Rise[] {
  const c = CONFIG.radar, conf = reports.filter((r) => r.confirmed);
  const best = new Map<string, Rise>();
  const cells = new Set(conf.map((r) => r.cell));
  for (const centre of cells) {
    const near = new Set(area(centre));
    const diseases = new Set(conf.filter((r) => near.has(r.cell)).map((r) => r.disease));
    for (const d of diseases) {
      let thisWeek = 0, prev = 0;
      for (const r of conf) {
        if (r.disease !== d || !near.has(r.cell)) continue;
        const w = weeksAgo(r, now);
        if (w === 0) thisWeek++; else if (w >= 1 && w <= c.previousWeeks) prev++;
      }
      const avg = prev / c.previousWeeks;
      if (thisWeek >= c.riseMinThisWeek && thisWeek >= c.riseFactor * avg) {
        const cur = best.get(d);
        if (!cur || thisWeek > cur.thisWeek) {
          best.set(d, { disease: d, centreCell: centre, thisWeek, previousWeeklyAverage: Math.round(avg * 100) / 100,
            cells: area(centre).filter((x) => cells.has(x)) });
        }
      }
    }
  }
  return [...best.values()];
}
