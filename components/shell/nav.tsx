"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/types";
import { cn } from "@/components/ui/cn";
import { AlertIcon, ChartIcon, ListIcon, MapIcon, WrenchIcon } from "@/components/ui/Icons";

type Item = { href: string; label: string; Icon: typeof MapIcon };

export const NAV: Record<Role, Item[]> = {
  reporter: [
    { href: "/report", label: "Campus map", Icon: MapIcon },
    { href: "/issues", label: "Active issues", Icon: AlertIcon },
    { href: "/my-requests", label: "My requests", Icon: ListIcon },
  ],
  technician: [{ href: "/tech", label: "My queue", Icon: WrenchIcon }],
  admin: [
    { href: "/admin", label: "Command Center", Icon: MapIcon },
    { href: "/admin/analytics", label: "Analytics", Icon: ChartIcon },
  ],
};

function useIsActive() {
  const pathname = usePathname();
  // "/admin" is exact so it isn't also highlighted on "/admin/analytics"
  return (href: string) => pathname === href || (href !== "/admin" && pathname.startsWith(href + "/"));
}

/** Inline links for the top bar on laptops. */
export function TopNav({ role }: { role: Role }) {
  const isActive = useIsActive();
  return (
    <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
      {NAV[role].map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={isActive(href) ? "page" : undefined}
          className={cn(
            "flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition",
            isActive(href) ? "bg-slate-100 text-ink" : "text-ink-muted hover:bg-slate-100 hover:text-ink",
          )}
        >
          <Icon className="size-4" />
          {label}
        </Link>
      ))}
    </nav>
  );
}

/** Floating glass tab bar for phones. Hidden when a role has only one destination. */
export function MobileTabBar({ role }: { role: Role }) {
  const isActive = useIsActive();
  const items = NAV[role];
  if (items.length < 2) return null;
  const stacked = items.length > 2;
  return (
    <nav aria-label="Main" className="pb-safe pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 md:hidden">
      <ul className="glass-strong pointer-events-auto flex gap-1 rounded-full p-1.5 shadow-panel">
        {items.map(({ href, label, Icon }) => {
          const active = isActive(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center rounded-full font-semibold transition",
                  // Three or more tabs: icon over a small label so they fit at 375px.
                  stacked ? "min-h-13 min-w-22 flex-col justify-center gap-0.5 px-3 text-xs" : "min-h-12 gap-2 px-5 text-sm",
                  active ? "bg-gt-gold text-navy-950 shadow-glow" : "text-ink-muted",
                )}
              >
                <Icon className="size-5" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Vertical links for the Command Center's left rail. */
export function RailNav({ role }: { role: Role }) {
  const isActive = useIsActive();
  return (
    <nav className="flex flex-col gap-1" aria-label="Main">
      {NAV[role].map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          aria-current={isActive(href) ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-semibold transition",
            isActive(href) ? "border-signal/30 bg-signal/10 text-ink" : "border-transparent text-ink-muted hover:bg-slate-100 hover:text-ink",
          )}
        >
          <Icon className={cn("size-4.5", isActive(href) && "text-signal")} />
          {label}
        </Link>
      ))}
    </nav>
  );
}
