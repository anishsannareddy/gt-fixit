import { HEAT_BANDS, HEAT_META, type HeatBand } from "@/lib/campus/heat";
import { cn } from "@/components/ui/cn";

/** Legend for the heat view: band colour + label + range + how many buildings are in each band. */
export function HeatLegend({ counts, className }: { counts: Record<HeatBand, number>; className?: string }) {
  return (
    <div className={cn("glass-strong rounded-2xl p-3 shadow-panel", className)}>
      <h3 className="mb-2 text-[0.65rem] font-semibold tracking-[0.18em] text-ink-muted uppercase">Open requests per building</h3>
      <ul className="space-y-1.5">
        {HEAT_BANDS.map((band) => (
          <li key={band} className="flex items-center gap-2 text-xs">
            <span className="size-3 shrink-0 rounded-sm ring-1 ring-black/10" style={{ background: HEAT_META[band].color }} aria-hidden="true" />
            <span className="font-semibold">{HEAT_META[band].label}</span>
            <span className="text-ink-muted">{HEAT_META[band].range}</span>
            <span className="ml-auto pl-3 font-mono text-ink-muted tabular-nums">{counts[band]}</span>
          </li>
        ))}
      </ul>
      {counts.red > 0 && (
        <p className="mt-2 flex items-center gap-1.5 border-t border-line pt-2 text-[0.7rem] text-ink-muted">
          <span aria-hidden="true" className="font-bold" style={{ color: HEAT_META.red.color }}>◆</span> Hot spots also carry a pin
        </p>
      )}
    </div>
  );
}
