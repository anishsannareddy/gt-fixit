/**
 * Checks that every building in the database appears in the 3D campus:
 *   - its OpenStreetMap footprint exists in data/campus.json
 *   - it sits inside the overview frame and the camera bounds used by the scene
 * Also prints how buildings fall into the heat-map bands right now.
 *   npx tsx scripts/check-coverage.ts
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { campusBuildings, isGT } from "../lib/campus/zones";
import { SCALE } from "../lib/campus/layout";
import { HEAT_BANDS, HEAT_META, heatBand } from "../lib/campus/heat";

config({ path: ".env.local", quiet: true });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

function extent(list: typeof campusBuildings, margin: number) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const b of list) for (let i = 0; i < b.rings[0].length; i += 2) {
    minX = Math.min(minX, b.rings[0][i]); maxX = Math.max(maxX, b.rings[0][i]);
    minZ = Math.min(minZ, b.rings[0][i + 1]); maxZ = Math.max(maxZ, b.rings[0][i + 1]);
  }
  return { minX: minX * SCALE - margin, maxX: maxX * SCALE + margin, minZ: minZ * SCALE - margin, maxZ: maxZ * SCALE + margin };
}
// Same numbers as RealCampusScene.tsx
const frame = extent(campusBuildings.filter(isGT), 4);
const bounds = extent(campusBuildings, 20);
const byId = new Map(campusBuildings.map((b) => [b.id, b]));
const inside = (f: typeof frame, x: number, z: number) => x >= f.minX && x <= f.maxX && z >= f.minZ && z <= f.maxZ;

async function main() {
  const { data: rows, error } = await db.from("buildings").select("id, name, osm_id");
  if (error) throw new Error(error.message);
  const problems: string[] = [];
  for (const r of rows!) {
    const b = r.osm_id ? byId.get(r.osm_id) : undefined;
    if (!b) { problems.push(`${r.name}: no footprint in data/campus.json`); continue; }
    if (!isGT(b)) problems.push(`${r.name}: footprint exists but isn't marked as a GT building, so it can't be clicked`);
    const x = b.x * SCALE, z = b.z * SCALE;
    if (!inside(frame, x, z)) problems.push(`${r.name}: outside the overview frame`);
    if (!inside(bounds, x, z)) problems.push(`${r.name}: outside the camera bounds`);
  }
  console.log(`${rows!.length} buildings in the database; ${rows!.length - problems.length} fully covered`);
  console.log(`overview frame: ${(frame.maxX - frame.minX).toFixed(0)} × ${(frame.maxZ - frame.minZ).toFixed(0)} units; camera bounds: ${(bounds.maxX - bounds.minX).toFixed(0)} × ${(bounds.maxZ - bounds.minZ).toFixed(0)} units`);

  const { data: open } = await db.from("requests").select("building_id").neq("status", "resolved");
  const perBuilding = new Map<number, number>();
  for (const o of open!) perBuilding.set(o.building_id, (perBuilding.get(o.building_id) ?? 0) + 1);
  const bands = Object.fromEntries(HEAT_BANDS.map((b) => [b, 0])) as Record<string, number>;
  for (const r of rows!) bands[heatBand(perBuilding.get(r.id) ?? 0)]++;
  console.log("heat bands now:", HEAT_BANDS.map((b) => `${HEAT_META[b].label} (${HEAT_META[b].range}): ${bands[b]}`).join(" · "));
  if (problems.length) {
    console.log("\nProblems:\n  " + problems.join("\n  "));
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
