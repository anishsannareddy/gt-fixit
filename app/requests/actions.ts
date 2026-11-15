"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { PRIORITIES, PRIORITY_META, STATUSES, STATUS_META } from "@/lib/constants";
import type { Priority, Status, User } from "@/lib/types";

/**
 * Every change to a request goes through this file. Each action:
 *   1. checks who is signed in and what they're allowed to do (never trust the client)
 *   2. updates the request, guarded against two people changing it at the same moment
 *   3. writes a request_events row (the timeline + analytics)
 *   4. revalidates every page that shows requests, so all roles see the change
 * Actions RETURN a result instead of throwing, so the UI can show a toast.
 */
export type ActionResult = { ok: true; message: string } | { ok: false; error: string };

export type TicketAction = "claim" | "assign" | "start" | "resolve" | "reopen";

type Ticket = { id: number; status: Status; priority: Priority; assignee_id: string | null; reporter_id: string };

const fail = (error: string): ActionResult => ({ ok: false, error });

/** Who may do what. Returned string = reason it's not allowed. */
function checkAllowed(action: TicketAction, t: Ticket, user: User): string | null {
  const isStaff = user.role === "technician" || user.role === "admin";
  const isOwner = t.assignee_id === user.id;
  switch (action) {
    case "claim":
      if (user.role !== "technician") return "Only technicians can claim requests.";
      return t.status === "submitted" ? null : "This request was already picked up.";
    case "assign":
      if (user.role !== "admin") return "Only admins can assign requests.";
      return t.status === "resolved" ? "Reopen the request before assigning it." : null;
    case "start":
      if (!isStaff || (user.role === "technician" && !isOwner)) return "Only the assigned technician can start this.";
      return t.status === "assigned" ? null : "This request isn't in the Assigned state.";
    case "resolve":
      if (!isStaff || (user.role === "technician" && !isOwner)) return "Only the assigned technician can resolve this.";
      return t.status === "assigned" || t.status === "in_progress" ? null : "This request is already resolved.";
    case "reopen":
      if (user.role !== "admin" && t.reporter_id !== user.id) return "Only the reporter or an admin can reopen.";
      return t.status === "resolved" ? null : "Only resolved requests can be reopened.";
  }
}

async function loadTicket(id: number): Promise<Ticket | null> {
  if (!Number.isInteger(id) || id <= 0) return null;
  const { data } = await db().from("requests").select("id, status, priority, assignee_id, reporter_id").eq("id", id).maybeSingle<Ticket>();
  return data ?? null;
}

function revalidateAll(id: number) {
  revalidatePath(`/requests/${id}`);
  revalidatePath("/tech");
  revalidatePath("/my-requests");
  revalidatePath("/admin", "layout");
}

/**
 * Apply an update + timeline event. `.eq("status", from)` makes it fail cleanly if someone
 * else changed the request since we read it.
 */
async function commit(user: User, t: Ticket, to: Status, patch: Record<string, unknown>, note: string | null): Promise<string | null> {
  const now = new Date().toISOString();
  const { data: updated, error } = await db()
    .from("requests")
    .update({ ...patch, status: to, updated_at: now })
    .eq("id", t.id)
    .eq("status", t.status)
    .select("id");
  if (error) return error.message;
  if (!updated?.length) return "Someone else just updated this request. Refresh and try again.";
  await db().from("request_events").insert({ request_id: t.id, actor_id: user.id, from_status: t.status, to_status: to, note });
  revalidateAll(t.id);
  return null;
}

const SUCCESS: Record<TicketAction, string> = {
  claim: "Claimed. It's in My work now.",
  assign: "Technician assigned.",
  start: "Marked in progress.",
  resolve: "Marked resolved.",
  reopen: "Request reopened.",
};

/** Workflow steps: claim, assign, start, resolve, reopen. */
export async function updateTicket(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const id = Number(formData.get("id"));
  const action = String(formData.get("action")) as TicketAction;
  const note = String(formData.get("note") ?? "").trim().slice(0, 1000) || null;

  const ticket = await loadTicket(id);
  if (!ticket) return fail("Request not found.");
  if (!(action in SUCCESS)) return fail("Unknown action.");
  const reason = checkAllowed(action, ticket, user);
  if (reason) return fail(reason);

  const now = new Date().toISOString();
  let to: Status = ticket.status;
  let patch: Record<string, unknown> = {};
  let eventNote = note;

  if (action === "claim") {
    to = "assigned";
    patch = { assignee_id: user.id };
  } else if (action === "assign") {
    const assigneeId = String(formData.get("assignee_id") ?? "");
    const { data: tech } = await db().from("users").select("id, name").eq("id", assigneeId).eq("role", "technician").maybeSingle();
    if (!tech) return fail("Choose a technician.");
    // Keep "in progress" if work already started; otherwise it becomes "assigned".
    to = ticket.status === "in_progress" ? "in_progress" : "assigned";
    patch = { assignee_id: tech.id };
    eventNote = [`Assigned to ${tech.name}`, note].filter(Boolean).join(" — ");
  } else if (action === "start") {
    to = "in_progress";
  } else if (action === "resolve") {
    to = "resolved";
    patch = { resolved_at: now };
  } else if (action === "reopen") {
    to = "submitted";
    patch = { resolved_at: null, assignee_id: null };
  }

  const error = await commit(user, ticket, to, patch, eventNote);
  return error ? fail(error) : { ok: true, message: SUCCESS[action] };
}

/**
 * Admin: set any status. Keeps the data consistent:
 * assigned / in progress need a technician; resolved sets resolved_at; anything else clears it;
 * back to submitted clears the technician.
 */
export async function setStatus(formData: FormData): Promise<ActionResult> {
  const user = await requireUser(["admin"]);
  const ticket = await loadTicket(Number(formData.get("id")));
  if (!ticket) return fail("Request not found.");
  const to = String(formData.get("status")) as Status;
  if (!STATUSES.includes(to)) return fail("Choose a status.");
  if (to === ticket.status) return fail(`It's already ${STATUS_META[to].label.toLowerCase()}.`);
  if ((to === "assigned" || to === "in_progress") && !ticket.assignee_id) return fail("Assign a technician first.");

  const patch: Record<string, unknown> = { resolved_at: to === "resolved" ? new Date().toISOString() : null };
  if (to === "submitted") patch.assignee_id = null;
  const note = String(formData.get("note") ?? "").trim().slice(0, 1000) || null;
  const error = await commit(user, ticket, to, patch, note);
  return error ? fail(error) : { ok: true, message: `Status set to ${STATUS_META[to].label}.` };
}

/** Admin: change priority. Logged on the timeline as a note-only event (status unchanged). */
export async function setPriority(formData: FormData): Promise<ActionResult> {
  const user = await requireUser(["admin"]);
  const ticket = await loadTicket(Number(formData.get("id")));
  if (!ticket) return fail("Request not found.");
  const priority = String(formData.get("priority")) as Priority;
  if (!PRIORITIES.includes(priority)) return fail("Choose a priority.");
  if (priority === ticket.priority) return fail(`It's already ${PRIORITY_META[priority].label}.`);

  const { error } = await db().from("requests").update({ priority, updated_at: new Date().toISOString() }).eq("id", ticket.id);
  if (error) return fail(error.message);
  await db()
    .from("request_events")
    .insert({
      request_id: ticket.id,
      actor_id: user.id,
      from_status: ticket.status,
      to_status: ticket.status,
      note: `Priority changed: ${PRIORITY_META[ticket.priority].label} → ${PRIORITY_META[priority].label}`,
    });
  revalidateAll(ticket.id);
  return { ok: true, message: `Priority set to ${PRIORITY_META[priority].label}.` };
}

/** Add a note to the timeline without changing status. Admins on any request; technicians on their own. */
export async function addNote(formData: FormData): Promise<ActionResult> {
  const user = await requireUser(["admin", "technician"]);
  const ticket = await loadTicket(Number(formData.get("id")));
  if (!ticket) return fail("Request not found.");
  if (user.role === "technician" && ticket.assignee_id !== user.id) return fail("You can only add notes to requests assigned to you.");
  const note = String(formData.get("note") ?? "").trim().slice(0, 1000);
  if (!note) return fail("Write a note first.");

  const { error } = await db()
    .from("request_events")
    .insert({ request_id: ticket.id, actor_id: user.id, from_status: ticket.status, to_status: ticket.status, note });
  if (error) return fail(error.message);
  await db().from("requests").update({ updated_at: new Date().toISOString() }).eq("id", ticket.id);
  revalidateAll(ticket.id);
  return { ok: true, message: "Note added." };
}
