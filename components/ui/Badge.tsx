import type { Priority, Status } from "@/lib/types";
import { cn } from "./cn";

// Colors tuned for dark surfaces. A text label always accompanies the color.
export const STATUS_UI: Record<Status, { label: string; text: string; bg: string; dot: string }> = {
  submitted: { label: "Submitted", text: "text-slate-200", bg: "bg-slate-400/15 ring-slate-300/25", dot: "bg-slate-300" },
  assigned: { label: "Assigned", text: "text-sky-200", bg: "bg-sky-400/15 ring-sky-300/30", dot: "bg-sky-400" },
  in_progress: { label: "In progress", text: "text-amber-200", bg: "bg-amber-400/15 ring-amber-300/30", dot: "bg-amber-400" },
  resolved: { label: "Resolved", text: "text-emerald-200", bg: "bg-emerald-400/15 ring-emerald-300/30", dot: "bg-emerald-400" },
};

export const PRIORITY_UI: Record<Priority, { label: string; text: string; bg: string }> = {
  low: { label: "Low", text: "text-white/70", bg: "bg-white/8 ring-white/15" },
  medium: { label: "Medium", text: "text-sky-100", bg: "bg-sky-300/12 ring-sky-200/25" },
  high: { label: "High", text: "text-orange-200", bg: "bg-orange-400/15 ring-orange-300/35" },
  urgent: { label: "Urgent", text: "text-red-100", bg: "bg-red-500/25 ring-red-400/50" },
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
    <span className={cn(PILL, tone === "gold" ? "bg-gt-gold/20 text-gold-light ring-gt-gold/40" : "bg-white/8 text-white/75 ring-white/15", className)}>
      {children}
    </span>
  );
}
