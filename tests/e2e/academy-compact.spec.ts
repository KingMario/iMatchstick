import { expect, test, type Page, type Locator } from "@playwright/test";
import {
  academyChapters,
  academyLessons,
  getAcademySolution,
  getAcademyEmptySegments,
  validateAcademyMove,
  type AcademyLesson,
} from "../../lib/academy";

import { academyCopy } from "../../components/matchstick/academyCopy";

type Locale = "zh" | "en";
const viewports = [
  { width: 844, height: 390 },
  { width: 667, height: 375 },
  { width: 390, height: 844 },
  { width: 375, height: 667 },
  { width: 1280, height: 800 },
];

async function launch(page: Page, language: Locale, firstVisit = false) {
  if (!firstVisit)
    await page.addInitScript((language) => {
      localStorage.setItem(
        "imatchstick-pwa-settings",
        JSON.stringify({
          language,
          difficulty: "level0",
          timerEnabled: false,
          soundEnabled: false,
          dragHand: "right",
        }),
      );
    }, language);
  await page.goto(`/?puzzle=7-5%3D3${firstVisit ? `&lang=${language}` : ""}`);
  if (firstVisit)
    await page
      .getByRole("button", {
        name: language === "en" ? "EN" : "中",
        exact: true,
      })
      .click();
  if (!firstVisit) {
    await page
      .getByRole("button", {
        name: language === "en" ? "Settings" : "设置",
        exact: true,
      })
      .click();
    await page.getByTestId("academy-open").click();
  }
}

// These are actual browser geometry checks, not source or mocked layout claims.
// Do not call scrollIntoView: it would hide regressions in the one-screen flow.
async function fits(page: Page, scope: Locator) {
  await expect(scope).toBeVisible();
  const overflow = await scope.evaluate((element) => ({
    x: element.scrollWidth - element.clientWidth,
    y: element.scrollHeight - element.clientHeight,
    left: element.scrollLeft,
    top: element.scrollTop,
  }));
  expect(overflow.x, "unexpected horizontal overflow").toBeLessThanOrEqual(2);
  expect(
    overflow.y,
    "ordinary view must not require scrolling",
  ).toBeLessThanOrEqual(2);
  expect(Math.abs(overflow.left)).toBeLessThanOrEqual(2);
  expect(Math.abs(overflow.top)).toBeLessThanOrEqual(2);
  const viewport = page.viewportSize()!;
  for (const node of await scope
    .locator(
      'button:visible, h1:visible, h2:visible, h3:visible, p:visible, .academy-status:visible, [data-testid="academy-board"]:visible, [data-testid="academy-success"]:visible, [data-testid="academy-assistance"]:visible',
    )
    .all()) {
    const rect = await node.boundingBox();
    expect(rect).not.toBeNull();
    expect(rect!.x).toBeGreaterThanOrEqual(-2);
    expect(rect!.y).toBeGreaterThanOrEqual(-2);
    expect(rect!.x + rect!.width).toBeLessThanOrEqual(viewport.width + 2);
    expect(rect!.y + rect!.height).toBeLessThanOrEqual(viewport.height + 2);
    await expect(node).toBeInViewport({ ratio: 0.99 });
  }
}

async function stickGeometry(page: Page) {
  const board = page.getByTestId("academy-board");
  const horizontal = board
    .locator(
      ".match-char:not(.operator-char):not(.equal-char) .match-segment.horizontal",
    )
    .first();
  const digit = board
    .locator(".match-char:not(.operator-char):not(.equal-char)")
    .first();
  const digitBox = (await digit.boundingBox())!;
  const reference = (await horizontal.count())
    ? await horizontal.boundingBox()
    : null;
  const length = reference
    ? Math.max(reference.width, reference.height)
    : Math.min(digitBox.width, digitBox.height) * 0.72;
  const thickness = reference
    ? Math.min(reference.width, reference.height)
    : (length * 68) / 240;
  for (const bar of await board
    .locator(".operator-char .match-segment, .equal-char > span")
    .all()) {
    const bounds = (await bar.boundingBox())!;
    expect(
      Math.abs(Math.max(bounds.width, bounds.height) - length),
      "operator/equals uses the digit horizontal stick length",
    ).toBeLessThan(1);
    expect(
      Math.abs(Math.min(bounds.width, bounds.height) - thickness),
      "operator/equals uses the digit horizontal stick thickness",
    ).toBeLessThan(1);
    expect(
      Math.max(bounds.width, bounds.height) /
        Math.min(bounds.width, bounds.height),
    ).toBeCloseTo(240 / 68, 1);
  }
  for (const button of await board.locator(".match-segment.visible").all()) {
    const bounds = (await button.boundingBox())!;
    const artwork = (await button.locator("svg").boundingBox())!;
    expect(Math.abs(bounds.width - artwork.width)).toBeLessThan(1);
    expect(Math.abs(bounds.height - artwork.height)).toBeLessThan(1);
  }
  for (const outline of await board
    .locator(".match-segment.placeholder")
    .all()) {
    const bounds = (await outline.boundingBox())!;
    expect(
      Math.max(bounds.width, bounds.height) /
        Math.min(bounds.width, bounds.height),
      "placeholder keeps the artwork aspect ratio",
    ).toBeCloseTo(240 / 68, 1);
  }
}

async function solve(page: Page, lesson: AcademyLesson) {
  if (lesson.mode === "recognition") {
    await page.locator(`[data-choice="${lesson.target[0]}"]`).click();
  } else {
    const solution = getAcademySolution(lesson)!;
    const slot = (point: { position: number; segment: number } | null) =>
      point
        ? page
            .getByTestId("academy-board")
            .locator(
              `[data-position="${point.position}"][data-segment="${point.segment}"]`,
            )
        : page.getByTestId("academy-reservoir");
    await slot(solution.from).click();
    const offered = await page
      .getByTestId("academy-board")
      .locator(".match-segment.placeholder")
      .evaluateAll((nodes) =>
        nodes.map((node) => ({
          position: Number((node as HTMLElement).dataset.position),
          segment: Number((node as HTMLElement).dataset.segment),
        })),
      );
    const legal = getAcademyEmptySegments(lesson.initial).filter((to) =>
      ["success", "wrong-target"].includes(
        validateAcademyMove(lesson, { from: solution.from, to }).reason,
      ),
    );
    expect(offered).toEqual(legal);
    await stickGeometry(page);
    await slot(solution.to).click();
  }
  await expect(page.getByTestId("academy-success")).toBeVisible();
}

for (const language of ["en", "zh"] as const) {
  for (const viewport of viewports) {
    test(`compact all 24 lessons, help, results and navigation ${language} ${viewport.width}×${viewport.height}`, async ({
      page,
    }) => {
      test.setTimeout(180_000);
      await page.setViewportSize(viewport);
      await launch(page, language);
      const academy = page.getByTestId("academy");
      await fits(page, academy);
      await expect(academy.getByTestId("academy-chapter")).toHaveCount(6);
      await expect(academy.locator("[data-lesson-id]")).toHaveCount(0);
      for (const chapter of academyChapters) {
        await academy.locator(`[data-chapter-id="${chapter.id}"]`).click();
        await expect(academy.locator("[data-lesson-id]")).toHaveCount(4);
        await fits(page, academy);
        for (const lesson of academyLessons.filter(
          (item) => item.chapterId === chapter.id,
        )) {
          const link = academy.locator(`[data-lesson-id="${lesson.id}"]`);
          await expect(link).toBeEnabled(); // No progress gating, including chapter six.
          await link.click();
          await expect(page.getByTestId("academy-lesson")).toBeVisible();
          await fits(page, academy);
          await stickGeometry(page);
          await page.getByTestId("academy-hint").click();
          const assistance = page.getByTestId("academy-assistance");
          await expect(assistance).toContainText(lesson.hint[language]);
          await fits(page, academy);
          await page.getByTestId("academy-hint-close").click();
          for (let guidance = 0; guidance < 3; guidance++) {
            await page.getByTestId("academy-hint").click();
            await page
              .locator(".academy-guidance button")
              .nth(guidance)
              .click();
            await expect(assistance).toHaveCount(0);
            await fits(page, academy);
          }
          if (lesson.mode !== "recognition") {
            await page.getByTestId("academy-hint").click();
            await page.getByTestId("academy-demonstrate").click();
            await expect(assistance).toHaveCount(0);
            await fits(page, academy);
          }
          await solve(page, lesson);
          await stickGeometry(page);
          await fits(page, academy);
          await page.getByTestId("academy-reset").click();
          await expect(page.getByTestId("academy-success")).toHaveCount(0);
          await fits(page, academy);
          await page.getByTestId("academy-overview").click();
          await expect(academy.locator("[data-lesson-id]")).toHaveCount(4);
        }
        await page.getByTestId("academy-chapters-back").click();
        await expect(academy.getByTestId("academy-chapter")).toHaveCount(6);
      }
      const ids = await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("imatchstick-academy-v1")!)
            .completedLessonIds as string[],
      );
      expect(new Set(ids)).toEqual(
        new Set(academyLessons.map((lesson) => lesson.id)),
      );
      const completion = academy.locator(".academy-intro");
      await expect(completion).toHaveText(
        `${academyCopy[language].allDone} ${academyCopy[language].allDoneNote}`,
      );
      expect(
        await completion.evaluate(
          (element) =>
            element.scrollHeight <= element.clientHeight + 1 &&
            element.scrollWidth <= element.clientWidth + 1,
        ),
      ).toBe(true);
      await fits(page, academy); // Includes every completion text line and exit action.
    });
  }
}

for (const language of ["en", "zh"] as const)
  for (const viewport of viewports) {
    test(`welcome fits and begins compact overview ${language} ${viewport.width}×${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await launch(page, language, true);
      await fits(page, page.getByTestId("academy-welcome"));
      await page.getByTestId("academy-begin").click();
      await expect(page.getByTestId("academy-chapter")).toHaveCount(6);
      await fits(page, page.getByTestId("academy"));
    });
  }

for (const language of ["en", "zh"] as const) {
  for (const enlargedText of [false, true]) {
    test(`small viewport preserves scroll access ${language} enlargedText=${enlargedText}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 480, height: 240 });
      await launch(page, language);
      if (enlargedText) {
        // Explicit text-only enlargement, rather than compositor pinch zoom,
        // exercises content reflow without pretending to be browser zoom.
        await page.addStyleTag({
          content:
            ".academy { font-size: 24px !important } .academy button, .academy p, .academy h2, .academy h3 { font-size: inherit !important }",
        });
      }
      const academy = page.getByTestId("academy");
      expect(
        await academy.evaluate(
          (element) => getComputedStyle(element).overflowY,
        ),
      ).toMatch(/auto|scroll/);
      const chapter = page.locator('[data-chapter-id="6"]');
      await chapter.scrollIntoViewIfNeeded();
      await expect(chapter).toBeInViewport();
      await chapter.click();
      await page.locator('[data-lesson-id="academy-6-4"]').click();
      await page.getByTestId("academy-hint").click();
      await expect(page.getByTestId("academy-assistance")).toContainText(
        academyLessons.find((lesson) => lesson.id === "academy-6-4")!.hint[
          language
        ],
      );
      await page.getByTestId("academy-demonstrate").scrollIntoViewIfNeeded();
      await expect(page.getByTestId("academy-demonstrate")).toBeInViewport();
      await page.getByTestId("academy-demonstrate").click();
      await page.getByTestId("academy-next").scrollIntoViewIfNeeded();
      await expect(page.getByTestId("academy-next")).toBeInViewport();
      await page.getByTestId("academy-overview").scrollIntoViewIfNeeded();
      await page.getByTestId("academy-overview").click();
      await page.getByTestId("academy-chapters-back").click();
      await page.getByTestId("academy-exit").scrollIntoViewIfNeeded();
      await page.getByTestId("academy-exit").click();
      await expect(page.locator(".equation")).toHaveAttribute(
        "aria-label",
        "7-5=3",
      );
    });
  }
}

for (const language of ["en", "zh"] as const) {
  for (const viewport of viewports) {
    test(`wrong answer feedback fits ${language} ${viewport.width}×${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await launch(page, language);
      await page.locator('[data-chapter-id="1"]').click();
      await page.locator('[data-lesson-id="academy-1-1"]').click();
      await page.locator('[data-choice="4"]').click();
      await expect(page.getByTestId("academy-status")).toHaveClass(/error/);
      await fits(page, page.getByTestId("academy"));
      await page.getByTestId("academy-overview").click();
      await page.getByTestId("academy-chapters-back").click();
      await page.locator('[data-chapter-id="2"]').click();
      await page.locator('[data-lesson-id="academy-2-3"]').click();
      await page.getByTestId("academy-reservoir").click();
      await page
        .getByTestId("academy-board")
        .locator('[data-position="0"][data-segment="2"]')
        .click();
      await expect(page.getByTestId("academy-status")).toHaveClass(/error/);
      await fits(page, page.getByTestId("academy"));
      await page.getByTestId("academy-reset").click();
      await expect(page.getByTestId("academy-status")).not.toHaveClass(/error/);
      await solve(
        page,
        academyLessons.find((lesson) => lesson.id === "academy-2-3")!,
      );
      await fits(page, page.getByTestId("academy"));
    });
  }
}

for (const viewport of viewports) {
  test(`all authored drops preview the destination orientation before release ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize(viewport);
    await launch(page, "en");
    const slot = (point: { position: number; segment: number } | null) =>
      point
        ? page
            .getByTestId("academy-board")
            .locator(
              `[data-position="${point.position}"][data-segment="${point.segment}"]`,
            )
        : page.getByTestId("academy-reservoir");
    for (const lesson of academyLessons.filter(
      (item) => item.mode !== "recognition" && getAcademySolution(item)?.to,
    )) {
      await page.locator(`[data-chapter-id="${lesson.chapterId}"]`).click();
      await page.locator(`[data-lesson-id="${lesson.id}"]`).click();
      const solution = getAcademySolution(lesson)!;
      const source = slot(solution.from);
      const from = (await source.boundingBox())!;
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
      await page.mouse.down();
      await expect(page.locator(".academy-ghost")).toHaveCount(0);
      const target = slot(solution.to);
      const to = (await target.boundingBox())!;
      const logicalHorizontal = /\bhorizontal\b/.test(
        (await target.getAttribute("class"))!,
      );
      const rotated = viewport.height > viewport.width;
      const expected = rotated
        ? logicalHorizontal
          ? "vertical"
          : "horizontal"
        : logicalHorizontal
          ? "horizontal"
          : "vertical";
      // First pointer motion goes straight to the pending source's target.
      await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
        steps: 1,
      });
      const ghost = page.locator(".academy-ghost");
      await expect(ghost).toHaveClass(new RegExp(`\\b${expected}\\b`));
      await expect(page.getByTestId("academy-success")).toHaveCount(0);
      const preview = (await ghost.boundingBox())!;
      expect(
        Math.abs(preview.x + preview.width / 2 - to.x - to.width / 2),
      ).toBeLessThan(1);
      expect(
        Math.abs(preview.y + preview.height / 2 - to.y - to.height / 2),
      ).toBeLessThan(1);
      await stickGeometry(page);
      await page.mouse.up();
      await expect(page.getByTestId("academy-success")).toBeVisible();
      await expect(ghost).toHaveCount(0);
      await page.getByTestId("academy-overview").click();
      await page.getByTestId("academy-chapters-back").click();
    }
  });
}

for (const language of ["en", "zh"] as const) {
  test(`enlarged completion text stays readable with scroll access ${language}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 480, height: 240 });
    await page.addInitScript(
      (ids) =>
        localStorage.setItem(
          "imatchstick-academy-v1",
          JSON.stringify({
            version: 1,
            welcomed: true,
            completedLessonIds: ids,
          }),
        ),
      academyLessons.map((lesson) => lesson.id),
    );
    await launch(page, language);
    await page.addStyleTag({
      content:
        ".academy { font-size: 24px !important } .academy button, .academy p, .academy h1 { font-size: inherit !important }",
    });
    const academy = page.getByTestId("academy");
    const completion = academy.locator(".academy-intro");
    await expect(completion).toHaveText(
      `${academyCopy[language].allDone} ${academyCopy[language].allDoneNote}`,
    );
    expect(
      await completion.evaluate((element) => ({
        clipped:
          element.scrollHeight > element.clientHeight + 1 ||
          element.scrollWidth > element.clientWidth + 1,
        overflow: getComputedStyle(element).overflow,
      })),
    ).toMatchObject({ clipped: false });
    await completion.scrollIntoViewIfNeeded();
    await expect(completion).toBeInViewport();
    await page.locator('[data-chapter-id="6"]').scrollIntoViewIfNeeded();
    await page.locator('[data-chapter-id="6"]').click();
    await expect(page.locator('[data-lesson-id="academy-6-4"]')).toBeEnabled();
    await page.getByTestId("academy-exit").scrollIntoViewIfNeeded();
    await page.getByTestId("academy-exit").click();
    await expect(page.locator(".equation")).toBeVisible();
  });
}
