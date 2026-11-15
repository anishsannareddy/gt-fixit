import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { getBuildings, TICKET_SELECT } from "@/lib/data";
import { CATEGORIES, OPEN_STATUSES, PRIORITIES, PRIORITY_META, PRIORITY_RANK } from "@/lib/constants";
import { AREAS, AREA_META } from "@/lib/campus/areas";
import type { TicketWithRelations } from "@/lib/types";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Chip, ChipRow } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/Feedback";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { GemCheck, WrenchGem } from "@/components/ui/Illustration";
import { FadeIn } from "@/components/ui/Motion";
import { PageContainer, PageHeader } from "@/components/ui/Surface";
import { TicketCard } from "@/components/tickets/TicketCard";
import { TechCardAction } from "./TechCardAction";
import { SmartSortToggle } from "./SmartSortToggle";
import { AiUrgency } from "@/components/tickets/AiUrgency";
import { aiDisagrees, smartSort } from "@/lib/urgency";

export const metadata: Metadata = { title: "My queue" };

type Tab = "mine" | "unassigned" | "open" | "resolved";
const TABS: { key: Tab; label: string }[] = [
  { key: "mine", label: "My work" },
  { key: "unassigned", label: "Unassigned" },
  { key: "open", label: "All open" },
  { key: "resolved", label: "Resolved" },
];

export default async function TechQueuePage(props: PageProps<"/tech">) {
  const user = await requireUser(["technician", "admin"]);
  const sp = await props.searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const tab: Tab = TABS.find((t) => t.key === str("tab"))?.key ?? (user.role === "technician" ? "mine" : "unassigned");

  const [openRes, resolvedRes, buildings] = await Promise.all([
    db().from("requests").select(TICKET_SELECT).in("status", OPEN_STATUSES),
    db().from("requests").select(TICKET_SELECT).eq("status", "resolved").order("resolved_at", { ascending: false }).limit(40),
    getBuildings(),
  ]);
  if (openRes.error) throw new Error(openRes.error.message);
  if (resolvedRes.error) throw new Error(resolvedRes.error.message);
  let open = (openRes.data ?? []) as TicketWithRelations[];
  // Students affected per issue group (each reporter + "Me too" votes)
  const groupIds = [...new Set(open.map((t) => t.group_id))];
  const { data: votes } = groupIds.length ? await db().from("group_votes").select("group_id").in("group_id", groupIds) : { data: [] };
  const affectedBy = new Map<number, number>();
  for (const v of votes ?? []) affectedBy.set(v.group_id, (affectedBy.get(v.group_id) ?? 0) + 1);
  const affected = (t: TicketWithRelations) => affectedBy.get(t.group_id) ?? 1;
  const smart = user.role === "technician" && Boolean(user.smart_sort);
  if (smart) {
    // Smart Sort: AI urgency (or the technician's choice), then students affected, then oldest
    open = smartSort(open, affected);
  } else {
    // Urgent first (reporter's urgency), then oldest first
    open.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.created_at.localeCompare(b.created_at));
  }

  const byTab: Record<Tab, TicketWithRelations[]> = {
    mine: open.filter((t) => t.assignee_id === user.id),
    unassigned: open.filter((t) => t.status === "submitted"),
    open,
    resolved: (resolvedRes.data ?? []) as TicketWithRelations[],
  };
  const area = str("area");
  const building = str("building");
  const priority = str("priority");
  const category = str("category");
  const shown = byTab[tab].filter(
    (t) =>
      (!area || t.area === area) &&
      (!building || String(t.building_id) === building) &&
      (!priority || t.priority === priority) &&
      (!category || t.category === category),
  );
  const filtered = Boolean(area || building || priority || category);
  const urgentWaiting = byTab.unassigned.filter((t) => t.priority === "urgent").length;
  const tabHref = (key: Tab) => {
    const next = new URLSearchParams(Object.entries(sp).filter(([, v]) => typeof v === "string") as [string, string][]);
    next.set("tab", key);
    return `/tech?${next.toString()}`;
  };

  return (
    <PageContainer>
      <AutoRefresh />
      <PageHeader
        eyebrow={user.role === "technician" ? `Hi, ${user.name.split(" ")[0]}` : "All requests"}
        title={user.role === "technician" ? "My queue" : "Request queue"}
        subtitle={`${byTab.mine.length} assigned to you · ${byTab.unassigned.length} waiting for a technician${urgentWaiting ? ` · ${urgentWaiting} urgent` : ""}`}
      />

      <ChipRow label="Queue views">
        {TABS.filter((t) => user.role === "technician" || t.key !== "mine").map((t) => (
          <Chip key={t.key} href={tabHref(t.key)} active={tab === t.key} count={t.key === "resolved" ? undefined : byTab[t.key].length}>
            {t.label}
          </Chip>
        ))}
      </ChipRow>

      <Suspense>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <FilterSelect param="area" label="Area" options={AREAS.map((a) => ({ value: a, label: AREA_META[a].label }))} />
          <FilterSelect param="priority" label="Priority" options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_META[p].label }))} />
          <FilterSelect
            param="category"
            label="Category"
            className={user.role === "technician" ? undefined : "col-span-2 sm:col-span-1"}
            options={CATEGORIES.map((c) => ({ value: c, label: c }))}
          />
          {user.role === "technician" && <SmartSortToggle key={String(smart)} on={smart} className="sm:order-last" />}
          <FilterSelect
            param="building"
            label="Building"
            className="col-span-2 sm:col-span-1 sm:max-w-xs"
            options={buildings.filter((b) => !area || b.area === area).map((b) => ({ value: String(b.id), label: b.name }))}
          />
        </div>
      </Suspense>
      {smart && (
        <p className="mt-2 text-xs text-ink-muted" data-testid="smart-sort-on">
          Smart Sort on: AI-confirmed Urgent and High first, then students affected, then oldest.
        </p>
      )}

      <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {shown.length === 0 ? (
          <div className="lg:col-span-2">
            <EmptyState
              title={filtered ? "No requests match these filters" : tab === "mine" ? "Nothing assigned to you" : tab === "unassigned" ? "Everything has been picked up" : "Nothing here"}
              art={tab === "mine" ? <WrenchGem /> : <GemCheck />}
            >
              {filtered ? "Try clearing a filter." : tab === "mine" ? "Open the Unassigned tab to pick up new work." : "New requests will show up here automatically."}
            </EmptyState>
          </div>
        ) : (
          shown.map((t, i) => (
            <FadeIn key={`${t.id}-${t.triage_urgency}`} index={i}>
              <TicketCard
                ticket={t}
                showReporter
                showAssignee={tab !== "mine"}
                highlight={smart && t.status !== "resolved" && aiDisagrees(t) && !t.triage_urgency}
                aside={
                  smart && t.status !== "resolved" ? (
                    <AiUrgency
                      t={t}
                      viewerId={user.id}
                      canEdit={user.role === "admin" || !t.assignee_id || t.assignee_id === user.id}
                      affected={affected(t)}
                    />
                  ) : undefined
                }
                footer={
                  // Technicians get a one-tap next step; admins manage requests from the Command Center drawer.
                  user.role === "technician" && (t.status === "submitted" || (t.assignee_id === user.id && t.status !== "resolved")) ? (
                    <TechCardAction id={t.id} title={t.title} status={t.status} mine={t.assignee_id === user.id} />
                  ) : undefined
                }
              />
            </FadeIn>
          ))
        )}
      </div>
    </PageContainer>
  );
}
