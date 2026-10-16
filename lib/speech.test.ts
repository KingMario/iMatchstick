import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatSpeechCaption, parseSpokenExpression } from "./speech";
import { createPuzzleFromExpression, isAnswer } from "./matchstick";

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

describe("strict English speech grammar", () => {
  for (const [speech, equation] of [
    ["six minus one equals five", "6-1=5"],
    ["Seventy-nine minus thirty is equal to forty-nine.", "79-30=49"],
    [
      "one hundred and twenty-three subtract 45 equal to seventy eight",
      "123-45=78",
    ],
    ["7 add nine equal sixteen", "7+9=16"],
    ["twenty 3 + seven = thirty", "23+7=30"],
    ["6−1=5", "6-1=5"],
    ["７＋９＝１６", "7+9=16"],
    ["one hundred minus 1 equals ninety-nine!", "100-1=99"],
    ["zero plus zero is zero", "0+0=0"],
    ["07 plus 1 equals 8", "07+1=8"],
    [
      "nine hundred ninety-nine minus ninety-nine equals nine hundred",
      "999-99=900",
    ],
  ]) {
    it(`parses ${speech}`, () => {
      assert.equal(parseSpokenExpression([speech], "en"), equation);
    });
  }
  for (const speech of [
    "seven bananas minus five equals two",
    "seven minus five equals not two",
    "seven minus five equals two maybe",
    "one two plus three equals six",
    "twenty ten minus five equals twenty-five",
    "one hundred hundred minus one equals nine",
    "hundred minus one equals ninety-nine",
    "one hundred and minus one equals ninety-nine",
    "seven times five equals thirty-five",
    "seven divided by one equals seven",
    "7.5 minus 5 equals 2.5",
    "7.5-5=2.5",
    "7/1 minus 5 equals 2",
    "7,5-5=70",
    "seven minus five equals two or three",
    "seven minus five equals two; alert(1)",
    "seven plus negative five equals two",
    "seven plus five is not equal to twelve",
    "seven plus five equals twelve equals twelve",
    "9007199254740993 minus 1 equals 9007199254740992",
  ]) {
    it(`rejects ${speech}`, () => {
      assert.equal(parseSpokenExpression([speech], "en"), null);
    });
  }
});

describe("natural English operator and equality variants", () => {
  for (const equality of [
    "is",
    "gets",
    "equals",
    "equal",
    "equal to",
    "is equal to",
    "makes",
    "gives",
    "=",
  ]) {
    for (const addition of ["plus", "add", "and", "+"]) {
      it(`supports ${addition} / ${equality}`, () => {
        assert.equal(
          parseSpokenExpression(
            [`six ${addition} one ${equality} seven`],
            "en",
          ),
          "6+1=7",
        );
      });
    }
  }
  for (const [speech, expected] of [
    ["six take away one gets five", "6-1=5"],
    ["six subtract one is five", "6-1=5"],
    ["six less one makes five", "6-1=5"],
    ["six decreased by one makes five", "6-1=5"],
    ["six reduced by one equals five", "6-1=5"],
    ["six increased by one equals seven", "6+1=7"],
    ["one more than six equals seven", "6+1=7"],
    ["take away one from six equals five", "6-1=5"],
    ["subtract one from six equals five", "6-1=5"],
    ["take one away from six equals five", "6-1=5"],
    ["one subtracted from six equals five", "6-1=5"],
    ["one taken away from six equals five", "6-1=5"],
    ["one less than six gives five", "6-1=5"],
    ["add one to six equals seven", "6+1=7"],
    ["one added to six equals seven", "6+1=7"],
    ["add six and one equals seven", "6+1=7"],
    [
      "add one and one hundred and two equals one hundred and three",
      "1+102=103",
    ],
    ["one hundred and two and three is one hundred and five", "102+3=105"],
    ["one hundred and two plus three is one hundred and five", "102+3=105"],
    [
      "subtract twenty-one from one hundred and two equals eighty-one",
      "102-21=81",
    ],
  ]) {
    it(speech, () =>
      assert.equal(parseSpokenExpression([speech], "en"), expected),
    );
  }
  for (const speech of [
    "one and two and three equals six",
    "subtract six and one equals five",
    "six from one equals five",
    "add six to one and two equals nine",
    "six take one equals five",
    "six fewer than one equals five",
    "one hundred and two equals one hundred two",
  ]) {
    it(`rejects ambiguous/incomplete ${speech}`, () =>
      assert.equal(parseSpokenExpression([speech], "en"), null));
  }
});

describe("parsed speech uses the existing puzzle answer validator", () => {
  for (const [puzzleText, speech, accepted] of [
    ["7-5=3", "seven minus five is equal to two", true],
    ["7-5=3", "subtract five from seven gets two", true],
    ["7-5=3", "seven minus five equals three", false],
    ["7-5=3", "six minus one equals five", false],
    ["7-5=3", "seven bananas minus five equals two", false],
    ["23+7=39", "twenty-three and seven gives thirty", true],
  ] as const) {
    it(speech, () => {
      const puzzle = createPuzzleFromExpression(puzzleText);
      assert.ok(puzzle);
      const expression = parseSpokenExpression([speech], "en");
      assert.equal(
        expression !== null && isAnswer(expression, puzzle.answers),
        accepted,
      );
    });
  }
});

describe("mixed Chinese speech normalization", () => {
  for (const [speech, expected] of [
    ["7-四=3", "7-4=3"],
    ["7-四 equals 3", "7-4=3"],
    ["七 减 四 等 于 三", "7-4=3"],
    ["7 加 上 两 等 于 九", "7+2=9"],
    ["7-4 is 3", "7-4=3"],
    ["七－４＝三", "7-4=3"],
    ["7减去四等于3", "7-4=3"],
    ["七減去4等於三。", "7-4=3"],
    ["两加上3等于五", "2+3=5"],
    ["兩+三=5", "2+3=5"],
    ["十六-9=七", "16-9=7"],
    ["7十9减三十=四9", "79-30=49"],
    ["1百二十三-四5=七十八", "123-45=78"],
    ["一百零二减2=100", "102-2=100"],
    ["1百23-23=一百", "123-23=100"],
    ["零7+一=08", "07+1=08"],
    ["0七+1=零八", "07+1=08"],
    ["7 − 四 = 3！", "7-4=3"],
  ]) {
    it(`normalizes ${speech}`, () =>
      assert.equal(parseSpokenExpression([speech], "zh"), expected));
  }
  for (const speech of [
    "7.5-四=3",
    "7,5-四=3",
    "七。五-四=3",
    "7-四=不是3",
    "7-四=3或4",
    "7-四=3abc",
    "7-四==3",
    "7--四=3",
    "7乘四=28",
    "7/1-四=3",
    "零十+一=一",
    "一百百+一=一",
    "一百二+一=一",
    "一百十+一=一",
    "二十十+一=一",
    "十零+一=一",
    "一百零零二+一=一",
    "一百零二十+一=一",
    "9007199254740993+零=1",
    "7-四=3;alert(1)",
  ]) {
    it(`rejects malformed ${speech}`, () =>
      assert.equal(parseSpokenExpression([speech], "zh"), null));
  }
  it("keeps checking alternate transcripts", () => {
    assert.equal(parseSpokenExpression(["不是答案", "7-四=3"], "zh"), "7-4=3");
  });
  for (const [speech, accepted] of [
    ["7-四=3", true],
    ["七减去4等于三", true],
    ["7-五=2", false],
    ["七减四等于二", false],
    ["零七减四等于三", false],
  ] as const) {
    it(`judges ${speech} using legal one-match puzzle answers`, () => {
      const puzzle = createPuzzleFromExpression("1+4=3");
      assert.ok(puzzle);
      const expression = parseSpokenExpression([speech], "zh");
      assert.equal(
        expression !== null && isAnswer(expression, puzzle.answers),
        accepted,
      );
    });
  }
});

describe("speech caption presentation", () => {
  for (const [raw, expected] of [
    ["7减四等于3", "7减四=3"],
    ["七減四等於三", "七減四=三"],
    ["7减四等于", "7减四="],
    ["7减", "7减"],
    ["等", "等"],
    ["7-四=3", "7-四=3"],
    ["", ""],
    ["six equals five", "six equals five"],
  ]) {
    it(`formats complete or interim caption ${raw}`, () =>
      assert.equal(formatSpeechCaption(raw), expected));
  }
});
