/**
 * GT Facilities maintenance areas, as shown on the "GT Facilities Maintenance Areas" map.
 * Kept free of data imports so small components (legend, badges, filters) can use it cheaply.
 */
export const AREAS = ["area1", "area2", "area3", "area4", "area5", "area6", "gtaa", "housing", "parking"] as const;
export type Area = (typeof AREAS)[number];
/** What the map can say about a building: a GT area, explicitly "Non-GT", or nothing (surrounding city). */
export type Zone = Area | "non_gt";

/**
 * `color` is for the dark 3D scene and UI: the same hue as the official map's legend,
 * lightened where the original (dark blue, dark purple) would vanish on navy.
 * `mapColor` is the exact legend colour sampled from the map image.
 * Colour alone can't separate nine areas for every viewer (orange vs green is hard with
 * red-green colour blindness), so the area NAME is always shown next to the colour.
 */
export const AREA_META: Record<Zone, { label: string; color: string; mapColor: string }> = {
  area1: { label: "Area 1", color: "#e87ad6", mapColor: "#ee7bda" },
  area2: { label: "Area 2", color: "#59c2f9", mapColor: "#59c2f9" },
  area3: { label: "Area 3", color: "#ee4b3c", mapColor: "#ea3323" },
  area4: { label: "Area 4", color: "#3f9a3a", mapColor: "#5aa630" },
  area5: { label: "Area 5", color: "#f3ae3d", mapColor: "#f3ae3d" },
  area6: { label: "Area 6", color: "#b6ff7a", mapColor: "#8afc4d" },
  gtaa: { label: "GTAA", color: "#4f86f0", mapColor: "#1e4ca2" },
  housing: { label: "Housing", color: "#f5ee5a", mapColor: "#ffff54" },
  parking: { label: "Parking", color: "#9b6fe0", mapColor: "#643f95" },
  non_gt: { label: "Non-GT", color: "#7d8794", mapColor: "#9c9c9c" },
};

export function isArea(value: unknown): value is Area {
  return typeof value === "string" && (AREAS as readonly string[]).includes(value);
}
