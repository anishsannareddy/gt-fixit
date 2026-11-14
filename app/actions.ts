"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DEMO_COOKIE } from "@/lib/demo-auth";
import { db } from "@/lib/supabase/server";
import { ROLE_META } from "@/lib/constants";
import type { Role } from "@/lib/types";

/** Role picker: "sign in" as one of the seeded demo personas. */
export async function signInAs(formData: FormData) {
  const userId = String(formData.get("userId") ?? "");
  const { data: user } = await db().from("users").select("id, role").eq("id", userId).eq("is_demo", true).maybeSingle();
  if (!user) redirect("/");

  (await cookies()).set(DEMO_COOKIE, user.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  redirect(ROLE_META[user.role as Role].home);
}

export async function signOut() {
  (await cookies()).delete(DEMO_COOKIE);
  redirect("/");
}
