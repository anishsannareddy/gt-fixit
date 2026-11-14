import * as THREE from "three";
import { SCALE } from "./layout";

/** Shapes of data/campus.json (written by scripts/fetch-osm.ts). Distances are in metres. */
export type RawBuilding = {
  id: string;
  name: string | null;
  ref: string | null;
  kind: string;
  h: number;
  lat: number;
  lng: number;
  x: number;
  z: number;
  /** Flat [x, z, …]. First ring is the outline; the rest are holes (courtyards). */
  rings: number[][];
};
export type RawRoad = { k: string; w: number; pts: number[] };
export type CampusData = { buildings: RawBuilding[]; roads: RawRoad[] };

/** Buildings are drawn a little taller than life so the skyline reads from above. */
export const HEIGHT_EXAGGERATION = 1.35;

export type BuildingMesh = {
  geometry: THREE.BufferGeometry;
  /** Vertex range of building i is [starts[i], starts[i + 1]). Three vertices per triangle. */
  starts: Uint32Array;
  /** 1 for roof vertices, 0 for wall vertices (roofs are drawn a shade lighter). */
  roof: Uint8Array;
  /** Buildings whose outline could not be triangulated (drawn as walls only). */
  failed: string[];
};

function signedArea(ring: number[]): number {
  let a = 0;
  for (let i = 0, n = ring.length / 2; i < n; i++) {
    const j = (i + 1) % n;
    a += ring[i * 2] * ring[j * 2 + 1] - ring[j * 2] * ring[i * 2 + 1];
  }
  return a / 2;
}

/**
 * Extrude every footprint and merge them into ONE geometry (a single draw call).
 * Triangles are not indexed, so each face keeps its own flat normal and each building
 * owns a contiguous block of vertices that can be recoloured later.
 */
export function buildBuildingMesh(buildings: RawBuilding[]): BuildingMesh {
  const pos: number[] = [];
  const nor: number[] = [];
  const roof: number[] = [];
  const starts = new Uint32Array(buildings.length + 1);
  const failed: string[] = [];

  buildings.forEach((b, bi) => {
    starts[bi] = pos.length / 3;
    const top = b.h * SCALE * HEIGHT_EXAGGERATION;

    // Walls: one quad per outline edge, facing outward (or into the courtyard for holes).
    b.rings.forEach((ring, ri) => {
      const n = ring.length / 2;
      const outward = Math.sign(signedArea(ring)) * (ri === 0 ? 1 : -1) || 1;
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const ax = ring[i * 2] * SCALE, az = ring[i * 2 + 1] * SCALE;
        const bx = ring[j * 2] * SCALE, bz = ring[j * 2 + 1] * SCALE;
        const dx = bx - ax, dz = bz - az;
        const len = Math.hypot(dx, dz);
        if (len < 1e-6) continue;
        const nx = (outward * dz) / len, nz = (outward * -dx) / len;
        // order the two triangles so their front face points along the normal
        const quad = outward > 0 ? [ax, 0, az, ax, top, az, bx, top, bz, ax, 0, az, bx, top, bz, bx, 0, bz] : [ax, 0, az, bx, top, bz, ax, top, az, ax, 0, az, bx, 0, bz, bx, top, bz];
        pos.push(...quad);
        for (let k = 0; k < 6; k++) {
          nor.push(nx, 0, nz);
          roof.push(0);
        }
      }
    });

    // Roof: triangulate the outline (minus holes).
    const toVec = (ring: number[]) => {
      const out: THREE.Vector2[] = [];
      for (let i = 0; i < ring.length; i += 2) out.push(new THREE.Vector2(ring[i] * SCALE, ring[i + 1] * SCALE));
      return out;
    };
    const contour = toVec(b.rings[0]);
    const holes = b.rings.slice(1).map(toVec);
    const all = [contour, ...holes].flat();
    const faces = THREE.ShapeUtils.triangulateShape(contour, holes);
    if (faces.length === 0) failed.push(b.id);
    for (const [i0, i1, i2] of faces) {
      const a = all[i0], c = all[i1], d = all[i2];
      // make the triangle face up (+y)
      const up = (c.y - a.y) * (d.x - a.x) - (c.x - a.x) * (d.y - a.y) > 0;
      const [p, q, r] = up ? [a, c, d] : [a, d, c];
      pos.push(p.x, top, p.y, q.x, top, q.y, r.x, top, r.y);
      nor.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
      roof.push(1, 1, 1);
    }
  });
  starts[buildings.length] = pos.length / 3;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(pos.length).fill(1), 3));
  geometry.computeBoundingSphere();
  return { geometry, starts, roof: Uint8Array.from(roof), failed };
}

/** Paint building i. Roof vertices get `roofColor`, walls get `wallColor`. Call `markColorsDirty` after a batch. */
export function paintBuilding(mesh: BuildingMesh, i: number, wallColor: THREE.Color, roofColor: THREE.Color): void {
  const colors = mesh.geometry.getAttribute("color") as THREE.BufferAttribute;
  const arr = colors.array as Float32Array;
  for (let v = mesh.starts[i]; v < mesh.starts[i + 1]; v++) {
    const c = mesh.roof[v] ? roofColor : wallColor;
    arr[v * 3] = c.r;
    arr[v * 3 + 1] = c.g;
    arr[v * 3 + 2] = c.b;
  }
}
export function markColorsDirty(mesh: BuildingMesh): void {
  mesh.geometry.getAttribute("color").needsUpdate = true;
}

/** Which building owns this triangle? (Used for click/hover picking on the merged mesh.) */
export function buildingAtFace(mesh: BuildingMesh, faceIndex: number): number {
  const vertex = faceIndex * 3;
  let lo = 0, hi = mesh.starts.length - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (mesh.starts[mid] <= vertex) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

const ROAD_SHADE: Record<string, number> = { motorway: 1.5, motorway_link: 1.35, trunk: 1.35, trunk_link: 1.25, primary: 1.25, secondary: 1.15 };

/** Roads as flat ribbons, merged into one geometry. Bigger roads sit slightly higher and brighter. */
export function buildRoadGeometry(roads: RawRoad[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const base = new THREE.Color("#0c3558");
  for (const road of roads) {
    const half = (road.w * SCALE) / 2;
    const shade = ROAD_SHADE[road.k] ?? 1;
    const y = 0.02 + (shade - 1) * 0.06;
    for (let i = 0; i + 3 < road.pts.length; i += 2) {
      const ax = road.pts[i] * SCALE, az = road.pts[i + 1] * SCALE;
      const bx = road.pts[i + 2] * SCALE, bz = road.pts[i + 3] * SCALE;
      const dx = bx - ax, dz = bz - az;
      const len = Math.hypot(dx, dz);
      if (len < 1e-6) continue;
      // extend each piece by half a width so bends don't leave gaps
      const ex = (dx / len) * half, ez = (dz / len) * half;
      const px = (-dz / len) * half, pz = (dx / len) * half;
      const x1 = ax - ex, z1 = az - ez, x2 = bx + ex, z2 = bz + ez;
      pos.push(x1 + px, y, z1 + pz, x2 + px, y, z2 + pz, x2 - px, y, z2 - pz, x1 + px, y, z1 + pz, x2 - px, y, z2 - pz, x1 - px, y, z1 - pz);
      for (let k = 0; k < 6; k++) col.push(base.r * shade, base.g * shade, base.b * shade);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geometry.computeVertexNormals();
  return geometry;
}
