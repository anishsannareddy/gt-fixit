import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applySafety, detectHazards, escalateForHazard } from "./safety";

describe("detectHazards", () => {
  it("flags severe hazards", () => {
    for (const text of [
      "Faint gas smell near the stove",
      "It smells like gas in the hallway",
      "Saw sparks from the outlet",
      "Exposed wires hanging from the ceiling",
      "Smoke coming out of the dryer",
      "The basement is flooded",
      "My friend is stuck in the elevator",
      "Elevator stopping between floors",
    ]) {
      assert.equal(detectHazards(text).severe, true, text);
    }
  });

  it("flags other hazards without calling them severe", () => {
    for (const text of ["Water dripping from a ceiling tile", "Door won't latch so it can't lock", "Sticky spill, slip hazard", "Chair tips backward"]) {
      const h = detectHazards(text);
      assert.ok(h.labels.length > 0, text);
      assert.equal(h.severe, false, text);
    }
  });

  it("ignores ordinary issues", () => {
    for (const text of ["Light bulb out in my desk lamp", "Wobbly desk", "Restroom out of soap", "Breaker keeps tripping when the microwave is on"]) {
      assert.deepEqual(detectHazards(text).labels, [], text);
    }
  });
});

describe("applySafety", () => {
  const base = { confidence: "high" as const, modelFlaggedHazard: false };

  it("never downgrades a hazard below the reporter's urgency", () => {
    const r = applySafety({ ...base, model: "low", reporter: "urgent", text: "gas smell in kitchen" });
    assert.equal(r.urgency, "urgent");
    assert.equal(r.safety, true);
  });

  it("raises severe hazards to at least High even when the reporter said Low", () => {
    assert.equal(applySafety({ ...base, model: "low", reporter: "low", text: "outlet sparking" }).urgency, "high");
  });

  it("keeps the model's higher rating", () => {
    assert.equal(applySafety({ ...base, model: "urgent", reporter: "low", text: "faint gas smell" }).urgency, "urgent");
  });

  it("trusts the model's own hazard flag even without keywords", () => {
    const r = applySafety({ ...base, modelFlaggedHazard: true, model: "medium", reporter: "high", text: "something seems off with the boiler" });
    assert.equal(r.urgency, "high");
    assert.equal(r.safety, true);
  });

  it("keeps the reporter's urgency when the model isn't confident", () => {
    assert.equal(applySafety({ ...base, confidence: "low", model: "low", reporter: "high", text: "weird noise" }).urgency, "high");
  });

  it("allows a confident downgrade of a non-hazard (light bulb marked Urgent)", () => {
    const r = applySafety({ ...base, model: "low", reporter: "urgent", text: "Light bulb out" });
    assert.equal(r.urgency, "low");
    assert.equal(r.safety, false);
  });
});

it("escalateForHazard: Medium/Low only go up, severe → Urgent, other → High", () => {
  assert.equal(escalateForHazard("low", "Smells like gas in the kitchen").urgency, "urgent");
  assert.equal(escalateForHazard("medium", "Front door won't lock").urgency, "high");
  assert.equal(escalateForHazard("low", "Paint is chipped").escalated, false);
  assert.equal(escalateForHazard("low", "Paint is chipped", true).urgency, "high");
  assert.equal(escalateForHazard("urgent", "Door won't lock").urgency, "urgent");
});
