import { describe, expect, it } from "vitest";
import { formatLessonsForLine } from "./format";
import type { WeeklyPlan } from "@/types";

function makeLesson(overrides: Partial<WeeklyPlan>): WeeklyPlan {
  return {
    date: "2026-04-06",
    weekday: "月",
    period: 1,
    class_code: "3-1",
    grade: 3,
    unit_name: "生き物をさがそう",
    lesson_no: 1,
    total_hours: 4,
    lesson_title: "",
    content: "",
    memo: "",
    is_override: false,
    override_memo: "",
    ...overrides,
  };
}

describe("formatLessonsForLine", () => {
  it("授業なしの日でもヘッダーだけ表示する", () => {
    const result = formatLessonsForLine([], new Date(2026, 3, 6));
    expect(result).toBe("● 4月6日(月) の理科\n（今日の理科の授業はありません）");
  });

  it("1コマのみの日", () => {
    const lesson = makeLesson({ period: 2, class_code: "4-1", unit_name: "春の生き物", lesson_no: 3, total_hours: 8 });
    const result = formatLessonsForLine([lesson], new Date(2026, 3, 6));
    expect(result).toBe("● 4月6日(月) の理科\n2限 4-1 春の生き物 3/8");
  });

  it("複数コマを時限順でソート", () => {
    const l1 = makeLesson({ period: 3, class_code: "3-1", unit_name: "A", lesson_no: 1, total_hours: 2 });
    const l2 = makeLesson({ period: 1, class_code: "4-1", unit_name: "X", lesson_no: 2, total_hours: 4 });
    const result = formatLessonsForLine([l1, l2], new Date(2026, 3, 6));
    const lines = result.split("\n");
    expect(lines[1]).toBe("1限 4-1 X 2/4");
    expect(lines[2]).toBe("3限 3-1 A 1/2");
  });

  it("計画完了のコマは (計画完了) と表示", () => {
    const lesson = makeLesson({ lesson_no: 0, total_hours: 0, unit_name: "B" });
    const result = formatLessonsForLine([lesson], new Date(2026, 3, 6));
    expect(result).toContain("(計画完了)");
  });
});
