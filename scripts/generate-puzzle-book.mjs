import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const digitSticks = {
  0: "1111110",
  1: "0011000",
  2: "0110111",
  3: "0111101",
  4: "1011001",
  5: "1101101",
  6: "1101111",
  7: "0111000",
  8: "1111111",
  9: "1111101",
  "+": "11",
  "-": "10",
  "=": "",
};

const posDraggable = {
  0: [2, 5],
  1: [],
  2: [5],
  3: [2, 3],
  4: [],
  5: [0],
  6: [5, 6],
  7: [1],
  8: [2, 5, 6],
  9: [0, 2, 6],
  "+": [1],
  "-": [],
  "=": [],
};

const posAddable = {
  0: [6],
  1: [1],
  2: [],
  3: [0],
  4: [],
  5: [2, 5],
  6: [2],
  7: [],
  8: [],
  9: [5],
  "+": [],
  "-": [1],
  "=": [],
};

const charBySticks = new Map(
  Object.entries(digitSticks).map(([char, sticks]) => [sticks, char]),
);

const outputPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../lib/generated/puzzleBook.generated.ts",
);
const publicPuzzleDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "../public/puzzles",
);
const reportPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../lib/generated/puzzleBook.report.json",
);
const difficulties = [
  "level0",
  "easiest",
  "easy",
  "easyPlus",
  "medium",
  "mediumPlus",
  "hard",
  "hardPlus",
  "expert",
];

function parseExpression(expression) {
  const match = expression.match(/^(\d+)([+-])(\d+)=(\d+)$/);

  if (!match) {
    return null;
  }

  const [, left, operator, right, result] = match;
  return { left, operator, right, result };
}

function hasInvalidLeadingZero(expression) {
  const parsed = parseExpression(expression);

  if (!parsed) {
    return true;
  }

  return [parsed.left, parsed.right, parsed.result].some(
    (part) => part.length > 1 && part.startsWith("0"),
  );
}

function isValidEquation(expression) {
  const parsed = parseExpression(expression);

  if (!parsed || hasInvalidLeadingZero(expression)) {
    return false;
  }

  const left = Number(parsed.left);
  const right = Number(parsed.right);
  const result = Number(parsed.result);
  const actual = parsed.operator === "+" ? left + right : left - right;

  return actual === result;
}

function hasObviousLargeResult(sourceExpression, candidateExpression) {
  const source = parseExpression(sourceExpression);
  const candidate = parseExpression(candidateExpression);

  if (!source || !candidate) {
    return false;
  }

  const operandLengths = [source.left.length, source.right.length];
  const result = Number(candidate.result);

  if (operandLengths.every((length) => length === 1)) {
    return result >= 70;
  }

  if (operandLengths.every((length) => length === 2)) {
    return result >= 700;
  }

  return false;
}

function getHiddenSegments(char) {
  return (
    digitSticks[char]
      ?.split("")
      .flatMap((value, index) => (value === "0" ? [index] : [])) ?? []
  );
}

function getOperatorPosition(expression) {
  return expression.search(/[+-]/);
}

function getEqualSignPosition(expression) {
  return expression.indexOf("=");
}

function getIncidence(expression, movement) {
  const operatorPosition = getOperatorPosition(expression);
  const equalSignPosition = getEqualSignPosition(expression);

  if (movement.from === movement.to) {
    return 0.3;
  }

  if (movement.from === operatorPosition || movement.to === operatorPosition) {
    return 0.3;
  }

  const isSameSide =
    (movement.from < operatorPosition && movement.to < operatorPosition) ||
    (movement.from > operatorPosition &&
      movement.to > operatorPosition &&
      movement.from < equalSignPosition &&
      movement.to < equalSignPosition) ||
    (movement.from > equalSignPosition && movement.to > equalSignPosition);

  return isSameSide ? 0.4 : 1;
}

function enumerateMovements(expression) {
  const movements = [];

  expression.split("").forEach((fromChar, from) => {
    (posDraggable[fromChar] ?? []).forEach((fromSegment) => {
      expression.split("").forEach((toChar, to) => {
        const targetSegments =
          from === to ? getHiddenSegments(toChar) : (posAddable[toChar] ?? []);

        targetSegments.forEach((toSegment) => {
          const movement = { from, fromSegment, to, toSegment };
          movements.push({
            ...movement,
            incidence: getIncidence(expression, movement),
          });
        });
      });
    });
  });

  return movements;
}

function getMovedExpression(expression, movement) {
  const sticks = expression.split("").map((char) => digitSticks[char]);

  if (movement.from === movement.to) {
    const movedSticks = sticks[movement.from].split("");
    movedSticks[movement.fromSegment] = "0";
    movedSticks[movement.toSegment] = "1";
    sticks[movement.from] = movedSticks.join("");
  } else {
    const fromSticks = sticks[movement.from].split("");
    const toSticks = sticks[movement.to].split("");

    fromSticks[movement.fromSegment] = "0";
    toSticks[movement.toSegment] = "1";
    sticks[movement.from] = fromSticks.join("");
    sticks[movement.to] = toSticks.join("");
  }

  const movedChars = sticks.map((stickPattern, index) => {
    if (index !== movement.from && index !== movement.to) {
      return expression[index];
    }

    return charBySticks.get(stickPattern);
  });

  if (movedChars.some((char) => !char)) {
    return "";
  }

  return movedChars.join("");
}

function createPuzzleFromExpression(expression, sourceExpression = "") {
  const answers = [];
  const movements = [];

  enumerateMovements(expression).forEach((movement) => {
    const moved = getMovedExpression(expression, movement);

    if (!moved || hasInvalidLeadingZero(moved)) {
      return;
    }

    if (isValidEquation(moved) && !answers.includes(moved)) {
      answers.push(moved);
      movements.push(movement);
    }
  });

  if (isValidEquation(expression) || answers.length === 0) {
    return null;
  }

  if (sourceExpression && answers.includes(sourceExpression)) {
    answers.sort((answer) => (answer === sourceExpression ? -1 : 1));
  }

  return {
    expression,
    sourceExpression: sourceExpression || answers[0],
    answers,
    movements,
  };
}

function createBrokenExpressions(sourceExpression) {
  return enumerateMovements(sourceExpression)
    .map((movement) => ({
      expression: getMovedExpression(sourceExpression, movement),
      movement,
    }))
    .filter(({ expression }) => {
      if (!expression || hasInvalidLeadingZero(expression)) {
        return false;
      }

      if (hasObviousLargeResult(sourceExpression, expression)) {
        return false;
      }

      return !isValidEquation(expression);
    });
}

function getSide(expression, position) {
  const operatorPosition = getOperatorPosition(expression);
  const equalSignPosition = getEqualSignPosition(expression);

  if (position < operatorPosition) {
    return "leftA";
  }

  if (position > operatorPosition && position < equalSignPosition) {
    return "leftB";
  }

  if (position > equalSignPosition) {
    return "right";
  }

  return "operator";
}

function isHighPlace(expression, position) {
  const side = getSide(expression, position);
  const parsed = parseExpression(expression);

  if (!parsed || side === "operator") {
    return false;
  }

  const sideStart = {
    leftA: 0,
    leftB: getOperatorPosition(expression) + 1,
    right: getEqualSignPosition(expression) + 1,
  }[side];
  const sideLength = {
    leftA: parsed.left.length,
    leftB: parsed.right.length,
    right: parsed.result.length,
  }[side];

  return sideLength > 1 && position < sideStart + sideLength - 1;
}

function classifyPuzzle(puzzle) {
  const parsed = parseExpression(puzzle.expression);
  const primaryMovement = puzzle.movements[0];
  const sourceParsed = parseExpression(puzzle.sourceExpression);
  const tags = [];
  let score = 0;

  if (!parsed || !primaryMovement || !sourceParsed) {
    return { difficulty: "expert", score: 99, tags: ["unclassified"] };
  }

  const operandLengths = [
    parsed.left.length,
    parsed.right.length,
    parsed.result.length,
  ];
  const maxDigits = Math.max(...operandLengths);
  const fromSide = getSide(puzzle.expression, primaryMovement.from);
  const toSide = getSide(puzzle.expression, primaryMovement.to);
  const sameChar = primaryMovement.from === primaryMovement.to;
  const operatorChange = fromSide === "operator" || toSide === "operator";
  const crossesEqual =
    (primaryMovement.from < getEqualSignPosition(puzzle.expression) &&
      primaryMovement.to > getEqualSignPosition(puzzle.expression)) ||
    (primaryMovement.to < getEqualSignPosition(puzzle.expression) &&
      primaryMovement.from > getEqualSignPosition(puzzle.expression));
  const rightSideSelfMove = sameChar && fromSide === "right";
  const leftSideSelfMove =
    sameChar && (fromSide === "leftA" || fromSide === "leftB");
  const sameLeftExpressionSide =
    fromSide !== "operator" &&
    toSide !== "operator" &&
    fromSide !== "right" &&
    toSide !== "right";
  const highPlaceMove =
    isHighPlace(puzzle.expression, primaryMovement.from) ||
    isHighPlace(puzzle.expression, primaryMovement.to);
  const multipleAnswers = puzzle.answers.length > 1;
  const sourceHasOneDigitOperands =
    sourceParsed.left.length === 1 && sourceParsed.right.length === 1;

  if (maxDigits === 1) {
    tags.push("one_digit");
  } else {
    tags.push("multi_digit");
    score += maxDigits * 4;
  }

  if (rightSideSelfMove) {
    tags.push("right_side_self_move");
    score -= 4;
  }

  if (leftSideSelfMove) {
    tags.push("left_side_self_move");
    score += 1;
  }

  if (!sameChar && toSide === "right") {
    tags.push("right_side_external_drop");
    score += 3;
  }

  if (!sameChar && sameLeftExpressionSide) {
    tags.push("same_left_side_move");
    score += 5;
  }

  if (crossesEqual) {
    tags.push("cross_equal_move");
    score += 8;
  }

  if (operatorChange) {
    tags.push("operator_change");
    score += 7;
  }

  if (highPlaceMove) {
    tags.push("high_place_move");
    score += 6;
  }

  if (!multipleAnswers) {
    tags.push("single_answer");
  } else {
    tags.push("multiple_answers");
    score += Math.min(4, puzzle.answers.length - 1);
  }

  score += Math.max(0, puzzle.expression.length - 5);

  let difficulty = "medium";

  if ((rightSideSelfMove || leftSideSelfMove) && sourceHasOneDigitOperands) {
    difficulty = "level0";
  } else if (
    maxDigits === 1 &&
    !sameChar &&
    toSide === "right" &&
    fromSide !== "operator"
  ) {
    difficulty = "easyPlus";
  } else if (
    maxDigits > 1 &&
    (crossesEqual || operatorChange || multipleAnswers)
  ) {
    difficulty = "expert";
  } else if (maxDigits > 1 && highPlaceMove) {
    difficulty = "hardPlus";
  } else if (crossesEqual) {
    difficulty = "hard";
  } else if (operatorChange) {
    difficulty = "mediumPlus";
  } else if (!sameChar && sameLeftExpressionSide) {
    difficulty = "medium";
  } else if (!sameChar && toSide === "right") {
    difficulty = "easyPlus";
  } else if (leftSideSelfMove) {
    difficulty = "easy";
  } else if (rightSideSelfMove) {
    difficulty = "easiest";
  } else if (maxDigits > 1) {
    difficulty = "hardPlus";
  }

  return {
    difficulty,
    score,
    tags,
  };
}

function getValidExpressions() {
  const expressions = [];

  for (let a = 1; a <= 99; a += 1) {
    for (let b = 1; b <= 99; b += 1) {
      expressions.push(`${a}+${b}=${a + b}`);

      if (a !== b) {
        const left = Math.max(a, b);
        const right = Math.min(a, b);
        expressions.push(`${left}-${right}=${left - right}`);
      }
    }
  }

  return [...new Set(expressions)];
}

function createPuzzleBook() {
  const puzzleByExpression = new Map();

  getValidExpressions().forEach((sourceExpression) => {
    createBrokenExpressions(sourceExpression).forEach(({ expression }) => {
      const puzzle = createPuzzleFromExpression(expression, sourceExpression);

      if (!puzzle) {
        return;
      }

      const current = puzzleByExpression.get(puzzle.expression);

      if (!current || puzzle.answers.length < current.answers.length) {
        puzzleByExpression.set(puzzle.expression, puzzle);
      }
    });
  });

  const pools = Object.fromEntries(
    difficulties.map((difficulty) => [difficulty, []]),
  );
  const stats = Object.fromEntries(
    difficulties.map((difficulty) => [
      difficulty,
      { count: 0, minScore: Infinity, maxScore: -Infinity, tags: {} },
    ]),
  );

  [...puzzleByExpression.values()]
    .sort((a, b) => a.expression.localeCompare(b.expression))
    .forEach((puzzle) => {
      const classification = classifyPuzzle(puzzle);
      const entry = `${puzzle.expression}|${puzzle.sourceExpression}`;

      pools[classification.difficulty].push(entry);
      const stat = stats[classification.difficulty];
      stat.count += 1;
      stat.minScore = Math.min(stat.minScore, classification.score);
      stat.maxScore = Math.max(stat.maxScore, classification.score);

      classification.tags.forEach((tag) => {
        stat.tags[tag] = (stat.tags[tag] ?? 0) + 1;
      });
    });

  return { pools, stats };
}

const { pools, stats } = createPuzzleBook();
const source = `// Generated by scripts/generate-puzzle-book.mjs. Do not edit manually.
export const generatedPuzzleStats = ${JSON.stringify(stats, null, 2)} as const;
`;

mkdirSync(dirname(outputPath), { recursive: true });
rmSync(publicPuzzleDir, { recursive: true, force: true });
mkdirSync(publicPuzzleDir, { recursive: true });
writeFileSync(outputPath, source);
difficulties.forEach((difficulty) => {
  writeFileSync(
    join(publicPuzzleDir, `${difficulty}.txt`),
    `${pools[difficulty].join("\n")}\n`,
  );
});
writeFileSync(reportPath, `${JSON.stringify(stats, null, 2)}\n`);

console.log(
  JSON.stringify(
    {
      outputPath,
      pools: Object.fromEntries(
        difficulties.map((difficulty) => [
          difficulty,
          {
            count: stats[difficulty].count,
            score: [stats[difficulty].minScore, stats[difficulty].maxScore],
          },
        ]),
      ),
    },
    null,
    2,
  ),
);
