import assert from "node:assert/strict";
import { test } from "node:test";
import { getSuccessFeedback } from "./success";

test("a single-answer puzzle completes on the first solution", () => {
  assert.deepEqual(getSuccessFeedback("7-5=3", "7-5=2", [], 1), {
    kind: "complete",
    destination: { position: 4, segment: 5 },
  });
});
test("new answers and repeated answers have distinct feedback", () => {
  assert.equal(getSuccessFeedback("9-5=6", "9-3=6", [], 2).kind, "new");
  assert.equal(
    getSuccessFeedback("9-5=6", "9-3=6", ["9-3=6"], 1).kind,
    "repeat",
  );
  assert.equal(
    getSuccessFeedback("9-5=6", "9-3=6", ["8-5=3"], 2).kind,
    "complete",
  );
});
