/**
 * Weeklab 型定義（data_model.md と同期）
 *
 * 構成：
 *   1. カリキュラムパック層（共有資産）
 *   2. 教員個人設定層（年度ごとに独立）
 *   3. 派生・運用データ
 *   4. アーカイブ・エクスポート
 */

// ============================================================
// 1. カリキュラムパック層
// ============================================================

export interface CurriculumPack {
  id: string; // "keirinkan.science.grade3"
  publisher: string; // "keirinkan"
  publisher_label: string; // "啓林館"
  subject: string; // "science"
  subject_label: string; // "理科"
  grade: number;
  year: number; // 教科書発行年度（MVP: 2024 = 令和6年）
}

export type UnitType = "main" | "sub" | "guide" | "project" | "review";

export interface AnnualPlan {
  pack_id: string;
  month: number;
  series: string | null;
  unit_no: number | null;
  unit_name: string;
  allocated_hours: number;
  standard_hours: number;
  type: UnitType;
  note: string;
}

export interface LessonMaster {
  pack_id: string;
  unit_name: string;
  lesson_no: number;
  total_hours: number;
  lesson_title: string;
  content: string;
  note: string;
}

// ============================================================
// 2. 教員個人設定層
// ============================================================

export interface GradeConfig {
  grade: number; // 3, 4 など
  class_count: number; // そのクラスの組数
  pack_id: string; // "keirinkan.science.grade3"
}

/**
 * 教員のタイプ。将来の担任対応を見越して型のみ先に確保。
 * - specialist: 専科教員（MVP対象）。時間割でコマごとに「クラス」を選ぶ
 * - homeroom : 担任教員（将来）。時間割でコマごとに「教科」を選ぶ
 */
export type TeacherType = "specialist" | "homeroom";

export interface TeacherSetting {
  school_year: number; // 例：2026
  school_name: string;
  teacher_name: string;
  teacher_type: TeacherType;
  start_date: string; // "YYYY-MM-DD"
  grade_configs: GradeConfig[];
}

/**
 * 使用中のパックID一覧を grade_configs から派生
 * （Single Source of Truth: active_packs フィールドは持たない）
 */
export function getActivePacks(setting: TeacherSetting): string[] {
  return [...new Set(setting.grade_configs.map((g) => g.pack_id))];
}

export type Weekday = "月" | "火" | "水" | "木" | "金" | "土";

export interface Timetable {
  day: Weekday;
  weekday_order: 1 | 2 | 3 | 4 | 5 | 6;
  period: number;
  class_code: string; // "3-1" 形式
  grade: number;
  class_number: number;
  subject: "理科";
  note: string;
}

export type OverrideType = "cancel" | "replace" | "add";

export interface TimetableOverride {
  date: string; // "YYYY-MM-DD"
  period: number;
  original_class_code: string | null;
  new_class_code: string | null;
  change_type: OverrideType;
  memo: string;
}

export interface ClassProgress {
  class_code: string;
  grade: number;
  pack_id: string;
  current_unit_name: string;
  completed_hours: number; // 当該単元内
  total_completed_hours: number; // 年度開始からの累計
  memo: string;
}

/**
 * ユーザーが編集する「実際にやる授業案」（1時間分）。
 *
 * パック層の `LessonMaster`（教科書ベースの標準案・全国共有）を**上書きする**。
 * 基本時間割に対する `TimetableOverride`、教科書に対する `TestMaster` と同じ考え方で、
 * **共有できる標準はパック層に、その学校・その教員の実際はユーザー層に**置く。
 *
 * これがないと、地域性・手元の教材・「教科書通りだとつまらない」への対応が
 * パック層（他校と共有する資産）を汚すことになる。
 *
 * `total_hours` は持たない。単元の時数は `AnnualPlan.allocated_hours` が正本であり、
 * ここに重複して持つと食い違いが起きるため。
 */
export interface LessonPlan {
  pack_id: string;
  unit_name: string;
  lesson_no: number; // 単元内の何時間目か（1始まり）
  lesson_title: string;
  content: string; // 週案の1セルに収まる1〜2行
  note: string;
}

export interface FirstLessonConfirm {
  class_code: string;
  unit_name: string;
  lesson_no: number; // 本時（1始まり）
}

// ============================================================
// 3. 派生・運用データ
// ============================================================

export interface WeeklyPlan {
  date: string;
  weekday: Weekday;
  period: number;
  class_code: string;
  grade: number;
  unit_name: string;
  lesson_no: number;
  total_hours: number;
  lesson_title: string;
  content: string;
  memo: string;
  is_override: boolean;
  override_memo: string;
}

export interface ClassTally {
  class_code: string;
  weekly_hours: number;
  cumulative_hours: number;
}

export interface WeekSummary {
  week_no: number;
  period_from: string;
  period_to: string;
  class_tallies: ClassTally[];
}

export type HealthLevel = "ok" | "warn" | "alert";

export interface ProgressHealth {
  class_code: string;
  expected_cumulative: number;
  actual_cumulative: number;
  diff: number; // actual - expected（正：進みすぎ、負：遅れ）
  level: HealthLevel;
  message: string;
}

export interface MonthlyClassTally {
  class_code: string;
  by_unit: { unit_name: string; hours: number }[];
  total_hours: number;
}

export interface MonthlySummary {
  year: number;
  month: number; // 1-12
  class_tallies: MonthlyClassTally[];
}

// ============================================================
// 4. 成績層（grading_design.md）
// ============================================================

/**
 * 評価の観点。
 * - knowledge: 知識・技能
 * - thinking : 思考・判断・表現
 * - attitude : 主体的に学習に取り組む態度
 *              （ペーパーテストでは測れないため MVP では未使用。型のみ確保）
 */
export type ViewPoint = "knowledge" | "thinking" | "attitude";

export type GradeLevel = "A" | "B" | "C";

/**
 * 業者の単元テストの定義。単元（AnnualPlan.unit_name）に紐づく。
 * max_* が 0 の観点は「そのテストでは出題されない」ことを表す。
 *
 * 採択は学校ごとのローカル事情なので、全国共有資産である
 * カリキュラムパックには含めず、ユーザーデータとして持つ。
 */
export interface TestMaster {
  test_id: string; // "keirinkan.science.grade3.kaze-gomu"
  pack_id: string; // "keirinkan.science.grade3"
  /**
   * 紐づく単元名（`AnnualPlan.unit_name` と一致させる）。
   * **空文字を許す。**「1学期のまとめ」のように複数単元にまたがるテストは
   * 単元に紐づけない。空のテストは、将来の
   * 「配当時数 × 単元ごとの結果」の突合分析の対象外になる。
   */
  unit_name: string;
  test_name: string;
  max_knowledge: number; // 知識・技能の満点（0 = 出題なし）
  max_thinking: number; // 思考・判断・表現の満点（0 = 出題なし）
  note: string;
}

/**
 * 1人・1テスト分の得点。
 * 未受験は null。0点と区別し、通算の分子・分母の両方から除外する。
 */
export interface TestScore {
  student_no: number; // 出席番号
  knowledge: number | null;
  thinking: number | null;
}

/** 1クラス・1テスト分の実施記録 */
export interface TestResult {
  test_id: string;
  class_code: string;
  conducted_on: string; // "YYYY-MM-DD" 実施日。集計期間の判定に使う
  scores: TestScore[];
}

/** 観点ごとの A/B/C 判定閾値（%）。固定値ではなく設定画面で変更する */
export interface GradeThreshold {
  viewpoint: ViewPoint;
  a_min: number; // A の下限（%）初期値 90
  b_min: number; // B の下限（%）初期値 60。これ未満が C
}

/** 1観点分の通算結果。max が 0（＝全テスト未受験・出題なし）なら判定不能 */
export interface ViewPointResult {
  viewpoint: ViewPoint;
  earned: number; // 通算獲得点
  max: number; // 通算満点（未受験分を除く）
  rate: number | null; // earned / max（0-1）。max === 0 なら null
  grade: GradeLevel | null; // 判定不能なら null（画面では "—"）
  test_count: number; // 通算に含めたテスト数
}

export interface StudentGrade {
  class_code: string;
  student_no: number;
  by_viewpoint: ViewPointResult[];
}

/**
 * 観点の偏り。既存の ProgressHealth と同じ形（level + message）にそろえる。
 * gap は**パーセントポイント**で、負なら思考・判断・表現が弱い。
 */
export interface ViewpointBalance {
  scope: "class" | "student";
  class_code: string;
  student_no: number | null; // scope === "class" なら null
  knowledge_rate: number | null; // 得点率（0-1）
  thinking_rate: number | null;
  gap: number | null; // (thinking - knowledge) × 100 pt。片方が null なら null
  level: HealthLevel;
  message: string;
}

// ============================================================
// 5. アーカイブ・エクスポート
// ============================================================

export interface ArchivedWeek {
  school_year: number;
  week_no: number;
  period_from: string;
  period_to: string;
  plans: WeeklyPlan[];
  summary: WeekSummary;
  archived_at: string; // ISO datetime
}

export interface ArchiveMetadata {
  school_year: number;
  school_name: string;
  teacher_name: string;
  packs_used: string[];
  total_weeks: number;
  archived_at: string;
}

export interface FullSnapshot {
  version: "1.0";
  exported_at: string;
  current_year: number;
  years: {
    [year: number]: {
      setting: TeacherSetting;
      timetable: Timetable[];
      overrides: TimetableOverride[];
      class_progress: ClassProgress[];
      memos: Record<string, string>; // key → memo text
      first_lesson_confirms: Record<string, FirstLessonConfirm[]>; // monday_date → confirms[]
      /**
       * 実施済みに確定した週（monday_date の配列）。
       * 既存のエクスポートJSONと後方互換にするため optional。
       */
      confirmed_weeks?: string[];
      /** ユーザーが編集した授業案。パック層の LessonMaster を上書きする */
      lesson_plans?: LessonPlan[];
      // ── 成績層（v1.6 追加）──
      // 既存のエクスポートJSONには存在しないため optional。
      // インポート側は欠けていても壊れないこと。
      test_masters?: TestMaster[];
      grade_thresholds?: GradeThreshold[];
      test_results?: TestResult[];
      archive_meta?: ArchiveMetadata;
      archived_weeks?: ArchivedWeek[];
    };
  };
}
