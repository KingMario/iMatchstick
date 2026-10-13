import { ActionIcon } from "./ActionIcon";
import { type CopyText } from "./copy";
import { UndoButton } from "./UndoButton";

type GameControlsProps = {
  isLoading: boolean;
  text: CopyText;
  showAnswers: boolean;
  listening: boolean;
  solved: boolean;
  interactionLocked: boolean;
  onNewPuzzle: () => void;
  onUndo: () => void;
  onToggleAnswers: () => void;
  onVoiceAnswer: () => void;
};

export function GameControls({
  isLoading,
  text,
  showAnswers,
  listening,
  solved,
  interactionLocked,
  onNewPuzzle,
  onUndo,
  onToggleAnswers,
  onVoiceAnswer,
}: GameControlsProps) {
  return (
    <div className="play-controls">
      <div className="actions">
        <button
          type="button"
          aria-label={text.newPuzzle}
          title={text.newPuzzle}
          onClick={onNewPuzzle}
          disabled={isLoading}
        >
          <ActionIcon name="newPuzzle" />
        </button>
        <UndoButton
          disabled={!solved || isLoading}
          label={text.undo}
          onUndo={onUndo}
        />
        <button
          type="button"
          aria-label={showAnswers ? text.hideAnswer : text.answer}
          title={text.answer}
          aria-haspopup="dialog"
          onClick={onToggleAnswers}
          disabled={isLoading}
        >
          <ActionIcon name={showAnswers ? "hideAnswer" : "answer"} />
        </button>
        <button
          type="button"
          aria-label={listening ? text.cancelVoice : text.voice}
          title={listening ? text.cancelVoice : text.voice}
          aria-pressed={listening}
          disabled={solved || (interactionLocked && !listening)}
          onClick={onVoiceAnswer}
        >
          <ActionIcon name="voice" />
        </button>
      </div>
    </div>
  );
}
