import { expect, type Page, test } from "./fixtures";

async function prepare(page: Page, language: "zh" | "en") {
  await page.addInitScript((language) => {
    Math.random = () => 0.75;
    localStorage.setItem(
      "imatchstick-pwa-settings",
      JSON.stringify({
        language,
        difficulty: "medium",
        soundEnabled: false,
        timerEnabled: false,
      }),
    );
  }, language);
}

test.describe("desktop presentation", () => {
  test.use({ isMobile: false, hasTouch: false });

  for (const language of ["zh", "en"] as const) {
    for (const viewport of [
      { width: 1920, height: 1080 },
      { width: 1280, height: 800 },
      { width: 1024, height: 500 },
      { width: 768, height: 1024 },
      { width: 414, height: 736 },
      { width: 320, height: 568 },
    ]) {
      test(`desktop content fits ${language} ${viewport.width}`, async ({
        page,
      }) => {
        await prepare(page, language);
        await page.setViewportSize(viewport);
        await page.goto("/?puzzle=10-80%3D100");
        await expect(page.locator(".equation")).toHaveAttribute(
          "aria-label",
          "10-80=100",
        );
        await expect(page.locator(".phone-layout")).toHaveCount(0);
        await expect(page.locator(".bottom-row .stats")).toHaveCount(1);
        await expect(page.locator(".bottom-row footer")).toHaveCount(1);
        const github = page.getByRole("link", { name: "GitHub", exact: true });
        await expect(github).toHaveCount(1);
        await expect(github).toHaveAttribute(
          "href",
          "https://github.com/KingMario/iMatchstick",
        );
        await expect(github.locator('[data-icon="github"]')).toBeVisible();
        await expect(github).toHaveText("");
        const board = (await page.locator(".equation").boundingBox())!;
        expect(board.x).toBeGreaterThanOrEqual(0);
        expect(board.x + board.width).toBeLessThanOrEqual(viewport.width);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBe(viewport.width);
        const left = (await page.locator(".difficulty-stepper").boundingBox())!;
        const right = (await page.locator(".play-controls").boundingBox())!;
        for (const stick of await page
          .locator(".equation .matchstick-ink")
          .all()) {
          const box = (await stick.boundingBox())!;
          expect(box.x).toBeGreaterThan(left.x + left.width);
          expect(box.x + box.width).toBeLessThan(right.x);
          expect(box.y).toBeGreaterThanOrEqual(board.y);
          expect(box.y + box.height).toBeLessThanOrEqual(
            board.y + board.height,
          );
        }
        for (const button of await page
          .locator(".play-controls button")
          .all()) {
          const box = (await button.boundingBox())!;
          expect(box.height).toBeGreaterThanOrEqual(40);
          expect(box.y).toBeGreaterThanOrEqual(board.y);
          expect(box.y + box.height).toBeLessThanOrEqual(
            board.y + board.height,
          );
        }
        const row = (await page.locator(".bottom-row").boundingBox())!;
        const stats = (await page.locator(".bottom-row .stats").boundingBox())!;
        const footer = (await page
          .locator(".bottom-row footer")
          .boundingBox())!;
        expect(stats.x).toBeCloseTo(row.x);
        expect(footer.x + footer.width).toBeCloseTo(row.x + row.width);
        if (stats.width + footer.width + 24 <= row.width) {
          expect(
            Math.abs(stats.y + stats.height / 2 - footer.y - footer.height / 2),
          ).toBeLessThan(1);
          expect(stats.x + stats.width).toBeLessThan(footer.x);
        } else {
          expect(footer.y).toBeGreaterThanOrEqual(stats.y + stats.height);
        }
        await page.screenshot({
          path: `/tmp/imatchstick-desktop-${language}-${viewport.width}.png`,
          fullPage: true,
        });
        await page
          .getByRole("button", {
            name: language === "zh" ? "设置" : "Settings",
            exact: true,
          })
          .click();
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        await expect(dialog.locator("details")).toHaveCount(3);
        await expect(dialog.locator("details[open]")).toHaveCount(0);
        await expect(dialog.locator(".stats")).toBeHidden();
        await expect(dialog.locator("footer")).toBeHidden();
        await expect(dialog.getByRole("link", { name: "GitHub" })).toHaveCount(
          0,
        );
        await expect(dialog.locator("select")).toHaveCount(0);
        await expect(dialog.locator(".language-switch")).toHaveCount(1);
        const close = dialog.getByRole("button", {
          name: language === "zh" ? "关闭" : "Close",
          exact: true,
        });
        await expect(close).toBeFocused();
        const body = dialog.locator(".overlay-body");
        await body.evaluate(
          (element) => (element.scrollTop = element.scrollHeight),
        );
        const closeBox = (await close.boundingBox())!;
        expect(closeBox.y).toBeGreaterThanOrEqual(0);
        expect(closeBox.y + closeBox.height).toBeLessThanOrEqual(
          viewport.height,
        );
        await close.click();
        await expect(dialog).toHaveCount(0);
      });
    }
  }

  for (const width of [414, 1280]) {
    test(`desktop mouse drag and undo at ${width}`, async ({ page }) => {
      await prepare(page, "en");
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/?puzzle=7-5%3D3");
      const source = (await page
        .locator('[data-position="4"][data-segment="3"]')
        .boundingBox())!;
      const start = {
        x: source.x + source.width / 2,
        y: source.y + source.height / 2,
      };
      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(start.x + 12, start.y);
      const ghost = page.locator(".drag-ghost");
      await expect(ghost).toBeVisible();
      const point = await ghost.evaluate((element) => ({
        x: Number.parseFloat((element as HTMLElement).style.left),
        y: Number.parseFloat((element as HTMLElement).style.top),
      }));
      const target = (await page
        .locator('[data-position="4"][data-segment="5"]')
        .boundingBox())!;
      await page.mouse.move(
        target.x + target.width / 2 - (point.x - start.x - 12),
        target.y + target.height / 2 - (point.y - start.y),
      );
      await page.mouse.up();
      await expect(page.locator(".equation")).toHaveAttribute(
        "aria-label",
        "7-5=2",
      );
      await expect(
        page.locator(".bottom-row .stats .stat-item strong"),
      ).toHaveText(["1", "1", "0"]);
      await page.getByRole("button", { name: "Undo", exact: true }).click();
      await expect(page.locator(".equation")).toHaveAttribute(
        "aria-label",
        "7-5=3",
      );
      await expect(page.locator(".answer-progress")).toHaveText("1/1");
      await page.setViewportSize({
        width: width === 414 ? 1280 : 414,
        height: 800,
      });
      await expect(page.locator(".phone-layout")).toHaveCount(0);
      await expect(page.locator(".bottom-row .stats")).toBeVisible();
      await expect(page.locator(".bottom-row footer")).toHaveCount(1);
    });
  }

  test("desktop statistics, keyboard order and dialog focus", async ({
    page,
  }) => {
    await prepare(page, "en");
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/?puzzle=7-5%3D3");
    await page.locator('[data-position="4"][data-segment="3"]').click();
    await page.locator('[data-position="4"][data-segment="5"]').click();
    await expect(page.locator(".success-next")).toHaveText(
      "Double-click the background for a new puzzle",
    );
    await expect(
      page.locator(".bottom-row .stats .stat-item strong"),
    ).toHaveText(["1", "1", "0"]);
    const labels = [
      "Settings",
      "Increase difficulty group",
      "Decrease difficulty group",
      "New",
      "Undo",
      "Answer",
      "Reset stats",
      "GitHub",
    ];
    const first = page.getByRole("button", { name: labels[0], exact: true });
    await first.focus();
    for (const label of labels.slice(1)) {
      await page.keyboard.press("Tab");
      await expect(
        page.getByRole(label === "GitHub" ? "link" : "button", {
          name: label,
          exact: true,
        }),
      ).toBeFocused();
    }
    const reset = page.getByRole("button", {
      name: "Reset stats",
      exact: true,
    });
    await reset.click();
    await expect(
      page.locator(".bottom-row .stats .stat-item strong"),
    ).toHaveText(["0", "0", "0"]);
    const more = page.getByRole("button", { name: "Settings", exact: true });
    await more.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    const close = dialog.getByRole("button", { name: "Close", exact: true });
    await expect(close).toBeFocused();
    const sequence = ["中", "EN", "Timer", "Sound"];
    for (const name of sequence) {
      await page.keyboard.press("Tab");
      await expect(
        dialog.getByRole(
          name === "Timer" || name === "Sound" ? "checkbox" : "button",
          { name, exact: true },
        ),
      ).toBeFocused();
    }
    for (const label of ["How to play", "Statistics", "About & version"]) {
      await page.keyboard.press("Tab");
      await expect(
        dialog.locator("summary").filter({ hasText: label }),
      ).toBeFocused();
    }
    await page.keyboard.press("Tab");
    // Native dialogs allow a stop in browser chrome before returning to the dialog.
    if (await page.evaluate(() => !document.hasFocus())) {
      await page.keyboard.press("Tab");
    }
    await expect(close).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    if (await page.evaluate(() => !document.hasFocus())) {
      await page.keyboard.press("Shift+Tab");
    }
    await expect(
      dialog.locator("summary").filter({ hasText: "About & version" }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(more).toBeFocused();
    await more.click();
    const bounds = (await dialog.boundingBox())!;
    await page.mouse.click(bounds.x - 8, bounds.y + 10);
    await expect(dialog).toHaveCount(0);
    await expect(more).toBeFocused();
    await page.getByRole("button", { name: "Answer", exact: true }).click();
    await expect(
      page.getByRole("dialog").locator(".answer-list"),
    ).toContainText("7-5=2");
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Answer", exact: true }),
    ).toBeFocused();
  });
});

test.describe("phone presentation", () => {
  test.use({ isMobile: true, hasTouch: true });
  for (const language of ["zh", "en"] as const) {
    for (const viewport of [
      { width: 320, height: 568 },
      { width: 736, height: 414 },
    ]) {
      test(`phone keeps statistics and footer in More ${language} ${viewport.width}`, async ({
        page,
      }) => {
        await prepare(page, language);
        await page.setViewportSize(viewport);
        await page.goto("/?puzzle=7-5%3D3");
        await expect(page.locator(".phone-layout")).toBeVisible();
        await expect(page.locator(".bottom-row")).toHaveCount(0);
        await page.locator('[data-position="4"][data-segment="3"]').tap();
        await page.locator('[data-position="4"][data-segment="5"]').tap();
        const label = language === "zh" ? "设置" : "Settings";
        await page.getByRole("button", { name: label, exact: true }).tap();
        const dialog = page.getByRole("dialog");
        await expect(dialog.locator("details[open]")).toHaveCount(0);
        await dialog
          .locator("summary")
          .filter({ hasText: language === "zh" ? "游戏统计" : "Statistics" })
          .tap();
        await dialog
          .locator("summary")
          .filter({
            hasText: language === "zh" ? "关于与版本" : "About & version",
          })
          .tap();
        await expect(page.locator(".stats")).toHaveCount(1);
        await expect(dialog.locator(".stats .stat-item strong")).toHaveText([
          "1",
          "1",
          "0",
        ]);
        await expect(page.locator("footer")).toHaveCount(1);
        await expect(dialog.locator("footer")).toContainText(
          "Copyright Mario Studio 2026-2027",
        );
        const github = dialog.getByRole("link", {
          name: "GitHub",
          exact: true,
        });
        await github.scrollIntoViewIfNeeded();
        await expect(github.locator('[data-icon="github"]')).toBeVisible();
        await expect(dialog.locator("select")).toHaveCount(1);
        await dialog
          .getByRole("button", {
            name: language === "zh" ? "清零统计" : "Reset stats",
            exact: true,
          })
          .tap();
        await expect(dialog.locator(".stats .stat-item strong")).toHaveText([
          "0",
          "0",
          "0",
        ]);
        await dialog
          .getByRole("button", {
            name: language === "zh" ? "关闭" : "Close",
            exact: true,
          })
          .tap();
        await expect(dialog).toHaveCount(0);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBe(viewport.width);
        expect(
          await page.evaluate(() => document.documentElement.scrollHeight),
        ).toBe(viewport.height);
      });
    }
  }
});
