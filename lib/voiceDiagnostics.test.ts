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
it("retains all session metadata entries with relative times and independent snapshots", () => {
  let time = 20;
  const recorder = createVoiceDiagnostics(() => time);
  recorder.setEnabled(true);
  for (let index = 0; index < 500; index++) {
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
  assert.equal(entries.length, 500);
  assert.equal(entries[0].sequence, 1);
  assert.equal(entries[0].elapsedMs, 1);
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

it("copy snapshot includes all retained metadata and build but never extra private fields", async () => {
  const { formatVoiceDiagnostics } = await import("./voiceDiagnostics");
  const entries = Array.from({ length: 500 }, (_, index) => ({
    sequence: index + 1,
    attempt: 2,
    elapsedMs: index * 123,
    event: "result" as const,
    disposition: "ignored" as const,
    reason: "inactive" as const,
    resultCount: 2,
    finalCount: 1,
    resultIndex: 0,
    transcript: "PRIVATE",
    audio: "SECRET AUDIO",
  }));
  const output = formatVoiceDiagnostics(entries, {
    id: "20261015.03",
    sha: "abcdef0",
  });
  assert.match(output, /Build: 20261015.03 · Commit: abcdef0/);
  assert.match(output, /Events: 500/);
  assert.match(output, /#1 · attempt=2 · \+0ms/);
  assert.match(output, /#500/);
  assert.match(
    output,
    /reason=inactive · resultCount=2 · finalCount=1 · resultIndex=0/,
  );
  assert.doesNotMatch(output, /PRIVATE|SECRET|transcript/);
});
