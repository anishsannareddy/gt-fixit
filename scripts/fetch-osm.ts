/**
 * One-off: download Georgia Tech area building footprints + roads from OpenStreetMap
 * and write data/campus.json (static, committed). The app never calls Overpass at runtime.
 *
 *   npx tsx scripts/fetch-osm.ts            # download (cached in data/source/osm-raw.json) + build
 *   npx tsx scripts/fetch-osm.ts --refresh  # force a fresh download
 *
 * Data © OpenStreetMap contributors, ODbL — https://www.openstreetmap.org/copyright
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { toMetres } from "../lib/campus/layout";

// south, west, north, east: the area shown on the GT Facilities zone map
const BBOX = [33.765, -84.413, 33.79, -84.382] as const;
const RAW = "data/source/osm-raw.json";
const OUT = "data/campus.json";
const ROAD_CLASSES = "motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|tertiary|residential|unclassified|living_street|pedestrian";

type LatLon = { lat: number; lon: number };
type Tags = Record<string, string>;
type Way = { type: "way"; id: number; tags?: Tags; geometry?: LatLon[] };
type Rel = { type: "relation"; id: number; tags?: Tags; members: { type: string; ref: number; role: string; geometry?: LatLon[] }[] };

async function download(): Promise<{ elements: (Way | Rel)[] }> {
  if (existsSync(RAW) && !process.argv.includes("--refresh")) {
    console.log(`Using cached ${RAW}`);
    return JSON.parse(readFileSync(RAW, "utf8"));
  }
  const bbox = BBOX.join(",");
  const query = `[out:json][timeout:120];
(
  way["building"](${bbox});
  relation["building"]["type"="multipolygon"](${bbox});
  way["highway"~"^(${ROAD_CLASSES})$"](${bbox});
);
out body geom;`;
  console.log("Downloading from Overpass…");
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "campus-map-prototype/0.1" },
    body: "data=" + encodeURIComponent(query),
  });
  if (!res.ok) throw new Error(`Overpass ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const text = await res.text();
  mkdirSync("data/source", { recursive: true });
  writeFileSync(RAW, text);
  return JSON.parse(text);
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Ring of lat/lon → flat [x, z, x, z…] in metres, without the repeated closing point. */
function toRing(points: LatLon[]): number[] {
  const flat: number[] = [];
  const pts = points.length > 1 && points[0].lat === points.at(-1)!.lat && points[0].lon === points.at(-1)!.lon ? points.slice(0, -1) : points;
  let px = NaN, pz = NaN;
  for (const p of pts) {
    const m = toMetres(p.lat, p.lon);
    const x = r1(m.x), z = r1(m.z);
    if (x === px && z === pz) continue; // drop duplicates created by rounding
    flat.push(x, z);
    px = x; pz = z;
  }
  if (flat.length >= 4 && flat[0] === flat.at(-2) && flat[1] === flat.at(-1)) flat.length -= 2;
  return flat;
}

function ringArea(flat: number[]): number {
  let a = 0;
  for (let i = 0, n = flat.length / 2; i < n; i++) {
    const j = (i + 1) % n;
    a += flat[i * 2] * flat[j * 2 + 1] - flat[j * 2] * flat[i * 2 + 1];
  }
  return Math.abs(a / 2);
}

function centroid(flat: number[]): { x: number; z: number } {
  let x = 0, z = 0;
  const n = flat.length / 2;
  for (let i = 0; i < n; i++) { x += flat[i * 2]; z += flat[i * 2 + 1]; }
  return { x: x / n, z: z / n };
}

/** Multipolygon members often arrive as several open ways; stitch them end-to-end into closed rings. */
function stitch(parts: LatLon[][]): LatLon[][] {
  const key = (p: LatLon) => `${p.lat},${p.lon}`;
  const rings: LatLon[][] = [];
  const open = parts.map((p) => [...p]);
  while (open.length) {
    let ring = open.pop()!;
    while (key(ring[0]) !== key(ring.at(-1)!)) {
      const end = key(ring.at(-1)!);
      const i = open.findIndex((p) => key(p[0]) === end || key(p.at(-1)!) === end);
      if (i < 0) break;
      const next = open.splice(i, 1)[0];
      ring = ring.concat((key(next[0]) === end ? next : next.reverse()).slice(1));
    }
    if (ring.length >= 4 && key(ring[0]) === key(ring.at(-1)!)) rings.push(ring);
  }
  return rings;
}

const DEFAULT_HEIGHT: Record<string, number> = {
  house: 6, detached: 6, residential: 7, semidetached_house: 6, terrace: 7, garage: 3, garages: 3, shed: 3, roof: 4, hut: 3,
  apartments: 16, dormitory: 15, university: 15, college: 15, school: 10, commercial: 12, office: 18, retail: 6, hotel: 24,
  parking: 12, stadium: 22, sports_centre: 12, church: 12, industrial: 9, warehouse: 8, hospital: 18,
};

function heightOf(tags: Tags): { h: number; known: boolean } {
  const h = parseFloat(tags.height ?? "");
  if (h > 1 && h < 400) return { h: r1(h), known: true };
  const levels = parseFloat(tags["building:levels"] ?? "");
  if (levels > 0 && levels < 100) return { h: r1(levels * 3.6 + 1.5), known: true };
  return { h: DEFAULT_HEIGHT[tags.building] ?? 9, known: false };
}

type OutBuilding = {
  id: string; name: string | null; ref: string | null; kind: string; h: number;
  lat: number; lng: number; x: number; z: number; rings: number[][];
};

function makeBuilding(id: string, tags: Tags, outer: LatLon[], inners: LatLon[][]): OutBuilding | null {
  const ring = toRing(outer);
  if (ring.length < 6 || ringArea(ring) < 20) return null; // skip sheds / degenerate shapes
  const holes = inners.map(toRing).filter((h) => h.length >= 6 && ringArea(h) >= 4);
  const c = centroid(ring);
  const lat = outer.reduce((s, p) => s + p.lat, 0) / outer.length;
  const lng = outer.reduce((s, p) => s + p.lon, 0) / outer.length;
  return {
    id, name: tags.name ?? tags["official_name"] ?? tags["alt_name"] ?? null, ref: tags.ref ?? tags["ref:gatech"] ?? null,
    kind: tags.amenity === "parking" || tags.building === "parking" ? "parking" : tags.building,
    h: heightOf(tags).h, lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6, x: r1(c.x), z: r1(c.z), rings: [ring, ...holes],
  };
}

const ROAD_WIDTH: Record<string, number> = {
  motorway: 20, motorway_link: 9, trunk: 15, trunk_link: 8, primary: 13, primary_link: 8, secondary: 11, tertiary: 9,
  residential: 6.5, unclassified: 6.5, living_street: 5, pedestrian: 4,
};

async function main() {
  const { elements } = await download();
  const buildings: OutBuilding[] = [];
  const roads: { k: string; w: number; pts: number[] }[] = [];

  // Ways that are the outline of a building relation are covered by the relation.
  const relOuterWays = new Set<number>();
  for (const el of elements) if (el.type === "relation") for (const m of el.members) if (m.type === "way" && m.role !== "inner") relOuterWays.add(m.ref);

  for (const el of elements) {
    const tags = el.tags ?? {};
    if (el.type === "way") {
      if (!el.geometry) continue;
      if (tags.highway) {
        const pts: number[] = [];
        for (const p of el.geometry) { const m = toMetres(p.lat, p.lon); pts.push(r1(m.x), r1(m.z)); }
        if (pts.length >= 4 && tags.tunnel !== "yes") roads.push({ k: tags.highway, w: ROAD_WIDTH[tags.highway] ?? 6, pts });
      } else if (tags.building && !relOuterWays.has(el.id)) {
        const b = makeBuilding(`w${el.id}`, tags, el.geometry, []);
        if (b) buildings.push(b);
      }
    } else if (el.type === "relation" && tags.building) {
      const geo = (role: (r: string) => boolean) => el.members.filter((m) => m.type === "way" && m.geometry && role(m.role)).map((m) => m.geometry!);
      const outers = stitch(geo((r) => r !== "inner"));
      const inners = stitch(geo((r) => r === "inner"));
      outers.forEach((outer, i) => {
        // give each hole to the outer ring that contains its first point (bounding-box test is enough here)
        const lats = outer.map((p) => p.lat), lons = outer.map((p) => p.lon);
        const box = [Math.min(...lats), Math.max(...lats), Math.min(...lons), Math.max(...lons)];
        const mine = inners.filter((h) => h[0].lat >= box[0] && h[0].lat <= box[1] && h[0].lon >= box[2] && h[0].lon <= box[3]);
        const b = makeBuilding(`r${el.id}${outers.length > 1 ? `_${i}` : ""}`, tags, outer, mine);
        if (b) buildings.push(b);
      });
    }
  }

  buildings.sort((a, b) => a.id.localeCompare(b.id));
  const out = {
    attribution: "© OpenStreetMap contributors (ODbL) — https://www.openstreetmap.org/copyright",
    generated: new Date().toISOString().slice(0, 10),
    bbox: BBOX,
    units: "metres from campus centre; x = east, z = south; rings are flat [x,z,…], first ring is the outline, the rest are holes",
    buildings,
    roads,
  };
  writeFileSync(OUT, JSON.stringify(out));

  const named = buildings.filter((b) => b.name).length;
  const withRef = buildings.filter((b) => b.ref).length;
  const verts = buildings.reduce((s, b) => s + b.rings.reduce((t, r) => t + r.length / 2, 0), 0);
  console.log(`✓ ${buildings.length} buildings (${named} named, ${withRef} with a ref/number, ${buildings.filter((b) => b.rings.length > 1).length} with courtyards), ${verts} outline points`);
  console.log(`✓ ${roads.length} road segments`);
  console.log(`✓ wrote ${OUT} (${(JSON.stringify(out).length / 1024).toFixed(0)} KB)`);
}

main().catch((e) => { console.error("✗", e.message ?? e); process.exit(1); });
