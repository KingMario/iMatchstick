import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getSelectionMessageKey,
  shouldCountPuzzleBypass,
  shouldPreventPageZoomGesture,
  shouldCancelSelectionFromPlaygroundClick,
  shouldStartNewPuzzleFromPlaygroundDoubleClick,
} from "./interaction";

describe("interaction state helpers", () => {
  it("cancels selection for non-interactive playground clicks", () => {
    assert.equal(
      shouldCancelSelectionFromPlaygroundClick({
        isInteractiveTarget: false,
        interactionLocked: false,
        hasSelected: true,
      }),
      true,
    );
    assert.equal(
      shouldCancelSelectionFromPlaygroundClick({
        isInteractiveTarget: true,
        interactionLocked: false,
        hasSelected: true,
      }),
      false,
    );
  });

  it("does not cancel when interactions are locked or no matchstick is selected", () => {
    assert.equal(
      shouldCancelSelectionFromPlaygroundClick({
        isInteractiveTarget: false,
        interactionLocked: true,
        hasSelected: true,
      }),
      false,
    );
    assert.equal(
      shouldCancelSelectionFromPlaygroundClick({
        isInteractiveTarget: false,
        interactionLocked: false,
        hasSelected: false,
      }),
      false,
    );
  });

  it("starts a new puzzle only from solved non-interactive playground double clicks", () => {
    assert.equal(
      shouldStartNewPuzzleFromPlaygroundDoubleClick({
        isInteractiveTarget: false,
        solved: false,
      }),
      false,
    );
    assert.equal(
      shouldStartNewPuzzleFromPlaygroundDoubleClick({
        isInteractiveTarget: true,
        solved: true,
      }),
      false,
    );
    assert.equal(
      shouldStartNewPuzzleFromPlaygroundDoubleClick({
        isInteractiveTarget: false,
        solved: true,
      }),
      true,
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

  it("counts bypasses for any puzzle without found answers", () => {
    assert.equal(shouldCountPuzzleBypass(0), true);
    assert.equal(shouldCountPuzzleBypass(1), false);
  });
});
