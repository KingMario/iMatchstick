import assert from "node:assert/strict";
import { it } from "node:test";
import {
  canTransferMatchstick,
  getSegmentOrientation,
  getScreenOrientation,
} from "./matchstickSlots";
import { canDropMatchstick, getVisibleSegments } from "./matchstick";
import {
  academyLessons,
  getAcademySolution,
  isAcademyMoveAllowed,
  validateAcademyMove,
} from "./academy";

it("shares semantic digit/operator orientation and clockwise screen rotation", () => {
  for (const char of ["2", "+", "-"]) {
    for (
      let segment = 0;
      segment < getVisibleSegments(char).length;
      segment++
    ) {
      const logical = getSegmentOrientation(char, segment);
      assert.equal(getScreenOrientation(logical, false), logical);
      assert.notEqual(getScreenOrientation(logical, true), logical);
    }
  }
  assert.equal(getSegmentOrientation("=", 0), "horizontal");
  assert.equal(getSegmentOrientation("=", 1), "horizontal");
  assert.equal(getSegmentOrientation("2", 5), "vertical");
  assert.equal(getSegmentOrientation("+", 0), "horizontal");
});

it("guards occupancy, immutable equals and slot bounds before injected legality", () => {
  let checked = 0;
  const test = (
    from: { position: number; segment: number } | null,
    to: { position: number; segment: number } | null,
  ) =>
    canTransferMatchstick({
      cards: ["2", "=", "3"],
      from,
      to,
      getVisibleSegments,
      isLegal: () => {
        checked++;
        return true;
      },
    });
  assert.equal(
    test({ position: 0, segment: 5 }, { position: 0, segment: 3 }),
    true,
  );
  assert.equal(test(null, { position: 0, segment: 3 }), true);
  assert.equal(test({ position: 0, segment: 5 }, null), true);
  for (const point of [
    { position: 1, segment: 0 },
    { position: -1, segment: 0 },
    { position: 0, segment: 7 },
    { position: 0.5, segment: 1 },
    { position: 0, segment: NaN },
  ]) {
    assert.equal(test(point, null), false);
    assert.equal(test(null, point), false);
  }
  assert.equal(test(null, null), false);
  assert.equal(test({ position: 0, segment: 3 }, null), false);
  assert.equal(test(null, { position: 0, segment: 5 }), false);
  assert.equal(checked, 3);
});

it("ordinary game permits legal wrong answers while rejecting malformed slots", () => {
  assert.equal(
    canDropMatchstick(
      "9-5=6",
      { position: 0, segment: 6 },
      { position: 0, segment: 5 },
    ),
    true,
  );
  assert.equal(
    canDropMatchstick(
      "9-5=6",
      { position: 3, segment: 0 },
      { position: 0, segment: 5 },
    ),
    false,
  );
  assert.equal(
    canDropMatchstick(
      "9-5=6",
      { position: 0, segment: 99 },
      { position: 0, segment: 5 },
    ),
    false,
  );
  assert.equal(
    canDropMatchstick(
      "9-5=6",
      { position: 0, segment: 6 },
      { position: 0, segment: 2 },
    ),
    false,
  );
});

it("academy wrapper preserves every authored solution including reservoirs and self moves", () => {
  for (const lesson of academyLessons) {
    const solution = getAcademySolution(lesson);
    if (solution) {
      assert.equal(isAcademyMoveAllowed(lesson, solution), true, lesson.id);
      assert.equal(
        validateAcademyMove(lesson, solution).reason,
        "success",
        lesson.id,
      );
    }
  }
});
