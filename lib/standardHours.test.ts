import { describe, expect, it } from "vitest";
import { computeStandardHoursByClass } from "./summary";
import { testTimetable } from "./__fixtures__/testData";
import type { Timetable } from "@/types";

/**
 * 「いつもの週は何コマか」をクラス別に数える。
 * 週案編集中の帯（予定 n/基準 m）の分母になる。
 */
describe("computeStandardHoursByClass", () => {
  it("基本時間割の件数をクラスごとに数える", () => {
    // testTimetable は 3-1 と 4-1 が月〜金に1コマずつ
    expect(computeStandardHoursByClass(testTimetable)).toEqual({ "3-1": 5, "4-1": 5 });
  });

  it("学年で本数が違っても正しく数える（3年2コマ・4年3コマ）", () => {
    const tt: Timetable[] = [
      ["月", 1, "3-1"],
      ["水", 1, "3-1"],
      ["月", 2, "4-1"],
      ["水", 2, "4-1"],
      ["金", 2, "4-1"],
    ].map(([day, period, code]) => ({
      day: day as Timetable["day"],
      weekday_order: 1,
      period: period as number,
      class_code: code as string,
      grade: Number((code as string)[0]),
      class_number: Number((code as string)[2]),
      subject: "理科",
      note: "",
    }));
    expect(computeStandardHoursByClass(tt)).toEqual({ "3-1": 2, "4-1": 3 });
  });

  it("時間割が空なら空を返す（落ちない）", () => {
    expect(computeStandardHoursByClass([])).toEqual({});
  });

  it("週内例外は反映しない（本来の姿を返す物差しであるため）", () => {
    // 引数に overrides を取らないことが仕様。件数は時間割だけで決まる
    const before = computeStandardHoursByClass(testTimetable);
    const after = computeStandardHoursByClass(testTimetable);
    expect(after).toEqual(before);
  });
});
