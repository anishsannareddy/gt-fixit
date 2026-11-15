import "server-only";
import { OPEN_STATUSES } from "./constants";
import { db } from "./supabase/server";
import type { Status, TicketEvent } from "./types";

/** An active (not resolved) issue group, as students see it. Never includes other students' names. */
export type ActiveIssue = {
  id: number;
  title: string;
  category: string;
  building: { id: number; name: string; short_name: string | null };
  /** Most advanced status among its open reports. */
  status: Status;
  /** Students affected = votes (each reporter counts as a vote). */
  affected: number;
  reports: number;
  /** The viewer tapped Me too. */
  voted: boolean;
  /** The viewer reported one of its open reports (their vote can't be removed). */
  reported: boolean;
  updated_at: string;
};

export type IssueReport = { id: number; title: string; description: string; location_detail: string; status: Status; created_at: string; mine: boolean };
export type IssueDetail = { reports: IssueReport[]; events: TicketEvent[] };

const STATUS_STEP: Record<Status, number> = { submitted: 0, assigned: 1, in_progress: 2, resolved: 3 };

type OpenRow = IssueReport & { group_id: number; reporter_id: string; updated_at: string };

async function loadOpen(filter: { buildingId?: number } = {}) {
  let q = db()
    .from("requests")
    .select("id, group_id, title, description, location_detail, status, created_at, updated_at, reporter_id, building_id")
    .in("status", OPEN_STATUSES)
    .eq("visibility", "public") // private requests never appear in Active issues
    .order("created_at", { ascending: true });
  if (filter.buildingId) q = q.eq("building_id", filter.buildingId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as (OpenRow & { building_id: number })[];
}

/** Active issue groups, sorted by most affected, then most recently updated. */
export async function getActiveIssues(viewerId: string, opts: { buildingId?: number; q?: string } = {}): Promise<ActiveIssue[]> {
  const rows = await loadOpen(opts);
  const groupIds = [...new Set(rows.map((r) => r.group_id))];
  if (!groupIds.length) return [];

  const [groupsRes, votesRes] = await Promise.all([
    db().from("issue_groups").select("id, title, category, building:buildings(id, name, short_name)").in("id", groupIds),
    db().from("group_votes").select("group_id, user_id").in("group_id", groupIds),
  ]);
  if (groupsRes.error) throw new Error(groupsRes.error.message);
  if (votesRes.error) throw new Error(votesRes.error.message);
  const votes = votesRes.data ?? [];

  const issues: ActiveIssue[] = [];
  for (const g of (groupsRes.data ?? []) as unknown as { id: number; title: string; category: string; building: ActiveIssue["building"] | null }[]) {
    if (!g.building) continue;
    const members = rows.filter((r) => r.group_id === g.id);
    const gv = votes.filter((v) => v.group_id === g.id);
    issues.push({
      id: g.id,
      title: g.title,
      category: g.category,
      building: g.building,
      status: members.reduce<Status>((s, r) => (STATUS_STEP[r.status] > STATUS_STEP[s] ? r.status : s), "submitted"),
      affected: Math.max(gv.length, 1),
      reports: members.length,
      voted: gv.some((v) => v.user_id === viewerId),
      reported: members.some((r) => r.reporter_id === viewerId),
      updated_at: members.reduce((t, r) => (r.updated_at > t ? r.updated_at : t), ""),
    });
  }

  const q = opts.q?.trim().toLowerCase();
  return issues
    .filter((i) => !q || [i.title, i.category, i.building.name, i.building.short_name ?? ""].some((s) => s.toLowerCase().includes(q)))
    .sort((a, b) => b.affected - a.affected || b.updated_at.localeCompare(a.updated_at));
}

/**
 * Reports + combined status timeline for the given groups (open reports only).
 * Students are anonymous: "You" or "A student". Notes written by students are left out.
 */
export async function getIssueDetails(viewerId: string, groupIds: number[]): Promise<Record<number, IssueDetail>> {
  if (!groupIds.length) return {};
  const { data, error } = await db()
    .from("requests")
    .select("id, group_id, title, description, location_detail, status, created_at, reporter_id")
    .in("group_id", groupIds)
    .in("status", OPEN_STATUSES)
    .eq("visibility", "public")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as OpenRow[];

  const { data: ev, error: evError } = await db()
    .from("request_events")
    .select("*, actor:users(id, name, role)")
    .in("request_id", rows.map((r) => r.id))
    .order("created_at", { ascending: true });
  if (evError) throw new Error(evError.message);

  const groupOf = new Map(rows.map((r) => [r.id, r.group_id]));
  const out: Record<number, IssueDetail> = {};
  for (const gid of groupIds) out[gid] = { reports: [], events: [] };
  for (const r of rows) {
    out[r.group_id].reports.push({ id: r.id, title: r.title, description: r.description, location_detail: r.location_detail, status: r.status, created_at: r.created_at, mine: r.reporter_id === viewerId });
  }
  for (const e of (ev ?? []) as TicketEvent[]) {
    const gid = groupOf.get(e.request_id);
    if (gid == null) continue;
    const student = e.actor?.role === "reporter";
    if (student && e.from_status === e.to_status) continue; // a student's own note stays private
    out[gid].events.push({
      ...e,
      note: student ? null : e.note,
      actor: student && e.actor ? { ...e.actor, id: "", name: e.actor.id === viewerId ? "You" : "A student" } : e.actor,
    });
  }
  return out;
}
