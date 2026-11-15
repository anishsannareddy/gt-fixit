import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { ACCOUNTS, admin, deleteRequests, expectToast, reportIssue, signIn } from "./helpers";

const BUCKET = "request-photos";

/** Nothing about the request may remain: row, history, group, votes, photo. */
async function expectFullyGone(id: number, groupId: number, photoPath?: string) {
  const sb = admin();
  const count = async (table: string, col: string, val: number) => (await sb.from(table).select("*", { count: "exact", head: true }).eq(col, val)).count;
  expect(await count("requests", "id", id)).toBe(0);
  expect(await count("request_events", "request_id", id)).toBe(0);
  expect(await count("issue_groups", "id", groupId)).toBe(0);
  expect(await count("group_votes", "group_id", groupId)).toBe(0);
  if (photoPath) {
    const { data } = await sb.storage.from(BUCKET).list("requests", { search: photoPath.replace("requests/", "") });
    expect(data ?? []).toHaveLength(0);
  }
  // Minimal audit record only: id, who, role, when.
  const { data: log } = await sb.from("deletion_log").select("*").eq("request_id", id);
  expect(log).toHaveLength(1);
  expect(Object.keys(log![0]).sort()).toEqual(["deleted_at", "deleted_by", "id", "request_id", "role"]);
}

test("a student deletes their own request: confirm, toast, back to the list, nothing left behind", async ({ browser }) => {
  const page = await signIn(browser, ACCOUNTS.student);
  const id = await reportIssue(page, `E2E delete mine ${Date.now()}`);
  const sb = admin();
  // Give it a real photo in Storage, so we can check the file is removed too.
  const photoPath = `requests/${randomUUID()}.jpg`;
  await sb.storage.from(BUCKET).upload(photoPath, Buffer.from([0xff, 0xd8, 0xff, 0xd9]), { contentType: "image/jpeg" });
  const url = sb.storage.from(BUCKET).getPublicUrl(photoPath).data.publicUrl;
  await sb.from("requests").update({ photo_url: url }).eq("id", id);
  const { data: row } = await sb.from("requests").select("group_id").eq("id", id).single();

  try {
    await page.goto(`/requests/${id}`);
    await page.getByRole("button", { name: "Delete request" }).click();
    const confirm = page.getByRole("dialog", { name: `Delete request #${id}?` });
    await expect(confirm.getByText(/permanently removed, along with its photos and history\. This cannot be undone\./)).toBeVisible();
    // Cancel first: nothing happens
    await confirm.getByRole("button", { name: "Cancel" }).click();
    await expect(confirm).toBeHidden();
    await page.getByRole("button", { name: "Delete request" }).click();
    await page.getByRole("button", { name: "Delete permanently" }).click();
    await expectToast(page, `Request #${id} was deleted.`);
    await expect(page).toHaveURL(/\/my-requests$/);
    await expect(page.getByText(`#${id}`, { exact: true })).toHaveCount(0);

    await expectFullyGone(id, row!.group_id, photoPath);

    // An old link shows a friendly page, not an error
    await page.goto(`/requests/${id}`);
    await expect(page.getByRole("heading", { name: "This request was removed" })).toBeVisible();
  } finally {
    await deleteRequests([id]);
    await sb.storage.from(BUCKET).remove([photoPath]);
  }
});

test("an admin deletes another student's request from the drawer", async ({ browser }) => {
  const student = await signIn(browser, ACCOUNTS.student);
  const id = await reportIssue(student, `E2E delete by admin ${Date.now()}`);
  const { data: row } = await admin().from("requests").select("group_id").eq("id", id).single();
  try {
    const page = await signIn(browser, ACCOUNTS.admin);
    await page.goto(`/admin?ticket=${id}`);
    const drawer = page.getByRole("dialog").first();
    await drawer.getByRole("button", { name: "Delete request" }).click();
    await page.getByRole("button", { name: "Delete permanently" }).click();
    await expectToast(page, `Request #${id} was deleted.`);
    await expect(page).toHaveURL(/\/admin$/);
    await expectFullyGone(id, row!.group_id);

    // The student's list no longer has it
    await student.goto("/my-requests");
    await expect(student.getByText(`#${id}`, { exact: true })).toHaveCount(0);
  } finally {
    await deleteRequests([id]);
  }
});

test("no delete once work has started, and never for technicians", async ({ browser }) => {
  const student = await signIn(browser, ACCOUNTS.student);
  const id = await reportIssue(student, `E2E no delete ${Date.now()}`);
  try {
    await admin().from("requests").update({ status: "in_progress" }).eq("id", id);
    await student.goto(`/requests/${id}`);
    await expect(student.getByRole("heading", { name: /E2E no delete/ })).toBeVisible();
    await expect(student.getByRole("button", { name: "Delete request" })).toHaveCount(0);
    const tech = await signIn(browser, ACCOUNTS.tech);
    await tech.goto(`/requests/${id}`);
    await expect(tech.getByRole("heading", { name: /E2E no delete/ })).toBeVisible();
    await expect(tech.getByRole("button", { name: "Delete request" })).toHaveCount(0);
  } finally {
    await deleteRequests([id]);
  }
});

test("deleting one report of a shared issue keeps the group, refreshes its title, and keeps the reporter's other vote", async ({ browser }) => {
  const page = await signIn(browser, ACCOUNTS.student);
  const a = await reportIssue(page, `E2E group first ${Date.now()}`);
  const b = await reportIssue(page, `E2E group second ${Date.now()}`);
  const sb = admin();
  try {
    const { data: ra } = await sb.from("requests").select("group_id, title, reporter_id").eq("id", a).single();
    const { data: rb } = await sb.from("requests").select("group_id, title").eq("id", b).single();
    // Put b into a's group (what the AI does for duplicates) and title the group after a.
    await sb.from("requests").update({ group_id: ra!.group_id }).eq("id", b);
    await sb.from("issue_groups").delete().eq("id", rb!.group_id);
    await sb.from("issue_groups").update({ title: ra!.title }).eq("id", ra!.group_id);

    const { error } = await sb.rpc("delete_request", { p_id: a, p_actor: ra!.reporter_id, p_role: "reporter" });
    expect(error).toBeNull();
    const { data: g } = await sb.from("issue_groups").select("title").eq("id", ra!.group_id).single();
    expect(g!.title).toBe(rb!.title); // was the deleted report's title → next report's
    const { count } = await sb.from("group_votes").select("*", { count: "exact", head: true }).eq("group_id", ra!.group_id).eq("user_id", ra!.reporter_id);
    expect(count).toBe(1); // still reported b, so still affected
  } finally {
    await deleteRequests([a, b]);
  }
});
