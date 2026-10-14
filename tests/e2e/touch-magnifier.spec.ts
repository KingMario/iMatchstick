import { expect, test, type Page } from "./fixtures";

const views = [
  { width: 844, height: 390 },
  { width: 390, height: 844 },
];
type Mode = "game" | "academy";
async function open(page: Page, mode: Mode, hand = "right") {
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
  await page.goto("/?puzzle=0%2B1%3D7");
  if (mode === "academy") {
    await page.getByRole("button", { name: "Settings", exact: true }).click();
    await page.getByTestId("academy-open").click();
    await page.locator('[data-chapter-id="5"]').click();
    await page.locator('[data-lesson-id="academy-5-2"]').click();
  }
}
function nodes(page: Page, mode: Mode) {
  const board =
    mode === "game"
      ? page.locator(".equation")
      : page.getByTestId("academy-board");
  return {
    board,
    title: page.locator(
      mode === "game" ? ".status-copy" : ".academy-lesson-heading h2",
    ),
    source: board.locator(
      `[data-position="0"][data-segment="${mode === "game" ? 2 : 5}"]`,
    ),
    target: board.locator(
      `[data-position="${mode === "game" ? 0 : 1}"][data-segment="${mode === "game" ? 6 : 1}"]`,
    ),
  };
}

for (const viewport of views)
  for (const hand of ["left", "right"])
    for (const mode of ["game", "academy"] as const) {
      test(`phone touch parks the real board lens at the title and drops at the finger ${mode} ${hand} ${viewport.width}`, async ({
        page,
        context,
      }) => {
        await page.setViewportSize(viewport);
        await open(page, mode, hand);
        const { board, title, source, target } = nodes(page, mode);
        const from = (await source.boundingBox())!;
        const titleBounds = (await title.boundingBox())!;
        const pressedFinger = {
          x: from.x + from.width / 2,
          y: from.y + from.height / 2,
        };
        const cdp = await context.newCDPSession(page);
        try {
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [pressedFinger],
          });
          const lens = page.getByTestId("touch-magnifier");
          await expect(lens).toBeVisible();
          await expect(source.locator(".matchstick-art")).toHaveCSS(
            "visibility",
            "hidden",
          );
          const pressedBounds = (await lens.boundingBox())!;
          // Chromium's un-emulated viewport has zero safe-area insets. Anchor
          // expectations use physical title bounds, including portrait rotation.
          expect(pressedBounds.x).toBeCloseTo(
            Math.max(
              8,
              Math.min(
                titleBounds.x + titleBounds.width / 2 - 60,
                viewport.width - 128,
              ),
            ),
            1,
          );
          expect(pressedBounds.y).toBeCloseTo(
            Math.max(
              8,
              Math.min(
                titleBounds.y + titleBounds.height / 2 - 60,
                viewport.height - 128,
              ),
            ),
            1,
          );
          const scene = lens.locator(".touch-magnifier-scene > *");
          await expect(scene).toHaveCount(1);
          const pressedMatrix = await scene.evaluate((element) =>
            new DOMMatrix(getComputedStyle(element).transform).toJSON(),
          );
          const free = { x: viewport.width / 2, y: viewport.height - 50 };
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [free],
          });
          await expect(lens).toBeVisible();
          await expect(page.locator(".drag-ghost")).toHaveCount(0);
          await expect(lens).toHaveAttribute("aria-hidden", "true");
          await expect(lens).toHaveAttribute("inert", "");
          await expect(lens).toHaveCSS("pointer-events", "none");
          const bounds = (await lens.boundingBox())!;
          // The lens is parked near the visual title from the first press;
          // moving the finger changes the magnified contents, not this position.
          expect(bounds.width).toBe(120);
          expect(bounds.height).toBe(120);
          expect(bounds.x).toBeCloseTo(pressedBounds.x, 1);
          expect(bounds.y).toBeCloseTo(pressedBounds.y, 1);
          await expect(scene).toHaveCount(1);
          await expect
            .poll(async () => scene.locator("svg").count())
            .toBe(await board.locator("svg").count());
          expect(
            await scene
              .locator("[id], [data-position], [data-segment], .match-segment")
              .count(),
          ).toBe(0);
          const matrix = await scene.evaluate((element) =>
            new DOMMatrix(getComputedStyle(element).transform).toJSON(),
          );
          expect(matrix.a * matrix.d - matrix.b * matrix.c).toBeGreaterThan(0); // Never mirrored.
          expect(matrix.e - pressedMatrix.e).toBeCloseTo(
            -(free.x - pressedFinger.x) * 1.6,
            1,
          );
          expect(matrix.f - pressedMatrix.f).toBeCloseTo(
            -(free.y - pressedFinger.y) * 1.6,
            1,
          );
          for (const edge of [
            { x: 2, y: 2 },
            { x: viewport.width - 2, y: viewport.height - 2 },
          ]) {
            await cdp.send("Input.dispatchTouchEvent", {
              type: "touchMove",
              touchPoints: [edge],
            });
            const clamped = (await lens.boundingBox())!;
            expect(clamped.x).toBeCloseTo(pressedBounds.x, 1);
            expect(clamped.y).toBeCloseTo(pressedBounds.y, 1);
            expect(clamped.x).toBeGreaterThanOrEqual(8);
            expect(clamped.y).toBeGreaterThanOrEqual(8);
            expect(clamped.x + clamped.width).toBeLessThanOrEqual(
              viewport.width - 8,
            );
            expect(clamped.y + clamped.height).toBeLessThanOrEqual(
              viewport.height - 8,
            );
          }
          const to = (await target.boundingBox())!;
          const finger = { x: to.x + to.width / 2, y: to.y + to.height / 2 };
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [finger],
          });
          await expect(lens.locator(".touch-magnifier-stick")).toHaveClass(
            /is-snapped/,
          );
          await expect(lens.locator(".touch-magnifier-stick svg")).toHaveCSS(
            "visibility",
            "visible",
          );
          await expect(source.locator(".matchstick-art")).toHaveCSS(
            "visibility",
            "hidden",
          );
          const snappedBounds = (await lens.boundingBox())!;
          expect(snappedBounds.x).toBeCloseTo(pressedBounds.x, 1);
          expect(snappedBounds.y).toBeCloseTo(pressedBounds.y, 1);
          const vertical =
            mode === "academy"
              ? viewport.width > viewport.height
              : viewport.width < viewport.height;
          await expect(
            lens.locator(".touch-magnifier-stick svg"),
          ).toHaveAttribute("viewBox", vertical ? "0 0 68 240" : "0 0 240 68");
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchEnd",
            touchPoints: [],
          });
          await expect(lens).toHaveCount(0);
          await expect(page.locator(".drag-ghost")).toHaveCount(0);
          await expect(
            board.locator(".matchstick-art[style*='hidden']"),
          ).toHaveCount(0);
          if (mode === "game")
            await expect(board).toHaveAttribute("aria-label", "6+1=7");
          else await expect(page.getByTestId("academy-success")).toBeVisible();
        } finally {
          await cdp.detach();
        }
      });
    }

for (const viewport of views)
  for (const mode of ["game", "academy"] as const)
    for (const interruption of ["cancel", "viewport", "panel"] as const) {
      test(`touch lens clears on ${interruption} ${mode} ${viewport.width}`, async ({
        page,
        context,
      }) => {
        await page.setViewportSize(viewport);
        await open(page, mode);
        const { source } = nodes(page, mode);
        const from = (await source.boundingBox())!;
        const cdp = await context.newCDPSession(page);
        try {
          const x = from.x + from.width / 2,
            y = from.y + from.height / 2;
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ x, y }],
          });
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: x + 20, y: y + 20 }],
          });
          await expect(page.getByTestId("touch-magnifier")).toBeVisible();
          if (interruption === "cancel")
            await cdp.send("Input.dispatchTouchEvent", {
              type: "touchCancel",
              touchPoints: [],
            });
          else if (interruption === "viewport")
            await page.setViewportSize({
              width: viewport.height,
              height: viewport.width,
            });
          else if (mode === "academy")
            await page.getByTestId("academy-hint").dispatchEvent("click");
          else
            await page
              .getByRole("button", { name: "Settings", exact: true })
              .dispatchEvent("click");
          await expect(page.getByTestId("touch-magnifier")).toHaveCount(0);
          await expect(page.locator(".drag-ghost")).toHaveCount(0);
          if (interruption !== "cancel")
            await cdp.send("Input.dispatchTouchEvent", {
              type: "touchCancel",
              touchPoints: [],
            });
          if (interruption === "panel") {
            if (mode === "academy")
              await page.getByTestId("academy-hint-close").click();
            else await page.locator("dialog[open] .overlay-close").click();
          }
          const retry = nodes(page, mode);
          await retry.source.press("Enter");
          await retry.target.press("Enter");
          if (mode === "game")
            await expect(retry.board).toHaveAttribute("aria-label", "6+1=7");
          else await expect(page.getByTestId("academy-success")).toBeVisible();
        } finally {
          await cdp.detach();
        }
      });
    }
