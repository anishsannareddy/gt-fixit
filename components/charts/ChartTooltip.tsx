"use client";

type Item = { name?: string | number; value?: number | string; color?: string; dataKey?: string | number; payload?: Record<string, unknown> };

/** Shared tooltip: label on top, one row per series with a color swatch beside (not on) the text. */
export function ChartTooltip({
  active,
  payload,
  label,
  format = (v) => String(v),
  labelKey,
}: {
  active?: boolean;
  payload?: Item[];
  label?: string | number;
  format?: (v: number) => string;
  labelKey?: string;
}) {
  if (!active || !payload?.length) return null;
  const title = labelKey ? String(payload[0]?.payload?.[labelKey] ?? label) : label;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-semibold text-slate-900">{title}</div>
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center gap-2 text-slate-700">
          <span className="size-2.5 rounded-sm" style={{ background: p.color }} aria-hidden="true" />
          <span>{p.name}</span>
          <span className="ml-auto pl-3 font-semibold text-slate-900 tabular-nums">{format(Number(p.value))}</span>
        </div>
      ))}
    </div>
  );
}
