import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const localChromePath = path.resolve(
  __dirname,
  ".local-browsers",
  "chrome-win64",
  "chrome.exe"
);
const chromeExecutablePath =
  process.env.PLAYWRIGHT_CHROME_EXECUTABLE_PATH ??
  (fs.existsSync(localChromePath) ? localChromePath : undefined);

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3000",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: chromeExecutablePath
          ? { executablePath: chromeExecutablePath }
          : undefined,
      },
    },
  ],
});
