/** All points here are physical viewport coordinates, never handedness-adjusted. */
export type MagnifierPoint = { x: number; y: number };
export type MagnifierViewport = {
  width: number;
  height: number;
  left?: number;
  top?: number;
};
export const magnifierZoom = 1.6;
export const magnifierDiameter = 120;
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, max));

export function getMagnifierPlacement(
  point: MagnifierPoint,
  viewport: MagnifierViewport,
) {
  const margin = Math.min(
    8,
    Math.max(0, (Math.min(viewport.width, viewport.height) - 1) / 2),
  );
  const gap = 26;
  const size = Math.max(
    0,
    Math.min(
      magnifierDiameter,
      viewport.width - margin * 2,
      viewport.height - margin * 2,
    ),
  );
  const leftEdge = (viewport.left ?? 0) + margin;
  const topEdge = (viewport.top ?? 0) + margin;
  const bottomEdge = (viewport.top ?? 0) + viewport.height - margin;
  const above = point.y - gap - size;
  const below = point.y + gap;
  const flip = above < topEdge && below + size <= bottomEdge;
  return {
    left: clamp(
      point.x - size / 2,
      leftEdge,
      leftEdge + viewport.width - margin * 2 - size,
    ),
    top: clamp(flip ? below : above, topEdge, bottomEdge - size),
    size,
    below: flip,
  };
}

/** A positive-determinant rotation + scale, with no reflection. */
export function getMagnifierMatrix(
  rect: { left: number; top: number; width: number; height: number },
  logicalSize: { width: number; height: number },
  point: MagnifierPoint,
  rotatedClockwise: boolean,
  size = magnifierDiameter,
  zoom = magnifierZoom,
): [number, number, number, number, number, number] {
  const sx =
    rect.width /
    Math.max(1, rotatedClockwise ? logicalSize.height : logicalSize.width);
  const sy =
    rect.height /
    Math.max(1, rotatedClockwise ? logicalSize.width : logicalSize.height);
  return rotatedClockwise
    ? [
        0,
        sy * zoom,
        -sx * zoom,
        0,
        size / 2 + (rect.left + rect.width - point.x) * zoom,
        size / 2 + (rect.top - point.y) * zoom,
      ]
    : [
        sx * zoom,
        0,
        0,
        sy * zoom,
        size / 2 + (rect.left - point.x) * zoom,
        size / 2 + (rect.top - point.y) * zoom,
      ];
}

export function getMagnifierLocalPoint(
  point: MagnifierPoint,
  finger: MagnifierPoint,
  size = magnifierDiameter,
) {
  return {
    x: size / 2 + (point.x - finger.x) * magnifierZoom,
    y: size / 2 + (point.y - finger.y) * magnifierZoom,
  };
}
