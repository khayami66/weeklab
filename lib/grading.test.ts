import { describe, expect, it } from "vitest";
import {
  BALANCE_ALERT_PT,
  BALANCE_WARN_PT,
  ROSTER_ROWS,
  computeClassGrades,
  computeStudentGrade,
  computeViewpointBalance,
  countGradeDistribution,
  defaultThresholds,
  filterResultsByPeriod,
  isEnrolled,
  judgeGrade,
} from "./grading";
import type { GradeThreshold, StudentGrade, TestMaster, TestResult, ViewPoint } from "@/types";

// ================================================================
// フィクスチャ
// ================================================================

/** テストマスタを1件つくる（k = 知識・技能の満点、t = 思考・判断・表現の満点） */
function master(test_id: string, k: number, t: number): TestMaster {
  return {
    test_id,
    pack_id: "test.grade3",
    unit_name: test_id,
    test_name: test_id,
    max_knowledge: k,
    max_thinking: t,
    note: "",
  };
}

/**
 * 実施記録を1件つくる。
 * scores は [出席番号, 知識・技能, 思考・判断・表現] の配列。null は未受験。
 */
function result(
  test_id: string,
  class_code: string,
  conducted_on: string,
  scores: [number, number | null, number | null][]
): TestResult {
  return {
    test_id,
    class_code,
    conducted_on,
    scores: scores.map(([student_no, knowledge, thinking]) => ({
      student_no,
      knowledge,
      thinking,
    })),
  };
}

/** 90/60 の既定閾値 */
const th = defaultThresholds();

function vp(grade: StudentGrade, viewpoint: ViewPoint) {
  const found = grade.by_viewpoint.find((v) => v.viewpoint === viewpoint);
  if (!found) throw new Error(`viewpoint ${viewpoint} が見つかりません`);
  return found;
}

// ================================================================
// judgeGrade（閾値の境界）
// ================================================================

describe("judgeGrade", () => {
  it("ちょうど90% は A（二進小数の誤差で落ちない）", () => {
    // 分数の形を変えても必ず A になること
    expect(judgeGrade(45 / 50, th[0])).toBe("A");
    expect(judgeGrade(9 / 10, th[0])).toBe("A");
    expect(judgeGrade(27 / 30, th[0])).toBe("A");
    expect(judgeGrade(18 / 20, th[0])).toBe("A");
    expect(judgeGrade(63 / 70, th[0])).toBe("A");
  });

  it("ちょうど60% は B", () => {
    expect(judgeGrade(30 / 50, th[0])).toBe("B");
    expect(judgeGrade(3 / 5, th[0])).toBe("B");
    expect(judgeGrade(27 / 45, th[0])).toBe("B");
  });

  it("89.9% は B、59.9% は C", () => {
    expect(judgeGrade(0.899, th[0])).toBe("B");
    expect(judgeGrade(0.599, th[0])).toBe("C");
  });

  it("0% は C、100% は A", () => {
    expect(judgeGrade(0, th[0])).toBe("C");
    expect(judgeGrade(1, th[0])).toBe("A");
  });

  it("閾値を変えると判定が追随する（90/60 決め打ちでない）", () => {
    const loose: GradeThreshold = { viewpoint: "knowledge", a_min: 80, b_min: 50 };
    expect(judgeGrade(0.85, th[0])).toBe("B"); // 90/60 では B
    expect(judgeGrade(0.85, loose)).toBe("A"); // 80/50 では A
    expect(judgeGrade(0.55, th[0])).toBe("C");
    expect(judgeGrade(0.55, loose)).toBe("B");
  });
});

// ================================================================
// computeStudentGrade（通算のしかた）
// ================================================================

describe("computeStudentGrade", () => {
  const masters = [master("t1", 50, 50), master("t2", 50, 50)];

  it("未受験(null)は分子・分母の両方から除かれる", () => {
    const results = [
      result("t1", "3-1", "2026-05-10", [[1, 40, 30]]),
      result("t2", "3-1", "2026-06-10", [[1, null, null]]),
    ];
    const g = computeStudentGrade("3-1", 1, results, masters, th);
    const k = vp(g, "knowledge");

    // 受験した t1 だけで 40/50 = 80%。0点扱いなら 40/100 = 40% になる
    expect(k.earned).toBe(40);
    expect(k.max).toBe(50);
    expect(k.rate).toBeCloseTo(0.8);
    expect(k.test_count).toBe(1);
    expect(k.grade).toBe("B");
  });

  it("一部のテストだけ受験した児童は、受験した分だけで判定される（転入のケース）", () => {
    const three = [master("t1", 50, 50), master("t2", 50, 50), master("t3", 50, 50)];
    const results = [
      result("t1", "3-1", "2026-05-10", [[1, null, null]]),
      result("t2", "3-1", "2026-06-10", [[1, null, null]]),
      result("t3", "3-1", "2026-07-10", [[1, 46, 45]]),
    ];
    const g = computeStudentGrade("3-1", 1, results, three, th);

    expect(vp(g, "knowledge").test_count).toBe(1);
    expect(vp(g, "knowledge").rate).toBeCloseTo(0.92);
    expect(vp(g, "knowledge").grade).toBe("A");
  });

  it("全テスト未受験なら判定不能（A/B/C を返さない）", () => {
    const results = [result("t1", "3-1", "2026-05-10", [[1, null, null]])];
    const g = computeStudentGrade("3-1", 1, results, masters, th);

    expect(vp(g, "knowledge").max).toBe(0);
    expect(vp(g, "knowledge").rate).toBeNull();
    expect(vp(g, "knowledge").grade).toBeNull();
    expect(isEnrolled(g)).toBe(false);
  });

  it("そもそも行が存在しない出席番号も判定不能（在籍していない番号）", () => {
    const results = [result("t1", "3-1", "2026-05-10", [[1, 40, 40]])];
    const g = computeStudentGrade("3-1", 30, results, masters, th);

    expect(vp(g, "knowledge").rate).toBeNull();
    expect(isEnrolled(g)).toBe(false);
  });

  it("満点の異なるテストが混在しても通算できる", () => {
    const mixed = [master("t1", 50, 50), master("t3", 20, 30)];
    const results = [
      result("t1", "3-1", "2026-05-10", [[1, 40, 40]]),
      result("t3", "3-1", "2026-06-10", [[1, 20, 30]]),
    ];
    const g = computeStudentGrade("3-1", 1, results, mixed, th);

    // 知識：(40+20) / (50+20) = 60/70 ≒ 85.7% → B
    expect(vp(g, "knowledge").earned).toBe(60);
    expect(vp(g, "knowledge").max).toBe(70);
    expect(vp(g, "knowledge").grade).toBe("B");

    // 思考：(40+30) / (50+30) = 70/80 = 87.5% → B
    expect(vp(g, "thinking").earned).toBe(70);
    expect(vp(g, "thinking").max).toBe(80);
    expect(vp(g, "thinking").grade).toBe("B");
  });

  it("片観点のみのテスト（満点0の観点）は、その観点の集計に入らない", () => {
    const oneSided = [master("t1", 50, 50), master("t2", 100, 0)];
    const results = [
      result("t1", "3-1", "2026-05-10", [[1, 45, 45]]),
      // t2 は思考の満点が 0。値が入っていても無視されること
      result("t2", "3-1", "2026-06-10", [[1, 80, 99]]),
    ];
    const g = computeStudentGrade("3-1", 1, results, oneSided, th);

    expect(vp(g, "knowledge").max).toBe(150); // 50 + 100
    expect(vp(g, "knowledge").earned).toBe(125); // 45 + 80
    expect(vp(g, "thinking").max).toBe(50); // t1 のみ
    expect(vp(g, "thinking").earned).toBe(45);
    expect(vp(g, "thinking").test_count).toBe(1);
  });

  it("他クラスの実施記録は集計に混ざらない", () => {
    const results = [
      result("t1", "3-1", "2026-05-10", [[1, 40, 40]]),
      result("t1", "3-2", "2026-05-10", [[1, 10, 10]]),
    ];
    const g = computeStudentGrade("3-1", 1, results, masters, th);

    expect(vp(g, "knowledge").earned).toBe(40);
    expect(vp(g, "knowledge").test_count).toBe(1);
  });

  it("テストマスタが未登録の実施記録は無視する（満点が分からないため）", () => {
    const results = [
      result("t1", "3-1", "2026-05-10", [[1, 40, 40]]),
      result("unknown", "3-1", "2026-06-10", [[1, 99, 99]]),
    ];
    const g = computeStudentGrade("3-1", 1, results, masters, th);

    expect(vp(g, "knowledge").earned).toBe(40);
    expect(vp(g, "knowledge").max).toBe(50);
  });

  it("閾値が渡されない観点は既定値 90/60 で判定する", () => {
    const results = [result("t1", "3-1", "2026-05-10", [[1, 45, 30]])];
    const g = computeStudentGrade("3-1", 1, results, masters, []);

    expect(vp(g, "knowledge").grade).toBe("A"); // 90%
    expect(vp(g, "thinking").grade).toBe("B"); // 60%
  });
});

// ================================================================
// computeClassGrades（35行固定）
// ================================================================

describe("computeClassGrades", () => {
  const masters = [master("t1", 50, 50)];
  const results = [
    result("t1", "3-1", "2026-05-10", [
      [1, 45, 40],
      [2, 30, 25],
      [3, null, null], // 欠席
    ]),
  ];

  it("在籍人数によらず常に35行返す", () => {
    const grades = computeClassGrades("3-1", results, masters, th);
    expect(grades).toHaveLength(ROSTER_ROWS);
    expect(grades[0].student_no).toBe(1);
    expect(grades[ROSTER_ROWS - 1].student_no).toBe(ROSTER_ROWS);
  });

  it("得点のある番号だけが在籍とみなされる", () => {
    const grades = computeClassGrades("3-1", results, masters, th);
    const enrolled = grades.filter(isEnrolled).map((g) => g.student_no);

    // 3番は欠席（null）なので在籍と判定できない。4番以降は行そのものが無い
    expect(enrolled).toEqual([1, 2]);
  });

  it("空行（在籍なし）は判定不能で返る", () => {
    const grades = computeClassGrades("3-1", results, masters, th);
    expect(vp(grades[9], "knowledge").grade).toBeNull();
    expect(vp(grades[9], "knowledge").max).toBe(0);
  });
});

// ================================================================
// countGradeDistribution
// ================================================================

describe("countGradeDistribution", () => {
  it("在籍者だけを数え、空行は分母に入れない", () => {
    const masters = [master("t1", 100, 100)];
    const results = [
      result("t1", "3-1", "2026-05-10", [
        [1, 95, 95], // A
        [2, 90, 90], // A（境界）
        [3, 70, 70], // B
        [4, 30, 30], // C
      ]),
    ];
    const grades = computeClassGrades("3-1", results, masters, th);
    const dist = countGradeDistribution(grades, "knowledge");

    expect(dist).toEqual({ A: 2, B: 1, C: 1, unjudged: 0 });
    // 35行あるうち在籍4名だけが数えられている
    expect(dist.A + dist.B + dist.C + dist.unjudged).toBe(4);
  });

  it("片観点のみ受験した児童は、もう一方の観点で unjudged になる", () => {
    const masters = [master("t1", 100, 0)]; // 思考の出題なし
    const results = [result("t1", "3-1", "2026-05-10", [[1, 95, null]])];
    const grades = computeClassGrades("3-1", results, masters, th);

    expect(countGradeDistribution(grades, "knowledge")).toEqual({
      A: 1,
      B: 0,
      C: 0,
      unjudged: 0,
    });
    expect(countGradeDistribution(grades, "thinking")).toEqual({
      A: 0,
      B: 0,
      C: 0,
      unjudged: 1,
    });
  });
});

// ================================================================
// filterResultsByPeriod
// ================================================================

describe("filterResultsByPeriod", () => {
  const results = [
    result("t1", "3-1", "2026-04-05", []),
    result("t2", "3-1", "2026-04-06", []),
    result("t3", "3-1", "2026-07-15", []),
    result("t4", "3-1", "2026-09-30", []),
    result("t5", "3-1", "2026-10-01", []),
  ];

  it("両端を含む", () => {
    const filtered = filterResultsByPeriod(results, "2026-04-06", "2026-09-30");
    expect(filtered.map((r) => r.test_id)).toEqual(["t2", "t3", "t4"]);
  });

  it("範囲外しかなければ空", () => {
    expect(filterResultsByPeriod(results, "2027-01-01", "2027-03-31")).toHaveLength(0);
  });
});

// ================================================================
// computeViewpointBalance（観点の偏り）
// ================================================================

describe("computeViewpointBalance", () => {
  const masters = [master("t1", 100, 100)];

  it("先頭がクラス単位、以降が児童単位", () => {
    const results = [
      result("t1", "3-1", "2026-05-10", [
        [1, 80, 60],
        [2, 90, 70],
      ]),
    ];
    const grades = computeClassGrades("3-1", results, masters, th);
    const balances = computeViewpointBalance(grades);

    expect(balances).toHaveLength(3); // クラス1 + 児童2
    expect(balances[0].scope).toBe("class");
    expect(balances[0].student_no).toBeNull();
    expect(balances[1].scope).toBe("student");
    expect(balances[1].student_no).toBe(1);
  });

  it("クラスの得点率は在籍者の通算（Σ得点 ÷ Σ満点）", () => {
    const results = [
      result("t1", "3-1", "2026-05-10", [
        [1, 80, 60],
        [2, 90, 70],
      ]),
    ];
    const grades = computeClassGrades("3-1", results, masters, th);
    const klass = computeViewpointBalance(grades)[0];

    expect(klass.knowledge_rate).toBeCloseTo(0.85); // 170/200
    expect(klass.thinking_rate).toBeCloseTo(0.65); // 130/200
    expect(klass.gap).toBe(-20); // 思考が 20pt 低い
  });

  it("思考が弱いと gap は負、知識が弱いと正", () => {
    const weakThinking = computeClassGrades(
      "3-1",
      [result("t1", "3-1", "2026-05-10", [[1, 90, 70]])],
      masters,
      th
    );
    const weakKnowledge = computeClassGrades(
      "3-1",
      [result("t1", "3-1", "2026-05-10", [[1, 70, 90]])],
      masters,
      th
    );

    expect(computeViewpointBalance(weakThinking)[0].gap).toBe(-20);
    expect(computeViewpointBalance(weakThinking)[0].message).toContain("思考・判断・表現");
    expect(computeViewpointBalance(weakKnowledge)[0].gap).toBe(20);
    expect(computeViewpointBalance(weakKnowledge)[0].message).toContain("知識・技能");
  });

  it("level の境界：9pt は ok、10pt は warn、20pt は alert", () => {
    function gapLevel(k: number, t: number) {
      const grades = computeClassGrades(
        "3-1",
        [result("t1", "3-1", "2026-05-10", [[1, k, t]])],
        masters,
        th
      );
      return computeViewpointBalance(grades)[0];
    }

    expect(gapLevel(90, 81).level).toBe("ok"); // -9pt
    expect(gapLevel(90, 80).level).toBe("warn"); // -10pt（境界）
    expect(gapLevel(90, 71).level).toBe("warn"); // -19pt
    expect(gapLevel(90, 70).level).toBe("alert"); // -20pt（境界）
    expect(BALANCE_WARN_PT).toBe(10);
    expect(BALANCE_ALERT_PT).toBe(20);
  });

  it("表示される gap と level が食い違わない（丸めてから判定）", () => {
    // 0.9 - 0.8 は二進小数で -9.999999999999998 になる
    const grades = computeClassGrades(
      "3-1",
      [result("t1", "3-1", "2026-05-10", [[1, 90, 80]])],
      masters,
      th
    );
    const klass = computeViewpointBalance(grades)[0];

    expect(klass.gap).toBe(-10);
    expect(klass.level).toBe("warn"); // -10.0 と表示して ok は矛盾
  });

  it("片方の観点に得点がなければ比較しない", () => {
    const oneSided = [master("t1", 100, 0)];
    const grades = computeClassGrades(
      "3-1",
      [result("t1", "3-1", "2026-05-10", [[1, 90, null]])],
      oneSided,
      th
    );
    const klass = computeViewpointBalance(grades)[0];

    expect(klass.gap).toBeNull();
    expect(klass.thinking_rate).toBeNull();
    expect(klass.message).toContain("比較できません");
  });

  it("在籍者が0名なら空配列", () => {
    const grades = computeClassGrades("3-1", [], masters, th);
    expect(computeViewpointBalance(grades)).toEqual([]);
  });
});

// ================================================================
// defaultThresholds
// ================================================================

describe("defaultThresholds", () => {
  it("テストで測る2観点ぶんを 90/60 で返す（態度は含めない）", () => {
    expect(defaultThresholds()).toEqual([
      { viewpoint: "knowledge", a_min: 90, b_min: 60 },
      { viewpoint: "thinking", a_min: 90, b_min: 60 },
    ]);
  });
});
