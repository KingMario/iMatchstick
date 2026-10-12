import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("imatchstick-pwa-settings")) {
      localStorage.setItem(
        "imatchstick-pwa-settings",
        JSON.stringify({
          language: "en",
          difficulty: "level0",
          timerEnabled: true,
          soundEnabled: false,
          dragHand: "right",
        }),
      );
    }
  });
});

test("initial loading locks the placeholder and starts the timer with the real puzzle", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/puzzles/level0.txt", async (route) => {
    await gate;
    await route.fulfill({ body: "2+1=4|3+1=4\n", contentType: "text/plain" });
  });
  await page.clock.install();
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("Loading puzzle…");
  const initialDirections = await page
    .locator(".equation .matchstick-art")
    .evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-reversed")),
    );
  expect(initialDirections.length).toBeGreaterThan(0);
  expect(initialDirections.every((direction) => direction === "false")).toBe(
    true,
  );
  await expect(page.locator(".match-segment:not(:disabled)")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "New", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Voice", exact: true }),
  ).toBeDisabled();
  await page.clock.runFor(5000);
  await expect(page.locator(".status-strip > span").last()).toHaveText("60s");
  release();
  await expect(page.locator(".equation")).toHaveAttribute(
    "aria-label",
    "2+1=4",
  );
  await expect(page.locator(".status-strip > span").first()).toHaveText("0/1");
  await page.locator('[data-position="0"][data-segment="5"]').tap();
  await page.locator('[data-position="0"][data-segment="3"]').tap();
  await expect(page.locator(".equation")).toHaveAttribute(
    "aria-label",
    "3+1=4",
  );
  await expect(page.locator(".status-strip > span").first()).toHaveText("1/1");
});

test("repeated new requests count the current puzzle as skipped only after a single replacement", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requests = 0;
  await page.route("**/puzzles/level0.txt", async (route) => {
    requests++;
    await gate;
    await route.fulfill({ body: "2+1=4|3+1=4\n", contentType: "text/plain" });
  });
  await page.goto("/?puzzle=7-5%3D3");
  await expect(
    page.getByRole("button", { name: "New", exact: true }),
  ).toBeEnabled();
  await page.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>(
      'button[aria-label="New"]',
    )!;
    for (let i = 0; i < 5; i++) button.click();
  });
  await expect(
    page.getByRole("button", { name: "New", exact: true }),
  ).toBeDisabled();
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("imatchstick-pwa-stats")!).bypassed,
    ),
  ).toBe(0);
  release();
  await expect(page.locator(".equation")).toHaveAttribute(
    "aria-label",
    "2+1=4",
  );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("imatchstick-pwa-stats")!).bypassed,
      ),
    )
    .toBe(1);
  expect(requests).toBe(1);
  expect(new URL(page.url()).searchParams.has("puzzle")).toBe(false);
});

test("changing level replaces the shared puzzle without a skip and removes only puzzle parameters", async ({
  page,
}) => {
  await page.route("**/puzzles/easiest.txt", (route) =>
    route.fulfill({ body: "2+1=4|3+1=4\n", contentType: "text/plain" }),
  );
  await page.goto("/?puzzle=7-5%3D3&p=7-5%3D3&demo=1");
  await page.getByRole("button", { name: "Increase difficulty group" }).tap();
  await expect(page.locator(".equation")).toHaveAttribute(
    "aria-label",
    "2+1=4",
  );
  const url = new URL(page.url());
  expect(url.searchParams.has("puzzle")).toBe(false);
  expect(url.searchParams.has("p")).toBe(false);
  expect(url.searchParams.get("demo")).toBe("1");
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("imatchstick-pwa-stats")!).bypassed,
    ),
  ).toBe(0);
  await page.reload();
  await expect(page.locator(".equation")).toHaveAttribute(
    "aria-label",
    "2+1=4",
  );
});

test("restoring a solved puzzle and requesting a new one preserves its solved statistics", async ({
  page,
}) => {
  await page.route("**/puzzles/level0.txt", (route) =>
    route.fulfill({ body: "2+1=4|3+1=4\n", contentType: "text/plain" }),
  );
  await page.goto("/?puzzle=7-5%3D3");
  await page.locator('[data-position="4"][data-segment="3"]').tap();
  await page.locator('[data-position="4"][data-segment="5"]').tap();
  await page.getByRole("button", { name: "Undo", exact: true }).tap();
  await page.getByRole("button", { name: "New", exact: true }).tap();
  await expect(page.locator(".equation")).toHaveAttribute(
    "aria-label",
    "2+1=4",
  );
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("imatchstick-pwa-stats")!),
    ),
  ).toEqual({ solved: 1, streak: 1, bypassed: 0 });
});
