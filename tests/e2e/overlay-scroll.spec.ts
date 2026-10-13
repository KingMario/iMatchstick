import { expect, test } from "@playwright/test";

test("portrait dialog scrolling follows the rotated content axis", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/?puzzle=7-5%3D3");
  await page.locator(".play-controls button").last().tap();
  const body = page.locator("dialog[open] .overlay-body");
  const rect = (await body.boundingBox())!;
  const cdp = await context.newCDPSession(page);
  try {
    for (const { dx, dy, expected } of [
      { dx: 80, dy: 0, expected: 280 },
      { dx: -80, dy: 0, expected: 120 },
      { dx: 0, dy: -80, expected: 200 },
      { dx: 0, dy: 80, expected: 200 },
    ]) {
      await body.evaluate((element) => {
        element.scrollTop = 200;
      });
      const x = rect.x + rect.width / 2;
      const y = rect.y + rect.height / 2;
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y }],
      });
      for (let i = 1; i <= 8; i++) {
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: x + (dx * i) / 8, y: y + (dy * i) / 8 }],
        });
      }
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await expect
        .poll(() => body.evaluate((element) => element.scrollTop))
        .toBeCloseTo(expected, 0);
    }
    await body.evaluate((element) => {
      element.scrollTop = 200;
    });
    await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2);
    await page.mouse.wheel(-80, 0);
    await expect
      .poll(() => body.evaluate((element) => element.scrollTop))
      .toBe(280);
    await page.mouse.wheel(80, 0);
    await expect
      .poll(() => body.evaluate((element) => element.scrollTop))
      .toBe(200);
    await page.mouse.wheel(0, 80);
    await expect
      .poll(() => body.evaluate((element) => element.scrollTop))
      .toBe(280);
    await body.evaluate((element) => {
      element.scrollTop = 0;
    });
    await page.getByRole("button", { name: "EN", exact: true }).tap();
    await expect(
      page.getByRole("button", { name: "Close", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Close", exact: true }).tap();
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await page.setViewportSize({ width: 568, height: 320 });
    await page.locator(".play-controls button").last().tap();
    const landscape = (await body.boundingBox())!;
    await body.evaluate((element) => {
      element.scrollTop = 0;
    });
    await page.mouse.move(
      landscape.x + landscape.width / 2,
      landscape.y + landscape.height / 2,
    );
    await page.mouse.wheel(0, 80);
    await expect
      .poll(() => body.evaluate((element) => element.scrollTop))
      .toBe(80);
  } finally {
    await cdp.detach();
  }
});
