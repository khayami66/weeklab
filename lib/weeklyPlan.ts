import type {
  AnnualPlan,
  ClassProgress,
  FirstLessonConfirm,
  LessonMaster,
  TeacherSetting,
  Timetable,
  TimetableOverride,
  Weekday,
  WeeklyPlan,
  WeekSummary,
} from "@/types";
import { formatDate, getMondayOf, getWeekDates, getWeekNumber } from "./date";
import { advanceUnitIfCompleted } from "./progress";

/** JS の Date#getDay() (0=日〜6=土) を Weeklab の Weekday に変換 */
function dayIndexToWeekday(dayIndex: number): Weekday | null {
  switch (dayIndex) {
    case 1:
      return "月";
    case 2:
      return "火";
    case 3:
      return "水";
    case 4:
      return "木";
    case 5:
      return "金";
    case 6:
      return "土";
    default:
      return null; // 日曜は対象外
  }
}

/** 1コマを表す内部型 */
interface Slot {
  date: string;
  weekday: Weekday;
  period: number;
  class_code: string;
  grade: number;
  is_override: boolean;
  override_memo: string;
}

interface PackBundle {
  annualPlan: AnnualPlan[];
  lessonMaster: LessonMaster[];
}

/**
 * 基本時間割と例外をマージして、指定週（月〜土）の全コマを Slot 列にする。
 *   cancel  : 該当コマ削除
 *   replace : class_code を new_class_code に差し替え
 *   add     : 指定 date/period のコマを追加
 */
export function buildWeekSlots(
  weekStart: Date,
  timetable: Timetable[],
  overrides: TimetableOverride[]
): Slot[] {
  const dates = getWeekDates(weekStart); // 月〜土6日分
  const slots: Slot[] = [];

  for (const date of dates) {
    const weekday = dayIndexToWeekday(date.getDay());
    if (!weekday) continue;
    const dateStr = formatDate(date, "YYYY-MM-DD");
    const dayOverrides = overrides.filter((o) => o.date === dateStr);

    // 基本時間割（当該曜日分）
    const baseSlots = timetable
      .filter((t) => t.day === weekday)
      .map((t) => ({
        date: dateStr,
        weekday,
        period: t.period,
        class_code: t.class_code,
        grade: t.grade,
        is_override: false,
        override_memo: "",
      }));

    // cancel / replace を適用
    const afterReplace: Slot[] = [];
    for (const slot of baseSlots) {
      const ov = dayOverrides.find(
        (o) => o.period === slot.period && o.original_class_code === slot.class_code
      );
      if (!ov) {
        afterReplace.push(slot);
        continue;
      }
      if (ov.change_type === "cancel") {
        // 削除（何もしない）
        continue;
      }
      if (ov.change_type === "replace" && ov.new_class_code) {
        afterReplace.push({
          ...slot,
          class_code: ov.new_class_code,
          grade: parseGradeFromClassCode(ov.new_class_code) ?? slot.grade,
          is_override: true,
          override_memo: ov.memo,
        });
      }
    }

    // add を追加
    const adds = dayOverrides.filter((o) => o.change_type === "add" && o.new_class_code);
    for (const a of adds) {
      if (!a.new_class_code) continue;
      afterReplace.push({
        date: dateStr,
        weekday,
        period: a.period,
        class_code: a.new_class_code,
        grade: parseGradeFromClassCode(a.new_class_code) ?? 0,
        is_override: true,
        override_memo: a.memo,
      });
    }

    // 時限順にソート
    afterReplace.sort((a, b) => a.period - b.period);
    slots.push(...afterReplace);
  }

  return slots;
}

function parseGradeFromClassCode(classCode: string): number | null {
  const m = classCode.match(/^(\d+)-/);
  return m ? Number(m[1]) : null;
}

/** 仮進度（週内シミュレーション用） */
interface VirtualState {
  pack_id: string;
  unit_name: string;
  completed_hours: number; // 当該単元内
  total_completed_hours: number;
}

/**
 * 週案を生成する（純粋関数）。
 * 各クラスごとに週内の仮進度を回し、先頭コマは firstLessonConfirms を優先、
 * 2コマ目以降は LessonMaster 順に自動で割り当てる。
 *
 * 単元完了時は annualPlan の順で次単元に繰り上げる（年間計画順、sub/guide/project/review も含む）。
 */
export function generateWeeklyPlan(
  weekStart: Date,
  setting: TeacherSetting,
  timetable: Timetable[],
  overrides: TimetableOverride[],
  progress: ClassProgress[],
  packs: Record<string, PackBundle>,
  firstLessonConfirms: FirstLessonConfirm[] = []
): { plan: WeeklyPlan[]; summary: WeekSummary } {
  const slots = buildWeekSlots(weekStart, timetable, overrides);

  // クラスごとの仮進度マップを初期化
  const virtualState: Record<string, VirtualState> = {};
  const progressByClass = new Map(progress.map((p) => [p.class_code, p]));

  for (const p of progress) {
    virtualState[p.class_code] = {
      pack_id: p.pack_id,
      unit_name: p.current_unit_name,
      completed_hours: p.completed_hours,
      total_completed_hours: p.total_completed_hours,
    };
  }

  // 先頭コマ確定値を仮進度に反映
  // (確定値は「その週の最初のコマで lesson_no から始める」ことを意味する
  //   → completed_hours = lesson_no - 1 に巻き戻し)
  const seenFirst = new Set<string>();
  for (const c of firstLessonConfirms) {
    const vs = virtualState[c.class_code];
    if (!vs) continue;
    vs.unit_name = c.unit_name;
    // total_completed_hours は推定困難なので、元 progress の値をベースに lesson_no-1 での再計算はしない
    // （ヘルスチェック用の累計は /progress で管理する想定）
    const baseTotal = progressByClass.get(c.class_code)?.total_completed_hours ?? 0;
    vs.total_completed_hours = baseTotal;
    vs.completed_hours = c.lesson_no - 1;
  }

  const plan: WeeklyPlan[] = [];
  const tallyByClass: Record<string, number> = {};

  for (const slot of slots) {
    const vs = virtualState[slot.class_code];
    if (!vs) {
      // progress に未登録のクラス（grade_configs 外）→ スキップしつつフォールバック表示は今回は省略
      continue;
    }
    const pack = packs[vs.pack_id];
    if (!pack) continue;

    const isFirstForClass = !seenFirst.has(slot.class_code);
    if (isFirstForClass) seenFirst.add(slot.class_code);

    // 単元完了なら年間計画順で次単元へ繰り上げ
    const advanced = advanceUnitIfCompleted(
      {
        class_code: slot.class_code,
        grade: slot.grade,
        pack_id: vs.pack_id,
        current_unit_name: vs.unit_name,
        completed_hours: vs.completed_hours,
        total_completed_hours: vs.total_completed_hours,
        memo: "",
      },
      pack.annualPlan
    );

    if (advanced === null) {
      // 年間計画完遂：コマ自体は実施時間として計上する
      // （授業時間は存在するので weekly_hours / cumulative_hours に含める）
      plan.push({
        date: slot.date,
        weekday: slot.weekday,
        period: slot.period,
        class_code: slot.class_code,
        grade: slot.grade,
        unit_name: vs.unit_name,
        lesson_no: 0,
        total_hours: 0,
        lesson_title: "(計画完了)",
        content: "",
        memo: "",
        is_override: slot.is_override,
        override_memo: slot.override_memo,
      });
      vs.total_completed_hours += 1;
      tallyByClass[slot.class_code] = (tallyByClass[slot.class_code] ?? 0) + 1;
      continue;
    }

    vs.unit_name = advanced.unitName;
    vs.completed_hours = advanced.completedHours;
    const lessonNo = advanced.completedHours + 1;
    const unitPlan = advanced.unitPlan;

    const lesson = pack.lessonMaster.find(
      (l) => l.unit_name === vs.unit_name && l.lesson_no === lessonNo
    );

    plan.push({
      date: slot.date,
      weekday: slot.weekday,
      period: slot.period,
      class_code: slot.class_code,
      grade: slot.grade,
      unit_name: vs.unit_name,
      lesson_no: lessonNo,
      total_hours: unitPlan.allocated_hours,
      lesson_title: lesson && lesson.lesson_title !== "" ? lesson.lesson_title : "(未作成)",
      content: lesson?.content ?? "",
      memo: "",
      is_override: slot.is_override,
      override_memo: slot.override_memo,
    });

    // 仮進度を進める
    vs.completed_hours += 1;
    vs.total_completed_hours += 1;
    tallyByClass[slot.class_code] = (tallyByClass[slot.class_code] ?? 0) + 1;
  }

  // WeekSummary 組み立て
  const mondayDates = getWeekDates(weekStart);
  const summary: WeekSummary = {
    week_no: getWeekNumber(weekStart, setting.start_date),
    period_from: formatDate(mondayDates[0], "YYYY-MM-DD"),
    period_to: formatDate(mondayDates[mondayDates.length - 1], "YYYY-MM-DD"),
    class_tallies: progress.map((p) => ({
      class_code: p.class_code,
      weekly_hours: tallyByClass[p.class_code] ?? 0,
      cumulative_hours: p.total_completed_hours + (tallyByClass[p.class_code] ?? 0),
    })),
  };

  return { plan, summary };
}

/**
 * 指定日の授業一覧を返す（LINE通知やホーム画面の「今日の授業」用）。
 * 内部で generateWeeklyPlan を呼び、date の plan だけフィルタする。
 */
export function getLessonsForDate(
  date: Date,
  setting: TeacherSetting,
  timetable: Timetable[],
  overrides: TimetableOverride[],
  progress: ClassProgress[],
  packs: Record<string, PackBundle>,
  firstLessonConfirms: FirstLessonConfirm[] = []
): WeeklyPlan[] {
  // 日付が属する週の月曜を得る
  const monday = getMondayOf(date);
  const { plan } = generateWeeklyPlan(
    monday,
    setting,
    timetable,
    overrides,
    progress,
    packs,
    firstLessonConfirms
  );
  const targetDateStr = formatDate(date, "YYYY-MM-DD");
  return plan.filter((p) => p.date === targetDateStr);
}

