"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { signOut } from "@/app/actions";
import { setSmartSort } from "@/app/tech/actions";
import { cn } from "@/components/ui/cn";
import { LogoutIcon, SparkleIcon } from "@/components/ui/Icons";
import { useToast } from "@/components/ui/Toast";

/** Avatar button → menu with the user's name, email, role and a Sign out button. */
export function UserMenu({
  name,
  email,
  role,
  align = "right",
  tone = "campus",
  smartSort,
}: {
  name: string;
  email: string | null;
  role: string;
  align?: "right" | "up";
  tone?: "campus" | "command";
  /** Technicians/admins: current Smart Sort setting (shows the switch). Undefined hides it. */
  smartSort?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initials = name.replace(/^Dr\.\s*/, "").split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase();

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex min-h-10 items-center gap-2.5 rounded-xl px-1.5 py-1 text-left transition hover:bg-navy-50"
      >
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center text-xs font-bold",
            tone === "command" ? "rounded-lg bg-signal/10 font-mono text-signal ring-1 ring-signal/30" : "rounded-full bg-gold-50 text-gold-ink ring-1 ring-gt-gold/60",
          )}
        >
          {initials}
        </span>
        <span className="hidden min-w-0 leading-tight sm:block">
          <span className="block truncate text-sm font-semibold">{name}</span>
          <span className="block truncate text-xs text-ink-muted">{role}</span>
        </span>
        <span className="sr-only">Account menu</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: align === "up" ? 6 : -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: align === "up" ? 6 : -6 }}
            transition={{ duration: 0.15 }}
            className={cn("absolute z-50 w-64 rounded-2xl border border-line bg-white p-2 shadow-panel", align === "up" ? "bottom-full left-0 mb-2" : "top-full right-0 mt-2")}
          >
            <div className="px-3 py-2">
              <p className="truncate text-sm font-semibold">{name}</p>
              {email && <p className="truncate text-xs text-ink-muted">{email}</p>}
              <p className="mt-1 text-xs font-semibold text-gold-ink">{role}</p>
            </div>
            {smartSort !== undefined && <SmartSortSwitch on={smartSort} />}
            <form action={signOut} className="border-t border-line pt-1.5">
              <button role="menuitem" className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-sm font-semibold text-ink hover:bg-navy-50">
                <LogoutIcon className="size-4.5" /> Sign out
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Saved per user. Sorts the technician queue by AI urgency, then students affected, then age. */
function SmartSortSwitch({ on }: { on: boolean }) {
  const [value, setValue] = useState(on);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function toggle() {
    const next = !value;
    setValue(next);
    start(async () => {
      const res = await setSmartSort(next).catch(() => ({ ok: false as const, error: "Something went wrong. Try again." }));
      if (!res.ok) {
        setValue(!next);
        toast(res.error, "error");
        return;
      }
      toast(res.message);
      router.refresh();
    });
  }

  return (
    <div className="border-t border-line py-1.5">
      <button
        type="button"
        role="menuitemcheckbox"
        aria-checked={value}
        disabled={pending}
        onClick={toggle}
        className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left text-sm font-semibold text-ink hover:bg-navy-50 disabled:opacity-60"
      >
        <SparkleIcon className="size-4.5 text-gold-ink" />
        <span className="flex-1">
          Smart Sort
          <span className="block text-xs font-normal text-ink-muted">AI urgency first</span>
        </span>
        <span aria-hidden="true" className={cn("relative h-6 w-10 rounded-full transition", value ? "bg-gt-navy" : "bg-slate-300")}>
          <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", value ? "left-[1.125rem]" : "left-0.5")} />
        </span>
      </button>
    </div>
  );
}
