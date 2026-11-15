/**
 * Test doubles for the AI unit tests (lib/ai/*.test.ts). Not used by the app.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GenerateStructured, StructuredRequest } from "./provider";

/** A mocked provider that returns `data` (or throws) and records every call. */
export function mockProvider(result: unknown | (() => never)) {
  const calls: StructuredRequest<unknown>[] = [];
  const generate: GenerateStructured = async (req) => {
    calls.push(req as StructuredRequest<unknown>);
    if (typeof result === "function") return (result as () => never)();
    return { data: result, model: "mock-model" };
  };
  return { generate, calls };
}

export type FakeQuery = { table: string; ops: [string, unknown[]][] };
export const has = (q: FakeQuery, op: string) => q.ops.some(([m]) => m === op);
export const arg = (q: FakeQuery, op: string) => q.ops.find(([m]) => m === op)?.[1][0];

/**
 * A tiny stand-in for the Supabase client: every chained call is recorded, and awaiting the
 * query returns whatever `respond` says for it.
 */
export function fakeSupabase(respond: (q: FakeQuery) => { data?: unknown; error?: { message: string } | null; count?: number | null }) {
  const queries: FakeQuery[] = [];
  const client = {
    from(table: string) {
      const q: FakeQuery = { table, ops: [] };
      queries.push(q);
      const builder: object = new Proxy(
        {},
        {
          get(_t, prop) {
            if (prop === "then") {
              return (ok: (v: unknown) => unknown, fail: (e: unknown) => unknown) =>
                Promise.resolve({ data: null, error: null, count: null, ...respond(q) }).then(ok, fail);
            }
            return (...args: unknown[]) => {
              q.ops.push([String(prop), args]);
              return builder;
            };
          },
        },
      );
      return builder;
    },
  };
  return { sb: client as unknown as SupabaseClient, queries };
}
