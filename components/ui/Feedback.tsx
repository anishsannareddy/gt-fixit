import type { ReactNode } from "react";
import { cn } from "./cn";
import { BlockTower } from "./Illustration";

export function EmptyState({ title, children, art, action }: { title: string; children?: ReactNode; art?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-slate-300 bg-white/60 px-6 py-12 text-center">
      {art ?? <BlockTower />}
      <h3 className="mt-3 font-display text-xl font-bold">{title}</h3>
      {children && <div className="mt-1 max-w-sm text-sm text-ink-muted">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-slate-200/70", className)} aria-hidden="true" />;
}

/** Headline number with a label and optional change vs. the previous period. */
export function KpiTile({
  label,
  value,
  sub,
  change,
  changeGood,
  tone = "default",
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  /** Percent change vs previous period. */
  change?: number | null;
  /** Whether that change is good (green), bad (red) or neutral (undefined → gray). */
  changeGood?: boolean;
  tone?: "default" | "alert" | "gold";
  className?: string;
}) {
  const hasChange = change != null && Number.isFinite(change);
  return (
    <div
      className={cn(
        "rounded-2xl border p-4",
        tone === "alert" ? "border-red-200 bg-red-50" : tone === "gold" ? "border-gt-gold/50 bg-gold-50" : "border-line bg-white",
        className,
      )}
    >
      <div className={cn("text-[0.7rem] font-semibold tracking-[0.14em] uppercase", tone === "alert" ? "text-red-800" : "text-ink-muted")}>{label}</div>
      <div className={cn("mt-1 font-mono text-3xl font-bold tabular-nums", tone === "alert" ? "text-red-800" : tone === "gold" ? "text-gold-ink" : "text-ink")}>
        {value}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
        {hasChange && (
          <span className={cn("font-semibold", changeGood === undefined || Math.abs(change) < 1 ? "text-ink-muted" : changeGood ? "text-emerald-700" : "text-red-700")}>
            {change > 0 ? "▲" : change < 0 ? "▼" : ""} {Math.abs(Math.round(change))}%
          </span>
        )}
        {sub}
      </div>
    </div>
  );
}
