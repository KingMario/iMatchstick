import { expect, test } from "./fixtures";

test("portrait dialog scrolling follows the rotated content axis", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/?puzzle=7-5%3D3");
  await page.locator(".settings-button").tap();
  await page
    .locator("dialog[open] summary")
    .filter({ hasText: "玩法说明" })
    .tap();
  const body = page.locator("dialog[open] .overlay-body");
  const rect = (await body.boundingBox())!;
  const cdp = await context.newCDPSession(page);
  try {
    for (const { dx, dy, direction } of [
      { dx: 80, dy: 0, direction: 1 },
      { dx: -80, dy: 0, direction: -1 },
      { dx: 0, dy: -80, direction: 0 },
      { dx: 0, dy: 80, direction: 0 },
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
      // Assert direction during the drag, not a fixed post-release offset:
      // native scrolling has a touch slop threshold and may continue with inertia.
      if (direction) {
        await expect
          .poll(() => body.evaluate((element) => element.scrollTop))
          [direction > 0 ? "toBeGreaterThan" : "toBeLessThan"](200);
      } else {
        await expect
          .poll(() => body.evaluate((element) => element.scrollTop))
          .toBeCloseTo(200, 0);
      }
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchCancel",
        touchPoints: [],
      });
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
    await page.locator(".settings-button").tap();
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

test("native touch gestures are not canceled or manually scrolled", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/?puzzle=7-5%3D3");
  const opener = page.locator(".settings-button");
  await opener.tap();
  await page
    .locator("dialog[open] summary")
    .filter({ hasText: "玩法说明" })
    .tap();
  const body = page.locator("dialog[open] .overlay-body");
  await expect(body).toHaveCSS("overflow-y", "auto");
  const result = await body.evaluate((element) => {
    const actions: string[] = [];
    for (let node: Element | null = element; node; node = node.parentElement) {
      actions.push(getComputedStyle(node).touchAction);
    }
    element.scrollTop = 100;
    const touch = (x: number) =>
      new Touch({ identifier: 1, target: element, clientX: x, clientY: 150 });
    const start = touch(100);
    element.dispatchEvent(
      new TouchEvent("touchstart", {
        bubbles: true,
        cancelable: true,
        touches: [start],
      }),
    );
    const move = new TouchEvent("touchmove", {
      bubbles: true,
      cancelable: true,
      touches: [touch(180)],
    });
    element.dispatchEvent(move);
    element.dispatchEvent(
      new TouchEvent("touchend", {
        bubbles: true,
        cancelable: true,
        touches: [],
      }),
    );
    return {
      actions,
      canceled: move.defaultPrevented,
      scroll: element.scrollTop,
    };
  });
  expect(result.actions).not.toContain("none");
  expect(result.canceled).toBe(false);
  // Synthetic DOM events do not trigger the browser's native scrolling. Any
  // offset here would expose a reintroduced JavaScript touch-scroll takeover.
  expect(result.scroll).toBe(100);
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(opener).toBeFocused();
  await opener.tap();
  await expect
    .poll(() => body.evaluate((element) => element.scrollTop))
    .toBe(100);
  await page.setViewportSize({ width: 568, height: 320 });
  await expect(body).toHaveCSS("overflow-y", "auto");
  await page.keyboard.press("Escape");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(opener).toBeFocused();
});
