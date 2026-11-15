import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

/** npm run perf:map — frame-rate check for the student 3D map (4x CPU throttling, phone viewport). */
export default defineConfig({
  ...base,
  testDir: "e2e/perf",
  testMatch: "*.perf.ts",
  timeout: 180_000,
  projects: [
    {
      name: "chromium-gpu",
      use: {
        browserName: "chromium",
        // Use the real GPU (Metal via ANGLE on macOS) instead of software rendering.
        // PERF_GPU=0 uses Chrome's software renderer instead: a rough stand-in for a weak phone GPU.
        launchOptions: { args: process.env.PERF_GPU === "0" ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] : ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] },
      },
    },
  ],
});
