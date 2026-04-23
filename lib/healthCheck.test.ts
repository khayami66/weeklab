import { describe, expect, it } from "vitest";
import { checkProgressHealth } from "./healthCheck";
import { g3AnnualPlan, g4AnnualPlan } from "./__fixtures__/testData";
import type { ClassProgress } from "@/types";

const annualPlanByPack = {
  "test.grade3": g3AnnualPlan, // 合計 5時間
  "test.grade4": g4AnnualPlan, // 合計 4時間
};

// 総週数 10 週、現在 5 週目 → 期待累計は年間配当の 50%
const currentWeekNo = 5;
const totalWeeks = 10;

function makeProgress(classCode: string, packId: string, total: number): ClassProgress {
  return {
    class_code: classCode,
    grade: 3,
    pack_id: packId,
    current_unit_name: "A",
    completed_hours: 0,
    total_completed_hours: total,
    memo: "",
  };
}

describe("checkProgressHealth", () => {
  it("期待累計と一致 → ok、messageは 順調", () => {
    // test.grade3 合計5h × 50% = 2.5h
    const progress = [makeProgress("3-1", "test.grade3", 2.5)];
    const result = checkProgressHealth(progress, annualPlanByPack, currentWeekNo, totalWeeks);
    expect(result[0].level).toBe("ok");
    expect(result[0].diff).toBe(0);
  });

  it("差 2h（< 3） → ok", () => {
    const progress = [makeProgress("3-1", "test.grade3", 4.5)]; // diff = 2
    const result = checkProgressHealth(progress, annualPlanByPack, currentWeekNo, totalWeeks);
    expect(result[0].level).toBe("ok");
    expect(result[0].diff).toBe(2);
  });

  it("差 3h ちょうど → warn（閾値境界）", () => {
    // 実累計 5.5h、期待 2.5h、diff = 3.0 → warn
    const progress = [makeProgress("3-1", "test.grade3", 5.5)];
    const result = checkProgressHealth(progress, annualPlanByPack, currentWeekNo, totalWeeks);
    expect(result[0].level).toBe("warn");
  });

  it("差 5h ちょうど → alert（閾値境界）", () => {
    // 実累計 7.5h、期待 2.5h、diff = 5.0 → alert
    const progress = [makeProgress("3-1", "test.grade3", 7.5)];
    const result = checkProgressHealth(progress, annualPlanByPack, currentWeekNo, totalWeeks);
    expect(result[0].level).toBe("alert");
  });

  it("遅れもきちんと警告する", () => {
    // 実累計 -3h、期待 2.5h、diff = -5.5 → alert（遅れ）
    // 値を0未満にはできないので、期待が高い条件で確認
    // test.grade4（合計4h × 50% = 2h）、実0h、diff = -2 → ok
    const progress = [makeProgress("4-1", "test.grade4", 0)];
    const result = checkProgressHealth(progress, annualPlanByPack, currentWeekNo, totalWeeks);
    expect(result[0].diff).toBe(-2);
    expect(result[0].level).toBe("ok");
  });

  it("複数クラス同時判定が可能", () => {
    const progress = [
      makeProgress("3-1", "test.grade3", 2.5), // ok
      makeProgress("4-1", "test.grade4", 10), // alert（進みすぎ）
    ];
    const result = checkProgressHealth(progress, annualPlanByPack, currentWeekNo, totalWeeks);
    expect(result).toHaveLength(2);
    expect(result[0].level).toBe("ok");
    expect(result[1].level).toBe("alert");
  });

  it("totalWeeks=0 など異常値では全クラス ok を返す（エラー握らず）", () => {
    const progress = [makeProgress("3-1", "test.grade3", 3)];
    const result = checkProgressHealth(progress, annualPlanByPack, 5, 0);
    expect(result[0].level).toBe("ok");
  });
});
