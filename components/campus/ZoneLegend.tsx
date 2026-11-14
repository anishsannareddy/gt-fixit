import { AREAS, AREA_META, type Zone } from "@/lib/campus/areas";
import { cn } from "@/components/ui/cn";

/** Legend for the zone view. Colour is always paired with the area name. */
export function ZoneLegend({ counts, className }: { counts?: Partial<Record<Zone, number>>; className?: string }) {
  const rows: Zone[] = [...AREAS, "non_gt"];
  return (
    <div className={cn("glass-strong rounded-2xl p-3 shadow-panel", className)}>
      <h3 className="mb-2 text-[0.65rem] font-semibold tracking-[0.18em] text-white/55 uppercase">Maintenance areas</h3>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-1">
        {rows.map((z) => (
          <li key={z} className="flex items-center gap-2 text-xs text-white/85">
            <span className="size-3 shrink-0 rounded-sm ring-1 ring-white/25" style={{ background: AREA_META[z].color }} aria-hidden="true" />
            <span>{AREA_META[z].label}</span>
            {counts && <span className="ml-auto pl-2 font-mono text-[0.7rem] text-white/45 tabular-nums">{counts[z] ?? 0}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
