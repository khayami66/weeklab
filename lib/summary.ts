import type {
  AnnualPlan,
  ClassProgress,
  FirstLessonConfirm,
  LessonMaster,
  MonthlyClassTally,
  MonthlySummary,
  TeacherSetting,
  Timetable,
  TimetableOverride,
  WeeklyPlan,
  WeekSummary,
} from "@/types";
import { formatDate, getMondayOf, getWeekDates, parseISODate } from "./date";
import { buildWeekSlots, generateWeeklyPlan } from "./weeklyPlan";

interface PackBundle {
  annualPlan: AnnualPlan[];
  lessonMaster: LessonMaster[];
}

/**
 * 週案と現在の進度から WeekSummary を算出する。
 *
 * - weekly_hours: 週内の実施コマ数（クラスごと）
 * - cumulative_hours: **確定済みの累計そのまま**（`progress.total_completed_hours`）。
 *   この週のコマ数は足さない（確定後に二重計上されるため）
 *
 * 注意：`generateWeeklyPlan` も内部で WeekSummary を返すため、このヘルパーは
 * 「既存の plan/progress から後付けで再集計したい」ケースで使う想定。
 */
export function computeWeekSummary(
  plan: WeeklyPlan[],
  progress: ClassProgress[],
  weekStart: Date,
  setting: TeacherSetting
): WeekSummary {
  const tallyByClass: Record<string, number> = {};
  for (const p of plan) {
    tallyByClass[p.class_code] = (tallyByClass[p.class_code] ?? 0) + 1;
  }

  const dates = getWeekDates(weekStart);
  const weekNoBase = parseISODate(setting.start_date);
  const mondaysBetween = Math.floor(
    (weekStart.getTime() - getMondayOf(weekNoBase).getTime()) / (7 * 24 * 60 * 60 * 1000)
  );

  return {
    week_no: mondaysBetween + 1,
    period_from: formatDate(dates[0], "YYYY-MM-DD"),
    period_to: formatDate(dates[dates.length - 1], "YYYY-MM-DD"),
    class_tallies: progress.map((p) => ({
      class_code: p.class_code,
      weekly_hours: tallyByClass[p.class_code] ?? 0,
      cumulative_hours: p.total_completed_hours,
    })),
  };
}

/**
 * 指定年・月の月次集計を計算する。
 *
 * 月基準：**月曜日が属する月**（月またぎ週は月曜日の月で集計）。
 * 現在の進度（progress）を起点に、その月の各週を generateWeeklyPlan で生成し、
 * class_code × unit_name で時数を積み上げる。
 *
 * ※ 過去月の再現には対応しない（アーカイブ閲覧では ArchivedWeek.plans から別途集計する想定）。
 */
export function computeMonthSummary(
  year: number,
  month: number,
  setting: TeacherSetting,
  timetable: Timetable[],
  overrides: TimetableOverride[],
  progress: ClassProgress[],
  packs: Record<string, PackBundle>,
  firstLessonConfirmsByMonday: Record<string, FirstLessonConfirm[]> = {}
): MonthlySummary {
  const mondays = collectMondaysForMonth(year, month);

  // class_code × unit_name の時数マップ
  const tally: Record<string, Record<string, number>> = {};
  for (const p of progress) {
    tally[p.class_code] = {};
  }

  // 各週を生成して集計（注意：progress は毎週リセットせず現在時点の値で通す）
  for (const monday of mondays) {
    const key = formatDate(monday, "YYYY-MM-DD");
    const confirms = firstLessonConfirmsByMonday[key] ?? [];
    const { plan } = generateWeeklyPlan(
      monday,
      setting,
      timetable,
      overrides,
      progress,
      packs,
      confirms
    );
    for (const entry of plan) {
      // 月基準：plan の date の月ではなく、monday（月曜日）の月で集計
      if (monday.getFullYear() !== year || monday.getMonth() + 1 !== month) continue;
      const perClass = tally[entry.class_code] ?? {};
      perClass[entry.unit_name] = (perClass[entry.unit_name] ?? 0) + 1;
      tally[entry.class_code] = perClass;
    }
  }

  const class_tallies: MonthlyClassTally[] = Object.entries(tally).map(([classCode, byUnit]) => {
    const entries = Object.entries(byUnit).map(([unit_name, hours]) => ({ unit_name, hours }));
    const total = entries.reduce((sum, e) => sum + e.hours, 0);
    return {
      class_code: classCode,
      by_unit: entries,
      total_hours: total,
    };
  });

  return {
    year,
    month,
    class_tallies,
  };
}

/**
 * その月のクラス別コマ数を数える（週案画面の「月実施」用）。
 *
 * **月基準は月曜日が属する月**（月次集計と同じルール）。
 * **「今週を実施済みに確定」した週だけを数える**（`confirmedWeeks`）。
 * 予定を含めると「実施」という名前と食い違い、確定を押す意味も薄れるため。
 *
 * コマ数は**時間割と例外だけで決まる**（どの単元をやるかには依らない）ので、
 * `generateWeeklyPlan` を通さず `buildWeekSlots` で数える。
 * 進度もカリキュラムパックも要らず、`computeMonthSummary` より軽い。
 *
 * 休講にしたコマは `buildWeekSlots` が `slots` から外すので、自動的に数えられない。
 */
export function computeMonthlyHoursByClass(
  year: number,
  month: number,
  timetable: Timetable[],
  overrides: TimetableOverride[],
  confirmedWeeks: string[]
): Record<string, number> {
  const confirmed = new Set(confirmedWeeks);
  const hours: Record<string, number> = {};
  for (const monday of collectMondaysForMonth(year, month)) {
    // **確定した週だけ数える。**「実施」の名のとおり、やった分だけを積む
    if (!confirmed.has(formatDate(monday, "YYYY-MM-DD"))) continue;
    const { slots } = buildWeekSlots(monday, timetable, overrides);
    for (const s of slots) {
      hours[s.class_code] = (hours[s.class_code] ?? 0) + 1;
    }
  }
  return hours;
}

/**
 * 指定年・月に属する「月曜日の月」が year/month になる月曜日を列挙。
 *
 * 実装：
 *   - 月初 (year-month-01) から週の月曜を得る
 *   - 月曜の月が year/month と一致する間、mondays に追加
 *   - 月曜が翌月に入ったら終了
 */
export function collectMondaysForMonth(year: number, month: number): Date[] {
  const firstDayOfMonth = new Date(year, month - 1, 1);
  let monday = getMondayOf(firstDayOfMonth);

  // firstDayOfMonth の月曜が前月に属する場合は、翌週の月曜に進める
  if (monday.getMonth() + 1 !== month || monday.getFullYear() !== year) {
    monday = new Date(monday);
    monday.setDate(monday.getDate() + 7);
  }

  const mondays: Date[] = [];
  while (monday.getFullYear() === year && monday.getMonth() + 1 === month) {
    mondays.push(new Date(monday));
    monday.setDate(monday.getDate() + 7);
  }
  return mondays;
}
