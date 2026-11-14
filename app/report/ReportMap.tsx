"use client";

import { useMemo, useState } from "react";
import { BuildingSearch } from "@/components/campus/BuildingSearch";
import { CampusCanvas } from "@/components/campus/CampusCanvas";
import { AreaBadge } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useIsDesktop } from "@/components/ui/useMediaQuery";
import { AREA_META } from "@/lib/campus/areas";
import type { Building } from "@/lib/types";
import { REPORT_FORM_ID, ReportForm } from "./ReportForm";

/** Student home: the 3D campus as a building picker. Pick a building (tap it or search) to open the report form. */
export function ReportMap({ buildings }: { buildings: Building[] }) {
  const [selected, setSelected] = useState<Building | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const desktop = useIsDesktop();
  const byOsmId = useMemo(() => new Map(buildings.filter((b) => b.osm_id).map((b) => [b.osm_id!, b])), [buildings]);

  function choose(b: Building | null) {
    setBusy(null);
    setSelected(b);
  }

  return (
    <div className="relative flex-1">
      <div className="fixed inset-0">
        <CampusCanvas
          mode="select"
          view="brand"
          selected={selected?.osm_id ?? null}
          onSelect={(info) => {
            const b = byOsmId.get(info.id);
            if (b) choose(b);
          }}
          panel={selected ? (desktop ? "right" : "bottom") : "none"}
          fallback={
            <div className="grid h-full place-items-center p-6 text-center">
              <p className="max-w-xs text-sm text-white/60">The 3D map isn&apos;t available on this device. Use the search box above to pick a building.</p>
            </div>
          }
        />
      </div>

      <div className="pointer-events-none relative z-10 mx-auto max-w-xl px-4 pt-4">
        <BuildingSearch buildings={buildings} onPick={choose} className="pointer-events-auto" />
        {!selected && (
          <p className="mt-3 text-center text-sm font-medium text-white/70 [text-shadow:0_1px_8px_rgb(0_17_31)]">
            Tap a highlighted building to report a problem there
          </p>
        )}
      </div>

      <Sheet
        open={selected !== null}
        onClose={() => choose(null)}
        eyebrow="Report an issue"
        title={selected?.name ?? ""}
        footer={
          <button type="submit" form={REPORT_FORM_ID} disabled={busy !== null} className={buttonClass({ variant: "gold", size: "lg", full: true })}>
            {busy ?? "Submit request"}
          </button>
        }
      >
        {selected && (
          <>
            <div className="mb-5 flex flex-wrap items-center gap-2 text-xs text-white/60">
              <AreaBadge area={selected.area} />
              {selected.number && <span>Building #{selected.number}</span>}
              <span>Goes to the {AREA_META[selected.area].label} maintenance team</span>
            </div>
            {/* key = start a fresh form when a different building is picked */}
            <ReportForm key={selected.id} building={selected} onBusy={setBusy} />
          </>
        )}
      </Sheet>
    </div>
  );
}
