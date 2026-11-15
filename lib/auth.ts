import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db, isSupabaseConfigured } from "./supabase/server";
import { authClient } from "./supabase/auth-server";
import { ROLE_META } from "./constants";
import type { Role, User } from "./types";

/**
 * Sign-in is Supabase Auth (email + password). ROLES live in our own `users` table, which the
 * browser can't read or write (RLS on, no policies), so nobody can give themselves a role.
 * Technician and admin accounts are only ever created by `npm run seed`.
 */

export const GT_EMAIL = /^[a-z0-9][a-z0-9._+-]{0,63}@gatech\.edu$/i;

const PROFILE_COLUMNS = "id, name, role, title, email, is_demo, smart_sort";

/** Load the profile for an auth user. A @gatech.edu account with no profile yet becomes a student. */
export async function loadProfile(authId: string, email: string | undefined, name?: string): Promise<User | null> {
  const { data } = await db().from("users").select(PROFILE_COLUMNS).eq("id", authId).maybeSingle();
  if (data) return data as User;
  // e.g. the database was reseeded after this person signed up. Only GT addresses get a profile, and only as a student.
  if (!email || !GT_EMAIL.test(email)) return null;
  const created = await db()
    .from("users")
    .insert({ id: authId, email: email.toLowerCase(), name: name || nameFromEmail(email), role: "reporter", title: "Student", is_demo: false })
    .select(PROFILE_COLUMNS)
    .single();
  return (created.data as User | null) ?? null;
}

export function nameFromEmail(email: string): string {
  const local = email.split("@")[0];
  return /[._-]/.test(local)
    ? local.split(/[._-]+/).filter(Boolean).map((p) => p[0].toUpperCase() + p.slice(1)).join(" ")
    : local;
}

/** The signed-in user's profile, or null. `cache` dedupes the lookup within one request. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  if (!isSupabaseConfigured() || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;
  const supabase = await authClient();
  // getClaims verifies the session token (not just reads the cookie).
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return loadProfile(claims.sub, typeof claims.email === "string" ? claims.email : undefined);
});

/** Use at the top of every page and server action. Logged out → landing page; wrong role → that user's home. */
export async function requireUser(allowed?: Role[]): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (allowed && !allowed.includes(user.role)) redirect(ROLE_META[user.role].home);
  return user;
}
