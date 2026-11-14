"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART } from "./theme";
import { ChartTooltip } from "./ChartTooltip";

type Point = { label: string; submitted: number; resolved: number };

/** Submitted vs resolved over time. Two series → legend + different dash so color isn't the only cue. */
export function TrendChart({ data }: { data: Point[] }) {
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-4 text-xs text-slate-700" aria-hidden="true">
        <span className="flex items-center gap-1.5">
          <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke={CHART.navy} strokeWidth="2.5" /></svg>
          Submitted
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke={CHART.gold} strokeWidth="2.5" strokeDasharray="5 3" /></svg>
          Resolved
        </span>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: CHART.axis }} tickLine={false} axisLine={{ stroke: CHART.grid }} minTickGap={24} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: CHART.axis }} tickLine={false} axisLine={false} />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: CHART.axis, strokeWidth: 1 }} />
            <Line type="monotone" dataKey="submitted" name="Submitted" stroke={CHART.navy} strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }} />
            <Line type="monotone" dataKey="resolved" name="Resolved" stroke={CHART.gold} strokeWidth={2} strokeDasharray="6 4" dot={false} activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
