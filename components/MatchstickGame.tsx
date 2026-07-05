"use client";

import {
  type MouseEvent,
  type PointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createPuzzleFromExpression,
  createInitialPuzzle,
  generatePuzzle,
  getDraggableSegments,
  getDroppableSegments,
  isAnswer,
  type Puzzle,
  type SelectedSegment,
  tryMove,
} from "@/lib/matchstick";
import { copy, type Language } from "@/components/matchstick/copy";
import { GameControls } from "@/components/matchstick/GameControls";
import { MatchstickChar } from "@/components/matchstick/MatchstickChar";
import { StatsBar } from "@/components/matchstick/StatsBar";
import { playApplause } from "@/lib/audio";
import { readJson } from "@/lib/clientStorage";
import {
  dragStartThreshold,
  findSnapTarget,
  getDragHelperMetrics,
  getDragHelperPoint,
  moveDragToPointer,
} from "@/lib/drag";
import {
  getSelectionMessageKey,
  shouldCountPuzzleBypass,
  shouldPreventPageZoomGesture,
  shouldCancelSelectionFromPlaygroundClick,
} from "@/lib/interaction";
import {
  getSpeechRecognitionConstructor,
  parseSpokenExpression,
  type SpeechRecognitionLike,
} from "@/lib/speech";
import { copyText } from "@/lib/share";

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
  | "voicePermission"
  | "shareCopied"
  | "shareFailed";

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

type PendingDrag = {
  from: SelectedSegment;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  offsetX: number;
  offsetY: number;
  helperSize: number;
  orientation: "horizontal" | "vertical";
} | null;

const statsKey = "imatchstick-pwa-stats";
const settingsKey = "imatchstick-pwa-settings";
const initialStats: Stats = { solved: 0, streak: 0, bypassed: 0 };
const initialPuzzle = createInitialPuzzle();

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
  const [phonePortrait, setPhonePortrait] = useState(false);
  const suppressNextClick = useRef(false);
  const pendingDrag = useRef<PendingDrag>(null);
  const dragRef = useRef<DragState>(null);
  const dragReturnTimer = useRef<number | null>(null);
  const applauseAudio = useRef<HTMLAudioElement | null>(null);
  const speechRecognition = useRef<SpeechRecognitionLike | null>(null);
  const voiceCanceling = useRef(false);

  const text = copy[language];
  const locked = solved || (timerEnabled && timeLeft <= 0);
  const canUndo = displayExpression !== puzzle.expression;

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

    const nextPuzzle =
      getSharedPuzzleFromUrl() ?? generatePuzzle(savedSettings.lowLevel);
    setPuzzle(nextPuzzle);
    setDisplayExpression(nextPuzzle.expression);
    setSelected(null);
    setDragState(null);
    pendingDrag.current = null;
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
    if (typeof window === "undefined") {
      return;
    }

    const preventMultiTouchZoom = (event: TouchEvent) => {
      if (shouldPreventPageZoomGesture(event.touches.length)) {
        event.preventDefault();
      }
    };
    const preventGestureZoom = (event: Event) => {
      event.preventDefault();
    };

    window.addEventListener("touchmove", preventMultiTouchZoom, {
      passive: false,
    });
    window.addEventListener("gesturestart", preventGestureZoom);

    const media = window.matchMedia(
      "(orientation: portrait) and (max-width: 760px)",
    );
    const updatePhonePortrait = () => setPhonePortrait(media.matches);

    updatePhonePortrait();
    media.addEventListener("change", updatePhonePortrait);

    return () => {
      window.removeEventListener("touchmove", preventMultiTouchZoom);
      window.removeEventListener("gesturestart", preventGestureZoom);
      media.removeEventListener("change", updatePhonePortrait);
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
    setDragState(null);
    pendingDrag.current = null;
    setAttempts(0);
    setSolved(false);
    setSolvedAnswers([]);
    setTimeLeft(60);
    setShowAnswers(false);
    setMessageKey("selectHint");
  }

  function startNewPuzzle() {
    if (shouldCountPuzzleBypass({ attempts, answersFound })) {
      setStats((current) => ({
        ...current,
        streak: 0,
        bypassed: current.bypassed + 1,
      }));
    }

    resetPuzzle(generatePuzzle(lowLevel));
    clearSharedPuzzleUrl();
  }

  function undoPuzzle() {
    clearDragReturnTimer();
    speechRecognition.current?.abort();
    speechRecognition.current = null;
    setListening(false);
    setDisplayExpression(puzzle.expression);
    setSelected(null);
    setDragState(null);
    pendingDrag.current = null;
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
    setDragState(null);
    pendingDrag.current = null;
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

  async function sharePuzzle() {
    const url = getPuzzleShareUrl(puzzle.expression);

    if (await copyText(url)) {
      setMessageKey("shareCopied");
      return;
    }

    try {
      if (navigator.share) {
        await navigator.share({ title: text.title, url });
        setMessageKey("shareCopied");
        return;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
    }

    setMessageKey("shareFailed");
  }

  function startVoiceAnswer() {
    if (locked) {
      return;
    }

    if (listening && speechRecognition.current) {
      voiceCanceling.current = true;
      speechRecognition.current.abort();
      speechRecognition.current = null;
      setListening(false);
      setMessageKey(getSelectionMessageKey(Boolean(selected)));
      return;
    }

    const Recognition = getSpeechRecognitionConstructor();

    if (!Recognition) {
      setMessageKey("voiceUnsupported");
      return;
    }

    speechRecognition.current?.abort();
    voiceCanceling.current = false;

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

      if (voiceCanceling.current) {
        voiceCanceling.current = false;
        speechRecognition.current = null;
        setListening(false);
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

      voiceCanceling.current = false;
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

  function handleEquationClick(event: MouseEvent<HTMLDivElement>) {
    if (
      !shouldCancelSelectionFromPlaygroundClick({
        target: event.target,
        currentTarget: event.currentTarget,
        locked,
        hasSelected: Boolean(selected),
      })
    ) {
      return;
    }

    setSelected(null);
    setMessageKey("selectHint");
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
    pendingDrag.current = {
      from,
      startX: event.clientX,
      startY: event.clientY,
      originX,
      originY,
      offsetX: helperMetrics.offsetX,
      offsetY: helperMetrics.offsetY,
      helperSize: helperMetrics.helperSize,
      orientation,
    };
  }

  function handleSegmentPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const currentDrag = dragRef.current;

    if (!currentDrag && pendingDrag.current) {
      const pending = pendingDrag.current;
      const distance = Math.hypot(
        event.clientX - pending.startX,
        event.clientY - pending.startY,
      );

      if (distance < dragStartThreshold) {
        return;
      }

      suppressNextClick.current = true;
      setSelected(pending.from);
      setMessageKey("selectedHint");
      setDragState(
        moveDragToPointer(
          {
            from: pending.from,
            originX: pending.originX,
            originY: pending.originY,
            offsetX: pending.offsetX,
            offsetY: pending.offsetY,
            helperSize: pending.helperSize,
            x: pending.originX,
            y: pending.originY,
            orientation: pending.orientation,
            returning: false,
          },
          event,
          false,
          true,
        ),
      );
      pendingDrag.current = null;
      return;
    }

    if (!currentDrag) {
      return;
    }

    suppressNextClick.current = true;
    setDragState(moveDragToPointer(currentDrag, event, false, true));
  }

  function handleSegmentPointerUp(event: PointerEvent<HTMLButtonElement>) {
    const currentDrag = dragRef.current;

    if (pendingDrag.current && !currentDrag) {
      pendingDrag.current = null;
      return;
    }

    if (!currentDrag) {
      return;
    }

    const helperPoint = getDragHelperPoint(
      event,
      currentDrag.offsetX,
      currentDrag.offsetY,
    );
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

      setDragState(null);
      return;
    }

    const to = {
      position: Number(target.dataset.position),
      segment: Number(target.dataset.segment),
    };
    const movedExpression = tryMove(displayExpression, currentDrag.from, to);
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
    pendingDrag.current = null;

    if (suppressNextClick.current) {
      returnDraggedMatch(() => setSelected(null));
      return;
    }

    setDragState(null);
  }

  function clearDragReturnTimer() {
    if (dragReturnTimer.current !== null) {
      window.clearTimeout(dragReturnTimer.current);
      dragReturnTimer.current = null;
    }
  }

  function returnDraggedMatch(afterReturn?: () => void) {
    clearDragReturnTimer();
    const current = dragRef.current;
    setDragState(
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
      setDragState(null);
      dragReturnTimer.current = null;
      afterReturn?.();
    }, 180);
  }

  function toggleDifficulty(nextLowLevel: boolean) {
    if (nextLowLevel === lowLevel) {
      return;
    }

    setLowLevel(nextLowLevel);
    resetPuzzle(generatePuzzle(nextLowLevel));
  }

  function setDragState(nextDrag: DragState) {
    dragRef.current = nextDrag;
    setDrag(nextDrag);
  }

  function clearStats() {
    setStats(initialStats);
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
        <div className="play-column">
          <section className="play-area" aria-label={text.puzzleLabel}>
            <div className="status-strip">
              <span>
                {text.answersFound}: {answersFound}/{puzzle.answers.length}
              </span>
              <span className={solved ? "success" : ""}>
                {text[messageKey]}
              </span>
              <span className={timeLeft <= 10 && timerEnabled ? "danger" : ""}>
                {timerEnabled ? `${timeLeft}s` : "--"}
              </span>
            </div>

            {!lowLevel && phonePortrait ? (
              <p className="orientation-hint">{text.rotateHint}</p>
            ) : null}

            <div
              className="equation"
              aria-label={displayExpression}
              onClick={handleEquationClick}
            >
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

            <GameControls
              text={text}
              lowLevel={lowLevel}
              timerEnabled={timerEnabled}
              soundEnabled={soundEnabled}
              showAnswers={showAnswers}
              listening={listening}
              solved={solved}
              locked={locked}
              canUndo={canUndo}
              onDifficultyChange={toggleDifficulty}
              onTimerChange={(enabled) => {
                setTimerEnabled(enabled);
                setTimeLeft(60);
              }}
              onSoundChange={setSoundEnabled}
              onNewPuzzle={startNewPuzzle}
              onUndo={undoPuzzle}
              onToggleAnswers={() => setShowAnswers((value) => !value)}
              onSharePuzzle={sharePuzzle}
              onVoiceAnswer={startVoiceAnswer}
            />

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
        </div>
      </section>

      <div className="bottom-row">
        <StatsBar text={text} stats={stats} onClearStats={clearStats} />
        <footer>
          <span>(c) Copyright Mario Studio 2026-2027</span>
          <a
            href="https://github.com/KingMario/iMatchstick"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </footer>
      </div>
    </main>
  );
}

function getSharedPuzzleFromUrl() {
  if (typeof window === "undefined") {
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  const expression = params.get("puzzle") ?? params.get("p");

  if (!expression) {
    return null;
  }

  return createPuzzleFromExpression(normalizeSharedExpression(expression));
}

function getPuzzleShareUrl(expression: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("puzzle", expression);
  return url.toString();
}

function clearSharedPuzzleUrl() {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);

  if (!url.searchParams.has("puzzle") && !url.searchParams.has("p")) {
    return;
  }

  url.searchParams.delete("puzzle");
  url.searchParams.delete("p");
  window.history.replaceState(null, "", url);
}

function normalizeSharedExpression(expression: string) {
  return expression
    .trim()
    .replace(/\s/g, "")
    .replace(/[＋]/g, "+")
    .replace(/[－]/g, "-")
    .replace(/[＝]/g, "=")
    .replace(/[０-９]/g, (char) =>
      String.fromCharCode(char.charCodeAt(0) - 0xff10 + 48),
    );
}
