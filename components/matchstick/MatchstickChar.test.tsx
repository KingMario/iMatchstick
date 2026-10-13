import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { type ComponentProps } from "react";
import { MatchstickChar } from "./MatchstickChar";
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
