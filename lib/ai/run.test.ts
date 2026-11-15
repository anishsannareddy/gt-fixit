import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RATE_LIMITS, runTriage } from "./run";
import { arg, fakeSupabase, has, mockProvider, type FakeQuery } from "./test-helpers";

const REQUEST = {
  id: 5001,
  title: "Lounge ceiling dripping",
  description: "Water dripping from the ceiling.",
  location_detail: "2nd floor lounge",
  category: "Plumbing",
  priority: "urgent",
  building_id: 9,
  group_id: 300,
  created_at: "2026-11-15T12:00:00Z",
  building: { name: "Towers", type: "residence" },
};

/** Answers the queries runTriage makes, with `callsThisHour` AI calls already used. */
function db(callsThisHour = 0) {
  return fakeSupabase((q: FakeQuery) => {
    if (q.table === "requests" && has(q, "maybeSingle")) return { data: REQUEST };
    if (q.table === "ai_calls" && has(q, "select")) return { count: callsThisHour };
    if (q.table === "requests" && arg(q, "select") === "group_id, description, title, created_at, group:issue_groups(id, title, category)") {
      return { data: [{ group_id: 77, title: "Water leaking", description: "Leak in lounge", created_at: "2026-11-15T10:00:00Z", group: { id: 77, title: "Ceiling leak in lounge", category: "Plumbing" } }] };
    }
    if (q.table === "group_votes" && has(q, "select")) return { data: [{ user_id: "u1", created_at: "2026-11-15T12:00:00Z" }], count: 1 };
    if (q.table === "requests" && has(q, "select")) return { count: 0 };
    return {};
  });
}

const output = (over: Record<string, unknown> = {}) => ({
  urgency: "high",
  reason: "Active leak; slip risk.",
  category: "Plumbing",
  safety_hazard: true,
  confidence: "high",
  match_group_id: null,
  group_title: "Ceiling leak in lounge",
  ...over,
});

const updates = (queries: FakeQuery[], table: string) => queries.filter((q) => q.table === table && has(q, "update")).map((q) => arg(q, "update") as Record<string, unknown>);

describe("runTriage", () => {
  it("over the rate limit: falls back without calling the AI", async () => {
    const { sb, queries } = db(RATE_LIMITS.triage);
    const { generate, calls } = mockProvider(output());
    const r = await runTriage(sb, REQUEST.id, generate, { userId: "student-1" });
    assert.equal(calls.length, 0);
    assert.equal(r?.status, "fallback");
    assert.equal(r?.urgency, "urgent"); // reporter's urgency kept
    assert.deepEqual(Object.keys(updates(queries, "requests")[0]), ["ai_status", "ai_at"]);
    assert.equal(updates(queries, "requests")[0].ai_status, "fallback");
  });

  it("AI failure: stores fallback, keeps the reporter's urgency, and leaves the group alone", async () => {
    const { sb, queries } = db();
    const r = await runTriage(sb, REQUEST.id, mockProvider(() => { throw new Error("timeout"); }).generate, { userId: "student-1" });
    assert.equal(r?.status, "fallback");
    assert.equal(r?.urgency, "urgent");
    const reqUpdates = updates(queries, "requests");
    assert.equal(reqUpdates.length, 1);
    assert.equal(reqUpdates[0].ai_status, "fallback");
    assert.equal(updates(queries, "issue_groups").length, 0);
    assert.ok(!queries.some((q) => q.table === "issue_groups" && has(q, "delete")));
  });

  it("records the AI call against the user's hourly budget", async () => {
    const { sb, queries } = db(3);
    await runTriage(sb, REQUEST.id, mockProvider(output()).generate, { userId: "student-1" });
    const insert = queries.find((q) => q.table === "ai_calls" && has(q, "insert"));
    assert.deepEqual(arg(insert!, "insert"), { user_id: "student-1", kind: "triage" });
  });

  it("success: stores the AI fields without touching the reporter's priority", async () => {
    const { sb, queries } = db();
    const r = await runTriage(sb, REQUEST.id, mockProvider(output()).generate, { userId: "student-1" });
    assert.equal(r?.status, "done");
    const ai = updates(queries, "requests")[0];
    assert.equal(ai.ai_urgency, "urgent"); // hazard (leak near ceiling) keeps the reporter's Urgent
    assert.equal(ai.ai_status, "done");
    assert.equal(ai.ai_model, "mock-model");
    assert.ok(!("priority" in ai));
  });

  it("duplicate: moves the request and its votes into the matched group and deletes the empty one", async () => {
    const { sb, queries } = db();
    const r = await runTriage(sb, REQUEST.id, mockProvider(output({ match_group_id: 77 })).generate, { userId: "student-1" });
    assert.equal(r?.merged, 77);
    assert.ok(updates(queries, "requests").some((u) => u.group_id === 77));
    const upsert = queries.find((q) => q.table === "group_votes" && has(q, "upsert"));
    assert.deepEqual((arg(upsert!, "upsert") as { group_id: number }[])[0].group_id, 77);
    assert.ok(queries.some((q) => q.table === "issue_groups" && has(q, "delete")));
    assert.equal(updates(queries, "issue_groups")[0].title, "Ceiling leak in lounge");
  });

  it("dry run: changes nothing", async () => {
    const { sb, queries } = db();
    await runTriage(sb, REQUEST.id, mockProvider(output({ match_group_id: 77 })).generate, { dryRun: true });
    assert.equal(queries.filter((q) => has(q, "update") || has(q, "delete") || has(q, "upsert")).length, 0);
  });
});
