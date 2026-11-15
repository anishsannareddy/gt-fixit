import type { Priority } from "../types";

/**
 * The safety rule, enforced in code (the prompt asks for it too, but we don't rely on that):
 *   - Potential hazards are never rated below the reporter's urgency.
 *   - Clear, severe hazards are never rated below High.
 *   - When the model isn't confident, keep or raise the reporter's urgency.
 */
const RANK: Record<Priority, number> = { low: 0, medium: 1, high: 2, urgent: 3 };
export const maxUrgency = (a: Priority, b: Priority): Priority => (RANK[a] >= RANK[b] ? a : b);

type Hazard = { label: string; re: RegExp; severe: boolean };
const HAZARDS: Hazard[] = [
  { label: "gas", severe: true, re: /\bgas\b[^.]{0,20}\b(smell|leak|odou?r)|\b(smell|odou?r)\w*[^.]{0,20}\bgas\b|gas-like|carbon monoxide|\bco (alarm|detector)/i },
  { label: "fire or smoke", severe: true, re: /\b(fire|flames?|smoke|smoking|burning smell|smells? (like )?burning|scorch\w*)\b/i },
  { label: "electrical", severe: true, re: /\bspark\w*|exposed wir\w*|bare wire|live wire|electric(al)? shock|got shocked|(outlet|plug|socket)[^.]{0,20}\b(hot|melt\w*|smok\w*)/i },
  { label: "flooding", severe: true, re: /\bflood\w*|standing water|burst pipe|water (everywhere|pouring|gushing)|sewage/i },
  { label: "elevator entrapment", severe: true, re: /\b(trapped|stuck)\b[^.]{0,20}\belevator|elevator[^.]{0,40}\b(trapped|stuck between|stopping between|stall\w*)/i },
  { label: "water leak near ceiling or electrics", severe: false, re: /\b(leak|drip)\w*[^.]{0,40}\b(ceiling|light|fixture|outlet)|\b(ceiling|light fixture)\b[^.]{0,40}\b(leak|drip)\w*/i },
  { label: "structural damage", severe: false, re: /\bcollaps\w*|structural|ceiling[^.]{0,20}\b(sagging|caving|falling)|crack\w*[^.]{0,15}\b(wall|ceiling|beam|foundation|stairs?)/i },
  { label: "blocked exit", severe: false, re: /\b(fire exit|emergency exit|exit door|stairwell door)\b[^.]{0,30}\b(blocked|locked|jammed|won'?t open)|\bblocked (exit|stair\w*)/i },
  { label: "security or locks", severe: false, re: /\b(door|lock)\b[^.]{0,30}\b(won'?t|doesn'?t|can'?t|cannot|not) (lock|latch|close)|broken lock|card reader|propped open|security/i },
  { label: "injury risk", severe: false, re: /\binjur\w*|\bhurt\b|bleed\w*|trip(ping)? hazard|slip(pery| hazard)|fall hazard|tips? (over|backward)/i },
];

export function detectHazards(text: string): { labels: string[]; severe: boolean } {
  const hits = HAZARDS.filter((h) => h.re.test(text));
  return { labels: hits.map((h) => h.label), severe: hits.some((h) => h.severe) };
}

export function applySafety(p: {
  model: Priority;
  reporter: Priority;
  modelFlaggedHazard: boolean;
  confidence: "low" | "medium" | "high";
  text: string;
}): { urgency: Priority; safety: boolean; hazards: string[] } {
  const hazards = detectHazards(p.text);
  const safety = p.modelFlaggedHazard || hazards.labels.length > 0;
  let urgency = p.model;
  if (safety || p.confidence === "low") urgency = maxUrgency(urgency, p.reporter);
  if (hazards.severe) urgency = maxUrgency(urgency, "high");
  return { urgency, safety, hazards: hazards.labels };
}
