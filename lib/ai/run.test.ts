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
  visibility: "public",
  created_at: "2026-11-15T12:00:00Z",
  building: { name: "Towers", type: "residence" },
};

/** Answers the queries runTriage makes, with `callsThisHour` AI calls already used. */
function db(callsThisHour = 0, request: Record<string, unknown> = {}, candidates = true) {
  return fakeSupabase((q: FakeQuery) => {
    if (q.table === "requests" && has(q, "maybeSingle")) return { data: { ...REQUEST, ...request } };
    if (q.table === "ai_calls" && has(q, "select")) return { count: callsThisHour };
    if (q.table === "requests" && arg(q, "select") === "group_id, description, title, created_at, group:issue_groups(id, title, category)") {
      if (!candidates) return { data: [] };
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
    assert.deepEqual(Object.keys(updates(queries, "requests")[0]), ["ai_status", "ai_reviewed", "ai_at"]);
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
    assert.equal(ai.ai_reviewed, true); // reported Urgent → Smart Sort reviewed it
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

  it("Medium with no hazard: the AI is only used for grouping; urgency stays as reported, not reviewed", async () => {
    const { sb, queries } = db(0, { priority: "medium", title: "Desk drawer stuck", description: "The drawer on my desk sticks.", location_detail: "Room 214" });
    const { generate, calls } = mockProvider(output({ urgency: "low", safety_hazard: false, match_group_id: 77 }));
    const r = await runTriage(sb, REQUEST.id, generate, { userId: "student-1" });
    assert.equal(calls.length, 1);
    assert.equal(r?.merged, 77);
    const ai = updates(queries, "requests").find((u) => "ai_urgency" in u)!;
    assert.equal(ai.ai_urgency, "medium"); // AI said Low, but Medium/Low are never downgraded
    assert.equal(ai.ai_reviewed, false);
    assert.equal(ai.ai_reason, null);
  });

  it("Low with a severe hazard (gas): escalated to Urgent by the rules, with no AI call when there's nothing to group", async () => {
    const { sb, queries } = db(0, { priority: "low", title: "Faint gas smell", description: "Smells like gas near the stove.", location_detail: "Room 210" }, false);
    const { generate, calls } = mockProvider(output());
    const r = await runTriage(sb, REQUEST.id, generate, { userId: "student-1" });
    assert.equal(calls.length, 0);
    assert.equal(r?.urgency, "urgent");
    const ai = updates(queries, "requests")[0];
    assert.equal(ai.ai_urgency, "urgent");
    assert.equal(ai.ai_reviewed, true);
    assert.match(String(ai.ai_reason), /Escalated to Urgent/);
    assert.ok(!queries.some((q) => q.table === "ai_calls" && has(q, "insert"))); // no budget used
  });

  it("Medium with a non-severe hazard (broken lock) escalates to High even when the AI fails", async () => {
    const { sb, queries } = db(0, { priority: "medium", title: "Door won't lock", description: "My room door won't lock at all.", location_detail: "Room 312" });
    await runTriage(sb, REQUEST.id, mockProvider(() => { throw new Error("timeout"); }).generate, { userId: "student-1" });
    const ai = updates(queries, "requests")[0];
    assert.equal(ai.ai_urgency, "high");
    assert.equal(ai.ai_reviewed, true);
    assert.equal(ai.ai_status, "done");
  });

  it("private Medium request: never grouped and no AI call", async () => {
    const { sb, queries } = db(0, { priority: "medium", visibility: "private", title: "Window stuck", description: "Window will not open.", location_detail: "Room 101" });
    const { generate, calls } = mockProvider(output({ match_group_id: 77 }));
    await runTriage(sb, REQUEST.id, generate, { userId: "student-1" });
    assert.equal(calls.length, 0);
    assert.ok(!updates(queries, "requests").some((u) => "group_id" in u));
  });

  it("private Urgent request: reviewed by the AI but never merged", async () => {
    const { sb, queries } = db(0, { visibility: "private" });
    const { generate, calls } = mockProvider(output({ match_group_id: 77 }));
    const r = await runTriage(sb, REQUEST.id, generate, { userId: "student-1" });
    assert.equal(calls.length, 1);
    assert.equal(r?.merged, null);
    assert.ok(!updates(queries, "requests").some((u) => "group_id" in u));
    assert.ok(!queries.some((q) => q.table === "issue_groups"));
  });
});

describe("inheritGroupWork", () => {
  it("a new report joining an issue in progress takes its technician and status, with a timeline event", async () => {
    const { inheritGroupWork } = await import("./run");
    const { sb, queries } = fakeSupabase((q) => {
      if (q.table === "requests" && has(q, "not")) return { data: [{ id: 1, status: "assigned", assignee_id: "tech-a" }, { id: 2, status: "in_progress", assignee_id: "tech-b" }] };
      if (q.table === "requests" && has(q, "maybeSingle")) return { data: { status: "submitted" } };
      if (q.table === "requests" && has(q, "update")) return { data: [{ id: 9 }] };
      return {};
    });
    await inheritGroupWork(sb, 9, 300);
    const upd = queries.find((q) => q.table === "requests" && has(q, "update"));
    assert.deepEqual({ ...(arg(upd!, "update") as object), updated_at: undefined }, { assignee_id: "tech-b", status: "in_progress", updated_at: undefined });
    const ev = queries.find((q) => q.table === "request_events" && has(q, "insert"));
    assert.equal((arg(ev!, "insert") as { to_status: string }).to_status, "in_progress");
  });

  it("does nothing when nobody is working on the issue yet", async () => {
    const { inheritGroupWork } = await import("./run");
    const { sb, queries } = fakeSupabase(() => ({ data: [] }));
    await inheritGroupWork(sb, 9, 300);
    assert.ok(!queries.some((q) => has(q, "update")));
  });
});
