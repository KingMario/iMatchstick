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
  aborts = 0;
  constructor() {
    Recognition.latest = this;
  }
  start() {}
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
