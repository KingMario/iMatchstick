import { expect, test } from "@playwright/test";

for (const language of ["zh", "en"]) {
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 568, height: 320 },
    { width: 1280, height: 800 },
  ]) {
    test(`level control occupies reserved playground space ${language} ${viewport.width}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.addInitScript(
        (language) =>
          localStorage.setItem(
            "imatchstick-pwa-settings",
            JSON.stringify({
              language,
              difficulty: "expert",
              soundEnabled: false,
              timerEnabled: false,
              dragHand: "right",
            }),
          ),
        language,
      );
      await page.goto("/");
      const level = page.locator(".equation-viewport > .difficulty-stepper");
      const decrease = level.locator("button:has([data-icon='previous'])");
      const increase = level.locator("button:has([data-icon='next'])");
      await expect(decrease).toBeEnabled();
      const box = (await level.boundingBox())!;
      const board = (await page.locator(".equation").boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(board.x);
      expect(box.y).toBeGreaterThanOrEqual(board.y);
      expect(box.x + box.width).toBeLessThanOrEqual(board.x + board.width);
      expect(box.y + box.height).toBeLessThanOrEqual(board.y + board.height);
      const portrait = viewport.width < viewport.height;
      await expect(level).toHaveCSS(
        "flex-direction",
        portrait ? "row" : "column",
      );
      await expect(level.locator(".action-icon").first()).toHaveCSS(
        "transform",
        portrait ? "none" : "matrix(0, -1, 1, 0, 0, 0)",
      );
      const lower = (await decrease.boundingBox())!;
      const higher = (await increase.boundingBox())!;
      const value = (await level.locator("span").boundingBox())!;
      if (portrait) {
        expect(lower.x + lower.width).toBeLessThanOrEqual(value.x);
        expect(value.x + value.width).toBeLessThanOrEqual(higher.x);
      } else {
        expect(higher.y + higher.height).toBeLessThanOrEqual(value.y);
        expect(value.y + value.height).toBeLessThanOrEqual(lower.y);
      }
      await expect(level.locator("strong")).toHaveCSS(
        "writing-mode",
        portrait ? "horizontal-tb" : "vertical-rl",
      );
      const sticks = await page
        .locator(".equation .matchstick-ink")
        .evaluateAll((elements) =>
          elements.map((element) => {
            const { left, right, top, bottom } =
              element.getBoundingClientRect();
            return { left, right, top, bottom };
          }),
        );
      for (const stick of sticks) {
        expect(stick.left).toBeGreaterThanOrEqual(board.x);
        expect(stick.right).toBeLessThanOrEqual(board.x + board.width);
        expect(stick.top).toBeGreaterThanOrEqual(board.y);
        expect(stick.bottom).toBeLessThanOrEqual(board.y + board.height);
        expect(
          portrait
            ? stick.top - box.y - box.height
            : stick.left - box.x - box.width,
        ).toBeGreaterThan(0);
      }
      await expect(
        page.locator(".play-controls .difficulty-stepper"),
      ).toHaveCount(0);
      const actions = page.locator(
        ".equation-viewport > .play-controls .actions",
      );
      await expect(actions).toBeVisible();
      const buttons = await actions.locator("button").all();
      expect(buttons).toHaveLength(5);
      await expect(buttons[1]).toHaveClass("undo-button");
      let previous: {
        x: number;
        y: number;
        width: number;
        height: number;
      } | null = null;
      for (const button of buttons) {
        const bounds = (await button.boundingBox())!;
        expect(bounds.x).toBeGreaterThanOrEqual(board.x);
        expect(bounds.y).toBeGreaterThanOrEqual(board.y);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(
          board.x + board.width,
        );
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(
          board.y + board.height,
        );
        for (const stick of sticks) {
          expect(
            portrait ? bounds.y - stick.bottom : bounds.x - stick.right,
          ).toBeGreaterThan(0);
        }
        if (previous) {
          expect(
            portrait
              ? bounds.x - previous.x - previous.width
              : bounds.y - previous.y - previous.height,
          ).toBeGreaterThan(0);
        }
        previous = bounds;
      }
      await page.screenshot({
        path: `/tmp/imatchstick-level-${language}-${viewport.width}.png`,
      });
      await decrease.click();
      await expect(increase).toBeEnabled();
      const first = portrait ? decrease : increase;
      const second = portrait ? increase : decrease;
      await first.focus();
      await page.keyboard.press("Tab");
      await expect(second).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(first).toBeFocused();
    });
  }
}
