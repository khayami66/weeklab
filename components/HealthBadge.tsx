import type { ProgressHealth } from "@/types";

type Props = {
  health: ProgressHealth;
  /** true だとラベルのみ（アイコン風）、false だと詳細メッセージ付き */
  compact?: boolean;
};

const STYLES = {
  ok: "bg-emerald-100 text-emerald-700 border-emerald-200",
  warn: "bg-amber-100 text-amber-800 border-amber-300",
  alert: "bg-rose-100 text-rose-800 border-rose-300",
} as const;

const LABELS = {
  ok: "順調",
  warn: "注意",
  alert: "要対応",
} as const;

/**
 * 進度ヘルスチェック結果を表示するバッジ。
 * 壁打ち合意事項：±3h で warn、±5h で alert（`checkProgressHealth` と同じ閾値）。
 */
export default function HealthBadge({ health, compact = false }: Props) {
  const className = `inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${STYLES[health.level]}`;

  if (compact) {
    return (
      <span className={className} title={health.message}>
        {LABELS[health.level]}
      </span>
    );
  }

  return (
    <div className={className}>
      <span className="font-semibold">{LABELS[health.level]}</span>
      <span className="opacity-80">{health.message}</span>
    </div>
  );
}
