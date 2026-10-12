import { expect, test } from "@playwright/test";

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 320, height: 568 },
  { width: 736, height: 414 },
]) {
  test(`silent success remains visible and celebrations do not change geometry ${viewport.width}`, async ({
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
    await page.goto("/?puzzle=7-5%3D3");
    await expect(page.locator(".equation")).toHaveAttribute(
      "aria-label",
      "7-5=3",
    );
    const before = await page.locator(".equation").boundingBox();
    const equalsBounds = () =>
      page.locator(".equal-char > span").evaluateAll((elements) =>
        elements.map((element) => {
          const { x, y, width, height } = element.getBoundingClientRect();
          return { x, y, width, height };
        }),
      );
    const originalEquals = await equalsBounds();
    await expect(
      page.getByRole("button", { name: "Undo", exact: true }),
    ).toBeDisabled();
    await page.locator('[data-position="4"][data-segment="3"]').tap();
    await page.locator('[data-position="4"][data-segment="5"]').tap();
    await expect(page.locator(".success-title")).toHaveText(
      "✓ All answers found",
    );
    await expect(page.locator(".success-confetti i")).toHaveCount(14);
    await expect(page.locator(".success-destination")).toHaveCount(1);
    expect(await page.locator(".equation").boundingBox()).toEqual(before);
    expect(await equalsBounds()).toEqual(originalEquals);
    await page.waitForTimeout(1600);
    const undo = page.getByRole("button", { name: "Undo", exact: true });
    await expect(undo).toBeVisible();
    await expect(
      page.locator(".play-controls .actions > button").nth(1),
    ).toHaveAttribute("aria-label", "Undo");
    const undoBounds = (await undo.boundingBox())!;
    const board = (await page.locator(".equation").boundingBox())!;
    expect(undoBounds.x).toBeGreaterThanOrEqual(board.x);
    expect(undoBounds.y).toBeGreaterThanOrEqual(board.y);
    expect(undoBounds.x + undoBounds.width).toBeLessThanOrEqual(
      board.x + board.width,
    );
    expect(undoBounds.y + undoBounds.height).toBeLessThanOrEqual(
      board.y + board.height,
    );
    const overlaps = await page
      .locator(
        ".match-segment.visible, .equal-char > span, .difficulty-stepper",
      )
      .evaluateAll(
        (elements, button) =>
          elements.some((element) => {
            const rect = element.getBoundingClientRect();
            return (
              button.x < rect.right &&
              button.x + button.width > rect.left &&
              button.y < rect.bottom &&
              button.y + button.height > rect.top
            );
          }),
        undoBounds,
      );
    expect(overlaps).toBe(false);
    await expect(page.locator(".success-title")).toBeVisible();
    expect(
      await page
        .locator(".success-confetti i")
        .first()
        .evaluate((el) => getComputedStyle(el).opacity),
    ).toBe("0");
    await page.getByRole("button", { name: "Undo", exact: true }).tap();
    await expect(undo).toBeDisabled();
    await expect(page.locator(".answer-progress")).toHaveText("1/1");
    await expect(page.locator(".equation")).toHaveAttribute(
      "aria-label",
      "7-5=3",
    );
    await expect(page.locator(".success-confetti")).toHaveCount(0);
    expect(await equalsBounds()).toEqual(originalEquals);
    await page.locator('[data-position="4"][data-segment="3"]').tap();
    await page.locator('[data-position="4"][data-segment="5"]').tap();
    await expect(page.locator(".success-title")).toHaveText(
      "✓ Correct, already found",
    );
    await expect(
      page.locator(".progress-success, .success-confetti"),
    ).toHaveCount(0);
    expect(await equalsBounds()).toEqual(originalEquals);
    await page.screenshot({
      path: `/tmp/imatchstick-success-${viewport.width}.png`,
    });
    const box = (await page.locator(".equation").boundingBox())!;
    await page.mouse.dblclick(box.x + 8, box.y + 8);
    await expect(page.locator(".equation-solved")).toHaveCount(0);
  });
}

test("reduced motion uses static confirmation without confetti", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?puzzle=7-5%3D3");
  await page.locator('[data-position="4"][data-segment="3"]').tap();
  await page.locator('[data-position="4"][data-segment="5"]').tap();
  await expect(page.locator(".success-confetti")).toBeHidden();
  expect(
    await page
      .locator(".equation")
      .evaluate((el) => getComputedStyle(el, "::before").animationName),
  ).toBe("none");
  expect(
    await page
      .locator(".success-destination")
      .evaluate((el) => getComputedStyle(el).animationName),
  ).toBe("none");
});

test("multiple answers celebrate only once when all answers are found", async ({
  page,
}) => {
  await page.goto("/?puzzle=9-9%3D5");
  await page.locator('[data-position="2"][data-segment="0"]').tap();
  await page.locator('[data-position="4"][data-segment="5"]').tap();
  await expect(page.locator(".success-title")).toHaveText("✓ 正确！");
  await expect(page.locator(".success-confetti")).toHaveCount(0);
  await page.getByRole("button", { name: "复原", exact: true }).tap();
  await page.locator('[data-position="2"][data-segment="0"]').tap();
  await page.locator('[data-position="0"][data-segment="5"]').tap();
  await expect(page.locator(".success-title")).toHaveText(
    "✓ 本题答案已全部找到",
  );
  await expect(page.locator(".success-confetti i")).toHaveCount(14);
  await page.screenshot({ path: "/tmp/imatchstick-success-complete.png" });
});

test("voice answers use the same visual result", async ({ page }) => {
  await page.addInitScript(() => {
    class Recognition {
      onresult:
        ((event: { results: { transcript: string }[][] }) => void) | null =
        null;
      start() {
        this.onresult?.({ results: [[{ transcript: "7-5=2" }]] });
      }
      abort() {}
    }
    Object.defineProperty(window, "SpeechRecognition", { value: Recognition });
  });
  await page.goto("/?puzzle=7-5%3D3");
  await page.getByRole("button", { name: "语音", exact: true }).tap();
  await expect(page.locator(".success-title")).toHaveText(
    "✓ 本题答案已全部找到",
  );
  await expect(page.locator(".success-destination")).toHaveAttribute(
    "data-segment",
    "5",
  );
});

test("drag solutions trigger the same celebration", async ({ page }) => {
  await page.goto("/?puzzle=7-5%3D3");
  await expect(page.locator(".phone-portrait")).toBeVisible();
  const source = (await page
    .locator('[data-position="4"][data-segment="3"]')
    .boundingBox())!;
  const length = Math.max(source.width, source.height);
  await page.mouse.move(
    source.x + source.width / 2,
    source.y + source.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    source.x + source.width / 2 + 12,
    source.y + source.height / 2 + 12,
  );
  const target = page.locator('[data-position="4"][data-segment="5"]');
  await expect(target).toBeVisible();
  const box = (await target.boundingBox())!;
  await page.mouse.move(
    box.x + box.width / 2 - length * 0.5,
    box.y + box.height / 2 + length * 0.5,
  );
  await page.mouse.up();
  await expect(page.locator(".success-title")).toHaveText(
    "✓ 本题答案已全部找到",
  );
});
