import { ActionIcon } from "./ActionIcon";

type Props = {
  disabled: boolean;
  label: string;
  onUndo: () => void;
};

export function UndoButton({ disabled, label, onUndo }: Props) {
  return (
    <button
      type="button"
      className="undo-button"
      disabled={disabled}
      aria-label={label}
      title={label}
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onUndo();
      }}
    >
      <ActionIcon name="undo" />
    </button>
  );
}
