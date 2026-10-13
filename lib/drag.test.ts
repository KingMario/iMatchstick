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
