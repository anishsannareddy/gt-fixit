/**
 * Seeds Supabase with realistic demo data.
 *   npm run seed
 *
 * Safe to re-run: it deletes all requests/users/buildings first, then reinserts.
 * Uses a fixed random seed so everyone on the team gets the same-looking data
 * (dates are relative to "now", so the dashboard always looks current).
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { AREA_META, type Area } from "../lib/campus/areas";
import { campusBuildings, isGT, type CampusBuildingInfo } from "../lib/campus/zones";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false } });

const PHOTO_BUCKET = "request-photos";
const DAYS_BACK = 120;
const TARGET_REQUESTS = 320;

// ---------- deterministic randomness ----------
let seed = 20261114;
function rand(): number {
  // mulberry32
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
function weighted<T>(items: readonly (readonly [T, number])[]): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [item, w] of items) {
    if ((r -= w) <= 0) return item;
  }
  return items[items.length - 1][0];
}
const between = (min: number, max: number) => min + rand() * (max - min);
const HOUR = 3_600_000;

// ---------- reference data ----------
type BType = "residence" | "academic" | "dining" | "athletic" | "other";
/**
 * Buildings come from the real campus data: every OpenStreetMap footprint that the GT Facilities
 * zone map colours with a maintenance area (data/campus.json + data/zones.json + data/zone-overrides.json).
 */
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

function campusRows() {
  const used = new Map<string, number>();
  return campusBuildings.filter(isGT).map((b) => {
    // Names must be unique in the table; OSM has a few repeats and some unnamed buildings.
    const base = b.name ?? `Unnamed building (${AREA_META[b.zone].label})`;
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    const name = n === 1 ? base : `${base} #${n}`;
    return { name, short_name: shortName(name), type: typeOf(b), number: b.number, area: b.zone, lat: b.lat, lng: b.lng, osm_id: b.id };
  });
}

type Seed = { title: string; desc: string; priority: [string, number][] };
const ISSUES: Record<string, Seed[]> = {
  Plumbing: [
    { title: "Leaking sink faucet", desc: "Faucet drips constantly even when fully closed.", priority: [["low", 3], ["medium", 5]] },
    { title: "Clogged shower drain", desc: "Water pools ankle-deep during showers and drains very slowly.", priority: [["medium", 6], ["high", 3]] },
    { title: "Toilet running nonstop", desc: "Toilet keeps running after flushing; you can hear it all night.", priority: [["medium", 6], ["low", 2]] },
    { title: "Water leaking from ceiling", desc: "Water dripping from a ceiling tile, bucket placed underneath.", priority: [["urgent", 5], ["high", 4]] },
    { title: "No hot water", desc: "Only cold water from all taps since this morning.", priority: [["high", 6], ["urgent", 2]] },
  ],
  Electrical: [
    { title: "Outlet not working", desc: "Wall outlet by the desk has no power; tried multiple devices.", priority: [["medium", 6], ["low", 2]] },
    { title: "Outlet sparking", desc: "Saw sparks when plugging in a charger. Stopped using it.", priority: [["urgent", 7]] },
    { title: "Breaker keeps tripping", desc: "Breaker trips whenever the microwave and a laptop are on.", priority: [["high", 5], ["medium", 3]] },
  ],
  "HVAC / Temperature": [
    { title: "AC not cooling", desc: "Thermostat set to 68 but the room is over 80°F.", priority: [["high", 6], ["urgent", 2]] },
    { title: "Room too cold / heat not working", desc: "Heater blows cold air; room is around 60°F.", priority: [["high", 5], ["medium", 3]] },
    { title: "Loud rattling from vent", desc: "Air vent makes a loud rattle every few minutes.", priority: [["low", 4], ["medium", 4]] },
    { title: "Thermostat unresponsive", desc: "Thermostat screen is blank and buttons do nothing.", priority: [["medium", 6]] },
  ],
  Elevator: [
    { title: "Elevator out of service", desc: "Elevator doors won't open on any floor.", priority: [["high", 6], ["urgent", 3]] },
    { title: "Elevator stopping between floors", desc: "Elevator jolts and pauses between floors.", priority: [["urgent", 5], ["high", 3]] },
  ],
  Lighting: [
    { title: "Hallway lights out", desc: "Several hallway lights are out; it's dark at night.", priority: [["medium", 5], ["high", 2]] },
    { title: "Flickering classroom lights", desc: "Overhead lights flicker constantly during lecture.", priority: [["medium", 5], ["low", 3]] },
    { title: "Exterior light out by entrance", desc: "Light over the main entrance is out — feels unsafe after dark.", priority: [["high", 5], ["medium", 2]] },
  ],
  "Doors & Locks": [
    { title: "Card reader not working", desc: "BuzzCard reader flashes red for every card.", priority: [["high", 6], ["urgent", 2]] },
    { title: "Door won't latch", desc: "Door doesn't close all the way, so it can't lock.", priority: [["high", 5], ["medium", 3]] },
    { title: "Lock is jammed", desc: "Key turns but the lock doesn't open.", priority: [["high", 4], ["urgent", 2]] },
  ],
  Furniture: [
    { title: "Broken desk chair", desc: "Chair base is cracked and it tips backward.", priority: [["low", 5], ["medium", 3]] },
    { title: "Bed frame slats broken", desc: "Two slats snapped; mattress sags in the middle.", priority: [["medium", 6]] },
    { title: "Wobbly lecture hall seats", desc: "Several seats in the back rows are loose.", priority: [["low", 6]] },
  ],
  "Custodial / Cleaning": [
    { title: "Trash room overflowing", desc: "Trash room is full and bags are piling into the hallway.", priority: [["medium", 6], ["high", 2]] },
    { title: "Spill in stairwell", desc: "Sticky spill on the stairwell landing — slip hazard.", priority: [["high", 4], ["medium", 3]] },
    { title: "Restroom out of supplies", desc: "No soap or paper towels in the restroom.", priority: [["low", 4], ["medium", 4]] },
  ],
  "Pest Control": [
    { title: "Ants in kitchen", desc: "Trail of ants along the counter near the sink.", priority: [["medium", 6], ["low", 2]] },
    { title: "Cockroach sighting", desc: "Saw cockroaches near the bathroom drain at night.", priority: [["medium", 5], ["high", 3]] },
  ],
  Appliances: [
    { title: "Washing machine broken", desc: "Laundry room washer won't start but still charges.", priority: [["medium", 6], ["low", 2]] },
    { title: "Fridge not cooling", desc: "Apartment fridge is warm; food is spoiling.", priority: [["high", 6]] },
    { title: "Water fountain not working", desc: "Bottle filler station has no water flow.", priority: [["low", 6]] },
  ],
  Other: [
    { title: "Window won't close", desc: "Window is stuck partially open; rain gets in.", priority: [["high", 4], ["medium", 4]] },
    { title: "Ceiling tile damaged", desc: "Ceiling tile is cracked and sagging.", priority: [["medium", 5], ["low", 2]] },
  ],
};

/** Base share of requests per category. HVAC gets a boost in warm months below. */
const CATEGORY_WEIGHTS: [string, number][] = [
  ["Plumbing", 18],
  ["HVAC / Temperature", 16],
  ["Electrical", 9],
  ["Lighting", 9],
  ["Doors & Locks", 10],
  ["Custodial / Cleaning", 9],
  ["Furniture", 7],
  ["Appliances", 7],
  ["Pest Control", 6],
  ["Elevator", 4],
  ["Other", 5],
];
const NON_RESIDENCE_CATEGORIES = new Set(["Bed frame slats broken", "Fridge not cooling", "Ants in kitchen"]);

/** Hours from submit → resolve, by priority (min, max). */
const RESOLVE_HOURS: Record<string, [number, number]> = {
  urgent: [1.5, 10],
  high: [6, 48],
  medium: [18, 120],
  low: [36, 240],
};

const RESOLUTION_NOTES: Record<string, string[]> = {
  Plumbing: ["Replaced faucet cartridge.", "Snaked drain and cleared hair clog.", "Replaced flapper valve.", "Fixed leaking supply line above ceiling; replaced tile."],
  Electrical: ["Replaced faulty outlet.", "Reset breaker and redistributed load.", "Replaced damaged receptacle and tested circuit."],
  "HVAC / Temperature": ["Replaced clogged air filter and recharged unit.", "Reset fan coil unit; temperature back to normal.", "Tightened loose vent damper.", "Replaced thermostat."],
  Elevator: ["Vendor reset door operator; elevator back in service.", "Adjusted leveling sensor; tested all floors."],
  Lighting: ["Replaced ballast and bulbs.", "Replaced LED fixtures.", "Replaced exterior fixture photocell."],
  "Doors & Locks": ["Replaced card reader module.", "Adjusted strike plate; door latches now.", "Re-cored lock and issued new key."],
  Furniture: ["Replaced chair.", "Replaced bed slats.", "Tightened seat bolts in rows K–M."],
  "Custodial / Cleaning": ["Trash removed; added extra pickup.", "Area cleaned and dried.", "Restocked supplies."],
  "Pest Control": ["Applied bait treatment; follow-up scheduled.", "Sealed entry points and treated area."],
  Appliances: ["Vendor replaced washer control board.", "Replaced fridge thermostat.", "Cleared filter and restored water flow."],
  Other: ["Repaired window track.", "Replaced ceiling tile."],
};

const FLOORS = ["1st floor", "2nd floor", "3rd floor", "4th floor", "Basement"];
function locationFor(type: BType): string {
  switch (type) {
    case "residence":
      return weighted([
        [`Room ${Math.floor(between(1, 5))}${String(Math.floor(between(1, 40))).padStart(2, "0")}`, 6],
        [`${pick(FLOORS)} hallway`, 2],
        ["Laundry room", 1],
        [`${pick(FLOORS)} bathroom`, 2],
        ["Lobby", 1],
      ]);
    case "academic":
      return weighted([
        [`Room ${Math.floor(between(1, 4))}${String(Math.floor(between(1, 60))).padStart(2, "0")}`, 5],
        [`${pick(FLOORS)} restroom`, 3],
        [`${pick(FLOORS)} study area`, 2],
        ["Main entrance", 1],
      ]);
    case "dining":
      return pick(["Seating area", "Restroom", "Entrance", "Beverage station"]);
    case "athletic":
      return pick(["Locker room", "Weight room", "Pool deck", "Main entrance"]);
    default:
      return pick(["1st floor", "2nd floor", "Restroom", "Lobby"]);
  }
}

// ---------- people ----------
const DEMO_USERS = [
  { name: "Alex Rivera", role: "reporter", title: "2nd-year CS student · Glenn Hall" },
  { name: "Dr. Priya Shah", role: "reporter", title: "Faculty · School of ECE" },
  { name: "Marcus Reed", role: "technician", title: "HVAC & Electrical Technician" },
  { name: "Tasha Coleman", role: "technician", title: "Plumbing Technician" },
  { name: "Luis Ortega", role: "technician", title: "General Maintenance Technician" },
  { name: "Jordan Ellis", role: "admin", title: "Facilities Operations Manager" },
] as const;
const EXTRA_TECHS = ["Dana Whitfield", "Kevin Park"];
const FIRST = ["Sam", "Jamie", "Taylor", "Morgan", "Riley", "Casey", "Avery", "Quinn", "Drew", "Reese", "Skyler", "Emerson", "Hayden", "Rowan", "Parker", "Logan", "Kai", "Jules", "Noel", "Sage"];
const LAST = ["Nguyen", "Patel", "Kim", "Johnson", "Garcia", "Okafor", "Chen", "Williams", "Brooks", "Diaz", "Singh", "Lopez", "Martin", "Lee", "Hughes"];

// ---------- helpers ----------
async function insertChunked<T extends object>(table: string, rows: T[], select = "*") {
  const out: Record<string, unknown>[] = [];
  for (let i = 0; i < rows.length; i += 200) {
    const { data, error } = await supabase.from(table).insert(rows.slice(i, i + 200)).select(select);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...((data ?? []) as unknown as Record<string, unknown>[]));
  }
  return out;
}

async function ensureBucket() {
  const { data } = await supabase.storage.getBucket(PHOTO_BUCKET);
  if (data) return console.log(`✓ Storage bucket "${PHOTO_BUCKET}" exists`);
  const { error } = await supabase.storage.createBucket(PHOTO_BUCKET, {
    public: true,
    fileSizeLimit: "5MB",
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  });
  if (error) throw new Error(`bucket: ${error.message}`);
  console.log(`✓ Created storage bucket "${PHOTO_BUCKET}"`);
}

async function wipe() {
  // Supabase requires a filter on delete; these match every row.
  for (const table of ["request_events", "requests"]) {
    const { error } = await supabase.from(table).delete().gte("id", 0);
    if (error) throw new Error(`wipe ${table}: ${error.message}. Did you run supabase/schema.sql?`);
  }
  {
    const { error } = await supabase.from("users").delete().not("id", "is", null);
    if (error) throw new Error(`wipe users: ${error.message}`);
  }
  {
    const { error } = await supabase.from("buildings").delete().gte("id", 0);
    if (error) throw new Error(`wipe buildings: ${error.message}`);
  }
  console.log("✓ Cleared old data");
}

// ---------- main ----------
async function main() {
  await ensureBucket();
  await wipe();

  const buildings = (await insertChunked("buildings", campusRows(), "id, name, type, area")) as {
    id: number;
    name: string;
    type: BType;
    area: Area;
  }[];
  const perArea = buildings.reduce<Record<string, number>>((m, b) => ((m[b.area] = (m[b.area] ?? 0) + 1), m), {});
  console.log(`✓ ${buildings.length} GT buildings (${Object.entries(perArea).map(([a, n]) => `${AREA_META[a as Area].label}: ${n}`).join(", ")})`);

  const userRows = [
    ...DEMO_USERS.map((u) => ({ ...u, is_demo: true })),
    ...EXTRA_TECHS.map((name) => ({ name, role: "technician", title: "Maintenance Technician", is_demo: false })),
    ...Array.from({ length: 40 }, (_, i) => ({
      name: `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}`,
      role: "reporter",
      title: i % 5 === 0 ? "Faculty / Staff" : "Student",
      is_demo: false,
    })),
  ];
  const users = (await insertChunked("users", userRows, "id, name, role, is_demo")) as {
    id: string;
    name: string;
    role: string;
    is_demo: boolean;
  }[];
  const demoReporters = users.filter((u) => u.role === "reporter" && u.is_demo);
  const otherReporters = users.filter((u) => u.role === "reporter" && !u.is_demo);
  const techs = users.filter((u) => u.role === "technician");
  const admin = users.find((u) => u.role === "admin")!;
  const alex = demoReporters.find((u) => u.name.startsWith("Alex"))!;
  const glenn = buildings.find((b) => b.name.includes("Glenn Residence Hall")) ?? buildings.find((b) => b.type === "residence")!;
  console.log(`✓ ${users.length} users (${DEMO_USERS.length} demo personas)`);

  // Weight residence halls heavier — that's where most requests come from.
  const buildingWeights = buildings.map((b) => {
    let w = b.type === "residence" ? 2.2 : b.type === "academic" ? 1.6 : b.area === "parking" ? 0.5 : 1.2;
    if (b.name.startsWith("Unnamed")) w *= 0.3;
    // a few "problem buildings" so the top-10 chart and heat map have a story
    if (/Towers Residence Hall|Glenn Residence Hall|North Avenue Apartments North|Howey Building$|Clough|Klaus|Student Center$/.test(b.name)) w *= 4;
    return [b, w] as const;
  });

  const now = Date.now();
  type RequestRow = Record<string, unknown> & { _events: Record<string, unknown>[] };
  const rows: RequestRow[] = [];

  const FRESH_UNASSIGNED = 9; // brand-new requests nobody has claimed yet
  for (let i = 0; i < TARGET_REQUESTS * 1.4 && rows.length < TARGET_REQUESTS; i++) {
    // The first few iterations are fresh, unclaimed requests from the last ~30 hours.
    // After that: more recent days a bit busier; August move-in spike; fewer on weekends.
    const fresh = rows.length < FRESH_UNASSIGNED;
    const daysAgo = fresh ? between(0.05, 1.25) : Math.pow(rand(), 1.15) * DAYS_BACK;
    const created = new Date(now - daysAgo * 24 * HOUR - between(0, 1) * HOUR);
    const dow = created.getDay();
    const month = created.getMonth(); // 0-indexed
    if (!fresh) {
      if ((dow === 0 || dow === 6) && rand() < 0.45) continue;
      const isMoveIn = month === 7 && created.getDate() >= 10;
      if (!isMoveIn && rand() < 0.15) continue;
      created.setHours(Math.floor(between(7, 23)), Math.floor(between(0, 60)));
      if (created.getTime() > now) created.setTime(now - between(1, 6) * HOUR);
    }

    const warm = month >= 5 && month <= 8;
    const category = weighted(
      CATEGORY_WEIGHTS.map(([c, w]) => [c, c === "HVAC / Temperature" && warm ? w * 2 : w] as const),
    );
    let building = weighted(buildingWeights);
    let issue = pick(ISSUES[category]);
    if (building.type !== "residence" && NON_RESIDENCE_CATEGORIES.has(issue.title)) {
      issue = ISSUES[category][0];
    }
    // Two of the fresh requests are urgent so the "Urgent open" tile has something to show
    const priority = fresh && rows.length < 2 ? "urgent" : weighted(issue.priority);

    // ~8% of requests belong to the two demo reporters so "My requests" isn't empty
    let reporter = pick(otherReporters);
    if (daysAgo < 45 && rand() < 0.1) {
      reporter = pick(demoReporters);
      if (reporter.id === alex.id && rand() < 0.7) building = glenn;
    }

    // Status depends on age: almost everything older than ~10 days is resolved.
    const [minH, maxH] = RESOLVE_HOURS[priority];
    // The last few days have a backlog, so the live queue has real work in it
    const backlog = daysAgo < 6 ? between(1.5, 3) : 1;
    const resolveHours = between(minH, maxH) * (category === "Elevator" ? 1.6 : 1) * backlog;
    const ageHours = (now - created.getTime()) / HOUR;
    const assignAfter = Math.min(resolveHours * between(0.1, 0.3), between(0.3, 8));
    const startAfter = assignAfter + (resolveHours - assignAfter) * between(0.2, 0.6);

    let status: "submitted" | "assigned" | "in_progress" | "resolved";
    if (fresh) status = "submitted";
    else if (ageHours >= resolveHours && rand() > 0.03) status = "resolved";
    else if (ageHours >= startAfter) status = "in_progress";
    else if (ageHours >= assignAfter) status = "assigned";
    else status = "submitted";

    // Demo technicians get most of the work so their queues look realistic
    const tech = weighted(techs.map((t) => [t, t.name === "Marcus Reed" || t.name === "Tasha Coleman" ? 3 : t.name === "Luis Ortega" ? 2.5 : 1.2] as const));
    const assigner = rand() < 0.6 ? tech : admin; // self-claimed vs. dispatched by admin
    const at = (h: number) => new Date(created.getTime() + h * HOUR).toISOString();

    const events: Record<string, unknown>[] = [
      { actor_id: reporter.id, from_status: null, to_status: "submitted", note: null, created_at: created.toISOString() },
    ];
    if (status !== "submitted") {
      events.push({
        actor_id: assigner.id,
        from_status: "submitted",
        to_status: "assigned",
        note: assigner.id === admin.id ? `Assigned to ${tech.name}` : null,
        created_at: at(assignAfter),
      });
    }
    if (status === "in_progress" || status === "resolved") {
      events.push({ actor_id: tech.id, from_status: "assigned", to_status: "in_progress", note: null, created_at: at(startAfter) });
    }
    if (status === "resolved") {
      events.push({
        actor_id: tech.id,
        from_status: "in_progress",
        to_status: "resolved",
        note: pick(RESOLUTION_NOTES[category]),
        created_at: at(resolveHours),
      });
    }

    rows.push({
      title: issue.title,
      description: issue.desc,
      building_id: building.id,
      area: building.area,
      location_detail: locationFor(building.type),
      category,
      priority,
      status,
      reporter_id: reporter.id,
      assignee_id: status === "submitted" ? null : tech.id,
      photo_url: null,
      created_at: created.toISOString(),
      updated_at: (events[events.length - 1].created_at as string) ?? created.toISOString(),
      resolved_at: status === "resolved" ? at(resolveHours) : null,
      _events: events,
    });
  }

  rows.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
  const inserted = (await insertChunked(
    "requests",
    rows.map((r) => {
      const { _events, ...row } = r; // eslint-disable-line @typescript-eslint/no-unused-vars
      return row;
    }),
    "id",
  )) as { id: number }[];

  const events = rows.flatMap((r, i) => r._events.map((e) => ({ ...e, request_id: inserted[i].id })));
  await insertChunked("request_events", events, "id");

  const open = rows.filter((r) => r.status !== "resolved").length;
  console.log(`✓ ${inserted.length} requests (${open} open) and ${events.length} timeline events`);
  console.log("\nDone! Start the app with: npm run dev");
}

main().catch((err) => {
  console.error("\n✗ Seed failed:", err.message ?? err);
  process.exit(1);
});
