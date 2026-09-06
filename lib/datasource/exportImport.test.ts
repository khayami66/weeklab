import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { localDataSource } from "@/lib/datasource/localDataSource";
import {
  META_CURRENT_YEAR_KEY,
  META_YEARS_KEY,
  archiveMetaKey,
  archiveWeeksKey,
  confirmedWeeksKey,
  firstLessonKey,
  memoKey,
  testResultKey,
  yearKey,
} from "@/lib/store/localStore";
import type { FullSnapshot } from "@/types";

/**
 * エクスポート／インポートの往復テスト。
 *
 * **これは機能テストであると同時に、回帰の検出器でもある。**
 * 永続化キーを新しく足したときに `exportAll` / `importAll` へ足し忘れると、
 * 「保存はできるがバックアップから復元できない」データが静かに生まれる。
 * 実際に成績3種（G1〜G4）と confirmed_weeks（Phase 12）で起きた。
 *
 * 下の「全キーを積んで往復させ、完全一致を要求する」テストは、
 * **新しいキー種別を seed に足した時点で、export/import 未対応なら落ちる**。
 * 新しい永続化キーを足したら、必ず seedEverything にも足すこと。
 */

const YEAR = 2026;
const TEST_ID = "keirinkan.science.grade3.kaze-gomu";

type Store = Map<string, string>;

let store: Store;

function createLocalStorage(s: Store) {
  return {
    getItem: (k: string): string | null => (s.has(k) ? (s.get(k) as string) : null),
    setItem: (k: string, v: string): void => {
      s.set(k, v);
    },
    removeItem: (k: string): void => {
      s.delete(k);
    },
    clear: (): void => {
      s.clear();
    },
    key: (i: number): string | null => Array.from(s.keys())[i] ?? null,
    get length(): number {
      return s.size;
    },
  };
}

beforeEach(() => {
  store = new Map();
  (globalThis as { window?: unknown }).window = { localStorage: createLocalStorage(store) };
});

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

/** localStorage の中身を key → 値 の形で丸ごと取り出す（比較用） */
function dump(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Array.from(store.keys()).sort()) {
    out[k] = JSON.parse(store.get(k) as string);
  }
  return out;
}

function put(key: string, value: unknown): void {
  store.set(key, JSON.stringify(value));
}

/**
 * 現在ありうる**全種類**の永続化キーを積む。
 * 新しいキー種別を足したら、ここにも足す（足さないとテストは通ってしまう）。
 */
function seedEverything(): void {
  put(META_CURRENT_YEAR_KEY, YEAR);
  put(META_YEARS_KEY, [YEAR]);

  put(yearKey(YEAR, "teacher_setting"), {
    school_year: YEAR,
    school_name: "テスト小学校",
    teacher_name: "テスト",
    teacher_type: "specialist",
    start_date: "2026-04-06",
    grade_configs: [{ grade: 3, class_count: 1, pack_id: "keirinkan.science.grade3" }],
  });

  put(yearKey(YEAR, "timetable"), [
    {
      day: "月",
      weekday_order: 1,
      period: 2,
      class_code: "3-1",
      grade: 3,
      class_number: 1,
      subject: "理科",
      note: "",
    },
  ]);

  put(yearKey(YEAR, "overrides"), [
    {
      date: "2026-05-12",
      period: 2,
      original_class_code: "3-1",
      new_class_code: null,
      change_type: "cancel",
      memo: "行事",
    },
  ]);

  put(yearKey(YEAR, "class_progress"), [
    {
      class_code: "3-1",
      grade: 3,
      pack_id: "keirinkan.science.grade3",
      current_unit_name: "風とゴムの力のはたらき",
      completed_hours: 3,
      total_completed_hours: 12,
      memo: "",
    },
  ]);

  put(memoKey(YEAR, "2026-05-11", "3-1", 2), "実験の準備をする");

  put(firstLessonKey(YEAR, "2026-05-11"), [
    { class_code: "3-1", unit_name: "風とゴムの力のはたらき", lesson_no: 4 },
  ]);

  // Phase 12
  put(confirmedWeeksKey(YEAR), ["2026-05-11", "2026-05-18"]);

  // 授業案（ユーザー層）
  put(yearKey(YEAR, "lesson_plan"), [
    {
      pack_id: "keirinkan.science.grade3",
      unit_name: "風とゴムの力のはたらき",
      lesson_no: 3,
      lesson_title: "ゴムの力で車を走らせる",
      content: "ゴムの伸ばし方を変えて距離を比べる。班ごとに記録用紙へ。",
      note: "",
    },
  ]);

  // 成績層（G1〜G4）
  put(yearKey(YEAR, "test_master"), [
    {
      test_id: TEST_ID,
      pack_id: "keirinkan.science.grade3",
      unit_name: "風とゴムの力のはたらき",
      test_name: "風とゴム",
      max_knowledge: 60,
      max_thinking: 40,
      note: "",
    },
  ]);

  put(yearKey(YEAR, "grade_thresholds"), [
    { viewpoint: "knowledge", a_min: 85, b_min: 55 },
    { viewpoint: "thinking", a_min: 90, b_min: 60 },
  ]);

  put(testResultKey(YEAR, TEST_ID, "3-1"), {
    test_id: TEST_ID,
    class_code: "3-1",
    conducted_on: "2026-05-20",
    scores: [
      { student_no: 1, knowledge: 54, thinking: 36 },
      { student_no: 2, knowledge: 33, thinking: null },
    ],
  });

  // アーカイブ
  put(archiveMetaKey(YEAR), {
    school_year: YEAR,
    school_name: "テスト小学校",
    teacher_name: "テスト",
    packs_used: ["keirinkan.science.grade3"],
    total_weeks: 35,
    archived_at: "2027-03-31T00:00:00.000Z",
  });

  put(archiveWeeksKey(YEAR), []);
}

describe("exportAll / importAll", () => {
  it("全種類のキーを往復させても中身が完全に一致する（キー追加の取りこぼし検出器）", async () => {
    seedEverything();
    const before = dump();

    const snapshot = await localDataSource.exportAll();

    // ブラウザのデータを消した状況を再現してから復元する
    store.clear();
    await localDataSource.importAll(snapshot);

    expect(dump()).toEqual(before);
  });

  it("成績データ（テストマスタ・閾値・得点）がスナップショットに入る", async () => {
    seedEverything();
    const snapshot = await localDataSource.exportAll();
    const year = snapshot.years[YEAR];

    expect(year.test_masters).toHaveLength(1);
    expect(year.test_masters?.[0].test_id).toBe(TEST_ID);

    // 既定値ではなく、保存された閾値がそのまま出ること
    expect(year.grade_thresholds).toEqual([
      { viewpoint: "knowledge", a_min: 85, b_min: 55 },
      { viewpoint: "thinking", a_min: 90, b_min: 60 },
    ]);

    expect(year.test_results).toHaveLength(1);
    expect(year.test_results?.[0].scores[1].thinking).toBeNull(); // 未受験の null が保たれる

    expect(year.confirmed_weeks).toEqual(["2026-05-11", "2026-05-18"]);

    expect(year.lesson_plans).toHaveLength(1);
    expect(year.lesson_plans?.[0].lesson_title).toBe("ゴムの力で車を走らせる");
  });

  it("成績を入力したあとインポートしても、成績が消えない", async () => {
    seedEverything();
    const snapshot = await localDataSource.exportAll();

    // 別の得点で上書きしてから、バックアップを戻す
    put(testResultKey(YEAR, TEST_ID, "3-1"), {
      test_id: TEST_ID,
      class_code: "3-1",
      conducted_on: "2026-05-20",
      scores: [{ student_no: 1, knowledge: 0, thinking: 0 }],
    });

    await localDataSource.importAll(snapshot);

    const restored = await localDataSource.getTestResult(TEST_ID, "3-1");
    expect(restored?.scores[0].knowledge).toBe(54);
  });

  it("成績・confirmed_weeks を持たない旧形式のスナップショットも読める", async () => {
    seedEverything();
    const old: FullSnapshot = {
      version: "1.0",
      exported_at: "2026-08-01T00:00:00.000Z",
      current_year: YEAR,
      years: {
        [YEAR]: {
          setting: {
            school_year: YEAR,
            school_name: "旧形式",
            teacher_name: "テスト",
            teacher_type: "specialist",
            start_date: "2026-04-06",
            grade_configs: [],
          },
          timetable: [],
          overrides: [],
          class_progress: [],
          memos: {},
          first_lesson_confirms: {},
        },
      },
    };

    await expect(localDataSource.importAll(old)).resolves.toBeUndefined();

    const setting = await localDataSource.getSetting();
    expect(setting.school_name).toBe("旧形式");
    // 旧形式には無いので、成績・授業案は空になる（消えるのではなく元から入っていない）
    expect(await localDataSource.getTestMasters()).toEqual([]);
    expect(await localDataSource.getLessonPlans()).toEqual([]);
  });
});
