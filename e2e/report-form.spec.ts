import { expect, test } from "@playwright/test";
import { ACCOUNTS, deleteRequests, expectToast, reportIssue, signIn } from "./helpers";

test("room and description are validated inline, and 'Not in a room' offers a list", async ({ browser }) => {
  const page = await signIn(browser, ACCOUNTS.student);
  await page.goto("/report");
  await page.getByRole("combobox", { name: "Search buildings" }).fill("Klaus");
  await page.getByRole("option").first().click();
  const sheet = page.getByRole("dialog");
  const newReport = page.getByRole("button", { name: "Report a new issue" });
  await expect(newReport.or(sheet.locator("#room"))).toBeVisible();
  if (await newReport.isVisible()) await newReport.click();

  const room = sheet.locator("#room");
  for (const bad of ["12 3", "4#5", "🔥12", "AB12"]) {
    await room.fill(bad);
    await room.blur();
    await expect(sheet.getByText(/Use digits with an optional letter/)).toBeVisible();
  }
  await room.fill("1116A");
  await expect(sheet.getByText(/Use digits with an optional letter/)).toHaveCount(0);
  await expect(room).toHaveAttribute("maxlength", "6");

  // Not in a room: a short list instead of the room box
  await sheet.getByText("Not in a room", { exact: true }).click();
  await expect(sheet.locator("#room")).toHaveCount(0);
  await expect(sheet.getByLabel("Spot")).toBeVisible();
  await sheet.getByLabel("Spot").selectOption("Stairwell");

  // Description: live counter, at least 10 characters
  const desc = sheet.locator("#description");
  await desc.fill("too short");
  await expect(sheet.getByTestId("description-count")).toHaveText("9/300");
  await desc.blur();
  await expect(sheet.getByText(/at least 10 characters/)).toBeVisible();
  await expect(desc).toHaveAttribute("maxlength", "300");
});

test("a private request stays out of Active issues until the reporter makes it public", async ({ browser }) => {
  const title = `E2E private ${Date.now()}`;
  const student = await signIn(browser, ACCOUNTS.student);
  const id = await reportIssue(student, title, { private: true });
  try {
    const other = await signIn(browser, ACCOUNTS.faculty);
    await other.goto(`/issues?q=${encodeURIComponent(title)}`);
    await expect(other.getByRole("article", { name: title })).toHaveCount(0);

    // The reporter sees it as private on its page, and can switch it to public
    await student.goto(`/requests/${id}`);
    await expect(student.getByText("Private", { exact: true }).first()).toBeVisible();
    const who = student.getByRole("group", { name: "Who can see this request?" });
    await who.getByText("Public", { exact: true }).click();
    await expectToast(student, "Now public");

    await other.goto(`/issues?q=${encodeURIComponent(title)}`);
    await expect(other.getByRole("article", { name: title })).toBeVisible();

    // And back to private: gone again
    await student.goto(`/requests/${id}`);
    await student.getByRole("group", { name: "Who can see this request?" }).getByText("Private", { exact: true }).click();
    await expectToast(student, "Now private");
    await other.goto(`/issues?q=${encodeURIComponent(title)}`);
    await expect(other.getByRole("article", { name: title })).toHaveCount(0);
  } finally {
    await deleteRequests([id]);
  }
});
