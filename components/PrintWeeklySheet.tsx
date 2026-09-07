import { formatDate } from "@/lib/date";
import type {
  CancelledSlot,
  TeacherSetting,
  Weekday,
  WeeklyPlan,
  WeekSummary,
} from "@/types";

const WEEKDAYS: readonly Weekday[] = ["月", "火", "水", "木", "金", "土"];
const PERIODS = [1, 2, 3, 4, 5, 6];

type Props = {
  setting: TeacherSetting;
  weekNo: number;
  weekDates: Date[];
  plan: WeeklyPlan[];
  cancelled: CancelledSlot[];
  summary: WeekSummary;
  /** class_code → その月の確定済みコマ数 */
  monthlyHours: Record<string, number>;
  /** 表示中の週が確定済みか（週実施を出すかの判断） */
  weekConfirmed: boolean;
};

/**
 * 週案の印刷面（松戸市様式・Y案）。A4横1枚。
 *
 * 画面の週案グリッドと**同じ構造**（月〜土 × 1〜6限）にしている。
 * 週案画面を枠固定にしたことで、印刷用に別のレイアウトを起こす必要がなくなった。
 *
 * 記録に残る様式の要点（`reference_source_images.md`）：
 *   - 月〜金5行 ＋ 教科別集計欄、緑系罫線
 *   - 集計は「**週予定・週実施・実施累計**」の3行
 *   - Y案では月〜**土**に拡張する（管理職合意済み）
 *
 * **集計が画面と違う点：紙は「週予定」を先頭に置く。**
 * 週案は実施前に提出するものなので、画面の「週実施」（確定した週だけ数える）は
 * 提出時点では 0 になる。紙には予定を出さないと意味がないため、様式どおり
 * 予定と実施を並べる。
 *
 * 週先頭コマが未確定でも警告は出さない（推定値でそのまま刷る）。
 */
export default function PrintWeeklySheet({
  setting,
  weekNo,
  weekDates,
  plan,
  cancelled,
  summary,
  monthlyHours,
  weekConfirmed,
}: Props) {
  const byCell = new Map<string, WeeklyPlan[]>();
  for (const p of plan) {
    const k = `${p.date}:${p.period}`;
    byCell.set(k, [...(byCell.get(k) ?? []), p]);
  }
  const cancelledByCell = new Map<string, CancelledSlot[]>();
  for (const c of cancelled) {
    const k = `${c.date}:${c.period}`;
    cancelledByCell.set(k, [...(cancelledByCell.get(k) ?? []), c]);
  }

  const dateKeys = weekDates.map((d) => formatDate(d, "YYYY-MM-DD"));
  const tallies = summary.class_tallies;
  const month = weekDates[0].getMonth() + 1;

  const rows: { label: string; value: (c: string) => number }[] = [
    {
      // 紙は予定を出す。週案は実施前に提出するため
      label: "週予定",
      value: (c) => tallies.find((t) => t.class_code === c)?.weekly_hours ?? 0,
    },
    {
      label: "週実施",
      value: (c) =>
        weekConfirmed ? (tallies.find((t) => t.class_code === c)?.weekly_hours ?? 0) : 0,
    },
    { label: `月実施(${month}月)`, value: (c) => monthlyHours[c] ?? 0 },
    {
      label: "実施累計",
      value: (c) => tallies.find((t) => t.class_code === c)?.cumulative_hours ?? 0,
    },
  ];

  return (
    <div className="print-keep mx-auto w-full bg-white text-slate-900">
      {/* ヘッダー：年度・週・期間・所属・検印 */}
      <div className="mb-1.5 flex items-end justify-between border-b-2 border-emerald-700 pb-1">
        <div className="flex items-baseline gap-3">
          <span className="text-base font-bold">週案（理科専科）</span>
          <span className="text-sm">
            {setting.school_year}年度　第{weekNo}週
          </span>
          <span className="text-sm">
            {formatDate(weekDates[0], "M月D日")} 〜{" "}
            {formatDate(weekDates[weekDates.length - 1], "M月D日")}
          </span>
        </div>
        <div className="flex items-end gap-3">
          <span className="text-xs">
            {setting.school_name}　{setting.teacher_name}
          </span>
          {/* 検印欄は空欄（手書き） */}
          <span className="flex h-10 w-16 items-start justify-center border border-slate-700 text-[9px] text-slate-500">
            検印
          </span>
        </div>
      </div>

      {/* 週案グリッド：月〜土 × 1〜6限 */}
      <table className="w-full table-fixed border-collapse text-[9px] leading-tight">
        <colgroup>
          <col style={{ width: "22px" }} />
          {dateKeys.map((k) => (
            <col key={k} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="border border-emerald-700 bg-emerald-50 p-0.5" />
            {weekDates.map((d, i) => (
              <th
                key={dateKeys[i]}
                className="border border-emerald-700 bg-emerald-50 px-1 py-0.5 text-[10px] font-bold"
              >
                {WEEKDAYS[i]}　{formatDate(d, "M/D")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {PERIODS.map((period) => (
            <tr key={period}>
              <th className="border border-emerald-700 bg-emerald-50 px-0.5 py-0.5 text-center text-[9px] font-normal">
                {period}
              </th>
              {dateKeys.map((dateKey) => {
                const lessons = byCell.get(`${dateKey}:${period}`) ?? [];
                const cancels = cancelledByCell.get(`${dateKey}:${period}`) ?? [];
                return (
                  <td
                    key={dateKey}
                    className="h-[52px] border border-emerald-700 px-1 py-0.5 align-top"
                  >
                    {lessons.map((l) => (
                      <div key={`${l.class_code}`} className="mb-0.5">
                        <div className="flex items-baseline gap-1">
                          <span className="font-bold">{l.class_code}</span>
                          <span className="truncate">{l.unit_name}</span>
                          {l.lesson_no > 0 && (
                            <span className="shrink-0 tabular-nums">
                              {l.lesson_no}/{l.total_hours}
                            </span>
                          )}
                        </div>
                        {l.content && (
                          <div className="line-clamp-2 text-[8px] text-slate-700">
                            {l.content}
                          </div>
                        )}
                      </div>
                    ))}
                    {cancels.map((c) => (
                      <div key={`x${c.class_code}`} className="text-slate-500">
                        <span className="line-through">{c.class_code}</span>{" "}
                        <span>休講{c.reason ? `（${c.reason}）` : ""}</span>
                      </div>
                    ))}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      {/* 下段：クラス別の時数 */}
      <table className="mt-1.5 w-full table-fixed border-collapse text-[9px]">
        <thead>
          <tr>
            <th className="w-20 border border-emerald-700 bg-emerald-50 px-1 py-0.5 text-left">
              時数
            </th>
            {tallies.map((t) => (
              <th
                key={t.class_code}
                className="border border-emerald-700 bg-emerald-50 px-1 py-0.5 text-center"
              >
                {t.class_code}
              </th>
            ))}
            <th className="w-14 border border-emerald-700 bg-emerald-100 px-1 py-0.5 text-center font-bold">
              合計
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const total = tallies.reduce((s, t) => s + row.value(t.class_code), 0);
            return (
              <tr key={row.label}>
                <th className="border border-emerald-700 bg-emerald-50 px-1 py-0.5 text-left font-normal">
                  {row.label}
                </th>
                {tallies.map((t) => (
                  <td
                    key={t.class_code}
                    className="border border-emerald-700 px-1 py-0.5 text-center tabular-nums"
                  >
                    {row.value(t.class_code)}
                  </td>
                ))}
                <td className="border border-emerald-700 bg-emerald-50 px-1 py-0.5 text-center font-bold tabular-nums">
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
