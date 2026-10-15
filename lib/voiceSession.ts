import type { VoiceTraceInput } from "./voiceDiagnostics";
import type {
  SpeechRecognitionConstructor,
  SpeechRecognitionLike,
} from "./speech";

export type VoiceFinish =
  "end" | "error" | "start-error" | "start-timeout" | "timeout";
export type VoicePhase =
  | "starting"
  | "started"
  | "audio"
  | "speech"
  | "speech-ended"
  | "audio-ended"
  | "result"
  | "stopping"
  | "blocked";

// Answer eligibility and native service ownership are deliberately separate.
// abort() requests shutdown; only end confirms that the service disconnected.
export function createVoiceSession(
  Recognition: SpeechRecognitionConstructor,
  language: string,
  callbacks: {
    transcript: (text: string, final: boolean) => void;
    answer: (transcripts: string[]) => void;
    finish: (reason: VoiceFinish, error?: string) => void;
    phase?: (phase: VoicePhase) => void;
    released?: () => void;
    trace?: (event: VoiceTraceInput) => void;
  },
) {
  let recognition: SpeechRecognitionLike | null = null;
  let eligible = true;
  let closing = false;
  let released = false;
  let requested = false;
  let started = false;
  let terminal = false;
  let disposed = false;
  let watchdog: ReturnType<typeof setTimeout> | null = null;
  let shutdownWatchdog: ReturnType<typeof setTimeout> | null = null;
  const trace = (event: VoiceTraceInput | (() => VoiceTraceInput)) => {
    if (disposed || !callbacks.trace) return;
    try {
      callbacks.trace(typeof event === "function" ? event() : event);
    } catch {
      /* Diagnostics cannot affect recognition. */
    }
  };
  const nativeEvent = (
    event: VoiceTraceInput["event"],
    inactive = !eligible || released,
  ) =>
    trace({
      event,
      disposition: inactive ? "ignored" : "received",
      ...(inactive ? { reason: "inactive" as const } : {}),
    });
  const clearWatchdog = () => {
    if (watchdog !== null) clearTimeout(watchdog);
    watchdog = null;
  };
  const finish = (reason: VoiceFinish, error?: string) => {
    if (terminal) return;
    terminal = true;
    callbacks.finish(reason, error);
  };
  const detach = () => {
    clearWatchdog();
    if (shutdownWatchdog !== null) clearTimeout(shutdownWatchdog);
    shutdownWatchdog = null;
    if (recognition) {
      recognition.onresult = recognition.onerror = recognition.onend = null;
      recognition.onstart =
        recognition.onaudiostart =
        recognition.onaudioend =
          null;
      recognition.onspeechstart = recognition.onspeechend = null;
      recognition.onsoundstart =
        recognition.onsoundend =
        recognition.onnomatch =
          null;
    }
  };
  const release = () => {
    if (released) return;
    released = true;
    eligible = false;
    detach();
    callbacks.released?.();
  };
  const cancel = () => {
    nativeEvent("request-cancel", released || closing);
    if (released || closing) return;
    eligible = false;
    closing = true;
    clearWatchdog();
    if (recognition) recognition.onresult = null;
    callbacks.phase?.("stopping");
    shutdownWatchdog = setTimeout(() => {
      if (!released) {
        trace({ event: "timeout", disposition: "received", reason: "release" });
        callbacks.phase?.("blocked");
      }
      // Keep end attached. A timeout is NOT evidence that native audio released.
    }, 5000);
    try {
      trace({ event: "abort-call", disposition: "received" });
      recognition?.abort();
    } catch {
      trace({ event: "abort-throw", disposition: "received" });
      /* Wait for end or show recovery. */
    }
  };
  const complete = () => {
    nativeEvent("answer-complete", released || closing);
    if (released || closing) return;
    eligible = false;
    closing = true;
    clearWatchdog();
    if (recognition) recognition.onresult = null;
    callbacks.phase?.("stopping");
    // A non-continuous final result already asks WebKit to stop. Do not abort
    // reentrantly inside that result dispatch; observe its natural end first.
    shutdownWatchdog = setTimeout(() => {
      if (released) return;
      shutdownWatchdog = setTimeout(() => {
        if (!released) {
          trace({
            event: "timeout",
            disposition: "received",
            reason: "release",
          });
          callbacks.phase?.("blocked");
        }
      }, 5000);
      try {
        trace({ event: "abort-call", disposition: "received" });
        recognition?.abort();
      } catch {
        trace({ event: "abort-throw", disposition: "received" });
        /* End still owns release. */
      }
    }, 5000);
  };
  const phase = (value: VoicePhase) => {
    if (!eligible || released) return;
    callbacks.phase?.(value);
  };
  return {
    cancel,
    complete,
    get closing() {
      return closing;
    },
    get released() {
      return released;
    },
    // Unmount cannot await end; discard UI callbacks and request native shutdown.
    dispose() {
      nativeEvent("dispose", released);
      eligible = false;
      released = true;
      detach();
      try {
        trace({ event: "abort-call", disposition: "received" });
        recognition?.abort();
      } catch {}
      disposed = true;
    },
    start() {
      nativeEvent("request-start", requested || released || closing);
      if (requested || released || closing) return;
      requested = true;
      try {
        recognition = new Recognition();
        recognition.lang = language;
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.maxAlternatives = 5;
        recognition.onstart = () => {
          nativeEvent("start", !eligible || released || started);
          if (!eligible || released || started) return;
          started = true;
          phase("started");
          clearWatchdog();
          watchdog = setTimeout(() => {
            if (!eligible) return;
            trace({
              event: "timeout",
              disposition: "received",
              reason: "listening",
            });
            finish("timeout");
            cancel();
          }, 30000);
        };
        recognition.onaudiostart = () => {
          nativeEvent("audiostart");
          phase("audio");
        };
        recognition.onspeechstart = () => {
          nativeEvent("speechstart");
          phase("speech");
        };
        recognition.onspeechend = () => {
          nativeEvent("speechend");
          phase("speech-ended");
        };
        recognition.onaudioend = () => {
          nativeEvent("audioend");
          phase("audio-ended");
        };
        recognition.onsoundstart = () => nativeEvent("soundstart");
        recognition.onsoundend = () => nativeEvent("soundend");
        recognition.onnomatch = () => nativeEvent("nomatch");
        recognition.onresult = (event) => {
          trace(() => ({
            event: "result",
            disposition: !eligible || released ? "ignored" : "received",
            resultCount: event.results.length,
            resultIndex: event.resultIndex,
            finalCount: Array.from(
              { length: event.results.length },
              (_, index) => event.results[index].isFinal !== false,
            ).filter(Boolean).length,
          }));
          if (!eligible || released) return;
          phase("result");
          const captions: string[] = [];
          const candidates: string[] = [];
          let combined = [""];
          let finalCount = 0;
          let allFinal = true;
          for (let index = 0; index < event.results.length; index++) {
            const result = event.results[index];
            if (result.length) captions.push(result[0].transcript);
            // Older implementations omit isFinal when interimResults is ignored.
            const final = result.isFinal !== false;
            allFinal &&= final;
            if (!final) continue;
            if (result.length) {
              finalCount++;
              const alternatives = Array.from(
                { length: Math.min(result.length, 5) },
                (_, alternative) => result[alternative].transcript,
              );
              combined = combined
                .flatMap((prefix) =>
                  alternatives.map((value) => `${prefix} ${value}`.trim()),
                )
                .slice(0, 125);
            }
            if (index < (event.resultIndex ?? 0)) continue;
            for (
              let alternative = 0;
              alternative < result.length;
              alternative++
            ) {
              candidates.push(result[alternative].transcript);
            }
          }
          callbacks.transcript(captions.join(" ").trim(), allFinal);
          if (allFinal && finalCount > 1) candidates.unshift(...combined);
          if (candidates.length && eligible) callbacks.answer(candidates);
        };
        recognition.onerror = (event) => {
          trace({
            event: "error",
            disposition: !eligible || released ? "ignored" : "received",
            error: event.error,
          });
          if (!eligible || released) return;
          finish("error", event.error);
          cancel();
        };
        recognition.onend = () => {
          nativeEvent("end", released);
          if (released) return;
          if (eligible) finish("end");
          release();
        };
        callbacks.phase?.("starting");
        watchdog = setTimeout(() => {
          if (!eligible) return;
          trace({
            event: "timeout",
            disposition: "received",
            reason: "starting",
          });
          finish("start-timeout");
          cancel();
        }, 30000);
        trace({ event: "start-call", disposition: "received" });
        recognition.start();
      } catch {
        trace({ event: "startup-throw", disposition: "received" });
        eligible = false;
        finish("start-error");
        release();
      }
    },
  };
}
export type VoiceSession = ReturnType<typeof createVoiceSession>;
