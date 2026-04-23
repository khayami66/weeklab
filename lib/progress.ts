import type { AnnualPlan, ClassProgress, LessonMaster } from "@/types";

/**
 * 進度から解決された本時情報。
 * LessonMaster が未整備の場合は lesson_title="(未作成)" / content="" で返す。
 */
export interface ResolvedLesson {
  unit_name: string;
  lesson_no: number;
  total_hours: number;
  lesson_title: string;
  content: string;
  /** 年間計画を完遂してこれ以上単元がない場合 true */
  is_finished: boolean;
}

const UNMADE_TITLE = "(未作成)";

/**
 * 指定クラスの「次に実施する本時」を解決する純粋関数。
 *
 * ロジック：
 *   1. progress.completed_hours >= 現単元の allocated_hours なら、年間計画順で次の単元へ繰り上げ
 *   2. 繰り上げ後は lesson_no=1、以降は lesson_no = completed_hours + 1
 *   3. LessonMaster に該当 {unit_name, lesson_no} がなければ "(未作成)" プレースホルダを返す
 *   4. 年間計画を完遂した場合は is_finished=true で返す
 *
 * @param progress 対象クラスの進度（状態は変更しない）
 * @param annualPlan 対象 pack の年間計画（月順で並んでいる前提）
 * @param lessonMaster 対象 pack の本時マスタ
 */
export function resolveCurrentLesson(
  progress: ClassProgress,
  annualPlan: AnnualPlan[],
  lessonMaster: LessonMaster[]
): ResolvedLesson {
  const resolved = advanceUnitIfCompleted(progress, annualPlan);

  if (resolved === null) {
    return {
      unit_name: progress.current_unit_name,
      lesson_no: 0,
      total_hours: 0,
      lesson_title: UNMADE_TITLE,
      content: "",
      is_finished: true,
    };
  }

  const { unitName, completedHours, unitPlan } = resolved;
  const lessonNo = completedHours + 1;
  const lesson = lessonMaster.find(
    (l) => l.unit_name === unitName && l.lesson_no === lessonNo
  );

  return {
    unit_name: unitName,
    lesson_no: lessonNo,
    total_hours: unitPlan.allocated_hours,
    lesson_title: lesson && lesson.lesson_title !== "" ? lesson.lesson_title : UNMADE_TITLE,
    content: lesson?.content ?? "",
    is_finished: false,
  };
}

/**
 * 「次の本時へ進める」ヘルパー（進度管理画面の「次へ」ボタンなどで利用想定）。
 * completed_hours を +1 し、単元完了なら年間計画順で次単元にリセット。
 * annualPlan を完遂した場合は元の progress をそのまま返す（追加不可）。
 */
export function advanceProgress(
  progress: ClassProgress,
  annualPlan: AnnualPlan[]
): ClassProgress {
  const nextTotal = progress.total_completed_hours + 1;
  const nextCompleted = progress.completed_hours + 1;

  // まず現単元を解決
  const resolved = advanceUnitIfCompleted(
    { ...progress, completed_hours: nextCompleted },
    annualPlan
  );

  if (resolved === null) {
    // 完遂
    return {
      ...progress,
      completed_hours: nextCompleted,
      total_completed_hours: nextTotal,
    };
  }

  return {
    ...progress,
    current_unit_name: resolved.unitName,
    completed_hours: resolved.completedHours,
    total_completed_hours: nextTotal,
  };
}

/**
 * 現単元の completed_hours が allocated_hours を超えている場合、
 * 年間計画順で次の単元に繰り上げた状態を返す。
 * 年間計画を完遂していれば null を返す。
 */
export function advanceUnitIfCompleted(
  progress: ClassProgress,
  annualPlan: AnnualPlan[]
): { unitName: string; completedHours: number; unitPlan: AnnualPlan } | null {
  let unitName = progress.current_unit_name;
  let completedHours = progress.completed_hours;

  // 現単元を annualPlan から探す
  let idx = annualPlan.findIndex((p) => p.unit_name === unitName);
  if (idx < 0) {
    // progress.current_unit_name が annualPlan になければ先頭から開始
    idx = 0;
    unitName = annualPlan[0]?.unit_name ?? unitName;
    completedHours = 0;
  }

  // completed_hours が allocated_hours 以上なら次単元へ
  while (idx < annualPlan.length && completedHours >= annualPlan[idx].allocated_hours) {
    idx += 1;
    if (idx >= annualPlan.length) return null;
    unitName = annualPlan[idx].unit_name;
    completedHours = 0;
  }

  return {
    unitName,
    completedHours,
    unitPlan: annualPlan[idx],
  };
}
