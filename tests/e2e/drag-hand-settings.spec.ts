import { expect, test } from "@playwright/test";

for (const device of [
  {
    name: "desktop",
    isMobile: false,
    hasTouch: false,
    width: 1280,
    height: 800,
  },
  {
    name: "narrow desktop",
    isMobile: false,
    hasTouch: false,
    width: 414,
    height: 736,
  },
  {
    name: "portrait phone",
    isMobile: true,
    hasTouch: true,
    width: 414,
    height: 736,
  },
  {
    name: "landscape phone",
    isMobile: true,
    hasTouch: true,
    width: 736,
    height: 414,
  },
]) {
  test(`drag hand setting visibility on ${device.name}`, async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
      baseURL,
      isMobile: device.isMobile,
      hasTouch: device.hasTouch,
      viewport: { width: device.width, height: device.height },
    });
    try {
      const page = await context.newPage();
      await page.goto("/?puzzle=7-5%3D3");
      await expect(page.locator(".top-bar .language-switch")).toHaveCount(0);
      await page.getByRole("button", { name: "设置", exact: true }).click();
      const dialog = page.getByRole("dialog");
      const hand = dialog.getByRole("radiogroup", {
        name: "拖拽惯用手",
        exact: true,
      });
      if (device.isMobile) {
        await expect(hand).toBeVisible();
        await hand.getByText("左手拖拽", { exact: true }).click();
        await expect(
          hand.getByRole("radio", { name: "左手拖拽", exact: true }),
        ).toBeChecked();
      } else {
        await expect(hand).toHaveCount(0);
      }
      await dialog.getByRole("button", { name: "EN", exact: true }).click();
      await expect(
        dialog.getByRole("radiogroup", { name: "Drag hand", exact: true }),
      ).toHaveCount(device.isMobile ? 1 : 0);
    } finally {
      await context.close();
    }
  });
}

for (const language of ["zh", "en"] as const) {
  test(`hand segments rotate inline and support keyboard and persistence: ${language}`, async ({
    page,
  }) => {
    await page.addInitScript((language) => {
      if (!localStorage.getItem("imatchstick-pwa-settings")) {
        localStorage.setItem(
          "imatchstick-pwa-settings",
          JSON.stringify({ language, dragHand: "right" }),
        );
      }
    }, language);
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/?puzzle=7-5%3D3");
    const settings = page.getByRole("button", {
      name: language === "zh" ? "设置" : "Settings",
      exact: true,
    });
    await settings.click();
    const dialog = page.getByRole("dialog");
    const group = dialog.getByRole("radiogroup", {
      name: language === "zh" ? "拖拽惯用手" : "Drag hand",
      exact: true,
    });
    const left = group.getByRole("radio", {
      name: language === "zh" ? "左手拖拽" : "Left hand",
      exact: true,
    });
    const right = group.getByRole("radio", {
      name: language === "zh" ? "右手拖拽" : "Right hand",
      exact: true,
    });
    await expect(right).toBeChecked();
    await expect(dialog.locator("select, option")).toHaveCount(0);
    const segments = group.locator("label > span");
    const first = (await segments.nth(0).boundingBox())!;
    const second = (await segments.nth(1).boundingBox())!;
    // The horizontal segments rotate clockwise into screen-vertical order.
    expect(Math.abs(first.x - second.x)).toBeLessThan(1);
    expect(second.y).toBeGreaterThanOrEqual(first.y + first.height);
    for (const bounds of [first, second]) {
      expect(bounds.width).toBeGreaterThanOrEqual(44);
      expect(bounds.height).toBeGreaterThanOrEqual(44);
    }
    await right.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(left).toBeChecked();
    await expect(left).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(right).toBeChecked();
    await segments.nth(0).click();
    await segments.nth(0).click();
    await expect(left).toBeChecked();
    await page.setViewportSize({ width: 568, height: 320 });
    await expect(left).toBeChecked();
    const landscapeFirst = (await segments.nth(0).boundingBox())!;
    const landscapeSecond = (await segments.nth(1).boundingBox())!;
    expect(Math.abs(landscapeFirst.y - landscapeSecond.y)).toBeLessThan(1);
    expect(landscapeSecond.x).toBeGreaterThanOrEqual(
      landscapeFirst.x + landscapeFirst.width,
    );
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await settings.click();
    await expect(left).toBeChecked();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            JSON.parse(localStorage.getItem("imatchstick-pwa-settings")!)
              .dragHand,
        ),
      )
      .toBe("left");
    await page.reload();
    await settings.click();
    await expect(left).toBeChecked();
  });
}
