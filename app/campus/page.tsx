import type { Metadata } from "next";
import { AREAS, type Zone } from "@/lib/campus/areas";
import { campusBuildings } from "@/lib/campus/zones";
import { CampusPreview } from "./CampusPreview";

export const metadata: Metadata = { title: "Campus map" };

/** Standalone campus map: explore the 3D campus and check the maintenance-area colours. */
export default function CampusPage() {
  // Counted on the server so the big campus data file isn't shipped with this page's own code.
  const counts: Partial<Record<Zone, number>> = {};
  for (const b of campusBuildings) if (b.zone) counts[b.zone] = (counts[b.zone] ?? 0) + 1;
  const gt = AREAS.reduce((n, a) => n + (counts[a] ?? 0), 0);
  return <CampusPreview counts={counts} gtCount={gt} />;
}
