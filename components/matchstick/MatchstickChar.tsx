import { type PointerEvent } from "react";
import { MatchstickArt } from "./MatchstickArt";
import {
  getDraggableSegments,
  getVisibleSegments,
  type SelectedSegment,
} from "@/lib/matchstick";

type MatchstickCharProps = {
  char: string;
  position: number;
  rotatedClockwise: boolean;
  directions: boolean[];
  successDestination?: SelectedSegment | null;
  solved?: boolean;
  selected: SelectedSegment | null;
  selectionActive: boolean;
  interactionLocked: boolean;
  onSegmentClick: (position: number, segment: number, visible: boolean) => void;
  canDropSegment: (position: number, segment: number) => boolean;
  onSegmentPointerDown: (
    event: PointerEvent<HTMLButtonElement>,
    position: number,
    segment: number,
    visible: boolean,
    orientation: "horizontal" | "vertical",
  ) => void;
  onSegmentPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onSegmentPointerUp: (event: PointerEvent<HTMLButtonElement>) => void;
  onSegmentPointerCancel: () => void;
  labels: {
    equalsLabel: string;
    segmentLabel: string;
  };
};

export function MatchstickChar({
  char,
  position,
  rotatedClockwise,
  directions,
  successDestination,
  solved,
  selected,
  selectionActive,
  interactionLocked,
  onSegmentClick,
  canDropSegment,
  onSegmentPointerDown,
  onSegmentPointerMove,
  onSegmentPointerUp,
  onSegmentPointerCancel,
  labels,
}: MatchstickCharProps) {
  if (char === "=") {
    return (
      <div className="match-char equal-char" aria-label={labels.equalsLabel}>
        <span className="equals-upper">
          <MatchstickArt orientation="horizontal" reversed={directions[0]} />
        </span>
        <span className="equals-lower">
          <MatchstickArt orientation="horizontal" reversed={directions[1]} />
        </span>
        {solved ? (
          <i className="equation-success-check" aria-hidden="true">
            ✓
          </i>
        ) : null}
      </div>
    );
  }

  const visibleSegments = getVisibleSegments(char);
  const maxSegments = char === "+" || char === "-" ? 2 : 7;

  return (
    <div
      className={`match-char ${char === "+" || char === "-" ? "operator-char" : ""}`}
    >
      {Array.from({ length: maxSegments }, (_, segment) => {
        const visible = Boolean(visibleSegments[segment]);
        const selectedHere =
          selected?.position === position && selected.segment === segment;
        const droppable = !visible && canDropSegment(position, segment);
        const draggable = getDraggableSegments(char).includes(segment);
        const orientation = getSegmentOrientation(char, segment);
        // Drag metrics use the screen-space bounds after the equation rotates.
        const visualOrientation = rotatedClockwise
          ? flipOrientation(orientation)
          : orientation;
        const actionable =
          !interactionLocked &&
          ((visible && draggable) ||
            (!visible && droppable && selectionActive));

        if (!visible && !(droppable && selectionActive)) {
          return null;
        }

        return (
          <button
            key={segment}
            type="button"
            className={[
              "match-segment",
              orientation,
              char === "+" || char === "-"
                ? `operator-segment-${segment}`
                : `segment-${segment}`,
              visible ? "visible" : "placeholder",
              selectedHere ? "selected" : "",
              successDestination?.position === position &&
              successDestination.segment === segment
                ? "success-destination"
                : "",
            ].join(" ")}
            disabled={!actionable}
            aria-label={labels.segmentLabel.replace(
              "{segment}",
              String(segment + 1),
            )}
            data-position={position}
            data-segment={segment}
            onClick={() => onSegmentClick(position, segment, visible)}
            onPointerDown={(event) =>
              onSegmentPointerDown(
                event,
                position,
                segment,
                visible,
                visualOrientation,
              )
            }
            onPointerMove={onSegmentPointerMove}
            onPointerUp={onSegmentPointerUp}
            onPointerCancel={onSegmentPointerCancel}
            onContextMenu={(event) => event.preventDefault()}
            onDragStart={(event) => event.preventDefault()}
          >
            {visible ? (
              <MatchstickArt
                orientation={orientation}
                reversed={directions[segment]}
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function getSegmentOrientation(char: string, segment: number) {
  if (char === "+" || char === "-") {
    return segment === 1 ? "vertical" : "horizontal";
  }

  return segment === 0 || segment === 2 || segment === 3 || segment === 5
    ? "vertical"
    : "horizontal";
}

function flipOrientation(orientation: "horizontal" | "vertical") {
  return orientation === "horizontal" ? "vertical" : "horizontal";
}
