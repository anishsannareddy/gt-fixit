"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { runTriageForRequest } from "@/lib/ai/service";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { CATEGORIES, PHOTO_BUCKET, PRIORITIES } from "@/lib/constants";
import type { Priority } from "@/lib/types";

/**
 * Step 1 of a photo upload: the server creates a one-time signed upload URL.
 * The browser then uploads the file straight to Supabase Storage, which avoids
 * Vercel's ~4.5MB request body limit on server functions.
 */
export async function createPhotoUploadUrl() {
  await requireUser(["reporter"]);
  const path = `requests/${randomUUID()}.jpg`;
  const { data, error } = await db().storage.from(PHOTO_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { error: error?.message ?? "Could not prepare upload" } as const;
  return { path: data.path, token: data.token } as const;
}

export type ReportState = { error?: string; fieldErrors?: Record<string, string>; created?: { id: number } } | undefined;

export async function createRequest(_prev: ReportState, formData: FormData): Promise<ReportState> {
  const user = await requireUser(["reporter"]);

  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const buildingId = Number(get("building_id"));
  const title = get("title");
  const description = get("description");
  const locationDetail = get("location_detail");
  const category = get("category");
  const priority = get("priority") as Priority;
  const photoPath = get("photo_path");

  const fieldErrors: Record<string, string> = {};
  if (!buildingId) fieldErrors.building_id = "Choose a building.";
  if (title.length < 4) fieldErrors.title = "Add a short summary (at least 4 characters).";
  if (title.length > 120) fieldErrors.title = "Keep the summary under 120 characters.";
  if (!CATEGORIES.includes(category as (typeof CATEGORIES)[number])) fieldErrors.category = "Pick a category.";
  if (!PRIORITIES.includes(priority)) fieldErrors.priority = "Pick a priority.";
  if (description.length > 2000) fieldErrors.description = "Description is too long.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  // Only accept photo paths our own upload flow could have produced.
  let photoUrl: string | null = null;
  if (photoPath) {
    if (!/^requests\/[0-9a-f-]{36}\.jpg$/.test(photoPath)) return { error: "Invalid photo upload." };
    photoUrl = db().storage.from(PHOTO_BUCKET).getPublicUrl(photoPath).data.publicUrl;
  }

  // Routing: the request inherits its building's maintenance area.
  const { data: building } = await db().from("buildings").select("area").eq("id", buildingId).maybeSingle();
  if (!building) return { fieldErrors: { building_id: "Choose a building." } };

  // Every request starts as its own issue group, with the reporter as the first "Me too" vote.
  // The AI (run after the response, below) may merge it into an existing group.
  const { data: group, error: groupError } = await db()
    .from("issue_groups")
    .insert({ building_id: buildingId, category, title })
    .select("id")
    .single();
  if (groupError || !group) return { error: groupError?.message ?? "Could not save your request." };

  const { data, error } = await db()
    .from("requests")
    .insert({
      group_id: group.id,
      title,
      description,
      building_id: buildingId,
      area: building.area,
      location_detail: locationDetail.slice(0, 120),
      category,
      priority,
      reporter_id: user.id,
      photo_url: photoUrl,
    })
    .select("id")
    .single();
  if (error || !data) {
    await db().from("issue_groups").delete().eq("id", group.id);
    return { error: error?.message ?? "Could not save your request." };
  }
  await db().from("group_votes").insert({ group_id: group.id, user_id: user.id });

  await db().from("request_events").insert({
    request_id: data.id,
    actor_id: user.id,
    from_status: null,
    to_status: "submitted",
  });

  revalidatePath("/my-requests");
  revalidatePath("/tech");
  revalidatePath("/admin", "layout");
  revalidatePath("/issues");
  // AI triage runs once, after the response is sent, so submitting never waits on (or fails because of) the AI.
  const requestId = data.id as number;
  after(() => runTriageForRequest(requestId, user.id));
  // The report sheet shows a success screen with a link to the new request.
  return { created: { id: data.id } };
}
