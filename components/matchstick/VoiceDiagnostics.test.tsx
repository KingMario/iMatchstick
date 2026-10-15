import assert from "node:assert/strict";
import { it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { VoiceDiagnostics } from "./VoiceDiagnostics";
for (const language of ["zh", "en"] as const) {
  it(`diagnostic disclosure is collapsed, labeled, and off by default (${language})`, () => {
    const html = renderToStaticMarkup(
      <VoiceDiagnostics
        language={language}
        enabled={false}
        entries={[]}
        onEnabledChange={() => {}}
        onClear={() => {}}
      />,
    );
    assert.match(html, /<details class="settings-panel voice-diagnostics">/);
    assert.match(html, /<label><input type="checkbox"\/>/);
    assert.doesNotMatch(html, /checked=|<ol|<details[^>]+open/);
    assert.match(
      html,
      language === "zh" ? /不保存语句或音频/ : /No speech text or audio/,
    );
  });
  it(`enabled timeline labels attempts, elapsed time and ignored callbacks (${language})`, () => {
    const html = renderToStaticMarkup(
      <VoiceDiagnostics
        language={language}
        enabled={true}
        entries={[
          {
            sequence: 1,
            attempt: 2,
            elapsedMs: 1234,
            event: "result",
            disposition: "ignored",
            resultCount: 1,
            finalCount: 1,
          },
        ]}
        onEnabledChange={() => {}}
        onClear={() => {}}
      />,
    );
    assert.match(html, /<ol aria-label=/);
    assert.match(html, /\+1\.2s/);
    assert.match(html, language === "zh" ? /忽略/ : /Ignored/);
    assert.match(html, language === "zh" ? /最终结果数 1/ : /Finals 1/);
  });
}
