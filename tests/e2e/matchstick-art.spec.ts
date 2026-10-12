import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 320, height: 568 },
  { width: 736, height: 414 },
  { width: 1280, height: 800 },
]) {
  test(`sketched sticks leave visible gaps at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/?puzzle=9-9%3D5");
    await page.locator('[data-position="2"][data-segment="0"]').tap();
    await page.locator('[data-position="0"][data-segment="5"]').tap();
    await expect(page.locator(".equation")).toHaveAttribute(
      "aria-label",
      "8-3=5",
    );
    await page.waitForTimeout(300);
    const rects = await page
      .locator(".equation .matchstick-ink")
      .evaluateAll((elements) =>
        elements.map((element) => {
          const { left, right, top, bottom } = element.getBoundingClientRect();
          return { left, right, top, bottom };
        }),
      );
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const gap = Math.max(
          b.left - a.right,
          a.left - b.right,
          b.top - a.bottom,
          a.top - b.bottom,
        );
        expect(gap).toBeGreaterThan(1);
      }
    }
    await page.screenshot({
      path: `/tmp/imatchstick-sketch-c-${viewport.width}.png`,
    });
  });
}

test("match-head directions stay fixed through solving, undo and rotation", async ({
  page,
}) => {
  await page.goto("/?puzzle=7-5%3D3");
  await expect(page.locator(".equation")).toHaveAttribute(
    "aria-label",
    "7-5=3",
  );
  const readDirections = () =>
    page.locator(".equation .matchstick-art").evaluateAll((elements) =>
      Object.fromEntries(
        elements.map((element) => {
          const parent = element.parentElement!;
          return [
            parent.dataset.position === undefined
              ? parent.className
              : `${parent.dataset.position}:${parent.dataset.segment}`,
            element.getAttribute("data-reversed"),
          ];
        }),
      ),
    );
  const before = await readDirections();
  await page.locator('[data-position="4"][data-segment="3"]').tap();
  expect(await readDirections()).toEqual(before);
  await page.locator('[data-position="4"][data-segment="5"]').tap();
  const solved = await readDirections();
  for (const key of Object.keys(before)) {
    if (key in solved) expect(solved[key]).toBe(before[key]);
  }
  await page.setViewportSize({ width: 736, height: 414 });
  expect(await readDirections()).toEqual(solved);
  await page.getByRole("button", { name: "复原", exact: true }).tap();
  expect(await readDirections()).toEqual(before);
  await page.locator('[data-position="4"][data-segment="3"]').tap();
  await page.locator('[data-position="4"][data-segment="5"]').tap();
  expect(await readDirections()).toEqual(solved);
});
