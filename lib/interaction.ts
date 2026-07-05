export type SelectionMessageKey = "selectHint" | "selectedHint";

export function shouldCancelSelectionFromPlaygroundClick(options: {
  target: EventTarget | null;
  currentTarget: EventTarget | null;
  locked: boolean;
  hasSelected: boolean;
}) {
  return (
    options.target === options.currentTarget &&
    !options.locked &&
    options.hasSelected
  );
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
