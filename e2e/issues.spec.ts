import { expect, test } from "@playwright/test";
import { ACCOUNTS, admin, deleteRequests, expectToast, reportIssue, signIn } from "./helpers";

// Seeded group: the 2nd-floor lounge ceiling leak in Towers (the biggest group there). Dr. Shah
// (demo.faculty) hasn't voted on it. Its title can change when the AI merges a new report, so
// look it up by building and size instead of by title.
let TOWERS = "";

async function facultyId() {
  const { data } = await admin().from("users").select("id").eq("email", ACCOUNTS.faculty).single();
  return data!.id as string;
}
async function towersGroupId() {
  const sb = admin();
  const { data: b } = await sb.from("buildings").select("id").ilike("name", "%Towers Residence Hall%").single();
  const { data } = await sb.from("requests").select("group_id, group:issue_groups(id, title)").eq("building_id", b!.id).in("status", ["submitted", "assigned", "in_progress"]);
  const size = new Map<number, number>();
  for (const r of data ?? []) size.set(r.group_id, (size.get(r.group_id) ?? 0) + 1);
  const [id] = [...size.entries()].sort((a, b) => b[1] - a[1])[0];
  const g = (data ?? []).find((r) => r.group_id === id)!.group as unknown as { title: string };
  TOWERS = g.title;
  return id;
}

test.beforeAll(async () => {
  // Start clean in case an earlier run stopped half-way.
  await admin().from("group_votes").delete().eq("group_id", await towersGroupId()).eq("user_id", await facultyId());
});
test.afterAll(async () => {
  await admin().from("group_votes").delete().eq("group_id", await towersGroupId()).eq("user_id", await facultyId());
});

test("Me too adds one vote, survives a reload, and Undo removes it", async ({ browser }) => {
  const page = await signIn(browser, ACCOUNTS.faculty);
  await page.goto("/issues");
  const card = page.getByRole("article", { name: TOWERS });
  const count = card.getByTestId("affected-count");
  const before = Number((await count.innerText()).split(" ")[0]);

  await card.getByRole("button", { name: "Me too" }).click();
  await expect(count).toHaveText(`${before + 1} students`);
  await expect(card.getByRole("button", { name: /You're affected/ })).toBeVisible();
  await expectToast(page, "Counted you in");

  await page.reload();
  await expect(card.getByTestId("affected-count")).toHaveText(`${before + 1} students`);
  await card.getByRole("button", { name: /You're affected/ }).click();
  await expect(card.getByTestId("affected-count")).toHaveText(`${before} students`);
  await expectToast(page, "Removed your Me too");
  await page.reload();
  await expect(card.getByRole("button", { name: "Me too" })).toBeVisible();
  await expect(card.getByTestId("affected-count")).toHaveText(`${before} students`);
});

test("reporter sees their own issue as reported, and expanding shows reports and history", async ({ browser }) => {
  const page = await signIn(browser, ACCOUNTS.student);
  await page.goto("/issues");
  const glenn = page.getByRole("article", { name: "Water leaking from 3rd-floor ceiling" });
  await expect(glenn.getByText("You reported this")).toBeVisible();
  await glenn.getByRole("button", { name: /Show 5 reports/ }).click();
  await expect(glenn.getByRole("heading", { name: "Status history" })).toBeVisible();
  await expect(glenn.getByText("· You")).toBeVisible();
  // Other students stay anonymous
  await expect(glenn.getByText("A student").first()).toBeVisible();
});

test("tapping a building with active issues lists them first", async ({ browser }) => {
  const page = await signIn(browser, ACCOUNTS.faculty);
  await page.getByRole("combobox", { name: "Search buildings" }).fill("Towers");
  await page.getByRole("option").first().click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("Already reported? Tap")).toBeVisible();
  await expect(sheet.getByRole("article", { name: TOWERS })).toBeVisible();
  await sheet.getByRole("button", { name: "Report a new issue" }).click();
  await expect(sheet.locator("#title")).toBeVisible();
});

test("the report form suggests a matching active issue, and Me too replaces a new report", async ({ browser }) => {
  const page = await signIn(browser, ACCOUNTS.faculty);
  await page.getByRole("combobox", { name: "Search buildings" }).fill("Towers");
  await page.getByRole("option").first().click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("button", { name: "Report a new issue" }).click();
  await sheet.locator("#title").fill("Lounge ceiling dripping water");
  const suggestions = sheet.getByRole("region", { name: "Similar active issues" });
  await expect(suggestions.getByRole("article", { name: TOWERS })).toBeVisible({ timeout: 10_000 });
  await suggestions.getByRole("button", { name: "Me too" }).click();
  await expect(sheet.getByText("You're counted in")).toBeVisible();
});

test("with the AI off, submitting still works: reporter's urgency kept, its own issue, reporter counted", async ({ browser }) => {
  const page = await signIn(browser, ACCOUNTS.student);
  // High is reviewed by Smart Sort, so with the AI off it falls back.
  const id = await reportIssue(page, "E2E fallback check", { priority: "High" });
  try {
    await expect
      .poll(async () => (await admin().from("requests").select("ai_status").eq("id", id).single()).data?.ai_status, { timeout: 15_000 })
      .toBe("fallback");
    const { data } = await admin().from("requests").select("group_id, ai_urgency").eq("id", id).single();
    expect(data!.ai_urgency).toBeNull();
    const { count: reports } = await admin().from("requests").select("id", { count: "exact", head: true }).eq("group_id", data!.group_id);
    expect(reports).toBe(1);
    const { count: votes } = await admin().from("group_votes").select("user_id", { count: "exact", head: true }).eq("group_id", data!.group_id);
    expect(votes).toBe(1);
  } finally {
    await deleteRequests([id]);
  }
});
