import { ActionIcon } from "./ActionIcon";
import { type CopyText } from "./copy";
import { puzzleDifficulties, type PuzzleDifficulty } from "@/lib/puzzleBook";

type GameControlsProps = {
  text: CopyText;
  difficulty: PuzzleDifficulty;
  timerEnabled: boolean;
  soundEnabled: boolean;
  showAnswers: boolean;
  listening: boolean;
  solved: boolean;
  interactionLocked: boolean;
  canUndo: boolean;
  onDifficultyChange: (difficulty: PuzzleDifficulty) => void;
  onTimerChange: (enabled: boolean) => void;
  onSoundChange: (enabled: boolean) => void;
  onNewPuzzle: () => void;
  onUndo: () => void;
  onToggleAnswers: () => void;
  onSharePuzzle: () => void;
  onVoiceAnswer: () => void;
};

const difficultyIcons = ["✏️", "📄", "📘", "🧮", "🎒", "🧠", "🧑‍🎓", "🎓", "🏛️"];

export function GameControls({
  text,
  difficulty,
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
  const difficultyIndex = puzzleDifficulties.indexOf(difficulty);
  const difficultyLevel = difficultyIndex;
  const difficultyIcon =
    difficultyIcons[difficultyIndex] ?? String(difficultyLevel);
  const canDecreaseDifficulty = difficultyIndex > 0;
  const canIncreaseDifficulty = difficultyIndex < puzzleDifficulties.length - 1;

  function changeDifficultyBy(delta: -1 | 1) {
    const nextDifficulty = puzzleDifficulties[difficultyIndex + delta];

    if (nextDifficulty) {
      onDifficultyChange(nextDifficulty);
    }
  }

  return (
    <div className="play-controls">
      <div className="play-options">
        <div className="difficulty-stepper" aria-label={text.difficulty}>
          <strong>{text.difficulty}</strong>
          <button
            type="button"
            aria-label={text.decreaseDifficulty}
            disabled={!canDecreaseDifficulty}
            onClick={() => changeDifficultyBy(-1)}
          >
            -
          </button>
          <span
            aria-label={text.difficultyValue
              .replace("{level}", String(difficultyLevel))
              .replace("{label}", text.difficultyLabels[difficulty])}
            title={text.difficultyDescriptions[difficulty]}
          >
            {difficultyIcon}
          </span>
          <button
            type="button"
            aria-label={text.increaseDifficulty}
            disabled={!canIncreaseDifficulty}
            onClick={() => changeDifficultyBy(1)}
          >
            +
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
