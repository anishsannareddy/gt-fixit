/**
 * Seeds Supabase with realistic demo data.
 *   npm run seed
 *
 * Safe to re-run: it deletes all requests/users/buildings first, then reinserts.
 * Uses a fixed random seed so everyone on the team gets the same-looking data
 * (dates are relative to "now", so the dashboard always looks current).
 */
import { config } from "dotenv";
import { escalateForHazard, isReviewedUrgency } from "../lib/ai/safety";
import { createClient } from "@supabase/supabase-js";
import { AREA_META, type Area } from "../lib/campus/areas";
import { campusBuildings, isGT, type CampusBuildingInfo } from "../lib/campus/zones";
import { DEMO_ACCOUNTS, demoPassword } from "../lib/demo-accounts";

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

type U = "low" | "medium" | "high" | "urgent";
/** One kind of issue. `ai` is the pre-baked AI rating, so the demo works without the OpenAI API. */
type Seed = { title: string; desc: string; priority: [string, number][]; ai: [U, string, boolean?] };
const ISSUES: Record<string, Seed[]> = {
  Plumbing: [
    { title: "Leaking sink faucet", desc: "Faucet drips constantly even when fully closed.", priority: [["low", 3], ["medium", 5]], ai: ["low", "A dripping faucet wastes water but causes no damage or risk."] },
    { title: "Clogged shower drain", desc: "Water pools ankle-deep during showers and drains very slowly.", priority: [["medium", 6], ["high", 3]], ai: ["medium", "Slow drain disrupts daily use but water stays in the shower."] },
    { title: "Toilet running nonstop", desc: "Toilet keeps running after flushing; you can hear it all night.", priority: [["medium", 6], ["low", 2]], ai: ["medium", "Wastes water continuously; a quick fix but not a risk."] },
    { title: "Water leaking from ceiling", desc: "Water dripping from a ceiling tile, bucket placed underneath.", priority: [["urgent", 5], ["high", 4]], ai: ["high", "An active ceiling leak can spread damage and make floors slippery.", true] },
    { title: "No hot water", desc: "Only cold water from all taps since this morning.", priority: [["high", 6], ["urgent", 2]], ai: ["high", "No hot water affects everyone in the room or floor until fixed."] },
  ],
  Electrical: [
    { title: "Outlet not working", desc: "Wall outlet by the desk has no power; tried multiple devices.", priority: [["medium", 6], ["low", 2]], ai: ["low", "A dead outlet with no sparks or heat is an inconvenience."] },
    { title: "Outlet sparking", desc: "Saw sparks when plugging in a charger. Stopped using it.", priority: [["urgent", 7]], ai: ["urgent", "Sparking outlets are a fire and shock risk.", true] },
    { title: "Breaker keeps tripping", desc: "Breaker trips whenever the microwave and a laptop are on.", priority: [["high", 5], ["medium", 3]], ai: ["medium", "Likely an overloaded circuit; the breaker is doing its job."] },
  ],
  "HVAC / Temperature": [
    { title: "AC not cooling", desc: "Thermostat set to 68 but the room is over 80°F.", priority: [["high", 6], ["urgent", 2]], ai: ["high", "Over 80°F indoors makes the room hard to live or work in."] },
    { title: "Room too cold / heat not working", desc: "Heater blows cold air; room is around 60°F.", priority: [["high", 5], ["medium", 3]], ai: ["high", "A 60°F room is uncomfortable and affects sleep and study."] },
    { title: "Loud rattling from vent", desc: "Air vent makes a loud rattle every few minutes.", priority: [["low", 4], ["medium", 4]], ai: ["low", "Annoying noise with no sign of a failure or risk."] },
    { title: "Thermostat unresponsive", desc: "Thermostat screen is blank and buttons do nothing.", priority: [["medium", 6]], ai: ["medium", "Temperature can't be adjusted, but the room isn't extreme yet."] },
  ],
  Elevator: [
    { title: "Elevator out of service", desc: "Elevator doors won't open on any floor.", priority: [["high", 6], ["urgent", 3]], ai: ["high", "No elevator blocks access for anyone who can't use stairs.", true] },
    { title: "Elevator stopping between floors", desc: "Elevator jolts and pauses between floors.", priority: [["urgent", 5], ["high", 3]], ai: ["urgent", "An elevator stalling between floors risks trapping riders.", true] },
  ],
  Lighting: [
    { title: "Hallway lights out", desc: "Several hallway lights are out; it's dark at night.", priority: [["medium", 5], ["high", 2]], ai: ["medium", "Dark hallways are a trip risk at night but there is other light."] },
    { title: "Flickering classroom lights", desc: "Overhead lights flicker constantly during lecture.", priority: [["medium", 5], ["low", 3]], ai: ["low", "Distracting, but the room is still usable."] },
    { title: "Exterior light out by entrance", desc: "Light over the main entrance is out — feels unsafe after dark.", priority: [["high", 5], ["medium", 2]], ai: ["high", "A dark entrance is a personal-safety concern at night.", true] },
  ],
  "Doors & Locks": [
    { title: "Card reader not working", desc: "BuzzCard reader flashes red for every card.", priority: [["high", 6], ["urgent", 2]], ai: ["high", "Residents can't get in, and doors may get propped open.", true] },
    { title: "Door won't latch", desc: "Door doesn't close all the way, so it can't lock.", priority: [["high", 5], ["medium", 3]], ai: ["high", "A door that can't lock is a security issue.", true] },
    { title: "Lock is jammed", desc: "Key turns but the lock doesn't open.", priority: [["high", 4], ["urgent", 2]], ai: ["high", "Someone is locked out of their space until it's fixed.", true] },
  ],
  Furniture: [
    { title: "Broken desk chair", desc: "Chair base is cracked and it tips backward.", priority: [["low", 5], ["medium", 3]], ai: ["medium", "A chair that tips backward can injure someone; replace soon.", true] },
    { title: "Bed frame slats broken", desc: "Two slats snapped; mattress sags in the middle.", priority: [["medium", 6]], ai: ["medium", "Uncomfortable to sleep on, but no immediate risk."] },
    { title: "Wobbly lecture hall seats", desc: "Several seats in the back rows are loose.", priority: [["low", 6]], ai: ["low", "Loose seats are a minor annoyance."] },
  ],
  "Custodial / Cleaning": [
    { title: "Trash room overflowing", desc: "Trash room is full and bags are piling into the hallway.", priority: [["medium", 6], ["high", 2]], ai: ["medium", "Overflowing trash attracts pests if left for long."] },
    { title: "Spill in stairwell", desc: "Sticky spill on the stairwell landing — slip hazard.", priority: [["high", 4], ["medium", 3]], ai: ["high", "A spill on stairs is a fall risk.", true] },
    { title: "Restroom out of supplies", desc: "No soap or paper towels in the restroom.", priority: [["low", 4], ["medium", 4]], ai: ["low", "Quick restock; no risk."] },
  ],
  "Pest Control": [
    { title: "Ants in kitchen", desc: "Trail of ants along the counter near the sink.", priority: [["medium", 6], ["low", 2]], ai: ["low", "Ants are a nuisance but not a health emergency."] },
    { title: "Cockroach sighting", desc: "Saw cockroaches near the bathroom drain at night.", priority: [["medium", 5], ["high", 3]], ai: ["medium", "Roaches can spread quickly; treat this week."] },
  ],
  Appliances: [
    { title: "Washing machine broken", desc: "Laundry room washer won't start but still charges.", priority: [["medium", 6], ["low", 2]], ai: ["low", "Other washers are available; it's an inconvenience."] },
    { title: "Fridge not cooling", desc: "Apartment fridge is warm; food is spoiling.", priority: [["high", 6]], ai: ["medium", "Food is spoiling, but there's no safety risk."] },
    { title: "Water fountain not working", desc: "Bottle filler station has no water flow.", priority: [["low", 6]], ai: ["low", "Other fountains are nearby."] },
  ],
  Other: [
    { title: "Window won't close", desc: "Window is stuck partially open; rain gets in.", priority: [["high", 4], ["medium", 4]], ai: ["medium", "Rain getting in can damage the room; not dangerous."] },
    { title: "Ceiling tile damaged", desc: "Ceiling tile is cracked and sagging.", priority: [["medium", 5], ["low", 2]], ai: ["medium", "A sagging tile could fall; check it this week.", true] },
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

/** Same format the report form produces: "Room 214" / "Room 1116A", or one of the form's spots. */
const room = (floors: number, perFloor: number) => `Room ${Math.floor(between(1, floors + 1))}${String(Math.floor(between(1, perFloor))).padStart(2, "0")}`;
function locationFor(type: BType): string {
  switch (type) {
    case "residence":
      return weighted([
        [room(4, 40), 6],
        ["Hallway", 2],
        ["Restroom", 2],
        ["Lobby", 1],
        ["Stairwell", 1],
      ]);
    case "academic":
      return weighted([
        [room(3, 60), 5],
        ["Restroom", 3],
        ["Hallway", 2],
        ["Lobby", 1],
        ["Elevator", 1],
      ]);
    case "dining":
      return pick(["Lobby", "Restroom", "Hallway", "Outdoors"]);
    case "athletic":
      return pick(["Room 101", "Room 120", "Lobby", "Outdoors"]);
    default:
      return pick([room(2, 30), "Hallway", "Restroom", "Lobby"]);
  }
}

// ---------- duplicate reports + mislabeled urgencies (for Active issues and Smart Sort) ----------
const U_RANK: Record<U, number> = { low: 0, medium: 1, high: 2, urgent: 3 };
const maxU = (a: U, b: U): U => (U_RANK[a] >= U_RANK[b] ? a : b);
/** Pre-baked AI fields (stored exactly like a real AI result, marked ai_model = "seed"). */
/**
 * Same rules as lib/ai/run.ts: Smart Sort reviews only reports marked Urgent/High (the template's AI
 * rating); Medium/Low keep the reporter's urgency unless the text describes a hazard (then escalated).
 */
function aiFields(reporter: U, urgency: U, reason: string, safety: boolean, category: string, created: Date, text: string) {
  const at = new Date(created.getTime() + 2000).toISOString();
  if (isReviewedUrgency(reporter)) {
    return { ai_urgency: urgency, ai_reason: reason, ai_category: category, ai_safety: safety, ai_status: "done", ai_model: "seed", ai_reviewed: true, ai_at: at };
  }
  const esc = escalateForHazard(reporter, text, safety);
  return {
    ai_urgency: esc.urgency,
    ai_reason: esc.escalated ? reason : null,
    ai_category: category,
    ai_safety: esc.escalated,
    ai_status: "done",
    ai_model: "seed",
    ai_reviewed: esc.escalated,
    ai_at: at,
  };
}

type Report = { title: string; desc: string; loc: string; priority: U; hoursAgo: number; by?: "alex" | "priya"; status?: "assigned" | "in_progress" };
type Cluster = {
  key: string;
  building: RegExp;
  category: string;
  /** Short, clean title for the group (what the AI writes). */
  groupTitle: string;
  ai: [U, string, boolean?];
  /** Extra "Me too" votes from other students, on top of the reporters. */
  extraVotes: number;
  reports: Report[];
};

const CLUSTERS: Cluster[] = [
  {
    key: "glenn-leak",
    building: /Glenn Residence Hall$/,
    category: "Plumbing",
    groupTitle: "Water leaking from 3rd-floor ceiling",
    ai: ["high", "Active ceiling leak reported by several residents; risk of water damage and slippery floors.", true],
    extraVotes: 6,
    reports: [
      { title: "Water leaking from ceiling", desc: "Water dripping from a ceiling tile outside room 312, bucket placed underneath.", loc: "Hallway", priority: "urgent", hoursAgo: 30, status: "in_progress" },
      { title: "Ceiling dripping in hallway", desc: "Steady drip from the ceiling near the stairwell on the 3rd floor. Floor is wet.", loc: "Hallway", priority: "high", hoursAgo: 26, by: "alex" },
      { title: "Leak above bathroom", desc: "Brown water stain spreading on the bathroom ceiling and it's dripping now.", loc: "Restroom", priority: "medium", hoursAgo: 20 },
      { title: "Water coming through ceiling tile", desc: "Ceiling tile is soaked and sagging, water dripping onto the carpet.", loc: "Room 314", priority: "high", hoursAgo: 9 },
      { title: "Wet ceiling 3rd floor", desc: "Same leak others reported, still dripping tonight.", loc: "Hallway", priority: "low", hoursAgo: 3 },
    ],
  },
  {
    key: "towers-leak",
    building: /Towers Residence Hall$/,
    category: "Plumbing",
    groupTitle: "Ceiling leak in 2nd-floor lounge",
    ai: ["high", "Ongoing leak with several reports; water near the lounge floor is a slip risk.", true],
    extraVotes: 5,
    reports: [
      { title: "Water leaking from ceiling", desc: "Water dripping from the ceiling in the 2nd floor lounge onto the couches.", loc: "Room 205", priority: "urgent", hoursAgo: 22 },
      { title: "Lounge ceiling leaking", desc: "Puddle forming under a ceiling vent in the lounge.", loc: "Room 205", priority: "high", hoursAgo: 15 },
      { title: "Drip from ceiling vent", desc: "Water dripping out of the ceiling vent next to the lounge windows.", loc: "Room 205", priority: "medium", hoursAgo: 7 },
      { title: "Leak in lounge still going", desc: "The lounge ceiling is still leaking, there are towels everywhere.", loc: "Room 205", priority: "high", hoursAgo: 2 },
    ],
  },
  {
    key: "clough-elevator",
    building: /Clough/,
    category: "Elevator",
    groupTitle: "East elevator out of service",
    ai: ["high", "The east elevator is down, blocking step-free access to upper floors.", true],
    extraVotes: 3,
    reports: [
      { title: "Elevator out of service", desc: "East elevator doors won't open on any floor.", loc: "Elevator", priority: "high", hoursAgo: 18, status: "assigned" },
      { title: "East elevator broken", desc: "East elevator is stuck on the 4th floor and won't come when called.", loc: "Elevator", priority: "urgent", hoursAgo: 6 },
    ],
  },
  {
    key: "klaus-ac",
    building: /Klaus Advanced Computing/,
    category: "HVAC / Temperature",
    groupTitle: "Lecture hall 1443 too hot",
    ai: ["high", "A full lecture hall over 80°F affects many students at once."],
    extraVotes: 4,
    reports: [
      { title: "AC not cooling", desc: "Lecture hall 1443 is over 80°F during the 11am class.", loc: "Room 1443", priority: "high", hoursAgo: 28 },
      { title: "1443 is really hot", desc: "Room 1443 is super hot again today, the AC doesn't seem to be on.", loc: "Room 1443", priority: "medium", hoursAgo: 4 },
    ],
  },
  {
    key: "stucen-card",
    building: /Student Center$/,
    category: "Doors & Locks",
    groupTitle: "Side entrance card reader not working",
    ai: ["high", "The side entrance won't open for anyone, so people prop the door.", true],
    extraVotes: 2,
    reports: [
      { title: "Card reader not working", desc: "BuzzCard reader at the side entrance flashes red for every card.", loc: "Lobby", priority: "high", hoursAgo: 12 },
      { title: "Side door won't open", desc: "Side door card reader is broken, everyone has to walk around.", loc: "Lobby", priority: "medium", hoursAgo: 5 },
    ],
  },
  // Mislabeled urgencies: single reports where the AI disagrees with the reporter.
  {
    key: "lightbulb",
    building: /North Avenue Apartments North/,
    category: "Lighting",
    groupTitle: "Desk lamp bulb out",
    ai: ["low", "A single burned-out bulb is an inconvenience, not a safety risk."],
    extraVotes: 0,
    reports: [{ title: "Light bulb out", desc: "The bulb in my desk lamp fixture burned out. URGENT please, I can't study!!", loc: "Room 4107", priority: "urgent", hoursAgo: 5 }],
  },
  {
    key: "gas",
    building: /North Avenue Apartments North/,
    category: "Appliances",
    groupTitle: "Faint gas smell near stove",
    ai: ["urgent", "A gas smell is a potential safety hazard and should be checked right away.", true],
    extraVotes: 1,
    reports: [{ title: "Faint gas smell in kitchen", desc: "Faint gas-like smell near the stove in the 2nd floor kitchen since this afternoon. Probably nothing.", loc: "Room 210", priority: "low", hoursAgo: 3 }],
  },
  {
    key: "warm-room",
    building: /Towers Residence Hall$/,
    category: "HVAC / Temperature",
    groupTitle: "Room slightly warm",
    ai: ["low", "About 76°F with the AC running is mildly uncomfortable, not urgent."],
    extraVotes: 0,
    reports: [{ title: "Room too warm", desc: "My room is a bit warm, around 76°F, even though the AC is running.", loc: "Room 208", priority: "urgent", hoursAgo: 8 }],
  },
  {
    key: "wobbly-desk",
    building: /Clough/,
    category: "Furniture",
    groupTitle: "Wobbly study table",
    ai: ["low", "A wobbly table is a minor annoyance with no risk."],
    extraVotes: 0,
    reports: [{ title: "Wobbly desk", desc: "Study table on the 3rd floor wobbles when you write on it.", loc: "Room 312", priority: "high", hoursAgo: 10 }],
  },
];

// ---------- people ----------
// Demo personas get real sign-in accounts (see lib/demo-accounts.ts for emails).
const DEMO_USERS = DEMO_ACCOUNTS;
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

/**
 * (Re)create the Supabase Auth accounts for the demo personas.
 * Old demo accounts are deleted first so the password always matches DEMO_ACCOUNT_PASSWORD.
 * Accounts people created themselves through sign-up are left alone.
 */
async function createDemoAccounts(): Promise<Map<string, string>> {
  const wanted = new Set(DEMO_ACCOUNTS.map((a) => a.email));
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`list auth users: ${error.message}`);
    for (const u of data.users) {
      if (u.email && wanted.has(u.email)) {
        const del = await supabase.auth.admin.deleteUser(u.id);
        if (del.error) throw new Error(`delete ${u.email}: ${del.error.message}`);
      }
    }
    if (data.users.length < 1000) break;
  }
  const ids = new Map<string, string>();
  for (const a of DEMO_ACCOUNTS) {
    const { data, error } = await supabase.auth.admin.createUser({ email: a.email, password: demoPassword(), email_confirm: true, user_metadata: { name: a.name } });
    if (error || !data.user) throw new Error(`create ${a.email}: ${error?.message}. Is Email sign-in enabled in Supabase → Authentication → Providers?`);
    ids.set(a.email, data.user.id);
  }
  console.log(`✓ ${ids.size} demo sign-in accounts`);
  return ids;
}

async function wipe() {
  // Supabase requires a filter on delete; these match every row.
  {
    const { error } = await supabase.from("group_votes").delete().gte("group_id", 0);
    if (error) throw new Error(`wipe group_votes: ${error.message}. Did you run supabase/migrations/001_ai_features.sql?`);
  }
  for (const table of ["ai_calls", "request_events", "requests", "issue_groups"]) {
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

  const accounts = await createDemoAccounts();
  // Inserted in two batches: when one insert mixes rows with and without an `id`,
  // Supabase sends null for the missing ids instead of letting the database generate them.
  const demoRows = DEMO_USERS.map((u) => ({ ...u, id: accounts.get(u.email)!, is_demo: true }));
  const userRows = [
    ...EXTRA_TECHS.map((name) => ({ name, role: "technician", title: "Maintenance Technician", is_demo: false })),
    ...Array.from({ length: 40 }, (_, i) => ({
      name: `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}`,
      role: "reporter",
      title: i % 5 === 0 ? "Faculty / Staff" : "Student",
      is_demo: false,
    })),
  ];
  const users = [
    ...(await insertChunked("users", demoRows, "id, name, role, is_demo")),
    ...(await insertChunked("users", userRows, "id, name, role, is_demo")),
  ] as {
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
  type RequestRow = Record<string, unknown> & { _events: Record<string, unknown>[]; _group: string; _groupTitle?: string; _extraVotes?: number };
  const rows: RequestRow[] = [];

  const FRESH_UNASSIGNED = 12; // brand-new requests nobody has claimed yet
  // A few buildings with a real backlog right now, so the admin heat map has hot spots to show
  // (e.g. an old dorm with failing plumbing, a busy academic building). Thresholds: lib/campus/heat.ts
  const HOTSPOTS = [/Glenn Residence Hall$/, /Towers Residence Hall$/, /Clough/, /Howey Building$/, /Student Center$/]
    .map((re) => buildings.find((b) => re.test(b.name)))
    .filter((b): b is (typeof buildings)[number] => Boolean(b));
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
    // Recent requests cluster in the hot-spot buildings (the first two get the most).
    let hot = false;
    if (daysAgo < 12 && HOTSPOTS.length && rand() < 0.6) {
      // First two: badly backed up (red). The rest: busy but coping (yellow).
      const i = HOTSPOTS.indexOf(weighted(HOTSPOTS.map((b, j) => [b, j < 2 ? 3 : 1] as const)));
      building = HOTSPOTS[i];
      hot = i < 2;
    }
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
    // Hot-spot buildings are backed up, so their requests take much longer to clear.
    const backlog = hot ? between(3, 6) : daysAgo < 6 ? between(1.5, 3) : 1;
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

    const [aiU, aiWhy, aiSafety] = issue.ai;
    // About 1 in 13 reports is private (deterministic, so the rest of the random data doesn't shift).
    const isPrivate = rows.length % 13 === 5;
    rows.push({
      // Open, recent reports of the same issue in the same building share a group (what the AI would do).
      // Private reports are never grouped.
      _group: !isPrivate && status !== "resolved" && daysAgo < 30 ? `${building.id}|${issue.title}` : `solo-${rows.length}`,
      visibility: isPrivate ? "private" : "public",
      ...aiFields(priority as U, aiSafety ? maxU(aiU, priority as U) : aiU, aiWhy, Boolean(aiSafety), category, created, `${issue.title}. ${issue.desc}`),
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

  // Curated duplicate groups and mislabeled urgencies (see CLUSTERS).
  const priya = demoReporters.find((u) => u.name.includes("Priya"))!;
  const marcus = techs.find((t) => t.name === "Marcus Reed")!;
  const luis = techs.find((t) => t.name === "Luis Ortega")!;
  let curated = 0;
  for (const c of CLUSTERS) {
    const building = buildings.find((b) => c.building.test(b.name));
    if (!building) {
      console.warn(`  (skipped cluster ${c.key}: no building matches ${c.building})`);
      continue;
    }
    // Random open reports of the same issue in this building join the curated group, like the AI would.
    const sameIssue = `${building.id}|${c.reports[0].title}`;
    for (const r of rows) {
      if (r._group !== sameIssue) continue;
      r._group = c.key;
      // Keep the demo personas' votes predictable: they only appear in a group where CLUSTERS says so.
      if (demoReporters.some((d) => d.id === r.reporter_id)) {
        const stand = otherReporters[(rows.indexOf(r) * 11) % otherReporters.length];
        r.reporter_id = stand.id;
        r._events[0].actor_id = stand.id;
      }
    }
    // Other students only, so Alex and Dr. Shah can still tap "Me too" in the demo.
    const pool = otherReporters.slice((curated * 7) % otherReporters.length).concat(otherReporters);
    c.reports.forEach((r, i) => {
      const created = new Date(now - r.hoursAgo * HOUR);
      const reporter = r.by === "alex" ? alex : r.by === "priya" ? priya : pool[i];
      const tech = c.category === "Elevator" ? luis : marcus;
      const at = (h: number) => new Date(created.getTime() + h * HOUR).toISOString();
      const events: Record<string, unknown>[] = [{ actor_id: reporter.id, from_status: null, to_status: "submitted", note: null, created_at: created.toISOString() }];
      if (r.status) events.push({ actor_id: tech.id, from_status: "submitted", to_status: "assigned", note: null, created_at: at(1) });
      if (r.status === "in_progress") events.push({ actor_id: tech.id, from_status: "assigned", to_status: "in_progress", note: "Found the source above the ceiling; waiting on a part.", created_at: at(3) });
      rows.push({
        _group: c.key,
        _groupTitle: c.groupTitle,
        _extraVotes: i === 0 ? c.extraVotes : 0,
        ...aiFields(r.priority, c.ai[2] ? maxU(c.ai[0], r.priority) : c.ai[0], c.ai[1], Boolean(c.ai[2]), c.category, created, `${r.title}. ${r.desc}`),
        title: r.title,
        description: r.desc,
        building_id: building.id,
        area: building.area,
        location_detail: r.loc,
        visibility: "public",
        category: c.category,
        priority: r.priority,
        status: r.status ?? "submitted",
        reporter_id: reporter.id,
        assignee_id: r.status ? tech.id : null,
        photo_url: null,
        created_at: created.toISOString(),
        updated_at: events[events.length - 1].created_at as string,
        resolved_at: null,
        _events: events,
      });
    });
    curated++;
  }

  // One of Alex's own open reports (outside the curated groups) is private, to demo the Private badge.
  const alexPrivate = rows.find((r) => r.reporter_id === alex.id && r.status !== "resolved" && !CLUSTERS.some((c) => c.key === r._group));
  if (alexPrivate) {
    alexPrivate.visibility = "private";
    alexPrivate._group = `solo-alex-private`;
  }
  // The demo personas start under the "5 reports per hour" limit: nothing of theirs in the last 2 hours.
  for (const r of rows) {
    if (demoReporters.some((d) => d.id === r.reporter_id) && Date.parse(String(r.created_at)) > now - 2 * HOUR) {
      const shift = now - 2 * HOUR - Date.parse(String(r.created_at)) - HOUR;
      const move = (t: unknown) => (t ? new Date(Date.parse(String(t)) + shift).toISOString() : t);
      r.created_at = move(r.created_at);
      r.updated_at = move(r.updated_at);
      r.resolved_at = move(r.resolved_at);
      for (const e of r._events) e.created_at = move(e.created_at);
    }
  }

  rows.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));

  // One issue group per _group key, created at its first report.
  const groupKeys = [...new Set(rows.map((r) => r._group))];
  const firstOf = new Map(groupKeys.map((k) => [k, rows.find((r) => r._group === k)!]));
  const groups = (await insertChunked(
    "issue_groups",
    groupKeys.map((k) => {
      const r = firstOf.get(k)!;
      const last = rows.filter((x) => x._group === k).at(-1)!;
      return { building_id: r.building_id, category: r.category, title: r._groupTitle ?? r.title, created_at: r.created_at, updated_at: last.updated_at };
    }),
    "id",
  )) as { id: number }[];
  const groupId = new Map(groupKeys.map((k, i) => [k, groups[i].id]));

  const inserted = (await insertChunked(
    "requests",
    rows.map((r) => {
      const { _events, _group, _groupTitle, _extraVotes, ...row } = r; // eslint-disable-line @typescript-eslint/no-unused-vars
      return { ...row, group_id: groupId.get(_group)! };
    }),
    "id",
  )) as { id: number }[];

  // Votes: every reporter counts as a vote on their group, plus extra "Me too" votes from other students.
  const votes = new Map<string, Record<string, unknown>>();
  rows.forEach((r) => {
    if (r.visibility === "private") return; // private requests never count toward "students affected"
    const gid = groupId.get(r._group)!;
    votes.set(`${gid}|${r.reporter_id}`, { group_id: gid, user_id: r.reporter_id, created_at: r.created_at });
  });
  rows.forEach((r, n) => {
    const gid = groupId.get(r._group)!;
    for (let i = 0, added = 0; added < (r._extraVotes ?? 0) && i < otherReporters.length; i++) {
      const u = otherReporters[(n * 3 + i * 5) % otherReporters.length];
      const k = `${gid}|${u.id}`;
      if (votes.has(k)) continue;
      votes.set(k, { group_id: gid, user_id: u.id, created_at: new Date(Date.parse(String(r.created_at)) + (added + 1) * HOUR).toISOString() });
      added++;
    }
  });
  await insertChunked("group_votes", [...votes.values()], "group_id");
  const multi = groupKeys.filter((k) => rows.filter((r) => r._group === k).length > 1).length;
  console.log(`✓ ${groups.length} issue groups (${multi} with duplicate reports) and ${votes.size} votes`);

  const events = rows.flatMap((r, i) => r._events.map((e) => ({ ...e, request_id: inserted[i].id })));
  await insertChunked("request_events", events, "id");

  const open = rows.filter((r) => r.status !== "resolved").length;
  console.log(`✓ ${inserted.length} requests (${open} open) and ${events.length} timeline events`);
  console.log("\nDemo accounts (sign in at /login):");
  console.table(DEMO_ACCOUNTS.map((a) => ({ role: a.role, name: a.name, email: a.email, password: demoPassword() })));
  console.log("\nDone! Start the app with: npm run dev");
}

main().catch((err) => {
  console.error("\n✗ Seed failed:", err.message ?? err);
  process.exit(1);
});
