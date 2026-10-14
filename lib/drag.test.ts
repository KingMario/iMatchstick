import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getDragHelperMetrics,
  getDragHelperPoint,
  moveDragToPointer,
} from "./drag";

describe("screen-space drag preview", () => {
  it("places the left-hand preview below-right in portrait and above-right in landscape", () => {
    for (const [orientation, rect] of [
      ["horizontal", { width: 80, height: 22 }],
      ["vertical", { width: 22, height: 80 }],
    ] as const) {
      const portrait = getDragHelperMetrics(
        rect as DOMRect,
        orientation,
        true,
        "left",
      );
      const landscape = getDragHelperMetrics(
        rect as DOMRect,
        orientation,
        false,
        "left",
      );
      assert.equal(portrait.offsetX, -landscape.offsetY);
      assert.equal(portrait.offsetY, landscape.offsetX);
      assert.ok(landscape.offsetX > 0);
      assert.ok(landscape.offsetY < 0);
      for (const metrics of [portrait, landscape]) {
        const pointer = { clientX: 200, clientY: 300 };
        const preview = moveDragToPointer(metrics, pointer, false);
        assert.deepEqual(
          getDragHelperPoint(pointer, metrics.offsetX, metrics.offsetY),
          { x: preview.x, y: preview.y },
        );
      }
    }
  });
  it("places the portrait preview diagonally above and right for either match orientation", () => {
    const horizontal = getDragHelperMetrics(
      { width: 80, height: 22 } as DOMRect,
      "horizontal",
      true,
    );
    const vertical = getDragHelperMetrics(
      { width: 22, height: 80 } as DOMRect,
      "vertical",
      true,
    );
    assert.deepEqual(horizontal, {
      helperSize: 32,
      offsetX: 80 * 0.3 * 0.65,
      offsetY: 80 * -1.3 * 0.65,
    });
    assert.deepEqual(vertical, horizontal);
  });

  it("keeps the landscape helper's Android-derived size and offset", () => {
    const metrics = getDragHelperMetrics(
      { width: 60, height: 17 } as DOMRect,
      "horizontal",
    );
    assert.equal(metrics.helperSize, 24);
    assert.ok(Math.abs(metrics.offsetX + 50.7) < 0.001);
    assert.ok(Math.abs(metrics.offsetY + 11.7) < 0.001);
  });

  it("uses the same offset point for the moving preview and the drop lookup", () => {
    const metrics = getDragHelperMetrics(
      { width: 80, height: 22 } as DOMRect,
      "horizontal",
      true,
    );
    const pointer = { clientX: 200, clientY: 300 };
    const preview = moveDragToPointer(metrics, pointer, false);
    const dropPoint = getDragHelperPoint(
      pointer,
      metrics.offsetX,
      metrics.offsetY,
    );
    assert.deepEqual(dropPoint, {
      x: 200 + 80 * 0.3 * 0.65,
      y: 300 - 80 * 1.3 * 0.65,
    });
    assert.equal(preview.x, dropPoint.x);
    assert.equal(preview.y, dropPoint.y);
  });
});

// DOM stubs intentionally use square hit areas: orientation must come from
// semantic metadata, never from rect.width versus rect.height.
import { resolveDragTarget } from "./drag";
import { canDropMatchstick } from "./matchstick";
import {
  academyLessons,
  getAcademySolution,
  isAcademyMoveAllowed,
} from "./academy";

it("shared resolver gives preview/release the same legal target and orientation before release", () => {
  const original = globalThis.document;
  const element = (
    position: number,
    segment: number,
    orientation: string,
    left = 90,
  ) =>
    ({
      dataset: {
        position: String(position),
        segment: String(segment),
        screenOrientation: orientation,
      },
      getBoundingClientRect: () => ({
        left,
        top: 90,
        right: left + 20,
        bottom: 110,
        width: 20,
        height: 20,
      }),
    }) as unknown as HTMLElement;
  const invalid = element(0, 2, "horizontal");
  const valid = element(0, 5, "vertical", 94);
  globalThis.document = {
    querySelectorAll: () => [invalid, valid],
    elementFromPoint: () => ({ closest: () => invalid }),
  } as unknown as Document;
  try {
    const pointer = { clientX: 100, clientY: 100 };
    const from = { position: 0, segment: 6 };
    const options = {
      isAllowed: (el: HTMLElement) =>
        canDropMatchstick("9-5=6", from, {
          position: Number(el.dataset.position),
          segment: Number(el.dataset.segment),
        }),
    };
    const current = {
      offsetX: 0,
      offsetY: 0,
      orientation: "horizontal" as const,
    };
    const preview = moveDragToPointer(current, pointer, false, true, options);
    const release = resolveDragTarget(pointer, current, options);
    assert.equal(preview.orientation, "vertical");
    assert.equal(preview.snapped, true);
    assert.equal(preview.x, release.target?.x);
    assert.equal(release.target?.element, valid);

    const lesson = academyLessons.find(
      (l) => l.permitted.operation === "self",
    )!;
    const move = getAcademySolution(lesson)!;
    const academyTarget = element(
      move.to!.position,
      move.to!.segment,
      "horizontal",
    );
    globalThis.document = {
      querySelectorAll: () => [academyTarget],
      elementFromPoint: () => ({ closest: () => academyTarget }),
    } as unknown as Document;
    const academyOptions = {
      preferPointerHit: true,
      isAllowed: (el: HTMLElement) =>
        isAcademyMoveAllowed(lesson, {
          from: move.from,
          to: {
            position: Number(el.dataset.position),
            segment: Number(el.dataset.segment),
          },
        }),
    };
    const academyPreview = resolveDragTarget(pointer, current, academyOptions);
    const academyRelease = resolveDragTarget(pointer, current, academyOptions);
    assert.equal(academyPreview.target?.orientation, "horizontal");
    assert.equal(
      academyPreview.target?.element,
      academyRelease.target?.element,
    );
  } finally {
    globalThis.document = original;
  }
});

import { getPointerDragMetrics } from "./drag";

it("phone touch follows the true finger, independent of hand and shell rotation", () => {
  for (const dragHand of ["left", "right"] as const) {
    for (const phonePortrait of [false, true]) {
      const metrics = getPointerDragMetrics(
        { width: 80, height: 22 } as DOMRect,
        "horizontal",
        { dragHand, phonePortrait, isPhone: true, pointerType: "touch" },
      );
      assert.equal(metrics.touchMagnifier, true);
      assert.equal(metrics.offsetX, 0);
      assert.equal(metrics.offsetY, 0);
      const pointer = { clientX: 150, clientY: 250 };
      const moved = moveDragToPointer(metrics, pointer, false);
      assert.equal(moved.x, 150);
      assert.equal(moved.y, 250);
      assert.equal(moved.pointerX, 150);
      assert.equal(moved.pointerY, 250);
    }
  }
});

it("mouse and non-phone touch retain the prior offset helper", () => {
  for (const [isPhone, pointerType] of [
    [true, "mouse"],
    [false, "mouse"],
    [false, "touch"],
  ] as const) {
    const rect = { width: 22, height: 80 } as DOMRect;
    const old = getDragHelperMetrics(rect, "vertical", true, "left");
    const next = getPointerDragMetrics(rect, "vertical", {
      isPhone,
      pointerType,
      phonePortrait: true,
      dragHand: "left",
    });
    assert.deepEqual(next, { ...old, touchMagnifier: false });
  }
});
