import { expect, test, type Page } from "@playwright/test";

async function prepare(
  page: Page,
  language: "zh" | "en",
  timerEnabled: boolean,
) {
  await page.addInitScript(
    ({ language, timerEnabled }) => {
      localStorage.setItem(
        "imatchstick-pwa-settings",
        JSON.stringify({
          language,
          timerEnabled,
          difficulty: "level0",
          soundEnabled: false,
        }),
      );
    },
    { language, timerEnabled },
  );
  await page.goto("/?puzzle=7-5%3D3");
  await expect(page.locator(".answer-progress")).toHaveText("0/1");
}

async function expectTopRight(page: Page) {
  const counter = page.locator(".answer-progress");
  await expect(counter).toHaveCSS("grid-column-start", "3");
  await expect(page.locator(".status-timer")).toHaveCSS(
    "grid-column-start",
    "1",
  );
  const count = (await counter.boundingBox())!;
  const strip = (await page.locator(".status-strip").boundingBox())!;
  const copy = (await page.locator(".status-copy").boundingBox())!;
  const timer = (await page.locator(".status-timer").boundingBox())!;
  const controls = (await page.locator(".play-controls").boundingBox())!;
  expect(Math.abs(count.x + count.width - strip.x - strip.width)).toBeLessThan(
    1,
  );
  expect(count.y).toBeGreaterThanOrEqual(strip.y);
  expect(count.y + count.height).toBeLessThanOrEqual(strip.y + strip.height);
  expect(timer.x + timer.width).toBeLessThanOrEqual(copy.x);
  expect(copy.x + copy.width).toBeLessThanOrEqual(count.x);
  expect(
    await page
      .locator(".status-copy")
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  expect(count.y + count.height).toBeLessThan(controls.y);
  expect(
    await counter.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
}

for (const desktop of [false, true]) {
  test.describe(desktop ? "desktop counter" : "phone counter", () => {
    test.use({ isMobile: !desktop, hasTouch: !desktop });
    for (const language of ["zh", "en"] as const) {
      for (const timerEnabled of [false, true]) {
        test(`top-right preserves progress and timer: ${language}, timer ${timerEnabled}`, async ({
          page,
        }) => {
          await page.setViewportSize({
            width: desktop ? 1280 : 568,
            height: desktop ? 800 : 320,
          });
          await prepare(page, language, timerEnabled);
          await expectTopRight(page);
          const counter = page.locator(".answer-progress");
          await expect(counter).toHaveAttribute("aria-label", /: 0\/1$/);
          await page.locator('[data-position="4"][data-segment="3"]').click();
          await page.locator('[data-position="4"][data-segment="5"]').click();
          await expect(counter).toHaveText("1/1");
          await expect(counter).toHaveAttribute("aria-label", /: 1\/1$/);
          await expect(page.getByRole("status")).not.toHaveText("");
          await expectTopRight(page);
          await page
            .getByRole("button", {
              name: language === "zh" ? "复原" : "Undo",
              exact: true,
            })
            .click();
          await expect(counter).toHaveText("1/1");
          // Reflow through portrait and back without remounting or losing progress.
          await page.setViewportSize({ width: 320, height: 568 });
          if (desktop) {
            await expect(page.locator(".phone-layout")).toHaveCount(0);
            await expectTopRight(page);
          } else {
            await expect(page.locator(".phone-portrait")).toBeVisible();
            await expect(counter).toHaveCSS("grid-column-start", "3");
            const count = (await counter.boundingBox())!;
            const strip = (await page.locator(".status-strip").boundingBox())!;
            // Shared top-right becomes the physical bottom-right after rotation.
            expect(
              Math.abs(count.y + count.height - strip.y - strip.height),
            ).toBeLessThan(1);
          }
          await expect(counter).toHaveText("1/1");
          await page.setViewportSize({ width: 736, height: 414 });
          await expect(page.locator(".phone-portrait")).toHaveCount(0);
          await expectTopRight(page);
          await expect(counter).toHaveText("1/1");
          if (timerEnabled) {
            await expect(page.locator(".status-timer")).toHaveAttribute(
              "aria-label",
              /: \d+s$/,
            );
            await expect(page.locator(".status-timer")).toHaveText(/\d+s/);
          } else {
            await expect(page.locator(".status-timer")).toBeEmpty();
          }
          // Stress numeric width and wrapping copy at the smallest upright layout.
          await page.setViewportSize({
            width: desktop ? 320 : 568,
            height: desktop ? 568 : 320,
          });
          await expect(page.locator(".phone-portrait")).toHaveCount(0);
          if (!desktop) {
            await expect(page.locator(".app-shell")).toHaveCSS(
              "width",
              "568px",
            );
          }
          await counter.evaluate((element) => {
            element.textContent = "123/456";
          });
          await page.getByRole("status").evaluate((element) => {
            element.textContent =
              "Find another answer by moving exactly one matchstick";
          });
          await expectTopRight(page);
        });
      }
    }
  });
}
