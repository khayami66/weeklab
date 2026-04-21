import type { ClassProgress, GradeConfig } from "@/types";

/**
 * `grade_configs` から `ClassProgress[]` を動的生成するヘルパー。
 *
 * 例：
 *   generateInitialClassProgress([
 *     { grade: 3, class_count: 3, pack_id: "keirinkan.science.grade3" },
 *     { grade: 4, class_count: 4, pack_id: "keirinkan.science.grade4" },
 *   ])
 *   → [
 *     { class_code: "3-1", grade: 3, pack_id: "...", current_unit_name: "理科のガイダンス", ... },
 *     { class_code: "3-2", ... },
 *     ...
 *     { class_code: "4-4", ... },
 *   ]
 *
 * 初回起動時は全クラスが「理科のガイダンス」・0時間からスタート。
 * 実際の進度は `/progress` 画面でユーザーが入力する（壁打ち合意事項B）。
 */
export function generateInitialClassProgress(
  gradeConfigs: GradeConfig[]
): ClassProgress[] {
  const result: ClassProgress[] = [];

  for (const gc of gradeConfigs) {
    for (let classNumber = 1; classNumber <= gc.class_count; classNumber++) {
      result.push({
        class_code: `${gc.grade}-${classNumber}`,
        grade: gc.grade,
        pack_id: gc.pack_id,
        current_unit_name: "理科のガイダンス",
        completed_hours: 0,
        total_completed_hours: 0,
        memo: "",
      });
    }
  }

  return result;
}
