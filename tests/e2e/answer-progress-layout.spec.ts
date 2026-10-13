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
  const actions = page.locator(".status-actions");
  const gear = page.locator(".settings-button");
  await expect(actions).toHaveCSS("grid-column-start", "3");
  await expect(page.locator(".status-timer")).toHaveCSS(
    "grid-column-start",
    "1",
  );
  const count = (await counter.boundingBox())!;
  const strip = (await page.locator(".status-strip").boundingBox())!;
  const settings = (await gear.boundingBox())!;
  expect(settings.x).toBeGreaterThan(count.x + count.width);
  expect(settings.width).toBeGreaterThanOrEqual(40);
  expect(settings.height).toBeGreaterThanOrEqual(40);
  expect(
    Math.abs(settings.y + settings.height / 2 - count.y - count.height / 2),
  ).toBeLessThan(1);
  await expect(page.locator(".play-controls button")).toHaveCount(4);
  const copy = (await page.locator(".status-copy").boundingBox())!;
  const timer = (await page.locator(".status-timer").boundingBox())!;
  const controls = (await page.locator(".play-controls").boundingBox())!;
  expect(
    Math.abs(settings.x + settings.width - strip.x - strip.width),
  ).toBeLessThan(1);
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
            await expect(page.locator(".status-actions")).toHaveCSS(
              "grid-column-start",
              "3",
            );
            const count = (await page
              .locator(".status-actions")
              .boundingBox())!;
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

for (const mobile of [false, true]) {
  test.describe(`settings gear keyboard and rotation ${mobile}`, () => {
    test.use({ isMobile: mobile, hasTouch: mobile });
    test("native keys, dialog dismissal and hit target remain usable", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 736, height: 414 });
      await prepare(page, "en", false);
      const gear = page.getByRole("button", { name: "Settings", exact: true });
      await expect(gear.locator('svg[data-icon="settings"]')).toHaveCount(1);
      await expect(gear).toHaveAttribute("title", "Settings");
      await expect(gear).toHaveAttribute("aria-haspopup", "dialog");
      expect(
        await gear.evaluate((el) =>
          Boolean(el.closest('[role="status"], [aria-live]')),
        ),
      ).toBe(false);
      for (const key of ["Enter", "Space"]) {
        await gear.focus();
        await gear.press(key);
        await expect(page.getByRole("dialog")).toBeVisible();
        await expect(gear).toHaveAttribute("aria-expanded", "true");
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(gear).toBeFocused();
        await expect(gear).toHaveAttribute("aria-expanded", "false");
      }
      if (mobile) {
        await page.setViewportSize({ width: 414, height: 736 });
        await expect(page.locator(".phone-portrait")).toBeVisible();
        const counter = (await page.locator(".answer-progress").boundingBox())!;
        const box = (await gear.boundingBox())!;
        expect(box.y).toBeGreaterThan(counter.y + counter.height);
        expect(
          Math.abs(box.x + box.width / 2 - counter.x - counter.width / 2),
        ).toBeLessThan(1);
      }
      await gear.click();
      await page.getByRole("dialog").locator(".overlay-close").click();
      await expect(gear).toBeFocused();
    });
  });
}
