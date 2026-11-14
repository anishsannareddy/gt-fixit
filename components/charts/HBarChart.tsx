"use client";

import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CHART } from "./theme";
import { ChartTooltip } from "./ChartTooltip";

type Row = { label: string; value: number; full?: string };

/** Single-series horizontal bars (no legend needed — the card title names the measure). */
export function HBarChart({
  data,
  seriesName,
  format = (v: number) => v.toLocaleString(),
}: {
  data: Row[];
  seriesName: string;
  format?: (v: number) => string;
}) {
  const height = Math.max(160, data.length * 30 + 16);
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 48, bottom: 0, left: 0 }} barCategoryGap={6}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="label"
            width={128}
            tick={{ fontSize: 12, fill: CHART.inkMuted }}
            tickLine={false}
            axisLine={false}
            interval={0}
          />
          <Tooltip
            cursor={{ fill: "rgba(0,48,87,0.06)" }}
            content={<ChartTooltip format={format} labelKey={data.some((d) => d.full) ? "full" : undefined} />}
          />
          <Bar dataKey="value" name={seriesName} fill={CHART.navy} radius={[0, 4, 4, 0]} maxBarSize={20}>
            <LabelList dataKey="value" position="right" formatter={(v) => format(Number(v))} style={{ fontSize: 12, fill: CHART.ink, fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
