import { type ReactNode } from "react";

export type ActionIconName =
  | "github"
  | "install"
  | "answer"
  | "hideAnswer"
  | "newPuzzle"
  | "share"
  | "undo"
  | "voice"
  | "settings"
  | "previous"
  | "next";

const drawings: Record<ActionIconName, ReactNode> = {
  github: (
    <path
      transform="scale(2)"
      fill="currentColor"
      stroke="none"
      d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.65 7.65 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"
    />
  ),
  install: (
    <>
      <path d="M19 4 7 3Q4 3 4 6l1 21q0 2 3 2l15-1q3 0 3-3l-1-8M12 25l5-1" />
      <path d="m25 2-1 12m-5-6 11 1" />
    </>
  ),
  previous: <path d="M22 5Q16 9 9 16q5 6 13 11" />,
  next: <path d="M10 5q8 5 13 11-7 7-13 11" />,
  answer: (
    <>
      <path className="icon-paper" d="M19 3c-5-1-9 3-8 8s7 7 11 4 5-10-3-12Z" />
      <path d="m12 15-8 10 1 3 4-1 1-4 4-1 2-4" />
      <path d="M19 7c-3 0-4 4-1 5 4 1 5-5 1-5Z" />
    </>
  ),
  hideAnswer: (
    <>
      <path d="M3 16s5-8 13-8c7 0 12 8 12 8s-5 8-12 8c-7 0-13-8-13-8Z" />
      <path d="M16 12c-6 0-5 9 0 9 6 0 6-9 0-9Z" />
      <path className="icon-red" d="m5 4 22 24" />
    </>
  ),
  newPuzzle: (
    <>
      <path d="M5 13C6 3 22 1 27 12m-1-7 1 7-7-1" />
      <path d="M27 19C25 29 10 31 5 20m0 7v-7l7 1" />
    </>
  ),
  undo: <path d="m11 5-7 7 8 6M5 12c8-1 22-2 23 7 1 7-8 9-14 7" />,
  voice: (
    <>
      <path
        className="icon-paper"
        d="M16 3c-5 0-6 4-6 8v4c0 8 12 8 12 0v-4c0-4-1-8-6-8Z"
      />
      <path d="m11 9 5 1m-5 4 5 1M5 15c-1 13 23 14 22-1M16 25l-1 4m-5 0 11 1" />
      <path className="icon-red" d="m26 5 2-2" />
    </>
  ),
  share: (
    <>
      <path d="m5 17-1 10c8 1 15 1 24-1l-1-9M16 21l1-18m-7 7 7-7 7 8" />
      <path className="icon-red" d="m9 30 7-1" />
    </>
  ),
  settings: (
    <>
      <path d="m13 3 6 .2.8 4 3 1.8 3.8-1.2 2.8 5.2-3 2.8v3.4l2.8 2.8-3 5.1-3.8-1.3-3 1.6-1 3.7-5.8-.2-.8-3.8-3-1.8-3.7 1.1-2.8-5.2 3-2.6.1-3.5-2.8-2.9 3.1-4.9 3.7 1.2 3-1.7Z" />
      <path d="M16 11c-7-.2-7 10 0 10 6.8 0 6.9-10.2 0-10Z" />
    </>
  ),
};

export function ActionIcon({ name }: { name: ActionIconName }) {
  return (
    <svg
      className="action-icon action-icon-svg"
      data-icon={name}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {drawings[name]}
    </svg>
  );
}
