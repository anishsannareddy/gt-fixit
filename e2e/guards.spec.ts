import { expect, test } from "@playwright/test";
import { ACCOUNTS, signIn } from "./helpers";

test("signed-out visitors are sent to the landing page", async ({ page }) => {
  for (const path of ["/report", "/my-requests", "/tech", "/admin", "/admin/analytics", "/requests/1001"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/$/);
  }
});

test("each role is sent home from other roles' pages", async ({ browser }) => {
  const cases = [
    [ACCOUNTS.student, "/report", ["/admin", "/tech"]],
    [ACCOUNTS.tech, "/tech", ["/admin", "/report", "/my-requests"]],
    [ACCOUNTS.admin, "/admin", ["/report", "/my-requests"]],
  ] as const;
  for (const [email, home, forbidden] of cases) {
    const page = await signIn(browser, email);
    await expect(page).toHaveURL(new RegExp(`${home}$`));
    for (const path of forbidden) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`${home}$`));
    }
  }
});

test("sign-up rejects non-GT emails", async ({ page }) => {
  await page.goto("/login?tab=signup");
  await page.fill("#name", "Not GT");
  await page.fill("#su-email", "someone@gmail.com");
  await page.fill("#su-password", "longenough123");
  await page.getByRole("button", { name: "Create student account" }).click();
  await expect(page.getByText("only open to Georgia Tech")).toBeVisible();
});

test("a student can't open someone else's request", async ({ browser }) => {
  const page = await signIn(browser, ACCOUNTS.student);
  // Find a request that belongs to another reporter
  const { admin } = await import("./helpers");
  const { data: me } = await admin().from("users").select("id").eq("email", ACCOUNTS.student).single();
  const { data: other } = await admin().from("requests").select("id").neq("reporter_id", me!.id).limit(1).single();
  await page.goto(`/requests/${other!.id}`);
  await expect(page.getByRole("heading", { name: "We couldn't find that" })).toBeVisible();
});

test("signing out from the user menu ends the session", async ({ browser }) => {
  const page = await signIn(browser, ACCOUNTS.admin);
  await page.getByRole("button", { name: /Account menu/ }).first().click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/$/);
});
