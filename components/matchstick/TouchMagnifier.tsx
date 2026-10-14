"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  getMagnifierLocalPoint,
  getMagnifierMatrix,
  getMagnifierPlacement,
  magnifierZoom,
  type MagnifierPoint,
  type MagnifierRect,
  type MagnifierViewport,
} from "../../lib/magnifier";
import { MatchstickArt } from "./MatchstickArt";

export type TouchMagnifierProps = {
  surface: HTMLElement | null;
  /** Rendered title/header supplying the held logical height for this press. */
  anchor: HTMLElement | null;
  /** Raw finger coordinates; never replace these with a snapped target. */
  point: MagnifierPoint;
  rotatedClockwise: boolean;
  stick: MagnifierPoint & {
    orientation: "horizontal" | "vertical";
    snapped?: boolean;
    reversed?: boolean;
    length?: number;
  };
};

/** Copy the rendered board, including computed slot sizes and placeholder images.
 * Classes and data attributes are removed so the copy can never enter game queries.
 * Event listeners are not cloned. Every copied node is decorative and unfocusable.
 */
export function copyMagnifierSurface(source: HTMLElement): HTMLElement {
  const clone = source.cloneNode(true) as HTMLElement;
  const originals = [
    source,
    ...Array.from(source.querySelectorAll<HTMLElement | SVGElement>("*")),
  ];
  const copies = [
    clone,
    ...Array.from(clone.querySelectorAll<HTMLElement | SVGElement>("*")),
  ];
  originals.forEach((original, index) => {
    const copy = copies[index];
    const computed = window.getComputedStyle(original);
    for (const attribute of Array.from(copy.attributes)) {
      if (
        attribute.name === "id" ||
        attribute.name === "class" ||
        attribute.name === "name" ||
        attribute.name === "for" ||
        attribute.name.startsWith("data-") ||
        attribute.name.startsWith("aria-") ||
        attribute.name.startsWith("on")
      )
        copy.removeAttribute(attribute.name);
    }
    for (let i = 0; i < computed.length; i += 1) {
      const property = computed[i];
      copy.style.setProperty(property, computed.getPropertyValue(property));
    }
    copy.style.setProperty("pointer-events", "none", "important");
    copy.style.setProperty("animation", "none", "important");
    copy.style.setProperty("transition", "none", "important");
    copy.setAttribute("tabindex", "-1");
    if (copy.tagName.toLowerCase() === "button")
      copy.setAttribute("disabled", "");
  });
  clone.setAttribute("aria-hidden", "true");
  clone.setAttribute("inert", "");
  Object.assign(clone.style, {
    position: "absolute",
    left: "0px",
    top: "0px",
    right: "auto",
    bottom: "auto",
    margin: "0px",
    transform: "none",
    transformOrigin: "0 0",
    translate: "none",
    rotate: "none",
    scale: "none",
  });
  return clone;
}

function borderSize(element: HTMLElement) {
  const css = window.getComputedStyle(element);
  const dimension = (axis: "width" | "height") => {
    const base = parseFloat(css[axis]);
    const sides = axis === "width" ? ["Left", "Right"] : ["Top", "Bottom"];
    const extra =
      css.boxSizing === "border-box"
        ? 0
        : sides.reduce(
            (sum, side) =>
              sum +
              (parseFloat(
                css.getPropertyValue(`padding-${side.toLowerCase()}`),
              ) || 0) +
              (parseFloat(
                css.getPropertyValue(`border-${side.toLowerCase()}-width`),
              ) || 0),
            0,
          );
    return Number.isFinite(base)
      ? base + extra
      : axis === "width"
        ? element.offsetWidth
        : element.offsetHeight;
  };
  return { width: dimension("width"), height: dimension("height") };
}

/** Mount only during a phone touch drag. This component never changes input state. */
export function TouchMagnifier({
  surface,
  anchor,
  point,
  rotatedClockwise,
  stick,
}: TouchMagnifierProps) {
  const scene = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<MagnifierViewport | null>(null);
  const [anchorRect, setAnchorRect] = useState<MagnifierRect | null>(null);
  const [revision, setRevision] = useState(0);
  useLayoutEffect(() => {
    // Snapshot the title-area height for this hold, even if a voice caption
    // expires or status copy reflows. Horizontal placement follows the finger.
    setAnchorRect(anchor?.getBoundingClientRect() ?? null);
    const measure = () => {
      const view = window.visualViewport;
      const css = window.getComputedStyle(document.documentElement);
      const inset = (side: string) =>
        parseFloat(css.getPropertyValue(`--magnifier-safe-${side}`)) || 0;
      setViewport({
        width: view?.width ?? window.innerWidth,
        height: view?.height ?? window.innerHeight,
        left: view?.offsetLeft ?? 0,
        top: view?.offsetTop ?? 0,
        safeArea: {
          top: inset("top"),
          right: inset("right"),
          bottom: inset("bottom"),
          left: inset("left"),
        },
      });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    window.visualViewport?.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("scroll", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      window.visualViewport?.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("scroll", measure);
    };
  }, [anchor]);

  const placement =
    viewport && anchorRect
      ? getMagnifierPlacement(anchorRect, viewport, point, rotatedClockwise)
      : null;
  const ready = Boolean(placement && surface);
  useLayoutEffect(() => {
    const container = scene.current;
    if (!surface || !container || !ready) return;
    let frame = 0;
    const refresh = () => {
      container.replaceChildren(copyMagnifierSurface(surface));
      setRevision((value) => value + 1);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(refresh);
    };
    refresh();
    const observer = new MutationObserver(schedule);
    observer.observe(surface, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
    const resize = new ResizeObserver(schedule);
    resize.observe(surface);
    window.addEventListener("resize", schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      resize.disconnect();
      window.removeEventListener("resize", schedule);
      container.replaceChildren();
    };
  }, [surface, ready, rotatedClockwise]);

  useLayoutEffect(() => {
    const clone = scene.current?.firstElementChild as HTMLElement | null;
    if (!surface || !clone || !placement) return;
    const matrix = getMagnifierMatrix(
      surface.getBoundingClientRect(),
      borderSize(surface),
      point,
      rotatedClockwise,
      placement.size,
    );
    clone.style.transform = `matrix(${matrix.join(",")})`;
  }, [surface, point, rotatedClockwise, placement, revision]);

  if (!surface || !placement) return null;
  const moving = getMagnifierLocalPoint(stick, point, placement.size);
  const length = (stick.length ?? 42) * magnifierZoom;
  const thickness = (length * 68) / 240;
  return createPortal(
    <div
      className="touch-magnifier"
      aria-hidden="true"
      inert
      data-testid="touch-magnifier"
      style={{
        left: placement.left,
        top: placement.top,
        width: placement.size,
        height: placement.size,
      }}
    >
      <div className="touch-magnifier-scene" ref={scene} />
      <div
        className={`touch-magnifier-stick${stick.snapped ? " is-snapped" : ""}`}
        style={{
          left: moving.x,
          top: moving.y,
          width: stick.orientation === "horizontal" ? length : thickness,
          height: stick.orientation === "vertical" ? length : thickness,
        }}
      >
        <MatchstickArt
          orientation={stick.orientation}
          reversed={stick.reversed}
        />
      </div>
      <span className="touch-magnifier-crosshair" />
    </div>,
    document.body,
  );
}
