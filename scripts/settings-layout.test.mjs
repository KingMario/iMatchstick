import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const css = readFileSync(
  new URL("../app/globals.css", import.meta.url),
  "utf8",
);

function declarations(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]+)\\}`));
  assert.ok(match, `Missing rule: ${selector}`);
  return match[1];
}

// These are source invariants, not browser geometry checks. The bilingual
// component tests verify direct-child auto-placement; grouped-settings.spec.ts
// covers rendered alignment, text fitting and control sizes in the browser.
test("compact settings retain the shared two-column grid without a hint style", () => {
  const grid = declarations(".settings-common");
  assert.match(grid, /display:\s*grid/);
  assert.match(
    grid,
    /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
  );
  assert.match(grid, /column-gap:\s*24px/);
  assert.match(
    declarations(".settings-language-wide"),
    /grid-column:\s*1 \/ -1/,
  );
  assert.doesNotMatch(css, /settings-hand-hint/);
});

test("settings preserve label text size and existing control hit areas", () => {
  const row = declarations(".settings-row");
  const commonRow = declarations(".settings-common .settings-row");
  assert.match(row, /min-height:\s*52px/);
  assert.match(row, /display:\s*flex/);
  assert.match(commonRow, /min-width:\s*0/);
  assert.match(commonRow, /gap:\s*8px/);
  for (const selector of [
    ".settings-common .language-switch button",
    ".hand-switch span",
  ]) {
    const control = declarations(selector);
    assert.match(control, /min-width:\s*44px/);
    assert.match(control, /min-height:\s*44px/);
    assert.doesNotMatch(control, /font-size:|\b(?:zoom|scale|transform):/);
  }
  const checkbox = declarations(".settings-row input");
  assert.match(checkbox, /width:\s*24px/);
  assert.match(checkbox, /height:\s*24px/);
  assert.match(
    declarations(".settings-common .settings-row input"),
    /flex-shrink:\s*0/,
  );
  assert.doesNotMatch(
    row + commonRow,
    /font-size:|\b(?:zoom|scale|transform):/,
  );
});

test("settings keep wrapping and scrolling instead of clipping their content", () => {
  assert.match(declarations(".settings-drag-hand"), /flex-wrap:\s*wrap/);
  assert.match(declarations(".overlay-body"), /overflow-y:\s*auto/);
  for (const selector of [
    ".settings-common",
    ".settings-row",
    ".settings-common .settings-row",
    ".settings-drag-hand",
    ".hand-switch",
    ".hand-switch span",
  ]) {
    assert.doesNotMatch(
      declarations(selector),
      /overflow(?:-x|-y)?:\s*(?:hidden|clip)|text-overflow:|line-clamp:|white-space:\s*nowrap/,
    );
  }
});
