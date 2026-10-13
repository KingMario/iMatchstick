import { test as base } from "@playwright/test";
export { expect, type Page } from "@playwright/test";

// Existing game regressions exercise a returning visitor. Seed only the legacy
// stats marker so each test remains free to choose its own settings and stats.
// Hook newContext too: layout tests often create their own browser contexts.
export const test = base.extend({
  browser: [
    async ({ browser }, use) => {
      const originalNewContext = browser.newContext.bind(browser);
      browser.newContext = async (options) => {
        const context = await originalNewContext(options);
        await context.addInitScript(() => {
          if (localStorage.getItem("imatchstick-pwa-stats") === null) {
            localStorage.setItem(
              "imatchstick-pwa-stats",
              JSON.stringify({ solved: 0, streak: 0, bypassed: 0 }),
            );
          }
        });
        return context;
      };
      try {
        await use(browser);
      } finally {
        browser.newContext = originalNewContext;
      }
    },
    { scope: "worker" },
  ],
});
