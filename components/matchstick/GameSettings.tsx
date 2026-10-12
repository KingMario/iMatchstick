import { type ComponentProps } from "react";
import { type DragHand } from "@/lib/drag";
import { ActionIcon } from "./ActionIcon";
import { type CopyText, type Language } from "./copy";
import { GameOverlay } from "./GameOverlay";
import { InstallShortcut } from "./InstallShortcut";
import { StatsBar } from "./StatsBar";
import { buildId, buildSha, type usePwaUpdate } from "./usePwaUpdate";

type GameSettingsProps = {
  update: ReturnType<typeof usePwaUpdate>;
  open: boolean;
  text: CopyText;
  language: Language;
  timerEnabled: boolean;
  soundEnabled: boolean;
  isPhone: boolean;
  dragHand: DragHand;
  onDragHandChange: (hand: DragHand) => void;
  stats: ComponentProps<typeof StatsBar>["stats"];
  feedback: string;
  onClose: () => void;
  onLanguageChange: (language: Language) => void;
  onTimerChange: (enabled: boolean) => void;
  onSoundChange: (enabled: boolean) => void;
  onShare: () => void;
  onClearStats: () => void;
};

export function GameSettings({
  update,
  open,
  text,
  language,
  timerEnabled,
  soundEnabled,
  isPhone,
  dragHand,
  onDragHandChange,
  stats,
  feedback,
  onClose,
  onLanguageChange,
  onTimerChange,
  onSoundChange,
  onShare,
  onClearStats,
}: GameSettingsProps) {
  return (
    <GameOverlay
      open={open}
      title={text.title}
      closeLabel={text.close}
      onClose={onClose}
    >
      <div className="settings-row">
        <span>{text.languageLabel}</span>
        <div className="language-switch" aria-label={text.languageLabel}>
          <button
            type="button"
            aria-pressed={language === "zh"}
            onClick={() => onLanguageChange("zh")}
          >
            中
          </button>
          <button
            type="button"
            aria-pressed={language === "en"}
            onClick={() => onLanguageChange("en")}
          >
            EN
          </button>
        </div>
      </div>
      {isPhone && (
        <label className="settings-row">
          <span>{text.dragHand}</span>
          <select
            value={dragHand}
            onChange={(event) =>
              onDragHandChange(event.target.value === "left" ? "left" : "right")
            }
          >
            <option value="left">{text.leftHand}</option>
            <option value="right">{text.rightHand}</option>
          </select>
        </label>
      )}
      <label className="settings-row">
        <span>{text.timer}</span>
        <input
          type="checkbox"
          checked={timerEnabled}
          onChange={(event) => onTimerChange(event.target.checked)}
        />
      </label>
      <label className="settings-row">
        <span>{text.sound}</span>
        <input
          type="checkbox"
          checked={soundEnabled}
          onChange={(event) => onSoundChange(event.target.checked)}
        />
      </label>
      <button type="button" className="settings-share" onClick={onShare}>
        <ActionIcon name="share" />
        {text.share}
      </button>
      <p className="settings-feedback" role="status">
        {feedback}
      </p>
      <InstallShortcut text={text} />
      <section className="settings-section">
        <h3>{text.version}</h3>
        <p>
          {buildId}
          {buildSha ? ` · ${buildSha}` : ""}
        </p>
        <p role="status">{text.updateStatus[update.status]}</p>
        <button
          type="button"
          className="settings-share"
          disabled={update.status === "checking" || update.applying}
          onClick={() => void update.check()}
        >
          {text.checkUpdate}
        </button>
        {update.status === "available" ? (
          <button
            type="button"
            className="settings-share"
            disabled={update.applying}
            onClick={() => void update.apply()}
          >
            {update.applying ? text.updateApplying : text.updateReload}
          </button>
        ) : null}
      </section>
      <section className="settings-section">
        <h3>{text.statistics}</h3>
        <StatsBar text={text} stats={stats} onClearStats={onClearStats} />
      </section>
      <section className="settings-section">
        <h3>{text.instructions}</h3>
        <p>{text.subtitle}</p>
        <hr />
        <p>{text.levelHint}</p>
        <p>{text.answerProgressHint}</p>
        <p>
          <ActionIcon name="newPuzzle" /> {text.newPuzzleIconHint}
        </p>
        <p>
          <ActionIcon name="undo" /> {text.undoIconHint}
        </p>
        <p>
          <ActionIcon name="answer" /> {text.answerIconHint}
        </p>
        <p>
          <ActionIcon name="voice" /> {text.voiceIconHint}
        </p>
        <hr />
        <p>{text.selectHint}</p>
        <p>{text.deselectHint}</p>
        <p>{text.dragHint}</p>
        <p>{text.continueHint}</p>
      </section>
      <footer className="settings-footer">
        <span>(c) Copyright Mario Studio 2026-2027</span>
        <a
          href="https://github.com/KingMario/iMatchstick"
          aria-label="GitHub"
          title="GitHub"
          target="_blank"
          rel="noreferrer"
        >
          <ActionIcon name="github" />
        </a>
      </footer>
    </GameOverlay>
  );
}
