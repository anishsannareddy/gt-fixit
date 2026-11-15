"use client";

import Link from "next/link";
import { useState } from "react";
import { updateStack } from "@/app/requests/actions";
import { AiUrgency, type AiFields } from "@/components/tickets/AiUrgency";
import { ActionForm } from "@/components/ui/ActionForm";
import { AreaBadge, PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/components/ui/cn";
import { CheckIcon, ChevronRightIcon, HandIcon, PinIcon, PlayIcon } from "@/components/ui/Icons";
import { Label, Textarea } from "@/components/ui/Form";
import { Sheet } from "@/components/ui/Sheet";
import { timeAgo } from "@/lib/format";
import type { Area } from "@/lib/campus/areas";
import type { Priority, Status } from "@/lib/types";

export type StackReport = {
  id: number;
  title: string;
  description: string;
  location_detail: string;
  photo_url: string | null;
  status: Status;
  assignee_id: string | null;
  assignee: string | null;
  created_at: string;
};

export type Stack = {
  groupId: number;
  title: string;
  building: string;
  category: string;
  area: Area;
  /** Highest AI-confirmed (or technician-set) urgency in the group. */
  urgency: Priority;
  /** Most advanced status among the reports. */
  status: Status;
  oldest: string;
  votes: number;
  reports: StackReport[];
  /** Report whose AI rating represents the stack (the most urgent one). */
  lead: AiFields;
  showAi: boolean;
  highlight: boolean;
};

/**
 * Smart Sort: several reports of the same issue shown as one job. Expand to see each report;
 * Claim / Start / Resolve act on every report in the stack the technician may change.
 */
export function StackCard({ stack, viewerId, canEdit }: { stack: Stack; viewerId: string; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  const n = stack.reports.length;
  return (
    <article
      aria-label={stack.title}
      data-testid="stack-card"
      className={cn("overflow-hidden rounded-3xl border border-line bg-white shadow-sm", stack.highlight && "border-l-4 border-l-gt-gold")}
    >
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full gap-3 p-4 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gt-navy">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={stack.status} />
            <PriorityBadge priority={stack.urgency} />
            <span className="ml-auto rounded-full bg-navy-50 px-2 py-0.5 text-xs font-bold text-ink ring-1 ring-slate-300">{n} reports</span>
          </div>
          <h3 className="mt-2 font-display text-lg font-bold break-words">{stack.title}</h3>
          <p className="mt-0.5 flex items-center gap-1 text-sm text-ink-muted">
            <PinIcon className="size-3.5 shrink-0" />
            <span className="truncate">{stack.building}</span>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
            <AreaBadge area={stack.area} />
            <span>{stack.category}</span>
            <span aria-hidden="true">·</span>
            <span>oldest {timeAgo(stack.oldest)}</span>
            <span aria-hidden="true">·</span>
            <span className="font-semibold text-ink">{stack.votes} students affected</span>
          </div>
        </div>
        <ChevronRightIcon className={cn("size-5 shrink-0 self-center text-ink-muted transition", open && "rotate-90")} />
      </button>

      {stack.showAi && (
        <div className="px-4 pb-3">
          <AiUrgency t={stack.lead} viewerId={viewerId} canEdit={canEdit} groupId={stack.groupId} />
        </div>
      )}

      {open && (
        <ul className="divide-y divide-line border-t border-line bg-page/60" aria-label={`Reports in ${stack.title}`}>
          {stack.reports.map((r) => (
            <li key={r.id}>
              <Link href={`/requests/${r.id}`} className="flex gap-3 px-4 py-3 hover:bg-navy-50">
                {r.photo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.photo_url} alt="" className="size-14 shrink-0 rounded-xl object-cover ring-1 ring-line" />
                )}
                <div className="min-w-0 flex-1 text-sm">
                  <p className="flex flex-wrap items-center gap-x-2 font-semibold">
                    <span className="break-words">{r.title}</span>
                    <span className="font-mono text-xs font-normal text-ink-muted">#{r.id}</span>
                  </p>
                  <p className="text-xs text-ink-muted">
                    {r.location_detail || "No room given"} · {timeAgo(r.created_at)}
                    {r.assignee ? ` · Tech: ${r.assignee}` : ""}
                  </p>
                  {r.description && <p className="mt-1 break-words text-ink">{r.description}</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <StackAction stack={stack} viewerId={viewerId} />
    </article>
  );
}

function StackAction({ stack, viewerId }: { stack: Stack; viewerId: string }) {
  const [resolving, setResolving] = useState(false);
  const unclaimed = stack.reports.filter((r) => r.status === "submitted").length;
  const mine = stack.reports.filter((r) => r.assignee_id === viewerId);
  const toStart = mine.filter((r) => r.status === "assigned").length;
  const toResolve = mine.length;
  const others = stack.reports.filter((r) => r.assignee_id && r.assignee_id !== viewerId).length;

  let body: React.ReactNode = null;
  if (unclaimed) body = <OneTap groupId={stack.groupId} action="claim" label={`Claim all ${unclaimed}`} pending="Claiming…" icon={<HandIcon className="size-5" />} />;
  else if (toStart) body = <OneTap groupId={stack.groupId} action="start" label={`Start work on ${toStart}`} pending="Starting…" icon={<PlayIcon className="size-5" />} />;
  else if (toResolve)
    body = (
      <>
        <Button variant="gold" size="lg" full onClick={() => setResolving(true)}>
          <CheckIcon className="size-5" /> Resolve all {toResolve}
        </Button>
        <Sheet open={resolving} onClose={() => setResolving(false)} eyebrow={`${toResolve} reports`} title={`Resolve: ${stack.title}`}>
          <ActionForm action={updateStack} onDone={() => setResolving(false)} className="space-y-3">
            {(pending) => (
              <>
                <input type="hidden" name="group_id" value={stack.groupId} />
                <input type="hidden" name="action" value="resolve" />
                <Label htmlFor={`resolve-stack-${stack.groupId}`} optional>
                  What did you fix?
                </Label>
                <Textarea id={`resolve-stack-${stack.groupId}`} name="note" rows={3} autoFocus placeholder="e.g. Fixed the leaking pipe above the lounge." />
                <p className="text-xs text-ink-muted">Every reporter sees this note on their request.</p>
                <Button variant="gold" size="lg" full type="submit" disabled={pending}>
                  {pending ? "Resolving…" : `Mark all ${toResolve} resolved`}
                </Button>
              </>
            )}
          </ActionForm>
        </Sheet>
      </>
    );
  if (!body && !others) return null;
  return (
    <div className="space-y-2 border-t border-line bg-page/60 p-3">
      {body}
      {others > 0 && <p className="text-center text-xs text-ink-muted">{others} report{others === 1 ? " is" : "s are"} with another technician.</p>}
    </div>
  );
}

function OneTap({ groupId, action, label, pending: pendingLabel, icon }: { groupId: number; action: string; label: string; pending: string; icon: React.ReactNode }) {
  return (
    <ActionForm action={updateStack}>
      {(pending) => (
        <>
          <input type="hidden" name="group_id" value={groupId} />
          <input type="hidden" name="action" value={action} />
          <Button variant="gold" size="lg" full type="submit" disabled={pending}>
            {icon} {pending ? pendingLabel : label}
          </Button>
        </>
      )}
    </ActionForm>
  );
}
