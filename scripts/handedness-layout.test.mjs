import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const css = readFileSync("app/globals.css", "utf8");
const game = readFileSync("components/MatchstickGame.tsx", "utf8");

test("handedness alignment only changes phone character-group justification", () => {
  for (const [hand, alignment] of [
    ["left", "flex-end"],
    ["right", "flex-start"],
  ]) {
    const selector = `.phone-layout .equation[data-drag-hand="${hand}"]`;
    const rule = css.slice(css.indexOf(selector)).match(/^[^{]+\{([^}]+)\}/);
    assert.ok(rule, `Missing ${hand} phone alignment`);
    assert.equal(rule[1].trim(), `justify-content: ${alignment};`);
  }
  // No desktop, orientation-specific or sizing rules can depend on the hand.
  assert.equal((css.match(/data-drag-hand/g) ?? []).length, 2);
  assert.match(game, /ref=\{equationRef\}\s+data-drag-hand=\{dragHand\}/);
  assert.match(game, /onDragHandChange=\{setDragHand\}/);
});

test("phone alignment retains original size, spacing and reserved control corridor", () => {
  const rule = css.match(/\.phone-layout \.equation \{([^}]+)\}/)[1];
  assert.match(
    rule,
    /calc\(\(100cqw - 128px\) \/ var\(--character-count\) \/ 1\.12\)/,
  );
  assert.match(rule, /gap: calc\(var\(--digit-width\) \* 0\.12\)/);
  assert.match(rule, /padding: 12px 64px/);
  assert.match(
    css,
    /\.equation-viewport > \.difficulty-stepper \{[^}]*left: 8px/s,
  );
  assert.match(
    css,
    /\.equation-viewport > \.play-controls \{[^}]*right: 8px;\s+width: 44px/s,
  );
  assert.match(
    css,
    /\.phone-layout \.difficulty-stepper button \{\s+width: 44px/s,
  );
});
