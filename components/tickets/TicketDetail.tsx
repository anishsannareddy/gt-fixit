import type { TicketEvent, TicketWithRelations } from "@/lib/types";
import { formatDateTime, formatHours, timeAgo } from "@/lib/format";
import { AreaBadge, PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import { StatusStepper } from "./StatusStepper";
import { Timeline } from "./Timeline";

/** Everything about one request: header, facts, description, photo and history. Used on the detail page and in the admin drawer. */
export function TicketDetail({ ticket, events, actions }: { ticket: TicketWithRelations; events: TicketEvent[]; actions?: React.ReactNode }) {
  const resolveHours = ticket.resolved_at ? (new Date(ticket.resolved_at).getTime() - new Date(ticket.created_at).getTime()) / 3_600_000 : null;
  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-line bg-white p-5 shadow-sm md:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={ticket.status} />
          <PriorityBadge priority={ticket.priority} />
          <AreaBadge area={ticket.area} />
          <span className="ml-auto font-mono text-sm text-ink-muted">#{ticket.id}</span>
        </div>
        <h1 className="mt-3 font-display text-3xl leading-tight font-bold tracking-tight">{ticket.title}</h1>
        <StatusStepper status={ticket.status} className="mt-4" />
        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
          <Fact label="Building" value={`${ticket.building?.name ?? "—"}${ticket.building?.number ? ` (#${ticket.building.number})` : ""}`} />
          <Fact label="Location" value={ticket.location_detail || "—"} />
          <Fact label="Category" value={ticket.category} />
          <Fact label="Reported" value={`${timeAgo(ticket.created_at)} by ${ticket.reporter?.name ?? "—"}`} />
          <Fact label="Technician" value={ticket.assignee?.name ?? "Not assigned yet"} />
          <Fact label={ticket.resolved_at ? "Resolved in" : "Last update"} value={ticket.resolved_at ? formatHours(resolveHours) : formatDateTime(ticket.updated_at)} />
        </dl>
        {ticket.description && <p className="mt-5 whitespace-pre-line">{ticket.description}</p>}
      </section>

      {ticket.photo_url && (
        <a href={ticket.photo_url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-3xl border border-line bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ticket.photo_url} alt={`Photo of: ${ticket.title}`} className="mx-auto max-h-[26rem] w-auto object-contain" />
        </a>
      )}

      {actions}

      <section className="rounded-3xl border border-line bg-white p-5 shadow-sm md:p-6">
        <h2 className="mb-4 font-display text-lg font-bold">Activity</h2>
        <Timeline events={events} />
      </section>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[0.7rem] font-semibold tracking-wide text-ink-muted uppercase">{label}</dt>
      <dd className="mt-0.5 font-medium break-words">{value}</dd>
    </div>
  );
}
