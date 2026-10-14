import { expect, test } from "./fixtures";

for (const language of ["zh", "en"] as const) {
  for (const device of [
    { name: "desktop", width: 1280, height: 800, isMobile: false },
    { name: "mid desktop", width: 768, height: 1024, isMobile: false },
    { name: "narrow desktop", width: 320, height: 568, isMobile: false },
    { name: "landscape phone", width: 568, height: 320, isMobile: true },
    { name: "portrait phone", width: 320, height: 568, isMobile: true },
  ]) {
    test(`grouped settings stay contained: ${language}, ${device.name}`, async ({
      browser,
      baseURL,
    }) => {
      const context = await browser.newContext({
        baseURL,
        viewport: { width: device.width, height: device.height },
        isMobile: device.isMobile,
        hasTouch: device.isMobile,
      });
      try {
        const page = await context.newPage();
        await page.addInitScript((language) => {
          localStorage.setItem(
            "imatchstick-pwa-settings",
            JSON.stringify({
              language,
              difficulty: "level0",
              timerEnabled: false,
              soundEnabled: false,
            }),
          );
        }, language);
        await page.goto("/?puzzle=7-5%3D3");
        await page
          .getByRole("button", {
            name: language === "zh" ? "设置" : "Settings",
            exact: true,
          })
          .click();
        const dialog = page.getByRole("dialog", {
          name: language === "zh" ? "设置" : "Settings",
          exact: true,
        });
        await expect(dialog).toBeVisible();
        const common = dialog.locator(".settings-common");
        await expect(
          common.getByRole("button", { name: "EN", exact: true }),
        ).toBeVisible();
        await expect(
          common.getByRole("checkbox", {
            name: language === "zh" ? "计时" : "Timer",
            exact: true,
          }),
        ).toBeVisible();
        await expect(
          common.getByRole("checkbox", {
            name: language === "zh" ? "音效" : "Sound",
            exact: true,
          }),
        ).toBeVisible();
        await expect(common.getByRole("radiogroup")).toHaveCount(
          device.isMobile ? 1 : 0,
        );
        await expect(
          common.locator(".settings-hand-hint, #hand-preference-hint, p"),
        ).toHaveCount(0);
        await expect(
          common.locator('[aria-describedby="hand-preference-hint"]'),
        ).toHaveCount(0);
        const layout = await common.evaluate((element) => {
          const rows = Array.from(
            element.querySelectorAll<HTMLLabelElement>("label.settings-row"),
          );
          return rows.map((row) => ({
            top: row.offsetTop,
            left: row.offsetLeft,
            height: row.offsetHeight,
            fontSize: Number.parseFloat(getComputedStyle(row).fontSize),
            fits: row.scrollWidth <= row.clientWidth + 1,
          }));
        });
        expect(layout).toHaveLength(2);
        expect(Math.abs(layout[0].top - layout[1].top)).toBeLessThanOrEqual(1);
        expect(layout[0].left).toBeLessThan(layout[1].left);
        for (const row of layout) {
          expect(row.height).toBeGreaterThanOrEqual(52);
          expect(row.fontSize).toBeGreaterThanOrEqual(16);
          expect(row.fits).toBe(true);
        }
        const segments = await common
          .locator(".hand-switch span, .language-switch button")
          .evaluateAll((controls) =>
            controls.map((control) => ({
              width: (control as HTMLElement).offsetWidth,
              height: (control as HTMLElement).offsetHeight,
              fits: control.scrollWidth <= control.clientWidth + 1,
            })),
          );
        for (const segment of segments) {
          expect(segment.width).toBeGreaterThanOrEqual(44);
          expect(segment.height).toBeGreaterThanOrEqual(44);
          expect(segment.fits).toBe(true);
        }
        await expect(dialog.locator("details")).toHaveCount(3);
        await expect(dialog.locator("details[open]")).toHaveCount(0);
        await expect(dialog.locator("summary")).toHaveText(
          language === "zh"
            ? ["玩法说明", "游戏统计", "关于与版本"]
            : ["How to play", "Statistics", "About & version"],
        );
        await expect(dialog.locator(".stats")).toBeHidden();
        await expect(dialog.locator(".install-shortcut")).toBeHidden();
        await expect(dialog.locator(".settings-footer")).toBeHidden();
        // Exercise every panel and verify content never causes horizontal overflow.
        for (const summary of await dialog.locator("summary").all()) {
          await summary.click();
        }
        await expect(dialog.locator("details[open]")).toHaveCount(3);
        expect(
          await dialog
            .locator(".overlay-body")
            .evaluate((body) => body.scrollWidth <= body.clientWidth + 1),
        ).toBe(true);
        if (device.isMobile) {
          // Both phone orientations share the landscape reading width.
          await expect(dialog).toHaveCSS("width", "544px");
        }
        const bounds = (await dialog.boundingBox())!;
        expect(bounds.x).toBeGreaterThanOrEqual(-1);
        expect(bounds.y).toBeGreaterThanOrEqual(-1);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(device.width + 1);
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(device.height + 1);
        await expect(dialog.locator(".overlay-close")).toBeVisible();
        await dialog.locator(".overlay-close").click();
        await expect(dialog).toBeHidden();
      } finally {
        await context.close();
      }
    });
  }
}

test("settings disclosures support keyboard, language changes and reopen without resetting controls", async ({
  page,
}) => {
  await page.goto("/?puzzle=7-5%3D3");
  await page.getByRole("button", { name: "设置", exact: true }).click();
  const dialog = page.locator("dialog[open]");
  const panels = dialog.locator("details");
  const help = panels.nth(0);
  const summary = help.locator("summary");
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(help).toHaveAttribute("open", "");
  await page.keyboard.press("Space");
  await expect(help).not.toHaveAttribute("open");
  await page.keyboard.press("Enter");
  await panels.nth(1).locator("summary").click();
  await expect(panels.nth(1)).toHaveAttribute("open", "");
  await expect(
    dialog.getByRole("button", { name: "清零统计", exact: true }),
  ).toBeVisible();
  await dialog.getByRole("checkbox", { name: "计时", exact: true }).check();
  await dialog.getByRole("checkbox", { name: "音效", exact: true }).check();
  await dialog
    .getByRole("radiogroup", { name: "惯用手", exact: true })
    .getByText("左手", { exact: true })
    .click();
  await dialog.getByRole("button", { name: "EN", exact: true }).click();
  await expect(
    dialog.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
  await expect(dialog.locator("summary")).toHaveText([
    "How to play",
    "Statistics",
    "About & version",
  ]);
  await expect(help).toHaveAttribute("open", "");
  await expect(panels.nth(2)).not.toHaveAttribute("open");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(help).toHaveAttribute("open", "");
  await expect(panels.nth(1)).toHaveAttribute("open", "");
  await expect(panels.nth(2)).not.toHaveAttribute("open");
  await expect(
    dialog.getByRole("checkbox", { name: "Timer", exact: true }),
  ).toBeChecked();
  await expect(
    dialog.getByRole("checkbox", { name: "Sound", exact: true }),
  ).toBeChecked();
  await expect(
    dialog.getByRole("radio", { name: "Left hand", exact: true }),
  ).toBeChecked();
  await expect
    .poll(() =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem("imatchstick-pwa-settings")!),
      ),
    )
    .toMatchObject({
      language: "en",
      timerEnabled: true,
      soundEnabled: true,
      dragHand: "left",
    });
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(dialog.locator("details[open]")).toHaveCount(0);
  await expect(
    dialog.getByRole("checkbox", { name: "Timer", exact: true }),
  ).toBeChecked();
  await expect(
    dialog.getByRole("checkbox", { name: "Sound", exact: true }),
  ).toBeChecked();
  await expect(
    dialog.getByRole("radio", { name: "Left hand", exact: true }),
  ).toBeChecked();
});
