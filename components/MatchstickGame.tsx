"use client";

import {
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { copy, type Language } from "@/components/matchstick/copy";
import { GameControls } from "@/components/matchstick/GameControls";
import { GameOverlay } from "@/components/matchstick/GameOverlay";
import { GameSettings } from "@/components/matchstick/GameSettings";
import { MatchstickChar } from "@/components/matchstick/MatchstickChar";
import { StatsBar } from "@/components/matchstick/StatsBar";
import { usePwaUpdate } from "@/components/matchstick/usePwaUpdate";
import { playApplause } from "@/lib/audio";
import { readJson } from "@/lib/clientStorage";
import {
  type DragHand,
  dragStartThreshold,
  findSnapTarget,
  getDragHelperMetrics,
  getDragHelperPoint,
  moveDragToPointer,
} from "@/lib/drag";
import {
  getSelectionMessageKey,
  shouldCancelSelectionFromPlaygroundClick,
  shouldCountPuzzleBypass,
  shouldPreventPageZoomGesture,
  shouldStartNewPuzzleFromPlaygroundDoubleClick,
} from "@/lib/interaction";
import {
  canDropMatchstick,
  createInitialPuzzle,
  createPuzzleFromExpression,
  getDraggableSegments,
  isAnswer,
  type Puzzle,
  type SelectedSegment,
  tryMove,
} from "@/lib/matchstick";
import {
  normalizePuzzleDifficulty,
  pickPuzzleFromBook,
  type PuzzleDifficulty,
} from "@/lib/puzzleBook";
import { copyText } from "@/lib/share";
import {
  getSpeechRecognitionConstructor,
  parseSpokenExpression,
  type SpeechRecognitionLike,
} from "@/lib/speech";

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
  | "loadFailed";

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
  const pwaUpdate = usePwaUpdate();
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const loadingRef = useRef(false);
  const [language, setLanguage] = useState<Language>("zh");
  const [difficulty, setDifficulty] = useState<PuzzleDifficulty>("level0");
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [dragHand, setDragHand] = useState<DragHand>("right");
  const [puzzle, setPuzzle] = useState<Puzzle>(initialPuzzle);
  const [displayExpression, setDisplayExpression] = useState(puzzle.expression);
  const [selected, setSelected] = useState<SelectedSegment | null>(null);
  const [messageKey, setMessageKey] = useState<MessageKey>("selectHint");
  const [solved, setSolved] = useState(false);
  const [solvedAnswers, setSolvedAnswers] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState(60);
  const [showAnswers, setShowAnswers] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<
    "shareCopied" | "shareDone" | "shareFailed" | null
  >(null);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [drag, setDrag] = useState<DragState>(null);
  const [listening, setListening] = useState(false);
  const [isPhone, setIsPhone] = useState(false);
  const [phonePortrait, setPhonePortrait] = useState(false);
  const suppressNextClick = useRef(false);
  const pendingDrag = useRef<PendingDrag>(null);
  const puzzleRequestId = useRef(0);
  const dragRef = useRef<DragState>(null);
  const dragReturnTimer = useRef<number | null>(null);
  const applauseAudio = useRef<HTMLAudioElement | null>(null);
  const speechRecognition = useRef<SpeechRecognitionLike | null>(null);
  const voiceCanceling = useRef(false);

  const text = copy[language];
  const timedOut = timerEnabled && timeLeft <= 0;
  const interactionLocked = isLoading || solved || timedOut;
  const canUndo = !isLoading && displayExpression !== puzzle.expression;

  const answersFound = useMemo(() => solvedAnswers.length, [solvedAnswers]);

  useEffect(() => {
    setMounted(true);
    applauseAudio.current = new Audio("./hurrah.mp3");
    applauseAudio.current.preload = "auto";
    applauseAudio.current.load();

    const savedSettings = readJson(settingsKey, {
      language: "zh" as Language,
      difficulty: "level0" as PuzzleDifficulty,
      timerEnabled: false,
      soundEnabled: true,
      dragHand: "right" as DragHand,
    });
    const savedDifficulty = normalizePuzzleDifficulty(savedSettings.difficulty);

    setLanguage(savedSettings.language);
    setDifficulty(savedDifficulty);
    setTimerEnabled(savedSettings.timerEnabled);
    setSoundEnabled(savedSettings.soundEnabled);
    setDragHand(savedSettings.dragHand === "left" ? "left" : "right");
    setStats(readJson(statsKey, initialStats));

    const sharedPuzzle = getSharedPuzzleFromUrl();

    if (sharedPuzzle) {
      resetPuzzle(sharedPuzzle);
      setIsLoading(false);
    } else {
      requestPuzzle(savedDifficulty, false);
    }

    setSelected(null);
    setDragState(null);
    pendingDrag.current = null;
    setSolved(false);
    setSolvedAnswers([]);
    setTimeLeft(60);
    setShowAnswers(false);
    setMessageKey("selectHint");
    return () => {
      puzzleRequestId.current += 1;
      loadingRef.current = false;
    };
    // Bootstrap runs once; subsequent renders must preserve the active puzzle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    const visualViewport = window.visualViewport;
    const updatePhoneViewport = () => {
      const width = visualViewport?.width || window.innerWidth;
      const height = visualViewport?.height || window.innerHeight;
      const shortSide = Math.min(width, height);
      const hasCoarsePointer = window.matchMedia("(pointer: coarse)").matches;
      const hasMobileUserAgent = /Android|iPhone|iPod|Mobile/i.test(
        navigator.userAgent,
      );
      const nextIsPhone =
        shortSide <= 600 && (hasCoarsePointer || hasMobileUserAgent);

      setIsPhone(nextIsPhone);
      setPhonePortrait(nextIsPhone && height >= width);
      document.documentElement.classList.toggle("is-phone-game", nextIsPhone);
      if (nextIsPhone) {
        document.documentElement.style.setProperty(
          "--game-viewport-width",
          `${width}px`,
        );
        document.documentElement.style.setProperty(
          "--game-viewport-height",
          `${height}px`,
        );
      } else {
        document.documentElement.style.removeProperty("--game-viewport-width");
        document.documentElement.style.removeProperty("--game-viewport-height");
      }
    };

    updatePhoneViewport();
    window.addEventListener("resize", updatePhoneViewport);
    window.addEventListener("orientationchange", updatePhoneViewport);
    window.addEventListener("pageshow", updatePhoneViewport);
    visualViewport?.addEventListener("resize", updatePhoneViewport);

    return () => {
      window.removeEventListener("touchmove", preventMultiTouchZoom);
      window.removeEventListener("gesturestart", preventGestureZoom);
      window.removeEventListener("resize", updatePhoneViewport);
      window.removeEventListener("orientationchange", updatePhoneViewport);
      window.removeEventListener("pageshow", updatePhoneViewport);
      visualViewport?.removeEventListener("resize", updatePhoneViewport);
      document.documentElement.classList.remove("is-phone-game");
      document.documentElement.style.removeProperty("--game-viewport-width");
      document.documentElement.style.removeProperty("--game-viewport-height");
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
      JSON.stringify({
        language,
        difficulty,
        timerEnabled,
        soundEnabled,
        dragHand,
      }),
    );
  }, [difficulty, dragHand, language, mounted, soundEnabled, timerEnabled]);

  useEffect(() => {
    if (isLoading || !timerEnabled || solved || timeLeft <= 0) {
      return;
    }

    const timerId = window.setInterval(() => {
      setTimeLeft((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [isLoading, timerEnabled, solved, timeLeft]);

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
    setSolved(false);
    setSolvedAnswers([]);
    setTimeLeft(60);
    setShowAnswers(false);
    setMessageKey("selectHint");
  }

  function startNewPuzzle() {
    requestPuzzle(difficulty, shouldCountPuzzleBypass(answersFound));
  }

  function requestPuzzle(
    nextDifficulty: PuzzleDifficulty,
    countBypass: boolean,
  ) {
    if (loadingRef.current) return;
    loadingRef.current = true;
    clearDragReturnTimer();
    setIsLoading(true);
    setSelected(null);
    setDragState(null);
    pendingDrag.current = null;
    speechRecognition.current?.abort();
    speechRecognition.current = null;
    setListening(false);
    const requestId = ++puzzleRequestId.current;
    void pickPuzzleFromBook(nextDifficulty, puzzle.expression).then(
      (nextPuzzle) => {
        if (requestId !== puzzleRequestId.current) return;
        if (countBypass) {
          setStats((current) => ({
            ...current,
            streak: 0,
            bypassed: current.bypassed + 1,
          }));
        }
        setDifficulty(nextDifficulty);
        resetPuzzle(nextPuzzle);
        clearSharedPuzzleUrl();
        loadingRef.current = false;
        setIsLoading(false);
      },
      () => {
        if (requestId !== puzzleRequestId.current) return;
        loadingRef.current = false;
        setIsLoading(false);
        setMessageKey("loadFailed");
      },
    );
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
    setShareFeedback(null);
    const url = getPuzzleShareUrl(puzzle.expression);

    if (await copyText(url)) {
      setShareFeedback("shareCopied");
      return;
    }

    try {
      if (navigator.share) {
        await navigator.share({ title: text.title, url });
        setShareFeedback("shareDone");
        return;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
    }

    setShareFeedback("shareFailed");
  }

  function startVoiceAnswer() {
    if (interactionLocked) {
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
      if (speechRecognition.current !== recognition || loadingRef.current)
        return;
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

    if (interactionLocked) {
      return;
    }

    const char = displayExpression[position];
    const draggable = getDraggableSegments(char).includes(segment);
    const droppable = canDropSelectedMatchstick(position, segment);

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

  function handlePlayAreaClick(event: MouseEvent<HTMLElement>) {
    if (
      !shouldCancelSelectionFromPlaygroundClick({
        isInteractiveTarget: isInteractiveClickTarget(event.target),
        interactionLocked,
        hasSelected: Boolean(selected),
      })
    ) {
      return;
    }

    setSelected(null);
    setMessageKey("selectHint");
  }

  function handlePlayAreaDoubleClick(event: MouseEvent<HTMLElement>) {
    if (
      !shouldStartNewPuzzleFromPlaygroundDoubleClick({
        isInteractiveTarget: isInteractiveClickTarget(event.target),
        solved,
      })
    ) {
      return;
    }

    event.preventDefault();
    startNewPuzzle();
  }

  function canDropSelectedMatchstick(position: number, segment: number) {
    return selected
      ? canDropMatchstick(displayExpression, selected, { position, segment })
      : false;
  }

  function handleSegmentPointerDown(
    event: PointerEvent<HTMLButtonElement>,
    position: number,
    segment: number,
    visible: boolean,
    orientation: "horizontal" | "vertical",
  ) {
    if (interactionLocked || !visible) {
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
    const helperMetrics = getDragHelperMetrics(
      rect,
      orientation,
      phonePortrait,
      dragHand,
    );
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

  function changeDifficulty(nextDifficulty: PuzzleDifficulty) {
    if (nextDifficulty === difficulty) {
      return;
    }

    requestPuzzle(nextDifficulty, false);
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
    <main
      className={[
        "app-shell",
        isPhone ? "phone-layout" : "",
        phonePortrait ? "phone-portrait" : "",
      ].join(" ")}
    >
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
          <section
            className="play-area"
            aria-label={text.puzzleLabel}
            onClick={handlePlayAreaClick}
            onDoubleClick={handlePlayAreaDoubleClick}
          >
            <div className="status-strip">
              <span
                aria-label={`${text.answersFound}: ${answersFound}/${puzzle.answers.length}`}
              >
                {answersFound}/{puzzle.answers.length}
              </span>
              <div className="status-copy">
                <strong className="status-brand">{text.title}</strong>
                <span
                  className={solved ? "success" : ""}
                  role="status"
                  title={text[messageKey]}
                >
                  {isLoading ? text.loading : text.shortHints[messageKey]}
                </span>
              </div>
              <span
                aria-label={
                  timerEnabled ? `${text.timer}: ${timeLeft}s` : undefined
                }
                className={timeLeft <= 10 && timerEnabled ? "danger" : ""}
              >
                {timerEnabled ? `${timeLeft}s` : ""}
              </span>
            </div>

            <div className="equation-viewport">
              <div
                className="equation"
                aria-label={displayExpression}
                style={
                  {
                    "--character-count": displayExpression.length,
                  } as CSSProperties
                }
              >
                {displayExpression.split("").map((char, position) => (
                  <MatchstickChar
                    key={`${position}-${char}`}
                    char={char}
                    position={position}
                    rotatedClockwise={phonePortrait}
                    selected={selected}
                    selectionActive={selected !== null}
                    interactionLocked={interactionLocked}
                    onSegmentClick={handleSegmentClick}
                    canDropSegment={canDropSelectedMatchstick}
                    onSegmentPointerDown={handleSegmentPointerDown}
                    onSegmentPointerMove={handleSegmentPointerMove}
                    onSegmentPointerUp={handleSegmentPointerUp}
                    onSegmentPointerCancel={handleSegmentPointerCancel}
                    labels={text}
                  />
                ))}
              </div>
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
              isLoading={isLoading}
              text={text}
              difficulty={difficulty}
              showAnswers={showAnswers}
              listening={listening}
              solved={solved}
              interactionLocked={interactionLocked}
              canUndo={canUndo}
              onDifficultyChange={changeDifficulty}
              onNewPuzzle={startNewPuzzle}
              onUndo={undoPuzzle}
              onToggleAnswers={() => setShowAnswers((value) => !value)}
              onOpenSettings={() => {
                setShareFeedback(null);
                setSettingsOpen(true);
              }}
              onVoiceAnswer={startVoiceAnswer}
            />
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
      <GameOverlay
        open={showAnswers}
        title={text.answerTitle}
        closeLabel={text.close}
        onClose={() => setShowAnswers(false)}
      >
        <ol className="answer-list">
          {puzzle.answers.map((answer) => (
            <li key={answer}>{answer}</li>
          ))}
        </ol>
      </GameOverlay>
      <GameSettings
        update={pwaUpdate}
        open={settingsOpen}
        text={text}
        language={language}
        timerEnabled={timerEnabled}
        soundEnabled={soundEnabled}
        dragHand={dragHand}
        onDragHandChange={setDragHand}
        stats={stats}
        feedback={shareFeedback ? text[shareFeedback] : ""}
        onClose={() => setSettingsOpen(false)}
        onLanguageChange={setLanguage}
        onTimerChange={(enabled) => {
          setTimerEnabled(enabled);
          setTimeLeft(60);
        }}
        onSoundChange={setSoundEnabled}
        onShare={sharePuzzle}
        onClearStats={clearStats}
      />
      {pwaUpdate.status === "available" && !updateDismissed && !settingsOpen ? (
        <aside className="update-notice" aria-label={text.updateAvailable}>
          <button type="button" onClick={() => setSettingsOpen(true)}>
            {text.updateAvailable}
          </button>
          <button type="button" onClick={() => setUpdateDismissed(true)}>
            {text.updateLater}
          </button>
        </aside>
      ) : null}
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

function isInteractiveClickTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    Boolean(
      target.closest(
        "button, input, label, a, .match-segment, .answers, .actions, .difficulty-stepper",
      ),
    )
  );
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
