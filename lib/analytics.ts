import type { Building, Priority, Status, User } from "./types";

/** The slim row shape the dashboard needs (keeps the query small). */
export type AnalyticsRow = {
  id: number;
  created_at: string;
  resolved_at: string | null;
  status: Status;
  priority: Priority;
  category: string;
  building_id: number;
  assignee_id: string | null;
};

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const TZ = "America/New_York";

/** YYYY-MM-DD in campus time, so a 11pm request counts on the right day. */
function dayKey(iso: string | number): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
}
/** Monday of the week containing `day` (YYYY-MM-DD). */
function weekKey(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // 0 = Monday
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}
function shortLabel(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

const hoursToResolve = (r: AnalyticsRow) =>
  r.resolved_at ? (new Date(r.resolved_at).getTime() - new Date(r.created_at).getTime()) / HOUR : null;

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function countBy<T>(rows: T[], key: (r: T) => string): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
  return m;
}
/** % change vs previous period, or null when there's no baseline. */
const pctChange = (cur: number | null, prev: number | null) =>
  cur == null || prev == null || prev === 0 ? null : ((cur - prev) / prev) * 100;

export function computeAnalytics(
  rows: AnalyticsRow[],
  buildings: Building[],
  technicians: User[],
  days: number,
  now = Date.now(),
) {
  const since = now - days * DAY;
  const prevSince = since - days * DAY;
  const t = (iso: string) => new Date(iso).getTime();

  const created = rows.filter((r) => t(r.created_at) >= since);
  const resolved = rows.filter((r) => r.resolved_at && t(r.resolved_at) >= since);
  const prevCreated = rows.filter((r) => t(r.created_at) >= prevSince && t(r.created_at) < since);
  const prevResolved = rows.filter((r) => r.resolved_at && t(r.resolved_at) >= prevSince && t(r.resolved_at) < since);
  const open = rows.filter((r) => r.status !== "resolved");

  const resolveHours = resolved.map(hoursToResolve).filter((h): h is number => h != null);
  const prevResolveHours = prevResolved.map(hoursToResolve).filter((h): h is number => h != null);
  const avgResolve = mean(resolveHours);

  const kpis = {
    openNow: open.length,
    urgentOpen: open.filter((r) => r.priority === "urgent").length,
    unassigned: open.filter((r) => r.status === "submitted").length,
    submitted: created.length,
    submittedChange: pctChange(created.length, prevCreated.length),
    resolved: resolved.length,
    resolvedChange: pctChange(resolved.length, prevResolved.length),
    avgResolveHours: avgResolve,
    avgResolveChange: pctChange(avgResolve, mean(prevResolveHours)),
    medianResolveHours: median(resolveHours),
  };

  // ---- Trend: daily buckets for 7/30 days, weekly for longer ranges ----
  const weekly = days > 31;
  const bucketOf = (iso: string) => (weekly ? weekKey(dayKey(iso)) : dayKey(iso));
  const buckets: string[] = [];
  for (let d = since; d <= now; d += DAY) {
    const k = weekly ? weekKey(dayKey(d)) : dayKey(d);
    if (buckets[buckets.length - 1] !== k) buckets.push(k);
  }
  const subByBucket = countBy(created, (r) => bucketOf(r.created_at));
  const resByBucket = countBy(resolved, (r) => bucketOf(r.resolved_at!));
  const trend = buckets.map((k) => ({
    key: k,
    label: weekly ? `Wk of ${shortLabel(k)}` : shortLabel(k),
    submitted: subByBucket.get(k) ?? 0,
    resolved: resByBucket.get(k) ?? 0,
  }));

  // ---- Breakdowns ----
  const buildingName = new Map(buildings.map((b) => [b.id, b.short_name ?? b.name]));
  const buildingFull = new Map(buildings.map((b) => [b.id, b.name]));

  const byCategory = [...countBy(created, (r) => r.category)]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  const topBuildings = [...countBy(created, (r) => String(r.building_id))]
    .map(([id, value]) => ({ label: buildingName.get(Number(id)) ?? "?", full: buildingFull.get(Number(id)) ?? "?", value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const resolveByCategory = [...new Set(resolved.map((r) => r.category))]
    .map((category) => {
      const hrs = resolved.filter((r) => r.category === category).map(hoursToResolve) as number[];
      return { label: category, value: Math.round((mean(hrs) ?? 0) * 10) / 10, n: hrs.length };
    })
    .sort((a, b) => b.value - a.value);

  const statusCounts = (["submitted", "assigned", "in_progress", "resolved"] as Status[]).map((s) => ({
    status: s,
    value: created.filter((r) => r.status === s).length,
  }));

  // ---- Technician workload ----
  const workload = technicians
    .map((tech) => {
      const mineOpen = open.filter((r) => r.assignee_id === tech.id);
      const mineResolved = resolved.filter((r) => r.assignee_id === tech.id);
      return {
        id: tech.id,
        name: tech.name,
        assigned: mineOpen.filter((r) => r.status === "assigned").length,
        inProgress: mineOpen.filter((r) => r.status === "in_progress").length,
        resolved: mineResolved.length,
        avgResolveHours: mean(mineResolved.map(hoursToResolve) as number[]),
      };
    })
    .sort((a, b) => b.resolved - a.resolved);

  // ---- Hotspots: the same kind of problem recurring in one building ----
  const hotspots = [...countBy(created, (r) => `${r.building_id}|${r.category}`)]
    .filter(([, n]) => n >= 3)
    .map(([key, value]) => {
      const [bid, category] = key.split("|");
      return { building: buildingFull.get(Number(bid)) ?? "?", category, value };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  return { kpis, trend, weekly, byCategory, topBuildings, resolveByCategory, statusCounts, workload, hotspots };
}

export type Analytics = ReturnType<typeof computeAnalytics>;
