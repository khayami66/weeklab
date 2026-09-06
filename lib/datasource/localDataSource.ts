import type {
  AnnualPlan,
  ArchiveMetadata,
  ArchivedWeek,
  ClassProgress,
  CurriculumPack,
  FirstLessonConfirm,
  FullSnapshot,
  GradeThreshold,
  LessonMaster,
  LessonPlan,
  TeacherSetting,
  TestMaster,
  TestResult,
  Timetable,
  TimetableOverride,
} from "@/types";
import type { DataSource } from "./index";
import { defaultThresholds } from "@/lib/grading";
import { mergeLessonPlans } from "@/lib/lessonPlan";

import { curriculumPacks } from "@/data/curriculums/registry";
import { annualPlan as grade3AnnualPlan } from "@/data/curriculums/keirinkan/science/grade3/annualPlan";
import { lessonMaster as grade3LessonMaster } from "@/data/curriculums/keirinkan/science/grade3/lessonMaster";
import { annualPlan as grade4AnnualPlan } from "@/data/curriculums/keirinkan/science/grade4/annualPlan";
import { lessonMaster as grade4LessonMaster } from "@/data/curriculums/keirinkan/science/grade4/lessonMaster";

import { initialSetting } from "@/data/user/initialSetting";
import { initialTimetable } from "@/data/user/initialTimetable";
import { generateInitialClassProgress } from "@/data/user/initialClassProgress";

import {
  META_CURRENT_YEAR_KEY,
  META_YEARS_KEY,
  archiveMetaKey,
  archiveWeeksKey,
  confirmedWeeksKey,
  firstLessonKey,
  getItem,
  listKeys,
  removeItem,
  setItem,
  testResultKey,
  testResultPrefix,
  yearKey,
} from "@/lib/store/localStore";

// ================================================================
// パック層：TS定数をIDで引くだけの静的参照
// ================================================================

const packAnnualPlans: Record<string, AnnualPlan[]> = {
  "keirinkan.science.grade3": grade3AnnualPlan,
  "keirinkan.science.grade4": grade4AnnualPlan,
};

const packLessonMasters: Record<string, LessonMaster[]> = {
  "keirinkan.science.grade3": grade3LessonMaster,
  "keirinkan.science.grade4": grade4LessonMaster,
};

// ================================================================
// 現年度ポインタの取得（他メソッドから利用）
// ================================================================

const DEFAULT_YEAR = initialSetting.school_year;

function readCurrentYear(): number {
  return getItem<number>(META_CURRENT_YEAR_KEY, DEFAULT_YEAR);
}

function ensureYearMeta(year: number): void {
  const years = getItem<number[]>(META_YEARS_KEY, []);
  if (!years.includes(year)) {
    setItem(META_YEARS_KEY, [...years, year].sort((a, b) => a - b));
  }
}

// ================================================================
// LocalDataSource 実装
// ================================================================

export const localDataSource: DataSource = {
  // ── パック層 ───────────────────────────────────────
  async listPacks(): Promise<CurriculumPack[]> {
    return curriculumPacks;
  },

  async getAnnualPlan(pack_id: string): Promise<AnnualPlan[]> {
    return packAnnualPlans[pack_id] ?? [];
  },

  async getLessonMaster(pack_id: string): Promise<LessonMaster[]> {
    return packLessonMasters[pack_id] ?? [];
  },

  // ── 個人設定層 ─────────────────────────────────────
  async getSetting(): Promise<TeacherSetting> {
    const year = readCurrentYear();
    const stored = getItem<TeacherSetting | null>(yearKey(year, "teacher_setting"), null);
    if (stored) {
      // レガシーデータ互換：teacher_type が未設定のデータ（2026-04-23 以前保存）には
      // デフォルトの "specialist" を補完して再保存
      if (!stored.teacher_type) {
        stored.teacher_type = "specialist";
        setItem(yearKey(year, "teacher_setting"), stored);
      }
      return stored;
    }

    // 初回：initialSetting を保存して返す
    setItem(yearKey(year, "teacher_setting"), initialSetting);
    setItem(META_CURRENT_YEAR_KEY, initialSetting.school_year);
    ensureYearMeta(initialSetting.school_year);
    return initialSetting;
  },

  async saveSetting(s: TeacherSetting): Promise<void> {
    setItem(yearKey(s.school_year, "teacher_setting"), s);
    setItem(META_CURRENT_YEAR_KEY, s.school_year);
    ensureYearMeta(s.school_year);
  },

  async getTimetable(): Promise<Timetable[]> {
    const year = readCurrentYear();
    const stored = getItem<Timetable[] | null>(yearKey(year, "timetable"), null);
    if (stored) return stored;

    // 初回：initialTimetable（空配列）を保存
    setItem(yearKey(year, "timetable"), initialTimetable);
    return initialTimetable;
  },

  async saveTimetable(t: Timetable[]): Promise<void> {
    const year = readCurrentYear();
    setItem(yearKey(year, "timetable"), t);
  },

  async getOverrides(): Promise<TimetableOverride[]> {
    const year = readCurrentYear();
    return getItem<TimetableOverride[]>(yearKey(year, "overrides"), []);
  },

  async saveOverrides(o: TimetableOverride[]): Promise<void> {
    const year = readCurrentYear();
    setItem(yearKey(year, "overrides"), o);
  },

  async getClassProgress(): Promise<ClassProgress[]> {
    const year = readCurrentYear();
    const stored = getItem<ClassProgress[] | null>(yearKey(year, "class_progress"), null);
    if (stored) return stored;

    // 初回：現在の setting.grade_configs から動的生成
    const setting = await localDataSource.getSetting();
    const generated = generateInitialClassProgress(setting.grade_configs);
    setItem(yearKey(year, "class_progress"), generated);
    return generated;
  },

  async saveClassProgress(p: ClassProgress[]): Promise<void> {
    const year = readCurrentYear();
    setItem(yearKey(year, "class_progress"), p);
  },

  async getLessonPlans(): Promise<LessonPlan[]> {
    const year = readCurrentYear();
    return getItem<LessonPlan[]>(yearKey(year, "lesson_plan"), []);
  },

  async saveLessonPlans(plans: LessonPlan[]): Promise<void> {
    const year = readCurrentYear();
    setItem(yearKey(year, "lesson_plan"), plans);
  },

  async getEffectiveLessonMaster(pack_id: string): Promise<LessonMaster[]> {
    const packMaster = await this.getLessonMaster(pack_id);
    const userPlans = await this.getLessonPlans();
    return mergeLessonPlans(packMaster, userPlans, pack_id);
  },

  async getMemo(key: string): Promise<string | null> {
    // key 自体が weeklab.{year}.memo.{date}.{class_code}.{period} 形式の完全キーを想定
    return getItem<string | null>(key, null);
  },

  async saveMemo(key: string, memo: string): Promise<void> {
    if (memo === "") {
      removeItem(key);
      return;
    }
    setItem(key, memo);
  },

  // ── 週先頭コマ確定 ─────────────────────────────────
  async getFirstLessonConfirms(monday_date: string): Promise<FirstLessonConfirm[]> {
    const year = readCurrentYear();
    return getItem<FirstLessonConfirm[]>(firstLessonKey(year, monday_date), []);
  },

  async saveFirstLessonConfirms(
    monday_date: string,
    confirms: FirstLessonConfirm[]
  ): Promise<void> {
    const year = readCurrentYear();
    setItem(firstLessonKey(year, monday_date), confirms);
  },

  // ── 実施済み確定週 ─────────────────────────────────
  // ── 成績層：評定閾値・テストマスタ ─────────────────
  async getTestMasters(): Promise<TestMaster[]> {
    const year = readCurrentYear();
    return getItem<TestMaster[]>(yearKey(year, "test_master"), []);
  },

  async saveTestMasters(m: TestMaster[]): Promise<void> {
    const year = readCurrentYear();
    setItem(yearKey(year, "test_master"), m);
  },

  async getGradeThresholds(): Promise<GradeThreshold[]> {
    const year = readCurrentYear();
    const stored = getItem<GradeThreshold[] | null>(yearKey(year, "grade_thresholds"), null);
    // 未保存なら既定値を返すだけ（getSetting と違い書き込まない）。
    // 保存は設定画面で明示的に変更されたときだけ行う。
    if (stored && stored.length > 0) return stored;
    return defaultThresholds();
  },

  async saveGradeThresholds(t: GradeThreshold[]): Promise<void> {
    const year = readCurrentYear();
    setItem(yearKey(year, "grade_thresholds"), t);
  },

  async getTestResult(test_id: string, class_code: string): Promise<TestResult | null> {
    const year = readCurrentYear();
    return getItem<TestResult | null>(testResultKey(year, test_id, class_code), null);
  },

  async saveTestResult(result: TestResult): Promise<void> {
    const year = readCurrentYear();
    setItem(testResultKey(year, result.test_id, result.class_code), result);
  },

  async listTestResults(): Promise<TestResult[]> {
    const year = readCurrentYear();
    const results: TestResult[] = [];
    for (const key of listKeys(testResultPrefix(year))) {
      const r = getItem<TestResult | null>(key, null);
      if (r) results.push(r);
    }
    return results;
  },

  async getConfirmedWeeks(): Promise<string[]> {
    const year = readCurrentYear();
    return getItem<string[]>(confirmedWeeksKey(year), []);
  },

  async addConfirmedWeek(monday_date: string): Promise<void> {
    const year = readCurrentYear();
    const current = getItem<string[]>(confirmedWeeksKey(year), []);
    if (!current.includes(monday_date)) {
      setItem(confirmedWeeksKey(year), [...current, monday_date].sort());
    }
  },

  async removeConfirmedWeek(monday_date: string): Promise<void> {
    const year = readCurrentYear();
    const current = getItem<string[]>(confirmedWeeksKey(year), []);
    setItem(
      confirmedWeeksKey(year),
      current.filter((d) => d !== monday_date)
    );
  },

  // ── 年度管理 ───────────────────────────────────────
  async getCurrentYear(): Promise<number> {
    return readCurrentYear();
  },

  async setCurrentYear(year: number): Promise<void> {
    setItem(META_CURRENT_YEAR_KEY, year);
    ensureYearMeta(year);
  },

  async archiveYear(
    year: number,
    weeks: ArchivedWeek[],
    meta: ArchiveMetadata
  ): Promise<void> {
    setItem(archiveWeeksKey(year), weeks);
    setItem(archiveMetaKey(year), meta);
  },

  async listArchivedYears(): Promise<ArchiveMetadata[]> {
    const metaKeys = listKeys("weeklab.archive.").filter((k) => k.endsWith(".meta"));
    const metas: ArchiveMetadata[] = [];
    for (const key of metaKeys) {
      const meta = getItem<ArchiveMetadata | null>(key, null);
      if (meta) metas.push(meta);
    }
    return metas.sort((a, b) => a.school_year - b.school_year);
  },

  async getArchivedWeeks(year: number): Promise<ArchivedWeek[]> {
    return getItem<ArchivedWeek[]>(archiveWeeksKey(year), []);
  },

  // ── エクスポート/インポート ──────────────────────────
  async exportAll(): Promise<FullSnapshot> {
    const currentYear = readCurrentYear();
    const years = getItem<number[]>(META_YEARS_KEY, [currentYear]);
    const snapshot: FullSnapshot = {
      version: "1.0",
      exported_at: new Date().toISOString(),
      current_year: currentYear,
      years: {},
    };

    for (const year of years) {
      const setting = getItem<TeacherSetting | null>(yearKey(year, "teacher_setting"), null);
      if (!setting) continue;

      const timetable = getItem<Timetable[]>(yearKey(year, "timetable"), []);
      const overrides = getItem<TimetableOverride[]>(yearKey(year, "overrides"), []);
      const classProgress = getItem<ClassProgress[]>(yearKey(year, "class_progress"), []);

      // memos
      const memos: Record<string, string> = {};
      for (const memoKeyName of listKeys(`weeklab.${year}.memo.`)) {
        const v = getItem<string | null>(memoKeyName, null);
        if (v !== null) memos[memoKeyName] = v;
      }

      // first_lesson_confirms
      const firstLessonConfirms: Record<string, FirstLessonConfirm[]> = {};
      const prefix = `weeklab.${year}.first_lesson.`;
      for (const flKey of listKeys(prefix)) {
        const mondayDate = flKey.substring(prefix.length);
        const confirms = getItem<FirstLessonConfirm[]>(flKey, []);
        firstLessonConfirms[mondayDate] = confirms;
      }

      snapshot.years[year] = {
        setting,
        timetable,
        overrides,
        class_progress: classProgress,
        memos,
        first_lesson_confirms: firstLessonConfirms,
      };

      // ── 実施済み確定週（Phase 12）──
      const confirmedWeeks = getItem<string[]>(confirmedWeeksKey(year), []);
      if (confirmedWeeks.length > 0) snapshot.years[year].confirmed_weeks = confirmedWeeks;

      // ── 授業案（ユーザー層）──
      const lessonPlans = getItem<LessonPlan[]>(yearKey(year, "lesson_plan"), []);
      if (lessonPlans.length > 0) snapshot.years[year].lesson_plans = lessonPlans;

      // ── 成績層（G1〜G4）──
      // 型に足しただけで実装を忘れると、復元時に成績だけ消える。
      // exportImport.test.ts の往復テストで機械的に検出する。
      const testMasters = getItem<TestMaster[]>(yearKey(year, "test_master"), []);
      if (testMasters.length > 0) snapshot.years[year].test_masters = testMasters;

      // 閾値は未保存なら既定値を「返すだけ」なので、生のキーを見て保存済みかを判断する
      const storedThresholds = getItem<GradeThreshold[] | null>(
        yearKey(year, "grade_thresholds"),
        null
      );
      if (storedThresholds) snapshot.years[year].grade_thresholds = storedThresholds;

      const testResults: TestResult[] = [];
      for (const resultKey of listKeys(testResultPrefix(year))) {
        const r = getItem<TestResult | null>(resultKey, null);
        if (r) testResults.push(r);
      }
      if (testResults.length > 0) snapshot.years[year].test_results = testResults;

      const archiveMeta = getItem<ArchiveMetadata | null>(archiveMetaKey(year), null);
      const archivedWeeks = getItem<ArchivedWeek[] | null>(archiveWeeksKey(year), null);
      if (archiveMeta) snapshot.years[year].archive_meta = archiveMeta;
      if (archivedWeeks) snapshot.years[year].archived_weeks = archivedWeeks;
    }

    return snapshot;
  },

  async importAll(snapshot: FullSnapshot): Promise<void> {
    // 既存の全 weeklab.* キーをクリア
    for (const key of listKeys("weeklab.")) {
      removeItem(key);
    }

    const years: number[] = [];
    for (const yearStr of Object.keys(snapshot.years)) {
      const year = Number(yearStr);
      years.push(year);
      const data = snapshot.years[year];

      setItem(yearKey(year, "teacher_setting"), data.setting);
      setItem(yearKey(year, "timetable"), data.timetable);
      setItem(yearKey(year, "overrides"), data.overrides);
      setItem(yearKey(year, "class_progress"), data.class_progress);

      for (const [memoK, memoV] of Object.entries(data.memos)) {
        setItem(memoK, memoV);
      }

      for (const [mondayDate, confirms] of Object.entries(data.first_lesson_confirms)) {
        setItem(firstLessonKey(year, mondayDate), confirms);
      }

      if (data.confirmed_weeks) setItem(confirmedWeeksKey(year), data.confirmed_weeks);

      if (data.lesson_plans) setItem(yearKey(year, "lesson_plan"), data.lesson_plans);

      if (data.test_masters) setItem(yearKey(year, "test_master"), data.test_masters);
      if (data.grade_thresholds) setItem(yearKey(year, "grade_thresholds"), data.grade_thresholds);
      for (const r of data.test_results ?? []) {
        setItem(testResultKey(year, r.test_id, r.class_code), r);
      }

      if (data.archive_meta) setItem(archiveMetaKey(year), data.archive_meta);
      if (data.archived_weeks) setItem(archiveWeeksKey(year), data.archived_weeks);
    }

    setItem(META_CURRENT_YEAR_KEY, snapshot.current_year);
    setItem(META_YEARS_KEY, years.sort((a, b) => a - b));
  },
};
