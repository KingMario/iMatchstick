import { expect, test, type Page } from "@playwright/test";

import { academyLessons, getAcademySolution } from "../../lib/academy";

const settingsKey = "imatchstick-pwa-settings";
const statsKey = "imatchstick-pwa-stats";
const originalStats = { solved: 12, streak: 3, bypassed: 4 };

async function returningVisitor(
  page: Page,
  language: "zh" | "en" = "en",
  timerEnabled = false,
) {
  await page.addInitScript(
    ({ settingsKey, statsKey, language, timerEnabled, originalStats }) => {
      localStorage.setItem(
        settingsKey,
        JSON.stringify({
          language,
          difficulty: "level0",
          timerEnabled,
          soundEnabled: false,
          dragHand: "right",
        }),
      );
      localStorage.setItem(statsKey, JSON.stringify(originalStats));
    },
    { settingsKey, statsKey, language, timerEnabled, originalStats },
  );
}

async function openAcademy(page: Page, language: "zh" | "en" = "en") {
  await page
    .getByRole("button", {
      name: language === "zh" ? "设置" : "Settings",
      exact: true,
    })
    .click();
  await page.getByTestId("academy-open").click();
  await expect(page.getByTestId("academy")).toBeVisible();
}

// Browser execution is deliberately separate from discovery. These tests require
// an authorized Playwright browser and a running app; they are not source checks.
test("first visit offers lessons and skip persists across reload", async ({
  page,
}) => {
  await page.goto("/?puzzle=7-5%3D3");
  await expect(page.getByTestId("academy-welcome")).toBeVisible();
  await page.getByTestId("academy-skip").click();
  await expect(page.getByTestId("academy-welcome")).toHaveCount(0);
  await expect(page.locator(".equation")).toHaveAttribute(
    "aria-label",
    "7-5=3",
  );
  await page.reload();
  await expect(page.locator(".launch-screen")).toHaveCount(0);
  await expect(page.getByTestId("academy-welcome")).toHaveCount(0);
});

test("first visit can begin and exit without changing the puzzle", async ({
  page,
}) => {
  await page.goto("/?puzzle=7-5%3D3");
  await page.getByTestId("academy-begin").click();
  await expect(page.getByTestId("academy")).toBeVisible();
  await page.getByTestId("academy-exit").click();
  await expect(page.getByTestId("academy")).toHaveCount(0);
  await expect(page.locator(".equation")).toHaveAttribute(
    "aria-label",
    "7-5=3",
  );
});

for (const language of ["zh", "en"] as const) {
  test(`existing visitor can reopen academy from settings (${language})`, async ({
    page,
  }) => {
    await returningVisitor(page, language);
    await page.goto("/?puzzle=7-5%3D3");
    await expect(page.locator(".equation")).toBeVisible();
    await expect(page.getByTestId("academy-welcome")).toHaveCount(0);
    await openAcademy(page, language);
    await expect(page.getByTestId("academy")).toContainText(
      language === "zh" ? "火柴" : /matchstick/i,
    );
    await page.getByTestId("academy-exit").click();
    await expect(page.locator(".equation")).toHaveAttribute(
      "aria-label",
      "7-5=3",
    );
    expect(
      await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!),
        statsKey,
      ),
    ).toEqual(originalStats);
  });
}

test("academy pauses the live timer and preserves puzzle and statistics", async ({
  page,
}) => {
  await returningVisitor(page, "en", true);
  await page.clock.install();
  await page.goto("/?puzzle=7-5%3D3");
  await expect(page.locator(".status-timer")).toHaveText(/\d+s/);
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  const timer = await page.locator(".status-timer").textContent();
  await openAcademy(page);
  await page.clock.runFor(5000);
  await page.getByTestId("academy-exit").click();
  await expect(page.locator(".status-timer")).toHaveText(timer!);
  await expect(page.locator(".equation")).toHaveAttribute(
    "aria-label",
    "7-5=3",
  );
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!),
      statsKey,
    ),
  ).toEqual(originalStats);
  await page.clock.runFor(1100);
  await expect(page.locator(".status-timer")).not.toHaveText(timer!);
});

test("denied browser storage still allows onboarding and returning to play", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    for (const method of ["getItem", "setItem", "removeItem"] as const) {
      Object.defineProperty(Storage.prototype, method, {
        configurable: true,
        value() {
          throw new DOMException("Storage denied", "SecurityError");
        },
      });
    }
  });
  await page.goto("/?puzzle=7-5%3D3");
  await page.getByTestId("academy-begin").click();
  await expect(page.getByTestId("academy")).toBeVisible();
  await page.getByTestId("academy-exit").click();
  await expect(page.locator(".equation")).toHaveAttribute(
    "aria-label",
    "7-5=3",
  );
  expect(errors).toEqual([]);
});

test("corrupt academy progress is recovered without losing competitive data", async ({
  page,
}) => {
  await returningVisitor(page);
  await page.addInitScript(() =>
    localStorage.setItem("imatchstick-academy-v1", "{broken"),
  );
  await page.goto("/?puzzle=7-5%3D3");
  await openAcademy(page);
  await expect(page.getByTestId("academy")).toBeVisible();
  await page.getByTestId("academy-exit").click();
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!),
      statsKey,
    ),
  ).toEqual(originalStats);
});

async function enterLesson(page: Page, id: string) {
  await page.locator(`[data-lesson-id="${id}"]`).click();
  await expect(page.getByTestId("academy-lesson")).toBeVisible();
}

function slot(page: Page, point: { position: number; segment: number }) {
  return page
    .getByTestId("academy-board")
    .locator(
      `[data-position="${point.position}"][data-segment="${point.segment}"]`,
    );
}

for (const lesson of academyLessons) {
  test(`authored lesson ${lesson.id} completes by tap (${lesson.mode})`, async ({
    page,
  }) => {
    await returningVisitor(page);
    await page.goto("/?puzzle=7-5%3D3");
    await openAcademy(page);
    await enterLesson(page, lesson.id);
    if (lesson.mode === "recognition") {
      const wrong = lesson.choices!.find(
        (choice) => choice !== lesson.target[0],
      )!;
      await page.locator(`[data-choice="${wrong}"]`).click();
      await expect(page.getByTestId("academy-success")).toHaveCount(0);
      await page.locator(`[data-choice="${lesson.target[0]}"]`).click();
    } else {
      const solution = getAcademySolution(lesson)!;
      if (solution.from) await slot(page, solution.from).click();
      else await page.getByTestId("academy-reservoir").click();
      if (solution.to) await slot(page, solution.to).click();
      else await page.getByTestId("academy-reservoir").click();
    }
    await expect(page.getByTestId("academy-lesson")).toContainText(
      "You did it!",
    );
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            JSON.parse(localStorage.getItem("imatchstick-academy-v1")!)
              .completedLessonIds as string[],
        ),
      )
      .toContain(lesson.id);
    expect(
      await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!),
        statsKey,
      ),
    ).toEqual(originalStats);
  });
}

test("hint, reset, next, replay and skipped lesson maintain distinct completion", async ({
  page,
}) => {
  await returningVisitor(page);
  await page.goto("/?puzzle=7-5%3D3");
  await openAcademy(page);
  await enterLesson(page, "academy-3-4");
  await page.getByTestId("academy-hint").click();
  await expect(page.getByTestId("academy-lesson")).toContainText(
    "Move the upper-right stick to the middle.",
  );
  const solution = getAcademySolution(
    academyLessons.find((lesson) => lesson.id === "academy-3-4")!,
  )!;
  await slot(page, solution.from!).click();
  await page.getByTestId("academy-reset").click();
  await expect(
    page.getByTestId("academy-board").locator(".selected"),
  ).toHaveCount(0);
  await slot(page, solution.from!).click();
  await slot(page, solution.to!).click();
  await expect(page.getByTestId("academy-lesson")).toContainText("You did it!");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await slot(page, solution.from!).click();
  await slot(page, solution.to!).click();
  await page.getByTestId("academy-next").click();
  await expect(page.getByTestId("academy-lesson")).toContainText(
    "turn 7 and 5 into 1 and 6",
  );
  await page.getByTestId("academy-next").click();
  const ids = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem("imatchstick-academy-v1")!)
        .completedLessonIds as string[],
  );
  expect(ids.filter((id) => id === "academy-3-4")).toHaveLength(1);
  expect(ids).not.toContain("academy-4-1");
});

test("completed puzzle and found answers survive an academy round trip", async ({
  page,
}) => {
  await returningVisitor(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?puzzle=7-5%3D3");
  await page.locator('.equation [data-position="4"][data-segment="3"]').click();
  await page.locator('.equation [data-position="4"][data-segment="5"]').click();
  await expect(page.locator(".equation")).toHaveAttribute(
    "aria-label",
    "7-5=2",
  );
  const stats = await page.evaluate(
    (key) => localStorage.getItem(key),
    statsKey,
  );
  const answers = await page.locator(".answer-progress").textContent();
  await openAcademy(page);
  await enterLesson(page, "academy-1-1");
  await page.locator('[data-choice="1"]').click();
  await page.getByTestId("academy-exit").click();
  await expect(page.locator(".equation")).toHaveAttribute(
    "aria-label",
    "7-5=2",
  );
  await expect(page.locator(".answer-progress")).toHaveText(answers!);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), statsKey),
  ).toBe(stats);
});

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
]) {
  test(`0 to 6 drag rotates its stick and completes (${viewport.width}×${viewport.height})`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await returningVisitor(page);
    await page.goto("/?puzzle=7-5%3D3");
    await openAcademy(page);
    await enterLesson(page, "academy-3-4");
    const solution = getAcademySolution(
      academyLessons.find((lesson) => lesson.id === "academy-3-4")!,
    )!;
    await slot(page, solution.from!).scrollIntoViewIfNeeded();
    const source = await slot(page, solution.from!).boundingBox();
    expect(source).not.toBeNull();
    await page.mouse.move(
      source!.x + source!.width / 2,
      source!.y + source!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      source!.x + source!.width / 2 + 15,
      source!.y + source!.height / 2 + 15,
      { steps: 3 },
    );
    await expect(page.locator(".academy-ghost")).toBeVisible();
    const target = await slot(page, solution.to!).boundingBox();
    expect(target).not.toBeNull();
    await page.mouse.move(
      target!.x + target!.width / 2,
      target!.y + target!.height / 2,
      { steps: 12 },
    );
    await expect(page.locator(".academy-ghost")).toHaveClass(
      viewport.width < viewport.height ? /vertical/ : /horizontal/,
    );
    await page.mouse.up();
    await expect(page.getByTestId("academy-success")).toBeVisible();
    await expect(page.locator(".academy-ghost")).toHaveCount(0);
  });
}

test("unmounting an active drag releases capture and removes its portal", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await returningVisitor(page);
  await page.goto("/?puzzle=7-5%3D3");
  await openAcademy(page);
  await enterLesson(page, "academy-3-4");
  const source = slot(page, { position: 0, segment: 1 });
  await source.scrollIntoViewIfNeeded();
  const bounds = (await source.boundingBox())!;
  await page.mouse.move(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + bounds.width / 2 + 20,
    bounds.y + bounds.height / 2 + 20,
    { steps: 4 },
  );
  await expect(page.locator(".academy-ghost")).toBeVisible();
  // Invoke navigation while capture is active, as a keyboard/assistive action can.
  await page.getByTestId("academy-exit").dispatchEvent("click");
  await expect(page.locator(".academy-ghost")).toHaveCount(0);
  await page.mouse.up();
  await openAcademy(page);
  await enterLesson(page, "academy-1-1");
  await page.locator('[data-choice="1"]').click();
  await expect(page.getByTestId("academy-success")).toBeVisible();
  expect(errors).toEqual([]);
});

test("invalid shape can be undone without progress or score penalty", async ({
  page,
}) => {
  await returningVisitor(page);
  await page.goto("/?puzzle=7-5%3D3");
  await openAcademy(page);
  await enterLesson(page, "academy-3-4");
  await slot(page, { position: 0, segment: 1 }).click();
  await slot(page, { position: 0, segment: 6 }).click();
  await expect(page.locator(".academy-status")).toContainText(
    "does not make a complete digit",
  );
  await expect(page.getByTestId("academy-success")).toHaveCount(0);
  await page.getByTestId("academy-undo").click();
  await expect(page.locator(".academy-status")).not.toHaveClass(/error/);
  await expect(page.getByTestId("academy-undo")).toBeDisabled();
  const solution = getAcademySolution(
    academyLessons.find((lesson) => lesson.id === "academy-3-4")!,
  )!;
  await slot(page, solution.from!).click();
  await slot(page, solution.to!).click();
  await expect(page.getByTestId("academy-success")).toBeVisible();
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!),
      statsKey,
    ),
  ).toEqual(originalStats);
});

for (const language of ["zh", "en"] as const) {
  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 390, height: 844 },
    { width: 568, height: 320 },
  ]) {
    test(`academy overview and equation fit ${language} ${viewport.width}×${viewport.height}`, async ({
      page,
    }) => {
      await page.setViewportSize(viewport);
      await returningVisitor(page, language);
      await page.goto("/?puzzle=7-5%3D3");
      await openAcademy(page, language);
      const academy = page.getByTestId("academy");
      await expect(academy.locator(".academy-chapter")).toHaveCount(6);
      await expect(academy.locator("button[data-lesson-id]")).toHaveCount(24);
      expect(
        await academy.evaluate(
          (element) => element.scrollWidth <= element.clientWidth + 1,
        ),
      ).toBe(true);
      await enterLesson(page, "academy-6-4");
      expect(
        await academy.evaluate(
          (element) => element.scrollWidth <= element.clientWidth + 1,
        ),
      ).toBe(true);
      await page.getByTestId("academy-hint").scrollIntoViewIfNeeded();
      await expect(page.getByTestId("academy-hint")).toBeInViewport();
      await page.getByTestId("academy-next").scrollIntoViewIfNeeded();
      await expect(page.getByTestId("academy-next")).toBeInViewport();
      await page.getByTestId("academy-exit").scrollIntoViewIfNeeded();
      await expect(page.getByTestId("academy-exit")).toBeInViewport();
    });
  }
}

test("keyboard recognition, movement, Escape and replay work without pointer input", async ({
  page,
}) => {
  await returningVisitor(page);
  await page.goto("/?puzzle=7-5%3D3");
  await openAcademy(page);
  await enterLesson(page, "academy-1-1");
  await page.locator('[data-choice="1"]').focus();
  await page.keyboard.press("Space");
  await expect(page.getByTestId("academy-success")).toBeVisible();
  await page.getByTestId("academy-overview").press("Enter");
  await enterLesson(page, "academy-3-4");
  const solution = getAcademySolution(
    academyLessons.find((lesson) => lesson.id === "academy-3-4")!,
  )!;
  const source = slot(page, solution.from!);
  const target = slot(page, solution.to!);
  await source.focus();
  await page.keyboard.press("Enter");
  await expect(source).toHaveClass(/selected/);
  await page.keyboard.press("Escape");
  await expect(source).not.toHaveClass(/selected/);
  await source.press("Space");
  await target.press("Enter");
  await expect(page.getByTestId("academy-success")).toBeVisible();
  await page
    .getByRole("button", { name: "Try again", exact: true })
    .press("Enter");
  await expect(page.getByTestId("academy-success")).toHaveCount(0);
  await source.press("Enter");
  await target.press("Space");
  await expect(page.getByTestId("academy-success")).toBeVisible();
});

for (const lessonId of ["academy-2-1", "academy-2-2"]) {
  test(`reservoir drag completes ${lessonId}`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await returningVisitor(page);
    await page.goto("/?puzzle=7-5%3D3");
    await openAcademy(page);
    await enterLesson(page, lessonId);
    const solution = getAcademySolution(
      academyLessons.find((lesson) => lesson.id === lessonId)!,
    )!;
    const reservoir = page.getByTestId("academy-reservoir");
    const source = solution.from ? slot(page, solution.from) : reservoir;
    const target = solution.to ? slot(page, solution.to) : reservoir;
    await page.locator(".academy-practice").scrollIntoViewIfNeeded();
    const from = (await source.boundingBox())!;
    const to = (await target.boundingBox())!;
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      from.x + from.width / 2 + 18,
      from.y + from.height / 2 + 18,
      { steps: 3 },
    );
    await expect(page.locator(".academy-ghost")).toBeVisible();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
      steps: 12,
    });
    await page.mouse.up();
    await expect(page.getByTestId("academy-success")).toBeVisible();
    await expect(page.locator(".academy-ghost")).toHaveCount(0);
  });
}

test("native pointer cancellation removes the ghost and permits immediate keyboard recovery", async ({
  page,
  context,
}) => {
  await returningVisitor(page);
  await page.goto("/?puzzle=7-5%3D3");
  await openAcademy(page);
  await enterLesson(page, "academy-3-4");
  const solution = getAcademySolution(
    academyLessons.find((lesson) => lesson.id === "academy-3-4")!,
  )!;
  const source = slot(page, solution.from!);
  await source.scrollIntoViewIfNeeded();
  const bounds = (await source.boundingBox())!;
  const x = bounds.x + bounds.width / 2,
    y = bounds.y + bounds.height / 2;
  const cdp = await context.newCDPSession(page);
  try {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: x + 20, y: y + 20 }],
    });
    await expect(page.locator(".academy-ghost")).toBeVisible();
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchCancel",
      touchPoints: [],
    });
    await expect(page.locator(".academy-ghost")).toHaveCount(0);
    await expect(source).not.toHaveClass(/selected/);
    await expect(page.getByTestId("academy-success")).toHaveCount(0);
    await source.press("Enter");
    await expect(source).toHaveClass(/selected/);
    await slot(page, solution.to!).press("Enter");
    await expect(page.getByTestId("academy-success")).toBeVisible();
  } finally {
    await cdp.detach();
  }
});

test("portrait academy scrolls natively along its rotated surface", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await returningVisitor(page);
  await page.goto("/?puzzle=7-5%3D3");
  await openAcademy(page);
  const academy = page.getByTestId("academy");
  await expect(page.locator(".phone-portrait")).toBeVisible();
  expect(
    await academy.evaluate(
      (element) => element.scrollHeight > element.clientHeight,
    ),
  ).toBe(true);
  const bounds = (await academy.boundingBox())!;
  const start = await academy.evaluate((element) => element.scrollTop);
  const cdp = await context.newCDPSession(page);
  try {
    const y = bounds.y + bounds.height / 2;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: bounds.x + 20, y }],
    });
    for (let x = bounds.x + 40; x < bounds.x + bounds.width - 20; x += 20) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y }],
      });
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect
      .poll(() => academy.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(start + 30);
    await expect(page.getByTestId("academy-lesson")).toHaveCount(0);
    await page.getByTestId("academy-exit").click();
    await expect(page.locator(".equation")).toBeVisible();
  } finally {
    await cdp.detach();
  }
});
