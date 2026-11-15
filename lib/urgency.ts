import { PRIORITY_RANK } from "./constants";
import type { Priority, Ticket } from "./types";

type UrgencyFields = Pick<Ticket, "priority" | "ai_urgency" | "ai_status" | "ai_reviewed" | "triage_urgency">;

/**
 * What the queue should treat as the request's urgency: technician's choice → Smart Sort review → reporter.
 * Only reviewed requests (reported Urgent/High, or an escalated Medium/Low hazard) use the AI value.
 */
export function effectiveUrgency(t: UrgencyFields): Priority {
  if (t.triage_urgency) return t.triage_urgency;
  return t.ai_reviewed && t.ai_status === "done" && t.ai_urgency ? t.ai_urgency : t.priority;
}

/** Smart Sort reviewed it and disagrees with the reporter. */
export function aiDisagrees(t: UrgencyFields): boolean {
  return t.ai_reviewed && t.ai_status === "done" && t.ai_urgency != null && t.ai_urgency !== t.priority;
}

const HIGH_RANK = PRIORITY_RANK.high; // PRIORITY_RANK: urgent 0 … low 3 (lower = more urgent)

/**
 * 0: confirmed Urgent/High (reviewed, escalated, set by a technician, or not yet rated: we keep the
 *    reporter's urgency when unsure); 1: downgraded from Urgent/High; 2: everything else.
 */
export function smartTier(t: UrgencyFields): 0 | 1 | 2 {
  const e = PRIORITY_RANK[effectiveUrgency(t)];
  if (e <= HIGH_RANK) return 0;
  if (e > PRIORITY_RANK[t.priority]) return 1;
  return 2;
}

/**
 * Smart Sort: confirmed Urgent and High first (urgency, then students affected, then oldest),
 * then downgraded requests (same order), then the rest in the normal order (reporter's urgency, oldest).
 */
export function smartSort<T extends UrgencyFields & { created_at: string }>(list: T[], affected: (t: T) => number): T[] {
  return [...list].sort((a, b) => {
    const ta = smartTier(a);
    const tb = smartTier(b);
    if (ta !== tb) return ta - tb;
    if (ta === 2) return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.created_at.localeCompare(b.created_at);
    return PRIORITY_RANK[effectiveUrgency(a)] - PRIORITY_RANK[effectiveUrgency(b)] || affected(b) - affected(a) || a.created_at.localeCompare(b.created_at);
  });
}

/**
 * Smart Sort shows its badge only on requests it reviews: reported Urgent/High (rated, or waiting /
 * failed to be rated), or a Medium/Low request escalated for a safety hazard.
 */
export function showsAiUrgency(t: Pick<UrgencyFields, "priority" | "ai_reviewed">): boolean {
  return t.ai_reviewed || t.priority === "urgent" || t.priority === "high";
}
