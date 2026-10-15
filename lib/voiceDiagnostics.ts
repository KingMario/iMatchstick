export type VoiceTraceEvent =
  | "start-call"
  | "abort-call"
  | "startup-throw"
  | "abort-throw"
  | "request-start"
  | "request-cancel"
  | "answer-complete"
  | "dispose"
  | "start"
  | "audiostart"
  | "audioend"
  | "soundstart"
  | "soundend"
  | "speechstart"
  | "speechend"
  | "result"
  | "nomatch"
  | "error"
  | "end"
  | "timeout"
  | "app-caption"
  | "app-answer"
  | "app-release";
export type VoiceTraceInput = {
  event: VoiceTraceEvent;
  disposition: "received" | "ignored" | "accepted" | "unmatched";
  reason?:
    "loading" | "replaced" | "inactive" | "starting" | "listening" | "release";
  resultCount?: number;
  finalCount?: number;
  resultIndex?: number;
  error?: string;
};
export type VoiceTraceEntry = VoiceTraceInput & {
  attempt: number;
  elapsedMs: number;
  sequence: number;
};
const events = new Set<VoiceTraceEvent>([
  "start-call",
  "abort-call",
  "startup-throw",
  "abort-throw",
  "request-start",
  "request-cancel",
  "answer-complete",
  "dispose",
  "start",
  "audiostart",
  "audioend",
  "soundstart",
  "soundend",
  "speechstart",
  "speechend",
  "result",
  "nomatch",
  "error",
  "end",
  "timeout",
  "app-caption",
  "app-answer",
  "app-release",
]);
const errors = new Set([
  "no-speech",
  "aborted",
  "audio-capture",
  "network",
  "not-allowed",
  "service-not-allowed",
  "bad-grammar",
  "language-not-supported",
]);
const reasons = new Set([
  "loading",
  "replaced",
  "inactive",
  "starting",
  "listening",
  "release",
]);
const dispositions = new Set(["received", "ignored", "accepted", "unmatched"]);
const count = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.min(10000, Math.max(0, Math.floor(value)))
    : undefined;

// Opt-in, page-memory-only metadata for the complete diagnostic session. Never spread caller input: even
// accidental transcript/audio/custom fields cannot enter the retained record.
export function createVoiceDiagnostics(now = () => performance.now()) {
  let enabled = false;
  let origin = 0;
  let sequence = 0;
  let entries: VoiceTraceEntry[] = [];
  return {
    setEnabled(value: boolean) {
      enabled = value;
      entries = [];
      sequence = 0;
      origin = now();
    },
    clear() {
      entries = [];
      sequence = 0;
      origin = now();
    },
    get enabled() {
      return enabled;
    },
    snapshot() {
      return entries.map((entry) => ({ ...entry }));
    },
    record(attempt: number, input: VoiceTraceInput) {
      if (
        !enabled ||
        !events.has(input.event) ||
        !dispositions.has(input.disposition)
      )
        return false;
      const entry: VoiceTraceEntry = {
        sequence: ++sequence,
        attempt: count(attempt) ?? 0,
        elapsedMs: Math.max(0, Math.round(now() - origin)),
        event: input.event,
        disposition: input.disposition,
      };
      if (input.reason && reasons.has(input.reason))
        entry.reason = input.reason;
      if (input.error)
        entry.error = errors.has(input.error) ? input.error : "other";
      for (const key of ["resultCount", "finalCount", "resultIndex"] as const) {
        const value = count(input[key]);
        if (value !== undefined) entry[key] = value;
      }
      entries.push(entry);
      return true;
    },
  };
}

/** Complete metadata-only snapshot; never serialize arbitrary entry fields. */
export function formatVoiceDiagnostics(
  entries: readonly VoiceTraceEntry[],
  build: { id: string; sha: string },
) {
  const lines = entries.map((entry) => {
    const fields = [
      `#${entry.sequence}`,
      `attempt=${entry.attempt}`,
      `+${entry.elapsedMs}ms`,
      `event=${entry.event}`,
      `disposition=${entry.disposition}`,
    ];
    if (entry.reason) fields.push(`reason=${entry.reason}`);
    if (entry.error) fields.push(`error=${entry.error}`);
    for (const key of ["resultCount", "finalCount", "resultIndex"] as const) {
      if (entry[key] !== undefined) fields.push(`${key}=${entry[key]}`);
    }
    return fields.join(" · ");
  });
  return [
    "iMatchstick voice event diagnostics",
    `Build: ${build.id} · Commit: ${build.sha || "unknown"}`,
    `Events: ${lines.length}; times since enable/clear`,
    "Metadata only. No speech text or audio.",
    ...lines,
  ].join("\n");
}
