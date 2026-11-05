// Kisan Hub state kept on the phone: the signed-in user (OTP is simulated for the demo), hub scans and lab escalations.
// Each list is small JSON in localStorage, so the dashboard opens instantly and works offline.
import { useEffect, useState } from "react";
import type { LeafResult } from "../lib/cloud";
import { saveProfile } from "../lib/cloud";

export type Role = "farmer" | "expert";
export type StateId = "AP" | "TS" | "KA";

export interface District { name: string; lat: number; lon: number }
export const STATES: Record<StateId, { name: string; te: string; districts: District[] }> = {
  AP: { name: "Andhra Pradesh", te: "ఆంధ్ర ప్రదేశ్", districts: [
    { name: "Guntur", lat: 16.3, lon: 80.44 }, { name: "Kurnool", lat: 15.83, lon: 78.04 }, { name: "Annamayya (Madanapalle)", lat: 13.55, lon: 78.5 },
    { name: "Anantapur", lat: 14.68, lon: 77.6 }, { name: "NTR (Vijayawada)", lat: 16.51, lon: 80.65 }, { name: "Kakinada", lat: 16.99, lon: 82.25 },
  ] },
  TS: { name: "Telangana", te: "తెలంగాణ", districts: [
    { name: "Warangal", lat: 17.97, lon: 79.59 }, { name: "Khammam", lat: 17.25, lon: 80.15 }, { name: "Nizamabad", lat: 18.67, lon: 78.09 },
    { name: "Rangareddy (Hyderabad)", lat: 17.36, lon: 78.47 }, { name: "Suryapet", lat: 17.14, lon: 79.62 }, { name: "Karimnagar", lat: 18.44, lon: 79.13 },
  ] },
  KA: { name: "Karnataka", te: "కర్ణాటక", districts: [
    { name: "Kolar", lat: 13.14, lon: 78.13 }, { name: "Bengaluru Rural", lat: 13.23, lon: 77.71 }, { name: "Haveri (Byadgi)", lat: 14.68, lon: 75.49 },
    { name: "Raichur", lat: 16.2, lon: 77.36 }, { name: "Dharwad (Hubballi)", lat: 15.36, lon: 75.12 }, { name: "Mysuru", lat: 12.3, lon: 76.64 },
  ] },
};

export interface HubUser {
  phone: string; email?: string; name: string; role: Role; state: StateId; district: string; village: string;
  acres: number; crops: string[]; since: string;
}

export interface HubScan {
  id: string; cloudId?: string; date: string; crop: string; thumb: string; source: "ai-vision" | "on-device";
  result: LeafResult; lat?: number; lon?: number;
}

export interface Escalation {
  id: string; scanId: string; labId: string; labName: string; date: string; note: string;
  status: "sent" | "saved-on-phone"; cloudId?: string;
}

// ------------------------------------------------------------------ tiny reactive localStorage
const read = <T,>(key: string, fallback: T): T => {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
};
const listeners = new Map<string, Set<() => void>>();
const write = (key: string, value: unknown) => {
  try { value === null ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
  listeners.get(key)?.forEach((l) => l());
};
function useStored<T>(key: string, fallback: T): T {
  const [v, setV] = useState<T>(() => read(key, fallback));
  useEffect(() => {
    const l = () => setV(read(key, fallback));
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key)!.add(l);
    return () => { listeners.get(key)!.delete(l); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return v;
}

const USER = "hub:user", SCANS = "hub:scans", ESC = "hub:escalations", LANG = "hub:lang";

export const getUser = () => read<HubUser | null>(USER, null);
export const useUser = () => useStored<HubUser | null>(USER, null);
export function signIn(u: HubUser) {
  write(USER, u);
  // The same name, phone and village go with every cloud scan, so the lab and admin can call back.
  saveProfile({ name: u.name, phone: u.phone, village: `${u.village}, ${u.district}, ${STATES[u.state].name}` }).catch(() => undefined);
}
export const signOut = () => write(USER, null);
export const districtOf = (u: HubUser | null): District => STATES[u?.state ?? "KA"].districts.find((d) => d.name === u?.district) ?? STATES.KA.districts[1];

export const useHubScans = () => useStored<HubScan[]>(SCANS, []);
export const getHubScans = () => read<HubScan[]>(SCANS, []);
export function updateHubScan(id: string, patch: Partial<HubScan>) { write(SCANS, getHubScans().map((x) => (x.id === id ? { ...x, ...patch } : x))); }
export function addHubScan(s: HubScan) { write(SCANS, [s, ...getHubScans().filter((x) => x.id !== s.id)].slice(0, 25)); }

export const useEscalations = () => useStored<Escalation[]>(ESC, []);
export const getEscalations = () => read<Escalation[]>(ESC, []);
export function updateEscalation(id: string, patch: Partial<Escalation>) { write(ESC, getEscalations().map((x) => (x.id === id ? { ...x, ...patch } : x))); }
export function addEscalation(e: Escalation) { write(ESC, [e, ...read<Escalation[]>(ESC, [])].slice(0, 50)); }

export type VoiceLang = "te" | "hi" | "en" | "ta" | "kn" | "ml";
export const useHubLang = () => useStored<VoiceLang>(LANG, "te");
export const setHubLang = (l: VoiceLang) => write(LANG, l);

// ------------------------------------------------------------------ simulated OTP (for the demo; no SMS is sent)
let pendingOtp: { phone: string; code: string; at: number } | null = null;
export function sendOtp(phone: string): string {
  const code = String(Math.floor(1000 + Math.random() * 9000));
  pendingOtp = { phone, code, at: Date.now() };
  return code;
}
export const verifyOtp = (phone: string, code: string) =>
  !!pendingOtp && pendingOtp.phone === phone && pendingOtp.code === code.trim() && Date.now() - pendingOtp.at < 5 * 60_000;

export const validPhone = (p: string) => /^[6-9]\d{9}$/.test(p.replace(/\D/g, "").slice(-10));
export const cleanPhone = (p: string) => p.replace(/\D/g, "").slice(-10);
