/**
 * Runs AI triage for one stored request and saves the result. Shared by the app (lib/ai/service.ts,
 * after a submission) and `npm run ai:backfill`. Takes the Supabase client as a parameter so it
 * works in both. Never throws: failures are stored as ai_status = 'fallback'.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Priority } from "../types";
import type { GenerateStructured } from "./provider";
import { LIMITS, triage, type Candidate } from "./triage";

export const RATE_LIMITS = { triage: 15, similar: 40 } as const; // per user per hour
const OPEN = ["submitted", "assigned", "in_progress"];
const DAY = 86_400_000;

/** True if the user is under their hourly budget; records the call if so. */
export async function takeAiBudget(sb: SupabaseClient, userId: string, kind: keyof typeof RATE_LIMITS): Promise<boolean> {
  const since = new Date(Date.now() - 3_600_000).toISOString();
  const { count, error } = await sb.from("ai_calls").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("kind", kind).gte("created_at", since);
  if (error || (count ?? 0) >= RATE_LIMITS[kind]) return false;
  await sb.from("ai_calls").insert({ user_id: userId, kind });
  return true;
}

/**
 * Active groups in a building from the last 30 days (newest first), as AI candidates.
 * `before` limits it to groups that existed before a given time (used by the backfill).
 */
export async function loadCandidates(sb: SupabaseClient, buildingId: number, opts: { excludeGroupId?: number; before?: string } = {}): Promise<Candidate[]> {
  const before = opts.before ?? new Date().toISOString();
  const since = new Date(Date.parse(before) - 30 * DAY).toISOString();
  const { data } = await sb
    .from("requests")
    .select("group_id, description, title, created_at, group:issue_groups(id, title, category)")
    .eq("building_id", buildingId)
    .in("status", OPEN)
    .eq("visibility", "public") // private requests are never grouped
    .gte("created_at", since)
    .lt("created_at", before)
    .order("created_at", { ascending: false })
    .limit(200);
  const byGroup = new Map<number, Candidate>();
  for (const r of (data ?? []) as unknown as { group_id: number; description: string; title: string; group: { id: number; title: string; category: string } | null }[]) {
    if (!r.group || r.group_id === opts.excludeGroupId) continue;
    const c = byGroup.get(r.group_id);
    if (c) c.reports++;
    else byGroup.set(r.group_id, { id: r.group_id, title: r.group.title, category: r.group.category, reports: 1, sample: `${r.title}: ${r.description}` });
  }
  return [...byGroup.values()].slice(0, LIMITS.candidates);
}

/** Move a request (and its group's votes) into another group; delete the old group if it's empty. */
export async function mergeIntoGroup(sb: SupabaseClient, requestId: number, fromGroupId: number, toGroupId: number) {
  if (fromGroupId === toGroupId) return;
  await sb.from("requests").update({ group_id: toGroupId }).eq("id", requestId);
  const { data: votes } = await sb.from("group_votes").select("user_id, created_at").eq("group_id", fromGroupId);
  if (votes?.length) {
    await sb.from("group_votes").upsert(
      votes.map((v) => ({ group_id: toGroupId, user_id: v.user_id, created_at: v.created_at })),
      { onConflict: "group_id,user_id", ignoreDuplicates: true },
    );
  }
  const { count } = await sb.from("requests").select("id", { count: "exact", head: true }).eq("group_id", fromGroupId);
  if (!count) await sb.from("issue_groups").delete().eq("id", fromGroupId);
}

type Row = {
  id: number;
  title: string;
  description: string;
  location_detail: string;
  category: string;
  priority: Priority;
  building_id: number;
  group_id: number;
  visibility: "public" | "private";
  created_at: string;
  building: { name: string; type: string } | null;
};

export type RunResult = { status: "done" | "fallback"; urgency: Priority; reporter: Priority; merged: number | null; error?: string };

export async function runTriage(
  sb: SupabaseClient,
  requestId: number,
  generate: GenerateStructured,
  opts: {
    /** Rate-limit against this user (submissions). Omit for the backfill. */
    userId?: string;
    /** false = rate only, keep groups as they are (backfill without --regroup). */
    group?: boolean;
    /** Only consider groups that existed before this request (backfill). */
    chronological?: boolean;
    dryRun?: boolean;
  } = {},
): Promise<RunResult | null> {
  const { data } = await sb
    .from("requests")
    .select("id, title, description, location_detail, category, priority, building_id, group_id, visibility, created_at, building:buildings(name, type)")
    .eq("id", requestId)
    .maybeSingle();
  const req = data as unknown as Row | null;
  if (!req) return null;

  const saveFallback = async (error: string): Promise<RunResult> => {
    if (!opts.dryRun) await sb.from("requests").update({ ai_status: "fallback", ai_at: new Date().toISOString() }).eq("id", req.id);
    return { status: "fallback", urgency: req.priority, reporter: req.priority, merged: null, error };
  };

  if (opts.userId && !(await takeAiBudget(sb, opts.userId, "triage"))) return saveFallback("Rate limit reached");

  // Private requests are never grouped with others.
  const group = opts.group !== false && req.visibility !== "private";
  const candidates = group ? await loadCandidates(sb, req.building_id, { excludeGroupId: req.group_id, before: opts.chronological ? req.created_at : undefined }) : [];
  const { count: votes } = await sb.from("group_votes").select("user_id", { count: "exact", head: true }).eq("group_id", req.group_id);

  const out = await triage(
    {
      title: req.title,
      description: req.description,
      location: req.location_detail,
      category: req.category,
      reporterUrgency: req.priority,
      building: req.building ?? { name: "Unknown building", type: "other" },
      affected: Math.max(1, votes ?? 1),
      candidates,
    },
    generate,
  );
  if (!out.ok) return saveFallback(out.error);
  if (opts.dryRun) return { status: "done", urgency: out.urgency, reporter: req.priority, merged: out.matchGroupId };

  const now = new Date().toISOString();
  await sb
    .from("requests")
    .update({ ai_urgency: out.urgency, ai_reason: out.reason, ai_category: out.category, ai_safety: out.safety, ai_status: "done", ai_model: out.model, ai_at: now })
    .eq("id", req.id);

  if (group && out.matchGroupId) {
    await mergeIntoGroup(sb, req.id, req.group_id, out.matchGroupId);
    await sb.from("issue_groups").update({ title: out.groupTitle, updated_at: now }).eq("id", out.matchGroupId);
  } else if (group) {
    // Still its own issue: give it the AI's clean title, but only if nobody else has joined it yet.
    const { count } = await sb.from("requests").select("id", { count: "exact", head: true }).eq("group_id", req.group_id);
    if ((count ?? 0) <= 1) await sb.from("issue_groups").update({ title: out.groupTitle }).eq("id", req.group_id);
  }
  return { status: "done", urgency: out.urgency, reporter: req.priority, merged: group ? out.matchGroupId : null };
}
