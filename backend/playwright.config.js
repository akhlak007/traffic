import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./browser-tests",
  timeout: 30000,
  use: { baseURL: "http://127.0.0.1:4173", headless: true },
  webServer: {
    command: "node ../dev-server.js",
    url: "http://127.0.0.1:4173/index.html",
    reuseExistingServer: true
  }
});
