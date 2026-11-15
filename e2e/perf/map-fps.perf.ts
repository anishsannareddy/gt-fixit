import { test } from "@playwright/test";
import { ACCOUNTS, PASSWORD } from "../helpers";

/** Counts requestAnimationFrame callbacks for `ms` milliseconds while `during` runs. */
async function fps(page: import("@playwright/test").Page, ms: number, during?: () => Promise<void>) {
  await page.evaluate(() => {
    const w = window as unknown as { __frames: number[]; __gen: number };
    w.__frames = [];
    const gen = (w.__gen = (w.__gen ?? 0) + 1);
    const tick = (t: number) => {
      if (w.__gen !== gen) return; // a newer measurement replaced this loop
      w.__frames.push(t);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const start = Date.now();
  if (during) await during();
  const left = ms - (Date.now() - start);
  if (left > 0) await page.waitForTimeout(left);
  return page.evaluate(() => {
    const w = window as unknown as { __frames: number[]; __gen: number };
    w.__gen++;
    const f = w.__frames;
    const gaps = f.slice(1).map((t, i) => t - f[i]).sort((a, b) => a - b);
    const avg = (f.length - 1) / ((f.at(-1)! - f[0]) / 1000);
    const p95 = gaps[Math.floor(gaps.length * 0.95)] ?? 0;
    const slow = gaps.filter((g) => g > 22).length; // frames that missed 45 fps
    return { avgFps: Math.round(avg * 10) / 10, p95FrameMs: Math.round(p95 * 10) / 10, slowPct: Math.round((slow / Math.max(1, gaps.length)) * 1000) / 10 };
  });
}

const RATES = (process.env.CPU_RATES ?? "4,10").split(",").map(Number);
for (const rate of RATES)
for (const vp of [
  { label: "phone 390x844 @3x", width: 390, height: 844, dpr: 3 },
  { label: "laptop 1280x800 @2x", width: 1280, height: 800, dpr: 2 },
]) {
  test(`student map frame rate, ${rate}x CPU throttle, ${vp.label}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.dpr, hasTouch: vp.width < 600 });
    const page = await context.newPage();
    await page.goto("/login");
    await page.fill("#email", ACCOUNTS.student);
    await page.fill("#password", PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL(/\/report/);
    await page.locator("canvas").first().waitFor();
    await page.waitForTimeout(4000); // let the scene load and settle

    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate });
    await page.waitForTimeout(3000); // let the quality monitor settle under the new load
    const box = (await page.locator("canvas").first().boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    const idle = await fps(page, 5000);
    const drag = await fps(page, 5000, async () => {
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      for (let i = 0; i < 60; i++) await page.mouse.move(cx + Math.sin(i / 6) * 120, cy + Math.cos(i / 9) * 60, { steps: 2 });
      await page.mouse.up();
    });
    const hover = await fps(page, 4000, async () => {
      for (let i = 0; i < 40; i++) await page.mouse.move(box.x + (i / 40) * box.width, cy + Math.sin(i) * 80);
    });
    const gl = await page.evaluate(() => {
      const c = document.querySelector("canvas") as HTMLCanvasElement;
      const g = (c.getContext("webgl2") ?? c.getContext("webgl")) as WebGLRenderingContext | null;
      const ext = g?.getExtension("WEBGL_debug_renderer_info");
      return { renderer: ext ? g!.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "unknown", canvas: `${c.width}x${c.height}` };
    });
    console.log(JSON.stringify({ cpu: `${rate}x`, viewport: vp.label, ...gl, idle, drag, hover }));
    await context.close();
  });
}
