/**
 * GT buildings for the `buildings` table, from the real campus data: every OpenStreetMap footprint the
 * GT Facilities zone map colours with a maintenance area (data/campus.json + data/zones.json), plus the
 * hand corrections in data/zone-overrides.json (names, areas, search aliases).
 *
 * Rows are UPSERTED by OpenStreetMap id and never deleted, so a building keeps its database id across
 * re-seeds and renames, and existing requests keep pointing at the right building.
 *   npm run buildings:sync     update the live buildings table without touching requests or users
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { AREA_META, type Area } from "../lib/campus/areas";
import { campusBuildings, isGT, type CampusBuildingInfo } from "../lib/campus/zones";

type BType = "residence" | "academic" | "dining" | "athletic" | "other";

function shortName(name: string): string {
  const short = name
    .replace(/ (Residence Hall|Building|Memorial Library|Apartments|Hall)\b/g, "")
    .replace(/^(The|Georgia Tech) /, "")
    .trim();
  return short.length > 24 ? short.slice(0, 23).trimEnd() + "…" : short;
}

function typeOf(b: CampusBuildingInfo & { zone: Area }): BType {
  const name = b.name ?? "";
  if (/dining|brittain/i.test(name)) return "dining";
  if (b.zone === "housing") return "residence";
  if (b.zone === "gtaa" || /recreation|stadium|pavilion|coliseum|gym/i.test(name)) return "athletic";
  if (b.zone === "parking" || /parking|deck/i.test(name)) return "other";
  return "academic";
}

export function buildingRows() {
  const used = new Map<string, number>();
  return campusBuildings.filter(isGT).map((b) => {
    // Names must be unique in the table; OSM has a few repeats and some unnamed buildings.
    const base = b.name ?? `Unnamed building (${AREA_META[b.zone].label})`;
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    const name = n === 1 ? base : `${base} #${n}`;
    return { name, short_name: shortName(name), aliases: b.aliases, type: typeOf(b), number: b.number, area: b.zone, lat: b.lat, lng: b.lng, osm_id: b.id };
  });
}

/** Upsert every GT building by osm_id. Returns the rows (with their stable ids). */
export async function syncBuildings(sb: SupabaseClient) {
  const rows = buildingRows();
  // Free up names first: a rename can take a name another row still holds (e.g. "X" → "X North").
  const { data: existing, error: readError } = await sb.from("buildings").select("id, name, osm_id");
  if (readError) throw new Error(`buildings: ${readError.message}`);
  const wanted = new Map(rows.map((r) => [r.osm_id, r.name]));
  const taken = new Set(rows.map((r) => r.name));
  for (const e of existing ?? []) {
    if (taken.has(e.name) && wanted.get(e.osm_id) !== e.name) {
      const { error } = await sb.from("buildings").update({ name: `${e.name} (old ${e.id})` }).eq("id", e.id);
      if (error) throw new Error(`buildings: ${error.message}`);
    }
  }
  const out: { id: number; name: string; type: BType; area: Area; osm_id: string }[] = [];
  for (let i = 0; i < rows.length; i += 200) {
    const { data, error } = await sb.from("buildings").upsert(rows.slice(i, i + 200), { onConflict: "osm_id" }).select("id, name, type, area, osm_id");
    if (error) throw new Error(`buildings: ${error.message}${/aliases/.test(error.message) ? ". Did you run supabase/migrations/003_building_aliases.sql?" : ""}`);
    out.push(...((data ?? []) as typeof out));
  }
  return out;
}
