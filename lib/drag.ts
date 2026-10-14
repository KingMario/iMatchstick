import { type PointerEvent } from "react";
import { type MatchstickOrientation } from "./matchstickSlots";

const androidHelperSizeRatio = 24 / 60;
const androidCursorOffsetRatio = {
  x: (12 - 90) / 60,
  y: (12 - 30) / 60,
};
const dragOffsetScale = 0.65;
const dragSnapPadding = 18;

export const dragStartThreshold = 8;
export type DragHand = "left" | "right";

export type DragPointerCapture = {
  pointerId: number;
  element: HTMLButtonElement;
};

/** A second finger must not move, finish, or cancel the owning gesture. */
export function isDragPointer(
  current: Pick<DragPointerCapture, "pointerId"> | null,
  event: { pointerId: number },
) {
  return current !== null && current.pointerId === event.pointerId;
}

/** Clear gesture refs before calling this: lostpointercapture may fire now. */
export function releaseDragPointerCapture(current: DragPointerCapture | null) {
  if (current?.element.hasPointerCapture(current.pointerId))
    current.element.releasePointerCapture(current.pointerId);
}

export type SnapTarget = {
  element: HTMLElement;
  x: number;
  y: number;
  distance: number;
  orientation: MatchstickOrientation | null;
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

/** Phone touch uses the actual finger; mouse retains the offset helper. */
export function getPointerDragMetrics(
  rect: DOMRect,
  orientation: MatchstickOrientation,
  {
    phonePortrait = false,
    dragHand = "right",
    pointerType,
    isPhone = false,
  }: {
    phonePortrait?: boolean;
    dragHand?: DragHand;
    pointerType: string;
    isPhone?: boolean;
  },
) {
  const metrics = getDragHelperMetrics(
    rect,
    orientation,
    phonePortrait,
    dragHand,
  );
  const touchMagnifier = isPhone && pointerType === "touch";
  return {
    ...metrics,
    ...(touchMagnifier ? { offsetX: 0, offsetY: 0 } : {}),
    touchMagnifier,
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

export type SnapOptions = {
  /** Academy supports a direct finger hit before offset snapping. */
  preferPointerHit?: boolean;
  isAllowed?: (element: HTMLElement) => boolean;
};

function describeTarget(
  element: HTMLElement,
  point: { x: number; y: number },
): SnapTarget {
  const rect = element.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const orientation = element.dataset.screenOrientation;
  return {
    element,
    x,
    y,
    distance: Math.hypot(point.x - x, point.y - y),
    orientation:
      orientation === "horizontal" || orientation === "vertical"
        ? orientation
        : null,
  };
}

export function findSnapTarget(
  point: { x: number; y: number },
  options: SnapOptions = {},
): SnapTarget | null {
  const placeholders = Array.from(
    document.querySelectorAll<HTMLElement>(
      ".match-segment.placeholder:not(:disabled)",
    ),
  );
  let nearest: SnapTarget | null = null;

  for (const element of placeholders) {
    if (options.isAllowed && !options.isAllowed(element)) continue;
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
      nearest = describeTarget(element, point);
    }
  }

  return nearest;
}

/** One resolver for preview and release, independent of each mode's legality. */
export function resolveDragTarget(
  event: Pick<PointerEvent<HTMLButtonElement>, "clientX" | "clientY">,
  current: DragLike,
  options: SnapOptions = {},
) {
  const point = getDragHelperPoint(event, current.offsetX, current.offsetY);
  if (options.preferPointerHit) {
    const direct = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>(".match-segment.placeholder:not(:disabled)");
    if (direct && (!options.isAllowed || options.isAllowed(direct))) {
      return { point, target: describeTarget(direct, point) };
    }
  }
  return { point, target: findSnapTarget(point, options) };
}

export function moveDragToPointer<T extends DragLike>(
  current: T,
  event: Pick<PointerEvent<HTMLButtonElement>, "clientX" | "clientY">,
  returning: boolean,
  shouldSnap = false,
  options: SnapOptions = {},
) {
  const helperPoint = getDragHelperPoint(
    event,
    current.offsetX,
    current.offsetY,
  );
  const snapTarget = shouldSnap
    ? resolveDragTarget(event, current, options).target
    : null;

  return {
    ...current,
    pointerX: event.clientX,
    pointerY: event.clientY,
    x: snapTarget?.x ?? helperPoint.x,
    y: snapTarget?.y ?? helperPoint.y,
    returning,
    snapped: Boolean(snapTarget),
    ...(snapTarget?.orientation ? { orientation: snapTarget.orientation } : {}),
  };
}
