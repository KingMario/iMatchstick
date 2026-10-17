/** All points here are physical viewport coordinates, never handedness-adjusted. */
export type MagnifierPoint = { x: number; y: number };
export type MagnifierRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};
export type MagnifierViewport = {
  width: number;
  height: number;
  left?: number;
  top?: number;
  safeArea?: Partial<{
    top: number;
    right: number;
    bottom: number;
    left: number;
  }>;
};
export const magnifierZoom = 1.2;
export const magnifierDiameter = 120;
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, max));

export function getMagnifierPlacement(
  anchor: MagnifierRect,
  viewport: MagnifierViewport,
  point: MagnifierPoint,
  rotatedClockwise: boolean,
) {
  const safe = viewport.safeArea;
  const safeLeft = clamp(safe?.left ?? 0, 0, viewport.width);
  const safeRight = clamp(safe?.right ?? 0, 0, viewport.width - safeLeft);
  const safeTop = clamp(safe?.top ?? 0, 0, viewport.height);
  const safeBottom = clamp(safe?.bottom ?? 0, 0, viewport.height - safeTop);
  const width = viewport.width - safeLeft - safeRight;
  const height = viewport.height - safeTop - safeBottom;
  const margin = Math.min(8, Math.max(0, (Math.min(width, height) - 1) / 2));
  const size = Math.max(
    0,
    Math.min(magnifierDiameter, width - margin * 2, height - margin * 2),
  );
  const leftEdge = (viewport.left ?? 0) + safeLeft + margin;
  const topEdge = (viewport.top ?? 0) + safeTop + margin;
  // The title snapshot is already in physical coordinates. Hold its logical
  // landscape height while tracking the finger along the game's horizontal
  // axis: physical x normally, physical y after the clockwise portrait turn.
  const centerX = rotatedClockwise ? anchor.left + anchor.width / 2 : point.x;
  const centerY = rotatedClockwise ? point.y : anchor.top + anchor.height / 2;
  return {
    left: clamp(
      centerX - size / 2,
      leftEdge,
      leftEdge + width - margin * 2 - size,
    ),
    top: clamp(
      centerY - size / 2,
      topEdge,
      topEdge + height - margin * 2 - size,
    ),
    size,
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
