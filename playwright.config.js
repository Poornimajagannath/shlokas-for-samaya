import { defineConfig } from "@playwright/test";

const phones = [
  { name: "iphone-se", width: 375, height: 667 },
  { name: "iphone-14", width: 390, height: 844 },
  { name: "iphone-15-pro-max", width: 430, height: 932 },
];

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  retries: 0,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    hasTouch: true,
    isMobile: true,
    timezoneId: "America/Los_Angeles",
  },
  webServer: {
    command: "python3 -m http.server 4173",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
  },
  projects: phones.map((phone) => ({
    name: phone.name,
    use: {
      viewport: { width: phone.width, height: phone.height },
      deviceScaleFactor: 2,
      hasTouch: true,
      isMobile: true,
    },
  })),
});
