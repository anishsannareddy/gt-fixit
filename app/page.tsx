import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db, isSupabaseConfigured } from "@/lib/supabase/server";
import { ROLE_META } from "@/lib/constants";
import { Landing } from "@/components/landing/Landing";
import { SetupNotice } from "@/components/landing/SetupNotice";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect(ROLE_META[user.role].home);

  let problem: "env" | "db" | null = null;
  if (!isSupabaseConfigured() || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) problem = "env";
  else {
    const { count, error } = await db().from("buildings").select("id", { count: "exact", head: true });
    if (error || !count) problem = "db";
  }

  return <Landing notice={problem ? <SetupNotice problem={problem} /> : undefined} />;
}
