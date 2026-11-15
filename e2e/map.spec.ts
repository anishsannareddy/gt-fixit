import { expect, test } from "@playwright/test";
import { ACCOUNTS, signIn } from "./helpers";

test("admin heat map shows the green / yellow / red legend and a Reset view button", async ({ browser }) => {
  const page = await signIn(browser, ACCOUNTS.admin);
  const map = page.getByRole("region", { name: /Campus map/ });
  await expect(map.getByText("Open requests per building")).toBeVisible();
  for (const label of ["OK", "Busy", "Hot spot"]) await expect(map.getByText(label, { exact: true })).toBeVisible();
  await expect(map.getByText("Hot spots also carry a pin")).toBeVisible(); // the seed always has at least one hot spot
  await map.getByRole("button", { name: "Reset view" }).click();
  // Areas view swaps the legend
  await map.getByRole("button", { name: "Areas" }).click();
  await expect(map.getByText("Maintenance areas").first()).toBeVisible();
});

test("student map has search, no Reset view button, and slowly orbits when left alone", async ({ browser }) => {
  const page = await signIn(browser, ACCOUNTS.student);
  await expect(page.getByRole("combobox", { name: "Search buildings" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reset view" })).toHaveCount(0);
  const canvas = page.locator("canvas").first();
  await canvas.waitFor();
  await page.mouse.move(2, 2); // keep the pointer off the map
  await page.waitForTimeout(7000); // past the idle delay, plus the ease-in
  const a = await canvas.screenshot();
  await page.waitForTimeout(1500);
  const b = await canvas.screenshot();
  expect(a.equals(b)).toBe(false);
});
