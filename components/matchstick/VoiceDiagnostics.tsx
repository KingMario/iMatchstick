import { useEffect, useRef, useState } from "react";
import {
  formatVoiceDiagnostics,
  type VoiceTraceEntry,
} from "../../lib/voiceDiagnostics";
import { buildId, buildSha } from "./usePwaUpdate";
import type { Language } from "./copy";
export type VoiceDiagnosticsProps = {
  enabled: boolean;
  entries: VoiceTraceEntry[];
  onEnabledChange: (enabled: boolean) => void;
  onClear: () => void;
};
const labels = {
  zh: {
    title: "语音事件诊断",
    enable: "开启本页诊断",
    privacy:
      "保留开启诊断后本页的全部事件和结果数量；不保存语句或音频，不上传。点击拷贝可导出这些事件。关闭或刷新即清空本页记录；剪贴板中的副本不会自动清除。",
    steps:
      "开启后关闭设置，连续尝试两题，再回到这里查看。事件表示浏览器通知，不证明收到了有效声音。",
    clear: "清空事件",
    copy: "拷贝全部语音事件",
    copying: "正在拷贝…",
    copied: "已拷贝语音事件",
    fallback: "无法自动拷贝。请长按下方文本，全选后拷贝。",
    snapshot: "可拷贝的语音事件快照",
    empty: "暂无事件",
    attempt: "尝试",
    received: "收到",
    ignored: "忽略",
    accepted: "已接受",
    unmatched: "未匹配",
    resultCount: "结果数",
    finalCount: "最终结果数",
    resultIndex: "索引",
  },
  en: {
    title: "Voice event diagnostics",
    enable: "Enable for this page",
    privacy:
      "Keeps all events and result counts since enabling diagnostics in page memory. No speech text or audio is saved or copied. Nothing is uploaded. Copy exports these events. Turning off or reloading clears page records, but does not clear your clipboard.",
    steps:
      "Enable, close Settings, try two questions, then return here. Events are browser notifications, not proof that usable audio arrived.",
    clear: "Clear events",
    copy: "Copy all voice events",
    copying: "Copying…",
    copied: "Voice events copied",
    fallback:
      "Automatic copy was unavailable. Select all the text below and copy it manually.",
    snapshot: "Voice event snapshot to copy",
    empty: "No events yet",
    attempt: "Attempt",
    received: "Received",
    ignored: "Ignored",
    accepted: "Accepted",
    unmatched: "Unmatched",
    resultCount: "Results",
    finalCount: "Finals",
    resultIndex: "Index",
  },
};
export function VoiceDiagnostics({
  language,
  enabled,
  entries,
  onEnabledChange,
  onClear,
}: VoiceDiagnosticsProps & { language: Language }) {
  const text = labels[language];
  const [copyState, setCopyState] = useState<
    "idle" | "copying" | "copied" | "fallback"
  >("idle");
  const [snapshot, setSnapshot] = useState("");
  const generation = useRef(0);
  const copying = useRef(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearCopyTimer = () => {
    if (copyTimer.current !== null) clearTimeout(copyTimer.current);
    copyTimer.current = null;
  };
  useEffect(
    () => () => {
      generation.current++;
      clearCopyTimer();
    },
    [],
  );
  const resetCopy = () => {
    clearCopyTimer();
    generation.current++;
    copying.current = false;
    setCopyState("idle");
    setSnapshot("");
  };
  const copyEvents = async () => {
    if (!enabled || !entries.length || copying.current) return;
    const request = ++generation.current;
    const value = formatVoiceDiagnostics(entries, {
      id: buildId,
      sha: buildSha,
    });
    copying.current = true;
    setSnapshot("");
    setCopyState("copying");
    copyTimer.current = setTimeout(() => {
      if (generation.current !== request) return;
      generation.current++;
      copyTimer.current = null;
      copying.current = false;
      setSnapshot(value);
      setCopyState("fallback");
    }, 5000);
    try {
      // Call directly within the tap gesture, as required by Safari/PWA.
      await navigator.clipboard.writeText(value);
      if (generation.current === request) setCopyState("copied");
    } catch {
      if (generation.current === request) {
        setSnapshot(value);
        setCopyState("fallback");
      }
    } finally {
      if (generation.current === request) {
        clearCopyTimer();
        copying.current = false;
      }
    }
  };
  return (
    <details className="settings-panel voice-diagnostics">
      <summary>{text.title}</summary>
      <div className="settings-section">
        <label>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => {
              resetCopy();
              onEnabledChange(event.target.checked);
            }}
          />{" "}
          {text.enable}
        </label>
        <p>{text.privacy}</p>
        <p>{text.steps}</p>
        {enabled && (
          <>
            <div className="voice-diagnostics-actions">
              <button
                type="button"
                onClick={copyEvents}
                disabled={!entries.length || copyState === "copying"}
              >
                {copyState === "copying" ? text.copying : text.copy}
              </button>
              <button
                type="button"
                onClick={() => {
                  resetCopy();
                  onClear();
                }}
              >
                {text.clear}
              </button>
            </div>
            <p role="status" aria-live="polite">
              {copyState === "copied"
                ? text.copied
                : copyState === "fallback"
                  ? text.fallback
                  : ""}
            </p>
            {copyState === "fallback" && (
              <textarea
                className="voice-diagnostics-snapshot"
                aria-label={text.snapshot}
                readOnly
                rows={8}
                value={snapshot}
                onFocus={(event) => {
                  event.currentTarget.select();
                  event.currentTarget.setSelectionRange(
                    0,
                    event.currentTarget.value.length,
                  );
                }}
              />
            )}
            {entries.length === 0 ? (
              <p role="status">{text.empty}</p>
            ) : (
              <ol aria-label={text.title}>
                {entries.map((entry) => (
                  <li key={entry.sequence}>
                    {text.attempt} {entry.attempt} · +
                    {(entry.elapsedMs / 1000).toFixed(1)}s · {entry.event} ·{" "}
                    {text[entry.disposition]}
                    {entry.reason ? ` · ${entry.reason}` : ""}
                    {entry.error ? ` · ${entry.error}` : ""}
                    {(
                      ["resultCount", "finalCount", "resultIndex"] as const
                    ).map((key) =>
                      entry[key] === undefined
                        ? null
                        : ` · ${text[key]} ${entry[key]}`,
                    )}
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </div>
    </details>
  );
}
