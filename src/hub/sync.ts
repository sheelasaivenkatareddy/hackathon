// Offline-first sync for Kisan Hub. Everything works on the phone first: a scan taken with no internet is saved
// locally (photo in IndexedDB, result in the hub list). When the phone is online again, this uploads the waiting
// scans and sends the lab requests that were saved on the phone. Safe to run often: it only touches what is pending.
import { isOnlineMode } from "../lib/mode";
import { useEffect, useState } from "react";
import { useOnline } from "../components/OfflineGate";
import { cloudConfigured, escalateInCloud, saveToCloud } from "../lib/cloud";
import { db } from "../lib/db";
import { getEscalations, getHubScans, updateEscalation, updateHubScan, useEscalations, useHubScans } from "./store";

let running = false;
const listeners = new Set<(r: boolean) => void>();
const setRunning = (v: boolean) => { running = v; listeners.forEach((l) => l(v)); };

export interface SyncResult { scans: number; requests: number; failed: boolean }

export async function syncNow(): Promise<SyncResult> {
  const out: SyncResult = { scans: 0, requests: 0, failed: false };
  if (running || !cloudConfigured || !isOnlineMode()) return out;
  setRunning(true);
  try {
    // 1. Scans that were saved only on the phone: upload the photo and result.
    for (const s of getHubScans().filter((x) => !x.cloudId)) {
      const row = await db.scans.get(s.id);
      if (!row) continue; // the full photo was cleared from this phone: nothing to upload
      const res = await saveToCloud(row.photo, s.result, s.lat != null && s.lon != null ? { lat: s.lat, lon: s.lon } : null);
      if (res.ok) { updateHubScan(s.id, { cloudId: res.id, source: res.source }); out.scans++; }
      else if (res.code === "network" || res.code === "limit") { out.failed = true; break; }
    }
    // 2. Lab requests saved on the phone. A request about a scan waits until that scan is uploaded.
    for (const e of getEscalations().filter((x) => x.status === "saved-on-phone")) {
      const scan = e.scanId ? getHubScans().find((s) => s.id === e.scanId) : undefined;
      if (scan && !scan.cloudId) continue;
      const res = await escalateInCloud({
        scanId: scan?.cloudId, lab: { id: e.labId, name: e.labName }, crop: scan?.crop,
        disease: scan ? (scan.result.healthy ? "Healthy" : scan.result.disease.name) : undefined, note: e.note,
        summary: scan ? { plant: scan.result.plant, disease: scan.result.disease, detections: scan.result.detections.length, lat: scan.lat, lon: scan.lon, date: scan.date } : undefined,
      });
      if (res.ok) { updateEscalation(e.id, { status: "sent", cloudId: res.id }); out.requests++; }
      else { out.failed = true; break; }
    }
  } catch { out.failed = true; } finally { setRunning(false); }
  return out;
}

let started = false;
/** Syncs at start, whenever the connection comes back, and every minute while the app is open. */
export function startSync() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("online", () => { syncNow(); });
  setInterval(() => { if (isOnlineMode()) syncNow(); }, 60_000);
  syncNow();
}

/** Connection and queue state for the badge. */
export function useSyncState() {
  const scans = useHubScans(), esc = useEscalations();
  const online = useOnline();
  const [syncing, setSyncing] = useState(running);
  useEffect(() => {
    listeners.add(setSyncing);
    return () => { listeners.delete(setSyncing); };
  }, []);
  const waitingScans = cloudConfigured ? scans.filter((s) => !s.cloudId).length : 0;
  const waitingRequests = esc.filter((e) => e.status === "saved-on-phone").length;
  return { online, syncing, waitingScans, waitingRequests, waiting: waitingScans + waitingRequests };
}
