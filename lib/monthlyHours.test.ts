import { describe, expect, it } from "vitest";
import { computeMonthlyHoursByClass } from "./summary";
import { testTimetable } from "./__fixtures__/testData";
import type { TimetableOverride } from "@/types";

/**
 * 週案画面の「月実施」用の集計。
 *
 * testTimetable は 3-1 と 4-1 が月〜金に毎日1コマずつ（各クラス週5コマ）。
 * 2026年4月の月曜は 4/6, 4/13, 4/20, 4/27 の4週。
 *
 * **「今週を実施済みに確定」した週だけを数える**ので、
 * 確定していない週は 0 として扱われる。
 */
const APRIL_MONDAYS = ["2026-04-06", "2026-04-13", "2026-04-20", "2026-04-27"];

describe("computeMonthlyHoursByClass", () => {
  it("確定した週だけを合計する", () => {
    // 4週すべて確定 → 週5コマ × 4週 = 20
    const all = computeMonthlyHoursByClass(2026, 4, testTimetable, [], APRIL_MONDAYS);
    expect(all["3-1"]).toBe(20);
    expect(all["4-1"]).toBe(20);

    // 2週だけ確定 → 10
    const two = computeMonthlyHoursByClass(2026, 4, testTimetable, [], APRIL_MONDAYS.slice(0, 2));
    expect(two["3-1"]).toBe(10);
  });

  it("1週も確定していなければ空（＝すべて0）", () => {
    expect(computeMonthlyHoursByClass(2026, 4, testTimetable, [], [])).toEqual({});
  });

  it("他の月の確定は混ざらない（月曜が属する月で判定）", () => {
    const confirmed = [...APRIL_MONDAYS, "2026-05-04", "2026-05-11"];
    expect(computeMonthlyHoursByClass(2026, 4, testTimetable, [], confirmed)["3-1"]).toBe(20);
    // 5月は 5/4, 5/11 の2週だけ確定 → 10
    expect(computeMonthlyHoursByClass(2026, 5, testTimetable, [], confirmed)["3-1"]).toBe(10);
  });

  it("月をまたぐ週は月曜日の月に入る（4/27週は4月ぶん）", () => {
    const only427 = computeMonthlyHoursByClass(2026, 4, testTimetable, [], ["2026-04-27"]);
    expect(only427["3-1"]).toBe(5);
    // 同じ週は5月には入らない
    expect(computeMonthlyHoursByClass(2026, 5, testTimetable, [], ["2026-04-27"])).toEqual({});
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
    const hours = computeMonthlyHoursByClass(2026, 4, testTimetable, overrides, APRIL_MONDAYS);
    expect(hours["3-1"]).toBe(19); // 20 - 1
    expect(hours["4-1"]).toBe(20); // 他クラスは変わらない
  });

  it("追加したコマは数える", () => {
    const overrides: TimetableOverride[] = [
      {
        date: "2026-04-11", // 土曜（4/6 の週）
        period: 1,
        original_class_code: null,
        new_class_code: "3-1",
        change_type: "add",
        memo: "土曜授業",
      },
    ];
    const hours = computeMonthlyHoursByClass(2026, 4, testTimetable, overrides, APRIL_MONDAYS);
    expect(hours["3-1"]).toBe(21); // 20 + 1
  });

  it("時間割が空なら空の集計になる", () => {
    expect(computeMonthlyHoursByClass(2026, 4, [], [], APRIL_MONDAYS)).toEqual({});
  });
});
