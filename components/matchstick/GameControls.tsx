import { type CopyText } from "./copy";
import { ActionIcon } from "./ActionIcon";

type GameControlsProps = {
  text: CopyText;
  lowLevel: boolean;
  timerEnabled: boolean;
  soundEnabled: boolean;
  showAnswers: boolean;
  listening: boolean;
  solved: boolean;
  interactionLocked: boolean;
  canUndo: boolean;
  onDifficultyChange: (lowLevel: boolean) => void;
  onTimerChange: (enabled: boolean) => void;
  onSoundChange: (enabled: boolean) => void;
  onNewPuzzle: () => void;
  onUndo: () => void;
  onToggleAnswers: () => void;
  onSharePuzzle: () => void;
  onVoiceAnswer: () => void;
};

export function GameControls({
  text,
  lowLevel,
  timerEnabled,
  soundEnabled,
  showAnswers,
  listening,
  solved,
  interactionLocked,
  canUndo,
  onDifficultyChange,
  onTimerChange,
  onSoundChange,
  onNewPuzzle,
  onUndo,
  onToggleAnswers,
  onSharePuzzle,
  onVoiceAnswer,
}: GameControlsProps) {
  return (
    <div className="play-controls">
      <div className="play-options">
        <div className="difficulty-switch" aria-label={text.difficulty}>
          <button
            type="button"
            aria-label={text.easyLabel}
            aria-pressed={lowLevel}
            onClick={() => onDifficultyChange(true)}
          >
            {text.easy}
          </button>
          <button
            type="button"
            aria-label={text.hardLabel}
            aria-pressed={!lowLevel}
            onClick={() => onDifficultyChange(false)}
          >
            {text.hard}
          </button>
        </div>
        <label className="check-row timer-row">
          <input
            type="checkbox"
            checked={timerEnabled}
            onChange={(event) => onTimerChange(event.target.checked)}
          />
          <span>{text.timer}</span>
        </label>
        <label className="check-row sound-row">
          <input
            type="checkbox"
            checked={soundEnabled}
            onChange={(event) => onSoundChange(event.target.checked)}
          />
          <span>{text.sound}</span>
        </label>
      </div>

      <div className="actions">
        <button type="button" aria-label={text.newPuzzle} onClick={onNewPuzzle}>
          <ActionIcon name="newPuzzle" />
        </button>
        <button
          type="button"
          aria-label={text.undo}
          disabled={!canUndo}
          onClick={onUndo}
        >
          <ActionIcon name="undo" />
        </button>
        <button
          type="button"
          aria-label={showAnswers ? text.hideAnswer : text.answer}
          onClick={onToggleAnswers}
        >
          <ActionIcon name={showAnswers ? "hideAnswer" : "answer"} />
        </button>
        <button type="button" aria-label={text.share} onClick={onSharePuzzle}>
          <ActionIcon name="share" />
        </button>
        <button
          type="button"
          aria-label={listening ? text.cancelVoice : text.voice}
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
