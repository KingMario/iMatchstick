import { getVisibleSegments, type SelectedSegment } from "./matchstick";

export type SuccessKind = "new" | "complete" | "repeat";

export function getSuccessFeedback(
  original: string,
  answer: string,
  found: string[],
  total: number,
) {
  const kind: SuccessKind = found.includes(answer)
    ? "repeat"
    : found.length + 1 >= total
      ? "complete"
      : "new";
  let destination: SelectedSegment | null = null;
  for (let position = 0; position < answer.length; position++) {
    if (answer[position] === "=") continue;
    const before = getVisibleSegments(original[position]);
    const after = getVisibleSegments(answer[position]);
    const segment = after.findIndex(
      (visible, index) => visible && !before[index],
    );
    if (segment !== -1) destination = { position, segment };
  }
  return { kind, destination };
}
