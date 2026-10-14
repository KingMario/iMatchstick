import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createVoiceSession } from "./voiceSession";
import type {
  SpeechRecognitionEventLike,
  SpeechRecognitionLike,
} from "./speech";

class Recognition implements SpeechRecognitionLike {
  static latest: Recognition;
  lang = "";
  continuous = true;
  interimResults = false;
  maxAlternatives = 0;
  onresult: SpeechRecognitionLike["onresult"] = null;
  onerror: SpeechRecognitionLike["onerror"] = null;
  onend: SpeechRecognitionLike["onend"] = null;
  onstart: SpeechRecognitionLike["onstart"] = null;
  onaudiostart: SpeechRecognitionLike["onaudiostart"] = null;
  onspeechstart: SpeechRecognitionLike["onspeechstart"] = null;
  onspeechend: SpeechRecognitionLike["onspeechend"] = null;
  onaudioend: SpeechRecognitionLike["onaudioend"] = null;
  aborts = 0;
  constructor() {
    Recognition.latest = this;
  }
  start() {
    this.onstart?.();
  }
  abort() {
    this.aborts++;
    this.onend?.();
  }
}
function result(
  parts: { values: string[]; final: boolean }[],
  resultIndex = 0,
) {
  return {
    resultIndex,
    results: parts.map(({ values, final }) =>
      Object.assign(
        values.map((transcript) => ({ transcript })),
        { isFinal: final },
      ),
    ),
  } as unknown as SpeechRecognitionEventLike;
}
function setup(Type = Recognition) {
  const transcripts: [string, boolean][] = [];
  const answers: string[][] = [];
  const finishes: string[] = [];
  const session = createVoiceSession(Type, "zh-CN", {
    transcript: (text, final) => transcripts.push([text, final]),
    answer: (values) => answers.push(values),
    finish: (reason, error) => finishes.push(`${reason}:${error ?? ""}`),
  });
  session.start();
  return {
    session,
    recognition: Recognition.latest,
    transcripts,
    answers,
    finishes,
  };
}
describe("voice attempt lifecycle", () => {
  it("enables interim captions without submitting partial answers", () => {
    const state = setup();
    assert.equal(state.recognition.interimResults, true);
    state.recognition.onresult?.(result([{ values: ["七减"], final: false }]));
    assert.deepEqual(state.transcripts, [["七减", false]]);
    assert.deepEqual(state.answers, []);
    state.session.cancel();
  });
  it("passes every final alternative and combines split final phrases", () => {
    const state = setup();
    state.recognition.onresult?.(
      result(
        [
          { values: ["7 minus"], final: true },
          { values: ["5 equals 3", "5 equals 2"], final: true },
        ],
        1,
      ),
    );
    assert.deepEqual(state.answers, [
      ["7 minus 5 equals 3", "7 minus 5 equals 2", "5 equals 3", "5 equals 2"],
    ]);
    state.session.cancel();
  });
  it("cancel detaches before synchronous abort and ignores queued old callbacks", () => {
    const state = setup();
    const lateResult = state.recognition.onresult;
    const lateEnd = state.recognition.onend;
    state.session.cancel();
    lateResult?.(result([{ values: ["7-5=2"], final: true }]));
    lateEnd?.();
    assert.deepEqual(state.answers, []);
    assert.deepEqual(state.finishes, []);
    assert.equal(state.recognition.onresult, null);
  });
  it("silent end settles once and detaches", () => {
    const state = setup();
    const end = state.recognition.onend;
    end?.();
    end?.();
    assert.deepEqual(state.finishes, ["end:"]);
    assert.equal(state.recognition.onresult, null);
  });
  for (const error of [
    "not-allowed",
    "service-not-allowed",
    "network",
    "audio-capture",
    "no-speech",
    "aborted",
  ]) {
    it(`settles ${error} even if no end event follows`, () => {
      const state = setup();
      const end = state.recognition.onend;
      state.recognition.onerror?.({ error } as Event & { error: string });
      end?.();
      assert.deepEqual(state.finishes, [`error:${error}`]);
      assert.equal(state.recognition.onresult, null);
    });
  }
  it("cleans up synchronous start failure and allows a new attempt", () => {
    class Fails extends Recognition {
      start() {
        throw new Error("busy");
      }
    }
    const failed = setup(Fails);
    assert.deepEqual(failed.finishes, ["start-error:"]);
    assert.equal(failed.recognition.onresult, null);
    const next = setup();
    next.recognition.onresult?.(result([{ values: ["7-5=2"], final: true }]));
    assert.deepEqual(next.answers, [["7-5=2"]]);
    next.session.cancel();
  });
  it("constructor failure settles without leaking", () => {
    class Fails extends Recognition {
      constructor() {
        super();
        throw new Error("disabled");
      }
    }
    assert.deepEqual(setup(Fails).finishes, ["start-error:"]);
  });
});

it("recovers after 30 seconds without browser callbacks and cancels its timer", (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const state = setup();
  context.mock.timers.tick(30000);
  assert.deepEqual(state.finishes, ["timeout:"]);
  assert.equal(state.recognition.onresult, null);
  const next = setup();
  next.session.cancel();
  context.mock.timers.tick(30000);
  assert.deepEqual(next.finishes, []);
});

it("keeps ownership after abort until asynchronous native end", (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  class Delayed extends Recognition {
    abort() {
      this.aborts++;
    }
  }
  let releases = 0;
  const phases: string[] = [];
  let submissions = 0;
  const session = createVoiceSession(Delayed, "en-US", {
    transcript() {},
    answer() {
      submissions++;
    },
    finish() {},
    released() {
      releases++;
    },
    phase(value) {
      phases.push(value);
    },
  });
  session.start();
  const recognition = Recognition.latest;
  const staleResult = recognition.onresult;
  session.cancel();
  assert.equal(session.closing, true);
  assert.equal(session.released, false);
  assert.notEqual(recognition.onend, null);
  staleResult?.(result([{ values: ["7-5=2"], final: true }]));
  assert.equal(submissions, 0);
  session.start();
  assert.equal(recognition.aborts, 1);
  context.mock.timers.tick(5000);
  assert.equal(phases.at(-1), "blocked");
  assert.equal(session.released, false);
  recognition.onend?.();
  assert.equal(session.released, true);
  assert.equal(releases, 1);
  assert.equal(recognition.onend, null);
});

it("reports silent start separately, aborts once, and still waits for release", (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  class Silent extends Recognition {
    start() {}
    abort() {
      this.aborts++;
    }
  }
  const phases: string[] = [],
    finishes: string[] = [];
  const session = createVoiceSession(Silent, "en-US", {
    transcript() {},
    answer() {},
    finish(reason) {
      finishes.push(reason);
    },
    phase(value) {
      phases.push(value);
    },
  });
  session.start();
  assert.deepEqual(phases, ["starting"]);
  context.mock.timers.tick(30000);
  assert.deepEqual(finishes, ["start-timeout"]);
  assert.equal(Recognition.latest.aborts, 1);
  context.mock.timers.tick(5000);
  assert.equal(phases.at(-1), "blocked");
  assert.equal(session.released, false);
  Recognition.latest.onend?.();
  assert.equal(session.released, true);
});

it("reports observed native stages, never claims microphone open from start alone", () => {
  const phases: string[] = [];
  const session = createVoiceSession(Recognition, "en-US", {
    transcript() {},
    answer() {},
    finish() {},
    phase(value) {
      phases.push(value);
    },
  });
  session.start();
  assert.deepEqual(phases, ["starting", "started"]);
  Recognition.latest.onaudiostart?.();
  Recognition.latest.onspeechstart?.();
  Recognition.latest.onspeechend?.();
  Recognition.latest.onaudioend?.();
  assert.deepEqual(phases, [
    "starting",
    "started",
    "audio",
    "speech",
    "speech-ended",
    "audio-ended",
  ]);
  session.cancel();
});

it("three sessions complete with asynchronous result/abort/end ordering", (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  class Delayed extends Recognition {
    abort() {
      this.aborts++;
    }
  }
  let answers = 0,
    releases = 0;
  for (let index = 0; index < 3; index++) {
    const session = createVoiceSession(Delayed, "en-US", {
      transcript() {},
      answer() {
        answers++;
        session.cancel();
      },
      finish() {},
      released() {
        releases++;
      },
    });
    session.start();
    const recognition = Recognition.latest,
      late = recognition.onresult;
    late?.(result([{ values: ["7-5=2"], final: true }]));
    late?.(result([{ values: ["7-5=2"], final: true }]));
    assert.equal(session.released, false);
    recognition.onend?.();
    assert.equal(session.released, true);
    late?.(result([{ values: ["7-5=2"], final: true }]));
  }
  assert.equal(answers, 3);
  assert.equal(releases, 3);
});

it("allows a first permission prompt to remain pending beyond eight seconds", (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  class Permission extends Recognition {
    start() {}
  }
  const phases: string[] = [],
    finishes: string[] = [];
  const session = createVoiceSession(Permission, "en-US", {
    transcript() {},
    answer() {},
    finish(reason) {
      finishes.push(reason);
    },
    phase(value) {
      phases.push(value);
    },
  });
  session.start();
  context.mock.timers.tick(15000);
  assert.deepEqual(finishes, []);
  Recognition.latest.onstart?.();
  assert.equal(phases.at(-1), "started");
  session.cancel();
});

it("accepted final result waits for natural end without reentrant abort", (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  let releases = 0;
  const session = createVoiceSession(Recognition, "en-US", {
    transcript() {},
    answer() {
      session.complete();
    },
    finish() {},
    released() {
      releases++;
    },
  });
  session.start();
  const recognition = Recognition.latest;
  recognition.onresult?.(result([{ values: ["7-5=2"], final: true }]));
  assert.equal(recognition.aborts, 0);
  assert.equal(session.closing, true);
  assert.equal(session.released, false);
  session.cancel(); // puzzle reset cannot re-enter native final-result finishing
  assert.equal(recognition.aborts, 0);
  recognition.onend?.();
  assert.equal(releases, 1);
  context.mock.timers.tick(10000);
  assert.equal(recognition.aborts, 0);
});
it("missing natural end triggers one bounded abort, never a new recognition start", (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  class NoEnd extends Recognition {
    abort() {
      this.aborts++;
    }
  }
  const phases: string[] = [];
  const session = createVoiceSession(NoEnd, "en-US", {
    transcript() {},
    answer() {
      session.complete();
    },
    finish() {},
    phase(value) {
      phases.push(value);
    },
  });
  session.start();
  const recognition = Recognition.latest;
  recognition.onresult?.(result([{ values: ["7-5=2"], final: true }]));
  context.mock.timers.tick(5000);
  assert.equal(recognition.aborts, 1);
  assert.equal(session.released, false);
  context.mock.timers.tick(5000);
  assert.equal(phases.at(-1), "blocked");
  session.start();
  session.cancel();
  assert.equal(recognition.aborts, 1);
  recognition.onend?.();
  assert.equal(session.released, true);
});
