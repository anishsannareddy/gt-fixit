import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/demo-auth";
import { getDemoUsers } from "@/lib/data";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { ROLE_META } from "@/lib/constants";
import type { Role, User } from "@/lib/types";
import { SetupNotice } from "@/components/SetupNotice";
import { ChartIcon, PlusIcon, WrenchIcon } from "@/components/ui/Icons";
import { Logo } from "@/components/ui/Logo";
import { signInAs } from "./actions";

const ROLE_ORDER: Role[] = ["reporter", "technician", "admin"];
const ROLE_ICON = { reporter: PlusIcon, technician: WrenchIcon, admin: ChartIcon };

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

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-5 md:py-8">
      <Logo />
      <section className="px-4 pt-8 pb-12 text-white md:pt-12 md:pb-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-gt-gold">Georgia Tech Campus Maintenance</p>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight md:text-6xl">
            See it. Snap it. <span className="text-gt-gold">Get it fixed.</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-white/80 md:text-lg">
            One place to report a broken AC, leaky faucet or dead card reader in any building or dorm on
            campus — and watch it get resolved.
          </p>
        </div>
      </section>

      {problem ? (
        <SetupNotice problem={problem} />
      ) : (
        <section className="-mt-14 md:-mt-16">
          <h2 className="sr-only">Choose a demo role</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {ROLE_ORDER.map((role) => {
              const Icon = ROLE_ICON[role];
              const people = personas.filter((p) => p.role === role);
              return (
                <div key={role} className="card flex flex-col p-5">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-xl bg-gt-gold-50 text-gt-navy">
                      <Icon className="size-5" />
                    </span>
                    <h3 className="text-lg font-bold text-gt-navy">{ROLE_META[role].label}</h3>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{ROLE_META[role].blurb}</p>
                  <div className="mt-4 space-y-2">
                    {people.map((p) => (
                      <form key={p.id} action={signInAs}>
                        <input type="hidden" name="userId" value={p.id} />
                        <button className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-left transition hover:border-gt-gold hover:bg-gt-gold-50">
                          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-gt-navy text-sm font-semibold text-white">
                            {p.name.replace("Dr. ", "").split(" ").map((s) => s[0]).join("").slice(0, 2)}
                          </span>
                          <span className="min-w-0">
                            <span className="block font-semibold text-slate-900">Continue as {p.name}</span>
                            <span className="block truncate text-xs text-slate-500">{p.title}</span>
                          </span>
                        </button>
                      </form>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-center text-xs text-slate-500">
            Demo mode: pick any persona — no password needed. Real Georgia Tech SSO would replace this.
          </p>
        </section>
      )}
    </div>
  );
}
