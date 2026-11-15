import { expect, test } from "@playwright/test";
import { ACCOUNTS, admin, expectToast, signIn } from "./helpers";

// Seeded group: "Ceiling leak in 2nd-floor lounge" in Towers. Dr. Shah (demo.faculty) hasn't voted on it.
const TOWERS = "Ceiling leak in 2nd-floor lounge";

async function facultyId() {
  const { data } = await admin().from("users").select("id").eq("email", ACCOUNTS.faculty).single();
  return data!.id as string;
}
async function towersGroupId() {
  const { data } = await admin().from("issue_groups").select("id").eq("title", TOWERS).single();
  return data!.id as number;
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
