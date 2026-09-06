"use client";

import { useEffect, useMemo, useState } from "react";
import LessonPlanEditor from "@/components/LessonPlanEditor";
import PageHeader from "@/components/PageHeader";
import Toast from "@/components/Toast";
import { useLessonPlans } from "@/hooks/useLessonPlans";
import { useSetting } from "@/hooks/useSetting";
import { localDataSource } from "@/lib/datasource/localDataSource";
import { applyPlanRows, buildPlanRows, countFilled } from "@/lib/lessonPlan";
import type { AnnualPlan, CurriculumPack, LessonMaster, LessonPlan } from "@/types";
import { getActivePacks } from "@/types";

/**
 * 授業案・マスタ画面。
 *
 * **1時間ごとの授業内容をここで書く。**週案の各コマに出るのはこの内容で、
 * 書かれていない時間は「(未作成)」と表示される。
 *
 * 教科書ベースの標準案（パック層の `LessonMaster`）は全国で共有できる資産、
 * ここで書く授業案（`LessonPlan`）はその学校・その教員のもの、という2層構造。
 * 地域性・手元の教材・「教科書通りだとつまらない」への対応は、
 * すべてユーザー層に書けばよく、パック層は汚れない。
 */
export default function MasterPage() {
  const { setting, loading: settingLoading } = useSetting();
  const { plans, loading: plansLoading, save } = useLessonPlans();

  const [packs, setPacks] = useState<CurriculumPack[]>([]);
  const [annualPlans, setAnnualPlans] = useState<Record<string, AnnualPlan[]>>({});
  const [packMasters, setPackMasters] = useState<Record<string, LessonMaster[]>>({});
  const [packsLoading, setPacksLoading] = useState(true);

  const [selectedPack, setSelectedPack] = useState<string | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);

  /** 編集中の行。単元を切り替えたら作り直す */
  const [draftKey, setDraftKey] = useState<string | null>(null);
  const [rows, setRows] = useState<LessonPlan[]>([]);
  const [baseline, setBaseline] = useState("");

  const [toast, setToast] = useState<string | null>(null);
  const [toastKind, setToastKind] = useState<"success" | "info" | "error">("success");
  const [saving, setSaving] = useState(false);

  const activePackIds = useMemo(
    () => (setting ? getActivePacks(setting) : []),
    [setting]
  );

  useEffect(() => {
    let cancelled = false;
    if (activePackIds.length === 0) return;

    (async () => {
      const all = await localDataSource.listPacks();
      const aps: Record<string, AnnualPlan[]> = {};
      const lms: Record<string, LessonMaster[]> = {};
      for (const id of activePackIds) {
        aps[id] = await localDataSource.getAnnualPlan(id);
        lms[id] = await localDataSource.getLessonMaster(id);
      }
      if (cancelled) return;
      setPacks(all);
      setAnnualPlans(aps);
      setPackMasters(lms);
      setPacksLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [activePackIds]);

  const loading = settingLoading || plansLoading || packsLoading;

  const packLabel = (id: string) => {
    const p = packs.find((x) => x.id === id);
    return p ? `${p.grade}年 / ${p.publisher_label} ${p.subject_label}` : id;
  };

  /** 選択中パックの単元一覧（年間指導計画順） */
  const units = useMemo(
    () => (selectedPack ? (annualPlans[selectedPack] ?? []) : []),
    [selectedPack, annualPlans]
  );

  // 初期選択と draft の組み立てはレンダー中に1度だけ（useEffect 内の setState を避ける）
  if (!loading && selectedPack === null && activePackIds.length > 0) {
    setSelectedPack(activePackIds[0]);
  }
  const currentKey = selectedPack && selectedUnit ? `${selectedPack}::${selectedUnit}` : null;
  if (!loading && currentKey !== null && draftKey !== currentKey) {
    const built = buildPlanRows(
      selectedUnit!,
      selectedPack!,
      annualPlans[selectedPack!] ?? [],
      packMasters[selectedPack!] ?? [],
      plans
    );
    setDraftKey(currentKey);
    setRows(built);
    setBaseline(JSON.stringify(built));
  }

  const isDirty = currentKey !== null && JSON.stringify(rows) !== baseline;

  const selectPack = (id: string) => {
    if (id === selectedPack) return;
    if (isDirty && !confirm("保存していない授業案があります。破棄して切り替えますか？")) return;
    setSelectedPack(id);
    setSelectedUnit(null);
    setDraftKey(null);
    setRows([]);
  };

  const selectUnit = (name: string) => {
    if (name === selectedUnit) return;
    if (isDirty && !confirm("保存していない授業案があります。破棄して切り替えますか？")) return;
    setSelectedUnit(name);
  };

  const updateRow = (lessonNo: number, patch: Partial<LessonPlan>) => {
    setRows((prev) => prev.map((r) => (r.lesson_no === lessonNo ? { ...r, ...patch } : r)));
  };

  const handleSave = async () => {
    if (!selectedPack || !selectedUnit) return;
    setSaving(true);
    try {
      const next = applyPlanRows(plans, rows, selectedUnit, selectedPack);
      await save(next);
      setBaseline(JSON.stringify(rows));
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
    if (!selectedPack || !selectedUnit) return;
    if (!confirm("編集した内容を、最後に保存した状態に戻します。よろしいですか？")) return;
    const rebuilt = buildPlanRows(
      selectedUnit,
      selectedPack,
      annualPlans[selectedPack] ?? [],
      packMasters[selectedPack] ?? [],
      plans
    );
    setRows(rebuilt);
    setBaseline(JSON.stringify(rebuilt));
  };

  if (loading) {
    return (
      <div>
        <PageHeader title="授業案・マスタ" />
        <p className="text-slate-500">読み込み中...</p>
      </div>
    );
  }

  if (activePackIds.length === 0) {
    return (
      <div className="space-y-4">
        <PageHeader title="授業案・マスタ" />
        <p className="rounded border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          学年構成が設定されていません。設定画面で担当学年を登録してください。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="授業案・マスタ"
        subtitle="1時間ごとの授業内容を書きます。ここに書いた内容が週案の各コマに出ます"
      />

      {/* 学年 */}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-600">学年</span>
          {activePackIds.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => selectPack(id)}
              className={`min-h-11 rounded px-4 py-2 text-sm font-medium ${
                id === selectedPack
                  ? "bg-blue-600 text-white"
                  : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              {packLabel(id)}
            </button>
          ))}
        </div>
      </section>

      {/* 単元 */}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <span className="mb-2 block text-xs font-medium text-slate-600">
          単元（年間指導計画順）
        </span>
        <div className="flex flex-wrap gap-2">
          {units.map((u) => {
            const filled = selectedPack
              ? countFilled(u.unit_name, selectedPack, plans, packMasters[selectedPack] ?? [])
              : 0;
            const done = u.allocated_hours > 0 && filled >= u.allocated_hours;
            return (
              <button
                key={`${u.month}-${u.unit_name}`}
                type="button"
                onClick={() => selectUnit(u.unit_name)}
                className={`min-h-11 rounded border px-3 py-2 text-left text-sm ${
                  u.unit_name === selectedUnit
                    ? "border-blue-600 bg-blue-50 text-blue-800"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="block">{u.unit_name}</span>
                <span
                  className={`block text-xs tabular-nums ${
                    done ? "text-emerald-600" : "text-slate-400"
                  }`}
                >
                  {u.month}月・{u.allocated_hours}時間
                  {u.allocated_hours > 0 && `（${filled}/${u.allocated_hours} 記入）`}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          時間数は年間指導計画の配当時数です。記入数がそれに達すると緑になります。
        </p>
      </section>

      {selectedUnit === null ? (
        <p className="rounded border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          単元を選ぶと、配当時数ぶんの入力欄が出ます。
        </p>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-bold text-slate-700">{selectedUnit}</h2>
            <LessonPlanEditor unitName={selectedUnit} rows={rows} onChange={updateRow} />
          </section>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <span className="text-xs text-slate-500">
              {isDirty ? "未保存の変更があります" : "保存済み"}
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
      )}

      <Toast message={toast} kind={toastKind} onDismiss={() => setToast(null)} />
    </div>
  );
}
