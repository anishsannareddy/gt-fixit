"use server";

import { redirect } from "next/navigation";
import { GT_EMAIL, loadProfile } from "@/lib/auth";
import { authClient } from "@/lib/supabase/auth-server";
import { db } from "@/lib/supabase/server";
import { ROLE_META } from "@/lib/constants";

export type AuthState = { error?: string; email?: string } | undefined;

/** Sign in with email + password, then go to that role's home screen. */
export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password.", email };

  const supabase = await authClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: "That email and password don't match an account.", email };

  const profile = await loadProfile(data.user.id, data.user.email);
  if (!profile) {
    await supabase.auth.signOut();
    return { error: "This account doesn't have access to GT FixIt.", email };
  }
  redirect(ROLE_META[profile.role].home);
}

/**
 * Create an account. Open only to @gatech.edu addresses, and ALWAYS creates a student.
 * The account is created on the server with the admin API and marked confirmed, so no
 * confirmation email is needed (Supabase's built-in email is limited to a few per hour).
 */
export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!GT_EMAIL.test(email)) return { error: "Sign-up is only open to Georgia Tech emails ending in @gatech.edu.", email };
  if (password.length < 8) return { error: "Use a password of at least 8 characters.", email };
  if (name.length < 2) return { error: "Enter your name.", email };

  const created = await db().auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name } });
  if (created.error || !created.data.user) {
    const taken = /already|registered|exists/i.test(created.error?.message ?? "");
    return { error: taken ? "An account with that email already exists. Sign in instead." : "Couldn't create your account. Try again.", email };
  }

  const { error: profileError } = await db()
    .from("users")
    .insert({ id: created.data.user.id, email, name, role: "reporter", title: "Student", is_demo: false });
  if (profileError) {
    await db().auth.admin.deleteUser(created.data.user.id);
    return { error: "Couldn't create your account. Try again.", email };
  }

  const supabase = await authClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Account created. Please sign in.", email };
  redirect(ROLE_META.reporter.home);
}

export async function signOut() {
  const supabase = await authClient();
  await supabase.auth.signOut();
  redirect("/");
}
