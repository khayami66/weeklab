import type { WeekSummary } from "@/types";

type Props = {
  summary: WeekSummary;
};

/**
 * 週実施・実施累計のクラス別集計テーブル。
 * 月実施時数は別画面（月次集計）で提示するため、ここには含めない。
 */
export default function WeekSummaryTable({ summary }: Props) {
  if (summary.class_tallies.length === 0) {
    return (
      <p className="text-xs text-slate-500">クラスが登録されていません。</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs text-slate-600">
              項目
            </th>
            {summary.class_tallies.map((t) => (
              <th
                key={t.class_code}
                className="border border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs text-slate-600"
              >
                {t.class_code}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              週実施
            </td>
            {summary.class_tallies.map((t) => (
              <td
                key={t.class_code}
                className="border border-slate-200 px-3 py-2 text-center font-medium text-slate-800"
              >
                {t.weekly_hours}
              </td>
            ))}
          </tr>
          <tr>
            <td className="border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              実施累計
            </td>
            {summary.class_tallies.map((t) => (
              <td
                key={t.class_code}
                className="border border-slate-200 px-3 py-2 text-center font-medium text-slate-800"
              >
                {t.cumulative_hours}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
