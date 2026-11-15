"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { cn } from "@/components/ui/cn";
import { CampusCanvas } from "./CampusCanvas";
import type { CampusView } from "./RealCampusScene";
import { ZoneLegend } from "./ZoneLegend";

const VIEWS: { value: CampusView; label: string }[] = [
  { value: "heat", label: "Open requests" },
  { value: "zone", label: "Areas" },
];

/**
 * Command Center map. Clicking a building filters the request list (?building=<id>);
 * clicking it again clears the filter. Toggle between open-request heat and maintenance areas.
 */
export function AdminCampusMap({
  counts,
  maxCount,
  buildings,
}: {
  /** Open requests per OSM building id. */
  counts: Record<string, number>;
  maxCount: number;
  /** Database id ↔ OSM id, so a click on the map can become a list filter. */
  buildings: { id: number; osm_id: string | null }[];
}) {
  const [view, setView] = useState<CampusView>("heat");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { idByOsm, osmById } = useMemo(
    () => ({
      idByOsm: new Map(buildings.filter((b) => b.osm_id).map((b) => [b.osm_id!, b.id])),
      osmById: new Map(buildings.filter((b) => b.osm_id).map((b) => [b.id, b.osm_id!])),
    }),
    [buildings],
  );
  const selectedId = Number(params.get("building")) || null;
  const selected = selectedId ? (osmById.get(selectedId) ?? null) : null;

  function filterTo(id: number | null) {
    const next = new URLSearchParams(params);
    if (id) next.set("building", String(id));
    else next.delete("building");
    next.delete("ticket");
    next.delete("page");
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <section className="relative h-[24rem] overflow-hidden rounded-3xl border border-line bg-[#eef3f8] md:h-[30rem]" aria-label="Campus map: click a building to filter the request list">
      <CampusCanvas
        mode="heat"
        view={view}
        counts={counts}
        selected={selected}
        onSelect={(b) => {
          const id = idByOsm.get(b.id) ?? null;
          filterTo(id === selectedId ? null : id);
        }}
        fallback={<p className="grid h-full place-items-center p-6 text-center text-sm text-ink-muted">The 3D map isn&apos;t available on this device. Use the Building filter below.</p>}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-3 p-3">
        <div className="pointer-events-auto flex gap-1 rounded-2xl border border-line bg-white/90 p-1 backdrop-blur" role="group" aria-label="Colour buildings by">
          {VIEWS.map((v) => (
            <button
              key={v.value}
              type="button"
              aria-pressed={view === v.value}
              onClick={() => setView(v.value)}
              className={cn("min-h-10 rounded-xl px-3.5 text-sm font-semibold transition", view === v.value ? "bg-gt-navy text-white" : "text-ink-muted hover:text-ink")}
            >
              {v.label}
            </button>
          ))}
        </div>

        {view === "zone" ? (
          <ZoneLegend className="pointer-events-auto hidden w-44 sm:block" />
        ) : (
          <div className="glass-strong pointer-events-auto rounded-2xl p-3 shadow-panel">
            <h3 className="mb-2 text-[0.65rem] font-semibold tracking-[0.18em] text-ink-muted uppercase">Open requests per building</h3>
            <div className="h-2.5 w-44 rounded-full bg-[linear-gradient(90deg,#1f5688,#f2d16b)]" aria-hidden="true" />
            <div className="mt-1 flex justify-between font-mono text-[0.7rem] text-ink-muted">
              <span>0</span>
              <span>{maxCount}</span>
            </div>
          </div>
        )}
      </div>
      <p className="pointer-events-none absolute bottom-2 left-3 rounded-full bg-white/85 px-3 py-1 text-xs font-medium text-ink-muted shadow-sm">
        {selected ? "Click the building again to clear the filter" : "Click a building to filter the list"}
      </p>
      {view === "zone" && <ZoneLegend className="absolute inset-x-3 bottom-10 sm:hidden" />}
    </section>
  );
}
