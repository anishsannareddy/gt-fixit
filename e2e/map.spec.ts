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

test("student map has search and a Reset view button", async ({ browser }) => {
  const page = await signIn(browser, ACCOUNTS.student);
  await expect(page.getByRole("combobox", { name: "Search buildings" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reset view" })).toBeVisible();
});
