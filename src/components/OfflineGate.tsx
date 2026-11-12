// Offline = scan only. With no internet the app shows a clear "Offline: scan only" state, and every screen except
// the leaf scanner (and the list of your scans) shows a card that sends the farmer to the scanner.
// Online, everything works as usual.
import { Globe, ScanLine, WifiOff } from "lucide-react";
import { isForcedOffline, isOnlineMode, onModeChange, setForcedOffline } from "../lib/mode";
import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

export function useOnline() {
  const [online, setOnline] = useState(isOnlineMode());
  useEffect(() => {
    const update = () => setOnline(isOnlineMode());
    window.addEventListener("online", update); window.addEventListener("offline", update);
    const stop = onModeChange(update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); stop(); };
  }, []);
  return online;
}

/** Screens that work with no internet: the scanners and the scans saved on this phone. */
export const OFFLINE_OK = ["/hub/scan", "/scan", "/history"];
export const worksOffline = (path: string) => path === "/" || OFFLINE_OK.some((p) => path === p || path.startsWith(`${p}/`));

const hubUser = () => { try { return !!localStorage.getItem("hub:user"); } catch { return false; } };

export function OfflineGate({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  const online = useOnline();
  const { pathname } = useLocation();
  if (online || worksOffline(pathname)) return <>{children}</>;
  const scanTo = hubUser() ? "/hub/scan" : "/scan";
  return (
    <div className={`lit mx-auto my-10 max-w-lg rounded-3xl border p-6 text-center md:p-8 ${dark ? "border-white/10 bg-white/[0.04]" : "border-[#243452] bg-[#0D172B]"}`}>
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#FBBF24]/40 bg-[#FBBF24]/10"><WifiOff className="h-7 w-7 text-[#FBBF24]" aria-hidden /></span>
      <h1 className="mt-4 font-heading text-2xl font-extrabold text-white">You are offline</h1>
      <p className="mt-2 text-slate-300">Without internet you can still <strong className="text-white">scan a leaf</strong> and see its health, the problem spots and what to do. Everything else opens again when you are back online.</p>
      <Link to={scanTo} className="mt-6 inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-[#22D3EE] px-5 font-bold text-[#040A18] shadow-[0_0_24px_rgba(34,211,238,0.35)]">
        <ScanLine className="h-5 w-5" aria-hidden />Scan a leaf
      </Link>
      <p className="mt-3 text-xs text-slate-500">Scans you take now are saved on this phone and upload by themselves later.</p>
      {isForcedOffline() && navigator.onLine && <button onClick={() => setForcedOffline(false)} className="mt-4 text-sm font-bold text-[#22D3EE] underline">Switch back to online mode</button>}
    </div>
  );
}

/** Small always-visible status: "Online" or "Offline · scan only". */
export function ConnectionPill({ className = "" }: { className?: string }) {
  const online = useOnline();
  return (
    <span role="status" aria-live="polite" className={`lit inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${online ? "border-[#A3E635]/30 bg-[#A3E635]/10 text-[#A3E635]" : "border-[#FBBF24]/40 bg-[#FBBF24]/10 text-[#FBBF24]"} ${className}`}>
      <span className={`h-2 w-2 rounded-full ${online ? "bg-[#A3E635]" : "bg-[#FBBF24] animate-pulse"}`} aria-hidden />
      {online ? "Online" : "Offline · scan only"}
    </span>
  );
}

/** Front page: the two ways to use the app, which one is on, and a switch. */
export function ModeSwitch() {
  const online = useOnline();
  const hasNet = typeof navigator === "undefined" || navigator.onLine;
  const forced = isForcedOffline();
  const scanTo = hubUser() ? "/hub/scan" : "/scan";
  const card = (on: boolean, accent: string) => `relative flex-1 rounded-2xl border p-4 text-left transition md:p-5 ${on ? accent : "border-white/10 bg-white/[0.03] opacity-70 hover:opacity-100"}`;
  return (
    <section aria-label="Online or offline mode" className="lit border-b border-white/10 bg-[#060D1F]">
      <div className="wrap py-4 md:py-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">How do you want to use Patra Chain?</p>
          <ConnectionPill />
        </div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <button onClick={() => setForcedOffline(false)} disabled={!hasNet} aria-pressed={online} className={card(online, "border-[#A3E635]/50 bg-[#A3E635]/10")}>
            <span className="flex items-center gap-2 font-heading text-lg font-extrabold text-white"><Globe className="h-5 w-5 text-[#A3E635]" aria-hidden />Online mode {online && <span className="rounded-full bg-[#A3E635] px-2 py-0.5 text-[10px] font-bold uppercase text-[#040A18]">On</span>}</span>
            <span className="mt-1 block text-sm text-slate-300">Everything: AI chat and voice in 6 languages, mandi prices, labs, weather, schemes. Scans are saved to the cloud.</span>
            {!hasNet && <span className="mt-1 block text-xs font-semibold text-[#FBBF24]">No internet on this phone right now.</span>}
          </button>
          <button onClick={() => setForcedOffline(true)} aria-pressed={!online} className={card(!online, "border-[#FBBF24]/50 bg-[#FBBF24]/10")}>
            <span className="flex items-center gap-2 font-heading text-lg font-extrabold text-white"><WifiOff className="h-5 w-5 text-[#FBBF24]" aria-hidden />Offline mode {!online && <span className="rounded-full bg-[#FBBF24] px-2 py-0.5 text-[10px] font-bold uppercase text-[#040A18]">On</span>}</span>
            <span className="mt-1 block text-sm text-slate-300">No internet needed. Take a leaf photo and get its health, problem spots and what to do. Uploads later.</span>
          </button>
        </div>
        {!online && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Link to={scanTo} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#22D3EE] px-5 font-bold text-[#040A18]"><ScanLine className="h-5 w-5" aria-hidden />Scan a leaf now</Link>
            <span className="text-xs text-slate-400">{forced && hasNet ? "You chose offline mode. Nothing is sent over the internet." : "Offline: only scanning works until the internet is back."}</span>
          </div>
        )}
      </div>
    </section>
  );
}
