import type {
  AnnualPlan,
  CancelledSlot,
  ClassProgress,
  FirstLessonConfirm,
  LessonMaster,
  SlotPlanOverride,
  TeacherSetting,
  TestMaster,
  Timetable,
  TimetableOverride,
  Weekday,
  WeeklyPlan,
  WeekSummary,
} from "@/types";
import { formatDate, getMondayOf, getWeekDates, getWeekNumber } from "./date";
import { advanceUnitIfCompleted } from "./progress";
import { findSlotPlan } from "./slotPlanEdit";

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
 *   cancel  : 実施コマから外し、`cancelled` に理由つきで積む
 *   replace : class_code を new_class_code に差し替え
 *   add     : 指定 date/period のコマを追加
 *
 * **休講コマを `slots` に混ぜない。** `slots` の件数がそのまま
 * 週実施時数・進度の前進量になるため、混ぜると時数が過大に数えられる。
 * 画面に「休講」として出すために、別配列で返す。
 */
export function buildWeekSlots(
  weekStart: Date,
  timetable: Timetable[],
  overrides: TimetableOverride[]
): { slots: Slot[]; cancelled: CancelledSlot[] } {
  const dates = getWeekDates(weekStart); // 月〜土6日分
  const slots: Slot[] = [];
  const cancelled: CancelledSlot[] = [];

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
        // 実施コマからは外すが、画面・印刷に「休講」として出すため記録する
        cancelled.push({
          date: dateStr,
          weekday,
          period: slot.period,
          class_code: slot.class_code,
          grade: slot.grade,
          reason: ov.memo,
        });
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

  cancelled.sort((a, b) => a.date.localeCompare(b.date) || a.period - b.period);
  return { slots, cancelled };
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
 * 中身を差し替えたコマを1件つくる。
 *
 * テストは `lesson_no` を 0 にする（単元の何時間目でもないため）。
 * 画面・紙は `kind` を見て判別するので、`lesson_no === 0` を
 * 「年間計画完了」と誤読しないこと。
 */
function buildOverriddenLesson(
  slot: Slot,
  slotPlan: SlotPlanOverride,
  pack: PackBundle,
  testMasters: TestMaster[],
  currentUnitName: string
): WeeklyPlan {
  const base = {
    date: slot.date,
    weekday: slot.weekday,
    period: slot.period,
    class_code: slot.class_code,
    grade: slot.grade,
    memo: slotPlan.memo,
    is_override: slot.is_override,
    override_memo: slot.override_memo,
    is_plan_override: true,
  };

  if (slotPlan.kind === "test") {
    const test = testMasters.find((t) => t.test_id === slotPlan.test_id);
    return {
      ...base,
      // テストが単元に紐づいていればその単元、無ければ今やっている単元を文脈として出す
      unit_name: test && test.unit_name !== "" ? test.unit_name : currentUnitName,
      lesson_no: 0,
      total_hours: 0,
      lesson_title: test ? test.test_name : "テスト",
      content: "",
      kind: "test",
      test_id: slotPlan.test_id,
    };
  }

  const unitPlan = pack.annualPlan.find((u) => u.unit_name === slotPlan.unit_name);
  const lesson = pack.lessonMaster.find(
    (l) => l.unit_name === slotPlan.unit_name && l.lesson_no === slotPlan.lesson_no
  );
  return {
    ...base,
    unit_name: slotPlan.unit_name,
    lesson_no: slotPlan.lesson_no,
    total_hours: unitPlan?.allocated_hours ?? 0,
    lesson_title: lesson && lesson.lesson_title !== "" ? lesson.lesson_title : "(未作成)",
    content: lesson?.content ?? "",
    kind: "lesson",
    test_id: "",
  };
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
  firstLessonConfirms: FirstLessonConfirm[] = [],
  /** コマの中身の差し替え（テスト・別単元の差し込み） */
  slotPlans: SlotPlanOverride[] = [],
  /** テスト名を出すため。差し替えが無ければ使わない */
  testMasters: TestMaster[] = []
): { plan: WeeklyPlan[]; summary: WeekSummary; cancelled: CancelledSlot[] } {
  const { slots, cancelled } = buildWeekSlots(weekStart, timetable, overrides);

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

    // ── 中身を自分で決めているコマ（テスト・差し込み）──
    // **単元の進度は動かさない。**授業時間としては実施しているので累計だけ進める。
    // ここで continue するので、下の自動計算は走らない。
    const slotPlan = findSlotPlan(slotPlans, slot.date, slot.period, slot.class_code);
    if (slotPlan) {
      plan.push(buildOverriddenLesson(slot, slotPlan, pack, testMasters, vs.unit_name));
      vs.total_completed_hours += 1;
      tallyByClass[slot.class_code] = (tallyByClass[slot.class_code] ?? 0) + 1;
      continue;
    }

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
        kind: "lesson",
        test_id: "",
        is_plan_override: false,
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
      kind: "lesson",
      test_id: "",
      is_plan_override: false,
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
      // **この週のコマ数を足さない。**
      // 足すと「今週を実施済みに確定」した後で二重に数える
      // （確定で total_completed_hours が +n されるのに、表示でまた +n していた）。
      // 累計は確定した分だけ増えるのが正しく、/progress での手動補正もそのまま効く。
      cumulative_hours: p.total_completed_hours,
    })),
  };

  return { plan, summary, cancelled };
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

