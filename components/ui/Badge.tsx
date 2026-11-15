import { AREA_META, type Zone } from "@/lib/campus/areas";
import type { Priority, Status } from "@/lib/types";
import { cn } from "./cn";

// Colors tuned for white surfaces (text passes 4.5:1 on its tinted background). A text label always accompanies the color.
export const STATUS_UI: Record<Status, { label: string; text: string; bg: string; dot: string }> = {
  submitted: { label: "Submitted", text: "text-slate-700", bg: "bg-slate-100 ring-slate-300", dot: "bg-slate-500" },
  assigned: { label: "Assigned", text: "text-sky-800", bg: "bg-sky-50 ring-sky-200", dot: "bg-sky-600" },
  in_progress: { label: "In progress", text: "text-amber-800", bg: "bg-amber-50 ring-amber-200", dot: "bg-amber-500" },
  resolved: { label: "Resolved", text: "text-emerald-800", bg: "bg-emerald-50 ring-emerald-200", dot: "bg-emerald-600" },
};

export const PRIORITY_UI: Record<Priority, { label: string; text: string; bg: string }> = {
  low: { label: "Low", text: "text-slate-700", bg: "bg-slate-50 ring-slate-200" },
  medium: { label: "Medium", text: "text-sky-800", bg: "bg-sky-50 ring-sky-200" },
  high: { label: "High", text: "text-orange-800", bg: "bg-orange-50 ring-orange-200" },
  urgent: { label: "Urgent", text: "text-red-800", bg: "bg-red-50 ring-red-300" },
};

const PILL = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset whitespace-nowrap";

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const s = STATUS_UI[status];
  return (
    <span className={cn(PILL, s.bg, s.text, className)}>
      <span className={cn("size-1.5 rounded-full", s.dot)} aria-hidden="true" />
      {s.label}
    </span>
  );
}

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  const p = PRIORITY_UI[priority];
  return (
    <span className={cn(PILL, p.bg, p.text, className)}>
      {priority === "urgent" && <span aria-hidden="true">!</span>}
      {p.label}
    </span>
  );
}

/** Neutral pill for counts, tags, etc. */
export function Badge({ children, tone = "neutral", className }: { children: React.ReactNode; tone?: "neutral" | "gold"; className?: string }) {
  return (
    <span className={cn(PILL, tone === "gold" ? "bg-gold-50 text-gold-ink ring-gt-gold/50" : "bg-slate-100 text-ink-muted ring-slate-300", className)}>
      {children}
    </span>
  );
}

/** Maintenance area: colour dot plus the area name (never colour alone). */
export function AreaBadge({ area, className }: { area: Zone; className?: string }) {
  return (
    <span className={cn(PILL, "bg-white text-ink ring-slate-300", className)}>
      <span className="size-2 rounded-full ring-1 ring-slate-300" style={{ background: AREA_META[area].color }} aria-hidden="true" />
      {AREA_META[area].label}
    </span>
  );
}
