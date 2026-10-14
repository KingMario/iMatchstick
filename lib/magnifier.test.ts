import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getMagnifierLocalPoint,
  getMagnifierMatrix,
  getMagnifierPlacement,
  magnifierZoom,
} from "./magnifier";

test("lens is physically above finger and leaves physical drop point unchanged", () => {
  const finger = Object.freeze({ x: 190, y: 420 });
  assert.deepEqual(getMagnifierPlacement(finger, { width: 390, height: 844 }), {
    left: 130,
    top: 274,
    size: 120,
    below: false,
  });
  assert.deepEqual(getMagnifierLocalPoint(finger, finger), { x: 60, y: 60 });
  assert.deepEqual(finger, { x: 190, y: 420 });
});

test("lens clamps all physical viewport edges and flips only when above cannot fit", () => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 320, height: 568 },
  ]) {
    for (const x of [0, viewport.width / 2, viewport.width]) {
      for (const y of [0, 50, viewport.height / 2, viewport.height]) {
        const lens = getMagnifierPlacement({ x, y }, viewport);
        assert.ok(lens.left >= 8);
        assert.ok(lens.top >= 8);
        assert.ok(lens.left + lens.size <= viewport.width - 8);
        assert.ok(lens.top + lens.size <= viewport.height - 8);
        if (y >= lens.size + 26 + 8) assert.equal(lens.below, false);
      }
    }
  }
  assert.equal(
    getMagnifierPlacement({ x: 30, y: 30 }, { width: 390, height: 844 }).below,
    true,
  );
});

test("lens respects visual viewport pan and constrained size", () => {
  const lens = getMagnifierPlacement(
    { x: 120, y: 210 },
    { width: 180, height: 110, left: 50, top: 200 },
  );
  assert.equal(lens.size, 94);
  assert.ok(lens.left >= 58);
  assert.ok(lens.top >= 208);
  assert.ok(lens.left + lens.size <= 222);
  assert.ok(lens.top + lens.size <= 302);
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
      for (const point of [
        { x: -100, y: -100 },
        { x: 1000, y: 1000 },
      ]) {
        const lens = getMagnifierPlacement(point, { width, height });
        assert.ok(lens.left >= 0);
        assert.ok(lens.top >= 0);
        assert.ok(lens.size >= 1);
        assert.ok(lens.left + lens.size <= width);
        assert.ok(lens.top + lens.size <= height);
      }
    }
  }
});
