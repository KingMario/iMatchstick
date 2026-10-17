import { type SelectedSegment } from "./matchstick";

export function createStickDirections(length: number, random = Math.random) {
  return Array.from({ length }, () =>
    Array.from({ length: 7 }, () => random() < 0.5),
  );
}

/** A moved match keeps its head direction; the empty target's random bit is irrelevant. */
export function transferStickDirection(
  directions: boolean[][],
  from: SelectedSegment,
  to: SelectedSegment,
  direction = Boolean(directions[from.position]?.[from.segment]),
) {
  return directions.map((segments, position) =>
    position === to.position
      ? segments.map((reversed, segment) =>
          segment === to.segment ? direction : reversed,
        )
      : segments,
  );
}

type Orientation = "horizontal" | "vertical";

/** Either quarter turn is valid; an unchanged axis never flips the head. */
export function chooseStickDirection(
  sourceReversed: boolean,
  sourceOrientation: Orientation,
  targetOrientation: Orientation,
  random = Math.random,
) {
  return sourceOrientation === targetOrientation
    ? sourceReversed
    : sourceReversed !== random() < 0.5;
}

/** Cache by candidate for the whole gesture, including leaving and re-entering it. */
export function getDragStickDirection(
  current: {
    sourceReversed: boolean;
    reversed?: boolean;
    originOrientation: Orientation;
    directionChoices: Map<string, boolean>;
  },
  target: { element: HTMLElement; orientation: Orientation | null } | null,
  random = Math.random,
) {
  if (!target?.orientation) return current.reversed ?? current.sourceReversed;
  const key = `${target.element.dataset.position}:${target.element.dataset.segment}`;
  if (!current.directionChoices.has(key)) {
    current.directionChoices.set(
      key,
      chooseStickDirection(
        current.sourceReversed,
        current.originOrientation,
        target.orientation,
        random,
      ),
    );
  }
  return current.directionChoices.get(key)!;
}
