import { type RefObject, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  count: number;
  total: number;
  label: string;
  celebrate: boolean;
  portrait: boolean;
  equationRef: RefObject<HTMLDivElement | null>;
};
type Flight = {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  angle: number;
};

export function AnswerProgress({
  count,
  total,
  label,
  celebrate,
  portrait,
  equationRef,
}: Props) {
  const [displayed, setDisplayed] = useState(count);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [arrived, setArrived] = useState(false);
  const digitRef = useRef<HTMLElement>(null);
  const ghostRef = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    setArrived(false);
    if (
      !celebrate ||
      count <= displayed ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setDisplayed(count);
      setFlight(null);
      return;
    }
    const source = equationRef.current
      ?.querySelector(".equation-success-check")
      ?.getBoundingClientRect();
    const target = digitRef.current?.getBoundingClientRect();
    if (!source || !target) {
      setDisplayed(count);
      return;
    }
    setFlight({
      fromX: source.x + source.width / 2,
      fromY: source.y + source.height / 2,
      toX: target.x + target.width / 2,
      toY: target.y + target.height / 2,
      angle: portrait ? 90 : 0,
    });
    // The displayed count advances only on arrival, not as an effect dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, celebrate, portrait, equationRef]);

  useLayoutEffect(() => {
    if (!flight || !ghostRef.current) return;
    const finish = () => {
      setDisplayed(count);
      setFlight(null);
      setArrived(true);
    };
    const start = `translate(-50%, -50%) rotate(${flight.angle}deg)`;
    const end = `translate(calc(-50% + ${flight.toX - flight.fromX}px), calc(-50% + ${flight.toY - flight.fromY}px)) rotate(${flight.angle}deg) scale(.7)`;
    const animation = ghostRef.current.animate(
      [
        { transform: start, offset: 0 },
        {
          transform: start,
          offset: 600 / 1240,
          easing: "cubic-bezier(.3,0,.2,1)",
        },
        { transform: end, offset: 1 },
      ],
      { duration: 1240, fill: "forwards" },
    );
    animation.onfinish = finish;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const visibility = () => {
      if (document.hidden) finish();
    };
    window.addEventListener("resize", finish);
    window.visualViewport?.addEventListener("resize", finish);
    reduced.addEventListener("change", finish);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      animation.onfinish = null;
      animation.cancel();
      window.removeEventListener("resize", finish);
      window.visualViewport?.removeEventListener("resize", finish);
      reduced.removeEventListener("change", finish);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [flight, count]);

  return (
    <>
      <span
        className="answer-progress"
        aria-label={`${label}: ${displayed}/${total}`}
      >
        <b
          ref={digitRef}
          className={arrived && celebrate ? "progress-success" : ""}
        >
          {displayed}
        </b>
        /{total}
      </span>
      {flight
        ? createPortal(
            <span
              ref={ghostRef}
              className="progress-flying-check"
              aria-hidden="true"
              style={{ left: flight.fromX, top: flight.fromY }}
            >
              ✓
            </span>,
            document.body,
          )
        : null}
    </>
  );
}
