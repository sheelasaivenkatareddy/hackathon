// Neighbourhood Disease Radar. Consent first; only a rounded 1 km cell is stored.
import { AnimatePresence, motion } from "framer-motion";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Rectangle, TileLayer, Tooltip } from "react-leaflet";
import { Card, Chip, SampleChip, Skeleton, Toggle, useToast } from "../components/ui";
import { CONFIG } from "../config";
import { getSetting, setSetting } from "../lib/db";
import { useI18n } from "../lib/i18n";
import { Report, area, cellBounds, cellCentre, cellId, displayCount, unusualRises, weeksAgo } from "../lib/radar";
import { loadReports } from "../lib/weather";

const sweepIcon = L.divIcon({ className: "", html: '<div class="radar-sweep"></div>', iconSize: [0, 0] });
const shade = (n: number) => (n >= 5 ? "#E11D48" : n >= 3 ? "#D97706" : "#FBBF24");
const WEEKS = ["This week", "1 week ago", "2 weeks ago", "3 weeks ago"];

export default function Radar() {
  const { t, disease } = useI18n();
  const toast = useToast();
  const [consent, setConsent] = useState(false);
  const [myCell, setMyCell] = useState<string | null>(null);
  const [showSample, setShowSample] = useState(true);
  const [reports, setReports] = useState<Report[] | null>(null);
  const [filterDisease, setFilterDisease] = useState("all");
  const [week, setWeek] = useState(0);

  useEffect(() => {
    (async () => {
      setConsent(await getSetting("radarConsent", false));
      setMyCell(await getSetting<string | null>("radarCell", null));
      setShowSample(await getSetting("radarShowSample", true));
    })();
  }, []);
  useEffect(() => { loadReports(showSample).then(setReports); }, [showSample]);

  const onConsent = (on: boolean) => {
    if (!on) {
      setConsent(false); setMyCell(null);
      setSetting("radarConsent", false); setSetting("radarCell", null);
      return;
    }
    if (!navigator.geolocation) { toast("Location is not available on this device."); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        // Rounded immediately. The coordinates are not kept anywhere.
        const cell = cellId(p.coords.latitude, p.coords.longitude);
        setConsent(true); setMyCell(cell);
        setSetting("radarConsent", true); setSetting("radarCell", cell);
      },
      () => toast("Location was not shared, so the setting stays off."),
      { enableHighAccuracy: false, timeout: 15000 },
    );
  };

  const onSample = (on: boolean) => { setShowSample(on); setSetting("radarShowSample", on); };

  const rises = useMemo(() => (reports ? unusualRises(reports) : []), [reports]);
  const alertCells = useMemo(() => new Set(rises.flatMap((r) => area(r.centreCell))), [rises]);
  const diseases = useMemo(() => [...new Set((reports ?? []).map((r) => r.disease))].sort(), [reports]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of reports ?? []) {
      if (r.confirmed && weeksAgo(r) === week && (filterDisease === "all" || r.disease === filterDisease)) m.set(r.cell, (m.get(r.cell) ?? 0) + 1);
    }
    return m;
  }, [reports, week, filterDisease]);
  const label = (n: number) => { const d = displayCount(n); return typeof d === "number" ? `${d} reports` : t("radar.fewReports"); };

  const centre: [number, number] = myCell ? cellCentre(myCell) : CONFIG.radar.defaultCentre;
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="wrap py-8 md:py-12">
      <h1 className="page-title">Neighbourhood Disease Radar</h1>

      <AnimatePresence>
        {rises.map((r) => (
          <motion.div key={r.disease} initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} transition={{ type: "spring", stiffness: 260, damping: 22 }} role="alert" data-testid="rise-banner"
            className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-tomato-tint px-4 py-3 font-semibold text-tomato-dark">
            <TriangleAlert className="h-5 w-5 shrink-0" aria-hidden />
            <span className="flex-1">{t("radar.unusualRise", { disease: disease(r.disease) })} <span className="font-normal">({r.thisWeek} this week, weekly average before was {r.previousWeeklyAverage})</span></span>
            {showSample && <SampleChip />}
          </motion.div>
        ))}
      </AnimatePresence>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="relative isolate h-[420px] overflow-hidden rounded-card border border-line md:h-[560px]">
          <MapContainer key={myCell ?? "default"} center={centre} zoom={13} className="h-full w-full" scrollWheelZoom={false}>
            <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
            <Marker position={centre} icon={sweepIcon} interactive={false} keyboard={false} />
            {[...alertCells].map((c) => (
              <Rectangle key={`alert-${c}`} bounds={cellBounds(c)} pathOptions={{ color: "#E11D48", weight: 1, fillColor: "#E11D48", fillOpacity: 0.2, className: "cell-pulse" }} />
            ))}
            {[...counts.entries()].map(([c, n]) => (
              <Rectangle key={`${c}-${n}`} bounds={cellBounds(c)} pathOptions={{ color: "#0B2B33", weight: 1, fillColor: shade(n), fillOpacity: 0.55 }}>
                <Tooltip>{label(n)}</Tooltip>
              </Rectangle>
            ))}
          </MapContainer>
        </div>

        <div className="space-y-5">
          <Card className="!bg-white">
            <Toggle checked={consent} onChange={onConsent} label={t("radar.consent")} hint="Off by default. If on, we ask for your location once, round it to a 1 km area and store only that area. Exact coordinates are never stored, sent or shown." />
            {consent && <Chip tone="green" className="mt-2">Approximate area shared</Chip>}
            <div className="mt-3 border-t border-line pt-3">
              <Toggle checked={showSample} onChange={onSample} label="Show sample data" hint="Made-up reports for the demo. These are not real farm reports." />
              {showSample && <div className="mt-1"><SampleChip /></div>}
            </div>
          </Card>
          <Card className="!bg-white space-y-3">
            <label className="block"><span className="field-label">Disease</span>
              <select className="field-input" value={filterDisease} onChange={(e) => setFilterDisease(e.target.value)}>
                <option value="all">All diseases</option>
                {diseases.map((d) => <option key={d} value={d}>{disease(d)}</option>)}
              </select>
            </label>
            <label className="block"><span className="field-label">Week</span>
              <select className="field-input" value={week} onChange={(e) => setWeek(Number(e.target.value))}>
                {WEEKS.map((w, i) => <option key={w} value={i}>{w}</option>)}
              </select>
            </label>
          </Card>
          <Card className="!bg-white">
            <h2 className="h3">Confirmed reports by area</h2>
            {!reports && <Skeleton className="mt-2 h-20" />}
            {reports && !sorted.length && <p className="small mt-2">No confirmed reports for this choice.</p>}
            <ul className="mt-2 space-y-1 text-sm" data-testid="cell-list">
              {sorted.map(([c, n]) => (
                <li key={c} className="flex items-center justify-between gap-3 border-t border-line pt-1">
                  <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm" style={{ background: shade(n) }} aria-hidden />Area {c.replace("_", "-")}</span>
                  <strong className="text-forest">{label(n)}</strong>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
