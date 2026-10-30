// Add a visit: camera with ghost overlay -> Photo Coach -> compare with the last photo -> result sheet.
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import CompareResultView, { ComparingAnimation } from "../components/CompareResultView";
import { AcceptedPhoto, PhotoFlow } from "../components/PhotoFlow";
import { BottomSheet, Button, Skeleton, useToast } from "../components/ui";
import { Visit, db, useBlobUrl, useLive } from "../lib/db";
import { useI18n } from "../lib/i18n";
import type { CompareResult } from "../lib/vision/compare";
import { plantVisits, saveVisit } from "../lib/watch";

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export default function AddVisit() {
  const { plantId = "" } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { t } = useI18n();
  const plant = useLive(async () => (await db.plants.get(plantId)) ?? null, [plantId]);
  const visits = useLive(() => plantVisits(plantId), [plantId]);
  const [date, setDate] = useState(today());
  const [working, setWorking] = useState<{ url: string; note?: string } | null>(null);
  const [done, setDone] = useState<{ visit: Visit; older: Visit; data: { result: CompareResult; lowerAccuracy: boolean } } | null>(null);
  const last = visits?.[visits.length - 1];
  const ghost = useBlobUrl(last?.photo);
  const lastThumb = useBlobUrl(last?.thumb);

  if (plant === null) return <div className="wrap py-10"><p>This plant was not found.</p><Button to="/watch" className="mt-3">Back to Leaf Watch</Button></div>;
  if (!plant || !visits) return <div className="wrap py-10"><Skeleton className="h-64" /></div>;

  const onAccepted = async (a: AcceptedPhoto) => {
    const isoDate = date === today() ? new Date().toISOString() : new Date(`${date}T12:00:00`).toISOString();
    const first = visits.length && !(window as any).cv?.Mat;
    setWorking({ url: a.url, note: first ? "Getting the comparison engine ready…" : undefined });
    try {
      const r = await saveVisit({ plantId, date: isoDate, photo: a.photo, work: a.work, coach: a.coach, usedAnyway: a.usedAnyway });
      if (r.older && r.result) setDone({ visit: r.visit, older: r.older, data: { result: r.result, lowerAccuracy: r.lowerAccuracy } });
      else { toast("First photo saved. New spots can be found from the next visit."); nav(`/watch/${plantId}`); }
    } catch (e) {
      console.warn(e);
      toast("This visit could not be saved. Please try again.");
    } finally { setWorking(null); }
  };

  return (
    <div className="wrap max-w-3xl py-8 md:py-12">
      <h1 className="page-title">Add a visit</h1>
      <p className="small mt-1">{plant.name}</p>
      {working ? <ComparingAnimation older={lastThumb} newer={working.url} note={working.note} /> : (
        <div className="mt-5 space-y-4">
          <PhotoFlow hint={last ? "Match the outline, then take the photo." : t("scan.fillFrame")} ghostUrl={ghost} onAccepted={onAccepted} />
          <label className="block max-w-xs"><span className="field-label">Visit date</span>
            <input type="date" max={today()} className="field-input" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
      )}
      <BottomSheet open={!!done} onClose={() => nav(`/watch/${plantId}`)} title="Compare result">
        {done && <CompareResultView older={done.older} newer={done.visit} plantName={plant.name} synthetic={plant.synthetic} initial={done.data} onChecked={() => nav(`/watch/${plantId}`)} />}
      </BottomSheet>
    </div>
  );
}
