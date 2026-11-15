import "server-only";
import { revalidatePath } from "next/cache";
import { db } from "../supabase/server";
import { generateStructured } from "./provider";
import { runTriage } from "./run";

/**
 * Called once per submission, after the response is sent (`after()` in createRequest).
 * Never throws; if the AI fails the request keeps the reporter's urgency and stays its own group.
 */
export async function runTriageForRequest(requestId: number, userId: string): Promise<void> {
  try {
    const res = await runTriage(db(), requestId, generateStructured, { userId });
    if (res?.status === "fallback") console.warn(`[ai] request ${requestId}: fallback (${res.error})`);
  } catch (err) {
    console.warn(`[ai] request ${requestId}: unexpected error`, err);
  }
  try {
    for (const p of ["/tech", "/issues", "/my-requests", "/report"]) revalidatePath(p);
    revalidatePath("/admin", "layout");
  } catch {
    // Pages are dynamic and auto-refresh, so a missed revalidation only delays the update.
  }
}
