import { canTransferMatchstick } from "./matchstickSlots";
import {
  getVisibleSegments,
  isValidEquation,
  type SelectedSegment,
} from "./matchstick";

export type AcademyText = { zh: string; en: string };
export type AcademyMode =
  "recognition" | "add" | "remove" | "self" | "cross" | "symbol" | "equation";
export type AcademyOperation =
  "recognize" | "add" | "remove" | "self" | "cross" | "symbol";
export type AcademyLesson = {
  id: string;
  chapterId: number;
  mode: AcademyMode;
  initial: string[];
  target: string[];
  choices?: string[];
  prompt: AcademyText;
  hint: AcademyText;
  hintLevel: 0 | 1 | 2;
  permitted: { operation: AcademyOperation; editablePositions: number[] };
};
export type AcademyChapter = {
  id: number;
  title: AcademyText;
  description: AcademyText;
};
export type AcademyMovement = {
  from: SelectedSegment | null;
  to: SelectedSegment | null;
};
export type AcademyValidation = {
  reason: "invalid-shape" | "wrong-target" | "not-allowed" | "success";
  cards: string[];
};

export const academyChapters: AcademyChapter[] = [
  {
    id: 1,
    title: { zh: "认识数字", en: "Meet the digits" },
    description: {
      zh: "先观察火柴组成的数字，再选出答案。",
      en: "Look at each matchstick digit and choose its name.",
    },
  },
  {
    id: 2,
    title: { zh: "添一根，取一根", en: "Add and remove" },
    description: {
      zh: "借助火柴盒，添上或取走一根火柴。",
      en: "Use the matchbox to add or remove exactly one stick.",
    },
  },
  {
    id: 3,
    title: { zh: "数字里面搬家", en: "Move within a digit" },
    description: {
      zh: "火柴不离开这张数字卡，只换一个位置。",
      en: "Keep the stick on the same digit card and move it to an empty slot.",
    },
  },
  {
    id: 4,
    title: { zh: "两张卡片接力", en: "Trade between cards" },
    description: {
      zh: "从一张数字卡取一根，送到另一张数字卡。这里不是算式。",
      en: "Move a stick from one digit card to another. These are separate cards, not an equation.",
    },
  },
  {
    id: 5,
    title: { zh: "符号也来帮忙", en: "Meet the signs" },
    description: {
      zh: "在数字卡与加减号卡之间移动一根火柴。",
      en: "Move one stick between a digit card and a plus or minus card.",
    },
  },
  {
    id: 6,
    title: { zh: "修好小算式", en: "Fix an equation" },
    description: {
      zh: "用学到的方法移动一根，让算式成立。等号保持不动。",
      en: "Use what you learned to fix an equation in one move. The equals sign stays fixed.",
    },
  },
];

function lesson(
  chapterId: number,
  index: number,
  mode: AcademyMode,
  initial: string,
  target: string,
  operation: AcademyOperation,
  prompt: AcademyText,
  hint: AcademyText,
  editablePositions?: number[],
  choices?: string[],
): AcademyLesson {
  return {
    id: `academy-${chapterId}-${index}`,
    chapterId,
    mode,
    initial: [...initial],
    target: [...target],
    choices,
    prompt,
    hint,
    hintLevel: index <= 2 ? 2 : index === 3 ? 1 : 0,
    permitted: {
      operation,
      editablePositions:
        editablePositions ??
        [...initial].flatMap((char, position) =>
          char === "=" ? [] : [position],
        ),
    },
  };
}
const t = (zh: string, en: string): AcademyText => ({ zh, en });

/** Authored curriculum; independent cards are deliberately not fake equations. */
export const academyLessons: AcademyLesson[] = [
  lesson(
    1,
    1,
    "recognition",
    "1",
    "1",
    "recognize",
    t("这是数字几？", "Which digit is this?"),
    t("右边两根竖火柴组成 1。", "Two upright sticks on the right make 1."),
    [],
    ["4", "1", "7"],
  ),
  lesson(
    1,
    2,
    "recognition",
    "7",
    "7",
    "recognize",
    t(
      "多了顶部的一根，现在是几？",
      "With a stick across the top, which digit is this?",
    ),
    t("1 的顶部加一根，就像 7。", "A top stick above 1 makes 7."),
    [],
    ["7", "1", "9"],
  ),
  lesson(
    1,
    3,
    "recognition",
    "8",
    "8",
    "recognize",
    t(
      "七个位置都摆上了火柴，这是几？",
      "All seven slots are filled. Which digit is it?",
    ),
    t(
      "上下两个圈，中间也有一根。",
      "Look for two loops and a stick across the middle.",
    ),
    [],
    ["0", "6", "8"],
  ),
  lesson(
    1,
    4,
    "recognition",
    "2",
    "2",
    "recognize",
    t(
      "仔细看下半边：这是几？",
      "Look closely at the lower half. Which digit is this?",
    ),
    t(
      "2 的下半边，竖火柴在左侧。",
      "The lower upright stick of 2 is on the left.",
    ),
    [],
    ["3", "2", "5"],
  ),
  lesson(
    2,
    1,
    "add",
    "1",
    "7",
    "add",
    t(
      "从火柴盒拿一根，把 1 变成 7。",
      "Take one stick from the matchbox to turn 1 into 7.",
    ),
    t("把新火柴放在顶部。", "Put the new stick across the top."),
  ),
  lesson(
    2,
    2,
    "remove",
    "7",
    "1",
    "remove",
    t(
      "取走一根放回火柴盒，把 7 变成 1。",
      "Return one stick to the matchbox to turn 7 into 1.",
    ),
    t("取走顶部的横火柴。", "Remove the horizontal stick at the top."),
  ),
  lesson(
    2,
    3,
    "add",
    "5",
    "6",
    "add",
    t(
      "从火柴盒添一根，把 5 变成 6。",
      "Add one stick from the matchbox to turn 5 into 6.",
    ),
    t("看看左下角的空位。", "Look at the empty lower-left slot."),
  ),
  lesson(
    2,
    4,
    "remove",
    "8",
    "9",
    "remove",
    t(
      "取走一根放回火柴盒，把 8 变成 9。",
      "Remove one stick to the matchbox to turn 8 into 9.",
    ),
    t("9 的左下角没有竖火柴。", "9 has no lower-left upright stick."),
  ),
  lesson(
    3,
    1,
    "self",
    "2",
    "3",
    "self",
    t(
      "只在这张卡里移动一根，把 2 变成 3。",
      "Move one stick within this card to turn 2 into 3.",
    ),
    t(
      "把左下的火柴移到右下。",
      "Move the lower-left stick to the lower right.",
    ),
  ),
  lesson(
    3,
    2,
    "self",
    "3",
    "5",
    "self",
    t(
      "只在这张卡里移动一根，把 3 变成 5。",
      "Move one stick within this card to turn 3 into 5.",
    ),
    t(
      "把右上的火柴移到左上。",
      "Move the upper-right stick to the upper left.",
    ),
  ),
  lesson(
    3,
    3,
    "self",
    "6",
    "9",
    "self",
    t(
      "在数字里移动一根，把 6 变成 9。",
      "Move one stick within the digit to turn 6 into 9.",
    ),
    t(
      "左下的一根可以补上右上空位。",
      "The lower-left stick can fill the upper-right slot.",
    ),
  ),
  lesson(
    3,
    4,
    "self",
    "0",
    "6",
    "self",
    t(
      "在数字里移动一根，把 0 变成 6。",
      "Move one stick within the digit to turn 0 into 6.",
    ),
    t("让右上的火柴搬到中间。", "Move the upper-right stick to the middle."),
  ),
  lesson(
    4,
    1,
    "cross",
    "75",
    "16",
    "cross",
    t(
      "两张独立数字卡：把 7、5 变成 1、6。",
      "Two separate digit cards: turn 7 and 5 into 1 and 6.",
    ),
    t(
      "把 7 顶部的一根送到 5 的左下角。",
      "Move the top stick of 7 to the lower left of 5.",
    ),
  ),
  lesson(
    4,
    2,
    "cross",
    "95",
    "39",
    "cross",
    t(
      "跨卡移动一根，把 9、5 变成 3、9。",
      "Move a stick between cards: turn 9 and 5 into 3 and 9.",
    ),
    t(
      "第一张卡左上的一根，搬到第二张卡右上。",
      "Move the first card's upper-left stick to the second card's upper right.",
    ),
  ),
  lesson(
    4,
    3,
    "cross",
    "16",
    "75",
    "cross",
    t(
      "跨卡移动一根，把 1、6 变成 7、5。",
      "Move a stick between cards: turn 1 and 6 into 7 and 5.",
    ),
    t(
      "这次从右边的卡片取火柴。",
      "This time, take a stick from the right-hand card.",
    ),
  ),
  lesson(
    4,
    4,
    "cross",
    "39",
    "95",
    "cross",
    t(
      "跨卡移动一根，把 3、9 变成 9、5。",
      "Move a stick between cards: turn 3 and 9 into 9 and 5.",
    ),
    t(
      "把第二张卡右上的一根移到第一张卡左上。",
      "Move the second card's upper-right stick to the first card's upper left.",
    ),
  ),
  lesson(
    5,
    1,
    "symbol",
    "+5",
    "-6",
    "symbol",
    t(
      "独立卡片：把 +、5 变成 −、6。",
      "Separate cards: turn + and 5 into − and 6.",
    ),
    t(
      "加号的竖火柴可以填到 5 的左下角。",
      "Move the plus sign's upright stick to the lower left of 5.",
    ),
  ),
  lesson(
    5,
    2,
    "symbol",
    "6-",
    "5+",
    "symbol",
    t("把 6、− 变成 5、+。", "Turn 6 and − into 5 and +."),
    t(
      "从 6 的左下角取一根，让减号变加号。",
      "Take the lower-left stick from 6 to make the minus a plus.",
    ),
  ),
  lesson(
    5,
    3,
    "symbol",
    "-9",
    "+5",
    "symbol",
    t("把 −、9 变成 +、5。", "Turn − and 9 into + and 5."),
    t(
      "9 右上的一根可以让减号变加号。",
      "The upper-right stick of 9 can turn the minus into a plus.",
    ),
  ),
  lesson(
    5,
    4,
    "symbol",
    "8-",
    "9+",
    "symbol",
    t("把 8、− 变成 9、+。", "Turn 8 and − into 9 and +."),
    t(
      "8 比 9 多的那根，正好能补到减号上。",
      "The stick that 8 has and 9 doesn't can complete the plus sign.",
    ),
  ),
  lesson(
    6,
    1,
    "equation",
    "2+1=2",
    "2+1=3",
    "self",
    t(
      "只改等号右边的 2，移动一根修好算式。",
      "Move one stick only in the final 2 to fix the equation.",
    ),
    t(
      "把最后一个 2 的左下火柴移到右下。",
      "Move the final 2's lower-left stick to the lower right.",
    ),
    [4],
  ),
  lesson(
    6,
    2,
    "equation",
    "2+1=4",
    "3+1=4",
    "self",
    t(
      "只改第一个 2，移动一根修好算式。",
      "Move one stick only in the first 2 to fix the equation.",
    ),
    t("让第一个 2 变成 3。", "Turn the first 2 into 3."),
    [0],
  ),
  lesson(
    6,
    3,
    "equation",
    "7+5=7",
    "1+6=7",
    "cross",
    t(
      "从第一个数字移一根到第二个数字，修好算式。",
      "Move one stick from the first digit to the second to fix the equation.",
    ),
    t(
      "7 顶部的一根移到 5 的左下角。",
      "Move the first 7's top stick to the lower left of 5.",
    ),
    [0, 2],
  ),
  lesson(
    6,
    4,
    "equation",
    "9+5=3",
    "9-6=3",
    "symbol",
    t(
      "在加减号和 5 之间移动一根，修好算式。",
      "Move one stick between the sign and 5 to fix the equation.",
    ),
    t("加号少一根，5 多一根。", "The plus loses one stick; 5 gains one."),
    [1, 2],
  ),
];

const glyphs = [..."0123456789+-"];
const glyphByPattern = new Map(
  glyphs.map((char) => [getVisibleSegments(char).map(Number).join(""), char]),
);
const isDigit = (char: string) => /^\d$/.test(char);
const isSign = (char: string) => char === "+" || char === "-";

/** All occupied slots, including ones whose movement would make an invalid shape. */
export function getAcademyVisibleSegments(
  cards: readonly string[],
): SelectedSegment[] {
  return cards.flatMap((char, position) =>
    getVisibleSegments(char).flatMap((visible, segment) =>
      visible ? [{ position, segment }] : [],
    ),
  );
}
/** All empty slots, without the game engine's equation-only move filters. */
export function getAcademyEmptySegments(
  cards: readonly string[],
): SelectedSegment[] {
  return cards.flatMap((char, position) =>
    getVisibleSegments(char).flatMap((visible, segment) =>
      !visible ? [{ position, segment }] : [],
    ),
  );
}
function endpointExists(
  cards: readonly string[],
  endpoint: SelectedSegment,
  occupied: boolean,
) {
  return (
    Number.isInteger(endpoint.position) &&
    Number.isInteger(endpoint.segment) &&
    endpoint.position >= 0 &&
    endpoint.segment >= 0 &&
    getVisibleSegments(cards[endpoint.position] ?? "")[endpoint.segment] ===
      occupied
  );
}

/** Validate a single move from the authored starting state. Never mutates the lesson. */
export function validateAcademyMove(
  lesson: AcademyLesson,
  movement: AcademyMovement,
): AcademyValidation {
  const fail = (reason: AcademyValidation["reason"]): AcademyValidation => ({
    reason,
    cards: [...lesson.initial],
  });
  const { from, to } = movement;
  const { operation, editablePositions } = lesson.permitted;
  if (operation === "recognize" || (!from && !to)) return fail("not-allowed");
  // Equals signs are a fixed teaching aid and are never draggable/drop targets.
  if (
    [from, to].some((point) => point && lesson.initial[point.position] === "=")
  )
    return fail("not-allowed");
  if (
    (from && !endpointExists(lesson.initial, from, true)) ||
    (to && !endpointExists(lesson.initial, to, false))
  )
    return fail("invalid-shape");
  if (
    [from, to].some(
      (point) => point && !editablePositions.includes(point.position),
    )
  )
    return fail("not-allowed");
  if (
    operation === "add"
      ? from !== null || to === null
      : operation === "remove"
        ? from === null || to !== null
        : from === null || to === null
  )
    return fail("not-allowed");
  if (from && to) {
    if (operation === "self" && from.position !== to.position)
      return fail("not-allowed");
    if (
      (operation === "cross" || operation === "symbol") &&
      from.position === to.position
    )
      return fail("not-allowed");
    const a = lesson.initial[from.position],
      b = lesson.initial[to.position];
    if (operation === "cross" && (!isDigit(a) || !isDigit(b)))
      return fail("not-allowed");
    if (
      operation === "symbol" &&
      !((isDigit(a) && isSign(b)) || (isSign(a) && isDigit(b)))
    )
      return fail("not-allowed");
  }
  const patterns = lesson.initial.map((char) => getVisibleSegments(char));
  if (from) patterns[from.position][from.segment] = false;
  if (to) patterns[to.position][to.segment] = true;
  const cards = patterns.map((pattern, position) =>
    lesson.initial[position] === "="
      ? "="
      : glyphByPattern.get(pattern.map(Number).join("")),
  );
  if (cards.some((char) => char === undefined)) return fail("invalid-shape");
  const result = cards as string[];
  const matchesTarget =
    result.length === lesson.target.length &&
    result.every((char, index) => char === lesson.target[index]);
  return {
    reason:
      matchesTarget &&
      (lesson.mode !== "equation" || isValidEquation(result.join("")))
        ? "success"
        : "wrong-target",
    cards: result,
  };
}

export function validateAcademyRecognition(
  lesson: AcademyLesson,
  choice: string,
): AcademyValidation {
  if (lesson.mode !== "recognition" || !lesson.choices?.includes(choice))
    return { reason: "not-allowed", cards: [...lesson.initial] };
  return {
    reason: choice === lesson.target[0] ? "success" : "wrong-target",
    cards: [...lesson.initial],
  };
}

/** The exact authored one-stick difference, used only when revealing a hint. */
export function getAcademySolution(
  lesson: AcademyLesson,
): AcademyMovement | null {
  if (lesson.mode === "recognition") return null;
  const removed: SelectedSegment[] = [],
    added: SelectedSegment[] = [];
  lesson.initial.forEach((char, position) => {
    const target = getVisibleSegments(lesson.target[position]);
    getVisibleSegments(char).forEach((visible, segment) => {
      if (visible && !target[segment]) removed.push({ position, segment });
      if (!visible && target[segment]) added.push({ position, segment });
    });
  });
  if (
    removed.length > 1 ||
    added.length > 1 ||
    removed.length + added.length === 0
  )
    return null;
  const movement = { from: removed[0] ?? null, to: added[0] ?? null };
  return validateAcademyMove(lesson, movement).reason === "success"
    ? movement
    : null;
}

/** A legal teaching move may still miss the goal; malformed/forbidden moves never
 * become suggested drop zones. This shares the authoritative validator. */
export function isAcademyMoveAllowed(
  lesson: AcademyLesson,
  movement: AcademyMovement,
) {
  return canTransferMatchstick({
    cards: lesson.initial,
    ...movement,
    getVisibleSegments,
    isLegal: () => {
      const { reason } = validateAcademyMove(lesson, movement);
      return reason === "success" || reason === "wrong-target";
    },
  });
}

export function canSelectAcademySource(
  lesson: AcademyLesson,
  source: SelectedSegment,
) {
  if (lesson.mode === "recognition" || lesson.permitted.operation === "add")
    return false;
  if (lesson.permitted.operation === "remove") {
    return isAcademyMoveAllowed(lesson, { from: source, to: null });
  }
  return getAcademyEmptySegments(lesson.initial).some((to) =>
    isAcademyMoveAllowed(lesson, { from: source, to }),
  );
}
