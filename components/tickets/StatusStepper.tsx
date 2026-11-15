import { STATUSES, STATUS_META } from "@/lib/constants";
import type { Status } from "@/lib/types";
import { cn } from "@/components/ui/cn";

/** Submitted → Assigned → In progress → Resolved, with the current step highlighted. */
export function StatusStepper({ status, className }: { status: Status; className?: string }) {
  const current = STATUSES.indexOf(status);
  return (
    <ol className={cn("flex items-center gap-1", className)} aria-label={`Status: ${STATUS_META[status].label}`}>
      {STATUSES.map((s, i) => (
        <li key={s} className="flex flex-1 flex-col gap-1">
          <span className={cn("h-1.5 rounded-full", i <= current ? (status === "resolved" ? "bg-emerald-600" : "bg-gt-navy") : "bg-slate-200")} />
          <span className={cn("text-[0.65rem] font-semibold", i === current ? "text-ink" : "text-ink-muted", i !== current && "hidden sm:block")}>
            {STATUS_META[s].label}
          </span>
        </li>
      ))}
    </ol>
  );
}
