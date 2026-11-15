"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cn } from "@/components/ui/cn";
import { SparkleIcon } from "@/components/ui/Icons";
import { useToast } from "@/components/ui/Toast";
import { setSmartSort } from "./actions";

/** Technician queue filter-row switch. Saved per user. */
export function SmartSortToggle({ on, className }: { on: boolean; className?: string }) {
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
    <button
      type="button"
      role="switch"
      aria-checked={value}
      disabled={pending}
      onClick={toggle}
      className={cn(
        "flex min-h-11 items-center gap-2 rounded-xl border bg-white px-3 text-sm font-semibold transition disabled:opacity-60",
        value ? "border-gt-navy text-ink" : "border-field/60 text-ink-muted",
        className,
      )}
    >
      <SparkleIcon className="size-4 shrink-0 text-gold-ink" />
      <span className="flex-1 text-left">Smart Sort</span>
      <span aria-hidden="true" className={cn("relative h-5 w-9 shrink-0 rounded-full transition", value ? "bg-gt-navy" : "bg-slate-300")}>
        <span className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow transition-all", value ? "left-[1.125rem]" : "left-0.5")} />
      </span>
    </button>
  );
}
