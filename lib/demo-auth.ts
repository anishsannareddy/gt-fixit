import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, isSupabaseConfigured } from "./supabase/server";
import { ROLE_META } from "./constants";
import type { Role, User } from "./types";

/**
 * DEMO AUTH — there are no passwords. The role picker stores a seeded user's id
 * in a cookie. This is fine for a hackathon demo, but anyone can pick "Admin".
 * Replace with GT SSO / Supabase Auth before real use.
 */
export const DEMO_COOKIE = "demo_user";

/** The current demo user, or null. `cache` dedupes the lookup within one request. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const id = (await cookies()).get(DEMO_COOKIE)?.value;
  if (!id || !isSupabaseConfigured()) return null;
  const { data } = await db()
    .from("users")
    .select("id, name, role, title, is_demo")
    .eq("id", id)
    .maybeSingle();
  return (data as User | null) ?? null;
});

/** Use at the top of a page or server action. Redirects if not signed in / wrong role. */
export async function requireUser(allowed?: Role[]): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (allowed && !allowed.includes(user.role)) redirect(ROLE_META[user.role].home);
  return user;
}
