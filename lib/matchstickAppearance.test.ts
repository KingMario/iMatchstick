import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createStickDirections,
  transferStickDirection,
  chooseStickDirection,
  getDragStickDirection,
} from "./matchstickAppearance";

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

test("moving a match carries both head directions into an oppositely seeded destination", () => {
  for (const reversed of [false, true]) {
    for (const to of [
      { position: 0, segment: 5 },
      { position: 1, segment: 1 },
    ]) {
      const original = createStickDirections(2, () => (reversed ? 0.9 : 0.1));
      original[0][3] = reversed;
      const snapshot = structuredClone(original);
      const result = transferStickDirection(
        original,
        { position: 0, segment: 3 },
        to,
      );
      assert.equal(result[to.position][to.segment], reversed);
      assert.equal(result[0][3], reversed);
      assert.deepEqual(
        original,
        snapshot,
        "source state is not mutated, including same-character moves",
      );
    }
  }
});

// Both quarter turns and candidate stability are deterministic here.

test("axis-preserving moves never consume randomness; turns allow either head direction", () => {
  for (const source of [false, true]) {
    for (const orientation of ["horizontal", "vertical"] as const) {
      assert.equal(
        chooseStickDirection(source, orientation, orientation, () => {
          throw new Error("must not reroll");
        }),
        source,
      );
      const target = orientation === "horizontal" ? "vertical" : "horizontal";
      assert.equal(
        chooseStickDirection(source, orientation, target, () => 0),
        !source,
      );
      assert.equal(
        chooseStickDirection(source, orientation, target, () => 0.99),
        source,
      );
    }
  }
});

test("each drag candidate chooses once, including exit, reentry, and release", () => {
  for (const sourceReversed of [false, true]) {
    let calls = 0;
    const current = {
      sourceReversed,
      originOrientation: "horizontal" as const,
      directionChoices: new Map<string, boolean>(),
    };
    const target = (
      segment: string,
      orientation: "horizontal" | "vertical",
    ) => ({
      element: {
        dataset: { position: "1", segment },
      } as unknown as HTMLElement,
      orientation,
    });
    const random = () => (calls++ % 2 ? 0.99 : 0);
    const a = target("0", "vertical");
    const b = target("3", "vertical");
    assert.equal(getDragStickDirection(current, a, random), !sourceReversed);
    assert.equal(getDragStickDirection(current, a, random), !sourceReversed);
    assert.equal(
      getDragStickDirection(
        { ...current, reversed: !sourceReversed },
        null,
        random,
      ),
      !sourceReversed,
    );
    assert.equal(getDragStickDirection(current, b, random), sourceReversed);
    assert.equal(getDragStickDirection(current, a, random), !sourceReversed);
    assert.equal(
      getDragStickDirection(current, target("1", "horizontal"), random),
      sourceReversed,
    );
    assert.equal(calls, 2);
  }
});
