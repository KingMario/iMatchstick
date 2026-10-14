import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// Source invariants protect architecture only. The Playwright compact suite is
// responsible for real rendered geometry, rotation, reflow and clipping checks.
const css = readFileSync(
  new URL("../app/academy.css", import.meta.url),
  "utf8",
);
const source = readFileSync(
  new URL("../components/matchstick/Academy.tsx", import.meta.url),
  "utf8",
);
const game = readFileSync(
  new URL("../components/MatchstickGame.tsx", import.meta.url),
  "utf8",
);
function declarations(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]+)\\}`));
  assert.ok(match, `missing rule: ${selector}`);
  return match[1];
}

test("Academy owns a scrollable fallback rather than masking content overflow", () => {
  assert.match(declarations(".academy"), /overflow:\s*auto/);
  assert.match(declarations(".academy-welcome"), /overflow:\s*auto/);
  assert.doesNotMatch(css, /(?:line-clamp|text-overflow:\s*ellipsis)/);
  assert.match(game, /academy-active/);
});

test("Academy board supplies the operator length and thickness variables locally", () => {
  const board = declarations(".academy-board");
  assert.match(
    board,
    /--match-length:\s*calc\(var\(--digit-width\)\s*\*\s*0\.72\)/,
  );
  assert.match(
    board,
    /--match-thickness:\s*calc\(var\(--match-length\)\s*\*\s*68\s*\/\s*240\)/,
  );
  const equals = declarations(".academy-board .equals-lower");
  assert.match(equals, /width:\s*var\(--match-length\)/);
  assert.match(equals, /height:\s*var\(--match-thickness\)/);
});

test("Academy compact navigation and progressive assistance keep explicit return paths", () => {
  for (const id of [
    "academy-chapter",
    "academy-chapters-back",
    "academy-chapter-lessons",
    "academy-overview",
    "academy-assistance",
    "academy-hint-close",
    "academy-demonstrate",
    "academy-reset",
    "academy-next",
  ])
    assert.ok(source.includes(`data-testid="${id}"`), id);
  assert.match(source, /lesson\.hint\[language\]/);
  assert.match(source, /chapter\.description\[props\.language\]/);
  assert.doesNotMatch(source, /data-testid="academy-undo"/);
});
