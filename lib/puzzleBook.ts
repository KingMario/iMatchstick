import {
  createPuzzleFromExpression,
  generatePuzzle,
  type Puzzle,
} from "./matchstick";

export const puzzleDifficulties = [
  "level0",
  "easiest",
  "easy",
  "easyPlus",
  "medium",
  "mediumPlus",
  "hard",
  "hardPlus",
  "expert",
] as const;

export type PuzzleDifficulty = (typeof puzzleDifficulties)[number];

const puzzlePoolCache: Partial<Record<PuzzleDifficulty, string[]>> = {};

export function normalizePuzzleDifficulty(value: unknown): PuzzleDifficulty {
  return typeof value === "string" &&
    (puzzleDifficulties as readonly string[]).includes(value)
    ? (value as PuzzleDifficulty)
    : "level0";
}

export async function pickPuzzleFromBook(
  difficulty: PuzzleDifficulty,
  previousExpression?: string,
): Promise<Puzzle> {
  const pool = await loadPuzzlePool(difficulty).catch(() => []);
  const eligible = previousExpression
    ? pool.filter((entry) => entry.split("|", 1)[0] !== previousExpression)
    : pool;
  const entry = eligible[Math.floor(Math.random() * eligible.length)];

  if (!entry) {
    return generatePuzzle(isLowLevelDifficulty(difficulty), previousExpression);
  }

  const [expression, sourceExpression] = entry.split("|");
  const puzzle = createPuzzleFromExpression(expression, sourceExpression);

  return (
    puzzle ??
    generatePuzzle(isLowLevelDifficulty(difficulty), previousExpression)
  );
}

async function loadPuzzlePool(difficulty: PuzzleDifficulty) {
  const cached = puzzlePoolCache[difficulty];

  if (cached) {
    return cached;
  }

  const response = await fetch(`./puzzles/${difficulty}.txt`);

  if (!response.ok) {
    throw new Error(`Unable to load ${difficulty} puzzle pool.`);
  }

  const entries = (await response.text())
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  puzzlePoolCache[difficulty] = entries;
  return entries;
}

function isLowLevelDifficulty(difficulty: PuzzleDifficulty) {
  return ["level0", "easiest", "easy", "easyPlus", "medium"].includes(
    difficulty,
  );
}
