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
  onOpenAcademy: () => void;
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
  onOpenAcademy,
}: GameSettingsProps) {
  return (
    <GameOverlay
      open={open}
      title={text.settingsTitle}
      className="settings-overlay"
      closeLabel={text.close}
      onClose={onClose}
    >
      <button
        type="button"
        className="settings-share academy-settings-entry"
        data-testid="academy-open"
        onClick={onOpenAcademy}
      >
        {language === "zh" ? "火柴入门学园" : "Matchstick Academy"}
      </button>
      <div className="settings-common">
        <div
          className={`settings-row settings-language${isPhone ? "" : " settings-language-wide"}`}
        >
          <span>{text.languageLabel}</span>
          <div
            className="language-switch"
            role="group"
            aria-label={text.languageLabel}
          >
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
          <div className="settings-row settings-drag-hand">
            <span>{text.dragHand}</span>
            <div
              className="hand-switch"
              role="radiogroup"
              aria-label={text.dragHand}
            >
              {(["left", "right"] as const).map((hand) => (
                <label key={hand}>
                  <input
                    type="radio"
                    name="drag-hand"
                    value={hand}
                    checked={dragHand === hand}
                    onChange={() => onDragHandChange(hand)}
                  />
                  <span>
                    {hand === "left" ? text.leftHand : text.rightHand}
                  </span>
                </label>
              ))}
            </div>
          </div>
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
      </div>
      {update.status === "available" && (
        <div className="settings-update" role="status">
          <p>{text.updateStatus.available}</p>
          <button
            type="button"
            className="settings-share"
            disabled={update.applying}
            onClick={() => void update.apply()}
          >
            {update.applying ? text.updateApplying : text.updateReload}
          </button>
        </div>
      )}
      <details className="settings-panel">
        <summary>{text.instructions}</summary>
        <div className="settings-section">
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
        </div>
      </details>
      <details className="settings-panel">
        <summary>{text.statistics}</summary>
        <div className="settings-section">
          <StatsBar text={text} stats={stats} onClearStats={onClearStats} />
        </div>
      </details>
      <details className="settings-panel">
        <summary>{text.aboutVersion}</summary>
        <div className="settings-panel-content">
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
        </div>
      </details>
    </GameOverlay>
  );
}
