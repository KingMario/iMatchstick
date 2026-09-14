import assert from "node:assert/strict";
import { test } from "node:test";
import { buildDay, formatBuildId } from "./build-id.mjs";

test("build dates follow Beijing midnight", () => {
  assert.equal(buildDay("2026-09-14T15:59:59Z"), "2026-09-14");
  assert.equal(buildDay("2026-09-14T16:00:00Z"), "2026-09-15");
});
test("daily sequence and rerun identity are distinct", () => {
  assert.equal(formatBuildId("2026-09-14", 1), "20260914.01");
  assert.equal(formatBuildId("2026-09-14", 2), "20260914.02");
  assert.equal(formatBuildId("2026-09-14", 100), "20260914.100");
  assert.equal(formatBuildId("2026-09-14", 1, 2), "20260914.01-r2");
  assert.throws(() => formatBuildId("2026-09-14", 0));
});
