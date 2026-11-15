import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ROLE_META } from "@/lib/constants";
import { DEMO_ACCOUNTS, demoPassword, showDemoAccounts } from "@/lib/demo-accounts";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const user = await getCurrentUser();
  if (user) redirect(ROLE_META[user.role].home);
  const { tab } = await props.searchParams;

  // Only send the demo list (and its password) to the browser when the flag is on.
  const demo = showDemoAccounts()
    ? { password: demoPassword(), accounts: DEMO_ACCOUNTS.map(({ email, name, role }) => ({ email, name, role: ROLE_META[role].label })) }
    : null;

  return <LoginForm initialTab={tab === "signup" ? "signup" : "signin"} demo={demo} />;
}
