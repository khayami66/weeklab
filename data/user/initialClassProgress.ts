import type { ClassProgress, GradeConfig } from "@/types";

/**
 * 既存 ClassProgress を新しい grade_configs に同期する。
 *
 * - `grade_configs` に存在するクラスで既存 progress があれば、その進度を維持
 *   （ただし pack_id が変わっていれば進度リセット：カリキュラムが異なるため）
 * - `grade_configs` に新規追加されたクラスは、初期値（理科のガイダンス・0時間）で追加
 * - `grade_configs` から削除されたクラスは、結果配列から除外（データは失われる）
 *
 * 呼び出し側は保存前に「クラス削除を伴うか」を判断し、ユーザー確認を取ること。
 */
export function syncClassProgress(
  current: ClassProgress[],
  gradeConfigs: GradeConfig[]
): ClassProgress[] {
  const currentMap = new Map(current.map((p) => [p.class_code, p]));
  const expected = generateInitialClassProgress(gradeConfigs);

  return expected.map((e) => {
    const existing = currentMap.get(e.class_code);
    if (existing && existing.pack_id === e.pack_id) {
      return existing; // 進度を維持
    }
    return e; // 新規 or pack変更 → 初期値
  });
}


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
