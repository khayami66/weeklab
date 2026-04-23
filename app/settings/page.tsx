"use client";

import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import Toast from "@/components/Toast";
import { useClassProgress } from "@/hooks/useClassProgress";
import { useSetting } from "@/hooks/useSetting";
import { syncClassProgress } from "@/data/user/initialClassProgress";
import { localDataSource } from "@/lib/datasource/localDataSource";
import type { CurriculumPack, GradeConfig, TeacherSetting } from "@/types";

export default function SettingsPage() {
  const { setting, loading: settingLoading, save: saveSetting } = useSetting();
  const { progress, save: saveProgress } = useClassProgress();

  const [draft, setDraft] = useState<TeacherSetting | null>(null);
  const [allPacks, setAllPacks] = useState<CurriculumPack[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [toastKind, setToastKind] = useState<"success" | "info" | "error">("success");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    localDataSource.listPacks().then(setAllPacks);
  }, []);

  useEffect(() => {
    if (setting && !draft) setDraft(structuredClone(setting));
  }, [setting, draft]);

  const isDirty = useMemo(() => {
    if (!setting || !draft) return false;
    return JSON.stringify(setting) !== JSON.stringify(draft);
  }, [setting, draft]);

  if (settingLoading || !draft || !setting) {
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
    if (!draft) return;
    const validation = validate(draft);
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
        ※ Phase 15 で年度切り替え、Phase 17 で JSON バックアップが追加される予定です。
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
