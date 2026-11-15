import Link from "next/link";
import type { ReactNode } from "react";
import type { TicketWithRelations } from "@/lib/types";
import { timeAgo } from "@/lib/format";
import { AreaBadge, PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import { ChevronRightIcon, PinIcon } from "@/components/ui/Icons";
import { StatusStepper } from "./StatusStepper";

/** A request in a list. The whole top part links to `href` (the detail page by default). */
export function TicketCard({
  ticket,
  href = `/requests/${ticket.id}`,
  showReporter = false,
  showAssignee = false,
  stepper = false,
  footer,
}: {
  ticket: TicketWithRelations;
  href?: string;
  showReporter?: boolean;
  showAssignee?: boolean;
  stepper?: boolean;
  /** Actions shown under the card (e.g. a big Claim / Start / Resolve button). */
  footer?: ReactNode;
}) {
  return (
    <article className="overflow-hidden rounded-3xl border border-line bg-white shadow-sm transition hover:shadow-panel">
      <Link href={href} className="flex gap-3 p-4 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gt-navy">
        {ticket.photo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ticket.photo_url} alt="" className="size-18 shrink-0 rounded-2xl object-cover ring-1 ring-line" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            <span className="ml-auto font-mono text-xs text-ink-muted">#{ticket.id}</span>
          </div>
          <h3 className="mt-2 truncate font-display text-lg font-bold">{ticket.title}</h3>
          <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-ink-muted">
            <PinIcon className="size-3.5 shrink-0" />
            <span className="truncate">
              {ticket.building?.name ?? "Unknown building"}
              {ticket.location_detail ? ` · ${ticket.location_detail}` : ""}
            </span>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
            <AreaBadge area={ticket.area} />
            <span>{ticket.category}</span>
            <span aria-hidden="true">·</span>
            <span>{timeAgo(ticket.created_at)}</span>
            {showReporter && ticket.reporter && <span>· by {ticket.reporter.name}</span>}
            {showAssignee && <span>· {ticket.assignee ? `Tech: ${ticket.assignee.name}` : "Unassigned"}</span>}
          </div>
          {stepper && <StatusStepper status={ticket.status} className="mt-3" />}
        </div>
        <ChevronRightIcon className="size-5 shrink-0 self-center text-ink-muted" />
      </Link>
      {footer && <div className="border-t border-line bg-page/60 p-3">{footer}</div>}
    </article>
  );
}
