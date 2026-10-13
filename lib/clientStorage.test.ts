import assert from "node:assert/strict";
import { test } from "node:test";
import { readJson, writeJson } from "./clientStorage";
test("browserless storage reads and writes are safe", () => {
  assert.deepEqual(readJson("x", { language: "zh" }), { language: "zh" });
  assert.doesNotThrow(() => writeJson("x", {}));
});
test("corrupted legacy settings and denied writes cannot break onboarding", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  let raw = "null";
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: () => raw,
        setItem: () => {
          throw Error("denied");
        },
      },
    },
  });
  try {
    const fallback = { language: "zh", timerEnabled: false, solved: 0 };
    for (const corrupt of ["null", "[]", "true", "42", "invalid"]) {
      raw = corrupt;
      assert.deepEqual(readJson("x", fallback), fallback);
    }
    raw = '{"language":"en","timerEnabled":"yes","solved":-2}';
    assert.deepEqual(readJson("x", fallback), { ...fallback, language: "en" });
    assert.doesNotThrow(() => writeJson("x", fallback));
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else Reflect.deleteProperty(globalThis, "window");
  }
});
