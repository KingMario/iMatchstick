import assert from "node:assert/strict";
import { test } from "node:test";
import { createStickDirections } from "./matchstickAppearance";

test("each segment position receives an independent direction", () => {
  let calls = 0;
  const directions = createStickDirections(5, () => (calls++ % 2 ? 0.9 : 0.1));
  assert.equal(calls, 35);
  assert.deepEqual(directions[0], [
    true,
    false,
    true,
    false,
    true,
    false,
    true,
  ]);
  assert.deepEqual(directions[1], [
    false,
    true,
    false,
    true,
    false,
    true,
    false,
  ]);
});

test("new puzzles receive fresh direction arrays", () => {
  const first = createStickDirections(5, () => 0.1);
  const second = createStickDirections(5, () => 0.9);
  assert.ok(first.flat().every(Boolean));
  assert.ok(second.flat().every((value) => !value));
  second[0][0] = true;
  assert.equal(second[1][0], false);
});
