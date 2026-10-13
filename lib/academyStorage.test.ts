import assert from "node:assert/strict";
import { test } from "node:test";
import {
  academyStorageKey,
  emptyAcademyProgress,
  loadAcademy,
  parseAcademyProgress,
  saveAcademy,
} from "./academyStorage";
function memory(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}
test("new visit gets welcome; previous visitor and dismissal do not", () => {
  assert.equal(loadAcademy(memory(), []).showWelcome, true);
  for (const key of ["imatchstick-pwa-settings", "imatchstick-pwa-stats"]) {
    assert.equal(
      loadAcademy(memory({ [key]: "corrupt" }), []).showWelcome,
      false,
    );
  }
  assert.equal(
    loadAcademy(
      memory({
        [academyStorageKey]: JSON.stringify({
          ...emptyAcademyProgress(),
          welcomed: true,
        }),
      }),
      [],
    ).showWelcome,
    false,
  );
});
test("schema migration deduplicates valid progress and isolates unknown versions", () => {
  assert.deepEqual(
    parseAcademyProgress(
      '{"version":0,"completed":["a","a","bad",2],"welcomed":true}',
      ["a"],
    ),
    { version: 1, welcomed: true, completedLessonIds: ["a"] },
  );
  assert.deepEqual(
    parseAcademyProgress(
      '{"version":7,"completedLessonIds":["a"],"welcomed":true}',
      ["a"],
    ),
    { version: 1, welcomed: true, completedLessonIds: [] },
  );
  for (const raw of [
    "no",
    "null",
    "[]",
    "42",
    '{"version":1,"completedLessonIds":null}',
  ])
    assert.deepEqual(parseAcademyProgress(raw, ["a"]), emptyAcademyProgress());
});
test("denied storage and missing browser cannot block session", () => {
  const denied = {
    getItem: () => {
      throw Error("denied");
    },
    setItem: () => {
      throw Error("denied");
    },
  };
  assert.equal(loadAcademy(denied, []).showWelcome, true);
  assert.equal(loadAcademy(null, []).showWelcome, true);
  assert.doesNotThrow(() => saveAcademy(denied, emptyAcademyProgress()));
  assert.doesNotThrow(() => saveAcademy(null, emptyAcademyProgress()));
});
test("saving academy does not touch original settings or competitive statistics", () => {
  const store = memory({
    "imatchstick-pwa-settings": "settings",
    "imatchstick-pwa-stats": "stats",
  });
  saveAcademy(store, { version: 1, welcomed: true, completedLessonIds: ["a"] });
  assert.equal(store.values.get("imatchstick-pwa-settings"), "settings");
  assert.equal(store.values.get("imatchstick-pwa-stats"), "stats");
  assert.deepEqual(loadAcademy(store, ["a"]).progress.completedLessonIds, [
    "a",
  ]);
});
