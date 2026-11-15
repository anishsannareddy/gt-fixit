import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/demo-auth";
import { getTechnicians, getTicket, getTicketEvents } from "@/lib/data";
import { formatDateTime, formatHours, timeAgo } from "@/lib/format";
import { AREA_META } from "@/lib/campus/areas";
import type { TicketWithRelations, User } from "@/lib/types";
import { PriorityBadge, StatusBadge } from "@/components/Badges";
import { ArrowLeftIcon, CheckIcon } from "@/components/ui/Icons";
import { StatusTimeline } from "@/components/StatusTimeline";
import { SubmitButton } from "@/components/SubmitButton";
import { updateTicket } from "../actions";

export async function generateMetadata(props: PageProps<"/requests/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  return { title: `Request #${id}` };
}

export default async function RequestDetailPage(props: PageProps<"/requests/[id]">) {
  const user = await requireUser();
  const { id } = await props.params;
  const { new: isNew } = await props.searchParams;

  const ticket = Number.isInteger(Number(id)) ? await getTicket(Number(id)) : null;
  // Reporters can only see their own requests
  if (!ticket || (user.role === "reporter" && ticket.reporter_id !== user.id)) notFound();

  const [events, technicians] = await Promise.all([
    getTicketEvents(ticket.id),
    user.role === "admin" ? getTechnicians() : Promise.resolve([] as User[]),
  ]);
  const backHref = user.role === "reporter" ? "/my-requests" : "/tech";
  const resolveHours = ticket.resolved_at
    ? (new Date(ticket.resolved_at).getTime() - new Date(ticket.created_at).getTime()) / 3_600_000
    : null;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 pt-6 pb-32 md:px-6 md:pt-10 md:pb-16">
      <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm font-medium text-gold-ink hover:underline">
        <ArrowLeftIcon className="size-4" /> Back
      </Link>

      {isNew && (
        <div role="status" className="flex items-start gap-3 rounded-2xl border border-green-300 bg-green-50 p-4 text-green-900">
          <CheckIcon className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-semibold">Request #{ticket.id} submitted!</p>
            <p className="text-sm">The maintenance team has been notified. You can track progress here or in My requests.</p>
          </div>
        </div>
      )}

      <article className="card overflow-hidden">
        <div className="p-5 md:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={ticket.status} />
            <PriorityBadge priority={ticket.priority} />
            <span className="ml-auto font-mono text-sm text-slate-500">#{ticket.id}</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold text-gt-navy">{ticket.title}</h1>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm md:grid-cols-3 lg:grid-cols-4">
            <Info label="Building" value={`${ticket.building?.name ?? "—"}${ticket.building?.number ? ` (#${ticket.building.number})` : ""}`} />
            <Info label="Location" value={ticket.location_detail || "—"} />
            <Info label="Maintenance area" value={AREA_META[ticket.area]?.label ?? ticket.area} />
            <Info label="Category" value={ticket.category} />
            <Info label="Reported" value={`${timeAgo(ticket.created_at)} by ${ticket.reporter?.name ?? "—"}`} />
            <Info label="Assigned to" value={ticket.assignee?.name ?? "Not yet assigned"} />
            <Info label={ticket.resolved_at ? "Resolved in" : "Last update"} value={ticket.resolved_at ? formatHours(resolveHours) : formatDateTime(ticket.updated_at)} />
          </dl>
          {ticket.description && <p className="mt-5 whitespace-pre-line text-slate-700">{ticket.description}</p>}
        </div>
        {ticket.photo_url && (
          <a href={ticket.photo_url} target="_blank" rel="noreferrer" className="block border-t border-slate-100 bg-slate-900">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ticket.photo_url} alt={`Photo of: ${ticket.title}`} className="mx-auto max-h-[28rem] w-auto object-contain" />
          </a>
        )}
      </article>

      <TicketActions ticket={ticket} user={user} technicians={technicians} />

      <section className="card p-5 md:p-6">
        <h2 className="mb-4 font-bold text-gt-navy">Activity</h2>
        <StatusTimeline events={events} />
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</dt>
      <dd className="mt-0.5 font-medium break-words text-slate-900">{value}</dd>
    </div>
  );
}

/** Role-aware action panel. Server-side rules in ../actions.ts are the real enforcement. */
function TicketActions({ ticket, user, technicians }: { ticket: TicketWithRelations; user: User; technicians: User[] }) {
  const isAdmin = user.role === "admin";
  const isTech = user.role === "technician";
  const mine = ticket.assignee_id === user.id;
  const canWork = isAdmin || (isTech && mine);
  const blocks: React.ReactNode[] = [];

  if (isTech && ticket.status === "submitted") {
    blocks.push(
      <form key="claim" action={updateTicket}>
        <Hidden id={ticket.id} action="claim" />
        <SubmitButton className="btn-primary w-full sm:w-auto" pendingLabel="Claiming…">Claim this request</SubmitButton>
      </form>,
    );
  }

  if (isAdmin && (ticket.status === "submitted" || ticket.status === "assigned")) {
    blocks.push(
      <form key="assign" action={updateTicket} className="flex flex-col gap-2 sm:flex-row">
        <Hidden id={ticket.id} action="assign" />
        <label htmlFor="assignee_id" className="sr-only">Technician</label>
        <select id="assignee_id" name="assignee_id" defaultValue={ticket.assignee_id ?? ""} required className="field sm:max-w-xs">
          <option value="" disabled>Choose a technician…</option>
          {technicians.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        <SubmitButton className="btn-primary" pendingLabel="Assigning…">{ticket.assignee_id ? "Reassign" : "Assign"}</SubmitButton>
      </form>,
    );
  }

  if (canWork && ticket.status === "assigned") {
    blocks.push(
      <form key="start" action={updateTicket}>
        <Hidden id={ticket.id} action="start" />
        <SubmitButton className="btn-outline w-full sm:w-auto" pendingLabel="Starting…">Start work</SubmitButton>
      </form>,
    );
  }

  if (canWork && (ticket.status === "assigned" || ticket.status === "in_progress")) {
    blocks.push(
      <form key="resolve" action={updateTicket} className="space-y-2">
        <Hidden id={ticket.id} action="resolve" />
        <label htmlFor="note" className="label">Resolution note</label>
        <textarea id="note" name="note" rows={2} className="field" placeholder="What did you fix? e.g. Replaced faucet cartridge." />
        <SubmitButton className="btn-gold w-full sm:w-auto" pendingLabel="Resolving…">Mark resolved</SubmitButton>
      </form>,
    );
  }

  if (ticket.status === "resolved" && (isAdmin || ticket.reporter_id === user.id)) {
    blocks.push(
      <form key="reopen" action={updateTicket} className="space-y-2">
        <Hidden id={ticket.id} action="reopen" />
        <p className="text-sm text-slate-600">Still not fixed?</p>
        <input name="note" className="field" placeholder="What's still wrong? (optional)" />
        <SubmitButton className="btn-outline" pendingLabel="Reopening…">Reopen request</SubmitButton>
      </form>,
    );
  }

  if (blocks.length === 0) return null;
  return (
    <section className="card space-y-4 p-5 md:p-6">
      <h2 className="font-bold text-gt-navy">{user.role === "reporter" ? "Your options" : "Update this request"}</h2>
      {blocks}
    </section>
  );
}

function Hidden({ id, action }: { id: number; action: string }) {
  return (
    <>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="action" value={action} />
    </>
  );
}
