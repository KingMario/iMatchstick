import { expect, test } from "./fixtures";

test("phone layout follows the visible viewport on launch, resize and restore", async ({
  page,
}) => {
  await page.setViewportSize({ width: 736, height: 414 });
  await page.addInitScript(() => {
    Object.defineProperty(window.visualViewport, "height", {
      configurable: true,
      value: 320,
    });
  });
  await page.goto("/?puzzle=7-5%3D3");
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
    "content",
    /viewport-fit=cover/,
  );
  await expect(
    page.locator(".phone-layout:not(.phone-portrait)"),
  ).toBeVisible();

  async function expectControlsWithin(height: number) {
    await expect
      .poll(
        async () => (await page.locator(".app-shell").boundingBox())?.height,
      )
      .toBe(height);
    for (const button of await page.locator(".play-controls button").all()) {
      const box = (await button.boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(height);
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight),
    ).toBeLessThanOrEqual(414);
  }

  await expectControlsWithin(320);
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport, "height", {
      configurable: true,
      value: 300,
    });
    window.visualViewport!.dispatchEvent(new Event("resize"));
  });
  await expectControlsWithin(300);
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport, "height", {
      configurable: true,
      value: 340,
    });
    window.dispatchEvent(new Event("pageshow"));
  });
  await expectControlsWithin(340);
});
