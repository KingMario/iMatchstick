import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 320, height: 568 },
  { width: 736, height: 414 },
]) {
  for (const hand of ["left", "right"]) {
    test(`touch drag artwork preserves proportions and fits its helper ${viewport.width} ${hand}`, async ({
      page,
      context,
    }) => {
      await page.setViewportSize(viewport);
      await page.addInitScript(
        (dragHand) =>
          localStorage.setItem(
            "imatchstick-pwa-settings",
            JSON.stringify({
              language: "en",
              difficulty: "level0",
              soundEnabled: false,
              timerEnabled: false,
              dragHand,
            }),
          ),
        hand,
      );
      await page.goto("/?puzzle=7-5%3D3");
      const source = page.locator('[data-position="4"][data-segment="3"]');
      await expect(source).toBeEnabled();
      const box = (await source.boundingBox())!;
      const length = Math.max(box.width, box.height);
      const cdp = await context.newCDPSession(page);
      try {
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x, y }],
        });
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: x + 12, y: y + 12 }],
        });
        const ghost = page.locator(".drag-ghost");
        await expect(ghost).toBeVisible();
        const helper = (await ghost.boundingBox())!;
        expect(helper.width).toBe(Math.max(14, Math.round(length * 0.4)));
        expect(helper.height).toBe(helper.width);
        const art = ghost.locator("svg");
        for (const time of [0, 137.5, 275, 550, 825]) {
          await art.evaluate((element, time) => {
            const animation = element.getAnimations()[0];
            animation.pause();
            animation.currentTime = time;
          }, time);
          const scales = await art.evaluate((element) => {
            const matrix = (element as SVGSVGElement).getScreenCTM()!;
            return {
              x: Math.hypot(matrix.a, matrix.b),
              y: Math.hypot(matrix.c, matrix.d),
            };
          });
          expect(Math.abs(scales.x - scales.y)).toBeLessThan(0.0001);
          const ink = (await ghost.locator(".matchstick-ink").boundingBox())!;
          expect(ink.x).toBeGreaterThanOrEqual(helper.x);
          expect(ink.y).toBeGreaterThanOrEqual(helper.y);
          expect(ink.x + ink.width).toBeLessThanOrEqual(
            helper.x + helper.width,
          );
          expect(ink.y + ink.height).toBeLessThanOrEqual(
            helper.y + helper.height,
          );
        }
        await page.screenshot({
          path: `/tmp/imatchstick-drag-review-${viewport.width}-${hand}.png`,
        });
        await page.emulateMedia({ reducedMotion: "reduce" });
        await expect(art).toHaveCSS("animation-name", "none");
        const target = page.locator('[data-position="4"][data-segment="5"]');
        const destination = (await target.boundingBox())!;
        const portrait = viewport.width < viewport.height;
        const offsetX = portrait
          ? length * 0.3 * 0.65
          : length * -1.3 * 0.65 * (hand === "left" ? -1 : 1);
        const offsetY = portrait
          ? length * -1.3 * 0.65 * (hand === "left" ? -1 : 1)
          : length * -0.3 * 0.65;
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [
            {
              x: destination.x + destination.width / 2 - offsetX,
              y: destination.y + destination.height / 2 - offsetY,
            },
          ],
        });
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
        await expect(page.locator(".equation")).toHaveAttribute(
          "aria-label",
          "7-5=2",
        );
        await expect(ghost).toHaveCount(0);
      } finally {
        await cdp.detach();
      }
    });
  }
}
