import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getMagnifierLocalPoint,
  getMagnifierMatrix,
  getMagnifierPlacement,
  magnifierZoom,
} from "./magnifier";

test("landscape lens follows raw finger x while holding the initial title height", () => {
  const title = Object.freeze({ left: 245, top: 84, width: 90, height: 18 });
  const viewport = { width: 844, height: 390 };
  for (const point of [
    { x: 190, y: 420 },
    { x: 340, y: 20 },
    { x: 760, y: 320 },
  ]) {
    const finger = Object.freeze(point);
    assert.deepEqual(getMagnifierPlacement(title, viewport, finger, false), {
      left: point.x - 60,
      top: 33,
      size: 120,
    });
    assert.deepEqual(getMagnifierLocalPoint(finger, finger), { x: 60, y: 60 });
    assert.deepEqual(
      finger,
      point,
      "placement must not alter drag coordinates",
    );
  }
  assert.deepEqual(title, { left: 245, top: 84, width: 90, height: 18 });
});

test("portrait lens follows raw finger y while holding the rotated title height", () => {
  const title = Object.freeze({ left: 288, top: 245, width: 18, height: 90 });
  const viewport = { width: 390, height: 844 };
  for (const point of [
    { x: 420, y: 190 },
    { x: 20, y: 340 },
    { x: 320, y: 760 },
  ]) {
    assert.deepEqual(getMagnifierPlacement(title, viewport, point, true), {
      left: 237,
      top: point.y - 60,
      size: 120,
    });
  }
});

test("moving only in logical height leaves the lens frame fixed in both orientations", () => {
  const title = { left: 200, top: 140, width: 90, height: 18 };
  const viewport = { width: 844, height: 390 };
  for (const rotated of [false, true]) {
    const initial = getMagnifierPlacement(
      title,
      viewport,
      { x: 300, y: 210 },
      rotated,
    );
    for (const vertical of [-500, 0, 80, 1000]) {
      const point = rotated ? { x: vertical, y: 210 } : { x: 300, y: vertical };
      assert.deepEqual(
        getMagnifierPlacement(title, viewport, point, rotated),
        initial,
      );
    }
  }
});

test("portrait placement is the clockwise rotation of landscape placement", () => {
  const title = { left: 245, top: 14, width: 90, height: 18 };
  const rotatedTitle = { left: 358, top: 245, width: 18, height: 90 };
  for (const point of [
    { x: -20, y: 20 },
    { x: 340, y: 180 },
    { x: 900, y: 370 },
  ]) {
    const landscape = getMagnifierPlacement(
      title,
      { width: 844, height: 390 },
      point,
      false,
    );
    const portrait = getMagnifierPlacement(
      rotatedTitle,
      { width: 390, height: 844 },
      { x: 390 - point.y, y: point.x },
      true,
    );
    assert.equal(portrait.left, 390 - landscape.top - landscape.size);
    assert.equal(portrait.top, landscape.left);
  }
});

test("finger-following lens clamps all physical viewport edges in both orientations", () => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
    { width: 320, height: 568 },
  ]) {
    for (const rotated of [false, true]) {
      for (const x of [-100, viewport.width / 2, viewport.width + 100]) {
        for (const y of [
          -100,
          50,
          viewport.height / 2,
          viewport.height + 100,
        ]) {
          const lens = getMagnifierPlacement(
            { left: x, top: y, width: 0, height: 0 },
            viewport,
            { x, y },
            rotated,
          );
          assert.ok(lens.left >= 8);
          assert.ok(lens.top >= 8);
          assert.ok(lens.left + lens.size <= viewport.width - 8);
          assert.ok(lens.top + lens.size <= viewport.height - 8);
        }
      }
    }
  }
});

test("lens respects visual viewport pan and constrained size", () => {
  for (const rotated of [false, true]) {
    for (const point of [
      { x: -100, y: -100 },
      { x: 1000, y: 1000 },
    ]) {
      const lens = getMagnifierPlacement(
        { left: 110, top: 205, width: 20, height: 10 },
        { width: 180, height: 110, left: 50, top: 200 },
        point,
        rotated,
      );
      assert.equal(lens.size, 94);
      assert.ok(lens.left >= 58);
      assert.ok(lens.top >= 208);
      assert.ok(lens.left + lens.size <= 222);
      assert.ok(lens.top + lens.size <= 302);
    }
  }
});

test("safe-area bounds protect notches and home indicators along both lens axes", () => {
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
    for (const rotated of [false, true]) {
      for (const left of [-100, viewport.width + 100]) {
        for (const top of [-100, viewport.height + 100]) {
          const lens = getMagnifierPlacement(
            { left, top, width: 80, height: 20 },
            viewport,
            { x: left, y: top },
            rotated,
          );
          assert.ok(lens.left >= viewport.safeArea.left + 8);
          assert.ok(lens.top >= viewport.safeArea.top + 8);
          assert.ok(
            lens.left + lens.size <=
              viewport.width - viewport.safeArea.right - 8,
          );
          assert.ok(
            lens.top + lens.size <=
              viewport.height - viewport.safeArea.bottom - 8,
          );
        }
      }
    }
  }
});

test("safe-area clamp retains rotated landscape geometry with asymmetric insets", () => {
  for (const point of [
    { x: -10, y: 200 },
    { x: 400, y: 300 },
    { x: 900, y: 20 },
  ]) {
    const landscape = getMagnifierPlacement(
      { left: 4, top: 14, width: 90, height: 18 },
      { width: 844, height: 390, safeArea: { left: 47, bottom: 21 } },
      point,
      false,
    );
    const portrait = getMagnifierPlacement(
      { left: 358, top: 4, width: 18, height: 90 },
      { width: 390, height: 844, safeArea: { top: 47, left: 21 } },
      { x: 390 - point.y, y: point.x },
      true,
    );
    assert.equal(portrait.left, 390 - landscape.top - landscape.size);
    assert.equal(portrait.top, landscape.left);
  }
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
        for (const rotated of [false, true]) {
          const lens = getMagnifierPlacement(
            anchor,
            { width, height },
            { x: anchor.left, y: anchor.top },
            rotated,
          );
          assert.ok(lens.left >= 0);
          assert.ok(lens.top >= 0);
          assert.ok(lens.size >= 1);
          assert.ok(lens.left + lens.size <= width);
          assert.ok(lens.top + lens.size <= height);
        }
      }
    }
  }
});
