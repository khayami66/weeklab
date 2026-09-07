import { describe, expect, it } from "vitest";
import { generateWeeklyPlan, getLessonsForDate } from "./weeklyPlan";
import {
  progressG3Start,
  progressG4Start,
  testPacks,
  testSetting,
  testTimetable,
  WEEK1_MONDAY,
} from "./__fixtures__/testData";

describe("generateWeeklyPlan - 基本動作", () => {
  it("第1週：基本時間割から10コマ生成", () => {
    const { plan, summary } = generateWeeklyPlan(
      WEEK1_MONDAY,
      testSetting,
      testTimetable,
      [],
      [progressG3Start, progressG4Start],
      testPacks,
      []
    );
    expect(plan).toHaveLength(10);
    expect(summary.week_no).toBe(1);
    expect(summary.period_from).toBe("2026-04-06");
    expect(summary.period_to).toBe("2026-04-11");
  });

  it("第1週：3-1 は単元A → A1, A2 の順で消化、その後 B1 へ繰り上げ", () => {
    const { plan } = generateWeeklyPlan(
      WEEK1_MONDAY,
      testSetting,
      testTimetable,
      [],
      [progressG3Start, progressG4Start],
      testPacks,
      []
    );
    const g3Plans = plan.filter((p) => p.class_code === "3-1");
    // 月1, 火2, 水1, 木2, 金1 の順で5コマ
    expect(g3Plans).toHaveLength(5);
    expect(g3Plans[0]).toMatchObject({ unit_name: "A", lesson_no: 1, lesson_title: "A1" });
    expect(g3Plans[1]).toMatchObject({ unit_name: "A", lesson_no: 2, lesson_title: "A2" });
    // 単元Aが2時間なので 3コマ目から単元Bへ繰り上げ
    expect(g3Plans[2]).toMatchObject({ unit_name: "B", lesson_no: 1 });
    expect(g3Plans[3]).toMatchObject({ unit_name: "B", lesson_no: 2 });
    expect(g3Plans[4]).toMatchObject({ unit_name: "B", lesson_no: 3 });
  });

  it("LessonMaster 未整備の本時は lesson_title=(未作成)", () => {
    const { plan } = generateWeeklyPlan(
      WEEK1_MONDAY,
      testSetting,
      testTimetable,
      [],
      [progressG3Start, progressG4Start],
      testPacks,
      []
    );
    const g3Plans = plan.filter((p) => p.class_code === "3-1");
    // B1 は lessonMaster の lesson_title="" → "(未作成)"
    expect(g3Plans[2].lesson_title).toBe("(未作成)");
    // B2 / B3 は lessonMaster に登録なし → "(未作成)"
    expect(g3Plans[3].lesson_title).toBe("(未作成)");
    expect(g3Plans[4].lesson_title).toBe("(未作成)");
  });

  it("WeekSummary の class_tallies が正しい", () => {
    const { summary } = generateWeeklyPlan(
      WEEK1_MONDAY,
      testSetting,
      testTimetable,
      [],
      [progressG3Start, progressG4Start],
      testPacks,
      []
    );
    const g3 = summary.class_tallies.find((c) => c.class_code === "3-1")!;
    const g4 = summary.class_tallies.find((c) => c.class_code === "4-1")!;
    expect(g3.weekly_hours).toBe(5);
    expect(g3.cumulative_hours).toBe(5); // 期首から5時間消化
    expect(g4.weekly_hours).toBe(5);
    expect(g4.cumulative_hours).toBe(5);
  });
});

describe("generateWeeklyPlan - TimetableOverride", () => {
  it("cancel で該当コマが削除される", () => {
    const overrides = [
      {
        date: "2026-04-06",
        period: 1,
        original_class_code: "3-1",
        new_class_code: null,
        change_type: "cancel" as const,
        memo: "運動会リハ",
      },
    ];
    const { plan } = generateWeeklyPlan(
      WEEK1_MONDAY,
      testSetting,
      testTimetable,
      overrides,
      [progressG3Start, progressG4Start],
      testPacks,
      []
    );
    const mon1 = plan.find((p) => p.date === "2026-04-06" && p.period === 1);
    expect(mon1).toBeUndefined();
    expect(plan).toHaveLength(9);
  });

  it("replace で class_code が差し替わり、is_override=true になる", () => {
    const overrides = [
      {
        date: "2026-04-06",
        period: 1,
        original_class_code: "3-1",
        new_class_code: "4-1",
        change_type: "replace" as const,
        memo: "振替",
      },
    ];
    const { plan } = generateWeeklyPlan(
      WEEK1_MONDAY,
      testSetting,
      testTimetable,
      overrides,
      [progressG3Start, progressG4Start],
      testPacks,
      []
    );
    const mon1 = plan.find((p) => p.date === "2026-04-06" && p.period === 1)!;
    expect(mon1.class_code).toBe("4-1");
    expect(mon1.is_override).toBe(true);
    expect(mon1.override_memo).toBe("振替");
  });

  it("add で新しいコマが追加される（土曜授業）", () => {
    const overrides = [
      {
        date: "2026-04-11",
        period: 1,
        original_class_code: null,
        new_class_code: "3-1",
        change_type: "add" as const,
        memo: "土曜補講",
      },
    ];
    const { plan } = generateWeeklyPlan(
      WEEK1_MONDAY,
      testSetting,
      testTimetable,
      overrides,
      [progressG3Start, progressG4Start],
      testPacks,
      []
    );
    const sat = plan.find((p) => p.date === "2026-04-11");
    expect(sat).toBeDefined();
    expect(sat!.class_code).toBe("3-1");
    expect(sat!.is_override).toBe(true);
    expect(plan).toHaveLength(11);
  });
});

describe("generateWeeklyPlan - 休講コマ（cancelled）", () => {
  const cancelMon1 = [
    {
      date: "2026-04-06",
      period: 1,
      original_class_code: "3-1",
      new_class_code: null,
      change_type: "cancel" as const,
      memo: "運動会リハ",
    },
  ];

  const run = (overrides: typeof cancelMon1) =>
    generateWeeklyPlan(
      WEEK1_MONDAY,
      testSetting,
      testTimetable,
      overrides,
      [progressG3Start, progressG4Start],
      testPacks,
      []
    );

  it("休講コマは cancelled に理由つきで入る", () => {
    const { cancelled } = run(cancelMon1);
    expect(cancelled).toHaveLength(1);
    expect(cancelled[0]).toMatchObject({
      date: "2026-04-06",
      period: 1,
      class_code: "3-1",
      reason: "運動会リハ",
    });
  });

  it("休講コマは plan に入らない＝週実施時数が増えない（時数の過大計上を防ぐ）", () => {
    const { plan: before, summary: sBefore } = run([]);
    const { plan: after, summary: sAfter } = run(cancelMon1);

    // plan の件数が1つ減る
    expect(after).toHaveLength(before.length - 1);

    // 3-1 の週実施時数がちょうど1減る（他クラスは変わらない）
    const weekly = (s: typeof sBefore, code: string) =>
      s.class_tallies.find((t) => t.class_code === code)!.weekly_hours;
    expect(weekly(sAfter, "3-1")).toBe(weekly(sBefore, "3-1") - 1);
    expect(weekly(sAfter, "4-1")).toBe(weekly(sBefore, "4-1"));
  });

  it("休講が無ければ cancelled は空", () => {
    expect(run([]).cancelled).toEqual([]);
  });

  it("replace / add では cancelled に入らない", () => {
    const { cancelled: rep } = generateWeeklyPlan(
      WEEK1_MONDAY, testSetting, testTimetable,
      [{ date: "2026-04-06", period: 1, original_class_code: "3-1",
         new_class_code: "4-1", change_type: "replace" as const, memo: "振替" }],
      [progressG3Start, progressG4Start], testPacks, []
    );
    expect(rep).toEqual([]);

    const { cancelled: add } = generateWeeklyPlan(
      WEEK1_MONDAY, testSetting, testTimetable,
      [{ date: "2026-04-11", period: 1, original_class_code: null,
         new_class_code: "3-1", change_type: "add" as const, memo: "土曜補講" }],
      [progressG3Start, progressG4Start], testPacks, []
    );
    expect(add).toEqual([]);
  });

  it("同じ日に cancel と add が混在しても、それぞれ正しい配列に入る", () => {
    const { plan, cancelled } = generateWeeklyPlan(
      WEEK1_MONDAY,
      testSetting,
      testTimetable,
      [
        { date: "2026-04-06", period: 1, original_class_code: "3-1",
          new_class_code: null, change_type: "cancel" as const, memo: "行事" },
        { date: "2026-04-06", period: 5, original_class_code: null,
          new_class_code: "3-1", change_type: "add" as const, memo: "振替先" },
      ],
      [progressG3Start, progressG4Start],
      testPacks,
      []
    );
    expect(cancelled).toHaveLength(1);
    expect(cancelled[0].period).toBe(1);
    expect(plan.find((p) => p.date === "2026-04-06" && p.period === 1)).toBeUndefined();
    expect(plan.find((p) => p.date === "2026-04-06" && p.period === 5)).toBeDefined();
  });

  it("cancelled は日付・時限順に並ぶ", () => {
    const { cancelled } = generateWeeklyPlan(
      WEEK1_MONDAY,
      testSetting,
      testTimetable,
      [
        { date: "2026-04-07", period: 1, original_class_code: "4-1",
          new_class_code: null, change_type: "cancel" as const, memo: "b" },
        { date: "2026-04-06", period: 2, original_class_code: "4-1",
          new_class_code: null, change_type: "cancel" as const, memo: "a" },
      ],
      [progressG3Start, progressG4Start],
      testPacks,
      []
    );
    expect(cancelled.map((c) => `${c.date}:${c.period}`)).toEqual([
      "2026-04-06:2",
      "2026-04-07:1",
    ]);
  });
});

describe("generateWeeklyPlan - 先頭コマ確定", () => {
  it("firstLessonConfirms で指定された単元・本時から始まる", () => {
    const { plan } = generateWeeklyPlan(
      WEEK1_MONDAY,
      testSetting,
      testTimetable,
      [],
      [progressG3Start, progressG4Start],
      testPacks,
      [{ class_code: "3-1", unit_name: "B", lesson_no: 2 }]
    );
    const g3Plans = plan.filter((p) => p.class_code === "3-1");
    // 確定：B2 から開始
    expect(g3Plans[0]).toMatchObject({ unit_name: "B", lesson_no: 2 });
    expect(g3Plans[1]).toMatchObject({ unit_name: "B", lesson_no: 3 });
    // B は3時間なので3コマ目以降は計画完了
    expect(g3Plans[2].lesson_title).toBe("(計画完了)");
  });
});

describe("getLessonsForDate", () => {
  it("月曜日のコマのみを返す（月〜金全体から絞り込み）", () => {
    const monday = new Date(2026, 3, 6);
    const lessons = getLessonsForDate(
      monday,
      testSetting,
      testTimetable,
      [],
      [progressG3Start, progressG4Start],
      testPacks,
      []
    );
    expect(lessons).toHaveLength(2);
    expect(lessons.every((l) => l.date === "2026-04-06")).toBe(true);
  });
});
