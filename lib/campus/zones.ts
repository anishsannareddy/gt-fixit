import campusJson from "@/data/campus.json";
import overridesJson from "@/data/zone-overrides.json";
import zonesJson from "@/data/zones.json";
import { isArea, type Area, type Zone } from "./areas";
import type { CampusData, RawBuilding } from "./geometry";

/** Hand corrections in data/zone-overrides.json. `area: null` means "not a GT building". */
type Override = { area?: Zone | null; name?: string; number?: string };

export type CampusBuildingInfo = RawBuilding & {
  /** Maintenance area, "non_gt", or null for surrounding city buildings. */
  zone: Zone | null;
  /** GT building number, when known. */
  number: string | null;
};

const campus = campusJson as unknown as CampusData;
const zones = (zonesJson as unknown as { zones: Record<string, { area: Zone; conf: number }> }).zones;
const overrides = overridesJson as unknown as Record<string, Override>;

/** Every building in data/campus.json with its maintenance area applied (overrides win). Same order as the JSON. */
export const campusBuildings: CampusBuildingInfo[] = campus.buildings.map((b) => {
  const o = overrides[b.id];
  const zone = o && "area" in o ? (o.area ?? null) : (zones[b.id]?.area ?? null);
  return { ...b, name: o?.name ?? b.name, zone, number: o?.number ?? b.ref ?? null };
});

export const campusRoads = campus.roads;

/** Is this a reportable GT building (in one of the maintenance areas)? */
export function isGT(b: CampusBuildingInfo): b is CampusBuildingInfo & { zone: Area } {
  return isArea(b.zone);
}

/** Name to show for a building; unnamed GT buildings get a readable placeholder. */
export function displayName(b: CampusBuildingInfo): string {
  return b.name ?? "Unnamed building";
}
