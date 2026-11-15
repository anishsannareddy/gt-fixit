import Link from "next/link";
import type { ReactNode } from "react";
import type { User } from "@/lib/types";
import { ROLE_META } from "@/lib/constants";
import { Logo } from "@/components/ui/Logo";
import { MobileTabBar, RailNav, TopNav } from "./nav";
import { UserMenu } from "./UserMenu";

/** Picks the layout for the signed-in role. Signed-out visitors get the bare page (the landing hero). */
export function AppShell({ user, children }: { user: User | null; children: ReactNode }) {
  if (!user) return <div className="bg-campus flex min-h-dvh flex-col">{children}</div>;
  if (user.role === "admin") return <AdminShell user={user}>{children}</AdminShell>;
  return <CampusShell user={user}>{children}</CampusShell>;
}

/** Student + technician: floating glass top bar over the navy "campus" gradient. */
function CampusShell({ user, children }: { user: User; children: ReactNode }) {
  return (
    <div className="bg-campus flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 px-3 pt-3">
        <div className="glass-strong mx-auto flex h-14 max-w-6xl items-center gap-4 rounded-2xl px-3 shadow-panel md:px-4">
          <Link href={ROLE_META[user.role].home} aria-label="GT FixIt home">
            <Logo />
          </Link>
          <TopNav role={user.role} />
          <div className="ml-auto">
            <UserMenu name={user.name} email={user.email} role={ROLE_META[user.role].label} />
          </div>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
      <MobileTabBar role={user.role} />
    </div>
  );
}

/** Admin "Command Center": darker, grid-lined, with a left rail on laptops. */
function AdminShell({ user, children }: { user: User; children: ReactNode }) {
  return (
    <div className="bg-command flex min-h-dvh flex-col lg:pl-60">
      {/* Left rail (laptop) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-line bg-white p-4 backdrop-blur-xl lg:flex">
        <Link href="/admin" aria-label="GT FixIt home" className="px-1">
          <Logo />
        </Link>
        <p className="mt-6 mb-2 px-3 font-mono text-[0.65rem] tracking-[0.25em] text-signal uppercase">Operations</p>
        <RailNav role="admin" />
        <div className="mt-auto rounded-2xl border border-line bg-page p-2">
          <UserMenu name={user.name} email={user.email} role={user.title ?? "Admin"} align="up" tone="command" />
        </div>
      </aside>

      {/* Top bar (phone / tablet) */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-line bg-white/90 px-4 backdrop-blur-xl lg:hidden">
        <Link href="/admin" aria-label="GT FixIt home">
          <Logo />
        </Link>
        <span className="rounded-md border border-signal/30 bg-signal/10 px-1.5 py-0.5 font-mono text-[0.6rem] tracking-widest text-signal uppercase">Admin</span>
        <div className="ml-auto">
          <UserMenu name={user.name} email={user.email} role="Admin" tone="command" />
        </div>
      </header>

      <main className="flex flex-1 flex-col">{children}</main>
      <MobileTabBar role="admin" />
    </div>
  );
}
