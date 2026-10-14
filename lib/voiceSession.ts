import type {
  SpeechRecognitionConstructor,
  SpeechRecognitionLike,
} from "./speech";

export type VoiceFinish = "end" | "error" | "start-error" | "timeout";

// Each attempt owns its callbacks. Detach BEFORE abort: some engines deliver
// error/end synchronously, others deliver them after a new attempt has begun.
export function createVoiceSession(
  Recognition: SpeechRecognitionConstructor,
  language: string,
  callbacks: {
    transcript: (text: string, final: boolean) => void;
    answer: (transcripts: string[]) => void;
    finish: (reason: VoiceFinish, error?: string) => void;
  },
) {
  let recognition: SpeechRecognitionLike | null = null;
  let active = true;
  let watchdog: ReturnType<typeof setTimeout> | null = null;
  const detach = () => {
    active = false;
    if (watchdog !== null) clearTimeout(watchdog);
    watchdog = null;
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
    }
  };
  const cancel = () => {
    detach();
    try {
      recognition?.abort();
    } catch {
      /* Already stopped by the browser. */
    }
  };
  return {
    cancel,
    start() {
      try {
        recognition = new Recognition();
        recognition.lang = language;
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.maxAlternatives = 5;
        recognition.onresult = (event) => {
          if (!active) return;
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
          if (candidates.length && active) callbacks.answer(candidates);
        };
        recognition.onerror = (event) => {
          if (!active) return;
          cancel();
          callbacks.finish("error", event.error);
        };
        recognition.onend = () => {
          if (!active) return;
          detach();
          callbacks.finish("end");
        };
        // Do not auto-restart the microphone. Recover even if a browser never
        // delivers end/error, and let the next explicit tap create a new attempt.
        watchdog = setTimeout(() => {
          if (!active) return;
          cancel();
          callbacks.finish("timeout");
        }, 30000);
        recognition.start();
      } catch {
        cancel();
        callbacks.finish("start-error");
      }
    },
  };
}
export type VoiceSession = ReturnType<typeof createVoiceSession>;
