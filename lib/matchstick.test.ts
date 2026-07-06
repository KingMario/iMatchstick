import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canDropMatchstick,
  createInitialPuzzle,
  createPuzzleFromExpression,
  generatePuzzle,
  getDraggableSegments,
  getDroppableSegments,
  getVisibleSegments,
  isAnswer,
  isValidEquation,
  tryMove,
} from "./matchstick";

describe("matchstick puzzle logic", () => {
  it("validates equations and rejects invalid leading zeroes", () => {
    assert.equal(isValidEquation("7+9=16"), true);
    assert.equal(isValidEquation("9-3=6"), true);
    assert.equal(isValidEquation("9-5=6"), false);
    assert.equal(isValidEquation("01+1=2"), false);
    assert.equal(isValidEquation("1+01=2"), false);
    assert.equal(isValidEquation("1+1=02"), false);
  });

  it("creates a puzzle only when one-stick answers exist", () => {
    const puzzle = createPuzzleFromExpression("9-5=6", "9-3=6");

    assert.ok(puzzle);
    assert.equal(puzzle.expression, "9-5=6");
    assert.equal(puzzle.sourceExpression, "9-3=6");
    assert.equal(isAnswer("9-3=6", puzzle.answers), true);
    assert.equal(isAnswer("9-5=6", puzzle.answers), false);
  });

  it("rejects already-correct and unsolvable shared expressions", () => {
    assert.equal(createPuzzleFromExpression("7+9=16"), null);
    assert.equal(createPuzzleFromExpression("abc"), null);
  });

  it("supports same-digit one-stick movement", () => {
    const moved = tryMove(
      "9-5=6",
      { position: 2, segment: 0 },
      { position: 2, segment: 2 },
    );

    assert.equal(moved, "9-3=6");
  });

  it("distinguishes self moves from external drops", () => {
    assert.equal(
      canDropMatchstick(
        "2+1=3",
        { position: 0, segment: 5 },
        { position: 0, segment: 3 },
      ),
      true,
    );
    assert.equal(
      canDropMatchstick(
        "6+2=8",
        { position: 0, segment: 5 },
        { position: 2, segment: 3 },
      ),
      false,
    );
    assert.equal(
      canDropMatchstick(
        "3+1=4",
        { position: 0, segment: 3 },
        { position: 0, segment: 5 },
      ),
      true,
    );
    assert.equal(
      canDropMatchstick(
        "3+3=6",
        { position: 2, segment: 3 },
        { position: 0, segment: 5 },
      ),
      false,
    );
  });

  it("supports the shared 7+0=16 puzzle answer", () => {
    const puzzle = createPuzzleFromExpression("7+0=16");

    assert.ok(puzzle);
    assert.equal(isAnswer("7+9=16", puzzle.answers), true);
  });

  it("exposes segment metadata used by the renderer", () => {
    assert.deepEqual(getVisibleSegments("1"), [
      false,
      false,
      true,
      true,
      false,
      false,
      false,
    ]);
    assert.deepEqual(getDraggableSegments("9"), [0, 2, 6]);
    assert.deepEqual(getDroppableSegments("2"), []);
    assert.deepEqual(getDroppableSegments("3"), [0]);
    assert.deepEqual(getVisibleSegments("="), []);
  });

  it("generates invalid puzzles with at least one valid answer", () => {
    for (const lowLevel of [true, false]) {
      const puzzle = generatePuzzle(lowLevel);

      assert.equal(isValidEquation(puzzle.expression), false);
      assert.ok(puzzle.answers.length > 0);
      assert.ok(puzzle.answers.every(isValidEquation));
    }
  });

  it("creates the configured initial puzzle", () => {
    const puzzle = createInitialPuzzle();

    assert.equal(puzzle.expression, "9-5=6");
    assert.equal(isAnswer("9-3=6", puzzle.answers), true);
  });
});
