export type Operator = "+" | "-";

export type Movement = {
  from: number;
  fromSegment: number;
  to: number;
  toSegment: number;
  incidence: number;
};

export type Puzzle = {
  expression: string;
  sourceExpression: string;
  answers: string[];
  movements: Movement[];
};

export type SelectedSegment = {
  position: number;
  segment: number;
};

const digitSticks: Record<string, string> = {
  "0": "1111110",
  "1": "0011000",
  "2": "0110111",
  "3": "0111101",
  "4": "1011001",
  "5": "1101101",
  "6": "1101111",
  "7": "0111000",
  "8": "1111111",
  "9": "1111101",
  "+": "11",
  "-": "10",
  "=": "",
};

const posDraggable: Record<string, number[]> = {
  "0": [2, 5],
  "1": [],
  "2": [5],
  "3": [2, 3],
  "4": [],
  "5": [0],
  "6": [5, 6],
  "7": [1],
  "8": [2, 5, 6],
  "9": [0, 2, 6],
  "+": [1],
  "-": [],
  "=": [],
};

const posDroppable: Record<string, number[]> = {
  "0": [6],
  "1": [1],
  "2": [3],
  "3": [0, 5],
  "4": [],
  "5": [2, 5],
  "6": [2],
  "7": [],
  "8": [],
  "9": [5],
  "+": [],
  "-": [1],
  "=": [],
};

const charBySticks = new Map(
  Object.entries(digitSticks).map(([char, sticks]) => [sticks, char]),
);

function parseExpression(expression: string) {
  const match = expression.match(/^(\d+)([+-])(\d+)=(\d+)$/);

  if (!match) {
    return null;
  }

  const [, left, operator, right, result] = match;
  return {
    left,
    operator: operator as Operator,
    right,
    result,
  };
}

function hasInvalidLeadingZero(expression: string) {
  const parsed = parseExpression(expression);

  if (!parsed) {
    return true;
  }

  return [parsed.left, parsed.right, parsed.result].some(
    (part) => part.length > 1 && part.startsWith("0"),
  );
}

function hasObviousLeadingSevenResult(expression: string, lowLevel: boolean) {
  const parsed = parseExpression(expression);

  if (!parsed) {
    return false;
  }

  const obviousResultLength = lowLevel ? 2 : 3;
  return (
    parsed.result.length === obviousResultLength &&
    parsed.result.startsWith("7")
  );
}

export function isValidEquation(expression: string) {
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

function getOperatorPosition(expression: string) {
  return expression.search(/[+-]/);
}

function getEqualSignPosition(expression: string) {
  return expression.indexOf("=");
}

function getMovedExpression(expression: string, movement: Movement) {
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

function getIncidence(
  expression: string,
  movement: Omit<Movement, "incidence">,
) {
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

function enumerateMovements(expression: string) {
  const movements: Movement[] = [];

  expression.split("").forEach((fromChar, from) => {
    (posDraggable[fromChar] ?? []).forEach((fromSegment) => {
      expression.split("").forEach((toChar, to) => {
        (posDroppable[toChar] ?? []).forEach((toSegment) => {
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

export function createPuzzleFromExpression(
  expression: string,
  sourceExpression = "",
): Puzzle | null {
  const answers: string[] = [];
  const answerMovements: Movement[] = [];

  enumerateMovements(expression).forEach((movement) => {
    const moved = getMovedExpression(expression, movement);

    if (!moved || hasInvalidLeadingZero(moved)) {
      return;
    }

    if (isValidEquation(moved) && !answers.includes(moved)) {
      answers.push(moved);
      answerMovements.push(movement);
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
    movements: answerMovements,
  };
}

function createBrokenExpressions(sourceExpression: string) {
  return enumerateMovements(sourceExpression)
    .map((movement) => ({
      expression: getMovedExpression(sourceExpression, movement),
      movement,
    }))
    .filter(({ expression }) => {
      if (!expression || hasInvalidLeadingZero(expression)) {
        return false;
      }

      return !isValidEquation(expression);
    });
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generatePuzzle(lowLevel: boolean): Puzzle {
  const maxOperand = lowLevel ? 9 : 99;
  const minA = lowLevel ? 1 : 10;

  for (let attempt = 0; attempt < 5000; attempt += 1) {
    let a = randomInt(minA, maxOperand);
    let b = randomInt(1, maxOperand);
    const operator: Operator = Math.random() < 0.5 ? "+" : "-";

    if (operator === "-" && a === b) {
      continue;
    }

    if (operator === "-" && a < b) {
      [a, b] = [b, a];
    }

    const result = operator === "+" ? a + b : a - b;
    const validExpression = `${a}${operator}${b}=${result}`;
    const candidates = createBrokenExpressions(validExpression);

    if (candidates.length === 0) {
      continue;
    }

    const candidate = candidates[randomInt(0, candidates.length - 1)];

    if (candidate.movement.incidence < Math.random()) {
      continue;
    }

    if (hasObviousLeadingSevenResult(candidate.expression, lowLevel)) {
      continue;
    }

    const puzzle = createPuzzleFromExpression(
      candidate.expression,
      validExpression,
    );

    if (puzzle) {
      return puzzle;
    }
  }

  const fallback = createPuzzleFromExpression("9-5=6", "9-3=6");

  if (!fallback) {
    throw new Error("Unable to generate fallback matchstick puzzle.");
  }

  return fallback;
}

export function createInitialPuzzle() {
  const puzzle = createPuzzleFromExpression("9-5=6", "9-3=6");

  if (!puzzle) {
    throw new Error("Unable to create initial matchstick puzzle.");
  }

  return puzzle;
}

export function tryMove(
  expression: string,
  from: SelectedSegment,
  to: SelectedSegment,
) {
  const movement = {
    from: from.position,
    fromSegment: from.segment,
    to: to.position,
    toSegment: to.segment,
    incidence: 1,
  };

  return getMovedExpression(expression, movement);
}

export function isAnswer(expression: string, answers: string[]) {
  return answers.includes(expression);
}

export function getDraggableSegments(char: string) {
  return posDraggable[char] ?? [];
}

export function getDroppableSegments(char: string) {
  return posDroppable[char] ?? [];
}

export function getVisibleSegments(char: string) {
  return digitSticks[char]?.split("").map((value) => value === "1") ?? [];
}
