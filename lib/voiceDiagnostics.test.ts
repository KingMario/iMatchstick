import assert from "node:assert/strict";
import { it } from "node:test";
import {
  createVoiceDiagnostics,
  type VoiceTraceInput,
} from "./voiceDiagnostics";
it("diagnostics are off by default and turning off clears all entries", () => {
  const recorder = createVoiceDiagnostics(() => 0);
  recorder.record(1, { event: "start", disposition: "received" });
  assert.deepEqual(recorder.snapshot(), []);
  recorder.setEnabled(true);
  recorder.record(1, { event: "start", disposition: "received" });
  assert.equal(recorder.snapshot().length, 1);
  recorder.setEnabled(false);
  recorder.record(2, { event: "end", disposition: "received" });
  assert.deepEqual(recorder.snapshot(), []);
});
it("retains only 120 metadata entries with relative times and independent snapshots", () => {
  let time = 20;
  const recorder = createVoiceDiagnostics(() => time);
  recorder.setEnabled(true);
  for (let index = 0; index < 130; index++) {
    time += 1;
    recorder.record(2, {
      event: "result",
      disposition: "received",
      resultCount: 1,
      finalCount: 0,
      resultIndex: 0,
    });
  }
  const entries = recorder.snapshot();
  assert.equal(entries.length, 120);
  assert.equal(entries[0].sequence, 11);
  assert.equal(entries[0].elapsedMs, 11);
  entries[0].attempt = 99;
  assert.equal(recorder.snapshot()[0].attempt, 2);
  recorder.clear();
  assert.deepEqual(recorder.snapshot(), []);
});
it("never retains transcript, recording, arbitrary strings or unknown events", () => {
  const recorder = createVoiceDiagnostics(() => 0);
  recorder.setEnabled(true);
  recorder.record(1, {
    event: "result",
    disposition: "received",
    transcript: "PRIVATE PHRASE",
    audio: "RECORDING",
    error: "PRIVATE ERROR",
    reason: "PRIVATE REASON",
    resultCount: Infinity,
  } as unknown as unknown as VoiceTraceInput);
  recorder.record(1, {
    event: "PRIVATE EVENT",
    disposition: "received",
  } as unknown as VoiceTraceInput);
  const json = JSON.stringify(recorder.snapshot());
  assert.equal(json.includes("PRIVATE"), false);
  assert.equal(json.includes("RECORDING"), false);
  assert.equal(json.includes("transcript"), false);
  assert.equal(recorder.snapshot()[0].error, "other");
  assert.equal(recorder.snapshot().length, 1);
});
