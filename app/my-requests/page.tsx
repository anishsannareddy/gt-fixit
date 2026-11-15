import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { TICKET_SELECT } from "@/lib/data";
import type { TicketWithRelations } from "@/lib/types";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Button } from "@/components/ui/Button";
import { Chip, ChipRow } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/Feedback";
import { PlusIcon } from "@/components/ui/Icons";
import { GemCheck } from "@/components/ui/Illustration";
import { FadeIn } from "@/components/ui/Motion";
import { PageContainer, PageHeader } from "@/components/ui/Surface";
import { TicketCard } from "@/components/tickets/TicketCard";

export const metadata: Metadata = { title: "My requests" };

const FILTERS = [
  { key: "open", label: "Open" },
  { key: "resolved", label: "Resolved" },
  { key: "all", label: "All" },
] as const;
type Filter = (typeof FILTERS)[number]["key"];

export default async function MyRequestsPage(props: PageProps<"/my-requests">) {
  const user = await requireUser(["reporter"]);
  const sp = await props.searchParams;
  const filter: Filter = FILTERS.find((f) => f.key === sp.filter)?.key ?? "open";

  const { data, error } = await db().from("requests").select(TICKET_SELECT).eq("reporter_id", user.id).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const all = (data ?? []) as TicketWithRelations[];
  const groups: Record<Filter, TicketWithRelations[]> = {
    open: all.filter((t) => t.status !== "resolved"),
    resolved: all.filter((t) => t.status === "resolved"),
    all,
  };
  const shown = groups[filter];

  return (
    <PageContainer narrow>
      <AutoRefresh />
      <PageHeader eyebrow="Your reports" title="My requests" subtitle="Track everything you've reported. This page updates on its own.">
        <Button href="/report" variant="gold" className="hidden sm:inline-flex">
          <PlusIcon className="size-4" /> Report an issue
        </Button>
      </PageHeader>

      <ChipRow label="Filter requests">
        {FILTERS.map((f) => (
          <Chip key={f.key} href={`/my-requests?filter=${f.key}`} active={filter === f.key} count={groups[f.key].length}>
            {f.label}
          </Chip>
        ))}
      </ChipRow>

      <div className="mt-5 space-y-3">
        {shown.length === 0 ? (
          <EmptyState
            title={filter === "open" ? "Nothing open right now" : filter === "resolved" ? "Nothing resolved yet" : "You haven't reported anything yet"}
            art={filter === "open" ? <GemCheck /> : undefined}
            action={
              <Button href="/report" variant="gold">
                <PlusIcon className="size-4" /> Report an issue
              </Button>
            }
          >
            Spot something broken? Pick the building on the campus map and tell us about it.
          </EmptyState>
        ) : (
          shown.map((t, i) => (
            <FadeIn key={t.id} index={i}>
              <TicketCard ticket={t} stepper showAssignee />
            </FadeIn>
          ))
        )}
      </div>
    </PageContainer>
  );
}
