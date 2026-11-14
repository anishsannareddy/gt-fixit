import Link from "next/link";
import type { ReactNode } from "react";
import type { TicketWithRelations } from "@/lib/types";
import { timeAgo } from "@/lib/format";
import { PriorityBadge, StatusBadge } from "./Badges";
import { ChevronRightIcon, PinIcon } from "./Icons";

export function RequestCard({
  ticket,
  showReporter = false,
  showAssignee = false,
  actions,
}: {
  ticket: TicketWithRelations;
  showReporter?: boolean;
  showAssignee?: boolean;
  actions?: ReactNode;
}) {
  return (
    <article className="card overflow-hidden">
      <Link href={`/requests/${ticket.id}`} className="flex gap-3 p-4 transition hover:bg-slate-50">
        {ticket.photo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ticket.photo_url} alt="" className="size-16 shrink-0 rounded-xl object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            <span className="ml-auto font-mono text-xs text-slate-500">#{ticket.id}</span>
          </div>
          <h3 className="mt-1.5 truncate font-semibold text-slate-900">{ticket.title}</h3>
          <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-slate-600">
            <PinIcon className="size-3.5 shrink-0" />
            <span className="truncate">
              {ticket.building?.name ?? "Unknown building"}
              {ticket.location_detail ? ` · ${ticket.location_detail}` : ""}
            </span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {ticket.category} · {timeAgo(ticket.created_at)}
            {showReporter && ticket.reporter ? ` · by ${ticket.reporter.name}` : ""}
            {showAssignee ? ` · ${ticket.assignee ? `→ ${ticket.assignee.name}` : "Unassigned"}` : ""}
          </p>
        </div>
        <ChevronRightIcon className="size-5 shrink-0 self-center text-slate-400" />
      </Link>
      {actions && <div className="flex flex-wrap gap-2 border-t border-slate-100 bg-slate-50/60 px-4 py-2.5">{actions}</div>}
    </article>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <div className="grid size-12 place-items-center rounded-full bg-gt-gold-50 text-2xl" aria-hidden="true">
        ✓
      </div>
      <h3 className="mt-3 font-semibold text-slate-900">{title}</h3>
      {children && <div className="mt-1 max-w-sm text-sm text-slate-600">{children}</div>}
    </div>
  );
}
