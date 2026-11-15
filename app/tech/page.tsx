import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/demo-auth";
import { db } from "@/lib/supabase/server";
import { getBuildings, TICKET_SELECT } from "@/lib/data";
import { CATEGORIES, OPEN_STATUSES, PRIORITIES, PRIORITY_META, PRIORITY_RANK } from "@/lib/constants";
import { AREAS, AREA_META } from "@/lib/campus/areas";
import type { TicketWithRelations, User } from "@/lib/types";
import { EmptyState, RequestCard } from "@/components/RequestCard";
import { FilterSelect } from "@/components/FilterSelect";
import { SubmitButton } from "@/components/SubmitButton";
import { updateTicket } from "../requests/actions";

export const metadata: Metadata = { title: "Maintenance queue" };

type Tab = "mine" | "unassigned" | "open" | "resolved";

export default async function TechQueuePage(props: PageProps<"/tech">) {
  const user = await requireUser(["technician", "admin"]);
  const sp = await props.searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");

  const tabs: { key: Tab; label: string }[] =
    user.role === "technician"
      ? [
          { key: "mine", label: "My work" },
          { key: "unassigned", label: "Unassigned" },
          { key: "open", label: "All open" },
          { key: "resolved", label: "Resolved" },
        ]
      : [
          { key: "unassigned", label: "Unassigned" },
          { key: "open", label: "All open" },
          { key: "resolved", label: "Resolved" },
        ];
  const tab = (tabs.find((t) => t.key === str("tab"))?.key ?? tabs[0].key) as Tab;

  const [openRes, resolvedRes, buildings] = await Promise.all([
    db().from("requests").select(TICKET_SELECT).in("status", OPEN_STATUSES),
    db().from("requests").select(TICKET_SELECT).eq("status", "resolved").order("resolved_at", { ascending: false }).limit(50),
    getBuildings(),
  ]);
  if (openRes.error) throw new Error(openRes.error.message);
  if (resolvedRes.error) throw new Error(resolvedRes.error.message);
  const open = (openRes.data ?? []) as TicketWithRelations[];
  const resolved = (resolvedRes.data ?? []) as TicketWithRelations[];

  // Urgent first, then oldest first — what a dispatcher would want
  open.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.created_at.localeCompare(b.created_at));

  const byTab: Record<Tab, TicketWithRelations[]> = {
    mine: open.filter((t) => t.assignee_id === user.id),
    unassigned: open.filter((t) => t.status === "submitted"),
    open,
    resolved,
  };

  const building = str("building");
  const category = str("category");
  const priority = str("priority");
  const area = str("area");
  const shown = byTab[tab].filter(
    (t) =>
      (!area || t.area === area) &&
      (!building || String(t.building_id) === building) &&
      (!category || t.category === category) &&
      (!priority || t.priority === priority),
  );

  const urgentUnassigned = byTab.unassigned.filter((t) => t.priority === "urgent").length;
  const tabHref = (key: Tab) => {
    const next = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]);
    next.set("tab", key);
    return `/tech?${next.toString()}`;
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-32 md:px-6 md:pt-10 md:pb-16">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
            {user.role === "technician" ? "My queue" : "All requests"}
          </h1>
          <p className="mt-2 text-ink-muted">
            {byTab.unassigned.length} waiting for a technician
            {urgentUnassigned > 0 && (
              <span className="font-semibold text-red-700"> · {urgentUnassigned} urgent</span>
            )}
            {user.role === "technician" && <> · {byTab.mine.length} assigned to you</>}
          </p>
        </div>
      </div>

      <div className="-mx-4 mt-5 overflow-x-auto px-4">
        <div className="flex gap-2" role="tablist" aria-label="Queue views">
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={tabHref(t.key)}
              role="tab"
              aria-selected={tab === t.key}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition ${
                tab === t.key ? "bg-gt-navy text-white" : "bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
              }`}
            >
              {t.label} <span className="opacity-70">{t.key === "resolved" ? "" : byTab[t.key].length}</span>
            </Link>
          ))}
        </div>
      </div>

      <Suspense>
        <div className="mt-3 flex flex-wrap gap-2">
          <FilterSelect param="area" label="Area" options={AREAS.map((a) => ({ value: a, label: AREA_META[a].label }))} />
          <FilterSelect
            param="building"
            label="Building"
            options={buildings.filter((b) => !area || b.area === area).map((b) => ({ value: String(b.id), label: b.name }))}
          />
          <FilterSelect param="category" label="Category" options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
          <FilterSelect param="priority" label="Priority" options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_META[p].label }))} />
        </div>
      </Suspense>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {shown.length === 0 ? (
          <div className="lg:col-span-2">
            <EmptyState title={tab === "mine" ? "Nothing assigned to you" : "No requests match"}>
              {tab === "mine" ? "Check the Unassigned tab to pick up new work." : "Try clearing a filter."}
            </EmptyState>
          </div>
        ) : (
          shown.map((t) => (
            <RequestCard key={t.id} ticket={t} showAssignee={tab !== "mine"} showReporter actions={<QuickActions ticket={t} user={user} />} />
          ))
        )}
      </div>
    </div>
  );
}

/** One-tap actions right on the card. Resolution notes can be added on the detail page. */
function QuickActions({ ticket, user }: { ticket: TicketWithRelations; user: User }) {
  const isTech = user.role === "technician";
  const canWork = user.role === "admin" || ticket.assignee_id === user.id;
  const btn = "btn-outline min-h-9 px-3 py-1.5";

  const actions: { action: string; label: string; pending: string; cls?: string }[] = [];
  if (isTech && ticket.status === "submitted") actions.push({ action: "claim", label: "Claim", pending: "Claiming…", cls: "btn-primary min-h-9 px-3 py-1.5" });
  if (canWork && ticket.status === "assigned") actions.push({ action: "start", label: "Start work", pending: "Starting…" });
  if (canWork && (ticket.status === "assigned" || ticket.status === "in_progress"))
    actions.push({ action: "resolve", label: "Resolve", pending: "Resolving…", cls: "btn-gold min-h-9 px-3 py-1.5" });

  if (actions.length === 0) {
    if (user.role === "admin" && ticket.status === "submitted") {
      return (
        <Link href={`/requests/${ticket.id}`} className={btn}>
          Assign technician →
        </Link>
      );
    }
    return null;
  }
  return (
    <>
      {actions.map((a) => (
        <form key={a.action} action={updateTicket}>
          <input type="hidden" name="id" value={ticket.id} />
          <input type="hidden" name="action" value={a.action} />
          <SubmitButton className={a.cls ?? btn} pendingLabel={a.pending}>
            {a.label}
          </SubmitButton>
        </form>
      ))}
    </>
  );
}
