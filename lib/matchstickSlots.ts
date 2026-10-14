/** Shared physical slot rules; each game supplies its own move policy. */
export type MatchstickOrientation = "horizontal" | "vertical";
export type MatchstickSlot = { position: number; segment: number };

export function getSegmentOrientation(
  char: string,
  segment: number,
): MatchstickOrientation {
  if (char === "=") return "horizontal";
  if (char === "+" || char === "-")
    return segment === 1 ? "vertical" : "horizontal";
  return [0, 2, 3, 5].includes(segment) ? "vertical" : "horizontal";
}

export function getScreenOrientation(
  orientation: MatchstickOrientation,
  rotatedClockwise: boolean,
): MatchstickOrientation {
  return rotatedClockwise
    ? orientation === "horizontal"
      ? "vertical"
      : "horizontal"
    : orientation;
}

export function canTransferMatchstick({
  cards,
  from,
  to,
  getVisibleSegments,
  isLegal,
}: {
  cards: readonly string[];
  from: MatchstickSlot | null;
  to: MatchstickSlot | null;
  getVisibleSegments: (char: string) => readonly boolean[];
  isLegal: () => boolean;
}) {
  if (!from && !to) return false;
  const exists = (slot: MatchstickSlot, occupied: boolean) =>
    Number.isInteger(slot.position) &&
    Number.isInteger(slot.segment) &&
    slot.position >= 0 &&
    slot.position < cards.length &&
    slot.segment >= 0 &&
    cards[slot.position] !== "=" &&
    getVisibleSegments(cards[slot.position])[slot.segment] === occupied;
  return (
    (!from || exists(from, true)) && (!to || exists(to, false)) && isLegal()
  );
}
