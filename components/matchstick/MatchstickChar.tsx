import { type PointerEvent } from "react";
import {
  getDraggableSegments,
  getDroppableSegments,
  getVisibleSegments,
  type SelectedSegment,
} from "@/lib/matchstick";

type MatchstickCharProps = {
  char: string;
  position: number;
  selected: SelectedSegment | null;
  selectionActive: boolean;
  locked: boolean;
  onSegmentClick: (position: number, segment: number, visible: boolean) => void;
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
  selected,
  selectionActive,
  locked,
  onSegmentClick,
  onSegmentPointerDown,
  onSegmentPointerMove,
  onSegmentPointerUp,
  onSegmentPointerCancel,
  labels,
}: MatchstickCharProps) {
  if (char === "=") {
    return (
      <div className="match-char equal-char" aria-label={labels.equalsLabel}>
        <span />
        <span />
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
        const droppable = getDroppableSegments(char).includes(segment);
        const draggable = getDraggableSegments(char).includes(segment);
        const orientation = getSegmentOrientation(char, segment);
        const actionable =
          !locked &&
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
                orientation,
              )
            }
            onPointerMove={onSegmentPointerMove}
            onPointerUp={onSegmentPointerUp}
            onPointerCancel={onSegmentPointerCancel}
            onContextMenu={(event) => event.preventDefault()}
            onDragStart={(event) => event.preventDefault()}
          />
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
