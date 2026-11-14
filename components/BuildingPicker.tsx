"use client";

import { useId, useMemo, useRef, useState } from "react";
import type { Building } from "@/lib/types";
import { BUILDING_TYPE_LABEL } from "@/lib/constants";
import { BuildingIcon, SearchIcon, XIcon } from "@/components/ui/Icons";

/** Searchable building combobox. Submits the chosen id via a hidden input named `name`. */
export function BuildingPicker({ buildings, name, error }: { buildings: Building[]; name: string; error?: string }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Building | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? buildings.filter((b) => b.name.toLowerCase().includes(q) || b.short_name?.toLowerCase().includes(q))
      : buildings;
    // residence halls first — that's where most reports come from
    const order = ["residence", "academic", "dining", "athletic", "other"];
    return [...list].sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type) || a.name.localeCompare(b.name));
  }, [buildings, query]);

  function choose(b: Building) {
    setSelected(b);
    setQuery("");
    setOpen(false);
  }

  if (selected) {
    return (
      <div>
        <input type="hidden" name={name} value={selected.id} />
        <div className="flex items-center gap-3 rounded-xl border border-gt-navy bg-gt-navy-50 px-3.5 py-3">
          <BuildingIcon className="size-5 text-gt-navy" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold text-gt-navy">{selected.name}</div>
            <div className="text-xs text-slate-600">{BUILDING_TYPE_LABEL[selected.type]}</div>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setTimeout(() => inputRef.current?.focus(), 0);
            }}
            className="rounded-lg p-1.5 text-slate-600 hover:bg-white"
            aria-label="Change building"
          >
            <XIcon className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <input type="hidden" name={name} value="" />
      <SearchIcon className="pointer-events-none absolute top-3.5 left-3.5 size-5 text-slate-400" />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-invalid={Boolean(error)}
        autoComplete="off"
        className={`field pl-11 ${error ? "border-red-400" : ""}`}
        placeholder="Search buildings — e.g. Glenn, Klaus, CULC"
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
            setOpen(true);
            setActive((i) => Math.min(i + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && open && results[active]) {
            e.preventDefault();
            choose(results[active]);
          } else if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {results.length === 0 && <li className="px-4 py-3 text-sm text-slate-500">No buildings match “{query}”</li>}
          {results.map((b, i) => (
            <li
              key={b.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(b);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5 ${i === active ? "bg-gt-gold-50" : ""}`}
            >
              <span className="text-slate-900">{b.name}</span>
              <span className="shrink-0 text-xs text-slate-500">{BUILDING_TYPE_LABEL[b.type].split(" ")[0]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
