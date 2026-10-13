import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  academyChapters,
  academyLessons,
  getAcademyEmptySegments,
  getAcademyVisibleSegments,
  getAcademySolution,
  validateAcademyMove,
  validateAcademyRecognition,
  type AcademyMovement,
} from "./academy";
import { getVisibleSegments, isValidEquation } from "./matchstick";

const stickCount = (cards: readonly string[]) =>
  cards.reduce(
    (count, char) => count + getVisibleSegments(char).filter(Boolean).length,
    0,
  );

function candidates(cards: string[]): AcademyMovement[] {
  const sources = [null, ...getAcademyVisibleSegments(cards)];
  const targets = [null, ...getAcademyEmptySegments(cards)];
  return sources.flatMap((from) => targets.map((to) => ({ from, to })));
}

describe("authored academy curriculum", () => {
  it("has six ordered bilingual chapters and exactly four unique lessons each", () => {
    assert.deepEqual(
      academyChapters.map((chapter) => chapter.id),
      [1, 2, 3, 4, 5, 6],
    );
    assert.equal(academyLessons.length, 24);
    assert.equal(new Set(academyLessons.map((lesson) => lesson.id)).size, 24);
    for (const chapter of academyChapters) {
      assert.ok(
        chapter.title.zh &&
          chapter.title.en &&
          chapter.description.zh &&
          chapter.description.en,
      );
      const lessons = academyLessons.filter(
        (lesson) => lesson.chapterId === chapter.id,
      );
      assert.equal(lessons.length, 4);
      assert.deepEqual(
        lessons.map((lesson) => lesson.hintLevel),
        [2, 2, 1, 0],
      );
      for (const lesson of lessons) {
        assert.ok(
          lesson.prompt.zh &&
            lesson.prompt.en &&
            lesson.hint.zh &&
            lesson.hint.en,
        );
        assert.equal(lesson.initial.length, lesson.target.length);
        assert.ok(lesson.initial.every((char) => /[0-9+=-]/.test(char)));
      }
    }
  });

  it("teaches 1, 7, 8, then 2, and its choices cover every decimal digit", () => {
    const lessons = academyLessons.filter(
      (lesson) => lesson.mode === "recognition",
    );
    assert.deepEqual(
      lessons.map((lesson) => lesson.initial.join("")),
      ["1", "7", "8", "2"],
    );
    assert.deepEqual(
      [...new Set(lessons.flatMap((lesson) => lesson.choices ?? []))].sort(),
      [..."0123456789"],
    );
    assert.deepEqual(
      lessons.map((lesson) => lesson.choices?.indexOf(lesson.target[0])),
      [1, 0, 2, 1],
    );
    for (const lesson of lessons) {
      assert.equal(getAcademySolution(lesson), null);
      for (const choice of lesson.choices ?? []) {
        assert.equal(
          validateAcademyRecognition(lesson, choice).reason,
          choice === lesson.target[0] ? "success" : "wrong-target",
        );
      }
      assert.equal(
        validateAcademyRecognition(lesson, "+").reason,
        "not-allowed",
      );
      assert.equal(
        validateAcademyMove(lesson, { from: null, to: null }).reason,
        "not-allowed",
      );
    }
  });

  it("keeps card exercises independent and reserves equations for the final chapter", () => {
    for (const lesson of academyLessons) {
      assert.equal(lesson.initial.includes("="), lesson.chapterId === 6);
      assert.equal(lesson.mode === "equation", lesson.chapterId === 6);
      if (lesson.mode === "equation") {
        assert.equal(isValidEquation(lesson.initial.join("")), false);
        assert.equal(isValidEquation(lesson.target.join("")), true);
        assert.ok(
          !lesson.permitted.editablePositions.includes(
            lesson.initial.indexOf("="),
          ),
        );
      }
    }
    assert.deepEqual(
      academyLessons
        .filter((lesson) => lesson.chapterId === 6)
        .map((lesson) => [
          lesson.initial.join(""),
          lesson.target.join(""),
          lesson.permitted.editablePositions,
        ]),
      [
        ["2+1=2", "2+1=3", [4]],
        ["2+1=4", "3+1=4", [0]],
        ["7+5=7", "1+6=7", [0, 2]],
        ["9+5=3", "9-6=3", [1, 2]],
      ],
    );
  });

  for (const lesson of academyLessons.filter(
    (lesson) => lesson.mode !== "recognition",
  )) {
    it(`${lesson.id}: exhaustively checks every source/empty destination and reservoir move`, () => {
      const before = JSON.stringify(lesson);
      const successes: AcademyMovement[] = [];
      for (const move of candidates(lesson.initial)) {
        const result = validateAcademyMove(lesson, move);
        if (result.reason !== "success") continue;
        successes.push(move);
        assert.deepEqual(result.cards, lesson.target);
        const { from, to } = move;
        const delta = stickCount(result.cards) - stickCount(lesson.initial);
        switch (lesson.permitted.operation) {
          case "add":
            assert.equal(from, null);
            assert.ok(to);
            assert.equal(delta, 1);
            break;
          case "remove":
            assert.ok(from);
            assert.equal(to, null);
            assert.equal(delta, -1);
            break;
          case "self":
            assert.ok(from && to);
            assert.equal(from.position, to.position);
            assert.equal(delta, 0);
            break;
          case "cross":
            assert.ok(from && to);
            assert.notEqual(from.position, to.position);
            assert.match(lesson.initial[from.position], /^\d$/);
            assert.match(lesson.initial[to.position], /^\d$/);
            assert.equal(delta, 0);
            break;
          case "symbol":
            assert.ok(from && to);
            assert.notEqual(from.position, to.position);
            assert.equal(
              /[+-]/.test(lesson.initial[from.position]) !==
                /[+-]/.test(lesson.initial[to.position]),
              true,
            );
            assert.equal(delta, 0);
            break;
          default:
            assert.fail("Movement lesson cannot require recognition");
        }
        for (const point of [from, to]) {
          if (point) {
            assert.ok(
              lesson.permitted.editablePositions.includes(point.position),
            );
            assert.notEqual(lesson.initial[point.position], "=");
          }
        }
      }
      assert.equal(
        successes.length,
        1,
        "Each authored task has exactly one legal intended one-stick solution",
      );
      assert.deepEqual(getAcademySolution(lesson), successes[0]);
      assert.equal(
        JSON.stringify(lesson),
        before,
        "Validation and hints must not mutate lesson data",
      );
    });
  }

  it("offers every empty slot, including slots that will form invalid shapes", () => {
    assert.deepEqual(
      getAcademyEmptySegments(["1"]),
      [0, 1, 4, 5, 6].map((segment) => ({ position: 0, segment })),
    );
    assert.equal(getAcademyVisibleSegments(["8"]).length, 7);
    assert.deepEqual(getAcademyEmptySegments(["=", "+", "-"]), [
      { position: 2, segment: 1 },
    ]);
    const add = academyLessons.find((lesson) => lesson.id === "academy-2-1")!;
    assert.equal(
      validateAcademyMove(add, { from: null, to: { position: 0, segment: 0 } })
        .reason,
      "invalid-shape",
    );
  });

  it("gives distinct feedback for valid but wrong targets, invalid shapes, and forbidden moves", () => {
    const self = academyLessons.find((lesson) => lesson.id === "academy-3-3")!;
    // 6 can legally become 0, but this lesson asks for 9.
    const wrong = validateAcademyMove(self, {
      from: { position: 0, segment: 6 },
      to: { position: 0, segment: 2 },
    });
    assert.equal(wrong.reason, "wrong-target");
    assert.deepEqual(wrong.cards, ["0"]);
    assert.equal(
      validateAcademyMove(self, {
        from: { position: 0, segment: 1 },
        to: { position: 0, segment: 2 },
      }).reason,
      "invalid-shape",
    );
    assert.equal(
      validateAcademyMove(self, { from: null, to: { position: 0, segment: 2 } })
        .reason,
      "not-allowed",
    );
    const restricted = academyLessons.find(
      (lesson) => lesson.id === "academy-6-1",
    )!;
    assert.equal(
      validateAcademyMove(restricted, {
        from: { position: 0, segment: 5 },
        to: { position: 0, segment: 3 },
      }).reason,
      "not-allowed",
    );
  });

  it("never allows equals-sign edits even if a caller mistakenly adds its position to permitted positions", () => {
    const source = academyLessons.find((lesson) => lesson.mode === "equation")!;
    const lesson = {
      ...source,
      permitted: { ...source.permitted, editablePositions: [0, 1, 2, 3, 4] },
    };
    for (let segment = 0; segment < 7; segment++) {
      assert.equal(
        validateAcademyMove(lesson, {
          from: { position: 3, segment },
          to: { position: 4, segment: 3 },
        }).reason,
        "not-allowed",
      );
      assert.equal(
        validateAcademyMove(lesson, {
          from: { position: 4, segment: 5 },
          to: { position: 3, segment },
        }).reason,
        "not-allowed",
      );
    }
    assert.ok(
      getAcademyVisibleSegments(lesson.initial).every(
        (point) => point.position !== 3,
      ),
    );
    assert.ok(
      getAcademyEmptySegments(lesson.initial).every(
        (point) => point.position !== 3,
      ),
    );
  });

  it("rejects occupied destinations, absent sources, out-of-bounds and fractional indices without throwing", () => {
    const lesson = academyLessons.find(
      (lesson) => lesson.id === "academy-3-1",
    )!;
    const malformed: AcademyMovement[] = [
      { from: { position: 0, segment: 3 }, to: { position: 0, segment: 0 } },
      { from: { position: 0, segment: 5 }, to: { position: 0, segment: 1 } },
      { from: { position: -1, segment: 5 }, to: { position: 0, segment: 3 } },
      { from: { position: 0, segment: 100 }, to: { position: 0, segment: 3 } },
      { from: { position: 0, segment: 5 }, to: { position: 100, segment: 3 } },
      { from: { position: 0.5, segment: 5 }, to: { position: 0, segment: 3 } },
      { from: { position: 0, segment: 5 }, to: { position: 0, segment: 3.5 } },
      { from: { position: 0, segment: NaN }, to: { position: 0, segment: 3 } },
    ];
    for (const movement of malformed)
      assert.equal(
        validateAcademyMove(lesson, movement).reason,
        "invalid-shape",
      );
  });

  it("enforces card-operation types independently of the desired target", () => {
    const original = academyLessons.find(
      (lesson) => lesson.id === "academy-5-1",
    )!;
    const solution = getAcademySolution(original)!;
    for (const operation of ["self", "cross", "add", "remove"] as const) {
      assert.equal(
        validateAcademyMove(
          { ...original, permitted: { ...original.permitted, operation } },
          solution,
        ).reason,
        "not-allowed",
      );
    }
    const cross = academyLessons.find((lesson) => lesson.id === "academy-4-1")!;
    assert.equal(
      validateAcademyMove(
        { ...cross, permitted: { ...cross.permitted, operation: "symbol" } },
        getAcademySolution(cross)!,
      ).reason,
      "not-allowed",
    );
    assert.equal(validateAcademyRecognition(cross, "7").reason, "not-allowed");
  });
});
