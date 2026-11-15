"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { PHOTO_BUCKET, PRIORITIES, PRIORITY_META, STATUSES, STATUS_META } from "@/lib/constants";
import { canDeleteRequest, photoPathFromUrl } from "@/lib/permissions";
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

/**
 * Reporter: make their request public or private.
 * Private → it leaves any shared issue group (a new group of its own), its "Me too" vote is removed,
 * and the old group's title is refreshed if it was this request's. Public → the reporter counts again.
 * Public requests are not re-grouped automatically; the AI only groups at submission.
 */
export async function setVisibility(id: number, visibility: "public" | "private"): Promise<ActionResult> {
  const user = await requireUser(["reporter"]);
  if (visibility !== "public" && visibility !== "private") return fail("Choose Public or Private.");
  const { data: t } = await db()
    .from("requests")
    .select("id, title, category, building_id, group_id, reporter_id, status, visibility")
    .eq("id", Number.isInteger(id) ? id : 0)
    .maybeSingle<{ id: number; title: string; category: string; building_id: number; group_id: number; reporter_id: string; status: Status; visibility: string }>();
  if (!t || t.reporter_id !== user.id) return fail("Request not found.");
  if (t.visibility === visibility) return { ok: true, message: visibility === "private" ? "Already private." : "Already public." };

  const sb = db();
  if (visibility === "private") {
    const { data: others } = await sb.from("requests").select("id, title, reporter_id, created_at").eq("group_id", t.group_id).neq("id", t.id).order("created_at");
    let groupId = t.group_id;
    if (others?.length) {
      const { data: g, error } = await sb.from("issue_groups").insert({ building_id: t.building_id, category: t.category, title: t.title }).select("id").single();
      if (error || !g) return fail(error?.message ?? "Could not update the request.");
      groupId = g.id;
      // The old group keeps its other reports; refresh its title if it came from this one.
      const { data: old } = await sb.from("issue_groups").select("title").eq("id", t.group_id).single();
      if (old?.title === t.title) await sb.from("issue_groups").update({ title: others[0].title }).eq("id", t.group_id);
    }
    const { error } = await sb.from("requests").update({ visibility, group_id: groupId, updated_at: new Date().toISOString() }).eq("id", t.id);
    if (error) return fail(error.message);
    // No "students affected" vote for private requests, unless they also reported another public one in the old group.
    if (!others?.some((o) => o.reporter_id === user.id)) await sb.from("group_votes").delete().eq("group_id", t.group_id).eq("user_id", user.id);
  } else {
    const { error } = await sb.from("requests").update({ visibility, updated_at: new Date().toISOString() }).eq("id", t.id);
    if (error) return fail(error.message);
    await sb.from("group_votes").upsert({ group_id: t.group_id, user_id: user.id }, { onConflict: "group_id,user_id", ignoreDuplicates: true });
  }
  await sb.from("request_events").insert({ request_id: t.id, actor_id: user.id, from_status: t.status, to_status: t.status, note: visibility === "private" ? "Made private" : "Made public" });
  revalidateAll(t.id);
  revalidatePath("/issues");
  revalidatePath("/report");
  return { ok: true, message: visibility === "private" ? "Now private: only you and maintenance staff can see it." : "Now public: it shows in Active issues." };
}

/**
 * Permanently delete a request (students: their own, before work starts; admins: any).
 * One database transaction (delete_request in migration 002) removes the request, its history,
 * and its issue-group membership (an emptied group goes with its votes), and writes a minimal
 * audit row. Then the photo is removed from Storage and every page that lists requests is refreshed.
 */
export async function deleteRequest(id: number): Promise<ActionResult & { redirectTo?: string }> {
  const user = await requireUser(["reporter", "admin"]);
  if (!Number.isInteger(id) || id <= 0) return fail("Request not found.");
  const { data: t } = await db().from("requests").select("id, status, reporter_id").eq("id", id).maybeSingle<{ id: number; status: Status; reporter_id: string }>();
  if (!t) return fail("This request was already removed.");
  if (!canDeleteRequest(user, t)) {
    return fail(user.role === "reporter" && t.reporter_id === user.id ? "Work has already started on this request, so it can't be deleted." : "You can't delete this request.");
  }

  const { data, error } = await db().rpc("delete_request", { p_id: id, p_actor: user.id, p_role: user.role });
  if (error) return fail(/delete_request/.test(error.message) ? "Deleting needs the latest database update (supabase/migrations/002_visibility_review_delete.sql)." : error.message);
  const row = (Array.isArray(data) ? data[0] : data) as { photo_url: string | null } | undefined;
  const path = photoPathFromUrl(row?.photo_url ?? null, PHOTO_BUCKET);
  if (path) await db().storage.from(PHOTO_BUCKET).remove([path]);

  revalidateAll(id);
  revalidatePath("/issues");
  revalidatePath("/report");
  revalidatePath("/admin/analytics");
  return { ok: true, message: `Request #${id} was deleted.`, redirectTo: user.role === "admin" ? "/admin" : "/my-requests" };
}

/**
 * Smart Sort stacks: Claim / Start / Resolve / Assign every open report in an issue group at once.
 * Each report goes through the same permission check and commit() as a single request, so each
 * gets its own timeline event and each reporter sees the change in My requests.
 * Reports another technician owns are left alone. Private requests are never in a shared group.
 */
export async function updateStack(formData: FormData): Promise<ActionResult> {
  const user = await requireUser(["technician", "admin"]);
  const groupId = Number(formData.get("group_id"));
  const action = String(formData.get("action")) as TicketAction;
  const note = String(formData.get("note") ?? "").trim().slice(0, 1000) || null;
  if (!Number.isInteger(groupId) || groupId <= 0) return fail("Issue not found.");
  if (!["claim", "start", "resolve", "assign"].includes(action)) return fail("Unknown action.");

  const { data: rows } = await db()
    .from("requests")
    .select("id, status, priority, assignee_id, reporter_id")
    .eq("group_id", groupId)
    .eq("visibility", "public")
    .neq("status", "resolved")
    .order("created_at");
  const tickets = (rows ?? []) as Ticket[];
  if (!tickets.length) return fail("These reports were already resolved.");

  let tech: { id: string; name: string } | null = null;
  if (action === "assign") {
    const { data } = await db().from("users").select("id, name").eq("id", String(formData.get("assignee_id") ?? "")).eq("role", "technician").maybeSingle();
    if (!data) return fail("Choose a technician.");
    tech = data;
  }

  const now = new Date().toISOString();
  let done = 0;
  let skipped = 0;
  for (const t of tickets) {
    if (checkAllowed(action, t, user)) {
      skipped++;
      continue;
    }
    let to: Status = t.status;
    let patch: Record<string, unknown> = {};
    let eventNote = note;
    if (action === "claim") {
      to = "assigned";
      patch = { assignee_id: user.id };
    } else if (action === "assign") {
      to = t.status === "in_progress" ? "in_progress" : "assigned";
      patch = { assignee_id: tech!.id };
      eventNote = [`Assigned to ${tech!.name}`, note].filter(Boolean).join(" — ");
    } else if (action === "start") {
      to = "in_progress";
    } else {
      to = "resolved";
      patch = { resolved_at: now };
    }
    const err = await commit(user, t, to, patch, eventNote);
    if (err) skipped++;
    else done++;
  }
  revalidatePath("/issues");
  if (!done) return fail(skipped ? "Nothing here you can do that to. Another technician may have picked these up." : "Nothing to update.");
  const verb = { claim: "Claimed", start: "Started", resolve: "Resolved", assign: "Assigned", reopen: "Reopened" }[action];
  return { ok: true, message: `${verb} ${done} report${done === 1 ? "" : "s"}${skipped ? ` (${skipped} left for another technician)` : ""}.` };
}
