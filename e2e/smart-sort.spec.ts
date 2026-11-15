import { expect, test } from "@playwright/test";
import { ACCOUNTS, admin, expectToast, signIn } from "./helpers";

// Seeded: "Light bulb out" (reporter: Urgent, AI: Low) and "Faint gas smell in kitchen" (reporter: Low, AI: Urgent, safety).
async function reset() {
  const sb = admin();
  await sb.from("users").update({ smart_sort: false }).eq("email", ACCOUNTS.tech);
  const { data } = await sb.from("requests").select("id").eq("title", "Light bulb out");
  const ids = (data ?? []).map((r) => r.id);
  if (!ids.length) return;
  await sb.from("requests").update({ triage_urgency: null, triage_by: null, triage_at: null }).in("id", ids);
  await sb.from("request_events").delete().in("request_id", ids).like("note", "Urgency set%");
}
test.beforeAll(reset);
test.afterAll(reset);

test("Smart Sort puts AI-urgent work first, flags disagreements, and saves a one-tap override", async ({ browser }) => {
  const page = await signIn(browser, ACCOUNTS.tech);
  await page.goto("/tech?tab=open");
  await expect(page.getByTestId("smart-sort-on")).toHaveCount(0);

  // The account menu no longer has it; the switch lives in the filter row
  await page.getByRole("button", { name: /Account menu/ }).click();
  await expect(page.getByRole("menu").getByText("Smart Sort")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.getByRole("switch", { name: /Smart Sort/ }).click();
  await expectToast(page, "Smart Sort is on");
  await expect(page.getByTestId("smart-sort-on")).toBeVisible();

  // Most urgent first: the first card's AI rating is Urgent
  const first = page.getByRole("article").first();
  await expect(first.getByRole("button", { name: /^AI: Urgent/ })).toBeVisible();
  // The gas smell the reporter marked Low is rated Urgent and flagged as a safety issue
  const gas = page.getByRole("article").filter({ hasText: "Faint gas smell in kitchen" });
  await expect(gas.getByRole("button", { name: /AI: Urgent \(reported Low\)/ })).toBeVisible();
  await expect(gas.getByText("Safety")).toBeVisible();

  // The light bulb marked Urgent: AI says Low, and the card says so in words
  const bulb = page.getByRole("article").filter({ hasText: "Light bulb out" });
  await expect(bulb.getByText("AI disagrees")).toBeVisible();
  await bulb.getByRole("button", { name: /AI: Low \(reported Urgent\)/ }).click();
  await expect(bulb.getByText("A single burned-out bulb")).toBeVisible();
  await bulb.getByRole("button", { name: "Medium", exact: true }).click();
  await expectToast(page, "Urgency set to Medium");

  // Saved: still there after a reload, and logged on the timeline
  await page.reload();
  const bulbAgain = page.getByRole("article").filter({ hasText: "Light bulb out" });
  await expect(bulbAgain.getByText(/Set: Medium/)).toBeVisible();
  await expect(bulbAgain.getByText("AI disagrees")).toBeVisible();

  // Off again: the old sort returns and the badges disappear
  await page.getByRole("switch", { name: /Smart Sort/ }).click();
  await expectToast(page, "Smart Sort is off");
  await expect(page.getByTestId("smart-sort-on")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^AI:/ })).toHaveCount(0);
});
