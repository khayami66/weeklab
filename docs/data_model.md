# data_model.md

## 1. 全体方針

データを **2層 + 年度軸** で設計する。

### 層1：カリキュラムパック層（共有資産）
- `publisher × subject × grade` 単位で配布・再利用
- MVP は「啓林館×理科×3年」「啓林館×理科×4年」の2パック
- 教科書改訂時は最新パックのみ保持（旧パックは破棄）

### 層2：教員個人設定層（ユーザー固有）
- **年度ごとに独立**したデータセットとして保持
- キー命名：`weeklab.{year}.{type}_v1`

### 年度軸
- 現年度（current_year）で全データを読み書き
- 年度切り替え時：現年度は凍結アーカイブ、新年度は初期化

## 2. 型定義

### 2.1 カリキュラムパック層

#### `CurriculumPack`
```ts
interface CurriculumPack {
  id: string;              // "keirinkan.science.grade3"
  publisher: string;       // "keirinkan"
  publisher_label: string; // "啓林館"
  subject: string;         // "science"
  subject_label: string;   // "理科"
  grade: number;
  year: number;            // 対応教科書年度
}
```

#### `AnnualPlan`
```ts
type UnitType = "main" | "sub" | "guide" | "project" | "review";

interface AnnualPlan {
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
```

#### `LessonMaster`（案A採用・簡素化）
```ts
interface LessonMaster {
  pack_id: string;
  unit_name: string;
  lesson_no: number;
  total_hours: number;
  lesson_title: string;
  content: string;         // 授業内容を1フィールドに統一
  note: string;
}
```

### 2.2 教員個人設定層

#### `GradeConfig`
```ts
interface GradeConfig {
  grade: number;         // 3, 4 など
  class_count: number;   // そのクラスの組数
  pack_id: string;       // "keirinkan.science.grade3"
}
```

#### `TeacherType`
```ts
type TeacherType = "specialist" | "homeroom";
// specialist : 専科教員（MVP対象）。時間割でコマごとに「クラス」を選ぶ
// homeroom   : 担任教員（将来対応）。時間割でコマごとに「教科」を選ぶ
```

#### `TeacherSetting`
```ts
interface TeacherSetting {
  school_year: number;            // 年度（例：2026）
  school_name: string;
  teacher_name: string;
  teacher_type: TeacherType;      // 専科 / 担任
  start_date: string;             // 当該年度の始業式日 "YYYY-MM-DD"
  grade_configs: GradeConfig[];   // 学年×クラス数×パックの構成
}
```

**備考**：「使用中のパックID一覧（active_packs）」は `grade_configs.map(g => g.pack_id)` で派生できるため、別フィールドとして持たない（Single Source of Truth）。

ヘルパー：
```ts
function getActivePacks(setting: TeacherSetting): string[] {
  return [...new Set(setting.grade_configs.map((g) => g.pack_id))];
}

function generateInitialClassProgress(
  gradeConfigs: GradeConfig[]
): ClassProgress[] {
  // 各 grade_config から class_count 個の ClassProgress を生成
  // 例: { grade:3, class_count:3, pack_id:"..." } → 3-1, 3-2, 3-3 の3件
  // 初期値: current_unit_name="理科のガイダンス", completed_hours=0
}
```

#### `Timetable`
```ts
interface Timetable {
  day: "月"|"火"|"水"|"木"|"金"|"土";
  weekday_order: 1|2|3|4|5|6;
  period: number;
  class_code: string;
  grade: number;
  class_number: number;
  subject: "理科";
  note: string;
}
```

#### `TimetableOverride`
```ts
type OverrideType = "cancel" | "replace" | "add";

interface TimetableOverride {
  date: string;                        // "YYYY-MM-DD"
  period: number;
  original_class_code: string | null;
  new_class_code: string | null;
  change_type: OverrideType;
  memo: string;
}
```

#### `ClassProgress`
```ts
interface ClassProgress {
  class_code: string;
  grade: number;
  pack_id: string;
  current_unit_name: string;
  completed_hours: number;         // 当該単元内
  total_completed_hours: number;   // 年度開始からの累計
  memo: string;
}
```

### 2.3 派生・運用データ

#### `WeeklyPlan`（自動生成される週案1コマ）
```ts
interface WeeklyPlan {
  date: string;
  weekday: "月"|"火"|"水"|"木"|"金"|"土";
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
```

#### `WeekSummary` / `ClassTally`
```ts
interface WeekSummary {
  week_no: number;
  period_from: string;
  period_to: string;
  class_tallies: ClassTally[];
}

interface ClassTally {
  class_code: string;
  weekly_hours: number;      // 週実施時数
  cumulative_hours: number;  // 実施累計
}
```

#### `ProgressHealth`（進度ヘルスチェック結果）
```ts
type HealthLevel = "ok" | "warn" | "alert";

interface ProgressHealth {
  class_code: string;
  expected_cumulative: number;   // 現在週から期待される累計時数
  actual_cumulative: number;     // 実際の累計
  diff: number;                  // actual - expected（正：進みすぎ、負：遅れ）
  level: HealthLevel;            // ok: |diff|<3, warn: 3-5, alert: 5+
  message: string;               // "2時間遅れています" 等
}
```

#### `MonthlySummary` / `MonthlyClassTally`（月次集計）
```ts
interface MonthlySummary {
  year: number;
  month: number;                 // 1-12
  class_tallies: MonthlyClassTally[];
}

interface MonthlyClassTally {
  class_code: string;
  by_unit: { unit_name: string; hours: number }[];
  total_hours: number;
}
```

#### `FirstLessonConfirm`（週先頭コマ確定）
```ts
interface FirstLessonConfirm {
  class_code: string;
  unit_name: string;
  lesson_no: number;             // 本時（1始まり）
}
```

### 2.4 アーカイブ・エクスポート

#### `ArchivedWeek`（凍結された週データ）
```ts
interface ArchivedWeek {
  school_year: number;
  week_no: number;
  period_from: string;
  period_to: string;
  plans: WeeklyPlan[];       // 当時のスナップショット
  summary: WeekSummary;
  archived_at: string;       // ISO datetime
}
```

#### `ArchiveMetadata`
```ts
interface ArchiveMetadata {
  school_year: number;
  school_name: string;
  teacher_name: string;
  packs_used: string[];
  total_weeks: number;
  archived_at: string;
}
```

#### `FullSnapshot`（JSONエクスポート形式）
```ts
interface FullSnapshot {
  version: "1.0";
  exported_at: string;
  current_year: number;
  years: {
    [year: number]: {
      setting: TeacherSetting;
      timetable: Timetable[];
      overrides: TimetableOverride[];
      class_progress: ClassProgress[];
      memos: Record<string, string>;                       // key → memo text
      first_lesson_confirms: Record<string, FirstLessonConfirm[]>;  // monday_date → confirms[]
      confirmed_weeks?: string[];          // 実施済みに確定した週（Phase 12）
      lesson_plans?: LessonPlan[];         // 授業案（ユーザー層。パック層の LessonMaster を上書き）
      test_masters?: TestMaster[];         // 成績層（G1〜G4）
      grade_thresholds?: GradeThreshold[];
      test_results?: TestResult[];
      archive_meta?: ArchiveMetadata;
      archived_weeks?: ArchivedWeek[];
    };
  };
}
```

> **ワークシート（PDF）は例外的にバックアップの対象外。**
> `Worksheet` は IndexedDB（`weeklab` / `worksheets`）に置き、`FullSnapshot` に含めない。
> PDF を base64 で JSON に入れると1回のバックアップが数十MBになり、実用に耐えないため。
> 原本は本人の手元にある前提の「控え」と位置づけ、画面にその旨を明示している。
>
> **永続化キーを増やしたら、必ず `exportAll` / `importAll` の両方に足す。**
> 型に足しただけで実装を忘れると、「保存はできるがバックアップから復元できない」
> データが静かに生まれる。実際に成績3種と `confirmed_weeks` で起きた。
> `lib/datasource/exportImport.test.ts` の往復テストが検出器になっている
> （全キー種別を積んで往復させ、完全一致を要求する）。

### 2.5 成績層

成績処理の型定義・ロジック・画面設計は **`grading_design.md` に分離**する
（サブシステムとして独立性が高く、本書に混ぜると読みにくくなるため）。

本書では型名のみ掲げる。詳細は `grading_design.md` §3 を参照。

| 型 | 役割 | 層 |
|---|---|---|
| `ViewPoint` | 評価の観点（`knowledge` / `thinking` / `attitude`） | — |
| `GradeLevel` | `"A" \| "B" \| "C"` | — |
| `TestMaster` | 業者単元テストの定義（単元・観点別満点） | 個人設定層 |
| （名簿の型は持たない） | 全クラス一律35行固定（定数 `ROSTER_ROWS`）。在籍人数は記録しない | — |
| `TestScore` | 1人1テスト分の得点（未受験は `null`） | 個人設定層 |
| `TestResult` | 1クラス1テスト分の実施記録（実施日＋全員分の得点） | 個人設定層 |
| `GradeThreshold` | 観点ごとの A/B 下限（初期値 90/60） | 個人設定層 |
| `ViewPointResult` / `StudentGrade` | 通算得点率と A/B/C 判定 | 派生 |
| `ViewpointBalance` | 観点の偏り分析（`ProgressHealth` と同形） | 派生 |

**成績データは児童の氏名を持たない。** 識別子は `class_code` ＋ `student_no`（出席番号）のみ。

## 3. データ関係図

```
CurriculumPack
  ├── AnnualPlan     (pack_id)
  └── LessonMaster   (pack_id, unit_name, lesson_no)
          ▲
          │参照
TeacherSetting（年度ごと）
  ├── Timetable（基本）
  ├── TimetableOverride（例外）
  └── ClassProgress
          │
          ▼
    週案生成ロジック
          │
          ▼
  WeeklyPlan[] + WeekSummary
          │
          ▼（年度切り替え時）
  ArchivedWeek[]（凍結）
```

## 4. 週案生成ロジック

### 4.1 主要関数
```ts
function generateWeeklyPlan(
  weekStart: Date,
  setting: TeacherSetting,
  timetable: Timetable[],
  overrides: TimetableOverride[],
  progress: ClassProgress[],
  packs: Record<string, { annualPlan: AnnualPlan[]; lessonMaster: LessonMaster[] }>,
  firstLessonConfirms?: FirstLessonConfirm[]   // クラスごとの週先頭コマ確定値
): { plan: WeeklyPlan[]; summary: WeekSummary };

function getLessonsForDate(date: Date, /* 同上 */): WeeklyPlan[];
function getWeekNumber(date: Date, startDate: string): number;
function formatLessonsForLine(lessons: WeeklyPlan[], date: Date): string;

function computeMonthSummary(
  year: number,
  month: number,
  setting: TeacherSetting,
  timetable: Timetable[],
  overrides: TimetableOverride[],
  progress: ClassProgress[],
  packs: Record<string, { annualPlan: AnnualPlan[]; lessonMaster: LessonMaster[] }>
): MonthlySummary;

function checkProgressHealth(
  progress: ClassProgress[],
  annualPlanByPack: Record<string, AnnualPlan[]>,   // pack_id → AnnualPlan[]
  currentWeekNo: number,
  totalWeeks: number
): ProgressHealth[];
```

### 4.2 週番号算出
```
week_no = floor((mondayOf(date) - mondayOf(setting.start_date)) / 7日) + 1
```

### 4.3 生成の流れ
1. `weekStart`（月曜）から6日分を生成
2. 各日で `Timetable` をフィルタ ＋ `TimetableOverride` マージ
3. **各クラスの週先頭コマ**：`firstLessonConfirms` に確定値があればそれを採用、なければ `ClassProgress` から次実施本時を決定
4. 2コマ目以降：先頭コマの次から `LessonMaster` を順に割り当て
5. 単元完了時は `AnnualPlan` で次単元に繰り上げ（年間計画順）
6. `WeekSummary` を算出（週実施・累計）
7. 月次集計は `computeMonthSummary` で別途算出（画面 `/monthly` 用）

### 4.4 進度ヘルスチェック
```
expected_cumulative = 年間配当時数 × (current_week_no / total_weeks)
diff = actual_cumulative - expected_cumulative
|diff| < 3  → level = "ok"
3 ≤ |diff| < 5 → level = "warn"
5 ≤ |diff|    → level = "alert"
```

## 5. 年度管理

### 5.1 年度切り替え操作
```ts
async function switchYear(
  newYear: number,
  newStartDate: string,
  copyTimetable: boolean
): Promise<void>;
```
手順：
1. 現年度の全データを凍結（`ArchivedWeek[]` を生成して保存）
2. `weeklab.meta.current_year` を新年度に更新
3. 新年度の `TeacherSetting` を作成（`school_year`, `start_date`）
4. `Timetable` は任意で複製（基本的に同じと想定）
5. `TimetableOverride`, `ClassProgress` は初期化

### 5.2 アーカイブ閲覧
```ts
function listArchivedYears(): Promise<ArchiveMetadata[]>;
function getArchive(year: number): Promise<ArchivedWeek[]>;
```
アーカイブは読み取り専用。パックが後日改訂されても、当時の単元名・授業内容がそのまま残る。

## 6. JSONエクスポート/インポート

### 6.1 関数
```ts
function exportAll(): Promise<FullSnapshot>;      // 全年度を1JSONに
function importAll(snapshot: FullSnapshot): Promise<void>;  // 全上書き
```

### 6.2 用途
- バックアップ（定期的に自宅PCのフォルダに保存）
- 端末間移行（将来、学校PC等に入れる場合）
- 障害復旧（localStorage消失時）

## 7. 永続化キー命名

| データ | キー |
|---|---|
| 現年度ポインタ | `weeklab.meta.current_year` |
| 年度メタ | `weeklab.meta.years` |
| `TeacherSetting` | `weeklab.{year}.teacher_setting_v1` |
| `Timetable` | `weeklab.{year}.timetable_v1` |
| `TimetableOverride` | `weeklab.{year}.overrides_v1` |
| `ClassProgress` | `weeklab.{year}.class_progress_v1` |
| 週案 `memo` | `weeklab.{year}.memo.{date}.{class_code}.{period}` |
| 週先頭コマ確定 | `weeklab.{year}.first_lesson.{monday_date}` |
| 実施済み確定週 | `weeklab.{year}.confirmed_weeks` |
| `TestMaster` | `weeklab.{year}.test_master_v1` |
| `GradeThreshold` | `weeklab.{year}.grade_thresholds_v1` |
| `TestResult` | `weeklab.{year}.test_result.{test_id}.{class_code}` |
| アーカイブメタ | `weeklab.archive.{year}.meta` |
| アーカイブ週データ | `weeklab.archive.{year}.weeks` |

カリキュラムパック（`AnnualPlan` / `LessonMaster`）は TS定数なので localStorage には入れない。

## 8. データソース抽象層

```ts
interface DataSource {
  // パック層
  listPacks(): Promise<CurriculumPack[]>;
  getAnnualPlan(pack_id: string): Promise<AnnualPlan[]>;
  getLessonMaster(pack_id: string): Promise<LessonMaster[]>;

  // 個人設定層（現年度のみ）
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

  // 週先頭コマ確定
  getFirstLessonConfirms(monday_date: string): Promise<FirstLessonConfirm[]>;
  saveFirstLessonConfirms(monday_date: string, confirms: FirstLessonConfirm[]): Promise<void>;

  // 年度管理
  getCurrentYear(): Promise<number>;
  setCurrentYear(year: number): Promise<void>;
  archiveYear(year: number, weeks: ArchivedWeek[], meta: ArchiveMetadata): Promise<void>;
  listArchivedYears(): Promise<ArchiveMetadata[]>;
  getArchivedWeeks(year: number): Promise<ArchivedWeek[]>;

  // 成績層（grading_design.md §7）
  getTestMasters(): Promise<TestMaster[]>;
  saveTestMasters(m: TestMaster[]): Promise<void>;
  getGradeThresholds(): Promise<GradeThreshold[]>;
  saveGradeThresholds(t: GradeThreshold[]): Promise<void>;
  getTestResult(test_id: string, class_code: string): Promise<TestResult | null>;
  saveTestResult(result: TestResult): Promise<void>;
  listTestResults(): Promise<TestResult[]>;

  // エクスポート/インポート
  exportAll(): Promise<FullSnapshot>;
  importAll(snapshot: FullSnapshot): Promise<void>;
}
```

実装：
- MVP：`LocalDataSource`（TS定数＋localStorage）
- 将来：`SheetsDataSource` / `ApiDataSource`

## 9. 予約（将来追加）

| 型 | 役割 |
|---|---|
| `SchoolEvent` | 学校行事（行事自動反映用） |
| `LessonRecord` | 授業後の実施記録・反省 |
| `ResearchNote` | 教材研究メモ |
| `PrintTemplate` | 他自治体の印刷様式 |
| `AttitudeRecord` | 第3観点（主体的に学習に取り組む態度）の材料。`grading_design.md` §9 参照 |

> `GradeSystemLink`（外部成績システム連携）は廃止。成績処理は Weeklab に統合した（`grading_design.md` §1.1）。
