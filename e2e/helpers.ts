import { expect, type Browser, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

export const PASSWORD = process.env.DEMO_ACCOUNT_PASSWORD || "GTFixIt-Demo-2026!";
export const ACCOUNTS = {
  student: "demo.student@gatech.edu",
  faculty: "demo.faculty@gatech.edu",
  tech: "demo.tech@gatech.edu",
  admin: "demo.admin@gatech.edu",
} as const;

/** Service-role client, used only to clean up what the tests create. */
export const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

/** A fresh browser session signed in as one demo account. */
export async function signIn(browser: Browser, email: string): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL((u) => u.pathname !== "/login");
  return page;
}

/** Wait for a toast with this text. */
export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.getByRole("status").getByText(text)).toBeVisible();
}

/** As the student: report an issue in Klaus via search + the sheet form. Returns the new request id. */
export async function reportIssue(page: Page, title: string): Promise<number> {
  await page.goto("/report");
  await page.getByRole("combobox", { name: "Search buildings" }).fill("Klaus");
  await page.getByRole("option").first().click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  await sheet.locator("#location_detail").fill("Room 1447");
  await sheet.getByText("Plumbing", { exact: true }).click();
  await sheet.locator("#title").fill(title);
  await sheet.locator("#description").fill("Created by the automated end-to-end test.");
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(sheet.getByText("Thanks, it's reported!")).toBeVisible();
  const id = Number((await sheet.locator(".font-mono").first().innerText()).replace("#", ""));
  expect(id).toBeGreaterThan(0);
  return id;
}

/** Delete test requests, then any issue group they leave empty. */
export async function deleteRequests(ids: number[]) {
  if (!ids.length) return;
  const sb = admin();
  const { data } = await sb.from("requests").select("group_id").in("id", ids);
  await sb.from("requests").delete().in("id", ids);
  for (const gid of new Set((data ?? []).map((r) => r.group_id as number))) {
    const { count } = await sb.from("requests").select("id", { count: "exact", head: true }).eq("group_id", gid);
    if (!count) await sb.from("issue_groups").delete().eq("id", gid);
  }
}
