// Affected % by date. Loaded lazily because Recharts is large.
import { CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Treatment, Visit } from "../../lib/db";
import { fmtShort, isNewDamage } from "../../lib/watch";

/** Straight line through the last 3 points: a drawing aid, not a forecast. */
function trendLine(points: { t: number; y: number }[]) {
  const last = points.slice(-3);
  if (last.length < 2) return new Map<number, number>();
  const mx = last.reduce((s, p) => s + p.t, 0) / last.length, my = last.reduce((s, p) => s + p.y, 0) / last.length;
  const den = last.reduce((s, p) => s + (p.t - mx) ** 2, 0) || 1;
  const slope = last.reduce((s, p) => s + (p.t - mx) * (p.y - my), 0) / den;
  return new Map(last.map((p) => [p.t, Math.max(0, Math.round((my + slope * (p.t - mx)) * 100) / 100)]));
}

export default function TrendChart({ visits, treatments }: { visits: Visit[]; treatments: Treatment[] }) {
  const base = visits.map((v) => ({ t: new Date(v.date).getTime(), y: v.affectedPct, alert: isNewDamage(v.compare?.status) }));
  const trend = trendLine(base);
  const data = base.map((p) => ({ ...p, trend: trend.get(p.t) ?? null }));
  const start = treatments.map((t) => new Date(t.date).getTime()).sort((a, b) => a - b)[0];
  const lastT = base.length ? base[base.length - 1].t : 0;
  return (
    <div>
      <div className="h-64 w-full" role="img" aria-label={`Chart of affected area by date. Latest value ${base.length ? base[base.length - 1].y : 0} percent.`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="#E6DFD1" strokeDasharray="3 3" />
            <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={(t) => fmtShort(new Date(t))} tick={{ fontSize: 12, fill: "#55625B" }} />
            <YAxis width={52} tick={{ fontSize: 12, fill: "#55625B" }} unit="%" />
            <Tooltip labelFormatter={(t) => fmtShort(new Date(t as number))} formatter={(v, n) => [`${v}%`, n === "y" ? "Affected" : "Trend line"]} />
            {start !== undefined && start < lastT && <ReferenceArea x1={Math.max(start, base[0]?.t ?? start)} x2={lastT} fill="#D9F2E6" fillOpacity={0.8} label={{ value: "Recovery window", position: "insideTop", fontSize: 12, fill: "#065F46" }} />}
            {start !== undefined && <ReferenceLine x={start} stroke="#047857" strokeDasharray="2 2" />}
            <Line dataKey="y" stroke="#047857" strokeWidth={3} isAnimationActive animationDuration={900} dot={(p: any) => (
              <circle key={p.payload.t} cx={p.cx} cy={p.cy} r={p.payload.alert ? 6 : 4} fill={p.payload.alert ? "#B94A2C" : "#047857"} stroke="#fff" strokeWidth={1.5} />
            )} />
            <Line dataKey="trend" stroke="#55625B" strokeWidth={2} strokeDasharray="6 5" dot={false} connectNulls={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-tomato" />New damage at this visit</span>
        {data.length >= 2 && <span>– – Trend line, not a forecast</span>}
      </div>
    </div>
  );
}
