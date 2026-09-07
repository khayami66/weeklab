import { describe, expect, it } from "vitest";
import {
  addSlot,
  cancelSlot,
  cancelWholeDay,
  clearWeekOverrides,
  overridesInWeek,
  removeOverride,
  replaceSlot,
} from "@/lib/overrideEdit";
import type { TimetableOverride } from "@/types";

const D = "2026-04-06";

describe("cancelSlot", () => {
  it("休講の差分を1件積む", () => {
    const next = cancelSlot([], D, 2, "3-1", "運動会練習");
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({
      date: D,
      period: 2,
      original_class_code: "3-1",
      new_class_code: null,
      change_type: "cancel",
      memo: "運動会練習",
    });
  });

  it("同じコマを2回休講にしても差分は1件（二重登録しない）", () => {
    let next = cancelSlot([], D, 2, "3-1", "行事");
    next = cancelSlot(next, D, 2, "3-1", "運動会練習");
    expect(next).toHaveLength(1);
    expect(next[0].memo).toBe("運動会練習"); // 後の理由で上書き
  });

  it("別のコマは影響を受けない", () => {
    let next = cancelSlot([], D, 2, "3-1", "行事");
    next = cancelSlot(next, D, 3, "3-2", "行事");
    expect(next).toHaveLength(2);
  });

  it("日付・時限順に並ぶ", () => {
    let next = cancelSlot([], "2026-04-07", 1, "3-1", "x");
    next = cancelSlot(next, D, 5, "3-1", "x");
    next = cancelSlot(next, D, 1, "3-1", "x");
    expect(next.map((o) => `${o.date}:${o.period}`)).toEqual([
      `${D}:1`,
      `${D}:5`,
      "2026-04-07:1",
    ]);
  });
});

describe("addSlot", () => {
  it("追加の差分を積む", () => {
    const next = addSlot([], "2026-04-11", 1, "3-1", "土曜授業");
    expect(next[0]).toMatchObject({
      original_class_code: null,
      new_class_code: "3-1",
      change_type: "add",
    });
  });

  it("同じ日・時限でもクラスが違えば別の差分になる", () => {
    let next = addSlot([], D, 5, "3-1", "");
    next = addSlot(next, D, 5, "3-2", "");
    expect(next).toHaveLength(2);
  });

  it("同じ日・時限・クラスの追加は二重にならない", () => {
    let next = addSlot([], D, 5, "3-1", "1回目");
    next = addSlot(next, D, 5, "3-1", "2回目");
    expect(next).toHaveLength(1);
    expect(next[0].memo).toBe("2回目");
  });
});

describe("replaceSlot", () => {
  it("クラス差し替えの差分を積む", () => {
    const next = replaceSlot([], D, 2, "3-1", "3-2", "入れ替え");
    expect(next[0]).toMatchObject({
      original_class_code: "3-1",
      new_class_code: "3-2",
      change_type: "replace",
    });
  });

  it("同じコマを休講→差し替えにすると、休講は消えて差し替えだけ残る", () => {
    let next = cancelSlot([], D, 2, "3-1", "行事");
    next = replaceSlot(next, D, 2, "3-1", "3-2", "やっぱり入れ替え");
    expect(next).toHaveLength(1);
    expect(next[0].change_type).toBe("replace");
  });
});

describe("removeOverride（元に戻す）", () => {
  it("休講を取り消すと差分が消える", () => {
    const next = removeOverride(cancelSlot([], D, 2, "3-1", "行事"), D, 2, "3-1");
    expect(next).toEqual([]);
  });

  it("追加したコマは new_class_code で識別して取り消せる", () => {
    const next = removeOverride(addSlot([], D, 5, "3-1", ""), D, 5, "3-1");
    expect(next).toEqual([]);
  });

  it("別のコマの差分は残る", () => {
    let ov = cancelSlot([], D, 2, "3-1", "a");
    ov = cancelSlot(ov, D, 3, "3-2", "b");
    const next = removeOverride(ov, D, 2, "3-1");
    expect(next).toHaveLength(1);
    expect(next[0].original_class_code).toBe("3-2");
  });
});

describe("cancelWholeDay", () => {
  it("その日の全コマを休講にする", () => {
    const slots = [
      { period: 1, class_code: "3-1" },
      { period: 3, class_code: "4-1" },
      { period: 5, class_code: "4-2" },
    ];
    const next = cancelWholeDay([], D, slots, "開校記念日");
    expect(next).toHaveLength(3);
    expect(next.every((o) => o.change_type === "cancel")).toBe(true);
    expect(next.every((o) => o.memo === "開校記念日")).toBe(true);
  });

  it("他の日の差分は残る", () => {
    const existing = cancelSlot([], "2026-04-07", 1, "3-1", "別の日");
    const next = cancelWholeDay(existing, D, [{ period: 1, class_code: "3-1" }], "祝日");
    expect(next).toHaveLength(2);
  });

  it("コマが無い日は何も積まない", () => {
    expect(cancelWholeDay([], D, [], "祝日")).toEqual([]);
  });
});

describe("overridesInWeek / clearWeekOverrides", () => {
  const week = ["2026-04-06", "2026-04-07", "2026-04-08"];
  const build = (): TimetableOverride[] => {
    let ov = cancelSlot([], "2026-04-06", 1, "3-1", "a");
    ov = cancelSlot(ov, "2026-04-07", 2, "4-1", "b");
    ov = cancelSlot(ov, "2026-04-20", 1, "3-1", "翌々週");
    return ov;
  };

  it("その週の差分だけ取り出す", () => {
    expect(overridesInWeek(build(), week)).toHaveLength(2);
  });

  it("その週の差分だけまとめて消す（他の週は残る）", () => {
    const next = clearWeekOverrides(build(), week);
    expect(next).toHaveLength(1);
    expect(next[0].date).toBe("2026-04-20");
  });
});
