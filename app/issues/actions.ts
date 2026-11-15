"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { OPEN_STATUSES } from "@/lib/constants";
import { db } from "@/lib/supabase/server";
import type { ActionResult } from "@/app/requests/actions";

export type VoteResult = (ActionResult & { voted?: boolean; affected?: number }) | { ok: false; error: string };

/** "Me too": add or remove the student's vote on an active issue group. One vote per student per group. */
export async function toggleVote(groupId: number, want: boolean): Promise<VoteResult> {
  const user = await requireUser(["reporter"]);
  if (!Number.isInteger(groupId) || groupId <= 0) return { ok: false, error: "Issue not found." };

  const { data: open } = await db().from("requests").select("reporter_id").eq("group_id", groupId).in("status", OPEN_STATUSES);
  if (!open?.length) return { ok: false, error: "This issue has already been fixed." };

  if (want) {
    const { error } = await db().from("group_votes").upsert({ group_id: groupId, user_id: user.id }, { onConflict: "group_id,user_id", ignoreDuplicates: true });
    if (error) return { ok: false, error: error.message };
  } else {
    if (open.some((r) => r.reporter_id === user.id)) return { ok: false, error: "You reported this issue, so you're already counted." };
    const { error } = await db().from("group_votes").delete().eq("group_id", groupId).eq("user_id", user.id);
    if (error) return { ok: false, error: error.message };
  }
  await db().from("issue_groups").update({ updated_at: new Date().toISOString() }).eq("id", groupId);

  const { count } = await db().from("group_votes").select("user_id", { count: "exact", head: true }).eq("group_id", groupId);
  revalidatePath("/issues");
  revalidatePath("/report");
  revalidatePath("/tech");
  return { ok: true, message: want ? "Counted you in. Thanks!" : "Removed your Me too.", voted: want, affected: count ?? undefined };
}
