import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const read = (path) => readFileSync(path, "utf8");
const game = read("components/MatchstickGame.tsx");
const css = read("app/globals.css");
test("settings gear follows counter outside status and puzzle controls", () => {
  const start = game.indexOf('<div className="status-actions"');
  const end = game.indexOf('<div className="status-copy"', start);
  assert.ok(start >= 0 && end > start);
  const header = game.slice(start, end);
  assert.match(
    header,
    /<AnswerProgress[\s\S]*className="settings-button"[\s\S]*<ActionIcon name="settings"/,
  );
  assert.match(header, /aria-label=\{text.settingsTitle\}/);
  assert.match(header, /title=\{text.settingsTitle\}/);
  assert.match(header, /aria-haspopup="dialog"/);
  assert.match(header, /aria-expanded=\{settingsOpen\}/);
  assert.doesNotMatch(header, /role="status"|aria-live/);
  assert.doesNotMatch(
    read("components/matchstick/GameControls.tsx"),
    /onOpenSettings|name="more"|name="settings"/,
  );
  assert.match(
    read("components/matchstick/AnswerProgress.tsx"),
    /ref=\{digitRef\}/,
  );
});
test("gear reserves header height and four bounded toolbar rows", () => {
  assert.match(css, /\.settings-button \{[^}]*width: 40px;[^}]*height: 40px;/s);
  assert.match(
    css,
    /\.phone-layout \.play-area \{[^}]*grid-template-rows: 40px minmax\(0, 1fr\)/s,
  );
  assert.match(
    css,
    /\.status-strip \.status-actions \{[^}]*grid-column: 3;[^}]*gap: 8px;[^}]*white-space: nowrap;[^}]*flex-wrap: nowrap/s,
  );
  assert.match(css, /grid-template-rows: repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /height: min\(100%, 188px\)/);
  assert.match(css, /\.settings-button:focus-visible/);
});
