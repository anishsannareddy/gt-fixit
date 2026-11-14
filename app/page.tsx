import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/demo-auth";
import { getDemoUsers } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { ROLE_META } from "@/lib/constants";
import type { User } from "@/lib/types";
import { Landing } from "@/components/landing/Landing";
import { SetupNotice } from "@/components/landing/SetupNotice";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect(ROLE_META[user.role].home);

  let personas: User[] = [];
  let problem: "env" | "db" | null = null;
  if (!isSupabaseConfigured()) problem = "env";
  else {
    try {
      personas = await getDemoUsers();
      if (personas.length === 0) problem = "db";
    } catch {
      problem = "db";
    }
  }

  return <Landing personas={personas} notice={problem ? <SetupNotice problem={problem} /> : undefined} />;
}
