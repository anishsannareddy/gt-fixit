"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { SearchIcon, XIcon } from "@/components/ui/Icons";

/** Search requests by title, building or ticket number. Submits on Enter; updates ?q=. */
export function SearchBox() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");

  function go(q: string) {
    const next = new URLSearchParams(params);
    if (q.trim()) next.set("q", q.trim());
    else next.delete("q");
    next.delete("ticket");
    router.replace(`${pathname}?${next}`, { scroll: false });
  }

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        go(value);
      }}
      className="relative col-span-2 sm:col-span-1 sm:w-72"
    >
      <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4.5 -translate-y-1/2 text-ink-muted" />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search title, building or #id"
        aria-label="Search requests"
        className="min-h-11 w-full rounded-xl border border-field/60 bg-white pr-9 pl-9 text-sm outline-none placeholder:text-slate-500 focus:border-gt-navy focus:ring-3 focus:ring-gt-gold/45"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            setValue("");
            go("");
          }}
          className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-ink-muted hover:bg-slate-100"
        >
          <XIcon className="size-4" />
        </button>
      )}
    </form>
  );
}
