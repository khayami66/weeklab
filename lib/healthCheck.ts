import type { AnnualPlan, ClassProgress, HealthLevel, ProgressHealth } from "@/types";

/** ヘルスレベル判定の閾値 */
export const HEALTH_WARN_THRESHOLD = 3;
export const HEALTH_ALERT_THRESHOLD = 5;

/**
 * 進度のずれを判定する純粋関数。
 *
 * 期待累計 = 年間配当時数 × (currentWeekNo / totalWeeks)
 * diff = actual_cumulative - expected_cumulative
 *
 * |diff| < 3  → ok
 * 3 ≤ |diff| < 5 → warn（amber）
 * 5 ≤ |diff|    → alert（rose）
 *
 * @param annualPlanByPack pack_id → 年間計画の対応表
 */
export function checkProgressHealth(
  progress: ClassProgress[],
  annualPlanByPack: Record<string, AnnualPlan[]>,
  currentWeekNo: number,
  totalWeeks: number
): ProgressHealth[] {
  if (totalWeeks <= 0 || currentWeekNo < 0) {
    // 想定外のパラメータ：全クラス ok 扱いで返す（エラーは呼び出し側で握らない）
    return progress.map((p) => ({
      class_code: p.class_code,
      expected_cumulative: 0,
      actual_cumulative: p.total_completed_hours,
      diff: 0,
      level: "ok" as HealthLevel,
      message: "",
    }));
  }

  const clampedWeek = Math.max(0, Math.min(currentWeekNo, totalWeeks));

  return progress.map((p) => {
    const plan = annualPlanByPack[p.pack_id] ?? [];
    const totalAllocated = plan.reduce((sum, e) => sum + e.allocated_hours, 0);
    const expected = (totalAllocated * clampedWeek) / totalWeeks;
    const diff = p.total_completed_hours - expected;
    const absDiff = Math.abs(diff);

    const level: HealthLevel =
      absDiff < HEALTH_WARN_THRESHOLD
        ? "ok"
        : absDiff < HEALTH_ALERT_THRESHOLD
          ? "warn"
          : "alert";

    const message = buildMessage(diff, level);

    return {
      class_code: p.class_code,
      expected_cumulative: Math.round(expected * 10) / 10, // 小数1桁に丸め
      actual_cumulative: p.total_completed_hours,
      diff: Math.round(diff * 10) / 10,
      level,
      message,
    };
  });
}

function buildMessage(diff: number, level: HealthLevel): string {
  if (level === "ok") {
    if (diff > 0) return `${round1(diff)}時間進みが早めです`;
    if (diff < 0) return `${round1(-diff)}時間遅れ気味です`;
    return "順調です";
  }
  if (level === "warn") {
    return diff >= 0
      ? `${round1(diff)}時間進みすぎています`
      : `${round1(-diff)}時間遅れています`;
  }
  // alert
  return diff >= 0
    ? `${round1(diff)}時間の進みすぎ（要確認）`
    : `${round1(-diff)}時間の遅れ（要対応）`;
}

function round1(n: number): string {
  const r = Math.round(n * 10) / 10;
  return r.toString();
}
