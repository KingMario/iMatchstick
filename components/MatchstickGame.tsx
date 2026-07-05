"use client";

import { type PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  createInitialPuzzle,
  generatePuzzle,
  getDraggableSegments,
  getDroppableSegments,
  getVisibleSegments,
  isAnswer,
  type Puzzle,
  type SelectedSegment,
  tryMove,
} from "@/lib/matchstick";

type Language = "zh" | "en";

type Stats = {
  solved: number;
  streak: number;
  bypassed: number;
};

type MessageKey =
  | "selectHint"
  | "selectedHint"
  | "correct"
  | "wrong"
  | "timeout"
  | "voiceListening"
  | "voiceNoMatch"
  | "voiceUnsupported"
  | "voicePermission";

type DragState = {
  from: SelectedSegment;
  originX: number;
  originY: number;
  offsetX: number;
  offsetY: number;
  helperSize: number;
  x: number;
  y: number;
  orientation: "horizontal" | "vertical";
  returning: boolean;
} | null;

type SnapTarget = {
  element: HTMLElement;
  x: number;
  y: number;
  distance: number;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechRecognitionResultLike = {
  readonly length: number;
  [index: number]: {
    transcript: string;
  };
};

type SpeechRecognitionEventLike = Event & {
  results: {
    readonly length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
};

type SpeechRecognitionErrorEventLike = Event & {
  error?: string;
};

type SpeechRecognitionLike = {
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

const copy = {
  zh: {
    title: "巧移火柴我最棒",
    subtitle: "只移动一根火柴，让等式成立。",
    newPuzzle: "新题",
    undo: "复原",
    answer: "答案",
    hideAnswer: "隐藏答案",
    easy: "简单",
    hard: "困难",
    timer: "60 秒计时",
    sound: "音效",
    solved: "已答",
    streak: "连续",
    bypassed: "跳过",
    attempts: "尝试",
    answersFound: "答案",
    selectHint: "点击一根可移动的火柴，再点击虚线位置。",
    selectedHint: "选择一个虚线位置放下火柴。",
    correct: "正确！点击新题继续。",
    wrong: "还不对，再试一次。",
    timeout: "时间到。可以复原、看答案或换一题。",
    voiceListening: "正在听，请说出完整算式。",
    voiceNoMatch: "没有识别到可行答案，请再试一次。",
    voiceUnsupported: "当前浏览器不支持语音识别。",
    voicePermission: "需要允许麦克风权限才能语音解题。",
    answerTitle: "可行答案",
    voice: "语音",
    install: "PWA MVP：可离线缓存，可添加到手机主屏幕。",
    languageLabel: "语言",
    gameSettingsLabel: "游戏设置",
    puzzleLabel: "火柴算式谜题",
    equalsLabel: "等号",
    segmentLabel: "第 {segment} 根火柴",
  },
  en: {
    title: "iMatchstick",
    subtitle: "Move exactly one matchstick to correct the equation.",
    newPuzzle: "New",
    undo: "Undo",
    answer: "Answer",
    hideAnswer: "Hide",
    easy: "Easy",
    hard: "Hard",
    timer: "60s timer",
    sound: "Sound",
    solved: "Solved",
    streak: "Streak",
    bypassed: "Skipped",
    attempts: "Tries",
    answersFound: "Answers",
    selectHint: "Tap a movable match, then tap a dashed position.",
    selectedHint: "Choose a dashed position for the match.",
    correct: "Correct. Start a new puzzle when ready.",
    wrong: "Not quite. Try another move.",
    timeout: "Time is up. Undo, view answers, or start a new puzzle.",
    voiceListening: "Listening. Say the full equation.",
    voiceNoMatch: "No valid answer recognized. Try again.",
    voiceUnsupported: "Speech recognition is not supported in this browser.",
    voicePermission: "Microphone permission is required for voice answers.",
    answerTitle: "Valid answers",
    voice: "Voice",
    install: "PWA MVP: offline cache and home-screen install support.",
    languageLabel: "Language",
    gameSettingsLabel: "Game settings",
    puzzleLabel: "Matchstick puzzle",
    equalsLabel: "Equals",
    segmentLabel: "Matchstick segment {segment}",
  },
};

const statsKey = "imatchstick-pwa-stats";
const settingsKey = "imatchstick-pwa-settings";
const initialStats: Stats = { solved: 0, streak: 0, bypassed: 0 };
const initialPuzzle = createInitialPuzzle();
const androidHelperSizeRatio = 24 / 60;
const androidCursorOffsetRatio = {
  x: (12 - 90) / 60,
  y: (12 - 30) / 60,
};
const dragOffsetScale = 0.65;
const dragSnapPadding = 18;

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function playApplause(audio: HTMLAudioElement | null) {
  audio ??= new Audio("./hurrah.mp3");
  audio.volume = 0.8;
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

function getSpeechRecognitionConstructor() {
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

function getDragHelperMetrics(
  rect: DOMRect,
  orientation: "horizontal" | "vertical",
) {
  const mainLength = orientation === "horizontal" ? rect.width : rect.height;
  const helperSize = Math.max(
    14,
    Math.round(mainLength * androidHelperSizeRatio),
  );

  return {
    helperSize,
    offsetX: mainLength * androidCursorOffsetRatio.x * dragOffsetScale,
    offsetY: mainLength * androidCursorOffsetRatio.y * dragOffsetScale,
  };
}

function getDragHelperPoint(
  event: PointerEvent<HTMLButtonElement>,
  offsetX: number,
  offsetY: number,
) {
  return {
    x: event.clientX + offsetX,
    y: event.clientY + offsetY,
  };
}

function findSnapTarget(point: { x: number; y: number }): SnapTarget | null {
  const placeholders = Array.from(
    document.querySelectorAll<HTMLElement>(
      ".match-segment.placeholder:not(:disabled)",
    ),
  );
  let nearest: SnapTarget | null = null;

  placeholders.forEach((element) => {
    const rect = element.getBoundingClientRect();
    const padding = Math.max(
      dragSnapPadding,
      Math.min(rect.width, rect.height) * 0.8,
    );

    if (
      point.x < rect.left - padding ||
      point.x > rect.right + padding ||
      point.y < rect.top - padding ||
      point.y > rect.bottom + padding
    ) {
      return;
    }

    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const distance = Math.hypot(point.x - x, point.y - y);

    if (!nearest || distance < nearest.distance) {
      nearest = { element, x, y, distance };
    }
  });

  return nearest;
}

function parseSpokenExpression(
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

export function MatchstickGame() {
  const [mounted, setMounted] = useState(false);
  const [language, setLanguage] = useState<Language>("zh");
  const [lowLevel, setLowLevel] = useState(true);
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [puzzle, setPuzzle] = useState<Puzzle>(initialPuzzle);
  const [displayExpression, setDisplayExpression] = useState(puzzle.expression);
  const [selected, setSelected] = useState<SelectedSegment | null>(null);
  const [messageKey, setMessageKey] = useState<MessageKey>("selectHint");
  const [attempts, setAttempts] = useState(0);
  const [solved, setSolved] = useState(false);
  const [solvedAnswers, setSolvedAnswers] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState(60);
  const [showAnswers, setShowAnswers] = useState(false);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [drag, setDrag] = useState<DragState>(null);
  const [listening, setListening] = useState(false);
  const suppressNextClick = useRef(false);
  const dragReturnTimer = useRef<number | null>(null);
  const applauseAudio = useRef<HTMLAudioElement | null>(null);
  const speechRecognition = useRef<SpeechRecognitionLike | null>(null);

  const text = copy[language];
  const locked = solved || (timerEnabled && timeLeft <= 0);

  const answersFound = useMemo(() => solvedAnswers.length, [solvedAnswers]);

  useEffect(() => {
    setMounted(true);
    applauseAudio.current = new Audio("./hurrah.mp3");
    applauseAudio.current.preload = "auto";
    applauseAudio.current.load();

    const savedSettings = readJson(settingsKey, {
      language: "zh" as Language,
      lowLevel: true,
      timerEnabled: false,
      soundEnabled: true,
    });

    setLanguage(savedSettings.language);
    setLowLevel(savedSettings.lowLevel);
    setTimerEnabled(savedSettings.timerEnabled);
    setSoundEnabled(savedSettings.soundEnabled);
    setStats(readJson(statsKey, initialStats));

    const nextPuzzle = generatePuzzle(savedSettings.lowLevel);
    setPuzzle(nextPuzzle);
    setDisplayExpression(nextPuzzle.expression);
    setSelected(null);
    setDrag(null);
    setAttempts(0);
    setSolved(false);
    setSolvedAnswers([]);
    setTimeLeft(60);
    setShowAnswers(false);
    setMessageKey("selectHint");
  }, []);

  useEffect(() => {
    return () => {
      if (dragReturnTimer.current !== null) {
        window.clearTimeout(dragReturnTimer.current);
      }
      speechRecognition.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    window.localStorage.setItem(statsKey, JSON.stringify(stats));
  }, [mounted, stats]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    window.localStorage.setItem(
      settingsKey,
      JSON.stringify({ language, lowLevel, timerEnabled, soundEnabled }),
    );
  }, [language, lowLevel, mounted, soundEnabled, timerEnabled]);

  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }, []);

  useEffect(() => {
    if (!timerEnabled || solved || timeLeft <= 0) {
      return;
    }

    const timerId = window.setInterval(() => {
      setTimeLeft((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [timerEnabled, solved, timeLeft]);

  useEffect(() => {
    if (timerEnabled && timeLeft === 0 && !solved) {
      setSelected(null);
      setMessageKey("timeout");
    }
  }, [timerEnabled, timeLeft, solved]);

  function resetPuzzle(nextPuzzle: Puzzle) {
    clearDragReturnTimer();
    speechRecognition.current?.abort();
    speechRecognition.current = null;
    setListening(false);
    setPuzzle(nextPuzzle);
    setDisplayExpression(nextPuzzle.expression);
    setSelected(null);
    setDrag(null);
    setAttempts(0);
    setSolved(false);
    setSolvedAnswers([]);
    setTimeLeft(60);
    setShowAnswers(false);
    setMessageKey("selectHint");
  }

  function startNewPuzzle() {
    if (!solved && attempts > 0) {
      setStats((current) => ({
        ...current,
        streak: 0,
        bypassed: current.bypassed + 1,
      }));
    }

    resetPuzzle(generatePuzzle(lowLevel));
  }

  function undoPuzzle() {
    clearDragReturnTimer();
    speechRecognition.current?.abort();
    speechRecognition.current = null;
    setListening(false);
    setDisplayExpression(puzzle.expression);
    setSelected(null);
    setDrag(null);
    setSolved(false);
    setMessageKey("selectHint");
  }

  function solve(nextExpression: string) {
    clearDragReturnTimer();
    speechRecognition.current?.abort();
    speechRecognition.current = null;
    setListening(false);
    const isNewAnswer = !solvedAnswers.includes(nextExpression);

    if (soundEnabled && isNewAnswer) {
      playApplause(applauseAudio.current);
    }

    setDisplayExpression(nextExpression);
    setSelected(null);
    setDrag(null);
    setSolved(true);
    setSolvedAnswers((current) =>
      current.includes(nextExpression) ? current : [...current, nextExpression],
    );
    setMessageKey("correct");

    if (isNewAnswer) {
      setStats((current) => ({
        ...current,
        solved: current.solved + 1,
        streak: current.streak + 1,
      }));
    }
  }

  function startVoiceAnswer() {
    if (locked) {
      return;
    }

    const Recognition = getSpeechRecognitionConstructor();

    if (!Recognition) {
      setMessageKey("voiceUnsupported");
      return;
    }

    speechRecognition.current?.abort();

    const recognition = new Recognition();
    speechRecognition.current = recognition;
    recognition.lang = language === "zh" ? "zh-CN" : "en-US";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 5;
    recognition.onresult = (event) => {
      const transcripts: string[] = [];

      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];

        for (
          let alternative = 0;
          alternative < result.length;
          alternative += 1
        ) {
          transcripts.push(result[alternative].transcript);
        }
      }

      const expression = parseSpokenExpression(transcripts, language);

      if (expression && isAnswer(expression, puzzle.answers)) {
        solve(expression);
        return;
      }

      setMessageKey("voiceNoMatch");
    };
    recognition.onerror = (event) => {
      if (speechRecognition.current !== recognition) {
        return;
      }

      setListening(false);
      setMessageKey(
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "voicePermission"
          : "voiceNoMatch",
      );
    };
    recognition.onend = () => {
      if (speechRecognition.current !== recognition) {
        return;
      }

      speechRecognition.current = null;
      setListening(false);
    };

    try {
      setListening(true);
      setMessageKey("voiceListening");
      recognition.start();
    } catch {
      setListening(false);
      setMessageKey("voiceNoMatch");
    }
  }

  function handleSegmentClick(
    position: number,
    segment: number,
    visible: boolean,
  ) {
    if (suppressNextClick.current) {
      suppressNextClick.current = false;
      return;
    }

    if (locked) {
      return;
    }

    const char = displayExpression[position];
    const draggable = getDraggableSegments(char).includes(segment);
    const droppable = getDroppableSegments(char).includes(segment);

    if (!selected && visible && draggable) {
      setSelected({ position, segment });
      setMessageKey("selectedHint");
      return;
    }

    if (!selected) {
      return;
    }

    if (!visible && droppable) {
      const movedExpression = tryMove(displayExpression, selected, {
        position,
        segment,
      });
      setAttempts((current) => current + 1);

      if (isAnswer(movedExpression, puzzle.answers)) {
        solve(movedExpression);
        return;
      }

      setSelected(null);
      setMessageKey("wrong");
      return;
    }

    if (visible && draggable) {
      setSelected({ position, segment });
      setMessageKey("selectedHint");
    }
  }

  function handleSegmentPointerDown(
    event: PointerEvent<HTMLButtonElement>,
    position: number,
    segment: number,
    visible: boolean,
    orientation: "horizontal" | "vertical",
  ) {
    if (locked || !visible) {
      return;
    }

    const char = displayExpression[position];

    if (!getDraggableSegments(char).includes(segment)) {
      return;
    }

    clearDragReturnTimer();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    const originX = rect.left + rect.width / 2;
    const originY = rect.top + rect.height / 2;
    const from = { position, segment };
    const helperMetrics = getDragHelperMetrics(rect, orientation);
    const helperPoint = getDragHelperPoint(
      event,
      helperMetrics.offsetX,
      helperMetrics.offsetY,
    );
    setSelected(from);
    setDrag({
      from,
      originX,
      originY,
      offsetX: helperMetrics.offsetX,
      offsetY: helperMetrics.offsetY,
      helperSize: helperMetrics.helperSize,
      x: helperPoint.x,
      y: helperPoint.y,
      orientation,
      returning: false,
    });
    setMessageKey("selectedHint");
  }

  function handleSegmentPointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!drag) {
      return;
    }

    suppressNextClick.current = true;
    setDrag((current) =>
      current ? moveDragToPointer(current, event, false, true) : current,
    );
  }

  function handleSegmentPointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (!drag) {
      return;
    }

    const helperPoint = getDragHelperPoint(event, drag.offsetX, drag.offsetY);
    const target =
      findSnapTarget(helperPoint)?.element ??
      document
        .elementFromPoint(helperPoint.x, helperPoint.y)
        ?.closest<HTMLElement>(".match-segment.placeholder");

    if (!target?.dataset.position || !target.dataset.segment) {
      if (suppressNextClick.current) {
        returnDraggedMatch(() => setSelected(null));
        return;
      }

      setDrag(null);
      return;
    }

    const to = {
      position: Number(target.dataset.position),
      segment: Number(target.dataset.segment),
    };
    const movedExpression = tryMove(displayExpression, drag.from, to);
    suppressNextClick.current = true;
    setAttempts((current) => current + 1);

    if (isAnswer(movedExpression, puzzle.answers)) {
      solve(movedExpression);
      return;
    }

    setMessageKey("wrong");
    returnDraggedMatch(() => setSelected(null));
  }

  function handleSegmentPointerCancel() {
    if (suppressNextClick.current) {
      returnDraggedMatch(() => setSelected(null));
      return;
    }

    setDrag(null);
  }

  function clearDragReturnTimer() {
    if (dragReturnTimer.current !== null) {
      window.clearTimeout(dragReturnTimer.current);
      dragReturnTimer.current = null;
    }
  }

  function returnDraggedMatch(afterReturn?: () => void) {
    clearDragReturnTimer();
    setDrag((current) =>
      current
        ? {
            ...current,
            x: current.originX,
            y: current.originY,
            returning: true,
          }
        : current,
    );
    dragReturnTimer.current = window.setTimeout(() => {
      setDrag(null);
      dragReturnTimer.current = null;
      afterReturn?.();
    }, 180);
  }

  function toggleDifficulty(nextLowLevel: boolean) {
    setLowLevel(nextLowLevel);
    resetPuzzle(generatePuzzle(nextLowLevel));
  }

  if (!mounted) {
    return null;
  }

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <p className="brand">Mario Studio</p>
          <h1>{text.title}</h1>
          <p>{text.subtitle}</p>
        </div>
        <div className="language-switch" aria-label={text.languageLabel}>
          <button
            type="button"
            aria-pressed={language === "zh"}
            onClick={() => setLanguage("zh")}
          >
            中
          </button>
          <button
            type="button"
            aria-pressed={language === "en"}
            onClick={() => setLanguage("en")}
          >
            EN
          </button>
        </div>
      </header>

      <section className="game-layout">
        <aside className="control-panel" aria-label={text.gameSettingsLabel}>
          <div className="control-row">
            <span>{text.easy}</span>
            <button
              type="button"
              className="toggle"
              aria-pressed={!lowLevel}
              onClick={() => toggleDifficulty(!lowLevel)}
            >
              {lowLevel ? text.easy : text.hard}
            </button>
          </div>
          <label className="check-row">
            <input
              type="checkbox"
              checked={timerEnabled}
              onChange={(event) => {
                setTimerEnabled(event.target.checked);
                setTimeLeft(60);
              }}
            />
            <span>{text.timer}</span>
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={soundEnabled}
              onChange={(event) => setSoundEnabled(event.target.checked)}
            />
            <span>{text.sound}</span>
          </label>
          <dl className="stats">
            <div>
              <dt>{text.solved}</dt>
              <dd>{stats.solved}</dd>
            </div>
            <div>
              <dt>{text.streak}</dt>
              <dd>{stats.streak}</dd>
            </div>
            <div>
              <dt>{text.bypassed}</dt>
              <dd>{stats.bypassed}</dd>
            </div>
          </dl>
        </aside>

        <section className="play-area" aria-label={text.puzzleLabel}>
          <div className="status-strip">
            <span>
              {text.answersFound}: {answersFound}/{puzzle.answers.length}
            </span>
            <span>
              {text.attempts}: {attempts}
            </span>
            <span className={timeLeft <= 10 && timerEnabled ? "danger" : ""}>
              {timerEnabled ? `${timeLeft}s` : "--"}
            </span>
          </div>

          <div className="equation" aria-label={displayExpression}>
            {displayExpression.split("").map((char, position) => (
              <MatchstickChar
                key={`${position}-${char}`}
                char={char}
                position={position}
                selected={selected}
                selectionActive={selected !== null}
                locked={locked}
                onSegmentClick={handleSegmentClick}
                onSegmentPointerDown={handleSegmentPointerDown}
                onSegmentPointerMove={handleSegmentPointerMove}
                onSegmentPointerUp={handleSegmentPointerUp}
                onSegmentPointerCancel={handleSegmentPointerCancel}
                labels={text}
              />
            ))}
          </div>

          {drag ? (
            <div
              className={`drag-ghost ${drag.orientation} ${drag.returning ? "returning" : ""}`}
              aria-hidden="true"
              style={{
                left: drag.x,
                top: drag.y,
                width: drag.helperSize,
                height: drag.helperSize,
              }}
            />
          ) : null}

          <p className={`message ${solved ? "success" : ""}`}>
            {text[messageKey]}
          </p>

          <div className="actions">
            <button type="button" onClick={startNewPuzzle}>
              {text.newPuzzle}
            </button>
            <button type="button" onClick={undoPuzzle}>
              {text.undo}
            </button>
            <button
              type="button"
              onClick={() => setShowAnswers((value) => !value)}
            >
              {showAnswers ? text.hideAnswer : text.answer}
            </button>
            <button
              type="button"
              aria-label={text.voice}
              aria-pressed={listening}
              disabled={locked || listening}
              onClick={startVoiceAnswer}
            >
              {listening ? "..." : text.voice}
            </button>
          </div>

          {showAnswers ? (
            <section className="answers">
              <h2>{text.answerTitle}</h2>
              <ol>
                {puzzle.answers.map((answer) => (
                  <li key={answer}>{answer}</li>
                ))}
              </ol>
            </section>
          ) : null}
        </section>
      </section>

      <footer>
        <span>{text.install}</span>
        <span>(c) Copyright Mario Studio 2026-2027</span>
      </footer>
    </main>
  );
}

type MatchstickCharProps = {
  char: string;
  position: number;
  selected: SelectedSegment | null;
  selectionActive: boolean;
  locked: boolean;
  onSegmentClick: (position: number, segment: number, visible: boolean) => void;
  onSegmentPointerDown: (
    event: PointerEvent<HTMLButtonElement>,
    position: number,
    segment: number,
    visible: boolean,
    orientation: "horizontal" | "vertical",
  ) => void;
  onSegmentPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onSegmentPointerUp: (event: PointerEvent<HTMLButtonElement>) => void;
  onSegmentPointerCancel: () => void;
  labels: {
    equalsLabel: string;
    segmentLabel: string;
  };
};

function MatchstickChar({
  char,
  position,
  selected,
  selectionActive,
  locked,
  onSegmentClick,
  onSegmentPointerDown,
  onSegmentPointerMove,
  onSegmentPointerUp,
  onSegmentPointerCancel,
  labels,
}: MatchstickCharProps) {
  if (char === "=") {
    return (
      <div className="match-char equal-char" aria-label={labels.equalsLabel}>
        <span />
        <span />
      </div>
    );
  }

  const visibleSegments = getVisibleSegments(char);
  const maxSegments = char === "+" || char === "-" ? 2 : 7;

  return (
    <div
      className={`match-char ${char === "+" || char === "-" ? "operator-char" : ""}`}
    >
      {Array.from({ length: maxSegments }, (_, segment) => {
        const visible = Boolean(visibleSegments[segment]);
        const selectedHere =
          selected?.position === position && selected.segment === segment;
        const droppable = getDroppableSegments(char).includes(segment);
        const draggable = getDraggableSegments(char).includes(segment);
        const orientation = getSegmentOrientation(char, segment);
        const actionable =
          !locked &&
          ((visible && draggable) ||
            (!visible && droppable && selectionActive));

        if (!visible && !(droppable && selectionActive)) {
          return null;
        }

        return (
          <button
            key={segment}
            type="button"
            className={[
              "match-segment",
              orientation,
              char === "+" || char === "-"
                ? `operator-segment-${segment}`
                : `segment-${segment}`,
              visible ? "visible" : "placeholder",
              selectedHere ? "selected" : "",
            ].join(" ")}
            disabled={!actionable}
            aria-label={labels.segmentLabel.replace(
              "{segment}",
              String(segment + 1),
            )}
            data-position={position}
            data-segment={segment}
            onClick={() => onSegmentClick(position, segment, visible)}
            onPointerDown={(event) =>
              onSegmentPointerDown(
                event,
                position,
                segment,
                visible,
                orientation,
              )
            }
            onPointerMove={onSegmentPointerMove}
            onPointerUp={onSegmentPointerUp}
            onPointerCancel={onSegmentPointerCancel}
            onContextMenu={(event) => event.preventDefault()}
            onDragStart={(event) => event.preventDefault()}
          />
        );
      })}
    </div>
  );
}

function moveDragToPointer(
  current: NonNullable<DragState>,
  event: PointerEvent<HTMLButtonElement>,
  returning: boolean,
  shouldSnap = false,
) {
  const helperPoint = getDragHelperPoint(
    event,
    current.offsetX,
    current.offsetY,
  );
  const snapTarget = shouldSnap ? findSnapTarget(helperPoint) : null;

  return {
    ...current,
    x: snapTarget?.x ?? helperPoint.x,
    y: snapTarget?.y ?? helperPoint.y,
    returning,
  };
}

function getSegmentOrientation(char: string, segment: number) {
  if (char === "+" || char === "-") {
    return segment === 1 ? "vertical" : "horizontal";
  }

  return segment === 0 || segment === 2 || segment === 3 || segment === 5
    ? "vertical"
    : "horizontal";
}
