import { type PointerEvent } from "react";

const androidHelperSizeRatio = 24 / 60;
const androidCursorOffsetRatio = {
  x: (12 - 90) / 60,
  y: (12 - 30) / 60,
};
const dragOffsetScale = 0.65;
const dragSnapPadding = 18;

export const dragStartThreshold = 8;
export type DragHand = "left" | "right";

type SnapTarget = {
  element: HTMLElement;
  x: number;
  y: number;
  distance: number;
};

type DragLike = {
  offsetX: number;
  offsetY: number;
};

export function getDragHelperMetrics(
  rect: DOMRect,
  orientation: "horizontal" | "vertical",
  phonePortrait = false,
  dragHand: DragHand = "right",
) {
  const mainLength = orientation === "horizontal" ? rect.width : rect.height;
  const helperSize = Math.max(
    14,
    Math.round(mainLength * androidHelperSizeRatio),
  );

  const offsetX =
    mainLength *
    androidCursorOffsetRatio.x *
    dragOffsetScale *
    (dragHand === "left" ? -1 : 1);
  const offsetY = mainLength * androidCursorOffsetRatio.y * dragOffsetScale;
  return {
    helperSize,
    offsetX: phonePortrait ? -offsetY : offsetX,
    offsetY: phonePortrait ? offsetX : offsetY,
  };
}

export function getDragHelperPoint(
  event: Pick<PointerEvent<HTMLButtonElement>, "clientX" | "clientY">,
  offsetX: number,
  offsetY: number,
) {
  return {
    x: event.clientX + offsetX,
    y: event.clientY + offsetY,
  };
}

export function findSnapTarget(point: {
  x: number;
  y: number;
}): SnapTarget | null {
  const placeholders = Array.from(
    document.querySelectorAll<HTMLElement>(
      ".match-segment.placeholder:not(:disabled)",
    ),
  );
  let nearest: SnapTarget | null = null;

  for (const element of placeholders) {
    const rect = element.getBoundingClientRect();
    const padding = Math.max(
      dragSnapPadding,
      Math.min(rect.width, rect.height) * 0.8,
    );

    if (
      point.x < rect.left - padding ||
      point.x > rect.right + padding ||
      point.y < rect.top - padding ||
      point.y > rect.bottom + padding
    ) {
      continue;
    }

    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const distance = Math.hypot(point.x - x, point.y - y);

    if (!nearest || distance < nearest.distance) {
      nearest = { element, x, y, distance };
    }
  }

  return nearest;
}

export function moveDragToPointer<T extends DragLike>(
  current: T,
  event: Pick<PointerEvent<HTMLButtonElement>, "clientX" | "clientY">,
  returning: boolean,
  shouldSnap = false,
) {
  const helperPoint = getDragHelperPoint(
    event,
    current.offsetX,
    current.offsetY,
  );
  const snapTarget = shouldSnap ? findSnapTarget(helperPoint) : null;

  return {
    ...current,
    x: snapTarget?.x ?? helperPoint.x,
    y: snapTarget?.y ?? helperPoint.y,
    returning,
  };
}
