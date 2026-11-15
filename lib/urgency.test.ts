import assert from "node:assert/strict";
import { test } from "node:test";
import { showsAiUrgency, smartSort } from "./urgency";
import type { Priority } from "./types";

const t = (id: string, priority: Priority, ai: Priority | null, reviewed: boolean, hoursAgo: number, extra: Partial<{ triage_urgency: Priority; ai_status: "done" | "fallback" | "pending" }> = {}) => ({
  id,
  priority,
  ai_urgency: ai,
  ai_reviewed: reviewed,
  ai_status: extra.ai_status ?? ("done" as const),
  triage_urgency: extra.triage_urgency ?? null,
  created_at: new Date(Date.UTC(2026, 10, 15) - hoursAgo * 3_600_000).toISOString(),
});

test("Smart Sort: confirmed Urgent/High, then downgraded, then the rest in normal order", () => {
  const list = [
    t("medium-old", "medium", "medium", false, 50),
    t("bulb-downgraded", "urgent", "low", true, 5),
    t("gas-escalated", "low", "urgent", true, 3),
    t("high-confirmed", "high", "high", true, 10),
    t("urgent-unrated", "urgent", null, false, 1, { ai_status: "fallback" }),
    t("low-new", "low", "low", false, 1),
    t("high-to-medium", "high", "medium", true, 20),
  ];
  const votes: Record<string, number> = { "high-confirmed": 4 };
  const order = smartSort(list, (x) => votes[x.id] ?? 1).map((x) => x.id);
  assert.deepEqual(order, ["gas-escalated", "urgent-unrated", "high-confirmed", "high-to-medium", "bulb-downgraded", "medium-old", "low-new"]);
});

test("a technician's choice decides the tier", () => {
  const list = [t("a", "low", "low", false, 1), t("b", "low", "low", false, 2, { triage_urgency: "urgent" })];
  assert.equal(smartSort(list, () => 1)[0].id, "b");
});

test("badge only on reviewed requests (or Urgent/High still waiting for a review)", () => {
  assert.equal(showsAiUrgency({ priority: "medium", ai_reviewed: false }), false);
  assert.equal(showsAiUrgency({ priority: "low", ai_reviewed: true }), true);
  assert.equal(showsAiUrgency({ priority: "high", ai_reviewed: false }), true);
});
