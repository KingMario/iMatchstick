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
    });
  }
}
