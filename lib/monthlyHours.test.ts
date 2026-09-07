import { describe, expect, it } from "vitest";
import { computeMonthlyHoursByClass } from "./summary";
import { testTimetable } from "./__fixtures__/testData";
import type { TimetableOverride } from "@/types";

/**
 * 週案画面の「月実施」用の集計。
 *
 * testTimetable は 3-1 と 4-1 が月〜金に毎日1コマずつ（各クラス週5コマ）。
 * 2026年4月の月曜は 4/6, 4/13, 4/20, 4/27 の4週 → 各クラス 20コマ。
 */
describe("computeMonthlyHoursByClass", () => {
  it("その月の全週を合計する（月曜が属する月で判定）", () => {
    const hours = computeMonthlyHoursByClass(2026, 4, testTimetable, []);
    expect(hours["3-1"]).toBe(20); // 週5コマ × 4週
    expect(hours["4-1"]).toBe(20);
  });

  it("月をまたぐ週は月曜日の月に入る（4/27週は4月ぶんとして数える）", () => {
    // 4/27(月)〜5/2(土) の週は4月に含まれ、5月には含まれない
    const april = computeMonthlyHoursByClass(2026, 4, testTimetable, []);
    const may = computeMonthlyHoursByClass(2026, 5, testTimetable, []);
    // 5月の月曜は 5/4, 5/11, 5/18, 5/25 の4週 → 同じく20
    expect(april["3-1"]).toBe(20);
    expect(may["3-1"]).toBe(20);
  });

  it("休講にしたコマは数えない", () => {
    const overrides: TimetableOverride[] = [
      {
        date: "2026-04-06", // 月曜1限 3-1
        period: 1,
        original_class_code: "3-1",
        new_class_code: null,
        change_type: "cancel",
        memo: "行事",
      },
    ];
    const hours = computeMonthlyHoursByClass(2026, 4, testTimetable, overrides);
    expect(hours["3-1"]).toBe(19); // 20 - 1
    expect(hours["4-1"]).toBe(20); // 他クラスは変わらない
  });

  it("追加したコマは数える", () => {
    const overrides: TimetableOverride[] = [
      {
        date: "2026-04-11", // 土曜
        period: 1,
        original_class_code: null,
        new_class_code: "3-1",
        change_type: "add",
        memo: "土曜授業",
      },
    ];
    const hours = computeMonthlyHoursByClass(2026, 4, testTimetable, overrides);
    expect(hours["3-1"]).toBe(21); // 20 + 1
  });

  it("時間割が空なら空の集計になる", () => {
    expect(computeMonthlyHoursByClass(2026, 4, [], [])).toEqual({});
  });

  it("別の月の例外は影響しない", () => {
    const overrides: TimetableOverride[] = [
      {
        date: "2026-05-11", // 5月の休講
        period: 1,
        original_class_code: "3-1",
        new_class_code: null,
        change_type: "cancel",
        memo: "行事",
      },
    ];
    expect(computeMonthlyHoursByClass(2026, 4, testTimetable, overrides)["3-1"]).toBe(20);
    expect(computeMonthlyHoursByClass(2026, 5, testTimetable, overrides)["3-1"]).toBe(19);
  });
});
