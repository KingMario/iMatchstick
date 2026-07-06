export type SelectionMessageKey = "selectHint" | "selectedHint";

export function shouldCancelSelectionFromPlaygroundClick(options: {
  isInteractiveTarget: boolean;
  interactionLocked: boolean;
  hasSelected: boolean;
}) {
  return (
    !options.isInteractiveTarget &&
    !options.interactionLocked &&
    options.hasSelected
  );
}

export function shouldStartNewPuzzleFromPlaygroundDoubleClick(options: {
  isInteractiveTarget: boolean;
  solved: boolean;
}) {
  return !options.isInteractiveTarget && options.solved;
}

export function getSelectionMessageKey(
  hasSelected: boolean,
): SelectionMessageKey {
  return hasSelected ? "selectedHint" : "selectHint";
}

export function shouldPreventPageZoomGesture(touchCount: number) {
  return touchCount > 1;
}

export function shouldCountPuzzleBypass(answersFound: number) {
  return answersFound === 0;
}
