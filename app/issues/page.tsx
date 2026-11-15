import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { getBuildings } from "@/lib/data";
import { getActiveIssues, getIssueDetails } from "@/lib/issues";
import { AutoRefresh } from "@/components/AutoRefresh";
import { IssueCard } from "@/components/issues/IssueCard";
import { issueKey } from "@/components/issues/key";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { FilterSelect } from "@/components/ui/FilterSelect";
import { PlusIcon } from "@/components/ui/Icons";
import { GemCheck } from "@/components/ui/Illustration";
import { FadeIn } from "@/components/ui/Motion";
import { SearchBox } from "@/components/ui/SearchBox";
import { PageContainer, PageHeader } from "@/components/ui/Surface";

export const metadata: Metadata = { title: "Active issues" };

/** Student view: open problems around campus, grouped so duplicates count as one, with "Me too". */
export default async function ActiveIssuesPage(props: PageProps<"/issues">) {
  const user = await requireUser(["reporter"]);
  const sp = await props.searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const buildingId = Number(str("building")) || undefined;
  const q = str("q");

  const [all, buildings] = await Promise.all([getActiveIssues(user.id), getBuildings()]);
  const shown = all.filter((i) => (!buildingId || i.building.id === buildingId) && (!q || [i.title, i.category, i.building.name, i.building.short_name ?? ""].some((s) => s.toLowerCase().includes(q.toLowerCase()))));
  const details = await getIssueDetails(user.id, shown.map((i) => i.id));
  const withIssues = new Set(all.map((i) => i.building.id));
  const filtered = Boolean(buildingId || q);
  const affected = all.reduce((n, i) => n + i.affected, 0);

  return (
    <PageContainer narrow>
      <AutoRefresh />
      <PageHeader
        eyebrow="Around campus"
        title="Active issues"
        subtitle={`${all.length} open ${all.length === 1 ? "issue" : "issues"} · ${affected} students affected. Already reported? Tap Me too so maintenance knows how many people it affects.`}
      >
        <Button href="/report" variant="gold" className="hidden sm:inline-flex">
          <PlusIcon className="size-4" /> Report an issue
        </Button>
      </PageHeader>

      <Suspense>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <SearchBox label="Search active issues" placeholder="Search issue, building or category" />
          <FilterSelect
            param="building"
            label="Building"
            emptyLabel="All buildings"
            className="col-span-2 sm:col-span-1 sm:max-w-xs"
            options={buildings.filter((b) => withIssues.has(b.id)).map((b) => ({ value: String(b.id), label: b.name }))}
          />
        </div>
      </Suspense>

      <div className="mt-5 space-y-3">
        {shown.length === 0 ? (
          <EmptyState
            title={filtered ? "No active issues match" : "No active issues right now"}
            art={<GemCheck />}
            action={
              <Button href="/report" variant="gold">
                <PlusIcon className="size-4" /> Report an issue
              </Button>
            }
          >
            {filtered ? "Try another building or search, or report a new issue." : "Everything reported has been fixed. Spot something broken? Report it from the campus map."}
          </EmptyState>
        ) : (
          shown.map((i, n) => (
            <FadeIn key={issueKey(i)} index={n}>
              <IssueCard issue={i} detail={details[i.id]} />
            </FadeIn>
          ))
        )}
      </div>
    </PageContainer>
  );
}
