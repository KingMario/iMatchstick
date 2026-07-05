import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getSelectionMessageKey,
  shouldCountPuzzleBypass,
  shouldPreventPageZoomGesture,
  shouldCancelSelectionFromPlaygroundClick,
} from "./interaction";

describe("interaction state helpers", () => {
  it("cancels selection only when the playground itself is clicked", () => {
    const playground = new EventTarget();
    const child = new EventTarget();

    assert.equal(
      shouldCancelSelectionFromPlaygroundClick({
        target: playground,
        currentTarget: playground,
        locked: false,
        hasSelected: true,
      }),
      true,
    );
    assert.equal(
      shouldCancelSelectionFromPlaygroundClick({
        target: child,
        currentTarget: playground,
        locked: false,
        hasSelected: true,
      }),
      false,
    );
  });

  it("does not cancel when the game is locked or no matchstick is selected", () => {
    const playground = new EventTarget();

    assert.equal(
      shouldCancelSelectionFromPlaygroundClick({
        target: playground,
        currentTarget: playground,
        locked: true,
        hasSelected: true,
      }),
      false,
    );
    assert.equal(
      shouldCancelSelectionFromPlaygroundClick({
        target: playground,
        currentTarget: playground,
        locked: false,
        hasSelected: false,
      }),
      false,
    );
  });

  it("chooses the correct hint after voice cancellation", () => {
    assert.equal(getSelectionMessageKey(false), "selectHint");
    assert.equal(getSelectionMessageKey(true), "selectedHint");
  });

  it("prevents page zoom only for multi-touch gestures", () => {
    assert.equal(shouldPreventPageZoomGesture(0), false);
    assert.equal(shouldPreventPageZoomGesture(1), false);
    assert.equal(shouldPreventPageZoomGesture(2), true);
    assert.equal(shouldPreventPageZoomGesture(3), true);
  });

  it("counts bypasses only for attempted puzzles without found answers", () => {
    assert.equal(
      shouldCountPuzzleBypass({ attempts: 0, answersFound: 0 }),
      false,
    );
    assert.equal(
      shouldCountPuzzleBypass({ attempts: 1, answersFound: 0 }),
      true,
    );
    assert.equal(
      shouldCountPuzzleBypass({ attempts: 1, answersFound: 1 }),
      false,
    );
  });
});
