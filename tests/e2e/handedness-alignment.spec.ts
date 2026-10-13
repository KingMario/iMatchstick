import { expect, test, type Page } from "@playwright/test";

type Hand = "left" | "right";
type Language = "zh" | "en";
type Rect = { x: number; y: number; width: number; height: number };

const settingsKey = "imatchstick-pwa-settings";
const puzzles = ["7-5=3", "10-80=100"] as const;
const landscapeSizes = [
  { width: 640, height: 360 },
  { width: 844, height: 390 },
  { width: 932, height: 430 },
];

async function prepare(
  page: Page,
  expression: string,
  language: Language,
  dragHand: Hand = "right",
) {
  await page.addInitScript(
    ({ key, language, dragHand }) => {
      // Keep artwork deterministic across reloads without resetting saved changes.
      Math.random = () => 0.75;
      if (!localStorage.getItem(key)) {
        localStorage.setItem(
          key,
          JSON.stringify({
            language,
            dragHand,
            difficulty: "level0",
            soundEnabled: false,
            timerEnabled: false,
          }),
        );
      }
    },
    { key: settingsKey, language, dragHand },
  );
  await page.goto(`/?puzzle=${encodeURIComponent(expression)}`);
  await ready(page, expression, dragHand);
}

async function ready(page: Page, expression: string, hand: Hand) {
  const equation = page.locator(".equation");
  await expect(equation).toHaveAttribute("aria-label", expression);
  await expect(equation).toHaveAttribute("data-drag-hand", hand);
  await expect(equation.locator(":scope > .match-char")).toHaveCount(
    expression.length,
  );
  await page.evaluate(() => document.fonts.ready);
}

async function measureAlignment(page: Page) {
  return page.locator(".equation").evaluate((equation) => {
    const rect = (element: Element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    };
    const read = () => {
      const style = getComputedStyle(equation);
      const characters = Array.from(
        equation.querySelectorAll(":scope > .match-char"),
        rect,
      );
      const x = Math.min(...characters.map((character) => character.x));
      const y = Math.min(...characters.map((character) => character.y));
      return {
        rotated: Boolean(equation.closest(".phone-portrait")),
        viewport: { width: innerWidth, height: innerHeight },
        board: rect(equation),
        difficulty: rect(document.querySelector(".difficulty-stepper")!),
        controls: rect(document.querySelector(".play-controls")!),
        group: {
          x,
          y,
          width:
            Math.max(
              ...characters.map((character) => character.x + character.width),
            ) - x,
          height:
            Math.max(
              ...characters.map((character) => character.y + character.height),
            ) - y,
        },
        characters,
        segments: Array.from(
          equation.querySelectorAll(".match-segment, .equal-char > span"),
          rect,
        ),
        sticks: Array.from(equation.querySelectorAll(".matchstick-ink"), rect),
        justify: style.justifyContent,
        gap: parseFloat(style.columnGap),
        paddingLeft: parseFloat(style.paddingLeft),
        paddingRight: parseFloat(style.paddingRight),
      };
    };

    const aligned = read();
    const hand = equation.getAttribute("data-drag-hand");
    try {
      // Exercise the original centered layout on the exact same puzzle/viewport.
      equation.removeAttribute("data-drag-hand");
      return { aligned, centered: read() };
    } finally {
      if (hand !== null) equation.setAttribute("data-drag-hand", hand);
    }
  });
}

type Layout = Awaited<ReturnType<typeof measureAlignment>>["aligned"];

function logicalLayout(layout: Layout): Layout {
  if (!layout.rotated) return layout;
  const unrotate = (rect: Rect): Rect => ({
    x: rect.y,
    y: layout.viewport.width - rect.x - rect.width,
    width: rect.height,
    height: rect.width,
  });
  return {
    ...layout,
    board: unrotate(layout.board),
    difficulty: unrotate(layout.difficulty),
    controls: unrotate(layout.controls),
    group: unrotate(layout.group),
    characters: layout.characters.map(unrotate),
    segments: layout.segments.map(unrotate),
    sticks: layout.sticks.map(unrotate),
  };
}

function expectRect(actual: Rect, expected: Rect) {
  for (const key of ["x", "y", "width", "height"] as const) {
    expect(actual[key], `${key} differs`).toBeCloseTo(expected[key], 1);
  }
}

function layoutRects(layout: Layout) {
  return [
    layout.board,
    layout.difficulty,
    layout.controls,
    layout.group,
    ...layout.characters,
    ...layout.segments,
    ...layout.sticks,
  ];
}

function expectSameLayout(actual: Layout, expected: Layout) {
  const actualRects = layoutRects(actual);
  const expectedRects = layoutRects(expected);
  expect(actualRects).toHaveLength(expectedRects.length);
  actualRects.forEach((rect, index) => expectRect(rect, expectedRects[index]));
  expect(actual.gap).toBe(expected.gap);
  expect(actual.paddingLeft).toBe(expected.paddingLeft);
  expect(actual.paddingRight).toBe(expected.paddingRight);
}

async function expectPhoneAlignment(page: Page, hand: Hand) {
  await expect(page.locator(".phone-layout")).toBeVisible();
  const { aligned, centered } = await measureAlignment(page);
  const actual = logicalLayout(aligned);
  const baseline = logicalLayout(centered);
  expect(actual.justify).toBe(hand === "left" ? "flex-end" : "flex-start");
  expect(baseline.justify).toBe("center");
  expect(actual.paddingLeft).toBe(64);
  expect(actual.paddingRight).toBe(64);
  expect(actual.gap).toBe(baseline.gap);
  expectRect(actual.board, baseline.board);
  expectRect(actual.difficulty, baseline.difficulty);
  expectRect(actual.controls, baseline.controls);

  const dx = actual.group.x - baseline.group.x;
  const translated = (rect: Rect) => ({ ...rect, x: rect.x + dx });
  expectRect(actual.group, translated(baseline.group));
  expect(actual.characters).toHaveLength(baseline.characters.length);
  expect(actual.segments).toHaveLength(baseline.segments.length);
  expect(actual.sticks).toHaveLength(baseline.sticks.length);
  expect(actual.sticks.length).toBeGreaterThan(0);
  actual.characters.forEach((rect, index) =>
    expectRect(rect, translated(baseline.characters[index])),
  );
  actual.segments.forEach((rect, index) =>
    expectRect(rect, translated(baseline.segments[index])),
  );
  actual.sticks.forEach((rect, index) =>
    expectRect(rect, translated(baseline.sticks[index])),
  );
  for (let index = 1; index < actual.characters.length; index++) {
    const previous = actual.characters[index - 1];
    expect(
      actual.characters[index].x - previous.x - previous.width,
    ).toBeCloseTo(actual.gap, 1);
  }

  const leftGap =
    actual.group.x - actual.difficulty.x - actual.difficulty.width;
  const rightGap = actual.controls.x - actual.group.x - actual.group.width;
  expect(leftGap).toBeGreaterThanOrEqual(11.95);
  expect(rightGap).toBeGreaterThanOrEqual(11.95);
  if (hand === "left") {
    expect(dx).toBeGreaterThan(1);
    expect(actual.group.x + actual.group.width).toBeCloseTo(
      actual.board.x + actual.board.width - actual.paddingRight,
      1,
    );
    expect(rightGap).toBeCloseTo(12, 1);
  } else {
    expect(dx).toBeLessThan(-1);
    expect(actual.group.x).toBeCloseTo(actual.board.x + actual.paddingLeft, 1);
    expect(leftGap).toBeCloseTo(12, 1);
  }
  for (const rect of [
    ...actual.characters,
    ...actual.segments,
    ...actual.sticks,
  ]) {
    expect(rect.x).toBeGreaterThanOrEqual(actual.board.x + 64 - 0.05);
    expect(rect.x + rect.width).toBeLessThanOrEqual(
      actual.board.x + actual.board.width - 64 + 0.05,
    );
    expect(rect.y).toBeGreaterThanOrEqual(actual.board.y);
    expect(rect.y + rect.height).toBeLessThanOrEqual(
      actual.board.y + actual.board.height,
    );
  }
  await expect(page.locator(".equation")).toHaveAttribute(
    "data-drag-hand",
    hand,
  );
  expect(
    await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
    })),
  ).toEqual(aligned.viewport);
  return aligned;
}

async function selectHand(page: Page, language: Language, hand: Hand) {
  await page
    .getByRole("button", {
      name: language === "zh" ? "更多" : "More",
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog");
  const select = dialog.getByRole("combobox", {
    name: language === "zh" ? "拖拽惯用手" : "Drag hand",
    exact: true,
  });
  await select.selectOption(hand);
  await expect(select).toHaveValue(hand);
  // The board must move while the settings dialog is still open.
  await expectPhoneAlignment(page, hand);
  await expect
    .poll(() =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!).dragHand,
        settingsKey,
      ),
    )
    .toBe(hand);
  await dialog.locator(".overlay-close").click();
  await expect(dialog).toHaveCount(0);
}

test.describe("phone handedness alignment", () => {
  test.use({ isMobile: true, hasTouch: true });

  for (const language of ["zh", "en"] as const) {
    for (const viewport of landscapeSizes) {
      for (const expression of puzzles) {
        test(`live setting, persistence and rotation: ${language} ${viewport.width}x${viewport.height} ${expression}`, async ({
          page,
        }) => {
          await page.setViewportSize(viewport);
          await prepare(page, expression, language);
          await expectPhoneAlignment(page, "right");
          for (const hand of ["left", "right"] as const) {
            await selectHand(page, language, hand);
            await ready(page, expression, hand);
            const beforeReload = await expectPhoneAlignment(page, hand);
            await page.reload();
            await ready(page, expression, hand);
            const landscape = await expectPhoneAlignment(page, hand);
            expectSameLayout(landscape, beforeReload);

            await page.setViewportSize({
              width: viewport.height,
              height: viewport.width,
            });
            await expect(page.locator(".phone-portrait")).toBeVisible();
            const portrait = await expectPhoneAlignment(page, hand);
            // Inverse-transform every glyph and control, not only the outer board.
            expectSameLayout(logicalLayout(portrait), landscape);
            await page.setViewportSize(viewport);
            await expect(page.locator(".phone-portrait")).toHaveCount(0);
            expectSameLayout(await expectPhoneAlignment(page, hand), landscape);
          }
        });
      }
    }
  }

  for (const hand of ["left", "right"] as const) {
    for (const expression of puzzles) {
      test(`safe-area control clearance: ${hand} ${expression}`, async ({
        page,
        context,
      }) => {
        const cdp = await context.newCDPSession(page);
        try {
          for (const { viewport, insets } of [
            {
              viewport: { width: 844, height: 390 },
              insets: { top: 0, bottom: 21, left: 47, right: 47 },
            },
            {
              viewport: { width: 390, height: 844 },
              insets: { top: 47, bottom: 34, left: 0, right: 0 },
            },
          ]) {
            await page.setViewportSize(viewport);
            await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets });
            await prepare(page, expression, "en", hand);
            const layout = await expectPhoneAlignment(page, hand);
            for (const rect of layoutRects(layout)) {
              expect(rect.x).toBeGreaterThanOrEqual(insets.left);
              expect(rect.y).toBeGreaterThanOrEqual(insets.top);
              expect(rect.x + rect.width).toBeLessThanOrEqual(
                viewport.width - insets.right,
              );
              expect(rect.y + rect.height).toBeLessThanOrEqual(
                viewport.height - insets.bottom,
              );
            }
          }
        } finally {
          await cdp.detach();
        }
      });
    }

    for (const portrait of [false, true]) {
      test(`offset touch drop on aligned board: ${hand} ${portrait ? "portrait" : "landscape"}`, async ({
        page,
        context,
      }) => {
        await page.setViewportSize(
          portrait ? { width: 360, height: 640 } : { width: 640, height: 360 },
        );
        await prepare(page, puzzles[0], "en", hand);
        await expectPhoneAlignment(page, hand);
        const source = page.locator('[data-position="4"][data-segment="3"]');
        await expect(source).toBeEnabled();
        const box = (await source.boundingBox())!;
        const length = Math.max(box.width, box.height);
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        const cdp = await context.newCDPSession(page);
        try {
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ x, y }],
          });
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x: x + 12, y: y + 12 }],
          });
          await expect(page.locator(".drag-ghost")).toBeVisible();
          const target = page.locator('[data-position="4"][data-segment="5"]');
          await expect(target).toBeEnabled();
          const destination = (await target.boundingBox())!;
          // Keep the existing screen-space helper offset, including hand mirroring.
          const logicalX = length * -1.3 * 0.65 * (hand === "left" ? -1 : 1);
          const logicalY = length * -0.3 * 0.65;
          const offsetX = portrait ? -logicalY : logicalX;
          const offsetY = portrait ? logicalX : logicalY;
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [
              {
                x: destination.x + destination.width / 2 - offsetX,
                y: destination.y + destination.height / 2 - offsetY,
              },
            ],
          });
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchEnd",
            touchPoints: [],
          });
          await expect(page.locator(".equation")).toHaveAttribute(
            "aria-label",
            "7-5=2",
          );
          await expect(page.locator(".answer-progress")).toHaveText("1/1");
          await expect(page.locator(".drag-ghost")).toHaveCount(0);
          await expect(page.locator(".equation")).toHaveAttribute(
            "data-drag-hand",
            hand,
          );
        } finally {
          await cdp.detach();
        }
      });
    }
  }
});

test.describe("desktop ignores saved phone handedness", () => {
  test.use({ isMobile: false, hasTouch: false });

  for (const language of ["zh", "en"] as const) {
    for (const viewport of [
      { width: 1280, height: 800 },
      { width: 844, height: 390 },
      { width: 390, height: 844 },
    ]) {
      for (const expression of puzzles) {
        test(`centered geometry is unchanged: ${language} ${viewport.width}x${viewport.height} ${expression}`, async ({
          page,
        }) => {
          await page.setViewportSize(viewport);
          await prepare(page, expression, language);
          await expect(page.locator(".phone-layout")).toHaveCount(0);
          const right = await measureAlignment(page);
          expect(right.aligned.justify).toBe("center");
          expectSameLayout(right.aligned, right.centered);

          await page.evaluate((key) => {
            const settings = JSON.parse(localStorage.getItem(key)!);
            localStorage.setItem(
              key,
              JSON.stringify({ ...settings, dragHand: "left" }),
            );
          }, settingsKey);
          await page.reload();
          await ready(page, expression, "left");
          await expect(page.locator(".phone-layout")).toHaveCount(0);
          const left = await measureAlignment(page);
          expect(left.aligned.justify).toBe("center");
          expectSameLayout(left.aligned, left.centered);
          expectSameLayout(left.aligned, right.aligned);
          await page
            .getByRole("button", {
              name: language === "zh" ? "更多" : "More",
              exact: true,
            })
            .click();
          await expect(
            page.getByRole("dialog").getByRole("combobox", {
              name: language === "zh" ? "拖拽惯用手" : "Drag hand",
              exact: true,
            }),
          ).toHaveCount(0);
        });
      }
    }
  }
});
