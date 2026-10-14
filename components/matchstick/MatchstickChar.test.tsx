import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { type ComponentProps } from "react";
import { MatchstickChar } from "./MatchstickChar";
import { MatchstickArt } from "./MatchstickArt";
const noop = () => {};
const props: ComponentProps<typeof MatchstickChar> = {
  char: "1",
  position: 0,
  rotatedClockwise: false,
  directions: [],
  selected: null,
  selectionActive: false,
  interactionLocked: false,
  onSegmentClick: noop,
  canDropSegment: () => true,
  onSegmentPointerDown: noop,
  onSegmentPointerMove: noop,
  onSegmentPointerUp: noop,
  onSegmentPointerCancel: noop,
  labels: { equalsLabel: "Equals", segmentLabel: "Stick {segment}" },
};
test("academy source override enables occupied segments excluded by equation rules", () => {
  const game = renderToStaticMarkup(<MatchstickChar {...props} />);
  const academy = renderToStaticMarkup(
    <MatchstickChar {...props} canSelectSegment={() => true} />,
  );
  assert.equal((game.match(/disabled=""/g) ?? []).length, 2);
  assert.equal((academy.match(/disabled=""/g) ?? []).length, 0);
});
test("academy hints render disabled empty outline until source selection", () => {
  const html = renderToStaticMarkup(
    <MatchstickChar
      {...props}
      showTargetOutline={(_p, s) => s === 1}
      hintTarget={{ position: 0, segment: 1 }}
    />,
  );
  assert.match(html, /placeholder[^\"]*academy-hint-target/);
  assert.equal((html.match(/data-segment=/g) ?? []).length, 3);
  const selected = renderToStaticMarkup(
    <MatchstickChar
      {...props}
      canSelectSegment={() => true}
      selectionActive
      selected={{ position: 0, segment: 2 }}
    />,
  );
  assert.equal((selected.match(/data-segment=/g) ?? []).length, 7);
});
test("equals remains noninteractive even with academy overrides", () => {
  const html = renderToStaticMarkup(
    <MatchstickChar
      {...props}
      char="="
      canSelectSegment={() => true}
      selectionActive
      showTargetOutline={() => true}
    />,
  );
  assert.doesNotMatch(html, /<button/);
  assert.match(html, /Equals/);
});

test("a carried phone source hides only its art, preserving its control and board model", () => {
  for (const rotatedClockwise of [false, true]) {
    for (const selected of [null, { position: 0, segment: 1 }]) {
      const current = { ...props, char: "7", rotatedClockwise, selected };
      const normal = renderToStaticMarkup(<MatchstickChar {...current} />);
      const carried = renderToStaticMarkup(
        <MatchstickChar
          {...current}
          hiddenSource={{ position: 0, segment: 1 }}
        />,
      );
      assert.equal((carried.match(/visibility:hidden/g) ?? []).length, 1);
      assert.match(carried, /<svg[^>]*style="visibility:hidden"/);
      // Same source button, enabled state, label, selection, orientation, and
      // occupied slots. Visibility is purely an artwork presentation change.
      assert.equal(carried.replace(' style="visibility:hidden"', ""), normal);
      assert.equal(
        renderToStaticMarkup(
          <MatchstickChar {...current} hiddenSource={null} />,
        ),
        normal,
        "retiring the gesture restores the source without editing the model",
      );
    }
  }
});

test("only the exact eligible source can hide, including Academy source overrides", () => {
  const source = { position: 0, segment: 2 };
  const academy = renderToStaticMarkup(
    <MatchstickChar
      {...props}
      hiddenSource={source}
      canSelectSegment={() => true}
    />,
  );
  assert.equal((academy.match(/visibility:hidden/g) ?? []).length, 1);
  for (const overrides of [
    {}, // A 1 is fixed in ordinary puzzles.
    { interactionLocked: true, canSelectSegment: () => true },
    { hiddenSource: { position: 1, segment: 2 }, canSelectSegment: () => true },
    {
      hiddenSource: { position: 0, segment: 1 },
      canSelectSegment: () => true,
      selectionActive: true,
    },
    { char: "=", canSelectSegment: () => true },
  ]) {
    const html = renderToStaticMarkup(
      <MatchstickChar {...props} hiddenSource={source} {...overrides} />,
    );
    assert.doesNotMatch(html, /visibility:hidden/);
  }
});

test("carried magnifier artwork remains visible independently of hidden source artwork", () => {
  for (const orientation of ["horizontal", "vertical"] as const) {
    for (const reversed of [false, true]) {
      const source = renderToStaticMarkup(
        <MatchstickArt
          orientation={orientation}
          reversed={reversed}
          sourceHidden
        />,
      );
      const carried = renderToStaticMarkup(
        <MatchstickArt orientation={orientation} reversed={reversed} />,
      );
      assert.match(source, /style="visibility:hidden"/);
      assert.doesNotMatch(carried, /visibility:hidden/);
      assert.equal(source.replace(' style="visibility:hidden"', ""), carried);
      assert.equal(
        renderToStaticMarkup(
          <MatchstickArt
            orientation={orientation}
            reversed={reversed}
            sourceHidden={false}
          />,
        ),
        carried,
      );
    }
  }
});
