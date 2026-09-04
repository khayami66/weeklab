import type { HealthLevel } from "@/types";

type Props = {
  /**
   * level と message だけを見る。ProgressHealth（進度）と
   * ViewpointBalance（観点の偏り）の両方をそのまま渡せるようにしている。
   */
  health: { level: HealthLevel; message: string };
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
 * ok / warn / alert の3段階を表示する共通バッジ。
 *
 * 進度ヘルスチェック（±3h で warn、±5h で alert）と
 * 観点の偏り（±10pt で warn、±20pt で alert）で共用する。
 * 閾値の意味は呼び出し側が message に載せる。
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
