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
      const hand = dialog.getByRole("combobox", {
        name: "拖拽惯用手",
        exact: true,
      });
      if (device.isMobile) {
        await expect(hand).toBeVisible();
        await hand.selectOption("left");
        await expect(hand).toHaveValue("left");
      } else {
        await expect(hand).toHaveCount(0);
      }
      await dialog.getByRole("button", { name: "EN", exact: true }).click();
      await expect(
        dialog.getByRole("combobox", { name: "Drag hand", exact: true }),
      ).toHaveCount(device.isMobile ? 1 : 0);
    } finally {
      await context.close();
    }
  });
}
