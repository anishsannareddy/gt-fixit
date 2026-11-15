"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "./cn";

/** A <select> that sets one URL search param (keeping the others). Empty value = "All". */
export function FilterSelect({
  param,
  label,
  options,
  className,
  emptyLabel,
}: {
  param: string;
  label: string;
  options: { value: string; label: string }[];
  className?: string;
  /** What the empty (default) choice means. Defaults to "<label>: All". */
  emptyLabel?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const value = params.get(param) ?? "";

  return (
    <label className={cn("min-w-0", className)}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(params);
          if (e.target.value) next.set(param, e.target.value);
          else next.delete(param);
          next.delete("ticket");
          router.replace(`${pathname}?${next.toString()}`, { scroll: false });
        }}
        className={cn(
          "min-h-11 w-full rounded-xl border bg-white px-3 text-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-gt-gold/45",
          value ? "border-gt-navy text-ink" : "border-field/60 text-ink-muted",
        )}
      >
        <option value="">{emptyLabel ?? `${label}: All`}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
