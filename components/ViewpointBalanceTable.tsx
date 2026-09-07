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
          <>
            {/*
              クラスごとにまとめ、横に並べる。
              全クラスを1列に混ぜて並べると縦に長くなり、右側が空いたまま
              「どのクラスに偏りが集中しているか」も読み取れないため。
              クラス内は差の大きい順（students が既にその順）。
            */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {classRows.map(({ classCode }) => {
                const members = students.filter((b) => b.class_code === classCode);
                if (members.length === 0) return null;
                return (
                  <div
                    key={classCode}
                    className="overflow-hidden rounded border border-slate-200"
                  >
                    <div className="flex items-baseline justify-between bg-slate-50 px-3 py-1.5">
                      <span className="text-sm font-medium text-slate-800">{classCode}</span>
                      <span className="text-xs tabular-nums text-slate-500">
                        {members.length}名
                      </span>
                    </div>
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr>
                          <th className="border-b border-slate-200 px-2 py-1 text-right text-xs font-medium text-slate-500">
                            番号
                          </th>
                          <th className="border-b border-slate-200 px-2 py-1 text-right text-xs font-medium text-slate-500">
                            知技
                          </th>
                          <th className="border-b border-slate-200 px-2 py-1 text-right text-xs font-medium text-slate-500">
                            思判表
                          </th>
                          <th className="border-b border-slate-200 px-2 py-1 text-right text-xs font-medium text-slate-500">
                            差
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {members.map((b) => (
                          <tr key={b.student_no} className="border-b border-slate-100 bg-white">
                            <td className="px-2 py-1 text-right text-xs tabular-nums text-slate-500">
                              {b.student_no}
                            </td>
                            <td className="px-2 py-1 text-right tabular-nums text-slate-700">
                              {formatRate(b.knowledge_rate)}
                            </td>
                            <td className="px-2 py-1 text-right tabular-nums text-slate-700">
                              {formatRate(b.thinking_rate)}
                            </td>
                            <td
                              className={`px-2 py-1 text-right font-medium tabular-nums ${gapColor(b)}`}
                            >
                              {formatGap(b.gap)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>

            {/* 該当者がいないクラスも「見た」ことが分かるように1行で出す */}
            {(() => {
              const clear = classRows
                .filter(
                  (r) =>
                    r.balance !== null &&
                    !students.some((b) => b.class_code === r.classCode)
                )
                .map((r) => r.classCode);
              if (clear.length === 0) return null;
              return (
                <p className="text-xs text-slate-500">
                  該当なし：{clear.join("、")}
                </p>
              );
            })()}

            <p className="text-xs text-slate-500">
              知技＝{VIEWPOINT_LABELS.knowledge}／思判表＝{VIEWPOINT_LABELS.thinking}。
              クラス内は差の大きい順です。
            </p>
          </>
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
