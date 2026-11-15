/**
 * Report-form rules shared by the browser (instant feedback) and the server (the real check).
 * Keep this file free of server-only imports.
 */

/** Places that aren't a numbered room. */
export const SPOTS = ["Hallway", "Lobby", "Restroom", "Stairwell", "Elevator", "Outdoors"] as const;
export type Spot = (typeof SPOTS)[number];

export const ROOM_MAX = 6;
export const DESCRIPTION_MIN = 10;
export const DESCRIPTION_MAX = 300;
export const REPORTS_PER_HOUR = 5;

export const VISIBILITIES = ["public", "private"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

/** Digits with an optional single letter at the start or the end: 405, 1116A, G12. */
const ROOM_RE = /^(?:[A-Za-z]?\d+|\d+[A-Za-z])$/;

/** Returns an error message, or null if the room number is fine. */
export function roomError(raw: string): string | null {
  const room = raw.trim();
  if (!room) return "Enter the room number, or choose “Not in a room”.";
  if (room.length > ROOM_MAX) return `Room numbers are at most ${ROOM_MAX} characters.`;
  if (!ROOM_RE.test(room)) return "Use digits with an optional letter at the start or end, like 405, 1116A or G12. No spaces or symbols.";
  return null;
}

export function descriptionError(raw: string): string | null {
  const d = raw.trim();
  if (d.length < DESCRIPTION_MIN) return `Describe the problem in at least ${DESCRIPTION_MIN} characters.`;
  if (d.length > DESCRIPTION_MAX) return `Keep the description to ${DESCRIPTION_MAX} characters or fewer.`;
  return null;
}

/**
 * Where in the building: a room number or one of SPOTS. Returns the text stored in
 * `requests.location_detail` ("Room 1116A" or "Stairwell"), or an error.
 */
export function parseLocation(kind: string, room: string, spot: string): { ok: true; value: string } | { ok: false; field: "room" | "spot"; error: string } {
  if (kind === "spot") {
    return (SPOTS as readonly string[]).includes(spot) ? { ok: true, value: spot } : { ok: false, field: "spot", error: "Choose where it is." };
  }
  const err = roomError(room);
  return err ? { ok: false, field: "room", error: err } : { ok: true, value: `Room ${room.trim().toUpperCase()}` };
}
