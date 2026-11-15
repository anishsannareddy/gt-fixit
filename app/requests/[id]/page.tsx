import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getTechnicians, getTicket, getTicketEvents } from "@/lib/data";
import type { User } from "@/lib/types";
import { AutoRefresh } from "@/components/AutoRefresh";
import { ArrowLeftIcon } from "@/components/ui/Icons";
import { PageContainer } from "@/components/ui/Surface";
import { TicketActions } from "@/components/tickets/TicketActions";
import { AiTriagePanel } from "@/components/tickets/AiUrgency";
import { showsAiUrgency } from "@/lib/urgency";
import { TicketDetail } from "@/components/tickets/TicketDetail";
import { VisibilityControl } from "@/components/tickets/VisibilityControl";

export async function generateMetadata(props: PageProps<"/requests/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  return { title: `Request #${id}` };
}

const BACK = {
  reporter: { href: "/my-requests", label: "My requests" },
  technician: { href: "/tech", label: "My queue" },
  admin: { href: "/admin", label: "Command Center" },
} as const;

export default async function RequestDetailPage(props: PageProps<"/requests/[id]">) {
  const user = await requireUser();
  const { id } = await props.params;

  const ticket = /^\d+$/.test(id) ? await getTicket(Number(id)) : null;
  // Students can only see their own requests
  if (!ticket || (user.role === "reporter" && ticket.reporter_id !== user.id)) notFound();

  const [events, technicians] = await Promise.all([
    getTicketEvents(ticket.id),
    user.role === "admin" ? getTechnicians() : Promise.resolve([] as User[]),
  ]);
  const back = BACK[user.role];

  return (
    <PageContainer narrow>
      <AutoRefresh />
      <Link href={back.href} className="mb-4 inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-ink">
        <ArrowLeftIcon className="size-4" /> {back.label}
      </Link>
      <TicketDetail
        ticket={ticket}
        events={events}
        actions={
          <>
            {user.role !== "reporter" && ticket.status !== "resolved" && showsAiUrgency(ticket) && (
              <AiTriagePanel t={ticket} viewerId={user.id} canEdit={user.role === "admin" || !ticket.assignee_id || ticket.assignee_id === user.id} />
            )}
            {user.role === "reporter" && <VisibilityControl key={ticket.visibility} id={ticket.id} value={ticket.visibility} />}
            <TicketActions
              ticket={ticket}
              viewer={{ id: user.id, role: user.role }}
              technicians={technicians.map((t) => ({ id: t.id, name: t.name }))}
            />
          </>
        }
      />
    </PageContainer>
  );
}
