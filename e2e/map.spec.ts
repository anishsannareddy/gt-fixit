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

test("student map: hovering a GT building labels THAT building, and clicking opens it", async ({ browser }) => {
  const page = await signIn(browser, ACCOUNTS.student);
  const canvas = page.locator("canvas").first();
  await canvas.waitFor();
  await page.waitForTimeout(2500); // scene loaded and camera settled
  const box = (await canvas.boundingBox())!;
  // The hover label floats just above the hovered building's roof, so it must be near the pointer.
  const label = page.locator("div.glass-strong.whitespace-nowrap").first();
  const hits: { x: number; y: number }[] = [];
  for (let gy = 0.3; gy <= 0.8 && hits.length < 4; gy += 0.05) {
    for (let gx = 0.2; gx <= 0.8 && hits.length < 4; gx += 0.03) {
      const x = box.x + box.width * gx;
      const y = box.y + box.height * gy;
      await page.mouse.move(x, y);
      await page.waitForTimeout(60);
      if ((await page.evaluate(() => document.body.style.cursor)) !== "pointer") continue;
      const lb = await label.boundingBox();
      expect(lb, "hovering a building shows its label").not.toBeNull();
      const dx = lb!.x + lb!.width / 2 - x;
      const dy = lb!.y + lb!.height - y; // label sits above the roof
      expect(Math.abs(dx), `label is ${Math.round(dx)}px sideways from the pointer`).toBeLessThan(160);
      expect(dy, `label is ${Math.round(dy)}px from the pointer`).toBeLessThan(40);
      expect(dy).toBeGreaterThan(-200);
      hits.push({ x, y });
      gx += 0.1; // move on to a different building
    }
  }
  expect(hits.length, "no GT building responded to hover").toBeGreaterThan(0);
  await page.mouse.click(hits[0].x, hits[0].y);
  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Report a new issue" }).or(sheet.locator("#room"))).toBeVisible();
});
