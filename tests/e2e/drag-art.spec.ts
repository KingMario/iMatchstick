import { expect, test } from "./fixtures";

for (const viewport of [
  { width: 320, height: 568 },
  { width: 736, height: 414 },
]) {
  for (const hand of ["left", "right"]) {
    test(`mouse drag artwork preserves proportions and fits its helper ${viewport.width} ${hand}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await page.addInitScript(
        (dragHand) =>
          localStorage.setItem(
            "imatchstick-pwa-settings",
            JSON.stringify({
              language: "en",
              difficulty: "level0",
              soundEnabled: false,
              timerEnabled: false,
              dragHand,
            }),
          ),
        hand,
      );
      await page.goto("/?puzzle=7-5%3D3");
      const source = page.locator('[data-position="4"][data-segment="3"]');
      await expect(source).toBeEnabled();
      const box = (await source.boundingBox())!;
      const length = Math.max(box.width, box.height);
      {
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        await page.mouse.move(x, y);
        await page.mouse.down();
        const portrait = viewport.width < viewport.height;
        const offsetX = portrait
          ? length * 0.3 * 0.65
          : length * -1.3 * 0.65 * (hand === "left" ? -1 : 1);
        const offsetY = portrait
          ? length * -1.3 * 0.65 * (hand === "left" ? -1 : 1)
          : length * -0.3 * 0.65;
        const freePoint = await page.evaluate(
          ({ offsetX, offsetY, x, y }) => {
            const targets = Array.from(
              document.querySelectorAll(
                ".match-segment.placeholder:not(:disabled)",
              ),
              (node) => node.getBoundingClientRect(),
            );
            for (let py = 40; py < innerHeight - 40; py += 40) {
              for (let px = 40; px < innerWidth - 40; px += 40) {
                const hx = px + offsetX,
                  hy = py + offsetY;
                if (
                  Math.hypot(px - x, py - y) < 20 ||
                  hx < 30 ||
                  hy < 30 ||
                  hx > innerWidth - 30 ||
                  hy > innerHeight - 30
                )
                  continue;
                if (
                  targets.every(
                    (rect) =>
                      hx < rect.left - 40 ||
                      hx > rect.right + 40 ||
                      hy < rect.top - 40 ||
                      hy > rect.bottom + 40,
                  )
                )
                  return { x: px, y: py };
              }
            }
            throw new Error("No verified free-drag point in viewport");
          },
          { offsetX, offsetY, x, y },
        );
        await page.mouse.move(freePoint.x, freePoint.y);
        const ghost = page.locator(".drag-ghost");
        await expect(ghost).toBeVisible();
        await expect(ghost).not.toHaveClass(/snapped/);
        const helper = (await ghost.boundingBox())!;
        expect(helper.width).toBe(Math.max(14, Math.round(length * 0.4)));
        expect(helper.height).toBe(helper.width);
        const art = ghost.locator("svg");
        for (const time of [0, 137.5, 275, 550, 825]) {
          await art.evaluate((element, time) => {
            const animation = element.getAnimations()[0];
            animation.pause();
            animation.currentTime = time;
          }, time);
          const scales = await art.evaluate((element) => {
            const matrix = (element as SVGSVGElement).getScreenCTM()!;
            return {
              x: Math.hypot(matrix.a, matrix.b),
              y: Math.hypot(matrix.c, matrix.d),
            };
          });
          expect(Math.abs(scales.x - scales.y)).toBeLessThan(0.0001);
          const ink = (await ghost.locator(".matchstick-ink").boundingBox())!;
          expect(ink.x).toBeGreaterThanOrEqual(helper.x);
          expect(ink.y).toBeGreaterThanOrEqual(helper.y);
          expect(ink.x + ink.width).toBeLessThanOrEqual(
            helper.x + helper.width,
          );
          expect(ink.y + ink.height).toBeLessThanOrEqual(
            helper.y + helper.height,
          );
        }
        await page.screenshot({
          path: `/tmp/imatchstick-drag-review-${viewport.width}-${hand}.png`,
        });
        await page.emulateMedia({ reducedMotion: "reduce" });
        await expect(art).toHaveCSS("animation-name", "none");
        const target = page.locator('[data-position="4"][data-segment="5"]');
        const destination = (await target.boundingBox())!;
        await page.mouse.move(
          destination.x + destination.width / 2 - offsetX,
          destination.y + destination.height / 2 - offsetY,
        );
        await page.mouse.up();
        await expect(page.locator(".equation")).toHaveAttribute(
          "aria-label",
          "7-5=2",
        );
        await expect(ghost).toHaveCount(0);
      }
    });
  }
}

for (const viewport of [
  { width: 844, height: 390 },
  { width: 390, height: 844 },
]) {
  test(`normal game previews a rotated destination on first motion ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() =>
      localStorage.setItem(
        "imatchstick-pwa-settings",
        JSON.stringify({
          language: "en",
          difficulty: "level0",
          soundEnabled: false,
          timerEnabled: false,
          dragHand: "right",
        }),
      ),
    );
    await page.goto("/?puzzle=0%2B1%3D7");
    const source = page.locator(
      '.equation [data-position="0"][data-segment="2"]',
    );
    const from = (await source.boundingBox())!;
    const length = Math.max(from.width, from.height);
    const rotated = viewport.height > viewport.width;
    const offsetX = length * (rotated ? 0.3 : -1.3) * 0.65;
    const offsetY = length * (rotated ? -1.3 : -0.3) * 0.65;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await expect(page.locator(".drag-ghost")).toHaveCount(0);
    const target = page.locator(
      '.equation [data-position="0"][data-segment="6"]',
    );
    await expect(target).toBeEnabled();
    const to = (await target.boundingBox())!;
    await page.mouse.move(
      to.x + to.width / 2 - offsetX,
      to.y + to.height / 2 - offsetY,
      { steps: 1 },
    );
    const ghost = page.locator(".drag-ghost");
    const expected = rotated ? "vertical" : "horizontal";
    await expect(ghost).toHaveClass(/snapped/);
    await expect(ghost).toHaveClass(new RegExp(`\\b${expected}\\b`));
    await expect(ghost.locator("svg")).toHaveAttribute(
      "viewBox",
      rotated ? "0 0 68 240" : "0 0 240 68",
    );
    await expect(ghost.locator("svg")).toHaveCSS("animation-name", "none");
    const preview = (await ghost.boundingBox())!;
    expect(
      Math.abs(preview.x + preview.width / 2 - to.x - to.width / 2),
    ).toBeLessThan(1);
    expect(
      Math.abs(preview.y + preview.height / 2 - to.y - to.height / 2),
    ).toBeLessThan(1);
    await expect(page.locator(".equation")).toHaveAttribute(
      "aria-label",
      "0+1=7",
    );
    await page.mouse.up();
    await expect(page.locator(".equation")).toHaveAttribute(
      "aria-label",
      "6+1=7",
    );
    await expect(ghost).toHaveCount(0);
  });
}
