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
 * 週案の印刷面（松戸市様式・Y案）。**A4 縦1枚**。
 *
 * **日を行・時限を列**に組む。理由は2つ。
 *   1. A4縦は横幅が狭い（余白を引いて194mm）。曜日を列にすると1列30mmを切り、
 *      授業内容が読めなくなる。行にすれば縦の余裕を使える
 *   2. 記録に残る様式が「**月〜金5行**」＝日が行（`reference_source_images.md`）
 *
 * 画面の週案グリッドは「時限を行・曜日を列」なので**転置した形**になるが、
 * セルの中身（日付 × 時限）は同じなので差し替えるだけで済んでいる。
 *
 * 集計の要点：**紙は「週予定」を先頭に置く。**
 * 週案は実施前に提出するため、確定した週だけを数える「週実施」は
 * 提出時点で必ず 0 になる。様式が予定と実施を並べているのはこのため。
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
    // 高さを紙の内寸（A4縦 297mm − 上下余白 8mm×2 = 281mm）に固定し、
    // 縦フレックスでグリッドを伸ばす。**下に大きな余白を残さないため。**
    // ヘッダーと時数表は必要な高さだけ取り、余りを全部グリッドに配る。
    <div className="print-keep mx-auto flex h-[281mm] w-full flex-col bg-white text-slate-900">
      {/* ヘッダー：年度・週・期間・所属・検印 */}
      <div className="mb-1.5 flex shrink-0 items-end justify-between border-b-2 border-emerald-700 pb-1">
        <div>
          <div className="text-sm font-bold">週案（理科専科）</div>
          <div className="mt-0.5 text-[10px]">
            {setting.school_year}年度　第{weekNo}週
            {formatDate(weekDates[0], "M月D日")} 〜{" "}
            {formatDate(weekDates[weekDates.length - 1], "M月D日")}
          </div>
        </div>
        <div className="flex items-end gap-2">
          <span className="text-[10px]">
            {setting.school_name}　{setting.teacher_name}
          </span>
          {/* 検印欄は空欄（手書き） */}
          <span className="flex h-9 w-14 items-start justify-center border border-slate-700 text-[8px] text-slate-500">
            検印
          </span>
        </div>
      </div>

      {/* 週案グリッド：日（行）× 時限（列）。A4縦は横が狭いので日を行にする */}
      {/*
        全36枠が埋まった週（担任利用）では中身が枠を超えることがある。
        超えたぶんは下の時数表に食い込ませず、ここで止める。
      */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <table className="h-full w-full table-fixed border-collapse text-[9px] leading-tight">
        <colgroup>
          <col style={{ width: "38px" }} />
          {PERIODS.map((p) => (
            <col key={p} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th className="border border-emerald-700 bg-emerald-50 p-0.5" />
            {PERIODS.map((p) => (
              <th
                key={p}
                className="border border-emerald-700 bg-emerald-50 px-1 py-0.5 text-[9px] font-bold"
              >
                {p}限
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weekDates.map((d, i) => {
            const dateKey = dateKeys[i];
            return (
              <tr key={dateKey}>
                <th className="border border-emerald-700 bg-emerald-50 px-0.5 py-0.5 text-center text-[9px] font-bold">
                  {WEEKDAYS[i]}
                  <div className="text-[8px] font-normal">{formatDate(d, "M/D")}</div>
                </th>
                {PERIODS.map((period) => {
                  const lessons = byCell.get(`${dateKey}:${period}`) ?? [];
                  const cancels = cancelledByCell.get(`${dateKey}:${period}`) ?? [];
                  return (
                    <td
                      key={period}
                      className="border border-emerald-700 px-1 py-0.5 align-top"
                    >
                      {lessons.map((l) => {
                        // 授業案が未記入のコマは「(未作成)」を紙に刷らない。
                        // 画面は促すために出すが、提出物にその文字は要らない
                        const title =
                          l.lesson_title && l.lesson_title !== "(未作成)"
                            ? l.lesson_title
                            : "";
                        return (
                          <div key={l.class_code} className="mb-1">
                            <div className="flex items-baseline justify-between gap-1">
                              <span className="text-[11px] font-bold">{l.class_code}</span>
                              {l.lesson_no > 0 && (
                                <span className="shrink-0 text-[9px] tabular-nums text-slate-600">
                                  {l.lesson_no}/{l.total_hours}
                                </span>
                              )}
                            </div>
                            {/* 単元名は折り返して2行まで。長い単元名を切り落とさない */}
                            <div className="mt-0.5 line-clamp-2 text-[10px] font-medium leading-snug">
                              {l.unit_name}
                            </div>
                            {title && (
                              <div className="mt-0.5 line-clamp-2 text-[9px] leading-snug text-slate-800">
                                {title}
                              </div>
                            )}
                            {l.content && (
                              <div className="mt-1 line-clamp-5 text-[9px] leading-relaxed text-slate-600">
                                {l.content}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {cancels.map((c) => (
                        <div key={`x${c.class_code}`} className="text-slate-500">
                          <span className="line-through">{c.class_code}</span> 休講
                          {c.reason && <div className="text-[7px]">（{c.reason}）</div>}
                        </div>
                      ))}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          </tbody>
        </table>
      </div>

      {/* 下段：クラス別の時数。高さは中身ぶんだけ取る */}
      <table className="mt-1.5 w-full shrink-0 table-fixed border-collapse text-[8px]">
        <thead>
          <tr>
            <th className="w-16 border border-emerald-700 bg-emerald-50 px-1 py-0.5 text-left">
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
            <th className="w-12 border border-emerald-700 bg-emerald-100 px-1 py-0.5 text-center font-bold">
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
