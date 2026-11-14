"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_COOKIE } from "@/lib/demo-auth";
import { db } from "@/lib/supabase/server";
import { ROLE_META } from "@/lib/constants";
import type { Role } from "@/lib/types";

async function setSession(userId: string) {
  (await cookies()).set(DEMO_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

/** Role picker: "sign in" as one of the seeded demo personas. */
export async function signInAs(formData: FormData) {
  const userId = String(formData.get("userId") ?? "");
  const { data: user } = await db().from("users").select("id, role").eq("id", userId).eq("is_demo", true).maybeSingle();
  if (!user) redirect("/");

  await setSession(user.id);
  redirect(ROLE_META[user.role as Role].home);
}

export type EmailSignInState = { error?: string } | undefined;

/**
 * "Sign in with GT account" — DEMO ONLY. Any @gatech.edu address signs in as a student, no password.
 * The first sign-in creates a reporter account. The email is kept in the existing `title` column
 * so no database change is needed. Replace with real GT SSO before real use.
 */
export async function signInWithEmail(_prev: EmailSignInState, formData: FormData): Promise<EmailSignInState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{1,40}@gatech\.edu$/.test(email)) {
    return { error: "Use your Georgia Tech email, ending in @gatech.edu." };
  }

  let { data: user } = await db()
    .from("users")
    .select("id")
    .eq("role", "reporter")
    .eq("is_demo", false)
    .eq("title", email)
    .limit(1)
    .maybeSingle();

  if (!user) {
    // "george.burdell" → "George Burdell"; "gburdell3" stays as the username
    const local = email.split("@")[0];
    const name = /[._-]/.test(local)
      ? local.split(/[._-]+/).filter(Boolean).map((p) => p[0].toUpperCase() + p.slice(1)).join(" ")
      : local;
    const created = await db().from("users").insert({ name, role: "reporter", title: email, is_demo: false }).select("id").single();
    if (created.error || !created.data) return { error: "Couldn't sign you in. Try again." };
    user = created.data;
  }

  await setSession(user.id);
  redirect(ROLE_META.reporter.home);
}

export async function signOut() {
  (await cookies()).delete(DEMO_COOKIE);
  redirect("/");
}
