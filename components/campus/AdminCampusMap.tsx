"use client";

import { useState } from "react";
import { cn } from "@/components/ui/cn";
import { CampusCanvas } from "./CampusCanvas";
import type { CampusView } from "./RealCampusScene";
import { ZoneLegend } from "./ZoneLegend";

const VIEWS: { value: CampusView; label: string }[] = [
  { value: "heat", label: "Open requests" },
  { value: "zone", label: "Areas" },
];

/**
 * Campus map for admins. Toggle between a heat view (buildings coloured by how many open
 * requests they have) and the maintenance-area view. Hover or tap a building for its name and count.
 */
export function AdminCampusMap({ counts, maxCount }: { /** Open requests per OSM building id. */ counts: Record<string, number>; maxCount: number }) {
  const [view, setView] = useState<CampusView>("heat");
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <section className="relative h-[26rem] overflow-hidden rounded-3xl border border-white/10 bg-navy-950 md:h-[32rem]" aria-label="Campus map">
      <CampusCanvas
        mode="heat"
        view={view}
        counts={counts}
        selected={selected}
        onSelect={(b) => setSelected((cur) => (cur === b.id ? null : b.id))}
        fallback={<p className="grid h-full place-items-center p-6 text-center text-sm text-white/60">The 3D map isn&apos;t available on this device.</p>}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-3 p-3">
        <div className="pointer-events-auto flex gap-1 rounded-2xl border border-white/10 bg-navy-950/75 p-1 backdrop-blur" role="group" aria-label="Colour buildings by">
          {VIEWS.map((v) => (
            <button
              key={v.value}
              type="button"
              aria-pressed={view === v.value}
              onClick={() => setView(v.value)}
              className={cn("min-h-10 rounded-xl px-3.5 text-sm font-semibold transition", view === v.value ? "bg-gt-gold text-navy-950" : "text-white/70 hover:text-white")}
            >
              {v.label}
            </button>
          ))}
        </div>

        {view === "zone" ? (
          <ZoneLegend className="pointer-events-auto hidden w-44 sm:block" />
        ) : (
          <div className="glass-strong pointer-events-auto rounded-2xl p-3 shadow-panel">
            <h3 className="mb-2 text-[0.65rem] font-semibold tracking-[0.18em] text-white/55 uppercase">Open requests per building</h3>
            <div className="h-2.5 w-44 rounded-full bg-[linear-gradient(90deg,#1f5688,#f2d16b)]" aria-hidden="true" />
            <div className="mt-1 flex justify-between font-mono text-[0.7rem] text-white/60">
              <span>0</span>
              <span>{maxCount}</span>
            </div>
          </div>
        )}
      </div>
      {view === "zone" && <ZoneLegend className="absolute inset-x-3 bottom-8 sm:hidden" />}
    </section>
  );
}
