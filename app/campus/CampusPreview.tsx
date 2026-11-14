"use client";

import { useState } from "react";
import { CampusCanvas } from "@/components/campus/CampusCanvas";
import type { CampusView } from "@/components/campus/RealCampusScene";
import { ZoneLegend } from "@/components/campus/ZoneLegend";
import { cn } from "@/components/ui/cn";
import type { Zone } from "@/lib/campus/areas";

const VIEWS: { value: CampusView; label: string }[] = [
  { value: "zone", label: "Areas" },
  { value: "brand", label: "Plain" },
];

export function CampusPreview({ counts, gtCount }: { counts: Partial<Record<Zone, number>>; gtCount: number }) {
  const [view, setView] = useState<CampusView>("zone");

  return (
    <div className="relative flex-1">
      <div className="fixed inset-0">
        <CampusCanvas mode="select" view={view} />
      </div>

      <div className="pointer-events-none relative z-10 flex flex-col gap-3 p-4 md:p-6">
        <div className="pointer-events-auto max-w-sm">
          <p className="text-xs font-semibold tracking-[0.2em] text-gt-gold uppercase">Campus map</p>
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">{gtCount} GT buildings</h1>
          <p className="mt-1 text-sm text-white/65">Drag to rotate, pinch or scroll to zoom. Surrounding city buildings are dimmed.</p>
        </div>

        <div className="pointer-events-auto flex w-fit gap-1 rounded-2xl border border-white/10 bg-navy-950/70 p-1 backdrop-blur" role="group" aria-label="Colour buildings by">
          {VIEWS.map((v) => (
            <button
              key={v.value}
              type="button"
              aria-pressed={view === v.value}
              onClick={() => setView(v.value)}
              className={cn(
                "min-h-10 rounded-xl px-4 text-sm font-semibold transition",
                view === v.value ? "bg-gt-gold text-navy-950" : "text-white/70 hover:text-white",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>

        {view === "zone" && <ZoneLegend counts={counts} className="pointer-events-auto w-full max-w-64" />}
      </div>
    </div>
  );
}
