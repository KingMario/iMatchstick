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
  const titleId = useId();

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
      <div className="overlay-body">{children}</div>
    </dialog>
  );
}
