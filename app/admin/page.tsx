import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { fetchAll, getBuildings, getTechnicians, getTicket, getTicketEvents, TICKET_SELECT } from "@/lib/data";
import { computeAnalytics } from "@/lib/analytics";
import { OPEN_STATUSES, PRIORITIES, PRIORITY_META, PRIORITY_RANK, STATUSES, STATUS_META } from "@/lib/constants";
import { AREAS, AREA_META } from "@/lib/campus/areas";
import { timeAgo } from "@/lib/format";
import type { TicketWithRelations } from "@/lib/types";
import { AutoRefresh } from "@/components/AutoRefresh";
import { AdminCampusMap } from "@/components/campus/AdminCampusMap";
import { AreaBadge, PriorityBadge, StatusBadge } from "@/components/ui/Badge";
import { EmptyState, KpiTile } from "@/components/ui/Feedback";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { XIcon } from "@/components/ui/Icons";
import { PageContainer, PageHeader } from "@/components/ui/Surface";
import { TicketActions } from "@/components/tickets/TicketActions";
import { AiTriagePanel } from "@/components/tickets/AiUrgency";
import { TicketDetail } from "@/components/tickets/TicketDetail";
import { AdminDrawer } from "./AdminDrawer";
import { SearchBox } from "@/components/ui/SearchBox";

export const metadata: Metadata = { title: "Command Center" };

const ROW_LIMIT = 150;

export default async function CommandCenter(props: PageProps<"/admin">) {
  const user = await requireUser(["admin"]);
  const sp = await props.searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : "");

  const [tickets, buildings, technicians] = await Promise.all([
    fetchAll<TicketWithRelations>((from, to) => db().from("requests").select(TICKET_SELECT).order("id").range(from, to)),
    getBuildings(),
    getTechnicians(),
  ]);

  // ── KPIs (last 30 days) and the map's open-request counts ──
  const a = computeAnalytics(tickets, buildings, technicians, 30);
  const osmId = new Map(buildings.map((b) => [b.id, b.osm_id]));
  const openByOsmId: Record<string, number> = {};
  for (const t of tickets) {
    const id = osmId.get(t.building_id);
    if (t.status !== "resolved" && id) openByOsmId[id] = (openByOsmId[id] ?? 0) + 1;
  }

  // ── Filters (all in the URL, so views can be shared and survive refresh) ──
  const status = str("status") || "open"; // "open" = submitted + assigned + in progress
  const priority = str("priority");
  const area = str("area");
  const building = Number(str("building")) || null;
  const q = str("q").toLowerCase().replace(/^#/, "");
  const buildingName = building ? buildings.find((b) => b.id === building)?.name : null;

  const rows = tickets
    .filter((t) => (status === "open" ? OPEN_STATUSES.includes(t.status) : status === "all" ? true : t.status === status))
    .filter((t) => !priority || t.priority === priority)
    .filter((t) => !area || t.area === area)
    .filter((t) => !building || t.building_id === building)
    .filter((t) => !q || String(t.id) === q || t.title.toLowerCase().includes(q) || (t.building?.name.toLowerCase().includes(q) ?? false))
    .sort((x, y) =>
      status === "resolved" || status === "all"
        ? y.created_at.localeCompare(x.created_at)
        : PRIORITY_RANK[x.priority] - PRIORITY_RANK[y.priority] || x.created_at.localeCompare(y.created_at),
    );

  const keep = (extra: Record<string, string | null>) => {
    const next = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]);
    for (const [k, v] of Object.entries(extra)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    return `/admin?${next}`;
  };

  // ── Drawer ──
  const ticketId = Number(str("ticket")) || null;
  const [drawerTicket, drawerEvents] = ticketId ? await Promise.all([getTicket(ticketId), getTicketEvents(ticketId)]) : [null, []];

  return (
    <PageContainer className="space-y-5">
      <AutoRefresh />
      <PageHeader eyebrow="Facilities operations" title="Command Center" subtitle="Live view of every maintenance request on campus." />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Key numbers">
        <KpiTile label="Open now" value={a.kpis.openNow} sub="Across all buildings" />
        <KpiTile label="Urgent open" value={a.kpis.urgentOpen} tone={a.kpis.urgentOpen ? "alert" : "default"} sub={a.kpis.urgentOpen ? "Needs attention" : "All clear"} />
        <KpiTile label="Unassigned" value={a.kpis.unassigned} sub="Waiting for a tech" />
      </section>

      <Suspense>
        <AdminCampusMap counts={openByOsmId} buildings={buildings.map((b) => ({ id: b.id, osm_id: b.osm_id }))} />
      </Suspense>

      <section className="rounded-3xl border border-line bg-white shadow-sm" aria-labelledby="requests-heading">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <h2 id="requests-heading" className="font-display text-xl font-bold">
            Requests <span className="font-mono text-base text-ink-muted">{rows.length}</span>
          </h2>
          {buildingName && (
            <Link href={keep({ building: null, ticket: null })} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-gt-navy px-3 text-sm font-semibold text-white">
              {buildingName} <XIcon className="size-4" />
              <span className="sr-only">Clear building filter</span>
            </Link>
          )}
          <Suspense>
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <SearchBox />
              <FilterSelectStatus />
              <FilterSelect param="priority" label="Priority" options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_META[p].label }))} />
              <FilterSelect param="area" label="Area" options={AREAS.map((x) => ({ value: x, label: AREA_META[x].label }))} />
              <FilterSelect
                param="building"
                label="Building"
                className="col-span-2 sm:col-span-1 sm:max-w-xs"
                options={buildings.filter((b) => !area || b.area === area).map((b) => ({ value: String(b.id), label: b.name }))}
              />
            </div>
          </Suspense>
        </div>

        {rows.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No requests match">Try another building, or clear a filter.</EmptyState>
          </div>
        ) : (
          <>
            {/* Laptop: table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="text-[0.7rem] tracking-wide text-ink-muted uppercase">
                  <tr className="border-b border-line">
                    <th className="px-4 py-2.5 font-semibold">#</th>
                    <th className="px-2 py-2.5 font-semibold">Request</th>
                    <th className="px-2 py-2.5 font-semibold">Status</th>
                    <th className="px-2 py-2.5 font-semibold">Priority</th>
                    <th className="px-2 py-2.5 font-semibold">Area</th>
                    <th className="px-2 py-2.5 font-semibold">Technician</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Age</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, ROW_LIMIT).map((t) => {
                    const href = keep({ ticket: String(t.id) });
                    return (
                      <tr key={t.id} className={`border-b border-line last:border-0 hover:bg-navy-50 ${ticketId === t.id ? "bg-gold-50" : ""}`}>
                        <td className="px-4 py-2.5 font-mono text-ink-muted">
                          <Link href={href} scroll={false} className="hover:text-ink">
                            {t.id}
                          </Link>
                        </td>
                        <td className="max-w-80 px-2 py-2.5">
                          <Link href={href} scroll={false} className="block font-semibold hover:underline">
                            <span className="block truncate">{t.title}</span>
                            <span className="block truncate text-xs font-normal text-ink-muted">
                              {t.building?.name}
                              {t.location_detail ? ` · ${t.location_detail}` : ""}
                            </span>
                          </Link>
                        </td>
                        <td className="px-2 py-2.5"><StatusBadge status={t.status} /></td>
                        <td className="px-2 py-2.5"><PriorityBadge priority={t.priority} /></td>
                        <td className="px-2 py-2.5"><AreaBadge area={t.area} /></td>
                        <td className="px-2 py-2.5 text-ink-muted">{t.assignee?.name ?? "—"}</td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap text-ink-muted">{timeAgo(t.created_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Phone: stacked rows */}
            <ul className="divide-y divide-line md:hidden">
              {rows.slice(0, ROW_LIMIT).map((t) => (
                <li key={t.id}>
                  <Link href={keep({ ticket: String(t.id) })} scroll={false} className="block px-4 py-3 hover:bg-navy-50">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={t.status} />
                      <PriorityBadge priority={t.priority} />
                      <span className="ml-auto font-mono text-xs text-ink-muted">#{t.id}</span>
                    </div>
                    <p className="mt-1.5 truncate font-semibold">{t.title}</p>
                    <p className="truncate text-xs text-ink-muted">
                      {t.building?.name} · {AREA_META[t.area].label} · {t.assignee?.name ?? "Unassigned"} · {timeAgo(t.created_at)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
            {rows.length > ROW_LIMIT && <p className="border-t border-line px-4 py-3 text-sm text-ink-muted">Showing the first {ROW_LIMIT} of {rows.length}. Narrow the filters to see the rest.</p>}
          </>
        )}
      </section>

      {drawerTicket && (
        <Suspense>
          <AdminDrawer ticketId={drawerTicket.id} title={drawerTicket.title}>
            <TicketDetail
              ticket={drawerTicket}
              events={drawerEvents}
              actions={
                <>
                  {drawerTicket.status !== "resolved" && <AiTriagePanel key={drawerTicket.id} t={drawerTicket} viewerId={user.id} canEdit />}
                  <TicketActions ticket={drawerTicket} viewer={{ id: user.id, role: user.role }} technicians={technicians.map((t) => ({ id: t.id, name: t.name }))} />
                </>
              }
            />
            <Link href={`/requests/${drawerTicket.id}`} className="mt-4 inline-block text-sm font-semibold text-ink underline decoration-gt-gold decoration-2 underline-offset-4">
              Open full page
            </Link>
          </AdminDrawer>
        </Suspense>
      )}
    </PageContainer>
  );
}

function FilterSelectStatus() {
  return (
    <FilterSelect
      param="status"
      label="Status"
      emptyLabel="Status: Open"
      options={[{ value: "all", label: "Any status" }, ...STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label }))]}
    />
  );
}
