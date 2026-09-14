import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { generatePuzzle } from "./matchstick";
import {
  normalizePuzzleDifficulty,
  pickPuzzleFromBook,
  puzzleDifficulties,
} from "./puzzleBook";

describe("generated puzzle book", () => {
  it("excludes every entry matching the previous expression", async (t) => {
    t.after(() => mock.restoreAll());
    mock.method(
      globalThis,
      "fetch",
      async () => new Response("2+1=4|3+1=4\n2+1=4|3+1=4\n9-5=6|9-3=6\n"),
    );
    mock.method(Math, "random", () => 0);
    const puzzle = await pickPuzzleFromBook("easy", "2+1=4");
    assert.equal(puzzle.expression, "9-5=6");
    assert.ok(puzzle.answers.length > 0);
  });

  it("generates a different puzzle when the pool only contains the previous one", async (t) => {
    t.after(() => mock.restoreAll());
    mock.method(globalThis, "fetch", async () => new Response("9-5=6|9-3=6\n"));
    mock.method(Math, "random", () => 0.6);
    const puzzle = await pickPuzzleFromBook("medium", "9-5=6");
    assert.equal(puzzle.expression, "2+1=4");
    assert.ok(puzzle.answers.length > 0);
  });

  it("excludes the previous puzzle when loading fails", async (t) => {
    t.after(() => mock.restoreAll());
    mock.method(globalThis, "fetch", async () => {
      throw new Error("offline");
    });
    mock.method(Math, "random", () => 0.6);
    const puzzle = await pickPuzzleFromBook("easyPlus", "9-5=6");
    assert.notEqual(puzzle.expression, "9-5=6");
    assert.ok(puzzle.answers.length > 0);
  });

  it("keeps the bounded generator fallback different from either previous fallback", (t) => {
    t.after(() => mock.restoreAll());
    mock.method(Math, "random", () => 0.6);
    for (const previous of ["9-5=6", "2+1=4"]) {
      const puzzle = generatePuzzle(true, previous);
      assert.notEqual(puzzle.expression, previous);
      assert.ok(puzzle.answers.length > 0);
    }
  });
  it("defines the practical difficulty groups in order", () => {
    assert.deepEqual(
      [...puzzleDifficulties],
      [
        "level0",
        "easiest",
        "easy",
        "easyPlus",
        "medium",
        "mediumPlus",
        "hard",
        "hardPlus",
        "expert",
      ],
    );
  });

  it("normalizes stored difficulty settings", () => {
    assert.equal(normalizePuzzleDifficulty("hardPlus"), "hardPlus");
    assert.equal(normalizePuzzleDifficulty("unknown"), "level0");
    assert.equal(normalizePuzzleDifficulty(null), "level0");
  });

  it("hydrates a puzzle from the selected generated pool", async () => {
    mock.method(globalThis, "fetch", async () => {
      return new Response("2+1=4|3+1=4\n");
    });

    const puzzle = await pickPuzzleFromBook("easiest");

    assert.equal(puzzle.expression, "2+1=4");
    assert.deepEqual(puzzle.answers, ["3+1=4"]);
    mock.restoreAll();
  });

  it("falls back to random generation when a pool cannot load", async () => {
    mock.method(globalThis, "fetch", async () => {
      throw new Error("offline");
    });

    const puzzle = await pickPuzzleFromBook("expert");

    assert.ok(puzzle.answers.length > 0);
    mock.restoreAll();
  });
});
