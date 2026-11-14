import Link from "next/link";
import type { ReactNode } from "react";
import type { User } from "@/lib/types";
import { ROLE_META } from "@/lib/constants";
import { Logo } from "@/components/ui/Logo";
import { SwitchIcon } from "@/components/ui/Icons";
import { signOut } from "@/app/actions";
import { MobileTabBar, RailNav, TopNav } from "./nav";

/** Picks the layout for the signed-in role. Signed-out visitors get the bare page (the landing hero). */
export function AppShell({ user, children }: { user: User | null; children: ReactNode }) {
  if (!user) return <div className="bg-campus flex min-h-dvh flex-col">{children}</div>;
  if (user.role === "admin") return <AdminShell user={user}>{children}</AdminShell>;
  return <CampusShell user={user}>{children}</CampusShell>;
}

function initials(name: string) {
  return name.replace(/^Dr\.\s*/, "").split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase();
}

function SwitchRole({ compact = false }: { compact?: boolean }) {
  return (
    <form action={signOut}>
      <button
        title="Sign out / switch demo role"
        className="flex min-h-10 items-center gap-2 rounded-xl border border-white/15 px-3 text-sm font-semibold text-white/75 transition hover:bg-white/10 hover:text-white"
      >
        <SwitchIcon className="size-4" />
        <span className={compact ? "sr-only" : "hidden sm:inline"}>Switch role</span>
      </button>
    </form>
  );
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
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-full bg-gt-gold/20 text-xs font-bold text-gold-light ring-1 ring-gt-gold/40">
                {initials(user.name)}
              </span>
              <span className="hidden leading-tight sm:block">
                <span className="block text-sm font-semibold">{user.name}</span>
                <span className="block text-xs text-white/55">{ROLE_META[user.role].label}</span>
              </span>
            </div>
            <SwitchRole />
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
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-white/8 bg-black/30 p-4 backdrop-blur-xl lg:flex">
        <Link href="/admin" aria-label="GT FixIt home" className="px-1">
          <Logo />
        </Link>
        <p className="mt-6 mb-2 px-3 font-mono text-[0.65rem] tracking-[0.25em] text-signal/80 uppercase">Operations</p>
        <RailNav role="admin" />
        <div className="mt-auto rounded-2xl border border-white/8 bg-white/[0.03] p-3">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-lg bg-signal/15 font-mono text-xs font-bold text-signal ring-1 ring-signal/30">
              {initials(user.name)}
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-semibold">{user.name}</span>
              <span className="block truncate text-xs text-white/50">{user.title ?? "Admin"}</span>
            </span>
          </div>
          <div className="mt-3">
            <SwitchRole />
          </div>
        </div>
      </aside>

      {/* Top bar (phone / tablet) */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-white/8 bg-black/50 px-4 backdrop-blur-xl lg:hidden">
        <Link href="/admin" aria-label="GT FixIt home">
          <Logo />
        </Link>
        <span className="rounded-md border border-signal/30 bg-signal/10 px-1.5 py-0.5 font-mono text-[0.6rem] tracking-widest text-signal uppercase">Admin</span>
        <div className="ml-auto">
          <SwitchRole compact />
        </div>
      </header>

      <main className="flex flex-1 flex-col">{children}</main>
      <MobileTabBar role="admin" />
    </div>
  );
}
