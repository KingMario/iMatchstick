import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const game = readFileSync("components/MatchstickGame.tsx", "utf8");
function functionBody(name, next) {
  const start = game.indexOf(`  function ${name}(`);
  const end = game.indexOf(`  function ${next}(`, start);
  assert.ok(start >= 0 && end > start);
  return game.slice(start, end);
}

test("academy entry and exit do not reset puzzle, answers, clock or competitive stats (source invariant)", () => {
  const handlers = functionBody("openAcademy", "clearStats");
  assert.doesNotMatch(
    handlers,
    /\b(?:resetPuzzle|setPuzzle|setDisplayExpression|setTimeLeft|setStats|setSolved|setSolvedAnswers|loadNextPuzzle)\s*\(/,
  );
  assert.match(handlers, /clearDragGesture\(\)/);
  const cleanup = game.slice(
    game.indexOf("  const clearDragGesture ="),
    game.indexOf("  const clearTouchDrag ="),
  );
  assert.match(cleanup, /pendingDrag\.current = null/);
  assert.match(cleanup, /setPendingPress\(null\)/);
  assert.match(cleanup, /setDrag\(null\)/);
  assert.match(cleanup, /releaseDragPointerCapture\(current\)/);
  assert.match(handlers, /clearDragReturnTimer\(\)/);
  assert.match(handlers, /setSettingsOpen\(false\)/);
  assert.match(handlers, /setAcademyView\("lessons"\)/);
  assert.match(handlers, /setAcademyView\(null\)/);
});

test("every academy screen locks puzzle interaction and pauses its interval (source invariant)", () => {
  const compact = game.replace(/\s+/g, "");
  assert.match(compact, /constinteractionLocked=[^;]*academyView!==null/);
  assert.ok(
    compact.includes(
      "if(academyView!==null||isLoading||!timerEnabled||solved||timeLeft<=0)",
    ),
  );
  assert.ok(
    compact.includes("return()=>window.clearInterval(timerId);},[academyView,"),
  );
});

test("first-visit decision is read before competitive settings are restored (source invariant)", () => {
  const load = game.indexOf("const academy = loadAcademy(");
  const savedSettings = game.indexOf("const savedSettings =");
  assert.ok(load > 0 && savedSettings > load);
  assert.match(
    game,
    /setAcademyView\(academy\.showWelcome \? "welcome" : null\)/,
  );
});

test("academy cancels transient selection/listening status without overwriting results", () => {
  const handlers = functionBody("openAcademy", "closeAcademy");
  assert.match(
    handlers,
    /setMessageKey\(\(current\) =>\s*current === "selectedHint" \|\| current === "voiceListening"\s*\? "selectHint"\s*: current/,
  );
});
