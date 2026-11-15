import assert from "node:assert/strict";
import { test } from "node:test";
import { descriptionError, parseLocation, roomError } from "./validation";

test("room numbers: digits with one optional letter at the start or end, max 6", () => {
  for (const ok of ["405", "1116A", "G12", "1", "123456", "a12"]) assert.equal(roomError(ok), null, ok);
  for (const bad of ["", "12 3", "1234567", "AB12", "12AB", "1A2", "12-B", "🔥12", "12🔥", "#12", "A", "١٢٣"]) assert.notEqual(roomError(bad), null, bad);
});

test("description: trimmed, 10 to 300 characters", () => {
  assert.notEqual(descriptionError("   short   "), null);
  assert.equal(descriptionError("  long enough text  "), null);
  assert.equal(descriptionError("x".repeat(300)), null);
  assert.notEqual(descriptionError("x".repeat(301)), null);
});

test("location: a room becomes 'Room N', a spot must be from the list", () => {
  assert.deepEqual(parseLocation("room", " 1116a ", ""), { ok: true, value: "Room 1116A" });
  assert.deepEqual(parseLocation("spot", "", "Stairwell"), { ok: true, value: "Stairwell" });
  assert.equal(parseLocation("spot", "", "Roof").ok, false);
  assert.equal(parseLocation("room", "12 3", "").ok, false);
});
