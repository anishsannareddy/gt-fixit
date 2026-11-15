import assert from "node:assert/strict";
import { test } from "node:test";
import { canDeleteRequest, photoPathFromUrl } from "./permissions";
import type { Status } from "./types";

const STATUSES: Status[] = ["submitted", "assigned", "in_progress", "resolved"];
const student = { id: "s1", role: "reporter" as const };
const other = { id: "s2", role: "reporter" as const };
const tech = { id: "t1", role: "technician" as const };
const admin = { id: "a1", role: "admin" as const };

test("students delete their own request only before work starts", () => {
  const allowed = STATUSES.filter((status) => canDeleteRequest(student, { reporter_id: "s1", status }));
  assert.deepEqual(allowed, ["submitted", "assigned"]);
  for (const status of STATUSES) assert.equal(canDeleteRequest(other, { reporter_id: "s1", status }), false);
});

test("admins delete anything; technicians nothing", () => {
  for (const status of STATUSES) {
    assert.equal(canDeleteRequest(admin, { reporter_id: "s1", status }), true);
    assert.equal(canDeleteRequest(tech, { reporter_id: "s1", status }), false);
    assert.equal(canDeleteRequest(tech, { reporter_id: "t1", status }), false);
  }
});

test("photo path is read from the public URL and must look like our uploads", () => {
  const id = "0f8fad5b-d9cb-469f-a165-70867728950e";
  assert.equal(photoPathFromUrl(`https://x.supabase.co/storage/v1/object/public/request-photos/requests/${id}.jpg`, "request-photos"), `requests/${id}.jpg`);
  assert.equal(photoPathFromUrl(`https://x.supabase.co/storage/v1/object/public/request-photos/../secrets.txt`, "request-photos"), null);
  assert.equal(photoPathFromUrl(null, "request-photos"), null);
});
