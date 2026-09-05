"use client";

import { useEffect, useMemo, useState } from "react";
import BackupPanel from "@/components/BackupPanel";
import GradeThresholdEditor from "@/components/GradeThresholdEditor";
import PageHeader from "@/components/PageHeader";
import TestMasterEditor from "@/components/TestMasterEditor";
import TimetableEditor from "@/components/TimetableEditor";
import Toast from "@/components/Toast";
import { useClassProgress } from "@/hooks/useClassProgress";
import { useGradeThresholds } from "@/hooks/useGradeThresholds";
import { useSetting } from "@/hooks/useSetting";
import { useTestMasters } from "@/hooks/useTestMasters";
import { useTimetable } from "@/hooks/useTimetable";
import { syncClassProgress } from "@/data/user/initialClassProgress";
import { localDataSource } from "@/lib/datasource/localDataSource";
import { VIEWPOINT_LABELS } from "@/lib/grading";
import type {
  CurriculumPack,
  GradeConfig,
  GradeThreshold,
  TeacherSetting,
  TestMaster,
  Timetable,
} from "@/types";

export default function SettingsPage() {
  const { setting, loading: settingLoading, save: saveSetting } = useSetting();
  const { progress, save: saveProgress } = useClassProgress();
  const { timetable, loading: timetableLoading, save: saveTimetable } = useTimetable();
  const {
    thresholds,
    loading: thresholdsLoading,
    save: saveThresholds,
  } = useGradeThresholds();
  const {
    testMasters,
    loading: testMastersLoading,
    save: saveTestMasters,
  } = useTestMasters();

  const [draft, setDraft] = useState<TeacherSetting | null>(null);
  const [timetableDraft, setTimetableDraft] = useState<Timetable[] | null>(null);
  const [thresholdDraft, setThresholdDraft] = useState<GradeThreshold[] | null>(null);
  const [testMasterDraft, setTestMasterDraft] = useState<TestMaster[] | null>(null);
  const [unitsByPack, setUnitsByPack] = useState<Record<string, string[]>>({});
  const [allPacks, setAllPacks] = useState<CurriculumPack[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [toastKind, setToastKind] = useState<"success" | "info" | "error">("success");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    localDataSource.listPacks().then(setAllPacks);
  }, []);

  // 読み込みが終わった時点で、編集用の draft を1度だけ作る。
  // useEffect ではなくレンダー中に行うのが React の推奨（余分な再レンダーが減る）。
  // 条件は draft が null のときだけなので、1回で収束して無限ループにはならない。
  if (setting && draft === null) setDraft(structuredClone(setting));
  if (!timetableLoading && timetableDraft === null) {
    setTimetableDraft(structuredClone(timetable));
  }
  if (!thresholdsLoading && thresholdDraft === null) {
    setThresholdDraft(structuredClone(thresholds));
  }
  if (!testMastersLoading && testMasterDraft === null) {
    setTestMasterDraft(structuredClone(testMasters));
  }

  // テストマスタの単元セレクト用に、担当パックの年間指導計画から単元名を集める
  const activePackIds = useMemo(
    () => [...new Set((draft?.grade_configs ?? []).map((g) => g.pack_id).filter((id) => id !== ""))],
    [draft?.grade_configs]
  );
  const activePackKey = activePackIds.join(",");

  useEffect(() => {
    const ids = activePackKey === "" ? [] : activePackKey.split(",");
    let cancelled = false;
    Promise.all(
      ids.map(async (id): Promise<[string, string[]]> => {
        const plan = await localDataSource.getAnnualPlan(id);
        return [id, [...new Set(plan.map((p) => p.unit_name))]];
      })
    ).then((entries) => {
      if (!cancelled) setUnitsByPack(Object.fromEntries(entries));
    });
    return () => {
      cancelled = true;
    };
  }, [activePackKey]);

  const packLabels = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const p of allPacks) {
      labels[p.id] = `${p.grade}年 / ${p.publisher_label} ${p.subject_label}`;
    }
    return labels;
  }, [allPacks]);

  const isDirty = useMemo(() => {
    if (!setting || !draft || timetableDraft === null) return false;
    if (thresholdDraft === null || testMasterDraft === null) return false;
    return (
      JSON.stringify(setting) !== JSON.stringify(draft) ||
      JSON.stringify(timetable) !== JSON.stringify(timetableDraft) ||
      JSON.stringify(thresholds) !== JSON.stringify(thresholdDraft) ||
      JSON.stringify(testMasters) !== JSON.stringify(testMasterDraft)
    );
  }, [
    setting,
    draft,
    timetable,
    timetableDraft,
    thresholds,
    thresholdDraft,
    testMasters,
    testMasterDraft,
  ]);

  if (
    settingLoading ||
    !draft ||
    !setting ||
    timetableLoading ||
    timetableDraft === null ||
    thresholdsLoading ||
    thresholdDraft === null ||
    testMastersLoading ||
    testMasterDraft === null
  ) {
    return (
      <div>
        <PageHeader title="設定" />
        <p className="text-slate-500">読み込み中...</p>
      </div>
    );
  }

  const updateField = <K extends keyof TeacherSetting>(key: K, value: TeacherSetting[K]) => {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const updateGradeConfig = (index: number, patch: Partial<GradeConfig>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = [...prev.grade_configs];
      next[index] = { ...next[index], ...patch };
      return { ...prev, grade_configs: next };
    });
  };

  const addGradeConfig = () => {
    setDraft((prev) => {
      if (!prev) return prev;
      const defaultPack = allPacks[0];
      const newGrade = nextAvailableGrade(prev.grade_configs);
      return {
        ...prev,
        grade_configs: [
          ...prev.grade_configs,
          {
            grade: newGrade,
            class_count: 1,
            pack_id: defaultPack?.id ?? "",
          },
        ],
      };
    });
  };

  const removeGradeConfig = (index: number) => {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        grade_configs: prev.grade_configs.filter((_, i) => i !== index),
      };
    });
  };

  const handleSave = async () => {
    if (!draft || thresholdDraft === null || testMasterDraft === null) return;
    const validation =
      validate(draft) ??
      validateThresholds(thresholdDraft) ??
      validateTestMasters(testMasterDraft);
    if (validation) {
      setToastKind("error");
      setToast(validation);
      return;
    }

    // クラス削除を伴うか確認
    const willLoseClasses = findClassesToRemove(setting, draft, progress);
    if (willLoseClasses.length > 0) {
      const ok = confirm(
        `以下のクラスが削除され、進度データが失われます。\n\n${willLoseClasses.join("、")}\n\n実行してよろしいですか？`
      );
      if (!ok) return;
    }

    setSaving(true);
    try {
      await saveSetting(draft);
      const syncedProgress = syncClassProgress(progress, draft.grade_configs);
      await saveProgress(syncedProgress);

      // 時間割も保存：grade_configs から消えたクラスの時限は自動削除
      const validClassCodes = new Set<string>();
      for (const gc of draft.grade_configs) {
        for (let i = 1; i <= gc.class_count; i++) {
          validClassCodes.add(`${gc.grade}-${i}`);
        }
      }
      const cleanedTimetable = timetableDraft.filter((t) => validClassCodes.has(t.class_code));
      await saveTimetable(cleanedTimetable);
      setTimetableDraft(cleanedTimetable);

      // 成績設定。テストマスタは学年構成から外れても削除しない
      // （test_id で紐づく得点データが集計不能になるため）
      await saveThresholds(thresholdDraft);
      await saveTestMasters(testMasterDraft);

      setToastKind("success");
      setToast("設定を保存しました");
    } catch (err) {
      setToastKind("error");
      setToast(`保存に失敗しました: ${String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setDraft(structuredClone(setting));
    setTimetableDraft(structuredClone(timetable));
    setThresholdDraft(structuredClone(thresholds));
    setTestMasterDraft(structuredClone(testMasters));
  };

  return (
    <div className="space-y-6">
      <PageHeader title="設定" subtitle="学校情報と学年構成を編集します" />

      {/* 基本情報 */}
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-bold text-slate-800">基本情報</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="学校名">
            <input
              type="text"
              value={draft.school_name}
              onChange={(e) => updateField("school_name", e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </Field>
          <Field label="教員名">
            <input
              type="text"
              value={draft.teacher_name}
              onChange={(e) => updateField("teacher_name", e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </Field>
          <Field label="年度">
            <input
              type="number"
              value={draft.school_year}
              onChange={(e) => updateField("school_year", Number(e.target.value))}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              min={2020}
              max={2100}
            />
            <p className="mt-1 text-xs text-slate-500">
              年度の切り替え（凍結アーカイブ）は Phase 15 で実装予定
            </p>
          </Field>
          <Field label="始業式日">
            <input
              type="date"
              value={draft.start_date}
              onChange={(e) => updateField("start_date", e.target.value)}
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            <p className="mt-1 text-xs text-slate-500">週番号算出の起点になります</p>
          </Field>
          <Field label="教員タイプ">
            <select
              value={draft.teacher_type}
              onChange={(e) =>
                updateField("teacher_type", e.target.value as "specialist" | "homeroom")
              }
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="specialist">専科教員（時間割でクラスを選択）</option>
              <option value="homeroom" disabled>
                担任教員（将来対応）
              </option>
            </select>
            <p className="mt-1 text-xs text-slate-500">
              MVP では専科教員のみ対応。担任教員モードは将来実装予定
            </p>
          </Field>
        </div>
      </section>

      {/* 学年構成 */}
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800">学年構成</h2>
            <p className="mt-1 text-xs text-slate-500">
              担当する学年・クラス数・使用パックを設定します。クラス名は `{`{学年}-{組番号}`}` 形式で自動生成されます。
            </p>
          </div>
          <button
            type="button"
            onClick={addGradeConfig}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            ＋ 学年を追加
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {draft.grade_configs.length === 0 && (
            <p className="rounded border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
              学年が1つもありません。「学年を追加」で登録してください。
            </p>
          )}

          {draft.grade_configs.map((gc, index) => {
            const availablePacks = allPacks.filter((p) => p.grade === gc.grade);
            const generatedClasses = Array.from(
              { length: gc.class_count },
              (_, i) => `${gc.grade}-${i + 1}`
            ).join(", ");
            return (
              <div
                key={index}
                className="grid gap-3 rounded border border-slate-200 p-4 md:grid-cols-[100px_120px_1fr_auto]"
              >
                <Field label="学年">
                  <select
                    value={gc.grade}
                    onChange={(e) => updateGradeConfig(index, { grade: Number(e.target.value) })}
                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  >
                    {[1, 2, 3, 4, 5, 6].map((g) => (
                      <option key={g} value={g}>
                        {g}年
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="クラス数">
                  <input
                    type="number"
                    value={gc.class_count}
                    onChange={(e) =>
                      updateGradeConfig(index, { class_count: Math.max(1, Number(e.target.value)) })
                    }
                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                    min={1}
                    max={20}
                  />
                </Field>
                <Field label="使用パック">
                  <select
                    value={gc.pack_id}
                    onChange={(e) => updateGradeConfig(index, { pack_id: e.target.value })}
                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                  >
                    <option value="">選択してください</option>
                    {availablePacks.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.publisher_label} / {p.subject_label} / {p.grade}年 (
                        {p.year}年発行)
                      </option>
                    ))}
                  </select>
                  {availablePacks.length === 0 && (
                    <p className="mt-1 text-xs text-amber-600">
                      {gc.grade}年に対応するパックが未登録です
                    </p>
                  )}
                </Field>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => removeGradeConfig(index)}
                    className="rounded border border-rose-300 bg-white px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50"
                    aria-label={`${gc.grade}年を削除`}
                  >
                    削除
                  </button>
                </div>
                <p className="col-span-full text-xs text-slate-500">
                  クラス：{generatedClasses}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 基本時間割 */}
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <div>
          <h2 className="text-lg font-bold text-slate-800">基本時間割</h2>
          <p className="mt-1 text-xs text-slate-500">
            月〜土 × 1〜6限のマトリクスで、各コマで担当するクラスを選択します。
            空欄は授業なし。週ごとの例外（休講／差し替え／追加）は週案画面で設定してください。
          </p>
        </div>
        <div className="mt-4">
          <TimetableEditor
            timetable={timetableDraft}
            gradeConfigs={draft.grade_configs}
            teacherType={draft.teacher_type}
            onChange={setTimetableDraft}
          />
        </div>
      </section>

      {/* 評定の閾値 */}
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <div>
          <h2 className="text-lg font-bold text-slate-800">評定の閾値</h2>
          <p className="mt-1 text-xs text-slate-500">
            テストの通算得点率から A / B / C を判定する基準です。初期値は 90% / 60%
            ですが、固定ではありません。学期評定の分布を見てから調整できます。
          </p>
        </div>
        <div className="mt-4">
          <GradeThresholdEditor thresholds={thresholdDraft} onChange={setThresholdDraft} />
        </div>
      </section>

      {/* テストマスタ */}
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <div>
          <h2 className="text-lg font-bold text-slate-800">テストマスタ</h2>
          <p className="mt-1 text-xs text-slate-500">
            使用する業者単元テストを登録します。手元のテスト冊子を見ながら、単元と
            観点別の満点を入れてください。年に1回の作業です。
          </p>
        </div>
        <div className="mt-4">
          <TestMasterEditor
            testMasters={testMasterDraft}
            gradeConfigs={draft.grade_configs}
            unitsByPack={unitsByPack}
            packLabels={packLabels}
            onChange={setTestMasterDraft}
          />
        </div>
      </section>

      {/* バックアップ */}
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <div>
          <h2 className="text-lg font-bold text-slate-800">バックアップ</h2>
          <p className="mt-1 text-xs text-slate-500">
            全年度のデータを1つの JSON ファイルに書き出します。
            この操作は<strong>下の「保存」とは無関係にその場で実行されます</strong>。
          </p>
        </div>
        <div className="mt-4">
          <BackupPanel
            onToast={(message, kind) => {
              setToastKind(kind);
              setToast(message);
            }}
          />
        </div>
      </section>

      {/* 保存ボタン */}
      <div className="sticky bottom-4 flex items-center justify-end gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
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

      <p className="text-xs text-slate-500">
        ※ Phase 15 で年度切り替えが追加される予定です。
      </p>

      <Toast message={toast} kind={toastKind} onDismiss={() => setToast(null)} />
    </div>
  );
}

type FieldProps = {
  label: string;
  children: React.ReactNode;
};

function Field({ label, children }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function nextAvailableGrade(configs: GradeConfig[]): number {
  const used = new Set(configs.map((c) => c.grade));
  for (const g of [1, 2, 3, 4, 5, 6]) {
    if (!used.has(g)) return g;
  }
  return 1;
}

function validate(setting: TeacherSetting): string | null {
  if (setting.school_name.trim() === "") return "学校名を入力してください";
  if (setting.teacher_name.trim() === "") return "教員名を入力してください";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(setting.start_date))
    return "始業式日を YYYY-MM-DD 形式で入力してください";
  if (setting.grade_configs.length === 0) return "学年を1つ以上登録してください";

  const grades = setting.grade_configs.map((g) => g.grade);
  if (new Set(grades).size !== grades.length) return "同じ学年を複数登録することはできません";

  for (const g of setting.grade_configs) {
    if (g.pack_id === "") return `${g.grade}年の使用パックを選択してください`;
    if (g.class_count < 1) return `${g.grade}年のクラス数は1以上にしてください`;
  }
  return null;
}

function validateThresholds(thresholds: GradeThreshold[]): string | null {
  for (const t of thresholds) {
    const label = VIEWPOINT_LABELS[t.viewpoint];
    if (!Number.isInteger(t.a_min) || t.a_min < 0 || t.a_min > 100)
      return `${label}の A の下限は 0〜100 の整数で入力してください`;
    if (!Number.isInteger(t.b_min) || t.b_min < 0 || t.b_min > 100)
      return `${label}の B の下限は 0〜100 の整数で入力してください`;
    if (t.b_min > t.a_min)
      return `${label}の B の下限は A の下限以下にしてください`;
  }
  return null;
}

function validateTestMasters(masters: TestMaster[]): string | null {
  const seenIds = new Set<string>();
  for (const m of masters) {
    const label = m.test_name.trim() === "" ? "(名称未設定)" : m.test_name;
    // 単元は任意。「1学期のまとめ」のように複数単元にまたがるテストがあるため、
    // 単元に紐づかない登録を許す。必須なのはテスト名と満点だけ。
    if (m.test_name.trim() === "") return "テスト名を入力してください";
    if (m.max_knowledge === 0 && m.max_thinking === 0)
      return `テスト「${label}」はどちらかの観点に満点を入力してください`;
    if (m.max_knowledge < 0 || m.max_thinking < 0)
      return `テスト「${label}」の満点は0以上にしてください`;
    // test_id は得点データの紐づけキー。重複するとデータが混ざる
    if (seenIds.has(m.test_id)) return `テストIDが重複しています（${m.test_id}）`;
    seenIds.add(m.test_id);
  }
  return null;
}

function findClassesToRemove(
  oldSetting: TeacherSetting,
  newSetting: TeacherSetting,
  progress: { class_code: string; total_completed_hours: number }[]
): string[] {
  const oldCodes = new Set<string>();
  for (const g of oldSetting.grade_configs) {
    for (let i = 1; i <= g.class_count; i++) oldCodes.add(`${g.grade}-${i}`);
  }
  const newCodes = new Set<string>();
  for (const g of newSetting.grade_configs) {
    for (let i = 1; i <= g.class_count; i++) newCodes.add(`${g.grade}-${i}`);
  }
  const removed: string[] = [];
  for (const code of oldCodes) {
    if (!newCodes.has(code)) {
      const p = progress.find((pp) => pp.class_code === code);
      // 進度0なら警告不要（真にデータ喪失するのは実進度があるクラス）
      if (!p || p.total_completed_hours > 0) removed.push(code);
    }
  }
  return removed;
}
