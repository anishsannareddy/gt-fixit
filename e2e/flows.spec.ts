import { expect, test } from "@playwright/test";
import { ACCOUNTS, deleteRequests, expectToast, reportIssue, signIn } from "./helpers";

const created: number[] = [];
const stamp = Date.now().toString().slice(-6);
test.afterAll(async () => deleteRequests(created));

test.describe.serial("request lifecycle across all three roles", () => {
  const title = `E2E leaking sink ${stamp}`;
  let id = 0;

  test("student reports an issue, sees the success screen, and finds it in My requests", async ({ browser }) => {
    const page = await signIn(browser, ACCOUNTS.student);
    expect(new URL(page.url()).pathname).toBe("/report");
    id = await reportIssue(page, title);
    created.push(id);

    await page.getByRole("link", { name: "View request" }).click();
    await expect(page).toHaveURL(new RegExp(`/requests/${id}$`));
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.getByText("submitted the request")).toBeVisible();

    await page.getByRole("link", { name: "My requests" }).first().click();
    await expect(page.getByText(title)).toBeVisible();
  });

  test("technician claims, starts and resolves it", async ({ browser }) => {
    const page = await signIn(browser, ACCOUNTS.tech);
    expect(new URL(page.url()).pathname).toBe("/tech");

    await page.goto("/tech?tab=unassigned");
    const card = page.locator("article", { hasText: title });
    await card.getByRole("button", { name: "Claim" }).click();
    await expectToast(page, /Claimed/);

    await page.goto("/tech?tab=mine");
    const mine = page.locator("article", { hasText: title });
    await mine.getByRole("button", { name: "Start work" }).click();
    await expectToast(page, "Marked in progress.");
    await mine.getByRole("button", { name: "Resolve" }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByLabel(/What did you fix/).fill("Replaced the trap under the sink.");
    await sheet.getByRole("button", { name: "Mark resolved" }).click();
    await expectToast(page, "Marked resolved.");
  });

  test("student sees it resolved with the technician's note, and can reopen it", async ({ browser }) => {
    const page = await signIn(browser, ACCOUNTS.student);
    await page.goto(`/requests/${id}`);
    await expect(page.getByText("Resolved").first()).toBeVisible();
    await expect(page.getByText("Replaced the trap under the sink.")).toBeVisible();
    await page.getByRole("button", { name: "Reopen request" }).click();
    await expectToast(page, "Request reopened.");
    await expect(page.getByText("reopened the request")).toBeVisible();
  });
});

test("admin filters by building, opens the drawer, and manages a request; the technician sees it", async ({ browser }) => {
  const title = `E2E broken outlet ${stamp}`;
  const student = await signIn(browser, ACCOUNTS.student);
  const id = await reportIssue(student, title);
  created.push(id);

  const page = await signIn(browser, ACCOUNTS.admin);
  expect(new URL(page.url()).pathname).toBe("/admin");
  await expect(page.getByRole("heading", { name: "Command Center" })).toBeVisible();

  // Filter the list to Klaus (same as clicking it on the map), then open the request
  const buildingSelect = page.getByRole("combobox", { name: "Building", exact: true });
  const klaus = await buildingSelect.locator("option", { hasText: "Klaus" }).first().getAttribute("value");
  await buildingSelect.selectOption(klaus!);
  await expect(page).toHaveURL(new RegExp(`building=${klaus}`));
  await page.getByRole("link", { name: new RegExp(title) }).first().click();

  const drawer = page.getByRole("dialog");
  await expect(drawer.getByRole("heading", { name: title }).first()).toBeVisible();

  await drawer.getByRole("group", { name: "Priority" }).getByText("High", { exact: true }).click();
  await drawer.getByRole("button", { name: "Save priority" }).click();
  await expectToast(page, "Priority set to High.");

  await drawer.getByLabel("Add a note").fill("Checked with the building manager.");
  await drawer.getByRole("button", { name: "Add note" }).click();
  await expectToast(page, "Note added.");

  await drawer.getByLabel("Technician").selectOption({ label: "Marcus Reed" });
  await drawer.getByRole("button", { name: "Assign" }).click();
  await expectToast(page, "Technician assigned.");
  await expect(drawer.getByText("Priority changed: Medium → High")).toBeVisible();

  // Close with Escape and the drawer goes away
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Marcus (demo.tech) now has it in My work
  const tech = await signIn(browser, ACCOUNTS.tech);
  await tech.goto("/tech?tab=mine");
  await expect(tech.locator("article", { hasText: title })).toBeVisible();

  // Analytics stays reachable from the admin nav
  await page.getByRole("link", { name: "Analytics" }).first().click();
  await expect(page).toHaveURL(/\/admin\/analytics/);
  await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();
});
