import { ActionIcon } from "./ActionIcon";
import { type CopyText } from "./copy";
import { puzzleDifficulties, type PuzzleDifficulty } from "@/lib/puzzleBook";

type GameControlsProps = {
  isLoading: boolean;
  text: CopyText;
  difficulty: PuzzleDifficulty;
  showAnswers: boolean;
  listening: boolean;
  solved: boolean;
  interactionLocked: boolean;
  canUndo: boolean;
  onDifficultyChange: (difficulty: PuzzleDifficulty) => void;
  onNewPuzzle: () => void;
  onUndo: () => void;
  onToggleAnswers: () => void;
  onOpenSettings: () => void;
  onVoiceAnswer: () => void;
};

const difficultyIcons = ["✏️", "📄", "📘", "🧮", "🎒", "🧠", "🧑‍🎓", "🎓", "🏛️"];

export function GameControls({
  isLoading,
  text,
  difficulty,
  showAnswers,
  listening,
  solved,
  interactionLocked,
  canUndo,
  onDifficultyChange,
  onNewPuzzle,
  onUndo,
  onToggleAnswers,
  onOpenSettings,
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
            disabled={isLoading || !canDecreaseDifficulty}
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
            disabled={isLoading || !canIncreaseDifficulty}
            onClick={() => changeDifficultyBy(1)}
          >
            +
          </button>
        </div>
      </div>

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
        <button
          type="button"
          aria-label={text.undo}
          title={text.undo}
          disabled={!canUndo}
          onClick={onUndo}
        >
          <ActionIcon name="undo" />
        </button>
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
        <button
          type="button"
          aria-label={text.more}
          title={text.more}
          aria-haspopup="dialog"
          onClick={onOpenSettings}
        >
          <span className="action-icon" aria-hidden="true">
            ⋯
          </span>
        </button>
      </div>
    </div>
  );
}
