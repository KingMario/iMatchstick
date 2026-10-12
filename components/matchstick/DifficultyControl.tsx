import { ActionIcon } from "./ActionIcon";
import { type CopyText } from "./copy";
import { puzzleDifficulties, type PuzzleDifficulty } from "@/lib/puzzleBook";

const difficultyIcons = ["✏️", "📄", "📘", "🧮", "🎒", "🧠", "🧑‍🎓", "🎓", "🏛️"];

type Props = {
  isLoading: boolean;
  text: CopyText;
  difficulty: PuzzleDifficulty;
  onDifficultyChange: (difficulty: PuzzleDifficulty) => void;
};

export function DifficultyControl({
  isLoading,
  text,
  difficulty,
  onDifficultyChange,
}: Props) {
  const index = puzzleDifficulties.indexOf(difficulty);
  function changeBy(delta: -1 | 1) {
    const next = puzzleDifficulties[index + delta];
    if (next) onDifficultyChange(next);
  }
  return (
    <div className="difficulty-stepper" aria-label={text.difficulty}>
      <strong>{text.difficulty}</strong>
      <button
        type="button"
        aria-label={text.decreaseDifficulty}
        disabled={isLoading || index <= 0}
        onClick={() => changeBy(-1)}
      >
        <ActionIcon name="previous" />
      </button>
      <span
        aria-label={text.difficultyValue
          .replace("{level}", String(index))
          .replace("{label}", text.difficultyLabels[difficulty])}
        title={text.difficultyDescriptions[difficulty]}
      >
        {difficultyIcons[index] ?? String(index)}
      </span>
      <button
        type="button"
        aria-label={text.increaseDifficulty}
        disabled={isLoading || index >= puzzleDifficulties.length - 1}
        onClick={() => changeBy(1)}
      >
        <ActionIcon name="next" />
      </button>
    </div>
  );
}
