import "server-only";
import { db } from "./supabase/server";
import type { Building, TicketEvent, TicketWithRelations, User } from "./types";

/** Select string that joins building, reporter and assignee onto a request. */
export const TICKET_SELECT = `
  *,
  building:buildings(id, name, short_name, type, number),
  reporter:users!requests_reporter_id_fkey(id, name),
  assignee:users!requests_assignee_id_fkey(id, name)
`;

function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export async function getBuildings(): Promise<Building[]> {
  return must(await db().from("buildings").select("*").order("name"));
}

export async function getDemoUsers(): Promise<User[]> {
  return must(
    await db().from("users").select("id, name, role, title, is_demo").eq("is_demo", true).order("name"),
  );
}

export async function getTechnicians(): Promise<User[]> {
  return must(
    await db().from("users").select("id, name, role, title, is_demo").eq("role", "technician").order("name"),
  );
}

export async function getTicket(id: number): Promise<TicketWithRelations | null> {
  return must(await db().from("requests").select(TICKET_SELECT).eq("id", id).maybeSingle());
}

export async function getTicketEvents(id: number): Promise<TicketEvent[]> {
  return must(
    await db()
      .from("request_events")
      .select("*, actor:users(id, name, role)")
      .eq("request_id", id)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }),
  );
}

/**
 * Supabase returns at most 1,000 rows per query by default,
 * so page through results for analytics.
 */
export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const page = must(await build(from, from + pageSize - 1));
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}
