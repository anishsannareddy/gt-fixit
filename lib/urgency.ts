import { PRIORITY_RANK } from "./constants";
import type { Priority, Ticket } from "./types";

type UrgencyFields = Pick<Ticket, "priority" | "ai_urgency" | "ai_status" | "triage_urgency">;

/** What the queue should treat as the request's urgency: technician's choice → AI → reporter. */
export function effectiveUrgency(t: UrgencyFields): Priority {
  return t.triage_urgency ?? (t.ai_status === "done" && t.ai_urgency ? t.ai_urgency : t.priority);
}

/** AI rated it and disagrees with the reporter. */
export function aiDisagrees(t: UrgencyFields): boolean {
  return t.ai_status === "done" && t.ai_urgency != null && t.ai_urgency !== t.priority;
}

/** Smart Sort: effective urgency, then students affected (most first), then oldest first. */
export function smartSort<T extends UrgencyFields & { created_at: string }>(list: T[], affected: (t: T) => number): T[] {
  return [...list].sort(
    (a, b) =>
      PRIORITY_RANK[effectiveUrgency(a)] - PRIORITY_RANK[effectiveUrgency(b)] || affected(b) - affected(a) || a.created_at.localeCompare(b.created_at),
  );
}
