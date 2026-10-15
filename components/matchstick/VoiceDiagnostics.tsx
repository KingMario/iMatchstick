import type { VoiceTraceEntry } from "@/lib/voiceDiagnostics";
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
      "仅保留本页最近120条事件和结果数量；不保存语句或音频，不上传、不导出。关闭或刷新即清空。",
    steps:
      "开启后关闭设置，连续尝试两题，再回到这里查看。事件表示浏览器通知，不证明收到了有效声音。",
    clear: "清空事件",
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
      "Keeps only the latest 120 events and result counts in page memory. No speech text or audio is saved, uploaded, or exported. Turning off or reloading clears it.",
    steps:
      "Enable, close Settings, try two questions, then return here. Events are browser notifications, not proof that usable audio arrived.",
    clear: "Clear events",
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
  return (
    <details className="settings-panel voice-diagnostics">
      <summary>{text.title}</summary>
      <div className="settings-section">
        <label>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => onEnabledChange(event.target.checked)}
          />{" "}
          {text.enable}
        </label>
        <p>{text.privacy}</p>
        <p>{text.steps}</p>
        {enabled && (
          <>
            <button type="button" onClick={onClear}>
              {text.clear}
            </button>
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
