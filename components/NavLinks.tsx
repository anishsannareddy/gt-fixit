"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/types";
import { ChartIcon, ListIcon, PlusIcon, WrenchIcon } from "./Icons";

const NAV: Record<Role, { href: string; label: string; Icon: typeof PlusIcon }[]> = {
  reporter: [
    { href: "/report", label: "Report", Icon: PlusIcon },
    { href: "/my-requests", label: "My requests", Icon: ListIcon },
  ],
  technician: [{ href: "/tech", label: "Queue", Icon: WrenchIcon }],
  admin: [
    { href: "/admin", label: "Dashboard", Icon: ChartIcon },
    { href: "/tech", label: "All requests", Icon: WrenchIcon },
  ],
};

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(href + "/");
}

/** Desktop: links in the top bar. */
export function TopNavLinks({ role }: { role: Role }) {
  const isActive = useIsActive();
  return (
    <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
      {NAV[role].map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
            isActive(href) ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white"
          }`}
        >
          <Icon className="size-4" />
          {label}
        </Link>
      ))}
    </nav>
  );
}

/** Mobile: fixed tab bar at the bottom of the screen (thumb-friendly). */
export function BottomTabs({ role }: { role: Role }) {
  const isActive = useIsActive();
  const items = NAV[role];
  return (
    <nav
      aria-label="Main"
      className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden"
    >
      <ul className="mx-auto flex max-w-md">
        {items.map(({ href, label, Icon }) => {
          const active = isActive(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={`flex flex-col items-center gap-0.5 pt-2 text-xs font-medium ${
                  active ? "text-gt-navy" : "text-slate-500"
                }`}
              >
                <span className={`rounded-full px-4 py-1 ${active ? "bg-gt-gold/30" : ""}`}>
                  <Icon className="size-5" />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
