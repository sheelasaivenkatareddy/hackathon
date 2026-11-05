// Offline = scan only. With no internet the app shows a clear "Offline: scan only" state, and every screen except
// the leaf scanner (and the list of your scans) shows a card that sends the farmer to the scanner.
// Online, everything works as usual.
import { ScanLine, WifiOff } from "lucide-react";
import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

export function useOnline() {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  return online;
}

/** Screens that work with no internet: the scanners and the scans saved on this phone. */
export const OFFLINE_OK = ["/hub/scan", "/scan", "/history"];
export const worksOffline = (path: string) => OFFLINE_OK.some((p) => path === p || path.startsWith(`${p}/`));

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
