import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import {
  normalizePuzzleDifficulty,
  pickPuzzleFromBook,
  puzzleDifficulties,
} from "./puzzleBook";

describe("generated puzzle book", () => {
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
