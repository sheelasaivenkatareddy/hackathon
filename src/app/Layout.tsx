// Top bar (desktop), bottom bar with raised Scan button (mobile), More sheet, language sheet, footer.
import { motion, useScroll } from "framer-motion";
import { CloudSun, Globe, Home, Info, Menu, RadioTower, ScanLine, Settings, Sprout, UserCheck } from "lucide-react";
import { ReactNode, useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { BottomSheet, Button } from "../components/ui";
import { db, getSetting } from "../lib/db";
import { LANGS, useI18n } from "../lib/i18n";
import { daysUntil, nextCheckDate, plantVisits } from "../lib/watch";
import { scoutEveryDays } from "../lib/weather";

const ITEMS = [
  { to: "/", key: "nav.home", icon: Home },
  { to: "/watch", key: "nav.watch", icon: Sprout },
  { to: "/scan", key: "nav.scan", icon: ScanLine },
  { to: "/risk", key: "nav.risk", icon: CloudSun },
  { to: "/radar", key: "nav.radar", icon: RadioTower },
];
const MORE = [
  { to: "/expert", label: "Expert", icon: UserCheck },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/about", label: "About", icon: Info },
];

export const LanguageSwitch = ({ light }: { light?: boolean }) => {
  const { lang, setLang } = useI18n();
  return (
    <div className="flex items-center" role="group" aria-label="Language">
      {LANGS.map((l, i) => (
        <span key={l.id} className="flex items-center">
          {i > 0 && <span aria-hidden className={light ? "text-white/50" : "text-muted"}>·</span>}
          <button onClick={() => setLang(l.id)} aria-pressed={lang === l.id} className={`min-h-[44px] rounded-full px-2 text-sm font-semibold ${lang === l.id ? (light ? "text-lime" : "text-green-dark underline underline-offset-4") : light ? "text-white/80 hover:text-white" : "text-muted hover:text-forest"}`}>{l.label}</button>
        </span>
      ))}
    </div>
  );
};

export default function Layout({ children }: { children: ReactNode }) {
  const { t, sheetOpen, setSheetOpen } = useI18n();
  const [moreOpen, setMoreOpen] = useState(false);
  const { pathname } = useLocation();
  const { scrollYProgress } = useScroll();
  const isActive = (to: string) => (to === "/" ? pathname === "/" : pathname.startsWith(to));
  useEffect(() => setMoreOpen(false), [pathname]);

  // "Remind me": shows a notification when the app opens on a due day. Permission is only asked when tapped.
  useEffect(() => {
    (async () => {
      if (!(await getSetting("remind", false)) || !("Notification" in window) || Notification.permission !== "granted") return;
      const today = new Date().toDateString();
      if ((await getSetting("remindedOn", "")) === today) return;
      const fields = await db.fields.toArray();
      for (const f of fields) {
        const every = await scoutEveryDays(f);
        for (const p of await db.plants.where("fieldId").equals(f.id).toArray()) {
          const vs = await plantVisits(p.id);
          const last = vs[vs.length - 1];
          if (last && daysUntil(nextCheckDate(last.date, every)) <= 0) {
            new Notification("Patra Lens: check sentinel plants", { body: `${f.name} has plants due today.`, icon: "/logo.svg" });
            await db.settings.put({ key: "remindedOn", value: today });
            return;
          }
        }
      }
    })().catch(() => undefined);
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-3">Skip to content</a>
      <motion.div aria-hidden className="fixed inset-x-0 top-0 z-[600] h-1 origin-left bg-gradient-to-r from-lime to-leaf" style={{ scaleX: scrollYProgress }} />
      <header className="sticky top-0 z-[500] border-b border-line bg-white/95 backdrop-blur">
        <div className="wrap flex h-14 items-center justify-between gap-3 md:h-16">
          <Link to="/" className="flex min-h-[44px] items-center gap-2 font-heading text-lg font-extrabold text-forest">
            <img src="/logo.svg" alt="" className="h-8 w-8" />Patra Lens
          </Link>
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
            {ITEMS.map((it) => (
              <NavLink key={it.to} to={it.to} end={it.to === "/"} className={`relative flex min-h-[44px] items-center rounded-full px-4 text-[15px] font-semibold ${isActive(it.to) ? "text-forest" : "text-muted hover:text-forest"}`}>
                {isActive(it.to) && <motion.span layoutId="tab-pill" className="absolute inset-0 rounded-full bg-green-tint" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
                <span className="relative">{t(it.key)}</span>
              </NavLink>
            ))}
            <button onClick={() => setMoreOpen(true)} className="flex min-h-[44px] items-center rounded-full px-4 text-[15px] font-semibold text-muted hover:text-forest">More</button>
          </nav>
          <div className="hidden items-center gap-3 lg:flex">
            <LanguageSwitch />
            <Button to="/watch" className="!text-[15px]">Start Leaf Watch</Button>
          </div>
          <button onClick={() => setMoreOpen(true)} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface lg:hidden" aria-label="More"><Menu className="h-6 w-6 text-forest" aria-hidden /></button>
        </div>
      </header>

      <main id="main" className="flex-1 pb-24 lg:pb-0">{children}</main>

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-[500] border-t border-line bg-white lg:hidden" aria-label="Main">
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {ITEMS.map((it) => {
            const active = isActive(it.to), Icon = it.icon;
            if (it.to === "/scan") {
              return (
                <li key={it.to} className="flex justify-center">
                  <NavLink to={it.to} className="flex flex-col items-center">
                    <span className={`scan-glow -mt-6 flex h-14 w-14 items-center justify-center rounded-full ${active ? "bg-forest" : "bg-green"} text-white`}><Icon className="h-7 w-7" aria-hidden /></span>
                    <span className={`pb-1 text-xs font-semibold ${active ? "text-forest" : "text-muted"}`}>{t(it.key)}</span>
                  </NavLink>
                </li>
              );
            }
            return (
              <li key={it.to}>
                <NavLink to={it.to} end={it.to === "/"} className={`relative flex h-16 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${active ? "text-forest" : "text-muted"}`}>
                  {active && <motion.span layoutId="tab-pill-mobile" className="absolute top-1.5 h-7 w-12 rounded-full bg-green-tint" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
                  <Icon className="relative h-5 w-5" aria-hidden />
                  <span className="relative">{t(it.key)}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      <BottomSheet open={moreOpen} onClose={() => setMoreOpen(false)} title="More">
        <ul className="space-y-1">
          {MORE.map((m) => (
            <li key={m.to}><Link to={m.to} className="flex min-h-[48px] items-center gap-3 rounded-xl px-3 font-semibold text-forest hover:bg-surface"><m.icon className="h-5 w-5" aria-hidden />{m.label}</Link></li>
          ))}
        </ul>
        <div className="mt-3 flex items-center gap-3 border-t border-line pt-3 px-3">
          <Globe className="h-5 w-5 text-forest" aria-hidden /><LanguageSwitch />
        </div>
      </BottomSheet>

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Your language">
        <p className="small mb-2">English, Telugu and Kannada.</p>
        <LanguageSwitch />
      </BottomSheet>
    </div>
  );
}
