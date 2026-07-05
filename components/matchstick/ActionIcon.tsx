export type ActionIconName =
  "answer" | "hideAnswer" | "newPuzzle" | "share" | "undo" | "voice";

const actionIcons: Record<Exclude<ActionIconName, "share">, string> = {
  answer: "🔑",
  hideAnswer: "🙈",
  newPuzzle: "🎲",
  undo: "↩️",
  voice: "🎙️",
};

export function ActionIcon({ name }: { name: ActionIconName }) {
  if (name === "share") {
    return (
      <svg
        className="action-icon action-icon-svg"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.2"
        />
        <path
          d="M12 15V4m0 0 4 4m-4-4-4 4"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.2"
        />
      </svg>
    );
  }

  return (
    <span className="action-icon" aria-hidden="true">
      {actionIcons[name]}
    </span>
  );
}
