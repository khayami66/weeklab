"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import PeriodPicker from "@/components/PeriodPicker";
import ScoreInputTable, { type InputDirection } from "@/components/ScoreInputTable";
import TermGradeTable from "@/components/TermGradeTable";
import Toast from "@/components/Toast";
import ViewpointBalanceTable from "@/components/ViewpointBalanceTable";
import { useGradeThresholds } from "@/hooks/useGradeThresholds";
import { useSetting } from "@/hooks/useSetting";
import { useTestMasters } from "@/hooks/useTestMasters";
import { useTestResults } from "@/hooks/useTestResults";
import { formatDate } from "@/lib/date";
import {
  ROSTER_ROWS,
  computeClassGrades,
  computeViewpointBalance,
  filterResultsByPeriod,
} from "@/lib/grading";
import type {
  TeacherSetting,
  TestMaster,
  TestResult,
  ViewPoint,
  ViewpointBalance,
} from "@/types";

/** 画面のタブ（grading_design.md §5.1） */
type GradeTab = "input" | "term" | "balance";

const TABS: { key: GradeTab; label: string }[] = [
  { key: "input", label: "得点入力" },
  { key: "term", label: "学期評定" },
  { key: "balance", label: "観点の偏り" },
];

export default function GradesPage() {
  const { setting, loading: settingLoading } = useSetting();
  const { testMasters, loading: mastersLoading } = useTestMasters();
  const { results, loading: resultsLoading, saveMany } = useTestResults();
  const { thresholds, loading: thresholdsLoading } = useGradeThresholds();

  const [tab, setTab] = useState<GradeTab>("input");
  /** 集計期間（タブ2・3で共用）。既定は「始業式から今日まで」 */
  const [period, setPeriod] = useState<{ from: string; to: string } | null>(null);

  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [hiddenTestIds, setHiddenTestIds] = useState<Set<string>>(new Set());
  const [direction, setDirection] = useState<InputDirection>("vertical");

  // draft は「どのクラス向けに作ったか」を持たせ、クラス切替時に作り直す
  const [draftClass, setDraftClass] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, TestResult>>({});
  const [baseline, setBaseline] = useState<string>("");

  const [toast, setToast] = useState<string | null>(null);
  const [toastKind, setToastKind] = useState<"success" | "info" | "error">("success");
  const [saving, setSaving] = useState(false);

  const loading = settingLoading || mastersLoading || resultsLoading || thresholdsLoading;

  const classCodes = useMemo(() => (setting ? listClassCodes(setting) : []), [setting]);

  // 選択クラスの学年に対応するパックのテストだけを列にする
  const classTests = useMemo(() => {
    if (!setting || !selectedClass) return [];
    const grade = gradeOf(selectedClass);
    const packIds = setting.grade_configs
      .filter((g) => g.grade === grade)
      .map((g) => g.pack_id);
    return testMasters.filter((m) => packIds.includes(m.pack_id));
  }, [setting, selectedClass, testMasters]);

  const visibleTests = useMemo(
    () => classTests.filter((t) => !hiddenTestIds.has(t.test_id)),
    [classTests, hiddenTestIds]
  );

  // ── タブ2・3 の集計。実施日が集計期間に入るテストだけを通算する ──
  const periodResults = useMemo(
    () => (period ? filterResultsByPeriod(results, period.from, period.to) : []),
    [results, period]
  );

  const termGrades = useMemo(
    () =>
      selectedClass
        ? computeClassGrades(selectedClass, periodResults, testMasters, thresholds)
        : [],
    [selectedClass, periodResults, testMasters, thresholds]
  );

  const balanceData = useMemo(() => {
    const classRows: { classCode: string; balance: ViewpointBalance | null }[] = [];
    const students: ViewpointBalance[] = [];

    for (const code of classCodes) {
      const grades = computeClassGrades(code, periodResults, testMasters, thresholds);
      const balances = computeViewpointBalance(grades);
      // 先頭がクラス単位、以降が児童単位（computeViewpointBalance の仕様）
      classRows.push({ classCode: code, balance: balances[0] ?? null });
      for (const b of balances.slice(1)) {
        if (b.level === "alert") students.push(b);
      }
    }
    students.sort((a, b) => Math.abs(b.gap ?? 0) - Math.abs(a.gap ?? 0));

    return { classRows, students };
  }, [classCodes, periodResults, testMasters, thresholds]);

  // 初期クラスの決定と draft の組み立ては、レンダー中に1度だけ行う
  // （useEffect 内の setState は余分な再レンダーを生むため）
  if (!loading && selectedClass === null && classCodes.length > 0) {
    setSelectedClass(classCodes[0]);
  }
  if (!loading && setting !== null && period === null) {
    setPeriod({ from: setting.start_date, to: todayString() });
  }
  if (!loading && selectedClass !== null && draftClass !== selectedClass) {
    const built = buildDraft(selectedClass, classTests, results);
    setDraftClass(selectedClass);
    setDraft(built);
    setBaseline(serialize(built));
  }

  const isDirty = baseline !== "" && serialize(draft) !== baseline;

  if (loading) {
    return (
      <div>
        <PageHeader title="成績処理" />
        <p className="text-slate-500">読み込み中...</p>
      </div>
    );
  }

  if (classCodes.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader title="成績処理" />
        <Notice>
          クラスが登録されていません。
          <SettingsLink /> で学年構成を設定してください。
        </Notice>
      </div>
    );
  }

  if (testMasters.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader title="成績処理" />
        <Notice>
          テストが登録されていません。
          <SettingsLink /> の「テストマスタ」で、使用する単元テストの単元名と観点別の満点を
          登録してください。
        </Notice>
      </div>
    );
  }

  const selectClass = (code: string) => {
    if (code === selectedClass) return;
    if (isDirty && !confirm("保存していない入力があります。破棄して切り替えますか？")) return;
    setSelectedClass(code);
    setDraftClass(null); // 次のレンダーで作り直す
  };

  const setScore = (
    test_id: string,
    student_no: number,
    viewpoint: ViewPoint,
    value: number | null
  ) => {
    setDraft((prev) => {
      const result = prev[test_id];
      if (!result) return prev;
      const scores = [...result.scores];
      const index = scores.findIndex((s) => s.student_no === student_no);
      if (index >= 0) {
        scores[index] = { ...scores[index], [viewpoint]: value };
      } else {
        scores.push({ student_no, knowledge: null, thinking: null, [viewpoint]: value });
      }
      return { ...prev, [test_id]: { ...result, scores } };
    });
  };

  const setDate = (test_id: string, conducted_on: string) => {
    setDraft((prev) => {
      const result = prev[test_id];
      if (!result) return prev;
      return { ...prev, [test_id]: { ...result, conducted_on } };
    });
  };

  const handleSave = async () => {
    const targets = visibleTests
      .map((t) => draft[t.test_id])
      .filter((r): r is TestResult => Boolean(r))
      .map(normalize);

    const problem = validate(targets, classTests);
    if (problem) {
      setToastKind("error");
      setToast(problem);
      return;
    }

    setSaving(true);
    try {
      await saveMany(targets);
      const rebuilt = buildDraft(selectedClass!, classTests, targets);
      setDraft(rebuilt);
      setBaseline(serialize(rebuilt));

      // 件数は出さない。入力件数・平均は表の下に常時出ているので重複するうえ、
      // 「のべ何名分」は打ち漏らしの検算には使えず（在籍数と一致しない）読み手を迷わせる。
      setToastKind("success");
      setToast("保存完了");
    } catch (err) {
      setToastKind("error");
      setToast(`保存に失敗しました: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!confirm("入力した内容を、最後に保存した状態に戻します。よろしいですか？")) return;
    const rebuilt = buildDraft(selectedClass!, classTests, results);
    setDraft(rebuilt);
    setBaseline(serialize(rebuilt));
  };

  // タブを移っても draft は保持される（state はこのページが持っているため）。
  // ただし未保存分は集計に入らないので、タブ2・3 側で注意を出す。
  const changeTab = (next: GradeTab) => setTab(next);

  const toggleTest = (test_id: string) => {
    setHiddenTestIds((prev) => {
      const next = new Set(prev);
      if (next.has(test_id)) next.delete(test_id);
      else next.add(test_id);
      return next;
    });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="成績処理"
        subtitle="単元テストの得点を入力します（児童の氏名は扱いません）"
      />

      {/* タブ */}
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => changeTab(t.key)}
            aria-current={t.key === tab ? "page" : undefined}
            className={`-mb-px min-h-11 rounded-t border-b-2 px-4 py-2 text-sm font-medium ${
              t.key === tab
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* クラス選択（観点の偏りは全クラスを並べるので出さない） */}
      {tab !== "balance" && (
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-600">クラス</span>
          {classCodes.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => selectClass(code)}
              className={`min-h-11 rounded px-4 py-2 text-sm font-medium ${
                code === selectedClass
                  ? "bg-blue-600 text-white"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {code}
            </button>
          ))}
        </div>
      </section>
      )}

      {tab !== "input" && period !== null && setting !== null && (
        <>
          <PeriodPicker
            from={period.from}
            to={period.to}
            startDate={setting.start_date}
            onChange={setPeriod}
          />
          {isDirty && (
            <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              「得点入力」タブに未保存の入力があります。
              <strong>下の集計には反映されていません。</strong>
              保存してから確認してください。
            </p>
          )}
        </>
      )}

      {tab === "term" &&
        (selectedClass === null ? null : (
          <TermGradeTable
            classCode={selectedClass}
            grades={termGrades}
            thresholds={thresholds}
          />
        ))}

      {tab === "balance" && (
        <ViewpointBalanceTable
          classRows={balanceData.classRows}
          students={balanceData.students}
        />
      )}

      {tab === "input" &&
        (classTests.length === 0 ? (
        <Notice>
          {selectedClass} の学年に対応するテストが登録されていません。
          <SettingsLink /> の「テストマスタ」で登録してください。
        </Notice>
      ) : (
        <>
          {/* 表示する列と入力方向 */}
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
              <div>
                <span className="mb-1 block text-xs font-medium text-slate-600">
                  表示するテスト
                </span>
                <div className="flex flex-wrap gap-3">
                  {classTests.map((t) => (
                    <label key={t.test_id} className="flex items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        checked={!hiddenTestIds.has(t.test_id)}
                        onChange={() => toggleTest(t.test_id)}
                        className="h-4 w-4"
                      />
                      {t.test_name}
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  移行時は全部表示、ふだんは採点したテストだけに絞ると打ちやすくなります。
                </p>
              </div>

              <div>
                <span className="mb-1 block text-xs font-medium text-slate-600">
                  Enter を押したときの移動
                </span>
                <select
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as InputDirection)}
                  className="rounded border border-slate-300 px-2 py-1.5 text-sm"
                >
                  <option value="vertical">縦：1列を35人分打ち切ってから次の列へ</option>
                  <option value="horizontal">横：1人の観点を打ってから次の行へ</option>
                </select>
                <p className="mt-1 text-xs text-slate-500">
                  手元の名簿の並びに合わせてください。↑↓で行移動、Tab で右へ移動します。
                </p>
              </div>
            </div>
          </section>

          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            空欄は「未受験」として集計から外れます（0点とは区別されます）。
            転出した児童の出席番号は再利用せず、転入児童は空いている末尾の番号に入れてください。
          </p>

          <ScoreInputTable
            tests={visibleTests}
            draft={draft}
            direction={direction}
            onScoreChange={setScore}
            onDateChange={setDate}
          />

          {/*
            画面下に貼り付けない（sticky にしない）。
            35行の名簿の上に常時かぶさり、下のほうの出席番号の入力欄が
            隠れて打てなくなるため。名簿を打ち切った先に置く。
          */}
          <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <span className="text-xs text-slate-500">
              {isDirty ? "未保存の入力があります" : "保存済み"}
            </span>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleReset}
                disabled={!isDirty || saving}
                className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                変更を取り消し
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!isDirty || saving}
                className="rounded bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
          </div>

        </>
        ))}

      <Toast message={toast} kind={toastKind} onDismiss={() => setToast(null)} />
    </div>
  );
}

// ================================================================
// ヘルパー
// ================================================================

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
      {children}
    </p>
  );
}

function SettingsLink() {
  return (
    <Link href="/settings" className="text-blue-600 underline">
      設定画面
    </Link>
  );
}

function listClassCodes(setting: TeacherSetting): string[] {
  const codes: string[] = [];
  for (const g of setting.grade_configs) {
    for (let i = 1; i <= g.class_count; i++) codes.push(`${g.grade}-${i}`);
  }
  return codes;
}

function gradeOf(classCode: string): number {
  return Number(classCode.split("-")[0]);
}

function todayString(): string {
  return formatDate(new Date(), "YYYY-MM-DD");
}

/** 保存済みデータから編集用の draft を作る。未実施のテストは空レコードを用意する */
function buildDraft(
  classCode: string,
  tests: TestMaster[],
  results: TestResult[]
): Record<string, TestResult> {
  const draft: Record<string, TestResult> = {};
  for (const t of tests) {
    const existing = results.find(
      (r) => r.test_id === t.test_id && r.class_code === classCode
    );
    draft[t.test_id] = existing
      ? structuredClone(existing)
      : {
          test_id: t.test_id,
          class_code: classCode,
          conducted_on: todayString(),
          scores: [],
        };
  }
  return draft;
}

/** 両方 null の行を捨て、出席番号順に並べる（保存前の正規化） */
function normalize(result: TestResult): TestResult {
  return {
    ...result,
    scores: result.scores
      .filter((s) => s.knowledge !== null || s.thinking !== null)
      .sort((a, b) => a.student_no - b.student_no),
  };
}

function serialize(draft: Record<string, TestResult>): string {
  return JSON.stringify(
    Object.keys(draft)
      .sort()
      .map((k) => normalize(draft[k]))
  );
}

function validate(results: TestResult[], tests: TestMaster[]): string | null {
  const masterById = new Map(tests.map((t) => [t.test_id, t]));
  for (const r of results) {
    const master = masterById.get(r.test_id);
    if (!master) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.conducted_on))
      return `「${master.test_name}」の実施日を入力してください`;

    for (const s of r.scores) {
      if (s.student_no < 1 || s.student_no > ROSTER_ROWS)
        return `出席番号が範囲外です（${s.student_no}）`;
      if (s.knowledge !== null && s.knowledge > master.max_knowledge)
        return `「${master.test_name}」${s.student_no}番の知識・技能が満点（${master.max_knowledge}）を超えています`;
      if (s.thinking !== null && s.thinking > master.max_thinking)
        return `「${master.test_name}」${s.student_no}番の思考・判断・表現が満点（${master.max_thinking}）を超えています`;
    }
  }
  return null;
}
