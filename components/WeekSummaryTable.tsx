import type { WeekSummary } from "@/types";

type Props = {
  summary: WeekSummary;
  /**
   * class_code → その月の実施コマ数（`computeMonthlyHoursByClass` の結果）。
   * 月基準は**月曜日が属する月**で、その月の全週が対象。
   * 渡さなければ「月実施」の行を出さない（アーカイブ表示など）。
   */
  monthlyHours?: Record<string, number>;
  /** 「月実施」の見出しに添える月（例：9） */
  month?: number;
};

/**
 * クラス別の時数集計テーブル（週実施・月実施・累計）。
 *
 * **右端に「合計」列を置く。**クラスごとの数字だけでは
 * 「今週は全部で何コマか」「今月の総授業時数はいくつか」がその場で分からず、
 * 管理職への提出時に暗算することになるため。
 */
export default function WeekSummaryTable({ summary, monthlyHours, month }: Props) {
  const tallies = summary.class_tallies;

  if (tallies.length === 0) {
    return <p className="text-xs text-slate-500">クラスが登録されていません。</p>;
  }

  const rows = [
    {
      label: "週実施",
      value: (classCode: string) =>
        tallies.find((t) => t.class_code === classCode)?.weekly_hours ?? 0,
    },
    ...(monthlyHours
      ? [
          {
            label: month === undefined ? "月実施" : `月実施（${month}月）`,
            value: (classCode: string) => monthlyHours[classCode] ?? 0,
          },
        ]
      : []),
    {
      label: "累計",
      value: (classCode: string) =>
        tallies.find((t) => t.class_code === classCode)?.cumulative_hours ?? 0,
    },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs text-slate-600">
              項目
            </th>
            {tallies.map((t) => (
              <th
                key={t.class_code}
                className="border border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs text-slate-600"
              >
                {t.class_code}
              </th>
            ))}
            <th className="border border-slate-300 bg-slate-100 px-3 py-2 text-center text-xs font-bold text-slate-700">
              合計
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const total = tallies.reduce((sum, t) => sum + row.value(t.class_code), 0);
            return (
              <tr key={row.label}>
                <td className="border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  {row.label}
                </td>
                {tallies.map((t) => (
                  <td
                    key={t.class_code}
                    className="border border-slate-200 px-3 py-2 text-center font-medium tabular-nums text-slate-800"
                  >
                    {row.value(t.class_code)}
                  </td>
                ))}
                <td className="border border-slate-300 bg-slate-50 px-3 py-2 text-center font-bold tabular-nums text-slate-900">
                  {total}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
