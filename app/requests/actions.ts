"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import type { Status, User } from "@/lib/types";

export type TicketAction = "claim" | "assign" | "start" | "resolve" | "reopen";

type Ticket = { id: number; status: Status; assignee_id: string | null; reporter_id: string };

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
      return t.status === "submitted" || t.status === "assigned" ? null : "Only new or assigned requests can be reassigned.";
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

/** Single entry point for every status change. Writes the request + a timeline event. */
export async function updateTicket(formData: FormData) {
  const user = await requireUser();
  const id = Number(formData.get("id"));
  const action = String(formData.get("action")) as TicketAction;
  const note = String(formData.get("note") ?? "").trim().slice(0, 1000) || null;

  const { data: ticket } = await db()
    .from("requests")
    .select("id, status, assignee_id, reporter_id")
    .eq("id", id)
    .maybeSingle<Ticket>();
  if (!ticket) throw new Error("Request not found.");

  const reason = checkAllowed(action, ticket, user);
  if (reason) throw new Error(reason);

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
    if (!tech) throw new Error("Choose a technician.");
    to = "assigned";
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

  // `.eq("status", ticket.status)` guards against two people changing it at the same moment.
  const { data: updated, error } = await db()
    .from("requests")
    .update({ ...patch, status: to, updated_at: now })
    .eq("id", id)
    .eq("status", ticket.status)
    .select("id");
  if (error) throw new Error(error.message);
  if (!updated?.length) throw new Error("Someone else just updated this request. Refresh and try again.");

  await db().from("request_events").insert({
    request_id: id,
    actor_id: user.id,
    from_status: ticket.status,
    to_status: to,
    note: eventNote,
  });

  revalidatePath(`/requests/${id}`);
  revalidatePath("/tech");
  revalidatePath("/my-requests");
  revalidatePath("/admin");
}
