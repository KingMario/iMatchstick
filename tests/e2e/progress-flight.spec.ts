import { expect, test } from "./fixtures";

for (const viewport of [
  { width: 320, height: 568 },
  { width: 736, height: 414 },
]) {
  test(`progress advances only on checkmark arrival ${viewport.width}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/?puzzle=9-9%3D5");
    const digit = page.locator(".answer-progress b");
    const ghost = page.locator(".progress-flying-check");
    async function land(expectedBefore: string, expectedAfter: string) {
      await expect(ghost).toBeVisible();
      await ghost.evaluate((element) => {
        const animation = element.getAnimations()[0];
        animation.pause();
        animation.currentTime = 0;
      });
      await expect(digit).toHaveText(expectedBefore);
      const source = (await page
        .locator(".equation-success-check")
        .boundingBox())!;
      const start = (await ghost.boundingBox())!;
      expect(
        Math.abs(start.x + start.width / 2 - source.x - source.width / 2),
      ).toBeLessThan(1);
      expect(
        Math.abs(start.y + start.height / 2 - source.y - source.height / 2),
      ).toBeLessThan(1);
      await ghost.evaluate((element) => {
        element.getAnimations()[0].currentTime = 599;
      });
      expect(await ghost.boundingBox()).toEqual(start);
      await expect(digit).toHaveText(expectedBefore);
      await ghost.evaluate((element) => {
        element.getAnimations()[0].currentTime = 920;
      });
      await page.screenshot({
        path: `/tmp/imatchstick-progress-flight-${viewport.width}.png`,
      });
      await ghost.evaluate((element) => {
        element.getAnimations()[0].currentTime = 1239;
      });
      const target = (await digit.boundingBox())!;
      const end = (await ghost.boundingBox())!;
      expect(
        Math.abs(end.x + end.width / 2 - target.x - target.width / 2),
      ).toBeLessThan(1);
      expect(
        Math.abs(end.y + end.height / 2 - target.y - target.height / 2),
      ).toBeLessThan(1);
      await expect(digit).toHaveText(expectedBefore);
      await ghost.evaluate((element) => element.getAnimations()[0].finish());
      await expect(digit).toHaveText(expectedAfter);
      await expect(ghost).toHaveCount(0);
    }
    await page.locator('[data-position="2"][data-segment="0"]').tap();
    await page.locator('[data-position="4"][data-segment="5"]').tap();
    await land("0", "1");
    await page.getByRole("button", { name: "复原", exact: true }).tap();
    await page.locator('[data-position="2"][data-segment="0"]').tap();
    await page.locator('[data-position="4"][data-segment="5"]').tap();
    await expect(ghost).toHaveCount(0);
    await expect(digit).toHaveText("1");
    await page.getByRole("button", { name: "复原", exact: true }).tap();
    await page.locator('[data-position="2"][data-segment="0"]').tap();
    await page.locator('[data-position="0"][data-segment="5"]').tap();
    await land("1", "2");
  });
}

test("undo cancels flight without losing the answer and reduced motion skips flight", async ({
  page,
}) => {
  await page.goto("/?puzzle=7-5%3D3");
  await page.locator('[data-position="4"][data-segment="3"]').tap();
  await page.locator('[data-position="4"][data-segment="5"]').tap();
  await expect(page.locator(".progress-flying-check")).toBeVisible();
  await page.getByRole("button", { name: "复原", exact: true }).tap();
  await expect(page.locator(".progress-flying-check")).toHaveCount(0);
  await expect(page.locator(".answer-progress")).toHaveText("1/1");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await page.locator('[data-position="4"][data-segment="3"]').tap();
  await page.locator('[data-position="4"][data-segment="5"]').tap();
  await expect(page.locator(".answer-progress")).toHaveText("1/1");
  await expect(page.locator(".progress-flying-check")).toHaveCount(0);
  await expect(page.locator(".equation-success-check")).toBeVisible();
});
