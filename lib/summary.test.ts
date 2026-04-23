import { describe, expect, it } from "vitest";
import { collectMondaysForMonth, computeMonthSummary, computeWeekSummary } from "./summary";
import { generateWeeklyPlan } from "./weeklyPlan";
import {
  progressG3Start,
  progressG4Start,
  testPacks,
  testSetting,
  testTimetable,
  WEEK1_MONDAY,
} from "./__fixtures__/testData";

describe("computeWeekSummary", () => {
  it("plan と progress から週・累計を正しく算出", () => {
    const { plan } = generateWeeklyPlan(
      WEEK1_MONDAY,
      testSetting,
      testTimetable,
      [],
      [progressG3Start, progressG4Start],
      testPacks,
      []
    );
    const summary = computeWeekSummary(plan, [progressG3Start, progressG4Start], WEEK1_MONDAY, testSetting);
    expect(summary.week_no).toBe(1);
    const g3 = summary.class_tallies.find((c) => c.class_code === "3-1")!;
    expect(g3.weekly_hours).toBe(5);
    expect(g3.cumulative_hours).toBe(5);
  });
});

describe("collectMondaysForMonth", () => {
  it("2026年4月の月曜日（月曜基準）を列挙", () => {
    // 4月の月曜：4/6, 4/13, 4/20, 4/27
    const mondays = collectMondaysForMonth(2026, 4);
    expect(mondays.map((d) => d.getDate())).toEqual([6, 13, 20, 27]);
  });

  it("2026年5月の月曜日を列挙（月曜が前月に属する週は除外）", () => {
    // 5/4, 5/11, 5/18, 5/25
    const mondays = collectMondaysForMonth(2026, 5);
    expect(mondays.map((d) => d.getDate())).toEqual([4, 11, 18, 25]);
  });

  it("月をまたぐ週は月曜日の月で判定（4/27 月曜の週は4月扱い）", () => {
    // 4/27(月) 〜 5/2(土) の週は "4月" に属する
    const mondays4 = collectMondaysForMonth(2026, 4);
    expect(mondays4.some((d) => d.getDate() === 27 && d.getMonth() === 3)).toBe(true);
    // 同週が5月の列挙には入らない
    const mondays5 = collectMondaysForMonth(2026, 5);
    expect(mondays5.some((d) => d.getDate() === 27 && d.getMonth() === 3)).toBe(false);
  });
});

describe("computeMonthSummary", () => {
  it("2026年4月の集計：4週分の時数が積み上がる", () => {
    // 4月の月曜は 4/6, 4/13, 4/20, 4/27 の4週
    // 各週10コマ（3-1×5 + 4-1×5）、4週で40コマ
    const summary = computeMonthSummary(
      2026,
      4,
      testSetting,
      testTimetable,
      [],
      [progressG3Start, progressG4Start],
      testPacks
    );
    expect(summary.year).toBe(2026);
    expect(summary.month).toBe(4);
    const g3 = summary.class_tallies.find((c) => c.class_code === "3-1")!;
    // 4週 × 5コマ = 20時間
    expect(g3.total_hours).toBe(20);
    const g4 = summary.class_tallies.find((c) => c.class_code === "4-1")!;
    expect(g4.total_hours).toBe(20);
  });
});
