import { type ReactNode, useEffect, useId, useRef } from "react";

type GameOverlayProps = {
  open: boolean;
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
};

export function GameOverlay({
  open,
  title,
  closeLabel,
  onClose,
  children,
}: GameOverlayProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    let gesture: {
      x: number;
      y: number;
      scroll: number;
      axis?: "x" | "y";
    } | null = null;
    let suppressClickUntil = 0;
    const rotated = () =>
      document.documentElement.classList.contains("is-phone-portrait");
    const start = (event: TouchEvent) => {
      suppressClickUntil = 0;
      gesture =
        rotated() && event.touches.length === 1
          ? {
              x: event.touches[0].clientX,
              y: event.touches[0].clientY,
              scroll: body.scrollTop,
            }
          : null;
    };
    const move = (event: TouchEvent) => {
      if (!gesture || !rotated()) return;
      if (event.touches.length !== 1) {
        gesture = null;
        return;
      }
      event.preventDefault();
      const dx = event.touches[0].clientX - gesture.x;
      const dy = event.touches[0].clientY - gesture.y;
      if (Math.hypot(dx, dy) < 6) return;
      gesture.axis ??= Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
      suppressClickUntil = performance.now() + 500;
      // Clockwise rotation maps local upward dragging to screen-right dragging.
      if (gesture.axis === "x") body.scrollTop = gesture.scroll + dx;
    };
    const end = () => {
      gesture = null;
    };
    const click = (event: MouseEvent) => {
      if (event.detail && performance.now() < suppressClickUntil) {
        event.preventDefault();
        event.stopPropagation();
      }
      suppressClickUntil = 0;
    };
    const wheel = (event: WheelEvent) => {
      if (!rotated()) return;
      event.preventDefault();
      const scale =
        event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? body.clientHeight
            : 1;
      const delta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
          ? -event.deltaX
          : event.deltaY;
      body.scrollTop += delta * scale;
    };
    body.addEventListener("touchstart", start, { passive: true });
    body.addEventListener("touchmove", move, { passive: false });
    body.addEventListener("touchend", end);
    body.addEventListener("touchcancel", end);
    body.addEventListener("click", click, true);
    body.addEventListener("wheel", wheel, { passive: false });
    window.addEventListener("resize", end);
    return () => {
      body.removeEventListener("touchstart", start);
      body.removeEventListener("touchmove", move);
      body.removeEventListener("touchend", end);
      body.removeEventListener("touchcancel", end);
      body.removeEventListener("click", click, true);
      body.removeEventListener("wheel", wheel);
      window.removeEventListener("resize", end);
    };
  }, []);

  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog?.open) dialog?.showModal();
    if (!open && dialog?.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="game-overlay"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          onClose();
      }}
    >
      <header className="overlay-header">
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          className="overlay-close"
          aria-label={closeLabel}
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <div ref={bodyRef} className="overlay-body">
        {children}
      </div>
    </dialog>
  );
}
