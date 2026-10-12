import { expect, test } from "@playwright/test";

for (const [agent, expected] of [
  [
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)",
    "在 Safari 中打开本游戏。",
  ],
  [
    "Mozilla/5.0 (Linux; Android 13)",
    "在 Chrome 或其他支持安装的浏览器中打开本游戏。",
  ],
  [
    "Mozilla/5.0 (Windows NT 10.0)",
    "在浏览器地址栏或菜单中查找“安装应用”或“创建快捷方式”。",
  ],
]) {
  test(`manual installation instructions: ${agent}`, async ({ page }) => {
    await page.addInitScript(
      (agent) =>
        Object.defineProperty(navigator, "userAgent", { value: agent }),
      agent,
    );
    await page.goto("/?puzzle=7-5%3D3");
    await page.getByRole("button", { name: "更多", exact: true }).tap();
    await page.getByRole("button", { name: "创建桌面书签", exact: true }).tap();
    await expect(page.locator(".install-steps li").first()).toHaveText(
      expected,
    );
    await page.getByRole("button", { name: "EN", exact: true }).tap();
    await expect(
      page.getByRole("button", { name: "Add to Home Screen", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".install-steps")).not.toContainText("打开");
    await expect(page.locator(".equation")).toHaveAttribute(
      "aria-label",
      "7-5=3",
    );
  });
}

for (const outcome of [
  "accepted",
  "dismissed",
  "failed",
  "installed",
] as const) {
  test(`native install request: ${outcome}`, async ({ page }) => {
    await page.goto("/?puzzle=7-5%3D3");
    await expect(page.locator(".install-shortcut")).toHaveCount(1);
    const defaultPrevented = await page.evaluate((outcome) => {
      const event = new Event("beforeinstallprompt", { cancelable: true });
      Object.assign(event, {
        prompt: async () => {
          document.documentElement.dataset.installPrompts = String(
            Number(document.documentElement.dataset.installPrompts ?? 0) + 1,
          );
          if (outcome === "failed") throw new Error("test failure");
          if (outcome === "installed")
            window.dispatchEvent(new Event("appinstalled"));
        },
        userChoice: Promise.resolve({
          outcome: outcome === "dismissed" ? "dismissed" : "accepted",
        }),
      });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    }, outcome);
    expect(defaultPrevented).toBe(true);
    expect(
      await page.locator("html").getAttribute("data-install-prompts"),
    ).toBeNull();
    await page.getByRole("button", { name: "更多", exact: true }).tap();
    await page.getByRole("button", { name: "创建桌面书签", exact: true }).tap();
    await expect(page.locator("html")).toHaveAttribute(
      "data-install-prompts",
      "1",
    );
    const feedback = page.locator(".install-shortcut [role=status]");
    if (outcome === "installed") {
      await expect(
        page.getByRole("button", { name: "已添加到桌面", exact: true }),
      ).toBeDisabled();
    } else if (outcome === "accepted") {
      await expect(feedback).toContainText("已确认安装请求");
      await expect(
        page.getByRole("button", { name: "创建桌面书签", exact: true }),
      ).toBeDisabled();
    } else {
      await expect(feedback).toContainText(
        outcome === "dismissed" ? "已取消安装" : "未能打开安装提示",
      );
      await expect(page.locator(".install-steps")).toBeVisible();
      await page
        .getByRole("button", { name: "创建桌面书签", exact: true })
        .tap();
      await expect(page.locator("html")).toHaveAttribute(
        "data-install-prompts",
        "1",
      );
    }
  });
}

test("iOS home-screen launch shows installed state", async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "standalone", { value: true }),
  );
  await page.goto("/?puzzle=7-5%3D3");
  await page.getByRole("button", { name: "更多", exact: true }).tap();
  await expect(
    page.getByRole("button", { name: "已添加到桌面", exact: true }),
  ).toBeDisabled();
});
