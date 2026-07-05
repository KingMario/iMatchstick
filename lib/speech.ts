import { type Language } from "@/components/matchstick/copy";

export type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechRecognitionResultLike = {
  readonly length: number;
  [index: number]: {
    transcript: string;
  };
};

export type SpeechRecognitionEventLike = Event & {
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
      parseSymbolExpression(transcript) ??
      (language === "zh"
        ? parseChineseExpression(transcript)
        : parseEnglishExpression(transcript));

    if (expression) {
      return expression;
    }
  }

  return null;
}

function parseSymbolExpression(transcript: string): string | null {
  const normalized = transcript
    .replace(/[＋加]/g, "+")
    .replace(/[－减]/g, "-")
    .replace(/等于|等|equals?|equal|is/gi, "=")
    .replace(/[，,。.\s]/g, "")
    .replace(/[０-９]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0xff10 + 48),
    );
  const match = normalized.match(/^(\d+)([+-])(\d+)=(\d+)$/);

  return match ? normalized : null;
}

function parseChineseExpression(transcript: string): string | null {
  const compact = transcript.replace(/[，,。.\s]/g, "");
  const match = compact.match(
    /^([零〇一二两三四五六七八九十百\d]+)(加|减)([零〇一二两三四五六七八九十百\d]+)(?:等于|等)([零〇一二两三四五六七八九十百\d]+)$/,
  );

  if (!match) {
    return null;
  }

  const [, left, operator, right, result] = match;
  const parts = [left, right, result].map(parseChineseNumber);

  if (parts.some((part) => part === null)) {
    return null;
  }

  return `${parts[0]}${operator === "加" ? "+" : "-"}${parts[1]}=${parts[2]}`;
}

function parseChineseNumber(value: string): number | null {
  if (/^\d+$/.test(value)) {
    return Number(value);
  }

  const digits: Record<string, number> = {
    零: 0,
    〇: 0,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };

  if ([...value].every((char) => char in digits)) {
    return Number([...value].map((char) => digits[char]).join(""));
  }

  if (value === "十") {
    return 10;
  }

  const hundredParts = value.split("百");
  if (hundredParts.length === 2) {
    const hundreds = hundredParts[0] ? digits[hundredParts[0]] : 1;
    const rest = hundredParts[1] ? parseChineseNumber(hundredParts[1]) : 0;
    return hundreds === undefined || rest === null
      ? null
      : hundreds * 100 + rest;
  }

  const tenParts = value.split("十");
  if (tenParts.length === 2) {
    const tens = tenParts[0] ? digits[tenParts[0]] : 1;
    const ones = tenParts[1] ? digits[tenParts[1]] : 0;
    return tens === undefined || ones === undefined ? null : tens * 10 + ones;
  }

  return null;
}

function parseEnglishExpression(transcript: string): string | null {
  const tokens = transcript
    .toLowerCase()
    .replace(/[=]/g, " equals ")
    .replace(/[+]/g, " plus ")
    .replace(/[-]/g, " minus ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const operatorIndex = tokens.findIndex((token) =>
    ["plus", "add", "minus", "subtract"].includes(token),
  );
  const equalsIndex = tokens.findIndex((token) =>
    ["equals", "equal", "is"].includes(token),
  );

  if (operatorIndex <= 0 || equalsIndex <= operatorIndex + 1) {
    return null;
  }

  const left = parseEnglishNumber(tokens.slice(0, operatorIndex));
  const right = parseEnglishNumber(
    tokens.slice(operatorIndex + 1, equalsIndex),
  );
  const result = parseEnglishNumber(tokens.slice(equalsIndex + 1));

  if (left === null || right === null || result === null) {
    return null;
  }

  return `${left}${["plus", "add"].includes(tokens[operatorIndex]) ? "+" : "-"}${right}=${result}`;
}

function parseEnglishNumber(tokens: string[]): number | null {
  if (tokens.length === 0) {
    return null;
  }

  if (tokens.length === 1 && /^\d+$/.test(tokens[0])) {
    return Number(tokens[0]);
  }

  const values: Record<string, number> = {
    zero: 0,
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
    sixteen: 16,
    seventeen: 17,
    eighteen: 18,
    nineteen: 19,
    twenty: 20,
    thirty: 30,
    forty: 40,
    fifty: 50,
    sixty: 60,
    seventy: 70,
    eighty: 80,
    ninety: 90,
  };

  if (tokens.every((token) => /^\d$/.test(token))) {
    return Number(tokens.join(""));
  }

  let total = 0;
  let consumed = false;

  tokens.forEach((token) => {
    if (token === "hundred") {
      total = total === 0 ? 100 : total * 100;
      consumed = true;
      return;
    }

    if (values[token] !== undefined) {
      total += values[token];
      consumed = true;
    }
  });

  return consumed ? total : null;
}
