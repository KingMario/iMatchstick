import { expect, test } from "@playwright/test";

for (const language of ["zh", "en"]) {
  for (const width of [568, 736]) {
    test(`landscape branding and hint share a row: ${language}, ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 320 });
      await page.addInitScript((language) => {
        localStorage.setItem(
          "imatchstick-pwa-settings",
          JSON.stringify({
            language,
            difficulty: "level0",
            timerEnabled: false,
            soundEnabled: false,
            dragHand: "right",
          }),
        );
      }, language);
      await page.goto("/?puzzle=7-5%3D3");
      await expect(page.locator(".phone-layout")).toBeVisible();
      const brand = page.locator(".status-brand");
      await expect(brand).toBeVisible();
      const brandBox = (await brand.boundingBox())!;
      const hintBox = (await page.getByRole("status").boundingBox())!;
      expect(Math.abs(brandBox.y - hintBox.y)).toBeLessThan(1);
      expect(brandBox.x + brandBox.width).toBeLessThan(hintBox.x);
      expect(hintBox.x + hintBox.width).toBeLessThanOrEqual(width);

      await page.goto("/?puzzle=9-9%3D5");
      for (const [sourcePosition, targetPosition, targetSegment] of [
        [2, 4, 5],
        [2, 4, 5],
        [2, 0, 5],
      ]) {
        await page
          .locator(`[data-position="${sourcePosition}"][data-segment="0"]`)
          .tap();
        await page
          .locator(
            `[data-position="${targetPosition}"][data-segment="${targetSegment}"]`,
          )
          .tap();
        const result = page.locator(".success-title");
        const next = page.locator(".success-next");
        await expect(result).toBeVisible();
        const resultBox = (await result.boundingBox())!;
        const nextBox = (await next.boundingBox())!;
        expect(
          Math.abs(
            resultBox.y + resultBox.height / 2 - nextBox.y - nextBox.height / 2,
          ),
        ).toBeLessThan(1);
        expect(resultBox.x + resultBox.width).toBeLessThan(nextBox.x);
        expect(nextBox.x + nextBox.width).toBeLessThanOrEqual(width);
        expect(resultBox.height).toBeLessThan(20);
        expect(nextBox.height).toBeLessThan(20);
        await page.screenshot({
          path: `/tmp/imatchstick-success-row-${language}-${width}.png`,
        });
        await page
          .getByRole("button", {
            name: language === "zh" ? "复原" : "Undo",
            exact: true,
          })
          .tap();
      }
    });
  }
}
