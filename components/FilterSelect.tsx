"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** A <select> that updates one URL search param when changed (keeps the others). */
export function FilterSelect({
  param,
  label,
  options,
}: {
  param: string;
  label: string;
  options: { value: string; label: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const value = params.get(param) ?? "";

  return (
    <label className="min-w-0 flex-1 sm:flex-none">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(params);
          if (e.target.value) next.set(param, e.target.value);
          else next.delete(param);
          router.replace(`${pathname}?${next.toString()}`, { scroll: false });
        }}
        className={`w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-medium sm:w-auto ${
          value ? "border-gt-navy text-gt-navy" : "border-slate-300 text-slate-700"
        }`}
      >
        <option value="">{label}: All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
