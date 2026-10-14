import { expect, test, type Page } from "./fixtures";
async function emit(
  page: Page,
  method: string,
  data: unknown = null,
  index = -1,
) {
  await page.evaluate(
    ({ method, data, index }) => {
      const instances = (
        window as unknown as {
          voiceInstances: Array<Record<string, (data: unknown) => void>>;
        }
      ).voiceInstances;
      instances.at(index)?.[method](data);
    },
    { method, data, index },
  );
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "imatchstick-pwa-settings",
      JSON.stringify({
        language: "en",
        difficulty: "level0",
        soundEnabled: false,
        timerEnabled: false,
      }),
    );
    const instances: unknown[] = [];
    Object.assign(window, {
      voiceInstances: instances,
      SpeechRecognition: class {
        onresult: ((event: unknown) => void) | null = null;
        onerror: ((event: unknown) => void) | null = null;
        onend: (() => void) | null = null;
        onstart: (() => void) | null = null;
        holdEnd = false;
        hold(value: boolean) {
          this.holdEnd = value;
        }
        savedResult: ((event: unknown) => void) | null = null;
        savedEnd: (() => void) | null = null;
        constructor() {
          instances.push(this);
        }
        start() {
          this.savedResult = this.onresult;
          this.savedEnd = this.onend;
          this.onstart?.();
        }
        abort() {
          this.onend?.();
        }
        result(data: { values: string[]; final: boolean }) {
          this.onresult?.({
            resultIndex: 0,
            results: [
              Object.assign(
                data.values.map((transcript) => ({ transcript })),
                { isFinal: data.final },
              ),
            ],
          });
          if (data.final && !this.holdEnd) setTimeout(() => this.onend?.(), 0);
        }
        late() {
          this.savedResult?.({
            resultIndex: 0,
            results: [
              Object.assign([{ transcript: "7 minus 5 equals 2" }], {
                isFinal: true,
              }),
            ],
          });
          this.savedEnd?.();
        }
        end() {
          this.onend?.();
        }
        error(error: string) {
          this.onerror?.({ error });
        }
      },
    });
  });
  await page.route("**/puzzles/level0.txt", (route) =>
    route.fulfill({ body: "2+1=4|3+1=4\n", contentType: "text/plain" }),
  );
  await page.goto("/?puzzle=7-5%3D3");
  await expect(page.locator(".equation")).toHaveAttribute(
    "aria-label",
    "7-5=3",
  );
});
test("interim captions, correct later alternative, repeated answers and stale callbacks", async ({
  page,
}) => {
  const mic = page.locator(".play-controls button").last();
  await mic.click();
  await emit(page, "result", { values: ["seven minus five"], final: false });
  await expect(page.locator(".voice-caption")).toContainText(
    "seven minus five",
  );
  await expect(page.locator(".equation-solved")).toHaveCount(0);
  await emit(page, "result", {
    values: ["7 minus 5 equals 3", "7 minus 5 equals 2"],
    final: true,
  });
  await expect(page.locator(".equation")).toHaveAttribute(
    "aria-label",
    "7-5=2",
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await mic.click();
  await emit(page, "late", null, 0);
  await expect(mic).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".equation")).toHaveAttribute(
    "aria-label",
    "7-5=3",
  );
  await emit(page, "result", { values: ["7 minus 5 equals 2"], final: true });
  await expect(page.locator(".equation")).toHaveAttribute(
    "aria-label",
    "7-5=2",
  );
  await expect(page.locator(".answer-progress")).toHaveText("1/1");
  await page.getByRole("button", { name: "New", exact: true }).click();
  await expect(page.locator(".equation")).not.toHaveAttribute(
    "aria-label",
    "7-5=2",
  );
  await mic.click();
  await emit(page, "late", null, 1);
  await expect(mic).toHaveAttribute("aria-pressed", "true");
  await emit(page, "result", { values: ["3 plus 1 equals 4"], final: true });
  await expect(page.locator(".equation")).toHaveAttribute(
    "aria-label",
    "3+1=4",
  );
  await expect(mic).toHaveAttribute("aria-pressed", "false");
});
test("permission/error/end/cancel retry does not leave a stuck microphone", async ({
  page,
}) => {
  const mic = page.locator(".play-controls button").last();
  for (const error of [
    "not-allowed",
    "network",
    "audio-capture",
    "no-speech",
  ]) {
    await mic.click();
    await emit(page, "error", error);
    await expect(mic).toHaveAttribute("aria-pressed", "false");
    if (error === "not-allowed")
      await expect(page.locator(".status-copy")).toContainText(
        "Allow microphone access",
      );
  }
  await mic.click();
  await mic.click();
  await expect(page.locator(".voice-caption")).toHaveCount(0);
  await mic.click();
  await emit(page, "late", null, -2);
  await expect(mic).toHaveAttribute("aria-pressed", "true");
  await emit(page, "result", { values: ["7-5=2"], final: true });
  await expect(page.locator(".equation-solved")).toHaveCount(1);
});
for (const viewport of [
  { width: 320, height: 568 },
  { width: 736, height: 414 },
  { width: 1280, height: 800 },
]) {
  test(`captions remain in header without covering equation or controls ${viewport.width}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.locator(".play-controls button").last().click();
    await emit(page, "result", {
      values: ["seven minus five equals two ".repeat(8)],
      final: false,
    });
    const overlaps = await page
      .locator(".voice-caption")
      .evaluate((caption) => {
        const a = caption.getBoundingClientRect();
        return [
          ...document.querySelectorAll(
            ".match-char,.play-controls,.difficulty-stepper,.settings-button",
          ),
        ].some((el) => {
          const b = el.getBoundingClientRect();
          return (
            a.left < b.right &&
            a.right > b.left &&
            a.top < b.bottom &&
            a.bottom > b.top
          );
        });
      });
    expect(overlaps).toBe(false);
    await page.screenshot({ path: `/tmp/voice-caption-${viewport.width}.png` });
  });
}

test("silent end and stalled sessions recover without automatic restarts", async ({
  page,
}) => {
  await page.clock.install();
  const mic = page.locator(".play-controls button").last();
  await mic.click();
  await emit(page, "end");
  await expect(mic).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".voice-caption")).toContainText("Nothing heard");
  await mic.click();
  await page.clock.runFor(30000);
  await expect(mic).toHaveAttribute("aria-pressed", "false");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { voiceInstances: unknown[] }).voiceInstances
            .length,
      ),
    )
    .toBe(2);
  await page.clock.runFor(4000);
  await expect(page.locator(".voice-caption")).toHaveCount(0);
});

test("settings and answers cancel voice before accepting old results", async ({
  page,
}) => {
  const mic = page.locator(".play-controls button").last();
  await mic.click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await emit(page, "late");
  await expect(page.locator(".equation-solved")).toHaveCount(0);
  await expect(page.locator(".voice-caption")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await mic.click();
  await page.getByRole("button", { name: "Answer", exact: true }).click();
  await emit(page, "late");
  await expect(page.locator(".equation-solved")).toHaveCount(0);
  await expect(mic).toHaveAttribute("aria-pressed", "false");
});

test("timer expiration cancels active voice and rejects a late answer", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("checkbox", { name: "Timer" }).check();
  await page.keyboard.press("Escape");
  await page.clock.install();
  await page.clock.runFor(55000);
  const mic = page.locator(".play-controls button").last();
  await mic.click();
  await page.clock.runFor(6000);
  await emit(page, "late");
  await expect(page.locator(".equation-solved")).toHaveCount(0);
  await expect(mic).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".voice-caption")).toHaveCount(0);
});

test("a new question cannot acquire recognition before the prior native end", async ({
  page,
}) => {
  const mic = page.locator(".play-controls button").last();
  await mic.click();
  await emit(page, "hold", true);
  await emit(page, "result", { values: ["7-5=2"], final: true });
  await expect(page.locator(".equation-solved")).toHaveCount(1);
  await page.getByRole("button", { name: "New", exact: true }).click();
  await mic.click();
  await expect(page.locator(".status-copy")).toContainText(
    "Releasing microphone",
  );
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { voiceInstances: unknown[] }).voiceInstances
          .length,
    ),
  ).toBe(1);
  await emit(page, "end", null, 0);
  await mic.click();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { voiceInstances: unknown[] }).voiceInstances
          .length,
    ),
  ).toBe(2);
  await emit(page, "result", { values: ["3+1=4"], final: true });
  await expect(page.locator(".equation")).toHaveAttribute(
    "aria-label",
    "3+1=4",
  );
});
