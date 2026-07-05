import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseSpokenExpression } from "./speech";

describe("speech expression parsing", () => {
  it("parses symbolic expressions in both languages", () => {
    assert.equal(parseSpokenExpression(["7 + 9 = 16"], "en"), "7+9=16");
    assert.equal(parseSpokenExpression(["７＋９＝１６"], "zh"), "7+9=16");
    assert.equal(parseSpokenExpression(["7 加 9 等于 16"], "zh"), "7+9=16");
  });

  it("parses Chinese spoken arithmetic", () => {
    assert.equal(parseSpokenExpression(["七加九等于十六"], "zh"), "7+9=16");
    assert.equal(
      parseSpokenExpression(["七十九减三十等于四十九"], "zh"),
      "79-30=49",
    );
    assert.equal(
      parseSpokenExpression(["一百二十三减四十五等于七十八"], "zh"),
      "123-45=78",
    );
  });

  it("parses English spoken arithmetic", () => {
    assert.equal(
      parseSpokenExpression(["seven plus nine equals sixteen"], "en"),
      "7+9=16",
    );
    assert.equal(
      parseSpokenExpression(
        ["seventy nine minus thirty equals forty nine"],
        "en",
      ),
      "79-30=49",
    );
    assert.equal(
      parseSpokenExpression(
        ["one hundred twenty three minus forty five is seventy eight"],
        "en",
      ),
      "123-45=78",
    );
  });

  it("checks alternate transcripts until one parses", () => {
    assert.equal(
      parseSpokenExpression(["noise", "9 minus 3 equals 6"], "en"),
      "9-3=6",
    );
  });

  it("returns null when no transcript contains a valid expression", () => {
    assert.equal(parseSpokenExpression(["start a new puzzle"], "en"), null);
    assert.equal(parseSpokenExpression(["换一道题"], "zh"), null);
  });
});
