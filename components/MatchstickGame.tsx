"use client";

import { TouchMagnifier } from "./matchstick/TouchMagnifier";

import {
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ActionIcon } from "@/components/matchstick/ActionIcon";
import { AnswerProgress } from "@/components/matchstick/AnswerProgress";
import { copy, type Language } from "@/components/matchstick/copy";
import { DifficultyControl } from "@/components/matchstick/DifficultyControl";
import { GameControls } from "@/components/matchstick/GameControls";
import { GameOverlay } from "@/components/matchstick/GameOverlay";
import { GameSettings } from "@/components/matchstick/GameSettings";
import { LaunchScreen } from "@/components/matchstick/LaunchScreen";
import { MatchstickArt } from "@/components/matchstick/MatchstickArt";
import { MatchstickChar } from "@/components/matchstick/MatchstickChar";
import { StatsBar } from "@/components/matchstick/StatsBar";
import { SuccessConfetti } from "@/components/matchstick/SuccessConfetti";
import { usePwaUpdate } from "@/components/matchstick/usePwaUpdate";
import { playApplause } from "@/lib/audio";
import { readJson, writeJson } from "@/lib/clientStorage";
import { Academy } from "@/components/matchstick/Academy";
import { academyLessons } from "@/lib/academy";
import {
  emptyAcademyProgress,
  loadAcademy,
  saveAcademy,
  type AcademyProgress,
} from "@/lib/academyStorage";
import {
  type DragHand,
  type DragPointerCapture,
  dragStartThreshold,
  resolveDragTarget,
  getPointerDragMetrics,
  isDragPointer,
  releaseDragPointerCapture,
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
import { createStickDirections } from "@/lib/matchstickAppearance";
import {
  normalizePuzzleDifficulty,
  pickPuzzleFromBook,
  type PuzzleDifficulty,
} from "@/lib/puzzleBook";
import { copyText } from "@/lib/share";
import { getSuccessFeedback } from "@/lib/success";
import {
  getSpeechRecognitionConstructor,
  parseSpokenExpression,
} from "@/lib/speech";

import { createVoiceSession, type VoiceSession } from "@/lib/voiceSession";

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

type DragState =
  | (DragPointerCapture & {
      from: SelectedSegment;
      touchMagnifier: boolean;
      pointerX: number;
      pointerY: number;
      originX: number;
      originY: number;
      offsetX: number;
      offsetY: number;
      helperSize: number;
      x: number;
      y: number;
      orientation: "horizontal" | "vertical";
      returning: boolean;
      snapped?: boolean;
      originOrientation: "horizontal" | "vertical";
    })
  | null;

type PendingDrag =
  | (NonNullable<DragState> & {
      startX: number;
      startY: number;
    })
  | null;

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
  const [stickDirections, setStickDirections] = useState<boolean[][]>([]);
  const [selected, setSelected] = useState<SelectedSegment | null>(null);
  const [messageKey, setMessageKey] = useState<MessageKey>("selectHint");
  const [solved, setSolved] = useState(false);
  const [successFeedback, setSuccessFeedback] = useState<ReturnType<
    typeof getSuccessFeedback
  > | null>(null);
  const [solvedAnswers, setSolvedAnswers] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState(60);
  const [showAnswers, setShowAnswers] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [academyView, setAcademyView] = useState<null | "welcome" | "lessons">(
    null,
  );
  const [academyProgress, setAcademyProgress] =
    useState<AcademyProgress>(emptyAcademyProgress);
  const [shareFeedback, setShareFeedback] = useState<
    "shareCopied" | "shareDone" | "shareFailed" | null
  >(null);
  const [stats, setStats] = useState<Stats>(initialStats);
  const [drag, setDrag] = useState<DragState>(null);
  const [listening, setListening] = useState(false);
  const [voiceCaption, setVoiceCaption] = useState<{
    text: string;
    final: boolean;
  } | null>(null);
  const [isPhone, setIsPhone] = useState(false);
  const [phonePortrait, setPhonePortrait] = useState(false);
  const suppressNextClick = useRef(false);
  const pendingDrag = useRef<PendingDrag>(null);
  const [pendingPress, setPendingPress] = useState<PendingDrag>(null);
  const pendingSource = pendingPress?.from ?? null;
  const touchPreview = drag?.touchMagnifier
    ? drag
    : pendingPress?.touchMagnifier
      ? pendingPress
      : null;
  const puzzleRequestId = useRef(0);
  const dragRef = useRef<DragState>(null);
  const dragReturnTimer = useRef<number | null>(null);
  const applauseAudio = useRef<HTMLAudioElement | null>(null);
  const voiceSession = useRef<VoiceSession | null>(null);
  const equationRef = useRef<HTMLDivElement>(null);
  const gameHeaderRef = useRef<HTMLDivElement>(null);

  const text = copy[language];
  const timedOut = timerEnabled && timeLeft <= 0;
  const interactionLocked =
    isLoading || solved || timedOut || academyView !== null;

  const answersFound = useMemo(() => solvedAnswers.length, [solvedAnswers]);

  const clearDragGesture = useCallback(() => {
    const current = dragRef.current ?? pendingDrag.current;
    pendingDrag.current = null;
    setPendingPress(null);
    dragRef.current = null;
    setDrag(null);
    releaseDragPointerCapture(current);
  }, []);

  const clearTouchDrag = useCallback(() => {
    if (
      !dragRef.current?.touchMagnifier &&
      !pendingDrag.current?.touchMagnifier
    )
      return;
    if (dragReturnTimer.current !== null) {
      window.clearTimeout(dragReturnTimer.current);
      dragReturnTimer.current = null;
    }
    clearDragGesture();
    setSelected(null);
    suppressNextClick.current = true;
  }, [clearDragGesture]);

  // A touch lens must never survive an interrupted gesture or hidden page.
  useEffect(() => {
    const onHidden = () => {
      if (document.hidden) clearTouchDrag();
    };
    window.addEventListener("blur", clearTouchDrag);
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      window.removeEventListener("blur", clearTouchDrag);
      document.removeEventListener("visibilitychange", onHidden);
    };
  }, [clearTouchDrag]);

  useEffect(() => {
    setMounted(true);
    let storage: Storage | null = null;
    try {
      storage = window.localStorage;
    } catch {
      /* Storage may be denied. */
    }
    const academy = loadAcademy(
      storage,
      academyLessons.map((lesson) => lesson.id),
    );
    setAcademyProgress(academy.progress);
    setAcademyView(academy.showWelcome ? "welcome" : null);
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

    setLanguage(savedSettings.language === "en" ? "en" : "zh");
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
    clearDragGesture();
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
      voiceSession.current?.cancel();
      voiceSession.current = null;
      const current = dragRef.current ?? pendingDrag.current;
      dragRef.current = null;
      pendingDrag.current = null;
      releaseDragPointerCapture(current);
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
    let previousViewport = "";
    const updatePhoneViewport = () => {
      const width = visualViewport?.width || window.innerWidth;
      const height = visualViewport?.height || window.innerHeight;
      const viewport = `${width}:${height}`;
      if (
        viewport !== previousViewport &&
        (dragRef.current || pendingDrag.current)
      ) {
        clearDragGesture();
        setSelected(null);
        setMessageKey("selectHint");
        suppressNextClick.current = true;
        if (dragReturnTimer.current !== null) {
          window.clearTimeout(dragReturnTimer.current);
          dragReturnTimer.current = null;
        }
      }
      previousViewport = viewport;
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
      document.documentElement.classList.toggle(
        "is-phone-portrait",
        nextIsPhone && height >= width,
      );
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
      document.documentElement.classList.remove("is-phone-portrait");
      document.documentElement.style.removeProperty("--game-viewport-width");
      document.documentElement.style.removeProperty("--game-viewport-height");
    };
  }, [clearDragGesture]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    writeJson(statsKey, stats);
  }, [mounted, stats]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    writeJson(settingsKey, {
      language,
      difficulty,
      timerEnabled,
      soundEnabled,
      dragHand,
    });
  }, [difficulty, dragHand, language, mounted, soundEnabled, timerEnabled]);

  useEffect(() => {
    if (
      academyView !== null ||
      isLoading ||
      !timerEnabled ||
      solved ||
      timeLeft <= 0
    ) {
      return;
    }

    const timerId = window.setInterval(() => {
      // Invalidate the session before the timeout render/effect can be delayed.
      if (timeLeft <= 1) cancelVoice();
      setTimeLeft((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [academyView, isLoading, timerEnabled, solved, timeLeft]);

  useEffect(() => {
    if (timerEnabled && timeLeft === 0 && !solved) {
      cancelVoice();
      setSelected(null);
      clearTouchDrag();
      setMessageKey("timeout");
    }
  }, [timerEnabled, timeLeft, solved, clearTouchDrag]);

  useEffect(() => {
    if (listening || !voiceCaption) return;
    const timer = window.setTimeout(() => setVoiceCaption(null), 4000);
    return () => window.clearTimeout(timer);
  }, [listening, voiceCaption]);

  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState !== "hidden" || !voiceSession.current)
        return;
      cancelVoice();
      setMessageKey((current) =>
        current === "voiceListening" ? "selectHint" : current,
      );
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => document.removeEventListener("visibilitychange", onHidden);
  }, []);

  function resetPuzzle(nextPuzzle: Puzzle) {
    clearDragReturnTimer();
    cancelVoice();
    setPuzzle(nextPuzzle);
    setStickDirections(createStickDirections(nextPuzzle.expression.length));
    setDisplayExpression(nextPuzzle.expression);
    setSelected(null);
    clearDragGesture();
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
    clearDragGesture();
    cancelVoice();
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
    cancelVoice();
    setDisplayExpression(puzzle.expression);
    setSelected(null);
    clearDragGesture();
    setSolved(false);
    setMessageKey("selectHint");
  }

  function solve(nextExpression: string) {
    clearDragReturnTimer();
    cancelVoice();
    const isNewAnswer = !solvedAnswers.includes(nextExpression);
    setSuccessFeedback(
      getSuccessFeedback(
        puzzle.expression,
        nextExpression,
        solvedAnswers,
        puzzle.answers.length,
      ),
    );

    if (soundEnabled && isNewAnswer) {
      playApplause(applauseAudio.current);
    }

    setDisplayExpression(nextExpression);
    setSelected(null);
    clearDragGesture();
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

  function cancelVoice() {
    const session = voiceSession.current;
    voiceSession.current = null;
    session?.cancel();
    setListening(false);
    setVoiceCaption(null);
  }

  function startVoiceAnswer() {
    // Cancellation must remain possible even if the timer expires this frame.
    if (voiceSession.current) {
      cancelVoice();
      setMessageKey(getSelectionMessageKey(Boolean(selected)));
      return;
    }
    if (interactionLocked) return;
    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) {
      setMessageKey("voiceUnsupported");
      return;
    }
    setListening(true);
    setVoiceCaption({ text: "", final: false });
    setMessageKey("voiceListening");
    const session = createVoiceSession(
      Recognition,
      language === "zh" ? "zh-CN" : "en-US",
      {
        transcript: (value, final) => {
          if (voiceSession.current !== session || loadingRef.current) return;
          setVoiceCaption({ text: value, final });
        },
        answer: (transcripts) => {
          if (voiceSession.current !== session || loadingRef.current) return;
          // A parseable but wrong first alternative must not hide a later answer.
          const answer = transcripts
            .map((transcript) => ({
              transcript,
              expression: parseSpokenExpression([transcript], language),
            }))
            .find(
              ({ expression }) =>
                expression !== null && isAnswer(expression, puzzle.answers),
            );
          if (answer?.expression) {
            solve(answer.expression);
            setVoiceCaption({ text: answer.transcript, final: true });
          } else {
            setMessageKey("voiceNoMatch");
          }
        },
        finish: (reason, error) => {
          if (voiceSession.current !== session) return;
          voiceSession.current = null;
          setListening(false);
          setVoiceCaption((current) =>
            reason === "end" && current ? { ...current, final: true } : null,
          );
          setMessageKey(
            error === "not-allowed" || error === "service-not-allowed"
              ? "voicePermission"
              : "voiceNoMatch",
          );
        },
      },
    );
    voiceSession.current = session;
    session.start();
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
    const source = pendingSource ?? selected;
    return source
      ? canDropMatchstick(displayExpression, source, { position, segment })
      : false;
  }

  function handleSegmentPointerDown(
    event: PointerEvent<HTMLButtonElement>,
    position: number,
    segment: number,
    visible: boolean,
    orientation: "horizontal" | "vertical",
  ) {
    if (
      interactionLocked ||
      !visible ||
      pendingDrag.current ||
      (dragRef.current && !dragRef.current.returning) ||
      event.isPrimary === false ||
      (event.pointerType === "mouse" && event.button !== 0)
    ) {
      return;
    }

    const char = displayExpression[position];

    if (!getDraggableSegments(char).includes(segment)) {
      return;
    }

    suppressNextClick.current = false;
    clearDragReturnTimer();
    setDragState(null);
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    const originX = rect.left + rect.width / 2;
    const originY = rect.top + rect.height / 2;
    const from = { position, segment };
    const helperMetrics = getPointerDragMetrics(rect, orientation, {
      phonePortrait,
      dragHand,
      pointerType: event.pointerType,
      isPhone,
    });
    const pending: NonNullable<PendingDrag> = {
      from,
      element: event.currentTarget,
      pointerId: event.pointerId,
      touchMagnifier: helperMetrics.touchMagnifier,
      pointerX: event.clientX,
      pointerY: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      originX,
      originY,
      offsetX: helperMetrics.offsetX,
      offsetY: helperMetrics.offsetY,
      helperSize: helperMetrics.helperSize,
      orientation,
      originOrientation: orientation,
      x: event.clientX,
      y: event.clientY,
      returning: false,
      snapped: false,
    };
    pendingDrag.current = pending;
    setPendingPress(pending);
  }

  function snapOptions(from: SelectedSegment) {
    return {
      isAllowed: (element: HTMLElement) =>
        canDropMatchstick(displayExpression, from, {
          position: Number(element.dataset.position),
          segment: Number(element.dataset.segment),
        }),
    };
  }

  function handleSegmentPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const currentDrag = dragRef.current;

    if (!currentDrag && pendingDrag.current) {
      const pending = pendingDrag.current;
      if (!isDragPointer(pending, event)) return;
      const distance = Math.hypot(
        event.clientX - pending.startX,
        event.clientY - pending.startY,
      );

      if (distance < dragStartThreshold) {
        if (pending.touchMagnifier) {
          const next = moveDragToPointer(pending, event, false);
          pendingDrag.current = next;
          setPendingPress(next);
        }
        return;
      }

      suppressNextClick.current = true;
      setSelected(pending.from);
      setMessageKey("selectedHint");
      setDragState(
        moveDragToPointer(
          pending,
          event,
          false,
          true,
          snapOptions(pending.from),
        ),
      );
      pendingDrag.current = null;
      setPendingPress(null);
      return;
    }

    if (
      !currentDrag ||
      currentDrag.returning ||
      !isDragPointer(currentDrag, event)
    ) {
      return;
    }

    suppressNextClick.current = true;
    setDragState(
      moveDragToPointer(
        currentDrag,
        event,
        false,
        true,
        snapOptions(currentDrag.from),
      ),
    );
  }

  function handleSegmentPointerUp(event: PointerEvent<HTMLButtonElement>) {
    const currentDrag = dragRef.current;

    if (pendingDrag.current && !currentDrag) {
      if (isDragPointer(pendingDrag.current, event)) clearDragGesture();
      return;
    }

    if (
      !currentDrag ||
      currentDrag.returning ||
      !isDragPointer(currentDrag, event)
    ) {
      return;
    }

    // Retire the owner before releasing capture. The rest of this handler uses
    // its snapshot, and only a threshold-crossed drag can submit a move.
    clearDragGesture();
    const target = resolveDragTarget(
      event,
      currentDrag,
      snapOptions(currentDrag.from),
    ).target?.element;

    if (!target?.dataset.position || !target.dataset.segment) {
      if (suppressNextClick.current) {
        returnDraggedMatch(() => setSelected(null), currentDrag);
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
    returnDraggedMatch(() => setSelected(null), currentDrag);
  }

  function handleSegmentPointerCancel(event: PointerEvent<HTMLButtonElement>) {
    const current = dragRef.current ?? pendingDrag.current;
    if (!isDragPointer(current, event)) return;
    const wasDragging = Boolean(dragRef.current);
    clearDragGesture();
    suppressNextClick.current = true;
    if (wasDragging) returnDraggedMatch(() => setSelected(null), current);
  }

  function clearDragReturnTimer() {
    if (dragReturnTimer.current !== null) {
      window.clearTimeout(dragReturnTimer.current);
      dragReturnTimer.current = null;
    }
  }

  function returnDraggedMatch(
    afterReturn?: () => void,
    current = dragRef.current,
  ) {
    clearDragReturnTimer();
    if (current?.touchMagnifier) {
      setDragState(null);
      afterReturn?.();
      return;
    }
    setDragState(
      current
        ? {
            ...current,
            x: current.originX,
            y: current.originY,
            returning: true,
            orientation: current.originOrientation,
            snapped: true,
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

  function saveAcademyProgress(next: AcademyProgress) {
    setAcademyProgress(next);
    let storage: Storage | null = null;
    try {
      storage = window.localStorage;
    } catch {
      /* Keep progress for this session. */
    }
    saveAcademy(storage, next);
  }

  function openAcademy() {
    setMessageKey((current) =>
      current === "selectedHint" || current === "voiceListening"
        ? "selectHint"
        : current,
    );
    clearDragReturnTimer();
    clearDragGesture();
    setSelected(null);
    cancelVoice();
    setSettingsOpen(false);
    setShowAnswers(false);
    saveAcademyProgress({ ...academyProgress, welcomed: true });
    setAcademyView("lessons");
  }

  function closeAcademy() {
    saveAcademyProgress({ ...academyProgress, welcomed: true });
    setAcademyView(null);
  }

  function openSettings() {
    clearTouchDrag();
    cancelVoice();
    setMessageKey((current) =>
      current === "voiceListening" ? "selectHint" : current,
    );
    setShareFeedback(null);
    setSettingsOpen(true);
  }

  function clearStats() {
    setStats(initialStats);
  }

  if (!mounted) {
    return <LaunchScreen />;
  }

  return (
    <main
      onLostPointerCapture={(event) => {
        if (isDragPointer(dragRef.current ?? pendingDrag.current, event))
          clearTouchDrag();
      }}
      className={[
        "app-shell",
        academyView !== null ? "academy-active" : "",
        isPhone ? "phone-layout" : "",
        phonePortrait ? "phone-portrait" : "",
      ].join(" ")}
    >
      {academyView === "welcome" ? (
        <section
          className="academy-screen academy-welcome"
          data-testid="academy-welcome"
          aria-labelledby="academy-welcome-title"
        >
          <h1 id="academy-welcome-title">
            {language === "zh" ? "火柴入门学园" : "Matchstick Academy"}
          </h1>
          <p>
            {language === "zh"
              ? "六章、24 个小练习，从认数字到修好第一道等式。"
              : "Six chapters, 24 short lessons: from digits to your first equation."}
          </p>
          <p>
            {language === "zh"
              ? "不限时，随时跳过。以后也可以从设置重新进入。"
              : "No timer. Skip whenever you like, and return anytime from Settings."}
          </p>
          <div className="academy-actions">
            <button
              type="button"
              data-testid="academy-begin"
              onClick={openAcademy}
            >
              {language === "zh" ? "开始学习" : "Start learning"}
            </button>
            <button
              type="button"
              data-testid="academy-skip"
              onClick={closeAcademy}
            >
              {language === "zh" ? "直接挑战" : "Go to puzzles"}
            </button>
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
        </section>
      ) : academyView === "lessons" ? (
        <Academy
          language={language}
          phonePortrait={phonePortrait}
          isPhone={isPhone}
          dragHand={dragHand}
          completedLessonIds={academyProgress.completedLessonIds}
          onComplete={(id) =>
            saveAcademyProgress({
              ...academyProgress,
              completedLessonIds: [
                ...new Set([...academyProgress.completedLessonIds, id]),
              ],
            })
          }
          onExit={closeAcademy}
        />
      ) : (
        <>
          <header className="top-bar">
            <div>
              <p className="brand">Mario Studio</p>
              <h1>{text.title}</h1>
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
                  <div className="status-actions">
                    <AnswerProgress
                      count={answersFound}
                      total={puzzle.answers.length}
                      label={text.answersFound}
                      celebrate={solved && successFeedback?.kind !== "repeat"}
                      portrait={phonePortrait}
                      equationRef={equationRef}
                    />
                    <button
                      type="button"
                      className="settings-button"
                      aria-label={text.settingsTitle}
                      title={text.settingsTitle}
                      aria-haspopup="dialog"
                      aria-expanded={settingsOpen}
                      onClick={openSettings}
                    >
                      <ActionIcon name="settings" />
                    </button>
                  </div>
                  <div className="status-copy" ref={gameHeaderRef}>
                    {voiceCaption ? (
                      <div
                        className="voice-caption"
                        role="status"
                        aria-live="polite"
                        aria-atomic="true"
                        data-final={voiceCaption.final}
                      >
                        <strong>
                          {solved && successFeedback
                            ? `✓ ${text.successResults[successFeedback.kind]}`
                            : listening
                              ? text.voiceCaptionListening
                              : text.voiceCaptionHeard}
                        </strong>
                        <span title={voiceCaption.text}>
                          {voiceCaption.text ||
                            (listening
                              ? text.voiceCaptionPrompt
                              : text.voiceCaptionEmpty)}
                        </span>
                      </div>
                    ) : (
                      <>
                        <strong className="status-brand">{text.title}</strong>
                        <span
                          className={solved ? "success" : ""}
                          role="status"
                          title={text[messageKey]}
                        >
                          {isLoading ? (
                            text.loading
                          ) : solved && successFeedback ? (
                            <>
                              <strong className="success-title">
                                ✓ {text.successResults[successFeedback.kind]}
                              </strong>
                              <small className="success-next">
                                {isPhone
                                  ? answersFound === puzzle.answers.length
                                    ? text.successNextCompact
                                    : text.successMoreCompact
                                  : answersFound === puzzle.answers.length
                                    ? text.successNext
                                    : text.successMore}
                              </small>
                            </>
                          ) : (
                            text.shortHints[messageKey]
                          )}
                        </span>
                      </>
                    )}
                  </div>
                  <span
                    aria-label={
                      timerEnabled ? `${text.timer}: ${timeLeft}s` : undefined
                    }
                    className={`status-timer ${timeLeft <= 10 && timerEnabled ? "danger" : ""}`}
                  >
                    {timerEnabled ? `${timeLeft}s` : ""}
                  </span>
                </div>

                <div className="equation-viewport">
                  <DifficultyControl
                    isLoading={isLoading}
                    text={text}
                    difficulty={difficulty}
                    onDifficultyChange={changeDifficulty}
                  />
                  <div
                    ref={equationRef}
                    data-drag-hand={dragHand}
                    className={`equation ${solved && successFeedback ? `equation-solved success-${successFeedback.kind}` : ""}`}
                    aria-label={displayExpression}
                    style={
                      {
                        "--character-count": displayExpression.length,
                        "--character-width-units": Array.from(
                          displayExpression,
                        ).reduce(
                          (width, char) =>
                            width + ("+-=".includes(char) ? 0.78 : 1),
                          0,
                        ),
                      } as CSSProperties
                    }
                  >
                    {displayExpression.split("").map((char, position) => (
                      <MatchstickChar
                        key={`${position}-${char}`}
                        char={char}
                        position={position}
                        rotatedClockwise={phonePortrait}
                        directions={stickDirections[position] ?? []}
                        solved={solved}
                        successDestination={
                          solved ? successFeedback?.destination : null
                        }
                        selected={selected}
                        hiddenSource={touchPreview?.from ?? null}
                        selectionActive={
                          pendingSource !== null || selected !== null
                        }
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
                    {solved && successFeedback?.kind === "complete" ? (
                      <SuccessConfetti />
                    ) : null}
                  </div>
                  <GameControls
                    isLoading={isLoading}
                    text={text}
                    showAnswers={showAnswers}
                    listening={listening}
                    solved={solved}
                    interactionLocked={interactionLocked}
                    onNewPuzzle={startNewPuzzle}
                    onUndo={undoPuzzle}
                    onToggleAnswers={() => {
                      clearTouchDrag();
                      cancelVoice();
                      setMessageKey((current) =>
                        current === "voiceListening" ? "selectHint" : current,
                      );
                      setShowAnswers((value) => !value);
                    }}
                    onVoiceAnswer={startVoiceAnswer}
                  />
                </div>

                {touchPreview ? (
                  <TouchMagnifier
                    surface={equationRef.current}
                    anchor={gameHeaderRef.current}
                    point={{
                      x: touchPreview.pointerX,
                      y: touchPreview.pointerY,
                    }}
                    rotatedClockwise={phonePortrait}
                    stick={{
                      x: touchPreview.x,
                      y: touchPreview.y,
                      orientation: touchPreview.orientation,
                      snapped: Boolean(touchPreview.snapped),
                      reversed:
                        Boolean(
                          stickDirections[touchPreview.from.position]?.[
                            touchPreview.from.segment
                          ],
                        ) !==
                        (phonePortrait &&
                          touchPreview.orientation === "vertical"),
                    }}
                  />
                ) : drag ? (
                  createPortal(
                    <div
                      className={`drag-ghost ${drag.orientation} ${drag.returning ? "returning" : ""} ${drag.snapped ? "snapped" : ""}`}
                      aria-hidden="true"
                      style={{
                        left: drag.x,
                        top: drag.y,
                        width: drag.helperSize,
                        height: drag.helperSize,
                      }}
                    >
                      <MatchstickArt
                        orientation={
                          drag.snapped ? drag.orientation : "horizontal"
                        }
                        reversed={
                          stickDirections[drag.from.position]?.[
                            drag.from.segment
                          ]
                        }
                      />
                    </div>,
                    document.body,
                  )
                ) : null}
              </section>
            </div>
          </section>

          {!isPhone && (
            <div className="bottom-row">
              <StatsBar text={text} stats={stats} onClearStats={clearStats} />
              <footer>
                <span>(c) Copyright Mario Studio 2026-2027</span>
                <a
                  href="https://github.com/KingMario/iMatchstick"
                  aria-label="GitHub"
                  title="GitHub"
                  target="_blank"
                  rel="noreferrer"
                >
                  <ActionIcon name="github" />
                </a>
              </footer>
            </div>
          )}
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
            isPhone={isPhone}
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
            onOpenAcademy={openAcademy}
          />
          {pwaUpdate.status === "available" &&
          !updateDismissed &&
          !settingsOpen ? (
            <aside className="update-notice" aria-label={text.updateAvailable}>
              <button type="button" onClick={openSettings}>
                {text.updateAvailable}
              </button>
              <button type="button" onClick={() => setUpdateDismissed(true)}>
                {text.updateLater}
              </button>
            </aside>
          ) : null}
        </>
      )}
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
