import { describe, expect, it } from "vitest";
import {
  applyPlanRows,
  buildPlanRows,
  countFilled,
  mergeLessonPlans,
} from "@/lib/lessonPlan";
import type { AnnualPlan, LessonMaster, LessonPlan } from "@/types";

const PACK = "test.grade3";

function master(unit: string, no: number, title: string, content: string): LessonMaster {
  return {
    pack_id: PACK,
    unit_name: unit,
    lesson_no: no,
    total_hours: 4,
    lesson_title: title,
    content,
    note: "",
  };
}

function plan(unit: string, no: number, title: string, content: string, pack = PACK): LessonPlan {
  return { pack_id: pack, unit_name: unit, lesson_no: no, lesson_title: title, content, note: "" };
}

const annualPlan: AnnualPlan[] = [
  {
    pack_id: PACK, month: 4, series: null, unit_no: 1,
    unit_name: "生き物をさがそう", allocated_hours: 4, standard_hours: 4,
    type: "main", note: "",
  },
  {
    pack_id: PACK, month: 4, series: null, unit_no: null,
    unit_name: "理科のガイダンス", allocated_hours: 1, standard_hours: 1,
    type: "guide", note: "",
  },
  {
    pack_id: PACK, month: 3, series: null, unit_no: null,
    unit_name: "時数なしの単元", allocated_hours: 0, standard_hours: 0,
    type: "review", note: "",
  },
];

describe("mergeLessonPlans", () => {
  it("ユーザーの授業案がパック層を上書きする", () => {
    const merged = mergeLessonPlans(
      [master("生き物をさがそう", 1, "標準タイトル", "標準の内容")],
      [plan("生き物をさがそう", 1, "校庭で虫さがし", "虫めがねの使い方を確認してから校庭へ")],
      PACK
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].lesson_title).toBe("校庭で虫さがし");
    expect(merged[0].content).toBe("虫めがねの使い方を確認してから校庭へ");
  });

  it("パック層に無い本時はユーザー側だけで追加される（マスタ未整備の単元）", () => {
    const merged = mergeLessonPlans([], [plan("電気のはたらき", 3, "回路をつくる", "乾電池と豆電球")], PACK);
    expect(merged).toHaveLength(1);
    expect(merged[0].unit_name).toBe("電気のはたらき");
    expect(merged[0].lesson_no).toBe(3);
  });

  it("空の授業案はパック層を隠さない（未入力と「空にした」を区別する）", () => {
    const merged = mergeLessonPlans(
      [master("生き物をさがそう", 1, "標準タイトル", "標準の内容")],
      [plan("生き物をさがそう", 1, "", "")],
      PACK
    );
    expect(merged[0].lesson_title).toBe("標準タイトル");
  });

  it("別パックの授業案は混ざらない", () => {
    const merged = mergeLessonPlans(
      [master("生き物をさがそう", 1, "標準", "標準")],
      [plan("生き物をさがそう", 1, "4年の案", "混ざってはいけない", "test.grade4")],
      PACK
    );
    expect(merged[0].lesson_title).toBe("標準");
  });

  it("パック層の total_hours を引き継ぐ（無ければ 0）", () => {
    const withBase = mergeLessonPlans(
      [master("生き物をさがそう", 1, "", "")],
      [plan("生き物をさがそう", 1, "T", "C")],
      PACK
    );
    expect(withBase[0].total_hours).toBe(4);

    const noBase = mergeLessonPlans([], [plan("電気のはたらき", 1, "T", "C")], PACK);
    expect(noBase[0].total_hours).toBe(0);
  });

  it("単元名・本時順に並ぶ", () => {
    const merged = mergeLessonPlans(
      [],
      [plan("B単元", 1, "b1", "x"), plan("A単元", 2, "a2", "x"), plan("A単元", 1, "a1", "x")],
      PACK
    );
    expect(merged.map((m) => `${m.unit_name}${m.lesson_no}`)).toEqual([
      "A単元1", "A単元2", "B単元1",
    ]);
  });
});

describe("buildPlanRows", () => {
  it("行数は AnnualPlan.allocated_hours が決める", () => {
    const rows = buildPlanRows("生き物をさがそう", PACK, annualPlan, [], []);
    expect(rows).toHaveLength(4);
    expect(rows.map((r) => r.lesson_no)).toEqual([1, 2, 3, 4]);
  });

  it("配当0時間の単元は行を作らない", () => {
    expect(buildPlanRows("時数なしの単元", PACK, annualPlan, [], [])).toHaveLength(0);
  });

  it("年間計画に無い単元は行を作らない", () => {
    expect(buildPlanRows("存在しない単元", PACK, annualPlan, [], [])).toHaveLength(0);
  });

  it("ユーザー案 → パック標準 → 空 の順に初期値が入る", () => {
    const rows = buildPlanRows(
      "生き物をさがそう",
      PACK,
      annualPlan,
      [master("生き物をさがそう", 2, "標準2", "標準内容2")],
      [plan("生き物をさがそう", 1, "自分の案1", "自分の内容1")]
    );
    expect(rows[0].lesson_title).toBe("自分の案1"); // ユーザー案
    expect(rows[1].lesson_title).toBe("標準2"); // パック標準
    expect(rows[2].lesson_title).toBe(""); // どちらも無い
  });
});

describe("applyPlanRows", () => {
  it("編集した単元だけ差し替え、他の単元は残る", () => {
    const existing = [
      plan("たねをまこう", 1, "残る", "残る内容"),
      plan("生き物をさがそう", 1, "古い", "古い内容"),
    ];
    const rows = [plan("生き物をさがそう", 1, "新しい", "新しい内容")];
    const next = applyPlanRows(existing, rows, "生き物をさがそう", PACK);

    expect(next).toHaveLength(2);
    expect(next.find((p) => p.unit_name === "たねをまこう")?.lesson_title).toBe("残る");
    expect(next.find((p) => p.unit_name === "生き物をさがそう")?.lesson_title).toBe("新しい");
  });

  it("空にした行は保存されない（消したら消えたままになる）", () => {
    const existing = [plan("生き物をさがそう", 1, "消す", "消す")];
    const next = applyPlanRows(existing, [plan("生き物をさがそう", 1, "", "")], "生き物をさがそう", PACK);
    expect(next).toHaveLength(0);
  });

  it("別パックの同名単元は消さない", () => {
    const existing = [plan("春の生き物", 1, "4年の案", "残る", "test.grade4")];
    const next = applyPlanRows(existing, [], "春の生き物", PACK);
    expect(next).toHaveLength(1);
    expect(next[0].pack_id).toBe("test.grade4");
  });
});

describe("countFilled", () => {
  it("ユーザー案とパック標準を重複なく数える", () => {
    const filled = countFilled(
      "生き物をさがそう",
      PACK,
      [plan("生き物をさがそう", 1, "自分の案", "内容")],
      [
        master("生き物をさがそう", 1, "標準1", "標準"), // ユーザー案があるので二重に数えない
        master("生き物をさがそう", 2, "標準2", "標準"),
        master("生き物をさがそう", 3, "", ""), // 空は数えない
      ]
    );
    expect(filled).toBe(2);
  });

  it("何も無ければ 0", () => {
    expect(countFilled("生き物をさがそう", PACK, [], [])).toBe(0);
  });
});
