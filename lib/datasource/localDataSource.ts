import type {
  AnnualPlan,
  ArchiveMetadata,
  ArchivedWeek,
  ClassProgress,
  CurriculumPack,
  FirstLessonConfirm,
  FullSnapshot,
  LessonMaster,
  TeacherSetting,
  Timetable,
  TimetableOverride,
} from "@/types";
import type { DataSource } from "./index";

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

      if (data.archive_meta) setItem(archiveMetaKey(year), data.archive_meta);
      if (data.archived_weeks) setItem(archiveWeeksKey(year), data.archived_weeks);
    }

    setItem(META_CURRENT_YEAR_KEY, snapshot.current_year);
    setItem(META_YEARS_KEY, years.sort((a, b) => a - b));
  },
};
