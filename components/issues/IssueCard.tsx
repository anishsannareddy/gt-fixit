"use client";

import { AnimatePresence, motion } from "motion/react";
import { useId, useState, useTransition } from "react";
import { toggleVote } from "@/app/issues/actions";
import type { ActiveIssue, IssueDetail } from "@/lib/issues";
import { formatDateTime, timeAgo } from "@/lib/format";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { CheckIcon, ChevronRightIcon, HandIcon, PinIcon, UserIcon } from "@/components/ui/Icons";
import { useToast } from "@/components/ui/Toast";
import { Timeline } from "@/components/tickets/Timeline";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * One active campus issue. "Me too" updates the count right away (optimistic) and rolls back
 * with a toast if the server says no. `detail` enables the expandable reports + timeline.
 */
export function IssueCard({
  issue,
  detail,
  compact = false,
  onVoted,
}: {
  issue: ActiveIssue;
  detail?: IssueDetail;
  compact?: boolean;
  /** Called after a successful "Me too" (used by the report form's suggestions). */
  onVoted?: (issue: ActiveIssue) => void;
}) {
  const [voted, setVoted] = useState(issue.voted);
  const [affected, setAffected] = useState(issue.affected);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const panelId = useId();

  function toggle() {
    const want = !voted;
    setVoted(want);
    setAffected((n) => Math.max(1, n + (want ? 1 : -1)));
    start(async () => {
      try {
        const res = await toggleVote(issue.id, want);
        if (!res.ok) throw new Error(res.error);
        if ("affected" in res && res.affected) setAffected(res.affected);
        toast(res.message);
        if (want) onVoted?.(issue);
      } catch (err) {
        setVoted(!want);
        setAffected((n) => Math.max(1, n + (want ? -1 : 1)));
        toast(err instanceof Error && err.message ? err.message : "Something went wrong. Try again.", "error");
      }
    });
  }

  return (
    <article className="overflow-hidden rounded-3xl border border-line bg-white shadow-sm" data-testid="issue-card" aria-label={issue.title}>
      <div className={cn("p-4", compact && "p-3.5")}>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={issue.status} />
          <span className="text-xs text-ink-muted">{issue.category}</span>
          <span className="ml-auto text-xs text-ink-muted" suppressHydrationWarning>Updated {timeAgo(issue.updated_at)}</span>
        </div>
        <h3 className={cn("mt-2 font-display font-bold", compact ? "text-base" : "text-lg")}>{issue.title}</h3>
        {!compact && (
          <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-ink-muted">
            <PinIcon className="size-3.5 shrink-0" />
            <span className="truncate">{issue.building.name}</span>
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-ink" aria-live="polite">
            <UserIcon className="size-4 text-ink-muted" />
            <span data-testid="affected-count">{plural(affected, "student", "students")}</span> affected
          </p>
          <div className="ml-auto">
            {issue.reported ? (
              <span className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-gold-50 px-3.5 text-sm font-semibold text-gold-ink ring-1 ring-gt-gold/60 ring-inset">
                <CheckIcon className="size-4" /> You reported this
              </span>
            ) : voted ? (
              <Button size="sm" onClick={toggle} disabled={pending} aria-pressed="true" className="min-h-10 rounded-full">
                <CheckIcon className="size-4" /> You&apos;re affected · Undo
              </Button>
            ) : (
              <Button size="sm" variant="gold" onClick={toggle} disabled={pending} aria-pressed="false" className="min-h-10 rounded-full px-4">
                <HandIcon className="size-4" /> Me too
              </Button>
            )}
          </div>
        </div>
      </div>

      {detail && (
        <>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={panelId}
            className="flex min-h-11 w-full items-center gap-2 border-t border-line bg-page/60 px-4 text-left text-sm font-semibold text-ink hover:bg-navy-50"
          >
            <ChevronRightIcon className={cn("size-4 transition", open && "rotate-90")} />
            {open ? "Hide" : "Show"} {plural(detail.reports.length, "report", "reports")} and status history
          </button>
          <AnimatePresence initial={false}>
            {open && (
              <motion.div
                id={panelId}
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="grid gap-6 border-t border-line p-4 md:grid-cols-2">
                  <section>
                    <h4 className="mb-2 text-xs font-bold tracking-wide text-ink-muted uppercase">Reports</h4>
                    <ul className="space-y-2">
                      {detail.reports.map((r) => (
                        <li key={r.id} className="rounded-2xl bg-page px-3 py-2.5 text-sm">
                          <p className="font-semibold">
                            {r.title} {r.mine && <span className="font-normal text-gold-ink">· You</span>}
                          </p>
                          {r.description && <p className="mt-0.5 text-ink-muted">{r.description}</p>}
                          <p className="mt-1 text-xs text-ink-muted">
                            {r.location_detail ? `${r.location_detail} · ` : ""}
                            {formatDateTime(r.created_at)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </section>
                  <section>
                    <h4 className="mb-3 text-xs font-bold tracking-wide text-ink-muted uppercase">Status history</h4>
                    <Timeline events={detail.events} />
                  </section>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </article>
  );
}
