// Kisan Hub shell: sidebar on desktop, top bar and bottom bar with a glowing Scan button on phones.
// Every hub page except login needs a signed-in user.
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Building2, Calculator, CloudSun, Gift, LayoutDashboard, LogOut, Menu, Mic, ScanLine, TrendingUp, Wifi, WifiOff, X } from "lucide-react";
import { ReactNode, useEffect, useState } from "react";
import { Link, NavLink, Navigate, useLocation } from "react-router-dom";
import VoiceAgent from "../components/VoiceAgent";
import { OfflineGate, useOnline, worksOffline } from "../components/OfflineGate";
import { cacheOfflinePack, ensureOfflinePack, usePackState } from "../lib/offline";
import { signOut, useUser } from "./store";
import { startSync, syncNow, useSyncState } from "./sync";

export const HUB_NAV = [
  { to: "/hub", label: "Dashboard", icon: LayoutDashboard },
  { to: "/hub/vani", label: "Kisan Vani", icon: Mic },
  { to: "/hub/scan", label: "Crop Scanner", icon: ScanLine },
  { to: "/hub/mandi", label: "Mandi Prices", icon: TrendingUp },
  { to: "/hub/labs", label: "Labs & RBK", icon: Building2 },
  { to: "/hub/weather", label: "Weather & Spray", icon: CloudSun },
  { to: "/hub/schemes", label: "Schemes", icon: Gift },
  { to: "/hub/npk", label: "NPK Calculator", icon: Calculator },
];
const BOTTOM = ["/hub", "/hub/vani", "/hub/scan", "/hub/mandi"];

const Logo = () => (
  <Link to="/hub" className="flex items-center gap-2.5">
    <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-neon-cyan to-neon-teal shadow-[0_0_20px_rgba(34,211,238,0.5)]">
      <img src="/logo.svg" alt="" className="h-6 w-6 brightness-0" />
    </span>
    <span className="leading-tight">
      <span className="block font-heading text-lg font-extrabold text-white">Kisan Hub</span>
      <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-neon-cyan/80">by Patra Lens</span>
    </span>
  </Link>
);


/** Online / offline and what is waiting to upload. Tapping it syncs now. */
function SyncBadge({ className = "" }: { className?: string }) {
  const { online, syncing, waiting } = useSyncState();
  const pack = usePackState();
  const tone = !online ? "border-neon-amber/40 bg-neon-amber/10 text-neon-amber" : waiting ? "border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan" : "border-neon-lime/30 bg-neon-lime/10 text-neon-lime";
  const label = !online ? `Offline · scan only${waiting ? ` · ${waiting} waiting to upload` : ""}` : syncing ? "Uploading…" : waiting ? `${waiting} waiting · tap to upload` : "Online · all saved";
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <button onClick={() => syncNow()} disabled={!online || syncing || !waiting} aria-live="polite"
        className={`flex min-h-[32px] items-center gap-1.5 rounded-full border px-3 text-xs font-bold ${tone}`}>
        {online ? <Wifi className="h-3.5 w-3.5" aria-hidden /> : <WifiOff className="h-3.5 w-3.5" aria-hidden />}{label}
      </button>
      {pack.phase === "busy" && <span className="px-1 text-[11px] font-semibold text-neon-cyan">Saving the AI for offline use… {pack.done}/{pack.total}</span>}
      {pack.phase === "missing" && online && <button onClick={() => cacheOfflinePack()} className="text-left text-[11px] font-semibold text-neon-amber underline">Offline AI not saved yet: tap to save (23 MB)</button>}
      {pack.phase === "ready" && <span className="px-1 text-[11px] font-semibold text-neon-lime">✓ Offline AI saved on this phone</span>}
    </div>
  );
}

export default function HubLayout({ children }: { children: ReactNode }) {
  const user = useUser();
  const { pathname } = useLocation();
  const [more, setMore] = useState(false);
  const online = useOnline();
  useEffect(() => setMore(false), [pathname]);
  const active = (to: string) => (to === "/hub" ? pathname === "/hub" || pathname === "/hub/" : pathname.startsWith(to));

  // Sync waiting scans and lab requests, and save the offline pack so scans work with no internet.
  useEffect(() => {
    if (!user) return;
    startSync();
    const t = setTimeout(() => { ensureOfflinePack(); }, 2500);
    return () => clearTimeout(t);
  }, [user]);

  if (pathname.startsWith("/hub/login") || pathname.startsWith("/hub/expert-login")) return <div className="hub min-h-screen">{children}</div>;
  // Signing in needs the internet: offline, go to the scanner that works without an account.
  if (!user) return <Navigate to={online ? `/hub/login?next=${encodeURIComponent(pathname)}` : "/scan"} replace />;

  const initials = user.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "K";
  const UserCard = () => (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-neon-pink to-neon-cyan font-bold text-navy-950">{initials}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-white">{user.name}</p>
        <p className="truncate text-xs capitalize text-slate-400">{user.role} · {user.district}</p>
      </div>
      <button onClick={signOut} aria-label="Sign out" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white"><LogOut className="h-4 w-4" aria-hidden /></button>
    </div>
  );

  return (
    <div className="hub relative min-h-screen">
      <div aria-hidden className="hub-grid pointer-events-none fixed inset-0" />

      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-white/10 bg-navy-950/70 p-4 backdrop-blur-xl lg:flex">
        <Logo />
        <nav className="mt-8 flex-1 space-y-1" aria-label="Kisan Hub">
          {HUB_NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === "/hub"} className={`relative flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-semibold transition ${active(n.to) ? "text-white" : "text-slate-400 hover:text-white"} ${!online && !worksOffline(n.to) ? "opacity-35" : ""}`}>
              {active(n.to) && <motion.span layoutId="hub-nav" className="absolute inset-0 rounded-xl border border-neon-cyan/30 bg-neon-cyan/10 shadow-[inset_3px_0_0_#22D3EE]" transition={{ type: "spring", stiffness: 400, damping: 34 }} />}
              <n.icon className={`relative h-5 w-5 ${active(n.to) ? "text-neon-cyan" : ""}`} aria-hidden />
              <span className="relative">{n.label}</span>{!online && !worksOffline(n.to) && <span className="relative ml-auto text-[10px] font-bold uppercase text-slate-500">online</span>}
            </NavLink>
          ))}
        </nav>
        <SyncBadge className="mb-3 px-1" />
        <Link to="/" className="mb-3 flex items-center gap-2 px-3 text-xs font-semibold text-slate-500 hover:text-slate-300"><ArrowLeft className="h-3.5 w-3.5" aria-hidden />Patra Lens website</Link>
        <UserCard />
      </aside>

      {/* phone top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-white/10 bg-navy-950/80 px-4 backdrop-blur-xl lg:hidden">
        <Logo />
        <button onClick={() => setMore(true)} aria-label="Menu" className="flex h-11 w-11 items-center justify-center rounded-xl text-white hover:bg-white/10"><Menu className="h-6 w-6" aria-hidden /></button>
      </header>

      {/* No z-index here: page dialogs (z-[60]) must stack above the fixed bars. */}
      <SyncBadge className="px-4 pt-3 lg:hidden" />
      <main className="relative px-4 pb-28 pt-5 md:px-8 md:pt-8 lg:ml-64 lg:pb-12">
        <div className="mx-auto max-w-6xl"><OfflineGate dark>{children}</OfflineGate></div>
      </main>

      {/* Kisan Vani has its own big microphone. */}
      {online && !pathname.startsWith("/hub/vani") && <VoiceAgent />}

      {/* phone bottom bar */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-navy-950/90 backdrop-blur-xl lg:hidden" aria-label="Kisan Hub">
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {BOTTOM.map((to) => {
            const n = HUB_NAV.find((x) => x.to === to)!, on = active(to);
            if (to === "/hub/scan") return (
              <li key={to} className="flex justify-center">
                <NavLink to={to} className="flex flex-col items-center">
                  <span className="-mt-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-neon-cyan to-neon-teal text-navy-950 shadow-[0_0_24px_rgba(34,211,238,0.6)]"><ScanLine className="h-7 w-7" aria-hidden /></span>
                  <span className={`pb-1 text-[11px] font-semibold ${on ? "text-neon-cyan" : "text-slate-400"}`}>Scan</span>
                </NavLink>
              </li>
            );
            return (
              <li key={to}>
                <NavLink to={to} end={to === "/hub"} className={`flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${on ? "text-neon-cyan" : "text-slate-400"}`}>
                  <n.icon className="h-5 w-5" aria-hidden />{n.label.split(" ")[0] === "Kisan" ? "Vani" : n.label.split(" ")[0]}
                </NavLink>
              </li>
            );
          })}
          <li>
            <button onClick={() => setMore(true)} className="flex h-16 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-slate-400"><Menu className="h-5 w-5" aria-hidden />More</button>
          </li>
        </ul>
      </nav>

      <AnimatePresence>
        {more && (
          <motion.div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMore(false)}>
            <motion.div role="dialog" aria-label="Menu" className="hub absolute inset-x-0 bottom-0 rounded-t-3xl border-t border-white/10 p-4 pb-8" initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }} transition={{ type: "spring", stiffness: 320, damping: 30 }} onClick={(e) => e.stopPropagation()}>
              <div className="mb-3 flex items-center justify-between">
                <p className="hub-h3">Kisan Hub</p>
                <button onClick={() => setMore(false)} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-xl text-white hover:bg-white/10"><X className="h-5 w-5" aria-hidden /></button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {HUB_NAV.map((n) => (
                  <Link key={n.to} to={n.to} className={`flex min-h-[52px] items-center gap-2 rounded-xl border px-3 text-sm font-semibold ${active(n.to) ? "border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan" : "border-white/10 bg-white/5 text-slate-200"}`}>
                    <n.icon className="h-5 w-5 shrink-0" aria-hidden />{n.label}
                  </Link>
                ))}
              </div>
              <div className="mt-4"><UserCard /></div>
              <Link to="/" className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-400"><ArrowLeft className="h-3.5 w-3.5" aria-hidden />Patra Lens website</Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
