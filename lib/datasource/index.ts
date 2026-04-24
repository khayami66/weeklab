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

/**
 * データアクセスを抽象化するインターフェース。
 *
 * MVPでは `LocalDataSource`（TS定数＋localStorage）が実装。
 * 将来 `SheetsDataSource` / `ApiDataSource` へ差し替え可能。
 *
 * Promise 返却で統一（LocalStorage 自体は同期APIだが、
 * 将来のリモート同期に備えて非同期シグネチャにしておく）。
 */
export interface DataSource {
  // ── カリキュラムパック層（読み取り専用、TS定数由来） ──
  listPacks(): Promise<CurriculumPack[]>;
  getAnnualPlan(pack_id: string): Promise<AnnualPlan[]>;
  getLessonMaster(pack_id: string): Promise<LessonMaster[]>;

  // ── 個人設定層（現年度） ──
  getSetting(): Promise<TeacherSetting>;
  saveSetting(s: TeacherSetting): Promise<void>;

  getTimetable(): Promise<Timetable[]>;
  saveTimetable(t: Timetable[]): Promise<void>;

  getOverrides(): Promise<TimetableOverride[]>;
  saveOverrides(o: TimetableOverride[]): Promise<void>;

  getClassProgress(): Promise<ClassProgress[]>;
  saveClassProgress(p: ClassProgress[]): Promise<void>;

  getMemo(key: string): Promise<string | null>;
  saveMemo(key: string, memo: string): Promise<void>;

  // ── 週先頭コマ確定 ──
  getFirstLessonConfirms(monday_date: string): Promise<FirstLessonConfirm[]>;
  saveFirstLessonConfirms(monday_date: string, confirms: FirstLessonConfirm[]): Promise<void>;

  // ── 実施済み確定週（二重確定防止） ──
  getConfirmedWeeks(): Promise<string[]>; // monday_date の配列
  addConfirmedWeek(monday_date: string): Promise<void>;
  removeConfirmedWeek(monday_date: string): Promise<void>;

  // ── 年度管理 ──
  getCurrentYear(): Promise<number>;
  setCurrentYear(year: number): Promise<void>;
  archiveYear(year: number, weeks: ArchivedWeek[], meta: ArchiveMetadata): Promise<void>;
  listArchivedYears(): Promise<ArchiveMetadata[]>;
  getArchivedWeeks(year: number): Promise<ArchivedWeek[]>;

  // ── エクスポート/インポート ──
  exportAll(): Promise<FullSnapshot>;
  importAll(snapshot: FullSnapshot): Promise<void>;
}
