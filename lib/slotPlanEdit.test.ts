import { describe, expect, it } from "vitest";
import {
  clearSlotPlan,
  clearSlotPlansInWeek,
  findSlotPlan,
  setSlotPlan,
  slotPlansInWeek,
} from "./slotPlanEdit";
import type { SlotPlanOverride } from "@/types";

const test31: SlotPlanOverride = {
  date: "2026-04-06",
  period: 1,
  class_code: "3-1",
  kind: "test",
  test_id: "t.unitA",
  unit_name: "",
  lesson_no: 0,
  memo: "",
};

const insert41: SlotPlanOverride = {
  date: "2026-04-08",
  period: 2,
  class_code: "4-1",
  kind: "lesson",
  test_id: "",
  unit_name: "秋の生き物",
  lesson_no: 1,
  memo: "",
};

describe("findSlotPlan", () => {
  it("日付・時限・クラスが全部一致したときだけ返す", () => {
    const plans = [test31, insert41];
    expect(findSlotPlan(plans, "2026-04-06", 1, "3-1")).toEqual(test31);
    // 1つでも違えば別のコマ
    expect(findSlotPlan(plans, "2026-04-06", 2, "3-1")).toBeNull();
    expect(findSlotPlan(plans, "2026-04-07", 1, "3-1")).toBeNull();
    expect(findSlotPlan(plans, "2026-04-06", 1, "3-2")).toBeNull();
  });

  it("差し替えが無ければ null（＝進度からの自動計算）", () => {
    expect(findSlotPlan([], "2026-04-06", 1, "3-1")).toBeNull();
  });
});

describe("setSlotPlan", () => {
  it("同じコマを2回指定したら上書きする（重複させない）", () => {
    const once = setSlotPlan([], test31);
    const twice = setSlotPlan(once, { ...test31, kind: "lesson", unit_name: "B", lesson_no: 2 });
    expect(twice).toHaveLength(1);
    expect(twice[0]).toMatchObject({ kind: "lesson", unit_name: "B", lesson_no: 2 });
  });

  it("別のコマは並存する", () => {
    const plans = setSlotPlan(setSlotPlan([], test31), insert41);
    expect(plans).toHaveLength(2);
  });

  it("元の配列を書き換えない", () => {
    const original = [test31];
    setSlotPlan(original, insert41);
    expect(original).toHaveLength(1);
  });
});

describe("clearSlotPlan", () => {
  it("そのコマだけ消す", () => {
    const plans = [test31, insert41];
    const next = clearSlotPlan(plans, "2026-04-06", 1, "3-1");
    expect(next).toEqual([insert41]);
  });

  it("無いコマを消しても落ちない", () => {
    expect(clearSlotPlan([test31], "2026-04-09", 5, "4-4")).toEqual([test31]);
  });
});

describe("週単位の操作", () => {
  const week = ["2026-04-06", "2026-04-07", "2026-04-08"];

  it("slotPlansInWeek はその週の日付ぶんだけ返す", () => {
    const other = { ...test31, date: "2026-04-13" };
    expect(slotPlansInWeek([test31, insert41, other], week)).toEqual([test31, insert41]);
  });

  it("clearSlotPlansInWeek はその週だけ消し、他の週は残す", () => {
    const other = { ...test31, date: "2026-04-13" };
    expect(clearSlotPlansInWeek([test31, insert41, other], week)).toEqual([other]);
  });
});
