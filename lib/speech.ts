import { type Language } from "@/components/matchstick/copy";

export type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechRecognitionResultLike = {
  readonly isFinal?: boolean;
  readonly length: number;
  [index: number]: {
    transcript: string;
  };
};

export type SpeechRecognitionEventLike = Event & {
  readonly resultIndex?: number;
  results: {
    readonly length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
};

export type SpeechRecognitionErrorEventLike = Event & {
  error?: string;
};

export type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart?: (() => void) | null;
  onaudiostart?: (() => void) | null;
  onaudioend?: (() => void) | null;
  onsoundstart?: (() => void) | null;
  onsoundend?: (() => void) | null;
  onnomatch?: (() => void) | null;
  onspeechstart?: (() => void) | null;
  onspeechend?: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  abort: () => void;
  start: () => void;
};

export function getSpeechRecognitionConstructor() {
  if (typeof window === "undefined") {
    return null;
  }

  const speechWindow = window as Window &
    typeof globalThis & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };

  return (
    speechWindow.SpeechRecognition ??
    speechWindow.webkitSpeechRecognition ??
    null
  );
}

export function parseSpokenExpression(
  transcripts: string[],
  language: Language,
): string | null {
  for (const transcript of transcripts) {
    const expression =
      language === "zh"
        ? parseChineseExpression(transcript)
        : parseEnglishExpression(transcript);

    if (expression) {
      return expression;
    }
  }

  return null;
}

// Formatting must also work for incomplete interim captions. Keep the original
// recognition transcript in state; only replace known equality words for display.
export function formatSpeechCaption(transcript: string): string {
  return transcript.replace(/等于|等於/g, "=");
}

function parseChineseExpression(transcript: string): string | null {
  const compact = transcript
    .replace(/\b(?:equals?|is)\b/gi, "=")
    .replace(/\s+/g, "");
  const normalized = formatSpeechCaption(compact)
    .replace(/[０-９]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0xff10 + 48),
    )
    .replace(/加上|加/g, "+")
    .replace(/减去|減去|减|減/g, "-")
    .replace(/[＋]/g, "+")
    .replace(/[－−]/g, "-")
    .replace(/[＝]|等/g, "=")
    .trim()
    .replace(/[。.!！?？]$/, "")
    .replace(/\s+/g, "");
  // Anchor the whole equation: never delete unknown text or internal punctuation.
  const match = normalized.match(
    /^([零〇一二两兩三四五六七八九十百\d]+)([+-])([零〇一二两兩三四五六七八九十百\d]+)=([零〇一二两兩三四五六七八九十百\d]+)$/,
  );
  if (!match) return null;
  const [, left, operator, right, result] = match;
  const parts = [left, right, result].map(parseChineseNumber);
  if (parts.some((part) => part === null)) return null;
  return `${parts[0]}${operator}${parts[1]}=${parts[2]}`;
}

function parseChineseNumber(value: string): string | null {
  const digits: Record<string, string> = {
    零: "0",
    〇: "0",
    一: "1",
    二: "2",
    两: "2",
    兩: "2",
    三: "3",
    四: "4",
    五: "5",
    六: "6",
    七: "7",
    八: "8",
    九: "9",
  };
  const normalized = value.replace(
    /[零〇一二两兩三四五六七八九]/g,
    (char) => digits[char],
  );
  // Digit-by-digit speech can mix scripts. Preserve leading zeros/slot count
  // instead of silently changing the equation presented to the game validator.
  if (/^\d+$/.test(normalized)) {
    return Number.isSafeInteger(Number(normalized)) ? normalized : null;
  }
  const tens = normalized.match(/^([1-9]?)十([1-9]?)$/);
  if (tens) return String(Number(tens[1] || 1) * 10 + Number(tens[2] || 0));
  const hundreds = normalized.match(/^([1-9])百(.*)$/);
  if (!hundreds) return null;
  const rest = hundreds[2];
  if (!rest) return String(Number(hundreds[1]) * 100);
  // Require a complete unambiguous remainder: 一百二 is not silently 102.
  const remainder = /^(?:[1-9]十[1-9]?|[1-9]\d|0[1-9])$/.test(rest)
    ? parseChineseNumber(rest)
    : null;
  return remainder === null
    ? null
    : String(Number(hundreds[1]) * 100 + Number(remainder));
}

// Only normalize known arithmetic tokens. Never discard unknown speech or
// punctuation: doing so could turn a different statement into a valid answer.
function parseEnglishExpression(transcript: string): string | null {
  const normalized = transcript
    .toLowerCase()
    .replace(/[０-９]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0xff10 + 48),
    )
    .replace(/[＋]/g, "+")
    .replace(/[－−]/g, "-")
    .replace(/[＝]/g, "=")
    .trim()
    .replace(/[.!?]$/, "")
    // A hyphen is part of a cardinal only between a tens word and a unit.
    .replace(
      /\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)-(one|two|three|four|five|six|seven|eight|nine)\b/g,
      "$1 $2",
    )
    .replace(/([+=-])/g, " $1 ")
    .replace(/\s+/g, " ")
    .trim();
  const equality = normalized.match(
    /^(.+?) (?:equals|equal(?: to)?|is(?: equal to)?|gets|makes|gives|=) (.+)$/,
  );
  if (!equality) return null;
  const result = parseEnglishNumber(equality[2]);
  if (result === null) return null;
  const calculation = equality[1];
  // A single cardinal ("one hundred and two") is not an addition.
  if (parseEnglishNumber(calculation) !== null) return null;
  const candidates = new Set<string>();
  const addCandidate = (left: string, operator: string, right: string) => {
    const a = parseEnglishNumber(left);
    const b = parseEnglishNumber(right);
    if (a !== null && b !== null)
      candidates.add(`${a}${operator}${b}=${result}`);
  };
  // Infix operators can contain "and", which is also part of a cardinal.
  // Try every boundary and accept only one unambiguous complete reading.
  const tokens = calculation.split(" ");
  const operators: Record<string, string> = {
    plus: "+",
    add: "+",
    and: "+",
    "+": "+",
    minus: "-",
    subtract: "-",
    less: "-",
    "take away": "-",
    "taken away": "-",
    "decreased by": "-",
    "reduced by": "-",
    "increased by": "+",
    "-": "-",
  };
  for (let start = 1; start < tokens.length - 1; start++) {
    for (const [phrase, operator] of Object.entries(operators)) {
      const width = phrase.split(" ").length;
      if (tokens.slice(start, start + width).join(" ") === phrase) {
        addCandidate(
          tokens.slice(0, start).join(" "),
          operator,
          tokens.slice(start + width).join(" "),
        );
      }
    }
  }
  if (tokens[0] === "add") {
    for (let index = 2; index < tokens.length - 1; index++) {
      if (tokens[index] === "and") {
        addCandidate(
          tokens.slice(1, index).join(" "),
          "+",
          tokens.slice(index + 1).join(" "),
        );
      }
    }
  }
  // "Subtract two from six" and "two less than six" mean 6-2.
  for (const [pattern, operator, reverse] of [
    [/^subtract (.+) from (.+)$/, "-", true],
    [/^take (.+) away from (.+)$/, "-", true],
    [/^take away (.+) from (.+)$/, "-", true],
    [/^(.+) (?:subtracted|taken away) from (.+)$/, "-", true],
    [/^(.+) less than (.+)$/, "-", true],
    [/^(.+) more than (.+)$/, "+", true],
    [/^add (.+) to (.+)$/, "+", true],
    [/^(.+) added to (.+)$/, "+", true],
  ] as const) {
    const match = calculation.match(pattern);
    if (match)
      addCandidate(match[reverse ? 2 : 1], operator, match[reverse ? 1 : 2]);
  }
  return candidates.size === 1 ? [...candidates][0] : null;
}

const englishSmallNumbers = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];
const englishTens = [
  "twenty",
  "thirty",
  "forty",
  "fifty",
  "sixty",
  "seventy",
  "eighty",
  "ninety",
];

function parseEnglishNumber(value: string): string | null {
  // Keep digit spelling, including leading zeros, for the game's validator.
  if (/^\d+$/.test(value)) {
    return Number.isSafeInteger(Number(value)) ? value : null;
  }
  const tokens = value.split(" ");
  function underHundred(words: string[]): number | null {
    if (words.length === 1) {
      const small = englishSmallNumbers.indexOf(words[0]);
      if (small >= 0) return small;
      if (/^(?:[1-9]?\d)$/.test(words[0])) return Number(words[0]);
    }
    const tens = englishTens.indexOf(words[0]);
    if (tens < 0) return null;
    if (words.length === 1) return (tens + 2) * 10;
    if (words.length !== 2) return null;
    const unit = englishSmallNumbers.indexOf(words[1]);
    const digit = /^[1-9]$/.test(words[1]) ? Number(words[1]) : unit;
    return digit >= 1 && digit <= 9 ? (tens + 2) * 10 + digit : null;
  }
  if (tokens[1] === "hundred") {
    const hundreds = /^[1-9]$/.test(tokens[0])
      ? Number(tokens[0])
      : englishSmallNumbers.indexOf(tokens[0]);
    if (hundreds < 1 || hundreds > 9) return null;
    if (tokens.length === 2) return String(hundreds * 100);
    const rest = underHundred(tokens.slice(tokens[2] === "and" ? 3 : 2));
    return rest !== null && rest > 0 ? String(hundreds * 100 + rest) : null;
  }
  const number = underHundred(tokens);
  return number === null ? null : String(number);
}
