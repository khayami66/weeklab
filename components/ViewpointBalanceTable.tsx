"use client";

import HealthBadge from "@/components/HealthBadge";
import type { ViewpointBalance } from "@/types";
import { BALANCE_ALERT_PT, BALANCE_WARN_PT, VIEWPOINT_LABELS } from "@/lib/grading";

type Props = {
  /** クラス単位の偏り。データが無いクラスは balance が null */
  classRows: { classCode: string; balance: ViewpointBalance | null }[];
  /** 要注目の児童（差が BALANCE_ALERT_PT 以上）。全クラス横断で差の大きい順 */
  students: ViewpointBalance[];
};

/**
 * 観点の偏りタブ（grading_design.md §5.1 タブ3）。
 *
 * 「思考・判断・表現が弱い」という**事実**までを出す画面。
 * その原因（配当時数に対して何時間かけたか等）との突合は §9-5 で次段階に送ってある。
 *
 * gap は (思判表 − 知技) のパーセントポイント。**負なら思考・判断・表現が低い**。
 */
export default function ViewpointBalanceTable({ classRows, students }: Props) {
  const withData = classRows.filter((r) => r.balance !== null);

  if (withData.length === 0) {
    return (
      <p className="rounded border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        この期間に集計できる得点がありません。期間を広げるか、「得点入力」タブで入力してください。
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className="text-sm font-bold text-slate-700">クラス別</h2>
        <div className="w-fit max-w-full overflow-x-auto rounded border border-slate-200">
          <table className="border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="border-b border-r border-slate-200 px-3 py-2 text-left text-xs font-medium text-slate-600">
                  クラス
                </th>
                <th className="border-b border-slate-200 px-3 py-2 text-right text-xs font-medium text-slate-600">
                  {VIEWPOINT_LABELS.knowledge}
                </th>
                <th className="border-b border-slate-200 px-3 py-2 text-right text-xs font-medium text-slate-600">
                  {VIEWPOINT_LABELS.thinking}
                </th>
                <th className="border-b border-slate-200 px-3 py-2 text-right text-xs font-medium text-slate-600">
                  差
                </th>
                <th className="border-b border-slate-200 px-3 py-2 text-left text-xs font-medium text-slate-600">
                  判定
                </th>
              </tr>
            </thead>
            <tbody>
              {classRows.map(({ classCode, balance }) => (
                <tr key={classCode} className="border-b border-slate-100 bg-white">
                  <td className="border-r border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
                    {classCode}
                  </td>
                  {balance === null ? (
                    <td colSpan={4} className="px-3 py-2 text-xs text-slate-400">
                      この期間のデータがありません
                    </td>
                  ) : (
                    <>
                      <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-800">
                        {formatRate(balance.knowledge_rate)}
                      </td>
                      <td className="px-3 py-2 text-right text-sm tabular-nums text-slate-800">
                        {formatRate(balance.thinking_rate)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right text-sm font-medium tabular-nums ${gapColor(balance)}`}
                      >
                        {formatGap(balance.gap)}
                      </td>
                      <td className="px-3 py-2">
                        <HealthBadge health={balance} />
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500">
          差は「{VIEWPOINT_LABELS.thinking} − {VIEWPOINT_LABELS.knowledge}」の
          パーセントポイント。<strong>負なら{VIEWPOINT_LABELS.thinking}が低い</strong>ことを
          表します。{BALANCE_WARN_PT}pt 以上で注意、{BALANCE_ALERT_PT}pt 以上で要対応。
          クラスの得点率は在籍者の合計点 ÷ 合計満点（受験数の少ない児童が同じ重みで効かないため）。
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-bold text-slate-700">
          要注目の児童（差が {BALANCE_ALERT_PT}pt 以上）
        </h2>
        {students.length === 0 ? (
          <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            差が {BALANCE_ALERT_PT}pt 以上の児童はいません。
          </p>
        ) : (
          <ul className="space-y-1.5">
            {students.map((b) => (
              <li
                key={`${b.class_code}:${b.student_no}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <span className="font-medium text-slate-700">
                  {b.class_code} {b.student_no}番
                </span>
                <span className="text-slate-600 tabular-nums">
                  {VIEWPOINT_LABELS.knowledge} {formatRate(b.knowledge_rate)}
                </span>
                <span className="text-slate-600 tabular-nums">
                  {VIEWPOINT_LABELS.thinking} {formatRate(b.thinking_rate)}
                </span>
                <span className={`font-medium tabular-nums ${gapColor(b)}`}>
                  {formatGap(b.gap)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function formatRate(rate: number | null): string {
  if (rate === null) return "—";
  return `${(Math.round(rate * 1000) / 10).toFixed(1)}%`;
}

/** gap は computeViewpointBalance が既に小数第1位に丸めてある（表示と判定を一致させるため） */
function formatGap(gap: number | null): string {
  if (gap === null) return "—";
  return `${gap > 0 ? "+" : ""}${gap.toFixed(1)}pt`;
}

function gapColor(b: ViewpointBalance): string {
  if (b.level === "alert") return "text-rose-700";
  if (b.level === "warn") return "text-amber-700";
  return "text-slate-600";
}
