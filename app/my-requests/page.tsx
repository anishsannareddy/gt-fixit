import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/demo-auth";
import { db } from "@/lib/supabase/server";
import { TICKET_SELECT } from "@/lib/data";
import { OPEN_STATUSES } from "@/lib/constants";
import type { TicketWithRelations } from "@/lib/types";
import { EmptyState, RequestCard } from "@/components/RequestCard";
import { PlusIcon } from "@/components/ui/Icons";

export const metadata: Metadata = { title: "My requests" };

const FILTERS = [
  { key: "open", label: "Open" },
  { key: "resolved", label: "Resolved" },
  { key: "all", label: "All" },
] as const;

export default async function MyRequestsPage(props: PageProps<"/my-requests">) {
  const user = await requireUser(["reporter"]);
  const sp = await props.searchParams;
  const filter = FILTERS.some((f) => f.key === sp.filter) ? (sp.filter as string) : "open";

  const { data, error } = await db()
    .from("requests")
    .select(TICKET_SELECT)
    .eq("reporter_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const all = (data ?? []) as TicketWithRelations[];

  const counts = {
    open: all.filter((t) => OPEN_STATUSES.includes(t.status)).length,
    resolved: all.filter((t) => t.status === "resolved").length,
    all: all.length,
  };
  const shown =
    filter === "open" ? all.filter((t) => t.status !== "resolved") : filter === "resolved" ? all.filter((t) => t.status === "resolved") : all;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-6 pb-32 md:px-6 md:pt-10 md:pb-16">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">My requests</h1>
          <p className="mt-2 text-white/65">Track everything you&apos;ve reported.</p>
        </div>
        <Link href="/report" className="btn-gold hidden sm:inline-flex">
          <PlusIcon className="size-4" /> New request
        </Link>
      </div>

      <div className="mt-5 flex gap-2" role="tablist" aria-label="Filter requests">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/my-requests?filter=${f.key}`}
            role="tab"
            aria-selected={filter === f.key}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              filter === f.key ? "bg-gt-navy text-white" : "bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
            }`}
          >
            {f.label} <span className="opacity-70">{counts[f.key]}</span>
          </Link>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {shown.length === 0 ? (
          <EmptyState title={filter === "open" ? "No open requests" : "Nothing here yet"}>
            Spot something broken?{" "}
            <Link href="/report" className="font-semibold text-gt-navy underline">
              Report an issue
            </Link>
            .
          </EmptyState>
        ) : (
          shown.map((t) => <RequestCard key={t.id} ticket={t} showAssignee />)
        )}
      </div>
    </div>
  );
}
