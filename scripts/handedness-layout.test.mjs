import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const css = readFileSync("app/globals.css", "utf8");
const game = readFileSync("components/MatchstickGame.tsx", "utf8");

test("handedness translates only phone glyphs from centered layout", () => {
  for (const [hand, offset] of [
    ["left", "calc(-1 * var(--hand-offset))"],
    ["right", "var(--hand-offset)"],
  ]) {
    const selector = `.phone-layout .equation[data-drag-hand="${hand}"] > .match-char`;
    const rule = css.slice(css.indexOf(selector)).match(/^[^{]+\{([^}]+)\}/);
    assert.ok(rule, `Missing ${hand} phone offset`);
    assert.equal(rule[1].trim(), `transform: translateX(${offset});`);
  }
  assert.equal((css.match(/data-drag-hand/g) ?? []).length, 2);
  assert.match(game, /ref=\{equationRef\}\s+data-drag-hand=\{dragHand\}/);
  assert.match(game, /onDragHandChange=\{setDragHand\}/);
  assert.match(
    game,
    /"--character-width-units": Array.from\(\s*displayExpression,?\s*\).reduce/,
  );
  assert.match(game, /width \+ \("\+-=".includes\(char\) \? 0.78 : 1\)/);
  assert.match(
    css,
    /--group-width: calc\(\s*var\(--digit-width\) \* var\(--character-width-units\) \+\s*var\(--digit-width\) \*\s*0.12 \* \(var\(--character-count\) - 1\)\s*\)/,
  );
  assert.match(
    css,
    /--hand-offset: min\(\s*calc\(var\(--match-length\) \* 192 \/ 240\),\s*max\(0px, calc\(\(100cqw - 128px - var\(--group-width\)\) \/ 2\)\)/,
  );
});

// Algebraic regression matrix for the CSS formula. Browser geometry coverage is
// in handedness-alignment.spec.ts; this does not claim to render CSS.
test("bounded offsets preserve centered geometry across sizes and expressions", () => {
  let capped = 0;
  let edgeClamped = 0;
  for (const width of [320, 568, 640, 736, 844, 932, 1280]) {
    for (const height of [180, 260, 360, 430]) {
      for (const expression of [
        "7-5=3",
        "10-80=100",
        "100+100=200",
        "111111-11111=100000",
      ]) {
        const digit = Math.min(
          88,
          (width - 128) / expression.length / 1.12,
          0.4 * height,
        );
        const units = [...expression].reduce(
          (sum, char) => sum + ("+-=".includes(char) ? 0.78 : 1),
          0,
        );
        const group = digit * units + digit * 0.12 * (expression.length - 1);
        const room = Math.max(0, (width - 128 - group) / 2);
        const cap = (digit * 0.72 * 192) / 240;
        const amount = Math.min(cap, room);
        if (room < cap) edgeClamped++;
        else capped++;
        for (const direction of [-1, 1]) {
          const baseline = (width - group) / 2;
          const x = baseline + direction * amount;
          assert.ok(x >= 64 - 1e-9);
          assert.ok(x + group <= width - 64 + 1e-9);
          assert.ok(Math.abs(x - baseline) <= cap + 1e-9);
          assert.equal(
            group,
            digit * units + digit * 0.12 * (expression.length - 1),
          );
        }
      }
    }
  }
  assert.ok(capped > 0 && edgeClamped > 0);
  // Exhausted or already overflowing space never adds more displacement.
  for (const space of [0, -0.01, -100]) {
    assert.equal(Math.min(50, Math.max(0, space)), 0);
  }
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
