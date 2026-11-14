"use client";

import { useId, useMemo, useState } from "react";
import { AREA_META } from "@/lib/campus/areas";
import type { Building } from "@/lib/types";
import { cn } from "@/components/ui/cn";
import { SearchIcon } from "@/components/ui/Icons";

/** Search box that jumps to a building by name or GT building number. Works with or without the 3D map. */
export function BuildingSearch({ buildings, onPick, className }: { buildings: Building[]; onPick: (b: Building) => void; className?: string }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return buildings
      .filter((b) => b.name.toLowerCase().includes(q) || b.number?.toLowerCase().includes(q) || AREA_META[b.area].label.toLowerCase() === q)
      .sort((a, b) => Number(b.name.toLowerCase().startsWith(q)) - Number(a.name.toLowerCase().startsWith(q)) || a.name.localeCompare(b.name))
      .slice(0, 8);
  }, [buildings, query]);

  function pick(b: Building) {
    onPick(b);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className={cn("relative", className)}>
      <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-white/50" />
      <input
        type="text"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label="Search buildings"
        autoComplete="off"
        placeholder="Search a building, e.g. Klaus or Glenn"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && results[active]) {
            e.preventDefault();
            pick(results[active]);
          } else if (e.key === "Escape") setOpen(false);
        }}
        className="glass-strong h-13 w-full rounded-2xl pr-4 pl-12 text-base text-white shadow-panel outline-none placeholder:text-white/45 focus:border-gt-gold focus:ring-2 focus:ring-gt-gold/30"
      />
      {open && query.trim() && (
        <ul id={listId} role="listbox" className="glass-strong scroll-thin absolute z-20 mt-2 max-h-80 w-full overflow-auto rounded-2xl py-1.5 shadow-panel">
          {results.length === 0 && <li className="px-4 py-3 text-sm text-white/55">No GT building matches “{query}”</li>}
          {results.map((b, i) => (
            <li
              key={b.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(b);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn("flex cursor-pointer items-center gap-3 px-4 py-2.5", i === active && "bg-white/10")}
            >
              <span className="size-2.5 shrink-0 rounded-full ring-1 ring-white/30" style={{ background: AREA_META[b.area].color }} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{b.name}</span>
              <span className="shrink-0 text-xs text-white/50">
                {b.number ? `#${b.number} · ` : ""}
                {AREA_META[b.area].label}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
