import assert from "node:assert/strict";
import { it } from "node:test";
import { pauseApplause } from "./audio";
it("stops prior applause before recognition without calling play/load", () => {
  const calls: string[] = [];
  const audio = {
    paused: false,
    currentTime: 10,
    pause() {
      calls.push("pause");
    },
  };
  pauseApplause(audio as unknown as HTMLAudioElement);
  assert.deepEqual(calls, ["pause"]);
  assert.equal(audio.currentTime, 0);
  pauseApplause(null);
});

it("does not touch the iOS media session when applause is already paused", () => {
  const audio = {
    paused: true,
    get currentTime() {
      throw new Error("unexpected media read");
    },
    set currentTime(_value: number) {
      throw new Error("unexpected media write");
    },
    pause() {
      throw new Error("unexpected media pause");
    },
  };
  pauseApplause(audio as unknown as HTMLAudioElement);
});
