import type {
  AnnualPlan,
  ClassProgress,
  LessonMaster,
  TeacherSetting,
  Timetable,
} from "@/types";

/**
 * テスト用の最小フィクスチャ。実プロジェクトのカリキュラムデータを使わず、
 * 期待値のコントロールを容易にするため単純化してある。
 */

export const testSetting: TeacherSetting = {
  school_year: 2026,
  school_name: "テスト小学校",
  teacher_name: "テスト教員",
  start_date: "2026-04-06",
  grade_configs: [
    { grade: 3, class_count: 1, pack_id: "test.grade3" },
    { grade: 4, class_count: 1, pack_id: "test.grade4" },
  ],
};

// 3年：単元A(2時間) → 単元B(3時間)、5時間全体
export const g3AnnualPlan: AnnualPlan[] = [
  {
    pack_id: "test.grade3",
    month: 4,
    series: null,
    unit_no: 1,
    unit_name: "A",
    allocated_hours: 2,
    standard_hours: 2,
    type: "main",
    note: "",
  },
  {
    pack_id: "test.grade3",
    month: 4,
    series: null,
    unit_no: 2,
    unit_name: "B",
    allocated_hours: 3,
    standard_hours: 3,
    type: "main",
    note: "",
  },
];

export const g3LessonMaster: LessonMaster[] = [
  { pack_id: "test.grade3", unit_name: "A", lesson_no: 1, total_hours: 2, lesson_title: "A1", content: "Ac1", note: "" },
  { pack_id: "test.grade3", unit_name: "A", lesson_no: 2, total_hours: 2, lesson_title: "A2", content: "Ac2", note: "" },
  // B は未整備（lesson_title="" は "(未作成)" フォールバックのテスト対象）
  { pack_id: "test.grade3", unit_name: "B", lesson_no: 1, total_hours: 3, lesson_title: "", content: "", note: "" },
];

// 4年：単元X(4時間) のみ
export const g4AnnualPlan: AnnualPlan[] = [
  {
    pack_id: "test.grade4",
    month: 4,
    series: null,
    unit_no: 1,
    unit_name: "X",
    allocated_hours: 4,
    standard_hours: 4,
    type: "main",
    note: "",
  },
];

export const g4LessonMaster: LessonMaster[] = [
  { pack_id: "test.grade4", unit_name: "X", lesson_no: 1, total_hours: 4, lesson_title: "X1", content: "Xc1", note: "" },
  { pack_id: "test.grade4", unit_name: "X", lesson_no: 2, total_hours: 4, lesson_title: "X2", content: "Xc2", note: "" },
  { pack_id: "test.grade4", unit_name: "X", lesson_no: 3, total_hours: 4, lesson_title: "X3", content: "Xc3", note: "" },
  { pack_id: "test.grade4", unit_name: "X", lesson_no: 4, total_hours: 4, lesson_title: "X4", content: "Xc4", note: "" },
];

export const testPacks = {
  "test.grade3": { annualPlan: g3AnnualPlan, lessonMaster: g3LessonMaster },
  "test.grade4": { annualPlan: g4AnnualPlan, lessonMaster: g4LessonMaster },
};

/** 3-1（単元A開始時点） */
export const progressG3Start: ClassProgress = {
  class_code: "3-1",
  grade: 3,
  pack_id: "test.grade3",
  current_unit_name: "A",
  completed_hours: 0,
  total_completed_hours: 0,
  memo: "",
};

/** 4-1（単元X開始時点） */
export const progressG4Start: ClassProgress = {
  class_code: "4-1",
  grade: 4,
  pack_id: "test.grade4",
  current_unit_name: "X",
  completed_hours: 0,
  total_completed_hours: 0,
  memo: "",
};

/**
 * 月〜金に 3-1 と 4-1 を1コマずつ入れた時間割（合計10コマ/週）
 * 月1 3-1 / 火1 4-1 / 水1 3-1 / 木1 4-1 / 金1 3-1
 * 月2 4-1 / 火2 3-1 / 水2 4-1 / 木2 3-1 / 金2 4-1
 */
export const testTimetable: Timetable[] = [
  { day: "月", weekday_order: 1, period: 1, class_code: "3-1", grade: 3, class_number: 1, subject: "理科", note: "" },
  { day: "月", weekday_order: 1, period: 2, class_code: "4-1", grade: 4, class_number: 1, subject: "理科", note: "" },
  { day: "火", weekday_order: 2, period: 1, class_code: "4-1", grade: 4, class_number: 1, subject: "理科", note: "" },
  { day: "火", weekday_order: 2, period: 2, class_code: "3-1", grade: 3, class_number: 1, subject: "理科", note: "" },
  { day: "水", weekday_order: 3, period: 1, class_code: "3-1", grade: 3, class_number: 1, subject: "理科", note: "" },
  { day: "水", weekday_order: 3, period: 2, class_code: "4-1", grade: 4, class_number: 1, subject: "理科", note: "" },
  { day: "木", weekday_order: 4, period: 1, class_code: "4-1", grade: 4, class_number: 1, subject: "理科", note: "" },
  { day: "木", weekday_order: 4, period: 2, class_code: "3-1", grade: 3, class_number: 1, subject: "理科", note: "" },
  { day: "金", weekday_order: 5, period: 1, class_code: "3-1", grade: 3, class_number: 1, subject: "理科", note: "" },
  { day: "金", weekday_order: 5, period: 2, class_code: "4-1", grade: 4, class_number: 1, subject: "理科", note: "" },
];

/** 始業式日起点の月曜（2026-04-06） */
export const WEEK1_MONDAY = new Date(2026, 3, 6);
