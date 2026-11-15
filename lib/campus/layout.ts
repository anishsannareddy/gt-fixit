import type { BuildingType } from "@/lib/types";

/**
 * Where each building sits on the 3D campus.
 *
 * ⚠️ Coordinates are APPROXIMATE (hand-entered, not surveyed). Neighborhoods are right
 * (east-campus dorms by North Ave, west-campus dorms by Curran St, Tech Square to the east…)
 * but a building can be off by a block. To nudge one, edit its lat/lng below.
 * Sizes are in metres: w = east–west, d = north–south, h = height.
 */
type Spot = { lat: number; lng: number; w?: number; d?: number; h?: number };

const SPOTS: Record<string, Spot & { type: BuildingType }> = {
  // ── East campus residence halls ──
  "Glenn Hall": { type: "residence", lat: 33.7733, lng: -84.3913, w: 70, d: 18, h: 16 },
  "Towers Hall": { type: "residence", lat: 33.7741, lng: -84.3912, w: 70, d: 18, h: 16 },
  "Smith Hall": { type: "residence", lat: 33.7717, lng: -84.3921, w: 22, d: 60, h: 15 },
  "Brown Hall": { type: "residence", lat: 33.7722, lng: -84.3927, w: 20, d: 44, h: 13 },
  "Harris Hall": { type: "residence", lat: 33.7727, lng: -84.3921, w: 44, d: 18, h: 13 },
  "Cloudman Hall": { type: "residence", lat: 33.7731, lng: -84.3927, w: 20, d: 44, h: 13 },
  "Howell Hall": { type: "residence", lat: 33.7737, lng: -84.3922, w: 44, d: 18, h: 13 },
  "Matheson Hall": { type: "residence", lat: 33.7762, lng: -84.3915, w: 50, d: 18, h: 13 },
  "Field Hall": { type: "residence", lat: 33.7768, lng: -84.3915, w: 50, d: 18, h: 13 },
  "North Avenue Apartments North": { type: "residence", lat: 33.7714, lng: -84.3908, w: 60, d: 20, h: 30 },
  "North Avenue Apartments East": { type: "residence", lat: 33.7708, lng: -84.3901, w: 22, d: 60, h: 34 },
  "North Avenue Apartments South": { type: "residence", lat: 33.7702, lng: -84.3909, w: 60, d: 20, h: 30 },
  "North Avenue Apartments West": { type: "residence", lat: 33.7708, lng: -84.3917, w: 22, d: 60, h: 34 },
  // ── West campus residence halls ──
  "Woodruff Hall North": { type: "residence", lat: 33.7792, lng: -84.4066, w: 26, d: 56, h: 26 },
  "Woodruff Hall South": { type: "residence", lat: 33.7785, lng: -84.4066, w: 26, d: 56, h: 26 },
  "Eighth Street Apartments": { type: "residence", lat: 33.7799, lng: -84.4040, w: 90, d: 30, h: 18 },
  "Fitten Hall": { type: "residence", lat: 33.7781, lng: -84.4039, w: 46, d: 16, h: 13 },
  "Freeman Hall": { type: "residence", lat: 33.7776, lng: -84.4039, w: 46, d: 16, h: 13 },
  "Montag Hall": { type: "residence", lat: 33.7776, lng: -84.4048, w: 46, d: 16, h: 13 },
  "Folk Hall": { type: "residence", lat: 33.7787, lng: -84.4053, w: 16, d: 46, h: 13 },
  "Caldwell Hall": { type: "residence", lat: 33.7787, lng: -84.4046, w: 16, d: 46, h: 13 },
  "Hefner Hall": { type: "residence", lat: 33.7793, lng: -84.4052, w: 46, d: 16, h: 13 },
  "Armstrong Hall": { type: "residence", lat: 33.7793, lng: -84.4044, w: 46, d: 16, h: 13 },
  "Graduate Living Center": { type: "residence", lat: 33.7811, lng: -84.3992, w: 80, d: 34, h: 22 },
  // ── Academic & research ──
  "Clough Undergraduate Learning Commons": { type: "academic", lat: 33.7746, lng: -84.3964, w: 90, d: 60, h: 20 },
  "Price Gilbert Memorial Library": { type: "academic", lat: 33.7742, lng: -84.3956, w: 60, d: 46, h: 22 },
  "Crosland Tower": { type: "academic", lat: 33.7740, lng: -84.3949, w: 34, d: 34, h: 44 },
  "Skiles Classroom Building": { type: "academic", lat: 33.7736, lng: -84.3960, w: 90, d: 22, h: 18 },
  "Klaus Advanced Computing Building": { type: "academic", lat: 33.7772, lng: -84.3961, w: 100, d: 50, h: 22 },
  "College of Computing Building": { type: "academic", lat: 33.7774, lng: -84.3974, w: 60, d: 46, h: 18 },
  "Howey Physics Building": { type: "academic", lat: 33.7775, lng: -84.3987, w: 80, d: 50, h: 18 },
  "Van Leer Building": { type: "academic", lat: 33.7760, lng: -84.3971, w: 70, d: 60, h: 22 },
  "Mason Building": { type: "academic", lat: 33.7767, lng: -84.3988, w: 60, d: 30, h: 20 },
  "Boggs Building": { type: "academic", lat: 33.7758, lng: -84.3999, w: 70, d: 36, h: 18 },
  "Instructional Center": { type: "academic", lat: 33.7755, lng: -84.4013, w: 60, d: 44, h: 14 },
  "Kendeda Building": { type: "academic", lat: 33.7786, lng: -84.3996, w: 60, d: 40, h: 14 },
  "Molecular Science and Engineering Building": { type: "academic", lat: 33.7797, lng: -84.3966, w: 90, d: 46, h: 24 },
  "Engineered Biosystems Building": { type: "academic", lat: 33.7807, lng: -84.3979, w: 110, d: 40, h: 26 },
  "Scheller College of Business": { type: "academic", lat: 33.7764, lng: -84.3879, w: 80, d: 60, h: 22 },
  // ── Dining ──
  "Brittain Dining Hall": { type: "dining", lat: 33.7724, lng: -84.3912, w: 50, d: 30, h: 14 },
  "North Avenue Dining Hall": { type: "dining", lat: 33.7708, lng: -84.3909, w: 30, d: 30, h: 8 },
  "West Village Dining Commons": { type: "dining", lat: 33.7797, lng: -84.4057, w: 60, d: 40, h: 14 },
  // ── Athletics, student life, health ──
  "Campus Recreation Center": { type: "athletic", lat: 33.7756, lng: -84.4037, w: 130, d: 90, h: 18 },
  "John Lewis Student Center": { type: "other", lat: 33.7738, lng: -84.3988, w: 110, d: 70, h: 16 },
  "Stamps Health Services": { type: "other", lat: 33.7748, lng: -84.4028, w: 50, d: 40, h: 12 },
};

/** Campus centre: scene origin. */
export const ORIGIN = { lat: 33.7758, lng: -84.3975 };
const M_PER_DEG_LAT = 110_540;
const M_PER_DEG_LNG = 111_320 * Math.cos((ORIGIN.lat * Math.PI) / 180);
/** 1 scene unit = 10 metres. */
export const SCALE = 0.1;

/** lat/lng → metres east (x) and south (z) of the campus centre. */
export function toMetres(lat: number, lng: number): { x: number; z: number } {
  return { x: (lng - ORIGIN.lng) * M_PER_DEG_LNG, z: -(lat - ORIGIN.lat) * M_PER_DEG_LAT };
}
/** Heights are exaggerated a little so the skyline reads from above. */
const HEIGHT_SCALE = 0.16;

/** lat/lng → scene x (east +) and z (south +). */
export function project(lat: number, lng: number): { x: number; z: number } {
  return {
    x: (lng - ORIGIN.lng) * M_PER_DEG_LNG * SCALE,
    z: -(lat - ORIGIN.lat) * M_PER_DEG_LAT * SCALE,
  };
}

export type CampusBuilding = {
  /** Database id when known (student/admin screens); the landing page uses names only. */
  id: number | null;
  name: string;
  short: string;
  type: BuildingType;
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
};

const DEFAULT_SIZE: Record<BuildingType, { w: number; d: number; h: number }> = {
  residence: { w: 46, d: 16, h: 13 },
  academic: { w: 70, d: 44, h: 18 },
  dining: { w: 44, d: 30, h: 10 },
  athletic: { w: 100, d: 70, h: 16 },
  other: { w: 60, d: 40, h: 14 },
};

/** Push overlapping footprints apart so approximate coordinates never produce intersecting blocks. */
function separate(list: CampusBuilding[], gap = 0.6, passes = 40): void {
  for (let p = 0; p < passes; p++) {
    let moved = false;
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const ox = (a.w + b.w) / 2 + gap - Math.abs(a.x - b.x);
        const oz = (a.d + b.d) / 2 + gap - Math.abs(a.z - b.z);
        if (ox <= 0 || oz <= 0) continue;
        moved = true;
        // separate along the axis that needs the smaller push
        if (ox < oz) {
          const s = a.x <= b.x ? -1 : 1;
          a.x += (s * ox) / 2;
          b.x -= (s * ox) / 2;
        } else {
          const s = a.z <= b.z ? -1 : 1;
          a.z += (s * oz) / 2;
          b.z -= (s * oz) / 2;
        }
      }
    }
    if (!moved) break;
  }
}

/**
 * Build the scene layout. Pass the rows from the `buildings` table to attach ids;
 * call with no arguments (landing page) to use the built-in list.
 * A database building that isn't in SPOTS is parked in a row south of campus so it never disappears.
 */
export function buildCampus(
  rows?: { id: number; name: string; short_name: string | null; type: BuildingType }[],
): CampusBuilding[] {
  const source = rows ?? Object.entries(SPOTS).map(([name, s]) => ({ id: null, name, short_name: null, type: s.type }));
  let parked = 0;
  const list = source.map((row): CampusBuilding => {
    const spot = SPOTS[row.name];
    const size = DEFAULT_SIZE[row.type];
    const pos = spot ? project(spot.lat, spot.lng) : { x: -40 + parked++ * 9, z: 78 };
    return {
      id: row.id,
      name: row.name,
      short: row.short_name ?? row.name.replace(/ (Hall|Building|Apartments)$/, ""),
      type: row.type,
      x: pos.x,
      z: pos.z,
      w: (spot?.w ?? size.w) * SCALE,
      d: (spot?.d ?? size.d) * SCALE,
      h: (spot?.h ?? size.h) * HEIGHT_SCALE,
    };
  });
  separate(list);
  return list;
}

/** Decorative ground features, in scene units (projected from real-ish positions). */
export const LANDMARKS = {
  techGreen: { ...project(33.7746, -84.3976), w: 9, d: 7 },
  /** Straight road strips: [x1, z1, x2, z2]. */
  roads: [
    [project(33.7713, -84.4075).x, project(33.7713, 0).z, project(33.7713, -84.387).x, project(33.7713, 0).z], // North Ave
    [project(33.7815, -84.4075).x, project(33.7815, 0).z, project(33.7815, -84.387).x, project(33.7815, 0).z], // 10th St
    [project(0, -84.3932).x + 0, project(33.7700, 0).z, project(0, -84.3932).x, project(33.7815, 0).z], // Techwood Dr
    [project(0, -84.4022).x, project(33.7713, 0).z, project(0, -84.4022).x, project(33.7815, 0).z], // Hemphill / State
    [project(33.7768, -84.3932).x, project(33.7768, 0).z, project(33.7768, -84.387).x, project(33.7768, 0).z], // 5th St → Tech Square
    [project(33.7782, -84.4075).x, project(33.7782, 0).z, project(33.7782, -84.3932).x, project(33.7782, 0).z], // Ferst Dr (straightened)
  ] as [number, number, number, number][],
};
