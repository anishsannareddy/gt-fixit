import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/supabase/server";
import { fetchAll, getBuildings, getTechnicians } from "@/lib/data";
import { computeAnalytics, type AnalyticsRow } from "@/lib/analytics";
import { STATUS_META } from "@/lib/constants";
import { formatHours } from "@/lib/format";
import { TrendChart } from "@/components/charts/TrendChart";
import { HBarChart } from "@/components/charts/HBarChart";
import { AlertIcon } from "@/components/ui/Icons";

export const metadata: Metadata = { title: "Analytics" };

const RANGES = [7, 30, 90] as const;

export default async function AnalyticsPage(props: PageProps<"/admin/analytics">) {
  await requireUser(["admin"]);
  const sp = await props.searchParams;
  const days = RANGES.find((r) => String(r) === sp.range) ?? 30;

  const [rows, buildings, technicians] = await Promise.all([
    fetchAll<AnalyticsRow>((from, to) =>
      db()
        .from("requests")
        .select("id, created_at, resolved_at, status, priority, category, building_id, assignee_id")
        .order("id")
        .range(from, to),
    ),
    getBuildings(),
    getTechnicians(),
  ]);
  const a = computeAnalytics(rows, buildings, technicians, days);

  const statusTotal = a.statusCounts.reduce((s, x) => s + x.value, 0);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4 pt-6 pb-32 md:px-6 md:pt-10 md:pb-16">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">Analytics</h1>
          <p className="mt-2 text-ink-muted">Campus-wide request activity · last {days} days</p>
        </div>
        <nav className="flex rounded-xl bg-white p-1 ring-1 ring-slate-200" aria-label="Date range">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/admin/analytics?range=${r}`}
              aria-current={r === days ? "page" : undefined}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition ${
                r === days ? "bg-gt-navy text-white" : "text-slate-600 hover:text-gt-navy"
              }`}
            >
              {r}d
            </Link>
          ))}
        </nav>
      </div>

      {/* KPI tiles */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="Key metrics">
        <Kpi label="Open right now" value={a.kpis.openNow.toLocaleString()} sub={`${a.kpis.unassigned} unassigned`} />
        <Kpi
          label="Urgent open"
          value={a.kpis.urgentOpen.toLocaleString()}
          sub={a.kpis.urgentOpen ? "Needs attention" : "All clear"}
          alert={a.kpis.urgentOpen > 0}
        />
        <Kpi label="Submitted" value={a.kpis.submitted.toLocaleString()} change={a.kpis.submittedChange} days={days} neutral />
        <Kpi label="Resolved" value={a.kpis.resolved.toLocaleString()} change={a.kpis.resolvedChange} days={days} goodWhenUp />
        <Kpi
          label="Avg. time to resolve"
          value={formatHours(a.kpis.avgResolveHours)}
          sub={`Median ${formatHours(a.kpis.medianResolveHours)}`}
          change={a.kpis.avgResolveChange}
          days={days}
          className="col-span-2 lg:col-span-1"
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel
          title="Submitted vs. resolved"
          subtitle={a.weekly ? "Requests per week" : "Requests per day"}
          className="lg:col-span-2"
        >
          <TrendChart data={a.trend} />
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer font-medium text-gt-navy">View as table</summary>
            <div className="mt-2 max-h-60 overflow-auto">
              <table className="w-full text-left text-sm tabular-nums">
                <thead className="sticky top-0 bg-white text-xs text-slate-500 uppercase">
                  <tr><th className="py-1">{a.weekly ? "Week" : "Day"}</th><th className="py-1 text-right">Submitted</th><th className="py-1 text-right">Resolved</th></tr>
                </thead>
                <tbody>
                  {a.trend.map((p) => (
                    <tr key={p.key} className="border-t border-slate-100">
                      <td className="py-1">{p.label}</td>
                      <td className="py-1 text-right">{p.submitted}</td>
                      <td className="py-1 text-right">{p.resolved}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </Panel>

        <Panel title="Status of new requests" subtitle={`${statusTotal} submitted in the last ${days} days`}>
          {statusTotal === 0 ? (
            <p className="text-sm text-slate-500">No requests in this range.</p>
          ) : (
            <>
              <div className="flex h-4 w-full gap-0.5 overflow-hidden rounded-full" role="img" aria-label="Status breakdown">
                {a.statusCounts.filter((s) => s.value > 0).map((s) => (
                  <div key={s.status} className={STATUS_META[s.status].dot} style={{ width: `${(s.value / statusTotal) * 100}%` }} title={`${STATUS_META[s.status].label}: ${s.value}`} />
                ))}
              </div>
              <ul className="mt-4 space-y-2.5">
                {a.statusCounts.map((s) => (
                  <li key={s.status} className="flex items-center gap-2.5 text-sm">
                    <span className={`size-3 rounded-sm ${STATUS_META[s.status].dot}`} aria-hidden="true" />
                    <span className="text-slate-700">{STATUS_META[s.status].label}</span>
                    <span className="ml-auto font-semibold text-slate-900 tabular-nums">{s.value}</span>
                    <span className="w-10 text-right text-xs text-slate-500 tabular-nums">{Math.round((s.value / statusTotal) * 100)}%</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {a.hotspots.length > 0 && (
            <div className="mt-6 border-t border-slate-100 pt-4">
              <h3 className="flex items-center gap-1.5 text-sm font-bold text-gt-navy">
                <AlertIcon className="size-4" /> Recurring hotspots
              </h3>
              <p className="text-xs text-slate-500">Same issue type reported 3+ times in one building</p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {a.hotspots.map((h) => (
                  <li key={h.building + h.category} className="flex gap-2">
                    <span className="min-w-0 flex-1 truncate text-slate-700">
                      <span className="font-medium text-slate-900">{h.building}</span> · {h.category}
                    </span>
                    <span className="font-semibold tabular-nums">{h.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Top 10 buildings" subtitle="By requests submitted">
          {a.topBuildings.length ? <HBarChart data={a.topBuildings} seriesName="Requests" /> : <Empty />}
        </Panel>
        <Panel title="Requests by category" subtitle="By requests submitted">
          {a.byCategory.length ? <HBarChart data={a.byCategory} seriesName="Requests" /> : <Empty />}
        </Panel>
        <Panel title="Average time to resolve" subtitle="By category, for requests resolved in this range">
          {a.resolveByCategory.length ? (
            <HBarChart data={a.resolveByCategory} seriesName="Avg. time" unit="hours" />
          ) : (
            <Empty />
          )}
        </Panel>
        <Panel title="Technician workload" subtitle={`Open work now · resolved in last ${days} days`}>
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm tabular-nums">
              <thead className="text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-1 py-2 font-medium">Technician</th>
                  <th className="px-1 py-2 text-right font-medium">Assigned</th>
                  <th className="px-1 py-2 text-right font-medium">In progress</th>
                  <th className="px-1 py-2 text-right font-medium">Resolved</th>
                  <th className="px-1 py-2 text-right font-medium">Avg. time</th>
                </tr>
              </thead>
              <tbody>
                {a.workload.map((w) => (
                  <tr key={w.id} className="border-t border-slate-100">
                    <td className="px-1 py-2.5 font-medium text-slate-900">{w.name}</td>
                    <td className="px-1 py-2.5 text-right">{w.assigned}</td>
                    <td className="px-1 py-2.5 text-right">{w.inProgress}</td>
                    <td className="px-1 py-2.5 text-right font-semibold">{w.resolved}</td>
                    <td className="px-1 py-2.5 text-right">{formatHours(w.avgResolveHours)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, subtitle, children, className = "" }: { title: string; subtitle?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl border border-line bg-white p-4 shadow-sm md:p-5 ${className}`}>
      <h2 className="font-display text-lg font-bold">{title}</h2>
      {subtitle && <p className="mb-3 text-xs text-slate-500">{subtitle}</p>}
      {children}
    </section>
  );
}

function Empty() {
  return <p className="py-8 text-center text-sm text-slate-500">No data in this range.</p>;
}

function Kpi({
  label,
  value,
  sub,
  change,
  days,
  goodWhenUp = false,
  neutral = false,
  alert = false,
  className = "",
}: {
  label: string;
  value: string;
  sub?: string;
  change?: number | null;
  days?: number;
  goodWhenUp?: boolean;
  /** More/less isn't good or bad (e.g. submissions) — show the change in gray. */
  neutral?: boolean;
  alert?: boolean;
  className?: string;
}) {
  let delta: ReactNode = null;
  if (change != null && Number.isFinite(change)) {
    const up = change > 0;
    const good = neutral || Math.abs(change) < 1 ? null : goodWhenUp ? up : !up;
    delta = (
      <span className={`font-semibold ${good == null ? "text-slate-500" : good ? "text-green-700" : "text-red-700"}`}>
        {up ? "▲" : change < 0 ? "▼" : ""} {Math.abs(Math.round(change))}%
        <span className="font-normal text-slate-500"> vs prev {days}d</span>
      </span>
    );
  }
  return (
    <div className={`rounded-2xl border border-line bg-white p-4 ${alert ? "border-red-300 bg-red-50" : ""} ${className}`}>
      <div className={`text-xs font-semibold tracking-wide uppercase ${alert ? "text-red-800" : "text-slate-500"}`}>{label}</div>
      <div className={`mt-1 text-3xl font-bold tabular-nums ${alert ? "text-red-800" : "text-gt-navy"}`}>{value}</div>
      {delta && <div className="mt-1 text-xs">{delta}</div>}
      {sub && <div className="mt-0.5 text-xs text-slate-600">{sub}</div>}
    </div>
  );
}
