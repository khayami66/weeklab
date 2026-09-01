import type {
  GradeLevel,
  GradeThreshold,
  HealthLevel,
  StudentGrade,
  TestMaster,
  TestResult,
  TestScore,
  ViewPoint,
  ViewPointResult,
  ViewpointBalance,
} from "@/types";

/**
 * 成績処理の純粋関数層（grading_design.md §4）。
 *
 * 設計上の要点：
 * - 未受験は null。0点と区別し、通算の分子・分母の両方から除外する
 * - 学期評定は「合計点 ÷ 合計満点」の通算得点率に閾値を当てて決める
 *   （単元ごとに A/B/C を出して多数決する方式は採らない）
 * - 閾値は固定値ではなく GradeThreshold で外から渡す
 * - 名簿は持たず、出席番号 1..ROSTER_ROWS を機械的に走査する。
 *   在籍していない番号は「全テスト未受験」として自然に判定不能になる
 */

/** 小学校の学級編制標準が35人のため、全クラス一律35行とする */
export const ROSTER_ROWS = 35;

/** 閾値の初期値（%）。設定画面で変更される */
export const DEFAULT_A_MIN = 90;
export const DEFAULT_B_MIN = 60;

/** 観点の偏り判定の閾値（パーセントポイント） */
export const BALANCE_WARN_PT = 10;
export const BALANCE_ALERT_PT = 20;

/** テストで測る観点。attitude はペーパーテストでは測れないため含めない */
export const SCORED_VIEWPOINTS: ViewPoint[] = ["knowledge", "thinking"];

/**
 * 得点率と閾値(%)を比較するときの許容誤差。
 * 45/50 のような値は二進小数で厳密に 0.9 にならず、
 * ちょうど閾値の児童が1つ下の評定に落ちる事故が起きるため。
 */
const RATE_EPSILON = 1e-9;

/** 閾値の既定値を全観点分つくる */
export function defaultThresholds(): GradeThreshold[] {
  return SCORED_VIEWPOINTS.map((viewpoint) => ({
    viewpoint,
    a_min: DEFAULT_A_MIN,
    b_min: DEFAULT_B_MIN,
  }));
}

/**
 * 得点率（0-1）に閾値を当てて A/B/C を返す。
 * b_min 未満が C。
 */
export function judgeGrade(rate: number, threshold: GradeThreshold): GradeLevel {
  const pct = rate * 100;
  if (pct + RATE_EPSILON >= threshold.a_min) return "A";
  if (pct + RATE_EPSILON >= threshold.b_min) return "B";
  return "C";
}

/**
 * 集計期間で TestResult を絞る（実施日ベース、両端を含む）。
 * "YYYY-MM-DD" は辞書順と日付順が一致するので文字列比較で足りる。
 */
export function filterResultsByPeriod(
  results: TestResult[],
  from: string,
  to: string
): TestResult[] {
  return results.filter((r) => r.conducted_on >= from && r.conducted_on <= to);
}

/**
 * 1人分の観点別通算と判定を出す。
 *
 * 各観点について、対象クラスの全テストを走査して
 *   earned = Σ(受験したテストの得点)
 *   max    = Σ(受験したテストの満点)
 * を積み、rate = earned / max に閾値を当てる。
 *
 * 除外されるもの（分子・分母の両方から）：
 *   - 未受験（score が null、または当該児童の行が存在しない）
 *   - その観点の出題がないテスト（master の満点が 0）
 *   - テストマスタが未登録の TestResult
 */
export function computeStudentGrade(
  class_code: string,
  student_no: number,
  results: TestResult[],
  masters: TestMaster[],
  thresholds: GradeThreshold[]
): StudentGrade {
  const masterById = new Map(masters.map((m) => [m.test_id, m]));
  const classResults = results.filter((r) => r.class_code === class_code);

  const by_viewpoint = SCORED_VIEWPOINTS.map((vp) =>
    tallyViewPoint(vp, student_no, classResults, masterById, thresholds)
  );

  return { class_code, student_no, by_viewpoint };
}

/**
 * クラス全員分。出席番号 1..ROSTER_ROWS を機械的に返す。
 *
 * 在籍していない番号も「判定不能」として返るので、
 * 分布・平均・偏り分析に使う前に isEnrolled で絞ること。
 */
export function computeClassGrades(
  class_code: string,
  results: TestResult[],
  masters: TestMaster[],
  thresholds: GradeThreshold[]
): StudentGrade[] {
  const masterById = new Map(masters.map((m) => [m.test_id, m]));
  const classResults = results.filter((r) => r.class_code === class_code);

  const grades: StudentGrade[] = [];
  for (let student_no = 1; student_no <= ROSTER_ROWS; student_no++) {
    grades.push({
      class_code,
      student_no,
      by_viewpoint: SCORED_VIEWPOINTS.map((vp) =>
        tallyViewPoint(vp, student_no, classResults, masterById, thresholds)
      ),
    });
  }
  return grades;
}

/**
 * その出席番号に児童が在籍しているか。
 * 得点が1つでも入っていれば在籍とみなす（名簿を持たないため、これが唯一の判断材料）。
 */
export function isEnrolled(grade: StudentGrade): boolean {
  return grade.by_viewpoint.some((v) => v.test_count > 0);
}

/** 観点別の A/B/C 件数を数える（在籍者のみ・判定不能は数えない） */
export function countGradeDistribution(
  grades: StudentGrade[],
  viewpoint: ViewPoint
): { A: number; B: number; C: number; unjudged: number } {
  const dist = { A: 0, B: 0, C: 0, unjudged: 0 };
  for (const g of grades) {
    if (!isEnrolled(g)) continue;
    const vp = g.by_viewpoint.find((v) => v.viewpoint === viewpoint);
    if (!vp || vp.grade === null) {
      dist.unjudged += 1;
      continue;
    }
    dist[vp.grade] += 1;
  }
  return dist;
}

/**
 * 観点の偏りを出す。先頭がクラス単位、以降が児童単位。
 *
 * クラス単位の得点率は在籍者の Σearned / Σmax（通算方式）。
 * 児童ごとの得点率を単純平均すると、受験数の少ない転入児童が
 * 同じ重みで効いてしまうため。
 *
 * 「要注目の児童」の絞り込み（例：20pt 以上）は UI 側で level を見て行う。
 */
export function computeViewpointBalance(grades: StudentGrade[]): ViewpointBalance[] {
  const enrolled = grades.filter(isEnrolled);
  if (enrolled.length === 0) return [];

  const class_code = enrolled[0].class_code;
  const balances: ViewpointBalance[] = [
    buildBalance(
      "class",
      class_code,
      null,
      pooledRate(enrolled, "knowledge"),
      pooledRate(enrolled, "thinking")
    ),
  ];

  for (const g of enrolled) {
    balances.push(
      buildBalance(
        "student",
        g.class_code,
        g.student_no,
        rateOf(g, "knowledge"),
        rateOf(g, "thinking")
      )
    );
  }

  return balances;
}

// ================================================================
// 内部ヘルパー
// ================================================================

function tallyViewPoint(
  viewpoint: ViewPoint,
  student_no: number,
  classResults: TestResult[],
  masterById: Map<string, TestMaster>,
  thresholds: GradeThreshold[]
): ViewPointResult {
  let earned = 0;
  let max = 0;
  let test_count = 0;

  for (const result of classResults) {
    const master = masterById.get(result.test_id);
    if (!master) continue; // マスタ未登録のデータは集計しない

    const full = maxScoreFor(master, viewpoint);
    if (full <= 0) continue; // その観点の出題がないテスト

    const score = result.scores.find((s) => s.student_no === student_no);
    const value = score ? scoreFor(score, viewpoint) : null;
    if (value === null) continue; // 未受験：分子・分母の両方から除外

    earned += value;
    max += full;
    test_count += 1;
  }

  const rate = max > 0 ? earned / max : null;
  const threshold = findThreshold(thresholds, viewpoint);

  return {
    viewpoint,
    earned,
    max,
    rate,
    grade: rate === null ? null : judgeGrade(rate, threshold),
    test_count,
  };
}

function maxScoreFor(master: TestMaster, viewpoint: ViewPoint): number {
  if (viewpoint === "knowledge") return master.max_knowledge;
  if (viewpoint === "thinking") return master.max_thinking;
  return 0; // attitude はテストで測らない
}

function scoreFor(score: TestScore, viewpoint: ViewPoint): number | null {
  if (viewpoint === "knowledge") return score.knowledge;
  if (viewpoint === "thinking") return score.thinking;
  return null;
}

function findThreshold(thresholds: GradeThreshold[], viewpoint: ViewPoint): GradeThreshold {
  return (
    thresholds.find((t) => t.viewpoint === viewpoint) ?? {
      viewpoint,
      a_min: DEFAULT_A_MIN,
      b_min: DEFAULT_B_MIN,
    }
  );
}

/** 在籍者全体の Σearned / Σmax。分母が 0 なら null */
function pooledRate(grades: StudentGrade[], viewpoint: ViewPoint): number | null {
  let earned = 0;
  let max = 0;
  for (const g of grades) {
    const vp = g.by_viewpoint.find((v) => v.viewpoint === viewpoint);
    if (!vp) continue;
    earned += vp.earned;
    max += vp.max;
  }
  return max > 0 ? earned / max : null;
}

function rateOf(grade: StudentGrade, viewpoint: ViewPoint): number | null {
  return grade.by_viewpoint.find((v) => v.viewpoint === viewpoint)?.rate ?? null;
}

function buildBalance(
  scope: "class" | "student",
  class_code: string,
  student_no: number | null,
  knowledge_rate: number | null,
  thinking_rate: number | null
): ViewpointBalance {
  if (knowledge_rate === null || thinking_rate === null) {
    return {
      scope,
      class_code,
      student_no,
      knowledge_rate,
      thinking_rate,
      gap: null,
      level: "ok",
      message: "比較できません（片方の観点に得点がありません）",
    };
  }

  // 表示値と判定を必ず一致させるため、丸めてから閾値に当てる。
  // 0.9 - 0.8 が -9.999999999999998 になるような誤差で
  // 「-10.0pt と表示されているのに ok」という食い違いが起きるのを防ぐ。
  const gap = round1((thinking_rate - knowledge_rate) * 100);
  const absGap = Math.abs(gap);
  const level: HealthLevel =
    absGap < BALANCE_WARN_PT ? "ok" : absGap < BALANCE_ALERT_PT ? "warn" : "alert";

  return {
    scope,
    class_code,
    student_no,
    knowledge_rate,
    thinking_rate,
    gap,
    level,
    message: buildBalanceMessage(gap, level),
  };
}

function buildBalanceMessage(gap: number, level: HealthLevel): string {
  if (level === "ok") return "観点の偏りは小さいです";
  const pt = round1(Math.abs(gap));
  const weak = gap < 0 ? "思考・判断・表現" : "知識・技能";
  return level === "warn"
    ? `${weak}が ${pt}pt 低めです`
    : `${weak}が ${pt}pt 低いです（要確認）`;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
