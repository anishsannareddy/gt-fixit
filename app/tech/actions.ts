"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { OPEN_STATUSES, PRIORITIES, PRIORITY_META } from "@/lib/constants";
import { db } from "@/lib/supabase/server";
import type { Priority, Status } from "@/lib/types";
import type { ActionResult } from "@/app/requests/actions";

/** Turn Smart Sort on or off for the signed-in technician/admin (saved per user). */
export async function setSmartSort(on: boolean): Promise<ActionResult> {
  const user = await requireUser(["technician", "admin"]);
  const { error } = await db().from("users").update({ smart_sort: Boolean(on) }).eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/tech");
  return { ok: true, message: on ? "Smart Sort is on: most urgent first." : "Smart Sort is off." };
}

/**
 * Accept or override the AI urgency in one tap. Technicians: unassigned requests or their own;
 * admins: any. The reporter's priority is never changed. Logged on the timeline as a note-only event.
 */
export async function setTriageUrgency(id: number, urgency: Priority): Promise<ActionResult> {
  const user = await requireUser(["technician", "admin"]);
  if (!PRIORITIES.includes(urgency)) return { ok: false, error: "Choose an urgency." };
  const { data: t } = await db()
    .from("requests")
    .select("id, status, assignee_id, ai_urgency, triage_urgency")
    .eq("id", id)
    .maybeSingle<{ id: number; status: Status; assignee_id: string | null; ai_urgency: Priority | null; triage_urgency: Priority | null }>();
  if (!t) return { ok: false, error: "Request not found." };
  if (!OPEN_STATUSES.includes(t.status)) return { ok: false, error: "This request is already resolved." };
  if (user.role === "technician" && t.assignee_id && t.assignee_id !== user.id) return { ok: false, error: "Only the assigned technician can change this." };
  if (t.triage_urgency === urgency) return { ok: true, message: `Already set to ${PRIORITY_META[urgency].label}.` };

  const now = new Date().toISOString();
  const { error } = await db().from("requests").update({ triage_urgency: urgency, triage_by: user.id, triage_at: now, updated_at: now }).eq("id", t.id);
  if (error) return { ok: false, error: error.message };
  const accepted = t.ai_urgency === urgency;
  await db()
    .from("request_events")
    .insert({
      request_id: t.id,
      actor_id: user.id,
      from_status: t.status,
      to_status: t.status,
      note: `Urgency set to ${PRIORITY_META[urgency].label}${t.ai_urgency ? (accepted ? " (accepted AI suggestion)" : ` · AI suggested ${PRIORITY_META[t.ai_urgency].label}`) : ""}`,
    });
  revalidatePath("/tech");
  revalidatePath(`/requests/${t.id}`);
  revalidatePath("/admin", "layout");
  return { ok: true, message: accepted ? `Accepted: ${PRIORITY_META[urgency].label}.` : `Urgency set to ${PRIORITY_META[urgency].label}.` };
}
