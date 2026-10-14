import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getMagnifierLocalPoint,
  getMagnifierMatrix,
  getMagnifierPlacement,
  magnifierZoom,
} from "./magnifier";

test("lens stays at the title while sampling and drop points follow the finger", () => {
  const title = Object.freeze({ left: 245, top: 14, width: 90, height: 18 });
  const finger = Object.freeze({ x: 190, y: 420 });
  const viewport = { width: 844, height: 390 };
  const placement = getMagnifierPlacement(title, viewport);
  assert.deepEqual(placement, {
    left: 230,
    top: 8,
    size: 120,
  });
  for (const point of [finger, { x: 10, y: 20 }, { x: 760, y: 320 }]) {
    assert.deepEqual(getMagnifierPlacement(title, viewport), placement);
    assert.deepEqual(getMagnifierLocalPoint(point, point), { x: 60, y: 60 });
  }
  assert.deepEqual(finger, { x: 190, y: 420 });
  assert.deepEqual(title, { left: 245, top: 14, width: 90, height: 18 });
});

test("portrait anchors beside the rotated title, not the physical viewport top", () => {
  const landscape = getMagnifierPlacement(
    { left: 245, top: 14, width: 90, height: 18 },
    { width: 844, height: 390 },
  );
  const portrait = getMagnifierPlacement(
    { left: 358, top: 245, width: 18, height: 90 },
    { width: 390, height: 844 },
  );
  assert.deepEqual(portrait, { left: 262, top: 230, size: 120 });
  assert.equal(portrait.left, 390 - landscape.top - landscape.size);
  assert.equal(portrait.top, landscape.left);
});

test("title-anchored lens clamps all physical viewport edges", () => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 320, height: 568 },
  ]) {
    for (const x of [0, viewport.width / 2, viewport.width]) {
      for (const y of [0, 50, viewport.height / 2, viewport.height]) {
        const lens = getMagnifierPlacement(
          { left: x, top: y, width: 0, height: 0 },
          viewport,
        );
        assert.ok(lens.left >= 8);
        assert.ok(lens.top >= 8);
        assert.ok(lens.left + lens.size <= viewport.width - 8);
        assert.ok(lens.top + lens.size <= viewport.height - 8);
      }
    }
  }
});

test("lens respects visual viewport pan and constrained size", () => {
  const lens = getMagnifierPlacement(
    { left: 110, top: 205, width: 20, height: 10 },
    { width: 180, height: 110, left: 50, top: 200 },
  );
  assert.equal(lens.size, 94);
  assert.ok(lens.left >= 58);
  assert.ok(lens.top >= 208);
  assert.ok(lens.left + lens.size <= 222);
  assert.ok(lens.top + lens.size <= 302);
});

test("safe-area bounds protect notches and home indicators in both orientations", () => {
  for (const viewport of [
    {
      width: 844,
      height: 390,
      safeArea: { left: 47, right: 47, top: 0, bottom: 21 },
    },
    {
      width: 390,
      height: 844,
      safeArea: { left: 0, right: 0, top: 47, bottom: 34 },
    },
  ]) {
    for (const left of [-100, viewport.width + 100]) {
      for (const top of [-100, viewport.height + 100]) {
        const lens = getMagnifierPlacement(
          { left, top, width: 80, height: 20 },
          viewport,
        );
        assert.ok(lens.left >= viewport.safeArea.left + 8);
        assert.ok(lens.top >= viewport.safeArea.top + 8);
        assert.ok(
          lens.left + lens.size <= viewport.width - viewport.safeArea.right - 8,
        );
        assert.ok(
          lens.top + lens.size <=
            viewport.height - viewport.safeArea.bottom - 8,
        );
      }
    }
  }
});

test("safe-area clamp retains rotated landscape geometry with asymmetric insets", () => {
  const landscape = getMagnifierPlacement(
    { left: 4, top: 14, width: 90, height: 18 },
    { width: 844, height: 390, safeArea: { left: 47, bottom: 21 } },
  );
  const portrait = getMagnifierPlacement(
    { left: 358, top: 4, width: 18, height: 90 },
    { width: 390, height: 844, safeArea: { top: 47, left: 21 } },
  );
  assert.equal(portrait.left, 390 - landscape.top - landscape.size);
  assert.equal(portrait.top, landscape.left);
});

test("normal and clockwise board mappings preserve physical geometry without reflection", () => {
  const logical = { width: 300, height: 100 };
  const finger = Object.freeze({ x: 130, y: 220 });
  for (const rotated of [false, true]) {
    const rect = {
      left: 40,
      top: 150,
      width: rotated ? 100 : 300,
      height: rotated ? 300 : 100,
    };
    const [a, b, c, d, e, f] = getMagnifierMatrix(
      rect,
      logical,
      finger,
      rotated,
    );
    assert.ok(a * d - b * c > 0, "matrix must not mirror");
    for (const local of [
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 0, y: 100 },
      { x: 300, y: 100 },
      { x: 50, y: 30 },
    ]) {
      const physical = rotated
        ? { x: rect.left + rect.width - local.y, y: rect.top + local.x }
        : { x: rect.left + local.x, y: rect.top + local.y };
      const expected = getMagnifierLocalPoint(physical, finger);
      assert.ok(Math.abs(a * local.x + c * local.y + e - expected.x) < 1e-9);
      assert.ok(Math.abs(b * local.x + d * local.y + f - expected.y) < 1e-9);
    }
  }
});

test("snap overlay uses physical target orientation/position independently of board rotation", () => {
  const finger = { x: 90, y: 400 };
  const target = { x: 98, y: 380 };
  assert.deepEqual(getMagnifierLocalPoint(target, finger), {
    x: 60 + 8 * magnifierZoom,
    y: 60 - 20 * magnifierZoom,
  });
});

test("tiny viewports retain an in-bounds lens at one and ten pixels", () => {
  for (const width of [1, 10, 390]) {
    for (const height of [1, 10, 844]) {
      for (const anchor of [
        { left: -100, top: -100, width: 50, height: 15 },
        { left: 1000, top: 1000, width: 50, height: 15 },
      ]) {
        const lens = getMagnifierPlacement(anchor, { width, height });
        assert.ok(lens.left >= 0);
        assert.ok(lens.top >= 0);
        assert.ok(lens.size >= 1);
        assert.ok(lens.left + lens.size <= width);
        assert.ok(lens.top + lens.size <= height);
      }
    }
  }
});
