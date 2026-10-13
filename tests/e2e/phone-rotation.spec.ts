import { expect, test, type Page } from "@playwright/test";

const selectors = [
  ".app-shell",
  ".equation",
  ".status-strip",
  ".status-brand",
  ".answer-progress",
  ".difficulty-stepper",
  ".play-controls",
  ".match-segment",
];

test("phone safe areas contain the board, dialogs and close button", async ({
  page,
  context,
}) => {
  const cdp = await context.newCDPSession(page);
  try {
    for (const { viewport, insets } of [
      {
        viewport: { width: 390, height: 844 },
        insets: { top: 47, bottom: 34, left: 0, right: 0 },
      },
      {
        viewport: { width: 844, height: 390 },
        insets: { top: 0, bottom: 21, left: 47, right: 47 },
      },
    ]) {
      await page.setViewportSize(viewport);
      await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets });
      await page.goto("/?puzzle=7-5%3D3");
      await expect(page.locator(".phone-layout")).toBeVisible();
      await page.locator(".play-controls button").last().tap();
      for (const selector of [
        ".equation",
        ".status-strip",
        "dialog[open]",
        "dialog[open] .overlay-close",
      ]) {
        const box = (await page.locator(selector).boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(insets.left);
        expect(box.y).toBeGreaterThanOrEqual(insets.top);
        expect(box.x + box.width).toBeLessThanOrEqual(
          viewport.width - insets.right,
        );
        expect(box.y + box.height).toBeLessThanOrEqual(
          viewport.height - insets.bottom,
        );
      }
      await page.locator("dialog[open] .overlay-close").tap();
      await expect(page.locator("dialog[open]")).toHaveCount(0);
    }
  } finally {
    await cdp.detach();
  }
});

async function geometry(page: Page) {
  return page.locator(selectors.join(",")).evaluateAll((elements) =>
    elements.map((element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    }),
  );
}

test("rotation cancels screen-space drags and viewport changes settle progress", async ({
  page,
}) => {
  await page.setViewportSize({ width: 414, height: 736 });
  await page.goto("/?puzzle=7-5%3D3");
  const source = page.locator('[data-position="4"][data-segment="3"]');
  await expect(source).toBeEnabled();
  const box = (await source.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 12,
    box.y + box.height / 2 + 12,
  );
  await expect(page.locator(".drag-ghost")).toBeVisible();
  await page.setViewportSize({ width: 736, height: 414 });
  await expect(page.locator(".drag-ghost")).toHaveCount(0);
  await page.mouse.up();
  await expect(page.locator(".equation")).toHaveAttribute(
    "aria-label",
    "7-5=3",
  );
  await expect(page.locator(".match-segment.selected")).toHaveCount(0);
  await source.tap();
  await page.locator('[data-position="4"][data-segment="5"]').tap();
  await expect(page.locator(".progress-flying-check")).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(window.visualViewport, "height", {
      configurable: true,
      value: 350,
    });
    window.visualViewport!.dispatchEvent(new Event("resize"));
  });
  await expect(page.locator(".progress-flying-check")).toHaveCount(0);
  await expect(page.locator(".answer-progress")).toHaveText("1/1");
});

test("portrait More scrolls with touch in its rotated direction", async ({
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
    const y = rect.y + rect.height / 2;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: rect.x + 20, y }],
    });
    for (let x = rect.x + 40; x < rect.x + rect.width - 20; x += 20) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y }],
      });
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect
      .poll(() => body.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(30);
    await page.locator("dialog[open] .overlay-close").tap();
    await expect(page.locator("dialog[open]")).toHaveCount(0);
  } finally {
    await cdp.detach();
  }
});

for (const language of ["zh", "en"]) {
  for (const size of [
    { width: 320, height: 568 },
    { width: 414, height: 736 },
  ]) {
    test(`whole phone layout rotates clockwise ${language} ${size.width}`, async ({
      page,
    }) => {
      await page.addInitScript((language) => {
        localStorage.setItem(
          "imatchstick-pwa-settings",
          JSON.stringify({
            language,
            difficulty: "level0",
            soundEnabled: false,
            timerEnabled: false,
          }),
        );
      }, language);
      await page.setViewportSize({ width: size.height, height: size.width });
      await page.goto("/?puzzle=7-5%3D3");
      await expect(page.locator(".phone-layout")).toBeVisible();
      const landscape = await geometry(page);
      await page.setViewportSize(size);
      await expect(page.locator(".phone-portrait")).toBeVisible();
      const portrait = await geometry(page);
      expect(portrait).toHaveLength(landscape.length);
      for (let i = 0; i < portrait.length; i++) {
        const a = landscape[i];
        const b = portrait[i];
        expect(b.x).toBeCloseTo(size.width - a.y - a.height, 1);
        expect(b.y).toBeCloseTo(a.x, 1);
        expect(b.width).toBeCloseTo(a.height, 1);
        expect(b.height).toBeCloseTo(a.width, 1);
      }
      await expect(page.locator(".status-strip")).toHaveCSS(
        "writing-mode",
        "horizontal-tb",
      );
      expect(
        await page.evaluate(() => ({
          width: document.documentElement.scrollWidth,
          height: document.documentElement.scrollHeight,
        })),
      ).toEqual(size);

      const more = page.locator(".play-controls button").last();
      await more.tap();
      const dialog = page.locator("dialog[open]");
      await expect(dialog).toHaveCSS("transform", /matrix\(0, 1, -1, 0,/);
      const bounds = (await dialog.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(size.width);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(size.height);
      const close = dialog.locator(".overlay-close");
      await close.focus();
      await page.keyboard.press("Tab");
      await expect(
        dialog.locator(".language-switch button").first(),
      ).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(close).toBeFocused();
      await dialog.locator(".overlay-body").evaluate((element) => {
        element.scrollTop = element.scrollHeight;
      });
      await expect(dialog.locator(".settings-footer")).toBeVisible();
      await close.tap();
      await expect(dialog).toHaveCount(0);
      await expect(more).toBeFocused();

      await page.locator(".play-controls button").nth(2).tap();
      await expect(dialog).toBeVisible();
      await page.setViewportSize({ width: size.height, height: size.width });
      await expect(page.locator(".phone-portrait")).toHaveCount(0);
      await expect(dialog).toHaveCSS("transform", /matrix\(1, 0, 0, 1,/);
      await dialog.locator(".overlay-close").tap();
      await expect(dialog).toHaveCount(0);
    });
  }
}
