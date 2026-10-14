import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  Academy,
  AcademyLessonView,
  AcademyChapterLessons,
  shouldSuppressAcademyClick,
} from "./Academy";
import { academyLessons, getAcademySolution } from "../../lib/academy";
import { academyCopy } from "./academyCopy";

const noop = () => {};
const defaults = {
  language: "en" as const,
  phonePortrait: false,
  dragHand: "right" as const,
  completedLessonIds: [],
  onComplete: noop,
  onExit: noop,
};

describe("academy presentation", () => {
  for (const language of ["zh", "en"] as const) {
    it(`offers six chapters without locking progression (${language})`, () => {
      const html = renderToStaticMarkup(
        <Academy {...defaults} language={language} />,
      );
      assert.equal((html.match(/class="academy-chapter"/g) ?? []).length, 6);
      assert.equal((html.match(/data-chapter-id=/g) ?? []).length, 6);
      assert.equal((html.match(/data-lesson-id=/g) ?? []).length, 0);
      assert.ok(html.includes(academyCopy[language].intro));
      assert.ok(!html.includes("disabled="));
      assert.ok(html.includes('aria-valuenow="0"'));
    });
    it(`renders every practice mode with free skip, restart, and help (${language})`, () => {
      for (const [index, lesson] of academyLessons.entries()) {
        const html = renderToStaticMarkup(
          <AcademyLessonView
            {...defaults}
            language={language}
            lesson={lesson}
            index={index}
            onOverview={noop}
            onNext={noop}
          />,
        );
        for (const id of [
          "academy-lesson",
          "academy-board",
          "academy-next",
          "academy-reset",
          "academy-hint",
          "academy-overview",
        ])
          assert.ok(
            html.includes(`data-testid="${id}"`),
            `${lesson.id}: missing ${id}`,
          );
        assert.ok(html.includes(academyCopy[language].skip));
        assert.ok(!/data-testid="academy-next"[^>]*disabled/.test(html));
        if (lesson.mode === "recognition") {
          assert.equal(
            (html.match(/data-choice=/g) ?? []).length,
            lesson.choices!.length,
          );
          // Recognition remains a visual question: neither the digit's name nor its answer
          // is placed in the board's accessible label.
          assert.ok(
            html.includes(`aria-label="${academyCopy[language].board}"`),
          );
          assert.ok(!html.includes(`aria-label="${lesson.initial.join("")}"`));
          assert.ok(!html.includes('data-testid="academy-reservoir"'));
        } else if (lesson.mode === "add" || lesson.mode === "remove")
          assert.ok(html.includes('data-testid="academy-reservoir"'));
      }
    });
  }
  it("offers exactly four unlocked lessons in each chapter", () => {
    for (const chapterId of [1, 2, 3, 4, 5, 6]) {
      const html = renderToStaticMarkup(
        <AcademyChapterLessons
          chapterId={chapterId}
          language="en"
          completedLessonIds={[academyLessons[0].id]}
          onSelect={noop}
        />,
      );
      assert.equal((html.match(/data-lesson-id=/g) ?? []).length, 4);
      for (const lesson of academyLessons.filter(
        (item) => item.chapterId === chapterId,
      ))
        assert.ok(html.includes(`data-lesson-id="${lesson.id}"`));
      assert.ok(!html.includes("disabled="));
      assert.equal(
        (html.match(/academy-lesson-link done/g) ?? []).length,
        chapterId === 1 ? 1 : 0,
      );
    }
  });
  it("deduplicates progress and ignores unrecognized ids", () => {
    const html = renderToStaticMarkup(
      <Academy
        {...defaults}
        completedLessonIds={[
          academyLessons[0].id,
          academyLessons[0].id,
          "unknown",
        ]}
      />,
    );
    assert.ok(html.includes('aria-valuenow="1"'));
    assert.ok(html.includes("1 / 4"));
  });
  it("celebrates complete progress without blocking replay access", () => {
    const html = renderToStaticMarkup(
      <Academy
        {...defaults}
        completedLessonIds={academyLessons.map((lesson) => lesson.id)}
      />,
    );
    assert.ok(html.includes(academyCopy.en.allDone));
    assert.equal((html.match(/data-chapter-id=/g) ?? []).length, 6);
  });
  it("visually separates independent cards but keeps equations together", () => {
    for (const lesson of academyLessons) {
      const html = renderToStaticMarkup(
        <AcademyLessonView
          {...defaults}
          lesson={lesson}
          index={academyLessons.indexOf(lesson)}
          onOverview={noop}
          onNext={noop}
        />,
      );
      const expected =
        lesson.initial.length > 1 && lesson.mode !== "equation"
          ? lesson.initial.length
          : 0;
      assert.equal(
        (html.match(/academy-separate-card/g) ?? []).length,
        expected,
        lesson.id,
      );
    }
  });
  it("only outlines the intended empty destination before selection", () => {
    for (const lesson of academyLessons.filter(
      (l) => l.hintLevel === 2 && l.mode !== "recognition",
    )) {
      const html = renderToStaticMarkup(
        <AcademyLessonView
          {...defaults}
          lesson={lesson}
          index={academyLessons.indexOf(lesson)}
          onOverview={noop}
          onNext={noop}
        />,
      );
      const solution = getAcademySolution(lesson)!;
      assert.equal(
        (html.match(/class="[^"]*placeholder/g) ?? []).length,
        solution.to ? 1 : 0,
        lesson.id,
      );
      if (solution.to)
        assert.ok(
          html.includes(
            `data-position="${solution.to.position}" data-segment="${solution.to.segment}"`,
          ),
        );
      if (lesson.mode === "remove")
        assert.ok(html.includes("academy-hint-source"));
    }
  });
  it("fades default guidance from outlines to text to independent practice", () => {
    for (const lesson of academyLessons.filter((l) => l.chapterId === 3)) {
      const html = renderToStaticMarkup(
        <AcademyLessonView
          {...defaults}
          lesson={lesson}
          index={academyLessons.indexOf(lesson)}
          onOverview={noop}
          onNext={noop}
        />,
      );
      assert.equal(html.includes(lesson.hint.en), lesson.hintLevel === 1);
      assert.equal(html.includes("placeholder"), lesson.hintLevel === 2);
    }
  });
});

it("keyboard activation recovers after a canceled or completed pointer drag", () => {
  assert.equal(shouldSuppressAcademyClick(true, 0), false);
  assert.equal(shouldSuppressAcademyClick(true, 1), true);
  assert.equal(shouldSuppressAcademyClick(false, 0), false);
  assert.equal(shouldSuppressAcademyClick(false, 1), false);
});
