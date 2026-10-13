import { expect, test } from "./fixtures";

test("static loading screen is visible before JavaScript executes", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    isMobile: true,
    hasTouch: true,
    viewport: { width: 390, height: 844 },
  });
  try {
    const page = await context.newPage();
    await page.goto(baseURL!);
    await expect(page.locator(".launch-screen")).toBeVisible();
    await expect(page.locator(".launch-copyright")).toHaveText(
      "(c) Copyright Mario Studio 2026-2027",
    );
    expect(
      await page
        .locator(".launch-content")
        .evaluate((el) => getComputedStyle(el).transform),
    ).toMatch(/^matrix\(0, 1, -1, 0,/);
    await expect(page.locator(".launch-screen img")).toHaveAttribute(
      "src",
      "./splash.png",
    );
    expect(
      await page
        .locator(".launch-screen img")
        .evaluate((el) => (el as HTMLImageElement).naturalWidth),
    ).toBe(800);
    await page.screenshot({ path: "/tmp/imatchstick-launch-portrait.png" });
    await page.setViewportSize({ width: 736, height: 414 });
    expect(
      await page
        .locator(".launch-content")
        .evaluate((el) => getComputedStyle(el).transform),
    ).toBe("none");
    await page.screenshot({ path: "/tmp/imatchstick-launch-landscape.png" });
  } finally {
    await context.close();
  }
});

test("loading screen disappears when the game mounts", async ({ page }) => {
  await page.goto("/?puzzle=7-5%3D3");
  await expect(page.locator(".equation")).toBeVisible();
  await expect(page.locator(".launch-screen")).toHaveCount(0);
});

test("installation metadata references the Android PNG artwork", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    "href",
    "./icons/apple-touch-icon.png",
  );
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(
    manifest.icons.every((icon: { purpose: string }) => icon.purpose === "any"),
  ).toBe(true);
  expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual([
    "192x192",
    "512x512",
  ]);
  for (const [path, size] of [
    ["/icons/apple-touch-icon.png", 180],
    ["/icons/icon-192.png", 192],
    ["/icons/icon-512.png", 512],
  ] as const) {
    const response = await request.get(path);
    expect(response.ok()).toBeTruthy();
    const buffer = await response.body();
    expect(buffer.readUInt32BE(16)).toBe(size);
    expect(buffer.readUInt32BE(20)).toBe(size);
  }
});
