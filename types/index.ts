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
// 4. アーカイブ・エクスポート
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
      archive_meta?: ArchiveMetadata;
      archived_weeks?: ArchivedWeek[];
    };
  };
}
