import { describe, expect, it } from "vitest";
import { advanceProgress, advanceUnitIfCompleted, resolveCurrentLesson } from "./progress";
import {
  g3AnnualPlan,
  g3LessonMaster,
  progressG3Start,
} from "./__fixtures__/testData";

describe("resolveCurrentLesson", () => {
  it("単元A 0時間完了 → A1（lesson_title も整備済み）", () => {
    const r = resolveCurrentLesson(progressG3Start, g3AnnualPlan, g3LessonMaster);
    expect(r.is_finished).toBe(false);
    expect(r.unit_name).toBe("A");
    expect(r.lesson_no).toBe(1);
    expect(r.total_hours).toBe(2);
    expect(r.lesson_title).toBe("A1");
    expect(r.content).toBe("Ac1");
  });

  it("単元A 1時間完了 → A2", () => {
    const p = { ...progressG3Start, completed_hours: 1, total_completed_hours: 1 };
    const r = resolveCurrentLesson(p, g3AnnualPlan, g3LessonMaster);
    expect(r.unit_name).toBe("A");
    expect(r.lesson_no).toBe(2);
  });

  it("単元A 2時間完了 → 次単元B へ繰り上げ（lesson_no=1）", () => {
    const p = { ...progressG3Start, completed_hours: 2, total_completed_hours: 2 };
    const r = resolveCurrentLesson(p, g3AnnualPlan, g3LessonMaster);
    expect(r.unit_name).toBe("B");
    expect(r.lesson_no).toBe(1);
    expect(r.total_hours).toBe(3);
  });

  it("単元B lesson_title が空 → (未作成) プレースホルダ", () => {
    const p = { ...progressG3Start, current_unit_name: "B", completed_hours: 0, total_completed_hours: 2 };
    const r = resolveCurrentLesson(p, g3AnnualPlan, g3LessonMaster);
    expect(r.lesson_title).toBe("(未作成)");
    expect(r.content).toBe("");
  });

  it("年間計画完遂（A2時間+B3時間=5時間消化後） → is_finished=true", () => {
    const p = { ...progressG3Start, current_unit_name: "B", completed_hours: 3, total_completed_hours: 5 };
    const r = resolveCurrentLesson(p, g3AnnualPlan, g3LessonMaster);
    expect(r.is_finished).toBe(true);
  });
});

describe("advanceUnitIfCompleted", () => {
  it("単元未完了時は現単元を維持", () => {
    const result = advanceUnitIfCompleted(progressG3Start, g3AnnualPlan);
    expect(result).not.toBeNull();
    expect(result!.unitName).toBe("A");
    expect(result!.completedHours).toBe(0);
  });

  it("current_unit_name が annualPlan にない場合は先頭から開始", () => {
    const p = { ...progressG3Start, current_unit_name: "存在しない単元" };
    const result = advanceUnitIfCompleted(p, g3AnnualPlan);
    expect(result).not.toBeNull();
    expect(result!.unitName).toBe("A");
    expect(result!.completedHours).toBe(0);
  });

  it("現単元完了時は次単元へ繰り上げ", () => {
    const p = { ...progressG3Start, completed_hours: 2 };
    const result = advanceUnitIfCompleted(p, g3AnnualPlan);
    expect(result!.unitName).toBe("B");
    expect(result!.completedHours).toBe(0);
  });

  it("全単元完了時は null を返す", () => {
    const p = { ...progressG3Start, current_unit_name: "B", completed_hours: 3 };
    const result = advanceUnitIfCompleted(p, g3AnnualPlan);
    expect(result).toBeNull();
  });
});

describe("advanceProgress", () => {
  it("単元内進度を1つ進める", () => {
    const next = advanceProgress(progressG3Start, g3AnnualPlan);
    expect(next.current_unit_name).toBe("A");
    expect(next.completed_hours).toBe(1);
    expect(next.total_completed_hours).toBe(1);
  });

  it("単元完了時は次単元にリセット", () => {
    const p = { ...progressG3Start, completed_hours: 1, total_completed_hours: 1 };
    const next = advanceProgress(p, g3AnnualPlan);
    // A2時間目を消化 → 次単元Bへ
    expect(next.current_unit_name).toBe("B");
    expect(next.completed_hours).toBe(0);
    expect(next.total_completed_hours).toBe(2);
  });
});
