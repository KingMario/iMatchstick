import { type ReactNode, useEffect, useId, useRef } from "react";

type GameOverlayProps = {
  className?: string;
  open: boolean;
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
};

export function GameOverlay({
  className,
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
    // Leave touch gestures to the browser so transformed overflow keeps native
    // axis handling, momentum, bounds, and tap-to-stop behavior.
    const rotated = () =>
      document.documentElement.classList.contains("is-phone-portrait");
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
    body.addEventListener("wheel", wheel, { passive: false });
    return () => {
      body.removeEventListener("wheel", wheel);
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
      className={["game-overlay", className].filter(Boolean).join(" ")}
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
