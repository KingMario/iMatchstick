import { type CopyText } from "./copy";

type Stats = {
  solved: number;
  streak: number;
  bypassed: number;
};

type StatsBarProps = {
  text: CopyText;
  stats: Stats;
  onClearStats: () => void;
};

export function StatsBar({ text, stats, onClearStats }: StatsBarProps) {
  return (
    <div className="stats" aria-label={text.gameSettingsLabel}>
      <div className="stat-item">
        <span>{text.solved}</span>
        <strong>{stats.solved}</strong>
      </div>
      <div className="stat-item">
        <span>{text.streak}</span>
        <strong>{stats.streak}</strong>
      </div>
      <div className="stat-item">
        <span>{text.bypassed}</span>
        <strong>{stats.bypassed}</strong>
      </div>
      <button
        type="button"
        className="stats-reset"
        aria-label={text.clearStats}
        onClick={onClearStats}
      >
        <span aria-hidden="true">↺</span>
        <span>{text.clearStats}</span>
      </button>
    </div>
  );
}
